"""Device-scoped ingestion and permission-checked timeline/playback."""
import asyncio
import hmac
import json
import os
from datetime import timedelta
from typing import Literal
from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import AwareDatetime, BaseModel, Field, model_validator
from sqlalchemy import select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.mobile.camera import viewer
from app.core.database import get_db
from app.models.camera_recording import CameraRecording
from app.models.device import Device
from app.api.v1.endpoints.mobile.camera_hls import router as hls_router
from app.services.storage import video_storage

router = APIRouter()
router.include_router(hls_router, prefix="/hls")


class RecordingMetadata(BaseModel):
    id: UUID
    device_id: UUID
    kind: Literal["segment", "incident", "snapshot"]
    started_at: AwareDatetime
    duration: float = Field(ge=0, le=30, allow_inf_nan=False)
    size_bytes: int = Field(gt=0, le=100 * 1024**2)
    object_key: str = Field(max_length=255)
    incident_id: UUID | None = None

    @model_validator(mode="after")
    def validate_object(self):
        suffix = ".jpg" if self.kind == "snapshot" else ".mp4"
        allowed = [f"cameras/{self.device_id}/{self.id}{suffix}"]
        if self.kind == "segment":
            allowed.append(f"cameras/{self.device_id}/{self.id}.ts")
        if self.object_key not in allowed:
            raise ValueError("Object key must match camera and recording IDs")
        if self.kind == "segment" and (not 0 < self.duration <= 2 or self.incident_id is not None):
            raise ValueError("Invalid two-second segment")
        if self.kind != "segment" and self.incident_id is None:
            raise ValueError("Evidence requires an incident ID")
        if (self.kind == "snapshot" and self.duration != 0) or (self.kind == "incident" and self.duration <= 0):
            raise ValueError("Invalid evidence duration")
        return self


class CoverageBand(BaseModel):
    start: AwareDatetime
    end: AwareDatetime


def authenticate_ingest(device_id, authorization):
    try:
        tokens = json.loads(os.getenv("VIDEO_INGEST_TOKENS", "{}"))
        expected = tokens.get(str(device_id), "")
        valid = isinstance(expected, str) and len(expected) >= 32
        valid = valid and hmac.compare_digest(authorization.encode(), f"Bearer {expected}".encode())
    except (ValueError, AttributeError):
        valid = False
    if not valid:
        raise HTTPException(401, "Invalid camera ingest credential")


@router.post("")
async def ingest(body: RecordingMetadata, authorization: str = Header(default=""), db: AsyncSession = Depends(get_db)):
    authenticate_ingest(body.device_id, authorization)
    device = await db.get(Device, body.device_id)
    if not device or device.device_type != "CAMERA" or not device.house_id:
        raise HTTPException(404, "Camera is not assigned to a house")
    existing = await db.get(CameraRecording, body.id)
    if existing:
        if any(getattr(existing, key) != value for key, value in body.model_dump().items()):
            raise HTTPException(409, "Recording metadata is immutable")
        return {"id": str(existing.id)}
    try:
        head = await asyncio.to_thread(lambda: video_storage.client().head_object(
            Bucket=video_storage.bucket(), Key=body.object_key))
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "S3 object is not available; retry metadata later") from None
    content_type = "image/jpeg" if body.kind == "snapshot" else "video/mp2t" if body.object_key.endswith(".ts") else "video/mp4"
    if head["ContentLength"] != body.size_bytes or head.get("ContentType") != content_type:
        raise HTTPException(400, "S3 object does not match metadata")
    inserted = await db.execute(insert(CameraRecording).values(**body.model_dump())
                               .on_conflict_do_nothing(index_elements=["id"]).returning(CameraRecording.id))
    if inserted.scalar_one_or_none() is None:
        existing = await db.get(CameraRecording, body.id)
        if existing is None or any(getattr(existing, key) != value for key, value in body.model_dump().items()):
            await db.rollback()
            raise HTTPException(409, "Recording metadata is immutable")
    await db.commit()
    return {"id": str(body.id)}


@router.get("")
async def timeline(start: AwareDatetime, end: AwareDatetime,
                   after_time: AwareDatetime | None = None, after_id: UUID | None = None,
                   incident_id: UUID | None = None, limit: int = Query(100, ge=1, le=300),
                   context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    if end <= start or end - start > timedelta(days=1) or (after_time is None) != (after_id is None):
        raise HTTPException(400, "Use a time range up to 24 hours and a complete cursor")
    query = select(CameraRecording).where(CameraRecording.device_id == context[1][0].id,
                                         CameraRecording.started_at >= start, CameraRecording.started_at < end)
    if incident_id:
        query = query.where(CameraRecording.incident_id == incident_id)
    if after_time is not None:
        query = query.where(tuple_(CameraRecording.started_at, CameraRecording.id) > tuple_(after_time, after_id))
    rows = list((await db.execute(query.order_by(CameraRecording.started_at, CameraRecording.id).limit(limit + 1))).scalars())
    items = rows[:limit]
    return {"items": [RecordingMetadata.model_validate(row, from_attributes=True).model_dump() for row in items],
            "next": {"after_time": items[-1].started_at, "after_id": items[-1].id} if len(rows) > limit else None}


@router.get("/coverage")
async def coverage(start: AwareDatetime, end: AwareDatetime,
                   context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    if end <= start or end - start > timedelta(days=1):
        raise HTTPException(400, "Use a time range up to 24 hours")
    query = select(CameraRecording.started_at, CameraRecording.duration).where(
        CameraRecording.device_id == context[1][0].id,
        CameraRecording.kind == "segment",
        CameraRecording.started_at < end,
        CameraRecording.started_at >= start - timedelta(seconds=30),
    ).order_by(CameraRecording.started_at)
    rows = (await db.execute(query)).all()
    bands: list[CoverageBand] = []
    for started_at, duration in rows:
        segment_end = started_at + timedelta(seconds=duration)
        if segment_end <= start:
            continue
        band_start = max(started_at, start)
        band_end = min(segment_end, end)
        if bands and band_start <= bands[-1].end + timedelta(seconds=3):
            bands[-1].end = max(bands[-1].end, band_end)
        else:
            bands.append(CoverageBand(start=band_start, end=band_end))
    return {"items": [band.model_dump() for band in bands]}


@router.get("/{recording_id}/playback")
async def playback(recording_id: UUID, response: Response, download: bool = False, context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    recording = await db.get(CameraRecording, recording_id)
    if not recording or recording.device_id != context[1][0].id:
        raise HTTPException(404, "Recording not found")
    params = {"Bucket": video_storage.bucket(), "Key": recording.object_key}
    if download:
        suffix = ".jpg" if recording.kind == "snapshot" else ".ts" if recording.object_key.endswith(".ts") else ".mp4"
        params["ResponseContentDisposition"] = f'attachment; filename="{recording_id}{suffix}"'
    try:
        url = await asyncio.to_thread(lambda: video_storage.client().generate_presigned_url(
            "get_object", Params=params, ExpiresIn=300))
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "Playback temporarily unavailable") from None
    return {"url": url, "expires_in": 300}

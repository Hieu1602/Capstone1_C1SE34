"""Device-scoped ingestion and permission-checked timeline/playback."""
import asyncio
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import AwareDatetime, BaseModel, Field, model_validator
from sqlalchemy import literal, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.mobile.camera import viewer
from app.core.database import get_db
from app.models.camera_recording import CameraRecording
from app.models.device import Device
from app.models.incident import Incident
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
        folder = "incidents" if self.kind in ("incident", "snapshot") else "cameras"
        allowed = [
            f"cameras/{self.device_id}/{self.id}{suffix}",
            f"{folder}/{self.device_id}/{self.id}{suffix}",
        ]
        if self.kind == "segment":
            allowed.append(f"cameras/{self.device_id}/{self.id}.ts")
            allowed.append(f"{folder}/{self.device_id}/{self.id}.ts")
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


class ArchiveItem(BaseModel):
    id: UUID
    device_id: UUID
    kind: Literal["segment", "incident", "snapshot", "manual_snapshot", "manual_clip"]
    started_at: AwareDatetime
    duration: float = Field(ge=0, le=3600, allow_inf_nan=False)
    size_bytes: int = Field(gt=0, le=500 * 1024**2)
    object_key: str = Field(max_length=255)
    incident_id: UUID | None = None


class SaveClipRequest(BaseModel):
    file_name: str | None = Field(default=None, max_length=180)
    recording_id: UUID | None = None
    started_at: AwareDatetime | None = None
    duration: float = Field(default=0, ge=0, le=3600, allow_inf_nan=False)


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
    updated_incident: Incident | None = None
    if body.kind in ("incident", "snapshot") and body.incident_id:
        incident = await db.get(Incident, body.incident_id)
        if incident:
            playback_url = f"/api/v1/camera/archive/{body.id}/playback"
            if body.kind == "incident" and (not incident.video_clip_url or incident.video_clip_url.startswith("/recordings/")):
                incident.video_clip_url = playback_url
                updated_incident = incident
            elif body.kind == "snapshot" and (not incident.thumbnail_url or incident.thumbnail_url.startswith("/recordings/")):
                incident.thumbnail_url = playback_url
                updated_incident = incident
    await db.commit()
    if updated_incident is not None:
        try:
            from app.services.redis import redis_service
            await redis_service.invalidate_incidents_cache()
        except Exception:
            pass
        try:
            from app.api.websockets.vitals_ws import alert_clients, manager
            ws_payload = {
                "type": "ALERT_MEDIA_UPDATED",
                "incident_id": str(updated_incident.id),
                "device_id": str(updated_incident.device_id),
                "video_clip_url": updated_incident.video_clip_url,
                "thumbnail_url": updated_incident.thumbnail_url,
            }
            await manager.broadcast_to_device(str(updated_incident.device_id), ws_payload)
            raw_msg = json.dumps(ws_payload, ensure_ascii=False)
            for client_ws in list(alert_clients):
                try:
                    await client_ws.send_text(raw_msg)
                except Exception:
                    if client_ws in alert_clients:
                        alert_clients.remove(client_ws)
        except Exception:
            pass
    return {"id": str(body.id)}


@router.get("")
async def timeline(start: AwareDatetime, end: AwareDatetime,
                   after_time: AwareDatetime | None = None, after_id: UUID | None = None,
                   incident_id: UUID | None = None, kinds: str | None = None,
                   limit: int = Query(100, ge=1, le=300),
                   context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    if end <= start or end - start > timedelta(days=30) or (after_time is None) != (after_id is None):
        raise HTTPException(400, "Use a time range up to 30 days and a complete cursor")
    query = select(CameraRecording).where(CameraRecording.device_id == context[1][0].id,
                                         CameraRecording.started_at >= start, CameraRecording.started_at < end)
    if incident_id:
        query = query.where(CameraRecording.incident_id == incident_id)
    if kinds:
        allowed_kinds = [k.strip() for k in kinds.split(",") if k.strip()]
        if allowed_kinds:
            query = query.where(CameraRecording.kind.in_(allowed_kinds))
    if after_time is not None:
        query = query.where(tuple_(CameraRecording.started_at, CameraRecording.id) > tuple_(literal(after_time), literal(after_id)))
    rows = list((await db.execute(query.order_by(CameraRecording.started_at, CameraRecording.id).limit(limit + 1))).scalars())
    items = rows[:limit]
    return {"items": [ArchiveItem.model_validate(row, from_attributes=True).model_dump() for row in items],
            "next": {"after_time": items[-1].started_at, "after_id": items[-1].id} if len(rows) > limit else None}


@router.get("/coverage")
async def coverage(start: AwareDatetime, end: AwareDatetime,
                   context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    if end <= start or end - start > timedelta(days=1):
        raise HTTPException(400, "Use a time range up to 24 hours")
    # Ưu tiên lấy dải bản ghi trực tiếp từ thẻ nhớ MicroSD của camera qua upstream
    import time as _time
    from app.api.v1.endpoints.mobile.camera_hls import _edge_unreachable_until
    cam_key = str(context[1][0].id)
    if _time.monotonic() >= _edge_unreachable_until.get(cam_key, 0.0):
        try:
            from app.api.v1.endpoints.mobile.camera import forward_camera
            res = await forward_camera(context, "/coverage", params={"start": start.isoformat(), "end": end.isoformat()})
            if isinstance(res, dict) and "items" in res and res["items"]:
                _edge_unreachable_until.pop(cam_key, None)
                return res
        except HTTPException as exc:
            if exc.status_code == 503 and "Không kết nối được" in str(exc.detail):
                _edge_unreachable_until[cam_key] = _time.monotonic() + 15.0
        except Exception:
            pass
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
        suffix = ".jpg" if recording.kind in ("snapshot", "manual_snapshot") else ".ts" if recording.object_key.endswith(".ts") else ".mp4"
        params["ResponseContentDisposition"] = f'attachment; filename="{recording_id}{suffix}"'
    try:
        url = await asyncio.to_thread(lambda: video_storage.client().generate_presigned_url(
            "get_object", Params=params, ExpiresIn=300))
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "Playback temporarily unavailable") from None
    return {"url": url, "expires_in": 300}


@router.delete("/{recording_id}")
async def delete_archive_recording(
    recording_id: UUID,
    context=Depends(viewer),
    db: AsyncSession = Depends(get_db),
):
    recording = await db.get(CameraRecording, recording_id)
    if not recording or recording.device_id != context[1][0].id:
        raise HTTPException(404, "Recording not found")
    try:
        await asyncio.to_thread(
            lambda: video_storage.client().delete_object(
                Bucket=video_storage.bucket(),
                Key=recording.object_key,
            )
        )
    except (BotoCoreError, ClientError):
        pass
    await db.delete(recording)
    await db.commit()
    return {"deleted": str(recording_id)}


async def _fetch_edge_bytes(device: Device, resource_path: str) -> bytes:
    from app.api.v1.endpoints.mobile.camera import client as cam_client, extra_sources
    dev_id = str(device.id)
    params = {}
    dev_config = getattr(device, "config", None)
    if dev_config and getattr(dev_config, "stream_url", None):
        params["src"] = dev_config.stream_url
    async with (cam_client(dev_id) if dev_id in extra_sources() else cam_client()) as upstream:
        resp = await upstream.get(resource_path, params=params)
        if resp.status_code >= 400:
            raise HTTPException(503, "Không lấy được dữ liệu từ camera")
        return resp.content


@router.post("/snapshot", status_code=201)
async def save_snapshot(context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    """Chụp ảnh từ camera và lưu trực tiếp lên AWS S3 để hiển thị ở mục Download."""
    _, (device, _) = context
    try:
        data = await _fetch_edge_bytes(device, "/snapshot.jpg")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Không kết nối được dịch vụ camera") from None
    if not data:
        raise HTTPException(503, "Ảnh chụp rỗng")
    rec_id = uuid4()
    key = f"manual/{device.id}/{rec_id}.jpg"
    now = datetime.now(timezone.utc)
    try:
        await asyncio.to_thread(
            lambda: video_storage.client().put_object(
                Bucket=video_storage.bucket(),
                Key=key,
                Body=data,
                ContentType="image/jpeg",
                ServerSideEncryption="AES256",
            )
        )
        url = await asyncio.to_thread(
            lambda: video_storage.client().generate_presigned_url(
                "get_object", Params={"Bucket": video_storage.bucket(), "Key": key}, ExpiresIn=300
            )
        )
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "Không lưu được ảnh lên AWS S3") from None
    row = CameraRecording(
        id=rec_id,
        device_id=device.id,
        kind="manual_snapshot",
        started_at=now,
        duration=0.0,
        size_bytes=len(data),
        object_key=key,
        incident_id=None,
    )
    db.add(row)
    await db.commit()
    return {"id": str(rec_id), "kind": "manual_snapshot", "started_at": now.isoformat(), "url": url}


@router.post("/clip", status_code=201)
async def save_clip(body: SaveClipRequest, context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    """Lưu đoạn video từ Playback lên AWS S3 để hiển thị ở mục Download và trả link tải về."""
    _, (device, _) = context
    data: bytes | None = None
    started_at = body.started_at or datetime.now(timezone.utc)
    duration = body.duration

    if body.file_name:
        import re as _re
        if not _re.fullmatch(r"[a-zA-Z0-9_\-\. ]+\.mp4", body.file_name) or ".." in body.file_name:
            raise HTTPException(400, "Tên file không hợp lệ")
        try:
            data = await _fetch_edge_bytes(device, f"/recordings/{body.file_name}")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503, "Không kết nối được dịch vụ camera") from None
    elif body.recording_id:
        src_row = await db.get(CameraRecording, body.recording_id)
        if not src_row or src_row.device_id != device.id:
            raise HTTPException(404, "Không tìm thấy bản ghi nguồn")
        started_at = src_row.started_at
        duration = duration or src_row.duration
        try:
            obj = await asyncio.to_thread(
                lambda: video_storage.client().get_object(Bucket=video_storage.bucket(), Key=src_row.object_key)
            )
            data = obj["Body"].read()
            obj["Body"].close()
        except (BotoCoreError, ClientError):
            raise HTTPException(503, "Không đọc được bản ghi từ S3") from None
    else:
        raise HTTPException(400, "Thiếu file_name hoặc recording_id")

    if not data:
        raise HTTPException(503, "Dữ liệu video rỗng")

    rec_id = uuid4()
    is_ts = bool(body.recording_id and not body.file_name)
    suffix = ".ts" if is_ts else ".mp4"
    content_type = "video/mp2t" if is_ts else "video/mp4"
    key = f"manual/{device.id}/{rec_id}{suffix}"
    try:
        await asyncio.to_thread(
            lambda: video_storage.client().put_object(
                Bucket=video_storage.bucket(),
                Key=key,
                Body=data,
                ContentType=content_type,
                ServerSideEncryption="AES256",
            )
        )
        url = await asyncio.to_thread(
            lambda: video_storage.client().generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": video_storage.bucket(),
                    "Key": key,
                    "ResponseContentDisposition": f'attachment; filename="{rec_id}{suffix}"',
                },
                ExpiresIn=300,
            )
        )
    except (BotoCoreError, ClientError):
        raise HTTPException(503, "Không lưu được video lên AWS S3") from None

    row = CameraRecording(
        id=rec_id,
        device_id=device.id,
        kind="manual_clip",
        started_at=started_at,
        duration=float(duration),
        size_bytes=len(data),
        object_key=key,
        incident_id=None,
    )
    db.add(row)
    await db.commit()
    return {"id": str(rec_id), "kind": "manual_clip", "started_at": started_at.isoformat(), "url": url}

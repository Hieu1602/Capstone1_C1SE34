"""Bounded, permission-checked HLS sessions for both TS and legacy MP4 archives."""
import asyncio
import hashlib
import math
import subprocess
import tempfile
import threading
import time
from collections import OrderedDict
from datetime import datetime, timedelta
from pathlib import Path
from uuid import UUID

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from jose import JWTError, jwt
from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.mobile.camera import access, viewer
from app.core.config import settings
from app.core.database import get_db
from app.crud.crud_user import crud_user
from app.models.camera_recording import CameraRecording
from app.services.storage import video_storage

router = APIRouter()
media_slots = asyncio.Semaphore(8)
PRIVATE_HEADERS = {"Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer"}
SEGMENT_HEADERS = {"Cache-Control": "private, max-age=3600", "Referrer-Policy": "no-referrer"}

_segment_cache = OrderedDict()
_segment_lock = threading.Lock()
_SEGMENT_CACHE_MAX = 256

_session_cache = OrderedDict()
_session_lock = threading.Lock()
_SESSION_CACHE_MAX = 32


async def recordings(db, device_id, start, end):
    result = await db.execute(select(CameraRecording).where(
        CameraRecording.device_id == device_id, CameraRecording.kind == "segment",
        CameraRecording.started_at >= start, CameraRecording.started_at < end,
    ).order_by(CameraRecording.started_at, CameraRecording.id).limit(1801))
    rows = list(result.scalars())
    if len(rows) > 1800:
        raise HTTPException(400, "Choose a smaller playback window")
    return rows


def fingerprint(rows):
    return hashlib.sha256("\n".join(str(row.id) for row in rows).encode()).hexdigest()


async def session_context(ticket: str = Query(...), db: AsyncSession = Depends(get_db)):
    try:
        claims = jwt.decode(ticket, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if claims["type"] != "camera_hls":
            raise ValueError()
        user_id, device_id = UUID(claims["sub"]), UUID(claims["device"])
        start, end = datetime.fromisoformat(claims["start"]), datetime.fromisoformat(claims["end"])
        if start.tzinfo is None or end.tzinfo is None or not timedelta(0) < end - start <= timedelta(minutes=30):
            raise ValueError()
    except (JWTError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Playback session expired or invalid") from None
    user = await crud_user.get(db, user_id=user_id)
    if not user:
        raise HTTPException(401, "Account not found")
    device, _ = await access(user, db, camera_id=str(device_id))
    if device.id != device_id:
        raise HTTPException(403, "Camera changed")
    return claims, device_id, start, end


@router.get("")
async def create_session(start: AwareDatetime, end: AwareDatetime, response: Response, context=Depends(viewer), db: AsyncSession = Depends(get_db)):
    response.headers.update(PRIVATE_HEADERS)
    if not timedelta(0) < end - start <= timedelta(minutes=30):
        raise HTTPException(400, "Use a playback window up to 30 minutes")
    user, (device, _) = context
    rows = await recordings(db, device.id, start, end)
    if not rows:
        raise HTTPException(404, "No recordings in this window")
    end = min(end, rows[-1].started_at + timedelta(seconds=rows[-1].duration))
    expires = int(time.time()) + 3600
    ticket = jwt.encode({"sub": str(user.id), "device": str(device.id), "type": "camera_hls",
                         "start": start.isoformat(), "end": end.isoformat(), "exp": expires,
                         "fingerprint": fingerprint(rows)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return {"path": f"/camera/archive/hls/manifest.m3u8?ticket={ticket}", "expires_at": expires,
            "items": [{"id": str(row.id), "started_at": row.started_at, "duration": row.duration} for row in rows]}


@router.get("/manifest.m3u8")
async def manifest(ticket: str, context=Depends(session_context), db: AsyncSession = Depends(get_db)):
    claims, device_id, start, end = context
    rows = await recordings(db, device_id, start, end)
    fp = fingerprint(rows)
    if fp != claims["fingerprint"]:
        raise HTTPException(409, "Archive changed; reopen playback")
    offsets = {}
    current_offset = 0
    for item in rows:
        offsets[item.id] = current_offset
        current_offset += item.duration
    with _session_lock:
        _session_cache[fp] = (rows, offsets, time.time() + 3600)
        if len(_session_cache) > _SESSION_CACHE_MAX:
            _session_cache.popitem(last=False)
    lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-PLAYLIST-TYPE:VOD",
             f"#EXT-X-TARGETDURATION:{max(1, math.ceil(max(row.duration for row in rows)))}",
             "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-INDEPENDENT-SEGMENTS"]
    for index, row in enumerate(rows):
        # Each independently encoded file has its own timestamp/codec sequence.
        if index:
            lines.append("#EXT-X-DISCONTINUITY")
        lines.extend([f"#EXT-X-PROGRAM-DATE-TIME:{row.started_at.isoformat()}",
                      f"#EXTINF:{row.duration:.6f},", f"{row.id}.ts?ticket={ticket}"])
    lines.append("#EXT-X-ENDLIST")
    return Response("\n".join(lines) + "\n", media_type="application/vnd.apple.mpegurl", headers=PRIVATE_HEADERS)


def transport_stream(key, expected_size, offset=0):
    cache_key = (key, offset, expected_size)
    with _segment_lock:
        if cache_key in _segment_cache:
            _segment_cache.move_to_end(cache_key)
            return _segment_cache[cache_key]
    result = video_storage.client().get_object(Bucket=video_storage.bucket(), Key=key)
    body = result["Body"]
    try:
        if not 0 < expected_size <= 100 * 1024**2 or result["ContentLength"] != expected_size:
            raise ValueError("Invalid recording size")
        data = body.read(expected_size + 1)
        if len(data) != expected_size:
            raise ValueError("Incomplete recording")
    finally:
        body.close()
    # Normalize timestamps to playlist time; independent files otherwise reset PTS.
    with tempfile.TemporaryDirectory(prefix="camera-hls-") as directory:
        source = Path(directory) / ("source.ts" if key.endswith(".ts") else "source.mp4")
        source.write_bytes(data)
        output = subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
            "-protocol_whitelist", "file,pipe", "-i", str(source), "-map", "0:v:0", "-an", "-c:v", "copy",
            "-bsf:v", "h264_mp4toannexb", "-output_ts_offset", str(offset),
            "-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts", "pipe:1",
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=20).stdout
    with _segment_lock:
        _segment_cache[cache_key] = output
        if len(_segment_cache) > _SEGMENT_CACHE_MAX:
            _segment_cache.popitem(last=False)
    return output


@router.get("/{recording_id}.ts")
async def segment(recording_id: UUID, context=Depends(session_context), db: AsyncSession = Depends(get_db)):
    claims, device_id, start, end = context
    row = await db.get(CameraRecording, recording_id)
    if not row or row.device_id != device_id or row.kind != "segment" or not start <= row.started_at < end:
        raise HTTPException(404, "Recording outside playback session")
    fp = claims["fingerprint"]
    cached = None
    with _session_lock:
        if fp in _session_cache:
            _, offsets, exp = _session_cache[fp]
            if time.time() < exp and recording_id in offsets:
                cached = offsets[recording_id]
                _session_cache.move_to_end(fp)
    if cached is not None:
        offset = cached
    else:
        rows = await recordings(db, device_id, start, end)
        if fingerprint(rows) != fp:
            raise HTTPException(409, "Archive changed; reopen playback")
        offsets = {}
        current_offset = 0
        for item in rows:
            offsets[item.id] = current_offset
            current_offset += item.duration
        if recording_id not in offsets:
            raise HTTPException(404, "Recording outside playback session")
        offset = offsets[recording_id]
        with _session_lock:
            _session_cache[fp] = (rows, offsets, time.time() + 3600)
            if len(_session_cache) > _SESSION_CACHE_MAX:
                _session_cache.popitem(last=False)
    try:
        async with media_slots:
            data = await asyncio.to_thread(transport_stream, row.object_key, row.size_bytes, offset)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in {"NoSuchKey", "NotFound"}:
            raise HTTPException(404, "Recording no longer exists in storage") from None
        raise HTTPException(503, "Recording temporarily unavailable") from None
    except (BotoCoreError, ClientError, OSError, ValueError, subprocess.SubprocessError):
        raise HTTPException(503, "Recording temporarily unavailable") from None
    return Response(data, media_type="video/mp2t", headers=SEGMENT_HEADERS)

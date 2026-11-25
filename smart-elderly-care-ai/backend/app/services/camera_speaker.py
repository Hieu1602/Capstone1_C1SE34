"""
camera_speaker.py – Dịch vụ tổng hợp giọng nói tiếng Việt (TTS) & phát qua loa camera (go2rtc / Tapo).

Tính năng:
- Chuyển văn bản tiếng Việt sang MP3 (Google Translate TTS qua httpx, không cần thư viện ngoài).
- Tạo câu nhắc nhở tiếng Việt tự nhiên, ấm áp theo buổi trong ngày và danh xưng người cao tuổi.
- Gửi audio tới dịch vụ tapo-camera -> go2rtc (tapo-audio) để phát ra loa camera Tapo.
- Tôn trọng chế độ riêng tư (is_sleep) và cấu hình loa 2 chiều (has_two_way_audio).
"""

from __future__ import annotations

import base64
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import os
import re
from typing import Any, Optional
from urllib.parse import unquote, urlparse
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device, DeviceType
from app.models.device_config import DeviceConfig
from app.models.elderly_profile import ElderlyProfile

logger = logging.getLogger("camera_speaker")

VN_TZ = timezone(timedelta(hours=7))
_TTS_CACHE: OrderedDict[str, bytes] = OrderedDict()
_TTS_CACHE_MAX = 64


# ---------------------------------------------------------------------------
# Smart Vietnamese Phrasing
# ---------------------------------------------------------------------------

def _split_tts_chunks(text: str, max_len: int = 180) -> list[str]:
    """Tách văn bản tiếng Việt thành các đoạn <= max_len ký tự theo dấu câu."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    if len(cleaned) <= max_len:
        return [cleaned]

    chunks: list[str] = []
    current = ""
    for part in re.split(r"(?<=[.!?;,])\s+", cleaned):
        if len(current) + len(part) + 1 <= max_len:
            current = f"{current} {part}".strip() if current else part
        else:
            if current:
                chunks.append(current)
            if len(part) <= max_len:
                current = part
            else:
                # Cắt theo khoảng trắng nếu câu đơn quá dài
                words = part.split(" ")
                current = ""
                for w in words:
                    if len(current) + len(w) + 1 <= max_len:
                        current = f"{current} {w}".strip() if current else w
                    else:
                        if current:
                            chunks.append(current)
                        current = w
    if current:
        chunks.append(current)
    return chunks


def format_vn_time_spoken(hhmm: str) -> str:
    """Chuyển '08:00' -> '8 giờ', '10:30' -> '10 giờ 30 phút'."""
    try:
        h_str, m_str = hhmm.strip().split(":", 1)
        h, m = int(h_str), int(m_str)
        if m == 0:
            return f"{h} giờ"
        return f"{h} giờ {m} phút"
    except Exception:
        return hhmm


def build_elderly_salutation(patient_name: Optional[str] = None, gender: Optional[str] = None) -> str:
    """Tạo cách xưng hô thân thiện cho người cao tuổi."""
    g = (gender or "").upper()
    title = "cụ ông" if g == "MALE" else ("cụ bà" if g == "FEMALE" else "cụ")
    if patient_name and patient_name.strip():
        return f"{title} {patient_name.strip()}"
    return title


def build_time_greeting(hour: Optional[int] = None) -> str:
    """Lời chào theo khung giờ Việt Nam."""
    h = datetime.now(VN_TZ).hour if hour is None else hour
    if 5 <= h < 11:
        return "Chào buổi sáng"
    if 11 <= h < 14:
        return "Chào buổi trưa"
    if 14 <= h < 18:
        return "Chào buổi chiều"
    return "Chào buổi tối"


def build_medication_reminder_text(
    medications: list[dict[str, Any]],
    time_hhmm: str,
    patient_name: Optional[str] = None,
    gender: Optional[str] = None,
    is_repeat: bool = False,
    hour: Optional[int] = None,
) -> str:
    """Gom các thuốc cùng cữ giờ thành một câu nhắc nhở tiếng Việt tự nhiên."""
    salutation = build_elderly_salutation(patient_name, gender)
    spoken_time = format_vn_time_spoken(time_hhmm)

    parts: list[str] = []
    for med in medications:
        name = str(med.get("name") or "thuốc").strip()
        dose = str(med.get("dose") or "").strip()
        instructions = str(med.get("instructions") or "").strip()
        desc = name
        if dose:
            desc += f", liều {dose}"
        if instructions and instructions.lower() not in dose.lower():
            desc += f", {instructions.lower()}"
        parts.append(desc)

    med_list = "; ".join(parts)
    if is_repeat:
        return (
            f"Nhắc lại nhẹ cho {salutation}. "
            f"Cụ vẫn chưa xác nhận đã uống thuốc cữ {spoken_time}: {med_list}. "
            f"Cụ nhớ uống thuốc với nước ấm để đảm bảo sức khỏe nhé."
        )

    greeting = build_time_greeting(hour)
    return (
        f"{greeting} {salutation}. "
        f"Đã đến {spoken_time}, mời cụ uống thuốc: {med_list}. "
        f"Cụ nhớ uống thuốc với nước ấm nhé."
    )


def build_hydration_reminder_text(
    time_hhmm: str,
    amount: str = "200ml",
    note: str = "",
    patient_name: Optional[str] = None,
    gender: Optional[str] = None,
) -> str:
    """Tạo câu nhắc uống nước ấm tiếng Việt."""
    salutation = build_elderly_salutation(patient_name, gender)
    spoken_time = format_vn_time_spoken(time_hhmm)
    extra = f" ({note.strip()})" if note and note.strip() else ""
    return (
        f"Đã đến {spoken_time} rồi {salutation} ơi. "
        f"Cụ nhớ uống khoảng {amount} nước ấm{extra} để tốt cho tuần hoàn nhé."
    )


def build_appointment_reminder_text(
    patient_name: Optional[str],
    doctor_name: str,
    scheduled_str: str,
    location: str,
    reminder_type: str,
    gender: Optional[str] = None,
) -> str:
    """Tạo câu nhắc lịch khám bác sĩ tiếng Việt."""
    salutation = build_elderly_salutation(patient_name, gender)
    if reminder_type == "BEFORE_24H":
        return (
            f"Nhắc lịch khám ngày mai cho {salutation}. "
            f"{doctor_name} sẽ khám lúc {scheduled_str} tại {location}. "
            f"Gia đình và cụ lưu ý chuẩn bị nhé."
        )
    return (
        f"Thông báo cho {salutation}: khoảng 2 giờ nữa sẽ đến lịch khám với {doctor_name} "
        f"lúc {scheduled_str} tại {location}. Cụ chuẩn bị sẵn sàng nhé."
    )


# ---------------------------------------------------------------------------
# Vietnamese TTS Synthesis
# ---------------------------------------------------------------------------

async def synthesize_vietnamese_tts(text: str) -> bytes:
    """Tổng hợp giọng nói tiếng Việt (MP3) qua Google Translate TTS."""
    chunks = _split_tts_chunks(text)
    if not chunks:
        raise ValueError("Nội dung nhắc nhở trống")

    cache_key = " ".join(chunks)
    if cache_key in _TTS_CACHE:
        _TTS_CACHE.move_to_end(cache_key)
        return _TTS_CACHE[cache_key]

    audio_parts: list[bytes] = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://translate.google.com/",
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(15, connect=5), headers=headers) as client:
        for chunk in chunks:
            resp = await client.get(
                "https://translate.google.com/translate_tts",
                params={"ie": "UTF-8", "q": chunk, "tl": "vi", "client": "tw-ob"},
            )
            resp.raise_for_status()
            if not resp.content:
                raise RuntimeError("TTS trả về audio rỗng")
            audio_parts.append(resp.content)

    audio_bytes = b"".join(audio_parts)
    _TTS_CACHE[cache_key] = audio_bytes
    while len(_TTS_CACHE) > _TTS_CACHE_MAX:
        _TTS_CACHE.popitem(last=False)
    return audio_bytes


# ---------------------------------------------------------------------------
# Camera Resolution & Playback
# ---------------------------------------------------------------------------

def _resolve_camera_upstream(device: Optional[Device]) -> tuple[str, str, str, Optional[str], str]:
    """Trả về (camera_service_url, username, password, tapo_src, dst_stream)."""
    extra_sources_raw = os.getenv("CAMERA_EXTRA_SOURCES", "{}")
    try:
        sources = json.loads(extra_sources_raw) if extra_sources_raw else {}
    except Exception:
        sources = {}

    cam_id = str(device.id) if device else ""
    source = sources.get(cam_id, {}) if isinstance(sources, dict) else {}

    base_url = (
        source.get("url")
        or os.getenv("CAMERA_SERVICE_URL")
        or "http://tapo-camera:8090"
    )
    username = source.get("username", os.getenv("CAMERA_HTTP_USERNAME", ""))
    password = source.get("password", os.getenv("CAMERA_HTTP_PASSWORD", ""))

    dst_stream = "tapo_intercom"
    tapo_src: Optional[str] = None
    cfg: Optional[DeviceConfig] = getattr(device, "config", None) if device else None
    if cfg and cfg.stream_url:
        u = urlparse(cfg.stream_url)
        if u.hostname and u.hostname not in ("192.168.1.100", "127.0.0.1", "localhost"):
            pwd = unquote(u.password) if u.password else ""
            extra = cfg.extra_settings or {}
            cloud_pwd = extra.get("cloud_password") or os.getenv("TAPO_CONTROL_PASSWORD") or pwd
            pwd_hash = hashlib.sha256(cloud_pwd.encode("utf-8")).hexdigest().upper()
            tapo_src = f"tapo://admin:{pwd_hash}@{u.hostname}"
            dst_stream = f"tapo_{device.id.hex}"

    return base_url, username, password, tapo_src, dst_stream


async def find_camera_for_patient(
    db: AsyncSession,
    patient_id: Optional[uuid.UUID] = None,
    house_id: Optional[uuid.UUID] = None,
) -> Optional[Device]:
    """Tìm camera phù hợp nhất cho người cao tuổi (ưu tiên camera gắn trực tiếp, rồi cùng nhà, rồi CAMERA_DEVICE_ID)."""
    if patient_id:
        res = await db.execute(
            select(Device)
            .where(Device.device_type == DeviceType.CAMERA, Device.elderly_id == patient_id)
            .order_by(Device.is_online.desc(), Device.created_at.desc())
            .limit(1)
        )
        dev = res.scalar_one_or_none()
        if dev:
            return dev

    if house_id:
        res = await db.execute(
            select(Device)
            .where(Device.device_type == DeviceType.CAMERA, Device.house_id == house_id)
            .order_by(Device.is_online.desc(), Device.created_at.desc())
            .limit(1)
        )
        dev = res.scalar_one_or_none()
        if dev:
            return dev

    default_cam_id = os.getenv("CAMERA_DEVICE_ID", "").strip()
    if default_cam_id:
        try:
            dev = await db.get(Device, uuid.UUID(default_cam_id))
            if dev and dev.device_type == DeviceType.CAMERA:
                return dev
        except Exception:
            pass

    res = await db.execute(
        select(Device)
        .where(Device.device_type == DeviceType.CAMERA)
        .order_by(Device.is_online.desc(), Device.created_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


async def speak_to_camera(
    device: Optional[Device],
    text: str,
    *,
    force: bool = False,
    volume: Optional[int] = None,
) -> dict[str, Any]:
    """Tổng hợp giọng nói tiếng Việt và phát ra loa của camera."""
    cfg: Optional[DeviceConfig] = getattr(device, "config", None) if device else None
    if cfg and not cfg.has_two_way_audio:
        return {"ok": False, "skipped": True, "reason": "Camera không hỗ trợ loa 2 chiều"}
    if cfg and cfg.is_sleep and not force:
        return {"ok": False, "skipped": True, "reason": "Camera đang bật chế độ riêng tư (is_sleep)"}

    extra = (cfg.extra_settings or {}) if cfg else {}
    resolved_vol = 80 if volume is None and extra.get("speaker_volume") is None else int(volume if volume is not None else extra.get("speaker_volume", 80))
    resolved_vol = max(0, min(100, resolved_vol))
    if resolved_vol <= 0:
        return {"ok": False, "skipped": True, "reason": "Âm lượng loa đang tắt (0%)"}

    base_url, username, password, tapo_src, dst_stream = _resolve_camera_upstream(device)
    auth = (username, password) if username and password else None

    audio_bytes = await synthesize_vietnamese_tts(text)
    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    async with httpx.AsyncClient(
        base_url=base_url,
        auth=auth,
        timeout=httpx.Timeout(20, connect=5),
        trust_env=False,
    ) as client:
        # Kiểm tra chế độ riêng tư trực tiếp trên camera nếu có thể
        if not force:
            try:
                priv = await client.get("/privacy")
                if priv.status_code == 200 and priv.json().get("result", {}).get("enabled") == "on":
                    return {"ok": False, "skipped": True, "reason": "Camera đang bật chế độ riêng tư"}
            except Exception:
                pass

        resp = await client.post(
            "/speaker/play",
            json={
                "audio_b64": audio_b64,
                "dst": dst_stream,
                "volume": resolved_vol,
                **({"tapo_src": tapo_src} if tapo_src else {}),
            },
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("[CameraSpeaker] Đã phát nhắc nhở qua loa %s (%d bytes): %s", dst_stream, len(audio_bytes), text[:80])
        return {"ok": True, "dst": dst_stream, "bytes": len(audio_bytes), "upstream": data}

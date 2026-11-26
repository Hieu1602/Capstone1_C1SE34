"""
voice_reminder_scheduler.py – Background worker phát nhắc nhở giọng nói tiếng Việt thông minh qua loa camera.

Tính năng thông minh:
- Đồng bộ đơn thuốc bác sĩ (PostgreSQL Prescription.enable_speaker_reminder) và lịch tùy chỉnh/uống nước (Redis).
- Bỏ qua các cữ đã được đánh dấu đã uống (taken/done) trong Redis.
- Gom nhiều thuốc cùng giờ thành 1 câu nhắc tiếng Việt tự nhiên, xưng hô theo tên/giới tính cụ.
- Tôn trọng giờ nghỉ ngơi ban đêm (22:00 - 05:59) và chế độ riêng tư của camera.
- Chống lặp lại (dedup Redis) + nhắc lại nhẹ 1 lần sau 15 phút nếu cụ chưa uống thuốc.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
import logging
from typing import Any, Optional
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionFactory, get_redis
from app.models.elderly_profile import ElderlyProfile
from app.models.prescription import Prescription
from app.services.camera_speaker import (
    VN_TZ,
    build_hydration_reminder_text,
    build_medication_reminder_text,
    find_camera_for_patient,
    speak_to_camera,
)

logger = logging.getLogger("voice_reminder_scheduler")


def _minutes_since(now_vn: datetime, hhmm: str) -> Optional[int]:
    """Tính số phút trôi qua kể từ mốc HH:MM trong ngày hôm nay (âm nếu chưa tới)."""
    try:
        h_str, m_str = hhmm.strip().split(":", 1)
        target = now_vn.replace(hour=int(h_str), minute=int(m_str), second=0, microsecond=0)
        return int((now_vn - target).total_seconds() // 60)
    except Exception:
        return None


def _is_quiet_hours(now_vn: datetime) -> bool:
    """Giờ nghỉ ngơi ban đêm: 22:00 - 05:59."""
    return now_vn.hour >= 22 or now_vn.hour < 6


class VoiceReminderSchedulerService:
    """Background worker kiểm tra mỗi phút và phát nhắc nhở tiếng Việt qua loa camera."""

    def __init__(self, poll_interval_seconds: int = 60):
        self.poll_interval = poll_interval_seconds
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop(), name="voice_reminder_scheduler_worker")
        logger.info("VoiceReminderSchedulerService started (poll=%ds).", self.poll_interval)

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("VoiceReminderSchedulerService stopped.")

    async def _run_loop(self) -> None:
        while self._running:
            try:
                await self.process_due_voice_reminders()
            except Exception as exc:
                logger.error("VoiceReminderSchedulerService loop error: %s", exc, exc_info=True)
            try:
                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break

    async def _get_redis_safe(self):
        try:
            return await get_redis()
        except Exception:
            return None

    async def _already_spoken(self, redis, key: str) -> bool:
        if not redis:
            return False
        try:
            return bool(await redis.get(key))
        except Exception:
            return False

    async def _mark_spoken(self, redis, key: str) -> None:
        if not redis:
            return
        try:
            await redis.set(key, "1", ex=48 * 3600)
        except Exception:
            pass

    async def _load_redis_day_state(self, redis, target_id: str, today_str: str) -> dict[str, Any]:
        if not redis:
            return {"medications": [], "hydrations": []}
        try:
            raw = await redis.get(f"reminders:{target_id}:{today_str}")
            if not raw:
                return {"medications": [], "hydrations": []}
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return {"medications": parsed, "hydrations": []}
        except Exception:
            pass
        return {"medications": [], "hydrations": []}

    async def process_due_voice_reminders(self, now_vn: Optional[datetime] = None) -> int:
        """Kiểm tra và phát các nhắc nhở thuốc/nước đến giờ qua loa camera. Trả về số lần đã phát."""
        now_vn = now_vn or datetime.now(VN_TZ)
        if _is_quiet_hours(now_vn):
            return 0

        today_str = now_vn.strftime("%Y-%m-%d")
        now_utc = now_vn.astimezone(timezone.utc)
        redis = await self._get_redis_safe()
        spoken_count = 0

        async with AsyncSessionFactory() as db:
            # 1. Lấy tất cả đơn thuốc ACTIVE có bật loa nhắc nhở
            stmt = select(Prescription).where(
                Prescription.status == "ACTIVE",
                Prescription.enable_speaker_reminder.is_(True),
                Prescription.start_date <= now_utc,
                or_(Prescription.end_date.is_(None), Prescription.end_date >= now_utc),
            )
            res = await db.execute(stmt)
            active_rxs = list(res.scalars().all())

            # Nhóm theo patient_id -> time_hhmm -> list[med_dict]
            patient_ids: set[uuid.UUID] = {rx.patient_id for rx in active_rxs}
            extra_target_ids: set[str] = set()
            if redis and hasattr(redis, "keys"):
                try:
                    for raw_k in await redis.keys(f"reminders:*:{today_str}"):
                        k_str = raw_k.decode() if isinstance(raw_k, bytes) else str(raw_k)
                        parts = k_str.split(":")
                        if len(parts) == 3:
                            tid = parts[1]
                            try:
                                patient_ids.add(uuid.UUID(tid))
                            except ValueError:
                                extra_target_ids.add(tid)
                except Exception:
                    pass

            meds_by_patient_time: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
            hydrations_by_patient: dict[str, list[dict[str, Any]]] = defaultdict(list)

            # Tải trạng thái Redis cho từng patient (từ DB và từ Redis reminders:*)
            redis_states: dict[str, dict[str, Any]] = {}
            for pid_str in [*(str(p) for p in patient_ids), *extra_target_ids]:
                state = await self._load_redis_day_state(redis, pid_str, today_str)
                redis_states[pid_str] = state
                hydrations_by_patient[pid_str].extend(state.get("hydrations", []))

            # Map trạng thái taken từ Redis cho rx-med-*
            taken_map: dict[str, bool] = {}
            for pid_str, state in redis_states.items():
                for m in state.get("medications", []):
                    mid = m.get("id")
                    if mid:
                        taken_map[mid] = bool(m.get("taken", False))
                    # Thuốc tạo thủ công (không phải rx-med-)
                    if mid and not str(mid).startswith("rx-med-") and not m.get("taken", False):
                        if m.get("enable_speaker_reminder", True) and m.get("time"):
                            meds_by_patient_time[pid_str][m["time"]].append(m)

            for rx in active_rxs:
                pid_str = str(rx.patient_id)
                for t in rx.schedule_times or ["08:00"]:
                    dose_id = f"rx-med-{rx.id}-{t.replace(':', '')}"
                    if taken_map.get(dose_id, False):
                        continue
                    meds_by_patient_time[pid_str][t].append({
                        "id": dose_id,
                        "name": rx.medication_name,
                        "dose": rx.dosage,
                        "instructions": rx.instructions or "",
                        "time": t,
                    })

            # Nạp thông tin ElderlyProfile cho từng patient
            profiles: dict[str, ElderlyProfile] = {}
            if patient_ids:
                p_res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id.in_(patient_ids)))
                for p in p_res.scalars().all():
                    profiles[str(p.id)] = p

            # 2. Xử lý nhắc nhở uống thuốc theo từng (patient, time)
            for pid_str, time_map in meds_by_patient_time.items():
                profile = profiles.get(pid_str)
                patient_name = profile.full_name if profile else None
                gender = profile.gender if profile else None
                house_id = profile.house_id if profile else None

                try:
                    pid_uuid: Optional[uuid.UUID] = uuid.UUID(pid_str)
                except ValueError:
                    pid_uuid = None

                camera_dev = await find_camera_for_patient(db, pid_uuid, house_id)
                if not camera_dev:
                    continue

                for time_hhmm, meds in time_map.items():
                    if not meds:
                        continue
                    delta = _minutes_since(now_vn, time_hhmm)
                    if delta is None:
                        continue

                    primary_key = f"voice_reminded:{today_str}:{pid_str}:med:{time_hhmm}"
                    repeat_key = f"voice_reminded_repeat:{today_str}:{pid_str}:med:{time_hhmm}"

                    if 0 <= delta <= 2 and not await self._already_spoken(redis, primary_key):
                        text = build_medication_reminder_text(
                            meds, time_hhmm, patient_name=patient_name, gender=gender, is_repeat=False, hour=now_vn.hour
                        )
                        if await self._safe_speak(camera_dev, text):
                            await self._mark_spoken(redis, primary_key)
                            spoken_count += 1
                    elif 15 <= delta <= 17 and not await self._already_spoken(redis, repeat_key):
                        # Chỉ nhắc lại nếu đã từng nhắc lần đầu (hoặc bỏ qua nếu đã uống)
                        text = build_medication_reminder_text(
                            meds, time_hhmm, patient_name=patient_name, gender=gender, is_repeat=True, hour=now_vn.hour
                        )
                        if await self._safe_speak(camera_dev, text):
                            await self._mark_spoken(redis, repeat_key)
                            spoken_count += 1

            # 3. Xử lý nhắc nhở uống nước
            for pid_str, hydrations in hydrations_by_patient.items():
                if not hydrations:
                    continue
                profile = profiles.get(pid_str)
                patient_name = profile.full_name if profile else None
                gender = profile.gender if profile else None
                house_id = profile.house_id if profile else None
                try:
                    pid_uuid = uuid.UUID(pid_str)
                except ValueError:
                    pid_uuid = None

                camera_dev = await find_camera_for_patient(db, pid_uuid, house_id)
                if not camera_dev:
                    continue

                for h in hydrations:
                    if h.get("done", False):
                        continue
                    time_hhmm = h.get("time", "")
                    delta = _minutes_since(now_vn, time_hhmm)
                    if delta is None or not (0 <= delta <= 2):
                        continue
                    h_key = f"voice_reminded:{today_str}:{pid_str}:hyd:{time_hhmm}"
                    if await self._already_spoken(redis, h_key):
                        continue
                    text = build_hydration_reminder_text(
                        time_hhmm,
                        amount=str(h.get("amount") or "200ml"),
                        note=str(h.get("note") or ""),
                        patient_name=patient_name,
                        gender=gender,
                    )
                    if await self._safe_speak(camera_dev, text):
                        await self._mark_spoken(redis, h_key)
                        spoken_count += 1

        return spoken_count

    async def _safe_speak(self, camera_dev, text: str) -> bool:
        try:
            res = await speak_to_camera(camera_dev, text, force=False)
            return bool(res.get("ok"))
        except Exception as exc:
            logger.warning("[VoiceReminder] Không thể phát qua loa camera: %s", exc)
            return False


voice_reminder_scheduler_service = VoiceReminderSchedulerService(poll_interval_seconds=60)

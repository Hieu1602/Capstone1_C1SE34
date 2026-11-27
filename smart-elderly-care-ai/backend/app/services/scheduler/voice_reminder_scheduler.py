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
from app.models.device import Device
from app.models.elderly_profile import ElderlyProfile
from app.models.incident import Incident
from app.models.prescription import Prescription
from app.services.camera_speaker import (
    VN_TZ,
    build_hydration_reminder_text,
    build_medication_reminder_text,
    find_camera_for_patient,
    speak_to_camera,
)
from app.services.notification.appointment_notify import (
    _invalidate_incidents_cache_safe,
    broadcast_alert_ws,
    send_appointment_fcm,
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
            # 1. Lấy tất cả đơn thuốc ACTIVE (nhắc điện thoại cho mọi đơn active; loa camera chỉ phát nếu enable_speaker_reminder=True)
            stmt = select(Prescription).where(
                Prescription.status == "ACTIVE",
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
                        "enable_speaker_reminder": bool(rx.enable_speaker_reminder),
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

                for time_hhmm, meds in time_map.items():
                    if not meds:
                        continue
                    delta = _minutes_since(now_vn, time_hhmm)
                    if delta is None:
                        continue

                    speaker_meds = [m for m in meds if m.get("enable_speaker_reminder", True)]
                    primary_key = f"voice_reminded:{today_str}:{pid_str}:med:{time_hhmm}"
                    repeat_key = f"voice_reminded_repeat:{today_str}:{pid_str}:med:{time_hhmm}"
                    mobile_pre15_key = f"mobile_pre15_reminded:{today_str}:{pid_str}:med:{time_hhmm}"
                    mobile_primary_key = f"mobile_reminded:{today_str}:{pid_str}:med:{time_hhmm}"
                    mobile_repeat_key = f"mobile_reminded_repeat:{today_str}:{pid_str}:med:{time_hhmm}"

                    if -15 <= delta <= -13:
                        if not await self._already_spoken(redis, mobile_pre15_key):
                            med_names = ", ".join(str(m.get("name") or "Thuốc") for m in meds[:3])
                            if len(meds) > 3:
                                med_names += f" và {len(meds) - 3} thuốc khác"
                            who = patient_name or "Người cao tuổi"
                            msg = f"Còn 15 phút nữa đến giờ uống thuốc ({time_hhmm}) cho {who}: {med_names}. Gia đình vui lòng chuẩn bị ăn uống và thuốc sẵn sàng nhé!"
                            await self._dispatch_mobile_reminder(
                                db=db,
                                house_id=house_id,
                                patient_id=pid_str,
                                alert_type="MEDICATION_REMINDER",
                                title=f"⏰ Chuẩn bị uống thuốc ({time_hhmm})",
                                message=msg,
                                fallback_device_id=camera_dev.id if camera_dev else None,
                                extra_note=f"TIME:{time_hhmm}|PRE15",
                            )
                            await self._mark_spoken(redis, mobile_pre15_key)
                    elif 0 <= delta <= 2:
                        if camera_dev and speaker_meds and not await self._already_spoken(redis, primary_key):
                            text = build_medication_reminder_text(
                                speaker_meds, time_hhmm, patient_name=patient_name, gender=gender, is_repeat=False, hour=now_vn.hour
                            )
                            if await self._safe_speak(camera_dev, text):
                                await self._mark_spoken(redis, primary_key)
                                spoken_count += 1
                        if not await self._already_spoken(redis, mobile_primary_key):
                            med_names = ", ".join(str(m.get("name") or "Thuốc") for m in meds[:3])
                            if len(meds) > 3:
                                med_names += f" và {len(meds) - 3} thuốc khác"
                            who = patient_name or "Người cao tuổi"
                            msg = f"Đã đến giờ uống thuốc ({time_hhmm}) cho {who}: {med_names}. Vui lòng kiểm tra và xác nhận đã uống."
                            await self._dispatch_mobile_reminder(
                                db=db,
                                house_id=house_id,
                                patient_id=pid_str,
                                alert_type="MEDICATION_REMINDER",
                                title=f"💊 Đến giờ uống thuốc ({time_hhmm})",
                                message=msg,
                                fallback_device_id=camera_dev.id if camera_dev else None,
                                extra_note=f"TIME:{time_hhmm}",
                            )
                            await self._mark_spoken(redis, mobile_primary_key)
                    elif 15 <= delta <= 17:
                        if camera_dev and speaker_meds and not await self._already_spoken(redis, repeat_key):
                            text = build_medication_reminder_text(
                                speaker_meds, time_hhmm, patient_name=patient_name, gender=gender, is_repeat=True, hour=now_vn.hour
                            )
                            if await self._safe_speak(camera_dev, text):
                                await self._mark_spoken(redis, repeat_key)
                                spoken_count += 1
                        if not await self._already_spoken(redis, mobile_repeat_key):
                            med_names = ", ".join(str(m.get("name") or "Thuốc") for m in meds[:3])
                            who = patient_name or "Người cao tuổi"
                            msg = f"Nhắc lại: {who} chưa xác nhận uống thuốc cữ {time_hhmm} ({med_names})."
                            await self._dispatch_mobile_reminder(
                                db=db,
                                house_id=house_id,
                                patient_id=pid_str,
                                alert_type="MEDICATION_REMINDER",
                                title=f"💊 Nhắc lại giờ uống thuốc ({time_hhmm})",
                                message=msg,
                                fallback_device_id=camera_dev.id if camera_dev else None,
                                extra_note=f"TIME:{time_hhmm}|REPEAT",
                            )
                            await self._mark_spoken(redis, mobile_repeat_key)

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

                for h in hydrations:
                    if h.get("done", False):
                        continue
                    time_hhmm = h.get("time", "")
                    delta = _minutes_since(now_vn, time_hhmm)
                    if delta is None or not (0 <= delta <= 2):
                        continue
                    h_key = f"voice_reminded:{today_str}:{pid_str}:hyd:{time_hhmm}"
                    mobile_h_key = f"mobile_reminded:{today_str}:{pid_str}:hyd:{time_hhmm}"
                    if camera_dev and not await self._already_spoken(redis, h_key):
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
                    if not await self._already_spoken(redis, mobile_h_key):
                        who = patient_name or "Người cao tuổi"
                        amount = str(h.get("amount") or "200ml")
                        msg = f"Đã đến giờ uống nước ({time_hhmm}) cho {who} ({amount})."
                        await self._dispatch_mobile_reminder(
                            db=db,
                            house_id=house_id,
                            patient_id=pid_str,
                            alert_type="HYDRATION_REMINDER",
                            title=f"💧 Nhắc uống nước ({time_hhmm})",
                            message=msg,
                            fallback_device_id=camera_dev.id if camera_dev else None,
                            extra_note=f"TIME:{time_hhmm}",
                        )
                        await self._mark_spoken(redis, mobile_h_key)

        return spoken_count

    async def _dispatch_mobile_reminder(
        self,
        db: AsyncSession,
        house_id: Optional[uuid.UUID],
        patient_id: str,
        alert_type: str,
        title: str,
        message: str,
        fallback_device_id: Optional[uuid.UUID] = None,
        extra_note: str = "",
    ) -> None:
        """Tạo Incident + phát WebSocket + gửi FCM để thanh thông báo Android luôn hiển thị."""
        try:
            device_id = fallback_device_id
            if not device_id and house_id:
                dev_res = await db.execute(select(Device.id).where(Device.house_id == house_id).limit(1))
                device_id = dev_res.scalar_one_or_none()
            if not device_id:
                any_dev = await db.execute(select(Device.id).limit(1))
                device_id = any_dev.scalar_one_or_none()

            inc_id = str(uuid.uuid4())
            created_iso = datetime.now(timezone.utc).isoformat()
            if device_id:
                note_parts = [f"PATIENT:{patient_id}"]
                if extra_note:
                    note_parts.append(extra_note)
                inc = Incident(
                    device_id=device_id,
                    alert_type=alert_type,
                    alert_level="LOW",
                    message=message,
                    is_acknowledged=False,
                    notes="|".join(note_parts),
                )
                db.add(inc)
                await db.commit()
                await db.refresh(inc)
                inc_id = str(inc.id)
                if inc.created_at:
                    created_iso = inc.created_at.isoformat()
                await _invalidate_incidents_cache_safe()

            await broadcast_alert_ws(
                {
                    "type": alert_type,
                    "alert_type": alert_type,
                    "patient_id": patient_id,
                    "house_id": str(house_id) if house_id else None,
                    "data": {
                        "id": inc_id,
                        "device_id": str(device_id) if device_id else "system",
                        "patient_id": patient_id,
                        "house_id": str(house_id) if house_id else None,
                        "title": title,
                        "message": message,
                        "created_at": created_iso,
                    },
                }
            )
            await send_appointment_fcm(
                db=db,
                target_house_id=house_id,
                doctor_id=None,
                title=title,
                body=message,
                data={
                    "incident_id": inc_id,
                    "alert_type": alert_type,
                    "patient_id": patient_id,
                },
            )
        except Exception as exc:
            logger.warning("[MobileReminder] Lỗi gửi thông báo %s: %s", alert_type, exc)

    async def _safe_speak(self, camera_dev, text: str) -> bool:
        try:
            res = await speak_to_camera(camera_dev, text, force=False)
            return bool(res.get("ok"))
        except Exception as exc:
            logger.warning("[VoiceReminder] Không thể phát qua loa camera: %s", exc)
            return False


voice_reminder_scheduler_service = VoiceReminderSchedulerService(poll_interval_seconds=60)

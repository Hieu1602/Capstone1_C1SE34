"""
appointment_notify.py – Xử lý thông báo đồng bộ 2 chiều cho Lịch khám Bác sĩ & Người nhà.
Đảm bảo khi Người nhà/Chủ hộ xác nhận lịch khám, Bác sĩ phụ trách sẽ nhận được:
1. Bản ghi thông báo trong CSDL (bảng incidents, định tuyến USER:{doctor_id}).
2. Thông báo đẩy FCM trực tiếp tới điện thoại Bác sĩ.
3. Sự kiện WebSocket tức thì (ALERT_NEW) cập nhật màn hình Bác sĩ.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import re
from typing import Optional
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.device import Device
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.incident import Incident
from app.models.user import User

logger = logging.getLogger("appointments.notify")

VN_TZ = timezone(timedelta(hours=7))


def format_vn_dt(dt: Optional[datetime], default: str = "") -> str:
    """Format a naive/aware datetime in UTC+7 (%H:%M ngày %d/%m/%Y)."""
    if dt is None:
        return default
    aware = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    return aware.astimezone(VN_TZ).strftime("%H:%M ngày %d/%m/%Y")


def extract_appointment_id(notes: Optional[str]) -> Optional[str]:
    """Extract UUID string from 'APT:<uuid>|...' or a bare UUID string."""
    if not notes:
        return None
    match = re.search(r"APT:([0-9a-fA-F-]+)", notes)
    candidate = match.group(1) if match else notes.strip()
    try:
        return str(uuid.UUID(candidate))
    except (ValueError, TypeError):
        return None


async def broadcast_alert_ws(payload: dict) -> None:
    """Broadcast JSON payload to alert_clients with per-client error handling & pruning."""
    try:
        from app.api.websockets.vitals_ws import alert_clients

        raw = json.dumps(payload, ensure_ascii=False)
        for client_ws in list(alert_clients):
            try:
                await client_ws.send_text(raw)
            except Exception:
                if client_ws in alert_clients:
                    alert_clients.remove(client_ws)
    except Exception as ws_err:
        logger.warning("[WS-Alerts] Broadcast error: %s", ws_err)


async def send_appointment_fcm(
    db: AsyncSession,
    target_house_id: Optional[uuid.UUID],
    doctor_id: Optional[uuid.UUID],
    title: str,
    body: str,
    data: dict,
) -> None:
    """Collect distinct FCM tokens for household and/or doctor and dispatch safely."""
    try:
        tokens: list[str] = []
        if target_house_id:
            h_stmt = (
                select(User)
                .outerjoin(HouseMember, HouseMember.user_id == User.id)
                .outerjoin(House, House.owner_id == User.id)
                .where(
                    User.is_active.is_(True),
                    or_(House.id == target_house_id, HouseMember.house_id == target_house_id),
                )
                .distinct()
            )
            h_res = await db.execute(h_stmt)
            tokens.extend(u.fcm_token for u in h_res.scalars().all() if u.fcm_token)

        if doctor_id:
            doc_user = await db.get(User, doctor_id)
            if doc_user and doc_user.fcm_token:
                tokens.append(doc_user.fcm_token)

        unique_tokens = list(dict.fromkeys(tokens))
        if not unique_tokens:
            return

        from app.core.config import settings
        from app.services.notification.fcm_service import FCMService

        fcm = FCMService()
        cred_path = Path(settings.FCM_SERVICE_ACCOUNT_PATH)
        if not cred_path.is_absolute() and not cred_path.is_file():
            cred_path = Path(__file__).resolve().parents[4] / cred_path
        if cred_path.is_file():
            fcm.initialize(str(cred_path))
        fcm.send_alert(unique_tokens, title, body, data=data, priority="high")
    except Exception as fcm_err:
        logger.warning("[APPOINTMENT_NOTIFY] Lỗi gửi FCM: %s", fcm_err)


async def _invalidate_incidents_cache_safe() -> None:
    try:
        from app.services.redis import redis_service

        await redis_service.invalidate_incidents_cache()
    except Exception:
        pass


async def notify_doctor_appointment_confirmed(
    db: AsyncSession,
    appointment_id: uuid.UUID | str,
    ack_user: Optional[User] = None,
) -> Optional[Appointment]:
    """
    Xử lý khi người nhà/chủ hộ xác nhận lịch hẹn của Bác sĩ:
    1. Gắn tag [ĐÃ XÁC NHẬN ĐÓN TIẾP] vào clinical_notes của Appointment.
    2. Đánh dấu sự cố APPOINTMENT_SCHEDULED của người nhà là đã xác nhận (is_acknowledged=True).
    3. Tạo thông báo (Incident) mới có định tuyến USER:{doctor_id} cho Bác sĩ phụ trách.
    4. Bắn thông báo đẩy FCM tới Bác sĩ nếu có fcm_token.
    5. Phát WebSocket real-time cho cả client Bác sĩ (ALERT_NEW) và Người nhà (INCIDENT_RESOLVED).
    """
    if isinstance(appointment_id, str):
        extracted = extract_appointment_id(appointment_id)
        if not extracted:
            return None
        apt_uuid = uuid.UUID(extracted)
    else:
        apt_uuid = appointment_id

    # 1. Lấy thông tin lịch hẹn
    stmt = (
        select(Appointment)
        .options(selectinload(Appointment.doctor), selectinload(Appointment.reminders))
        .where(Appointment.id == apt_uuid)
    )
    res = await db.execute(stmt)
    apt = res.scalar_one_or_none()
    if not apt:
        return None
    if apt.status != "UPCOMING":
        raise ValueError("Chỉ có thể xác nhận lịch khám đang chờ (UPCOMING).")

    # Cập nhật ghi chú xác nhận của gia đình
    confirm_tag = "[ĐÃ XÁC NHẬN ĐÓN TIẾP]"
    cleaned_notes = (apt.clinical_notes or "").replace("[BS dời lịch]", "").strip()
    if confirm_tag not in cleaned_notes or "[BS dời lịch]" in (apt.clinical_notes or ""):
        apt.clinical_notes = (
            cleaned_notes if confirm_tag in cleaned_notes else f"{confirm_tag} {cleaned_notes}".strip()
        )
        await db.commit()
        await db.refresh(apt)

    # 2. Đánh dấu đã xác nhận trong bảng incidents của người nhà
    resolved_inc_ids: list[str] = []
    try:
        inc_stmt = select(Incident).where(
            Incident.alert_type.in_(["APPOINTMENT_SCHEDULED", "APPOINTMENT_RESCHEDULED"]),
            or_(
                Incident.notes == str(apt.id),
                Incident.notes.contains(f"APT:{apt.id}"),
            ),
        )
        inc_res = await db.execute(inc_stmt)
        matched_incidents = list(inc_res.scalars().all())
        for inc in matched_incidents:
            inc.is_acknowledged = True
            inc.acknowledged_at = datetime.now(timezone.utc)
            inc.acknowledged_by = ack_user.id if ack_user else None
            resolved_inc_ids.append(str(inc.id))
        if matched_incidents:
            await db.commit()
            await _invalidate_incidents_cache_safe()
    except Exception as e:
        logger.warning("[APPOINTMENT_NOTIFY] Lỗi cập nhật incident cũ: %s", e)

    # 3. Lấy tên bệnh nhân & nhà
    patient_name = "Người cao tuổi"
    target_house_id = apt.house_id
    if apt.patient_id:
        eld_res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id == apt.patient_id))
        eld = eld_res.scalar_one_or_none()
        if eld:
            patient_name = eld.full_name
            if not target_house_id:
                target_house_id = eld.house_id

    # Định dạng ngày giờ và loại hình khám (UTC+7)
    scheduled_str = format_vn_dt(apt.scheduled_at, "thời gian đã hẹn")
    exam_label = apt.visit_type or "Khám bệnh"
    if exam_label == "HOME_VISIT":
        exam_label = "Khám bệnh tại nhà"
    elif exam_label == "CLINIC":
        exam_label = "Khám tại phòng khám"
    elif exam_label == "TELEHEALTH":
        exam_label = "Khám từ xa"

    notify_title = "🗓️ Gia đình đã xác nhận lịch khám"
    notify_msg = (
        f"Gia đình {patient_name} đã xác nhận đón tiếp Bác sĩ cho lịch khám '{exam_label}' "
        f"vào {scheduled_str}. Hãy chuẩn bị dụng cụ y tế và hồ sơ bệnh án."
    )

    # 4. Tìm thiết bị để liên kết incident
    dev_stmt = (
        select(Device.id).where(Device.house_id == target_house_id).limit(1)
        if target_house_id
        else select(Device.id).limit(1)
    )
    dev_res = await db.execute(dev_stmt)
    device_id = dev_res.scalar_one_or_none()
    if not device_id:
        any_dev = await db.execute(select(Device.id).limit(1))
        device_id = any_dev.scalar_one_or_none()

    doc_incident: Optional[Incident] = None
    if device_id and apt.doctor_id:
        # Kiểm tra xem đã tạo thông báo xác nhận cho bác sĩ chưa (tránh duplicate)
        existing_doc_notif = await db.execute(
            select(Incident)
            .where(
                Incident.alert_type == "APPOINTMENT_CONFIRMED",
                Incident.notes.contains(f"APT:{apt.id}"),
            )
            .limit(1)
        )
        found_existing = existing_doc_notif.scalar_one_or_none()
        if not found_existing:
            doc_incident = Incident(
                device_id=device_id,
                alert_type="APPOINTMENT_CONFIRMED",
                alert_level="LOW",
                message=notify_msg,
                is_acknowledged=False,
                notes=f"USER:{apt.doctor_id}|APPOINTMENT_CONFIRMED|APT:{apt.id}|PATIENT:{apt.patient_id}",
            )
            db.add(doc_incident)
            await db.commit()
            await db.refresh(doc_incident)
            await _invalidate_incidents_cache_safe()
        else:
            doc_incident = found_existing

    # 5. Gửi thông báo đẩy FCM tới Bác sĩ
    if apt.doctor_id:
        await send_appointment_fcm(
            db=db,
            target_house_id=None,
            doctor_id=apt.doctor_id,
            title=notify_title,
            body=notify_msg,
            data={
                "type": "APPOINTMENT_CONFIRMED",
                "appointment_id": str(apt.id),
                "patient_id": str(apt.patient_id),
            },
        )

    # 6. Phát WebSocket broadcast cho cả client Bác sĩ và Người nhà
    await broadcast_alert_ws(
        {
            "type": "ALERT_NEW",
            "alert_type": "APPOINTMENT_CONFIRMED",
            "appointment_id": str(apt.id),
            "data": {
                "id": str(doc_incident.id) if doc_incident else f"doc-apt-{apt.id}",
                "alert_type": "APPOINTMENT_CONFIRMED",
                "alert_level": "LOW",
                "message": notify_msg,
                "appointment_id": str(apt.id),
                "patient_id": str(apt.patient_id),
                "patient_name": patient_name,
                "target_user_id": str(apt.doctor_id) if apt.doctor_id else None,
                "created_at": (
                    doc_incident.created_at.isoformat()
                    if doc_incident and doc_incident.created_at
                    else None
                ),
            },
        }
    )

    for inc_id in resolved_inc_ids or [None]:
        await broadcast_alert_ws(
            {
                "type": "INCIDENT_RESOLVED",
                "alert_type": "APPOINTMENT_CONFIRMED",
                "incident_id": inc_id,
                "appointment_id": str(apt.id),
                "data": {
                    "id": inc_id or str(apt.id),
                    "appointment_id": str(apt.id),
                    "is_acknowledged": True,
                    "message": "Gia đình đã xác nhận đón tiếp Bác sĩ",
                },
            }
        )

    refreshed = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.doctor), selectinload(Appointment.reminders))
        .where(Appointment.id == apt.id)
    )
    return refreshed.scalar_one_or_none() or apt


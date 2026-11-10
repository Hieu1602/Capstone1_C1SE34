"""
appointment_notify.py – Xử lý thông báo đồng bộ 2 chiều cho Lịch khám Bác sĩ & Người nhà.
Đảm bảo khi Người nhà/Chủ hộ xác nhận lịch khám, Bác sĩ phụ trách sẽ nhận được:
1. Bản ghi thông báo trong CSDL (bảng incidents, định tuyến USER:{doctor_id}).
2. Thông báo đẩy FCM trực tiếp tới điện thoại Bác sĩ.
3. Sự kiện WebSocket tức thì (ALERT_NEW) cập nhật màn hình Bác sĩ.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.device import Device
from app.models.elderly_profile import ElderlyProfile
from app.models.incident import Incident
from app.models.user import User

logger = logging.getLogger("appointments.notify")


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
    try:
        if isinstance(appointment_id, str):
            apt_uuid = uuid.UUID(appointment_id)
        else:
            apt_uuid = appointment_id
    except (ValueError, TypeError):
        return None

    # 1. Lấy thông tin lịch hẹn
    stmt = select(Appointment).where(Appointment.id == apt_uuid)
    res = await db.execute(stmt)
    apt = res.scalar_one_or_none()
    if not apt:
        return None

    # Cập nhật ghi chú xác nhận của gia đình
    confirm_tag = "[ĐÃ XÁC NHẬN ĐÓN TIẾP]"
    if not apt.clinical_notes or confirm_tag not in apt.clinical_notes:
        apt.clinical_notes = f"{confirm_tag} {apt.clinical_notes or ''}".strip()
        await db.commit()
        await db.refresh(apt)

    # 2. Đánh dấu đã xác nhận trong bảng incidents của người nhà
    try:
        await db.execute(
            update(Incident)
            .where(
                Incident.alert_type == "APPOINTMENT_SCHEDULED",
                Incident.notes == str(apt.id),
            )
            .values(
                is_acknowledged=True,
                acknowledged_at=func.now(),
                acknowledged_by=ack_user.id if ack_user else None,
            )
        )
        await db.commit()
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

    # Định dạng ngày giờ và loại hình khám
    scheduled_str = apt.scheduled_at.strftime("%H:%M ngày %d/%m/%Y") if apt.scheduled_at else "thời gian đã hẹn"
    exam_label = apt.visit_type or "Khám bệnh"
    if exam_label == "HOME_VISIT":
        exam_label = "Khám bệnh tại nhà"
    elif exam_label == "CLINIC":
        exam_label = "Khám tại phòng khám"

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
        else:
            doc_incident = found_existing

    # 5. Gửi thông báo đẩy FCM tới Bác sĩ
    if apt.doctor_id:
        doc_user = await db.get(User, apt.doctor_id)
        if doc_user and doc_user.fcm_token:
            try:
                from app.core.config import settings
                from app.services.notification.fcm_service import FCMService

                fcm = FCMService()
                cred_path = Path(settings.FCM_SERVICE_ACCOUNT_PATH)
                if not cred_path.is_absolute() and not cred_path.is_file():
                    cred_path = Path(__file__).resolve().parents[4] / cred_path
                if cred_path.is_file():
                    fcm.initialize(str(cred_path))
                fcm.send_alert(
                    [doc_user.fcm_token],
                    notify_title,
                    notify_msg,
                    data={
                        "type": "APPOINTMENT_CONFIRMED",
                        "appointment_id": str(apt.id),
                        "patient_id": str(apt.patient_id),
                    },
                    priority="high",
                )
                logger.info("[FCM] Đã gửi thông báo xác nhận lịch khám tới Bác sĩ: %s", doc_user.full_name)
            except Exception as fcm_err:
                logger.warning("[APPOINTMENT_NOTIFY] Lỗi gửi FCM tới Bác sĩ: %s", fcm_err)

    # 6. Phát WebSocket broadcast cho cả client Bác sĩ và Người nhà
    try:
        from app.api.websockets.vitals_ws import alert_clients

        # 6.1 ALERT_NEW thông báo cho Bác sĩ
        ws_payload_doctor = json.dumps(
            {
                "type": "ALERT_NEW",
                "alert_type": "APPOINTMENT_CONFIRMED",
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
            },
            ensure_ascii=False,
        )

        # 6.2 INCIDENT_RESOLVED giải tỏa trạng thái chờ xác nhận phía Người nhà
        ws_payload_family = json.dumps(
            {
                "type": "INCIDENT_RESOLVED",
                "alert_type": "APPOINTMENT_CONFIRMED",
                "incident_id": str(apt.id),
                "data": {
                    "id": str(apt.id),
                    "appointment_id": str(apt.id),
                    "is_acknowledged": True,
                    "message": "Gia đình đã xác nhận đón tiếp Bác sĩ",
                },
            },
            ensure_ascii=False,
        )

        for client_ws in list(alert_clients):
            try:
                await client_ws.send_text(ws_payload_doctor)
                await client_ws.send_text(ws_payload_family)
            except Exception:
                if client_ws in alert_clients:
                    alert_clients.remove(client_ws)
    except Exception as ws_err:
        logger.warning("[APPOINTMENT_NOTIFY] Lỗi broadcast WebSocket: %s", ws_err)

    return apt


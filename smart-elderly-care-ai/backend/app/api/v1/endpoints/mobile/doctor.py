"""
doctor.py – Endpoints nghiệp vụ y khoa dành cho Bác sĩ gia đình.
Vị trí: backend/app/api/v1/endpoints/doctor.py
"""

import logging
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("doctor")

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.crud.crud_doctor import crud_doctor
from app.crud.crud_elderly import crud_elderly
from app.crud.crud_appointment import crud_appointment
from app.models.user import User
from app.schemas.doctor import (
    DoctorPatientCard,
    DoctorPatientDetail,
    PrescriptionItem,
    PrescriptionCreate,
    PrescriptionUpdate,
    BatchPrescriptionCreate,
    DoctorMedicalRecordUpdate,
    DoctorVitalsAnalytics,
    ThresholdsUpdate,
)
from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCreate,
    AppointmentResponse,
    AppointmentUpdate,
)
from app.schemas.patient import (
    PatientMedicalRecordOut,
    PatientMedicalRecordUpdate,
)

router = APIRouter()


@router.get(
    "/patients",
    response_model=List[DoctorPatientCard],
    summary="Danh sách bệnh nhân người cao tuổi mà Bác sĩ được phân công quản lý",
)
async def get_doctor_assigned_patients(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về danh sách người cao tuổi trong tất cả các căn nhà mà Bác sĩ được phân quyền (house_members).
    Bao gồm thông tin sinh hiệu tức thời (nhịp tim, SpO2, nhiệt độ da) và trạng thái y tế.
    """
    if not current_user:
        current_user = User(
            id="b3333333-b4e1-4b08-b2d3-d949a0eb075c",
            phone="",
            full_name="BS. Trần Văn Minh",
            role="doctor",
        )

    return await crud_doctor.get_assigned_patients(db=db, doctor_user=current_user)


@router.get(
    "/patients/{elderly_id}",
    response_model=DoctorPatientDetail,
    summary="Chi tiết hồ sơ bệnh nhân người cao tuổi cho Bác sĩ",
)
async def get_patient_detail(
    elderly_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lấy đầy đủ thông tin bệnh án, chỉ số thể trạng, dị ứng thuốc và đơn thuốc."""
    return await crud_doctor.get_patient_detail(db=db, elderly_id_or_serial=elderly_id)


@router.get(
    "/patients/{elderly_id}/prescriptions",
    response_model=List[PrescriptionItem],
    summary="Lấy danh mục các loại thuốc đang được kê đơn",
)
async def get_patient_prescriptions(elderly_id: str):
    """Trả về danh sách đơn thuốc điều trị của bệnh nhân."""
    return crud_doctor.get_prescriptions(elderly_id)


@router.post(
    "/patients/{elderly_id}/prescriptions",
    response_model=PrescriptionItem,
    status_code=status.HTTP_201_CREATED,
    summary="Bác sĩ kê đơn thuốc mới & thiết lập lịch nhắc nhở",
)
async def create_prescription(
    elderly_id: str,
    prescription_in: PrescriptionCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Bác sĩ kê đơn thuốc mới:
    - Lưu vào hồ sơ điều trị.
    - Tự động đồng bộ lịch nhắc uống thuốc xuống Hub Orange Pi 5 để phát loa giọng nói tiếng Việt.
    """
    doctor_name = current_user.full_name if current_user else "BS. Trần Văn Minh"
    return crud_doctor.add_prescription(
        elderly_id=elderly_id,
        obj_in=prescription_in,
        doctor_name=doctor_name,
    )


@router.post(
    "/patients/{elderly_id}/prescriptions/batch",
    response_model=List[PrescriptionItem],
    status_code=status.HTTP_201_CREATED,
    summary="Bác sĩ kê một đơn thuốc gồm nhiều loại thuốc và số lượng khác nhau",
)
async def create_batch_prescriptions(
    elderly_id: str,
    batch_in: BatchPrescriptionCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    doctor_name = current_user.full_name if current_user else "BS. Trần Văn Minh"
    return crud_doctor.add_batch_prescriptions(
        elderly_id=elderly_id,
        batch=batch_in,
        doctor_name=doctor_name,
    )


@router.put(
    "/patients/{elderly_id}/prescriptions/{rx_id}",
    response_model=PrescriptionItem,
    summary="Bác sĩ cập nhật đơn thuốc hiện có",
)
async def update_prescription(
    elderly_id: str,
    rx_id: str,
    prescription_in: PrescriptionUpdate,
):
    """Chỉnh sửa liều lượng, giờ uống hoặc hướng dẫn của đơn thuốc."""
    updated = crud_doctor.update_prescription(elderly_id, rx_id, prescription_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn thuốc.")
    return updated


@router.delete(
    "/patients/{elderly_id}/prescriptions/{rx_id}",
    summary="Bác sĩ ngừng hoặc xóa đơn thuốc",
)
async def delete_prescription(
    elderly_id: str,
    rx_id: str,
):
    """Ngừng dùng hoặc loại bỏ đơn thuốc khỏi phác đồ."""
    success = crud_doctor.delete_prescription(elderly_id, rx_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn thuốc cần xóa.")
    return {"success": True, "message": "Đã ngừng đơn thuốc thành công."}


@router.patch(
    "/patients/{elderly_id}/prescriptions/{rx_id}/toggle-reminder",
    response_model=PrescriptionItem,
    summary="Bật/tắt phát loa thông minh nhắc uống thuốc",
)
async def toggle_prescription_reminder(
    elderly_id: str,
    rx_id: str,
):
    """Bật/tắt tính năng loa thông minh Hub nhắc giờ uống thuốc."""
    updated = crud_doctor.toggle_prescription_reminder(elderly_id, rx_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn thuốc.")
    return updated


@router.put(
    "/patients/{elderly_id}/medical-record",
    response_model=DoctorPatientDetail,
    summary="Bác sĩ cập nhật hồ sơ bệnh án, bệnh nền, dị ứng, dinh dưỡng & dặn dò y khoa",
)
async def update_patient_medical_record(
    elderly_id: str,
    record_in: DoctorMedicalRecordUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật chẩn đoán bệnh nền, dị ứng, chế độ ăn hoặc ngày hẹn tái khám."""
    return await crud_doctor.update_clinical_record(
        db=db,
        elderly_id=elderly_id,
        obj_in=record_in,
    )


@router.get(
    "/patients/{elderly_id}/analytics",
    response_model=DoctorVitalsAnalytics,
    summary="Phân tích sinh hiệu chuỗi thời gian dài hạn từ TimescaleDB",
)
async def get_vitals_analytics(
    elderly_id: str,
    days: int = Query(7, ge=1, le=30, description="Số ngày cần phân tích (1 - 30)"),
    db: AsyncSession = Depends(get_db),
):
    """Trích xuất dữ liệu xu hướng nhịp tim, SpO2, độ ổn định sinh hiệu."""
    return await crud_doctor.get_vitals_analytics(db=db, elderly_id=elderly_id, days=days)


@router.put(
    "/patients/{elderly_id}/thresholds",
    summary="Cập nhật ngưỡng an toàn sinh hiệu cá nhân hóa",
)
async def update_patient_thresholds(
    elderly_id: str,
    thresholds_in: ThresholdsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Bác sĩ điều chỉnh ngưỡng cảnh báo tim mạch, SpO2 phù hợp với bệnh nền của cụ."""
    return await crud_doctor.update_thresholds(
        db=db, elderly_id=elderly_id, thresholds_in=thresholds_in
    )


# ==============================================================================
# QUẢN LÝ LỊCH HẸN & TÁI KHÁM ĐỊNH KỲ (APPOINTMENTS - UC.0)
# ==============================================================================

@router.get(
    "/appointments",
    response_model=List[AppointmentResponse],
    summary="Danh sách lịch khám và tái khám định kỳ cho các bệnh nhân",
)
async def get_doctor_appointments(
    status: Optional[str] = Query(None, description="Trạng thái (UPCOMING | COMPLETED | CANCELLED)"),
    patient_id: Optional[str] = Query(None, description="Lọc theo bệnh nhân"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các cuộc hẹn tái khám, xét nghiệm và kiểm tra định kỳ của Bác sĩ."""
    doctor_uuid = current_user.id if current_user and current_user.role == "doctor" else None
    patient_uuid = None
    if patient_id:
        try:
            patient_uuid = uuid.UUID(patient_id)
        except ValueError:
            pass

    records = await crud_appointment.get_appointments(
        db=db,
        doctor_id=doctor_uuid,
        patient_id=patient_uuid,
        status=status,
    )

    patient_ids = list({r.patient_id for r in records if r.patient_id})
    patient_names: Dict[Any, str] = {}
    if patient_ids:
        from sqlalchemy import select
        from app.models.elderly_profile import ElderlyProfile
        eld_stmt = select(ElderlyProfile.id, ElderlyProfile.full_name).where(ElderlyProfile.id.in_(patient_ids))
        eld_res = await db.execute(eld_stmt)
        for row in eld_res.all():
            patient_names[row[0]] = row[1]

    out = []
    for r in records:
        real_patient_name = patient_names.get(r.patient_id, "Bệnh nhân")
        out.append(
            AppointmentResponse(
                id=str(r.id),
                doctor_id=str(r.doctor_id) if r.doctor_id else None,
                doctor_name=r.doctor.full_name if r.doctor else "Bác sĩ",
                patient_id=str(r.patient_id),
                patient_name=real_patient_name,
                house_id=str(r.house_id) if r.house_id else None,
                visit_type=r.visit_type,
                scheduled_at=r.scheduled_at,
                duration_minutes=r.duration_minutes,
                location=r.location,
                clinical_notes=r.clinical_notes,
                status=r.status,
                cancellation_reason=r.cancellation_reason,
                recurrence_pattern=r.recurrence_pattern,
                parent_recurring_id=str(r.parent_recurring_id) if r.parent_recurring_id else None,
                enable_speaker_reminder=r.enable_speaker_reminder,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )
    return out


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo lịch khám/tái khám mới & hẹn lịch nhắc nhở",
)
async def create_doctor_appointment(
    appointment_in: AppointmentCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Bác sĩ lên lịch tái khám mới và tự động kích hoạt nhắc nhở FCM trước giờ hẹn 24h & 2h."""
    doctor_id = current_user.id if current_user and current_user.role == "doctor" else None
    created_by = current_user.id if current_user else None

    try:
        root_apt, created_count, reminders_count = await crud_appointment.create_appointment_series(
            db=db,
            obj_in=appointment_in,
            doctor_id=doctor_id,
            created_by=created_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    doctor_name = current_user.full_name if current_user else "BS. Trần Văn Minh"
    patient_name = appointment_in.patient_name or "Người cao tuổi"
    scheduled_str = root_apt.scheduled_at.strftime("%H:%M ngày %d/%m/%Y")
    exam_label = getattr(appointment_in, "exam_type", None) or root_apt.visit_type or "Khám bệnh định kỳ"
    notify_title = f"🗓️ Lịch khám mới từ Bác sĩ {doctor_name}"
    notify_msg = f"Bác sĩ {doctor_name} đã lên lịch khám '{exam_label}' cho {patient_name} vào {scheduled_str}. Gia đình vui lòng mở ứng dụng để xác nhận đón tiếp."

    # 1. Tạo bản ghi Thông báo / Sự cố (In-App Notification) vào bảng incidents
    try:
        import json
        from sqlalchemy import or_, select
        from app.models.house import House, HouseMember
        from app.models.device import Device
        from app.models.incident import Incident
        from app.models.elderly_profile import ElderlyProfile

        # Tìm house_id của bệnh nhân nếu chưa có
        target_house_id = root_apt.house_id
        if not target_house_id and root_apt.patient_id:
            eld_res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id == root_apt.patient_id))
            eld = eld_res.scalar_one_or_none()
            if eld:
                target_house_id = eld.house_id
                if not appointment_in.patient_name:
                    patient_name = eld.full_name

        # Tìm một thiết bị trong nhà (hoặc device bất kỳ) để liên kết sự cố
        dev_stmt = select(Device.id).where(Device.house_id == target_house_id).limit(1) if target_house_id else select(Device.id).limit(1)
        dev_res = await db.execute(dev_stmt)
        device_id = dev_res.scalar_one_or_none()
        if not device_id:
            any_dev = await db.execute(select(Device.id).limit(1))
            device_id = any_dev.scalar_one_or_none()

        if device_id:
            new_incident = Incident(
                device_id=device_id,
                alert_type="APPOINTMENT_SCHEDULED",
                alert_level="LOW",
                message=notify_msg,
                is_acknowledged=False,
                notes=str(root_apt.id),
            )
            db.add(new_incident)
            await db.commit()
            await db.refresh(new_incident)

            # 2. Phát qua WebSocket tới client mobile / web đang mở
            try:
                from app.api.websockets.vitals_ws import alert_clients
                ws_payload = json.dumps({
                    "type": "ALERT_NEW",
                    "alert_type": "APPOINTMENT_SCHEDULED",
                    "data": {
                        "id": str(new_incident.id),
                        "alert_type": "APPOINTMENT_SCHEDULED",
                        "alert_level": "LOW",
                        "message": new_incident.message,
                        "appointment_id": str(root_apt.id),
                        "created_at": new_incident.created_at.isoformat() if new_incident.created_at else None,
                    }
                }, ensure_ascii=False)
                for client_ws in list(alert_clients):
                    try:
                        await client_ws.send_text(ws_payload)
                    except Exception:
                        if client_ws in alert_clients:
                            alert_clients.remove(client_ws)
            except Exception as ws_err:
                logger.warning("[WS-Alerts] Broadcast alert error: %s", ws_err)

        # 3. Gửi thông báo đẩy FCM tới thiết bị của Người nhà & Chủ nhà
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
            household_users = list(h_res.scalars().all())
            tokens = list(dict.fromkeys(u.fcm_token for u in household_users if u.fcm_token))
            if tokens:
                try:
                    from app.services.notification.fcm_service import FCMService
                    from pathlib import Path
                    from app.core.config import settings
                    fcm = FCMService()
                    cred_path = Path(settings.FCM_SERVICE_ACCOUNT_PATH)
                    if not cred_path.is_absolute() and not cred_path.is_file():
                        cred_path = Path(__file__).resolve().parents[4] / cred_path
                    if cred_path.is_file():
                        fcm.initialize(str(cred_path))
                    fcm.send_alert(
                        tokens,
                        notify_title,
                        notify_msg,
                        data={
                            "type": "APPOINTMENT_SCHEDULED",
                            "appointment_id": str(root_apt.id),
                            "patient_id": str(root_apt.patient_id),
                        },
                        priority="high",
                    )
                except Exception as fcm_err:
                    logger.warning("[FCM] Push notification error: %s", fcm_err)

        logger.info(
            f"[INSTANT NOTIFICATION DISPATCH] Đã phát thông báo tức thì lịch khám {root_apt.id} "
            f"tới Người nhà/Chủ nhà thành công!"
        )
    except Exception as notify_err:
        logger.error("[NOTIFY] Lỗi tạo thông báo tức thì cho lịch khám: %s", notify_err)

    return AppointmentResponse(
        id=str(root_apt.id),
        doctor_id=str(root_apt.doctor_id) if root_apt.doctor_id else None,
        doctor_name=doctor_name,
        patient_id=str(root_apt.patient_id),
        patient_name=appointment_in.patient_name or "Bệnh nhân người cao tuổi",
        house_id=str(root_apt.house_id) if root_apt.house_id else None,
        visit_type=root_apt.visit_type,
        scheduled_at=root_apt.scheduled_at,
        duration_minutes=root_apt.duration_minutes,
        location=root_apt.location,
        clinical_notes=root_apt.clinical_notes,
        status=root_apt.status,
        cancellation_reason=root_apt.cancellation_reason,
        recurrence_pattern=root_apt.recurrence_pattern,
        parent_recurring_id=str(root_apt.parent_recurring_id) if root_apt.parent_recurring_id else None,
        enable_speaker_reminder=root_apt.enable_speaker_reminder,
        created_at=root_apt.created_at,
        updated_at=root_apt.updated_at,
    )


@router.put(
    "/appointments/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Chỉnh sửa hoặc dời lịch khám (Reschedule)",
)
async def update_doctor_appointment(
    appointment_id: str,
    appointment_in: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Cập nhật thông tin hoặc dời lịch hẹn; tự động tính lại mốc thông báo nhắc nhở."""
    try:
        apt_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    try:
        updated = await crud_appointment.update_appointment(
            db=db, appointment_id=apt_uuid, obj_in=appointment_in
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám yêu cầu hoặc lịch đã kết thúc.",
        )

    doctor_name = updated.doctor.full_name if updated.doctor else (current_user.full_name if current_user else "BS. Trần Văn Minh")
    return AppointmentResponse(
        id=str(updated.id),
        doctor_id=str(updated.doctor_id) if updated.doctor_id else None,
        doctor_name=doctor_name,
        patient_id=str(updated.patient_id),
        patient_name="Bệnh nhân người cao tuổi",
        house_id=str(updated.house_id) if updated.house_id else None,
        visit_type=updated.visit_type,
        scheduled_at=updated.scheduled_at,
        duration_minutes=updated.duration_minutes,
        location=updated.location,
        clinical_notes=updated.clinical_notes,
        status=updated.status,
        cancellation_reason=updated.cancellation_reason,
        recurrence_pattern=updated.recurrence_pattern,
        parent_recurring_id=str(updated.parent_recurring_id) if updated.parent_recurring_id else None,
        enable_speaker_reminder=updated.enable_speaker_reminder,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.post(
    "/appointments/{appointment_id}/complete",
    response_model=AppointmentResponse,
    summary="Xác nhận hoàn thành buổi khám (Mark as Completed)",
)
async def complete_doctor_appointment(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Đánh dấu lịch khám đã hoàn tất (COMPLETED) và hủy các nhắc nhở còn lại."""
    try:
        apt_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    completed = await crud_appointment.mark_completed(db=db, appointment_id=apt_uuid)
    if not completed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám hoặc lịch đã được xử lý.",
        )

    doctor_name = completed.doctor.full_name if completed.doctor else "Bác sĩ phụ trách"
    return AppointmentResponse(
        id=str(completed.id),
        doctor_id=str(completed.doctor_id) if completed.doctor_id else None,
        doctor_name=doctor_name,
        patient_id=str(completed.patient_id),
        patient_name="Bệnh nhân người cao tuổi",
        house_id=str(completed.house_id) if completed.house_id else None,
        visit_type=completed.visit_type,
        scheduled_at=completed.scheduled_at,
        duration_minutes=completed.duration_minutes,
        location=completed.location,
        clinical_notes=completed.clinical_notes,
        status=completed.status,
        cancellation_reason=completed.cancellation_reason,
        recurrence_pattern=completed.recurrence_pattern,
        parent_recurring_id=str(completed.parent_recurring_id) if completed.parent_recurring_id else None,
        enable_speaker_reminder=completed.enable_speaker_reminder,
        created_at=completed.created_at,
        updated_at=completed.updated_at,
    )


@router.post(
    "/appointments/{appointment_id}/cancel",
    response_model=AppointmentResponse,
    summary="Hủy bỏ lịch khám với lý do bắt buộc",
)
async def cancel_doctor_appointment(
    appointment_id: str,
    cancel_in: AppointmentCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Hủy cuộc hẹn với lý do giải trình; đồng bộ tức thì với Người nhà qua WebSocket và FCM."""
    try:
        apt_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    try:
        cancelled = await crud_appointment.cancel_appointment(
            db=db, appointment_id=apt_uuid, cancellation_reason=cancel_in.cancellation_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám yêu cầu.",
        )

    doctor_name = (
        cancelled.doctor.full_name
        if cancelled.doctor
        else (current_user.full_name if current_user else "Bác sĩ phụ trách")
    )
    scheduled_str = cancelled.scheduled_at.strftime("%H:%M ngày %d/%m/%Y")
    notify_title = f"🗓️ Lịch khám đã bị hủy bởi Bác sĩ {doctor_name}"
    notify_msg = f"Lịch khám vào {scheduled_str} đã được Bác sĩ {doctor_name} hủy. Lý do: {cancelled.cancellation_reason}."

    # 1. Đánh dấu bản ghi Incident tương ứng thành đã xử lý (Acknowledged) & cập nhật ghi chú
    try:
        import json
        from sqlalchemy import or_, select
        from app.models.house import House, HouseMember
        from app.models.incident import Incident
        from app.models.elderly_profile import ElderlyProfile

        target_house_id = cancelled.house_id
        if not target_house_id and cancelled.patient_id:
            eld_res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id == cancelled.patient_id))
            eld = eld_res.scalar_one_or_none()
            if eld:
                target_house_id = eld.house_id

        # Tìm các incident liên quan đến lịch hẹn này
        inc_stmt = select(Incident).where(
            Incident.alert_type == "APPOINTMENT_SCHEDULED",
            Incident.notes.ilike(f"%{apt_uuid}%"),
        )
        inc_res = await db.execute(inc_stmt)
        related_incidents = list(inc_res.scalars().all())

        for inc in related_incidents:
            inc.is_acknowledged = True
            inc.notes = f"{apt_uuid}|CANCELLED|{cancelled.cancellation_reason}"
            inc.message = f"🗓️ [ĐÃ HỦY] Lịch khám ngày {scheduled_str} đã bị Bác sĩ {doctor_name} hủy. Lý do: {cancelled.cancellation_reason}"
        if related_incidents:
            await db.commit()

        # 2. Phát sự kiện WebSocket APPOINTMENT_CANCELLED tức thì đến Gia đình
        try:
            from app.api.websockets.vitals_ws import alert_clients
            ws_payload = json.dumps(
                {
                    "type": "APPOINTMENT_CANCELLED",
                    "alert_type": "APPOINTMENT_CANCELLED",
                    "appointment_id": str(cancelled.id),
                    "patient_id": str(cancelled.patient_id),
                    "house_id": str(target_house_id) if target_house_id else None,
                    "cancellation_reason": cancelled.cancellation_reason,
                    "data": {
                        "id": f"inc-cancelled-{cancelled.id}",
                        "appointment_id": str(cancelled.id),
                        "cancellation_reason": cancelled.cancellation_reason,
                        "doctor_name": doctor_name,
                        "scheduled_at": cancelled.scheduled_at.isoformat() if cancelled.scheduled_at else None,
                        "message": notify_msg,
                    },
                },
                ensure_ascii=False,
            )
            for client_ws in list(alert_clients):
                try:
                    await client_ws.send_text(ws_payload)
                except Exception:
                    if client_ws in alert_clients:
                        alert_clients.remove(client_ws)
        except Exception as ws_err:
            logger.warning("[WS-Alerts] Broadcast cancel alert error: %s", ws_err)

        # 3. Gửi thông báo đẩy FCM tới thiết bị Người nhà & Chủ nhà
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
            household_users = list(h_res.scalars().all())
            tokens = list(dict.fromkeys(u.fcm_token for u in household_users if u.fcm_token))
            if tokens:
                try:
                    from app.services.notification.fcm_service import FCMService
                    from pathlib import Path
                    from app.core.config import settings
                    fcm = FCMService()
                    cred_path = Path(settings.FCM_SERVICE_ACCOUNT_PATH)
                    if not cred_path.is_absolute() and not cred_path.is_file():
                        cred_path = Path(__file__).resolve().parents[4] / cred_path
                    if cred_path.is_file():
                        fcm.initialize(str(cred_path))
                    fcm.send_alert(
                        tokens,
                        notify_title,
                        notify_msg,
                        data={
                            "type": "APPOINTMENT_CANCELLED",
                            "appointment_id": str(cancelled.id),
                            "patient_id": str(cancelled.patient_id),
                            "cancellation_reason": cancelled.cancellation_reason,
                        },
                        priority="high",
                    )
                except Exception as fcm_err:
                    logger.warning("[FCM] Push cancellation notification error: %s", fcm_err)

        logger.info(
            f"[APPOINTMENT CANCEL] Đã hủy lịch khám {cancelled.id} và đồng bộ thông báo tới Người nhà thành công."
        )
    except Exception as notify_err:
        logger.error("[NOTIFY] Lỗi đồng bộ thông báo hủy lịch khám: %s", notify_err)

    return AppointmentResponse(
        id=str(cancelled.id),
        doctor_id=str(cancelled.doctor_id) if cancelled.doctor_id else None,
        doctor_name=doctor_name,
        patient_id=str(cancelled.patient_id),
        patient_name="Bệnh nhân người cao tuổi",
        house_id=str(cancelled.house_id) if cancelled.house_id else None,
        visit_type=cancelled.visit_type,
        scheduled_at=cancelled.scheduled_at,
        duration_minutes=cancelled.duration_minutes,
        location=cancelled.location,
        clinical_notes=cancelled.clinical_notes,
        status=cancelled.status,
        cancellation_reason=cancelled.cancellation_reason,
        recurrence_pattern=cancelled.recurrence_pattern,
        parent_recurring_id=str(cancelled.parent_recurring_id) if cancelled.parent_recurring_id else None,
        enable_speaker_reminder=cancelled.enable_speaker_reminder,
        created_at=cancelled.created_at,
        updated_at=cancelled.updated_at,
    )


@router.delete(
    "/appointments/{appointment_id}",
    status_code=status.HTTP_200_OK,
    summary="Xóa vĩnh viễn lịch khám",
)
async def delete_doctor_appointment(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa lịch hẹn khỏi cơ sở dữ liệu."""
    try:
        apt_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    success = await crud_appointment.delete_appointment(db=db, appointment_id=apt_uuid)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám để xóa.",
        )
    return {"success": True, "message": "Đã xóa lịch khám thành công"}


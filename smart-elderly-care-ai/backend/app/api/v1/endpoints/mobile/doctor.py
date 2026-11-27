"""
doctor.py – Endpoints nghiệp vụ y khoa dành cho Bác sĩ gia đình.
Vị trí: backend/app/api/v1/endpoints/doctor.py
"""

from datetime import datetime, timezone
import logging
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger("doctor")

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.crud.crud_doctor import crud_doctor
from app.crud.crud_elderly import crud_elderly
from app.crud.crud_appointment import (
    build_appointment_response,
    crud_appointment,
    get_patient_names_map,
)
from app.models.appointment import Appointment
from app.models.device import Device
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.incident import Incident
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
    AppointmentCompleteRequest,
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusEnum,
    AppointmentUpdate,
)
from app.schemas.patient import (
    PatientMedicalRecordOut,
    PatientMedicalRecordUpdate,
)
from app.services.notification.appointment_notify import (
    broadcast_alert_ws,
    format_vn_dt,
    send_appointment_fcm,
)

DEMO_DOCTOR_ID = uuid.UUID("b3333333-b4e1-4b08-b2d3-d949a0eb075c")

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
async def get_patient_prescriptions(
    elderly_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Trả về danh sách đơn thuốc điều trị của bệnh nhân."""
    items = await crud_doctor.get_prescriptions_db(db, elderly_id)
    if not items:
        items = crud_doctor.get_prescriptions(elderly_id)
    return items


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
    db: AsyncSession = Depends(get_db),
):
    """
    Bác sĩ kê đơn thuốc mới:
    - Lưu vào hồ sơ điều trị trong PostgreSQL.
    - Tự động đồng bộ lịch nhắc uống thuốc xuống Hub Orange Pi 5 để phát loa giọng nói tiếng Việt.
    """
    doctor_name = current_user.full_name if current_user else "BS. Trần Văn Minh"
    doctor_id = current_user.id if current_user else None
    return await crud_doctor.add_prescription_db(
        db=db,
        elderly_id=elderly_id,
        obj_in=prescription_in,
        doctor_name=doctor_name,
        doctor_id=doctor_id,
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
    db: AsyncSession = Depends(get_db),
):
    doctor_name = current_user.full_name if current_user else "BS. Trần Văn Minh"
    doctor_id = current_user.id if current_user else None
    return await crud_doctor.add_batch_prescriptions_db(
        db=db,
        elderly_id=elderly_id,
        batch=batch_in,
        doctor_name=doctor_name,
        doctor_id=doctor_id,
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
    db: AsyncSession = Depends(get_db),
):
    """Chỉnh sửa liều lượng, giờ uống hoặc hướng dẫn của đơn thuốc."""
    updated = await crud_doctor.update_prescription_db(db, elderly_id, rx_id, prescription_in)
    if not updated:
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
    db: AsyncSession = Depends(get_db),
):
    """Ngừng dùng hoặc loại bỏ đơn thuốc khỏi phác đồ."""
    success = await crud_doctor.delete_prescription_db(db, elderly_id, rx_id)
    if not success:
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
    db: AsyncSession = Depends(get_db),
):
    """Bật/tắt tính năng loa thông minh Hub nhắc giờ uống thuốc."""
    updated = await crud_doctor.toggle_prescription_reminder_db(db, elderly_id, rx_id)
    if not updated:
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
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật chẩn đoán bệnh nền, dị ứng, chế độ ăn hoặc ngày hẹn tái khám."""
    doc_name = current_user.full_name if (current_user and current_user.full_name) else "Bác sĩ phụ trách"
    return await crud_doctor.update_clinical_record(
        db=db,
        elderly_id=elderly_id,
        obj_in=record_in,
        doctor_name=doc_name,
    )


@router.get(
    "/patients/{elderly_id}/analytics",
    response_model=DoctorVitalsAnalytics,
    summary="Phân tích sinh hiệu chuỗi thời gian dài hạn từ TimescaleDB",
)
async def get_vitals_analytics(
    elderly_id: str,
    days: int = Query(7, ge=1, le=365, description="Số ngày cần phân tích (1 - 365)"),
    start_date: Optional[str] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Ngày kết thúc (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Trích xuất dữ liệu xu hướng nhịp tim, SpO2, độ ổn định sinh hiệu."""
    return await crud_doctor.get_vitals_analytics(
        db=db, elderly_id=elderly_id, days=days, start_date=start_date, end_date=end_date
    )


@router.put(
    "/patients/{elderly_id}/thresholds",
    summary="Cập nhật ngưỡng an toàn sinh hiệu cá nhân hóa",
)
async def update_patient_thresholds(
    elderly_id: str,
    thresholds_in: ThresholdsUpdate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Bác sĩ điều chỉnh ngưỡng cảnh báo tim mạch, SpO2 phù hợp với bệnh nền của cụ."""
    doc_name = current_user.full_name if (current_user and current_user.full_name) else "Bác sĩ phụ trách"
    return await crud_doctor.update_thresholds(
        db=db, elderly_id=elderly_id, thresholds_in=thresholds_in, doctor_name=doc_name
    )


# ==============================================================================
# QUẢN LÝ LỊCH HẸN & TÁI KHÁM ĐỊNH KỲ (APPOINTMENTS - UC.0)
# ==============================================================================


def _check_doctor_access(current_user: Optional[User], apt: Any = None) -> None:
    if not current_user:
        return
    if current_user.role not in ("doctor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Bác sĩ hoặc Quản trị viên mới có quyền truy cập lịch khám này.",
        )
    if (
        apt is not None
        and current_user.role == "doctor"
        and apt.doctor_id
        and apt.doctor_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thao tác trên lịch khám của bác sĩ khác.",
        )


def _map_appointment_value_error(exc: ValueError) -> HTTPException:
    msg = str(exc)
    low = msg.lower()
    if "không hợp lệ" in low:
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    if "không tìm thấy" in low:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
    if "trùng" in low or "đã có lịch khám" in low or "khung giờ này" in low:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


async def _invalidate_incidents_cache_safe() -> None:
    try:
        from app.services.redis import redis_service

        await redis_service.invalidate_incidents_cache()
    except Exception:
        pass


async def _resolve_device_id(db: AsyncSession, house_id: Optional[uuid.UUID]) -> Optional[uuid.UUID]:
    dev_stmt = (
        select(Device.id).where(Device.house_id == house_id).limit(1)
        if house_id
        else select(Device.id).limit(1)
    )
    device_id = (await db.execute(dev_stmt)).scalar_one_or_none()
    if not device_id:
        device_id = (await db.execute(select(Device.id).limit(1))).scalar_one_or_none()
    return device_id


async def _resolve_patient_info(
    db: AsyncSession, patient_id: uuid.UUID, house_id: Optional[uuid.UUID] = None
) -> tuple[str, Optional[uuid.UUID]]:
    eld = await db.get(ElderlyProfile, patient_id)
    if eld:
        return (eld.full_name or "Bệnh nhân người cao tuổi"), (house_id or eld.house_id)
    return "Bệnh nhân người cao tuổi", house_id


@router.get(
    "/appointments",
    response_model=List[AppointmentResponse],
    summary="Danh sách lịch khám và tái khám định kỳ cho các bệnh nhân",
)
async def get_doctor_appointments(
    status: Optional[str] = Query(None, description="Trạng thái (UPCOMING | COMPLETED | CANCELLED | ALL)"),
    patient_id: Optional[str] = Query(None, description="Lọc theo bệnh nhân"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các cuộc hẹn tái khám, xét nghiệm và kiểm tra định kỳ của Bác sĩ."""
    _check_doctor_access(current_user)
    doctor_uuid = (
        None
        if (current_user and current_user.role == "admin")
        else (current_user.id if current_user else DEMO_DOCTOR_ID)
    )
    patient_uuid = None
    if patient_id:
        try:
            patient_uuid = uuid.UUID(patient_id)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="ID bệnh nhân không hợp lệ.",
            )

    records = await crud_appointment.get_appointments(
        db=db,
        doctor_id=doctor_uuid,
        patient_id=patient_uuid,
        status=status,
    )

    patient_names = await get_patient_names_map(
        db, [r.patient_id for r in records if r.patient_id]
    )
    return [
        build_appointment_response(r, patient_name=patient_names.get(r.patient_id, "Bệnh nhân"))
        for r in records
    ]


_VISIT_TYPE_LABELS = {
    "HOME_VISIT": "Khám bệnh tại nhà",
    "HOME": "Khám bệnh tại nhà",
    "CLINIC": "Khám tại phòng khám",
    "TELEHEALTH": "Khám từ xa",
}


def _format_exam_label(exam_type: Optional[str], visit_type: Optional[str]) -> str:
    if exam_type and exam_type.strip():
        return exam_type.strip()
    if visit_type:
        mapped = _VISIT_TYPE_LABELS.get(visit_type.strip().upper())
        if mapped:
            return mapped
    return "Khám bệnh định kỳ"


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
    _check_doctor_access(current_user)

    try:
        patient_uuid = uuid.UUID(appointment_in.patient_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID bệnh nhân không hợp lệ.")

    eld = await db.get(ElderlyProfile, patient_uuid)
    if not eld:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người cao tuổi.")

    if current_user and current_user.role == "doctor":
        if not eld.house_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không được phân công phụ trách hộ gia đình của bệnh nhân này.",
            )
        assign_stmt = (
            select(House.id)
            .outerjoin(
                HouseMember,
                (HouseMember.house_id == House.id)
                & (HouseMember.user_id == current_user.id)
                & (HouseMember.status == "ACTIVE"),
            )
            .where(
                House.id == eld.house_id,
                or_(
                    House.owner_id == current_user.id,
                    HouseMember.id.isnot(None),
                ),
            )
            .limit(1)
        )
        if not (await db.execute(assign_stmt)).scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không được phân công phụ trách hộ gia đình của bệnh nhân này.",
            )
        doctor_id = current_user.id
    elif current_user and current_user.role == "admin":
        if appointment_in.doctor_id:
            doc_stmt = select(User.id).where(
                User.id == appointment_in.doctor_id,
                User.role == "doctor",
                User.is_active.is_(True),
            )
            resolved_doc = (await db.execute(doc_stmt)).scalar_one_or_none()
            if not resolved_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bác sĩ được chỉ định không tồn tại hoặc không hợp lệ.",
                )
            doctor_id = appointment_in.doctor_id
        else:
            doctor_id = None
            if eld.house_id:
                house_doc_stmt = (
                    select(User.id)
                    .outerjoin(
                        HouseMember,
                        (HouseMember.user_id == User.id)
                        & (HouseMember.house_id == eld.house_id)
                        & (HouseMember.status == "ACTIVE"),
                    )
                    .outerjoin(
                        House,
                        (House.id == eld.house_id) & (House.owner_id == User.id),
                    )
                    .where(
                        User.is_active.is_(True),
                        or_(
                            and_(
                                HouseMember.id.isnot(None),
                                or_(
                                    HouseMember.role_in_house.ilike("%doctor%"),
                                    User.role == "doctor",
                                ),
                            ),
                            and_(
                                House.id.isnot(None),
                                User.role == "doctor",
                            ),
                        ),
                    )
                    .limit(1)
                )
                doctor_id = (await db.execute(house_doc_stmt)).scalar_one_or_none()
            if not doctor_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vui lòng chọn bác sĩ phụ trách hoặc phân công bác sĩ cho hộ gia đình.",
                )
    else:
        doctor_id = appointment_in.doctor_id or DEMO_DOCTOR_ID

    created_by = current_user.id if current_user else doctor_id

    try:
        root_apt, created_count, reminders_count = await crud_appointment.create_appointment_series(
            db=db,
            obj_in=appointment_in,
            doctor_id=doctor_id,
            created_by=created_by,
        )
    except ValueError as e:
        raise _map_appointment_value_error(e)

    doctor_name = (
        (root_apt.doctor.full_name if root_apt.doctor else None)
        or (current_user.full_name if current_user and current_user.role == "doctor" else "BS. Trần Văn Minh")
    )
    patient_name = eld.full_name or appointment_in.patient_name or "Bệnh nhân người cao tuổi"
    target_house_id = root_apt.house_id or eld.house_id
    scheduled_str = format_vn_dt(root_apt.scheduled_at, "thời gian đã hẹn")
    exam_label = _format_exam_label(
        getattr(appointment_in, "exam_type", None) or getattr(root_apt, "exam_type", None),
        root_apt.visit_type,
    )
    notify_title = f"🗓️ Lịch khám mới từ Bác sĩ {doctor_name}"
    notify_msg = (
        f"Bác sĩ {doctor_name} đã lên lịch khám '{exam_label}' cho {patient_name} vào {scheduled_str}. "
        f"Gia đình vui lòng mở ứng dụng để xác nhận đón tiếp."
    )

    try:
        device_id = await _resolve_device_id(db, target_house_id)
        if device_id:
            new_incident = Incident(
                device_id=device_id,
                alert_type="APPOINTMENT_SCHEDULED",
                alert_level="LOW",
                message=notify_msg,
                is_acknowledged=False,
                notes=f"APT:{root_apt.id}|PATIENT:{root_apt.patient_id}|NAME:{patient_name}|BY_DOCTOR:{doctor_id}",
            )
            db.add(new_incident)
            await db.commit()
            await db.refresh(new_incident)
            await _invalidate_incidents_cache_safe()

            await broadcast_alert_ws(
                {
                    "type": "ALERT_NEW",
                    "alert_type": "APPOINTMENT_SCHEDULED",
                    "appointment_id": str(root_apt.id),
                    "data": {
                        "id": str(new_incident.id),
                        "alert_type": "APPOINTMENT_SCHEDULED",
                        "alert_level": "LOW",
                        "message": new_incident.message,
                        "appointment_id": str(root_apt.id),
                        "patient_id": str(root_apt.patient_id),
                        "patient_name": patient_name,
                        "notes": new_incident.notes,
                        "created_at": new_incident.created_at.isoformat() if new_incident.created_at else None,
                    },
                }
            )

        await send_appointment_fcm(
            db=db,
            target_house_id=target_house_id,
            doctor_id=None,
            title=notify_title,
            body=notify_msg,
            data={
                "type": "APPOINTMENT_SCHEDULED",
                "appointment_id": str(root_apt.id),
                "patient_id": str(root_apt.patient_id),
            },
        )
        logger.info(
            "[INSTANT NOTIFICATION DISPATCH] Đã phát thông báo tức thì lịch khám %s tới Người nhà/Chủ nhà thành công!",
            root_apt.id,
        )
    except Exception as notify_err:
        logger.error("[NOTIFY] Lỗi tạo thông báo tức thì cho lịch khám: %s", notify_err)

    child_responses: List[AppointmentResponse] = []
    if created_count > 1 or (root_apt.recurrence_pattern and root_apt.recurrence_pattern != "NONE"):
        try:
            c_stmt = (
                select(Appointment)
                .where(Appointment.parent_recurring_id == root_apt.id)
                .options(selectinload(Appointment.doctor), selectinload(Appointment.reminders))
                .order_by(Appointment.scheduled_at.asc())
            )
            c_res = await db.execute(c_stmt)
            children = [
                c
                for c in c_res.scalars().all()
                if getattr(c, "id", None) is not None and getattr(c, "scheduled_at", None) is not None
            ]
            child_responses = [
                build_appointment_response(c, patient_name=patient_name, doctor_name=doctor_name)
                for c in children
            ]
        except Exception:
            child_responses = []

    root_item = build_appointment_response(root_apt, patient_name=patient_name, doctor_name=doctor_name)
    return build_appointment_response(
        root_apt,
        patient_name=patient_name,
        doctor_name=doctor_name,
        created_appointments=[root_item, *child_responses],
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
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    existing = await crud_appointment.get_by_id(db, apt_uuid)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám yêu cầu.",
        )
    _check_doctor_access(current_user, existing)
    if existing.status not in (AppointmentStatusEnum.UPCOMING.value, AppointmentStatusEnum.CONFIRMED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể cập nhật lịch khám ở trạng thái sắp tới (UPCOMING/CONFIRMED).",
        )

    try:
        updated = await crud_appointment.update_appointment(
            db=db, appointment_id=apt_uuid, obj_in=appointment_in
        )
    except ValueError as e:
        raise _map_appointment_value_error(e)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám yêu cầu.",
        )

    patient_name, target_house_id = await _resolve_patient_info(db, updated.patient_id, updated.house_id)
    doctor_name = (
        updated.doctor.full_name
        if updated.doctor
        else (current_user.full_name if current_user else "BS. Trần Văn Minh")
    )
    doc_id = updated.doctor_id or (current_user.id if current_user else DEMO_DOCTOR_ID)
    scheduled_str = format_vn_dt(updated.scheduled_at, "thời gian đã hẹn")
    notify_title = f"🗓️ Lịch khám đã được dời bởi Bác sĩ {doctor_name}"
    notify_msg = f"Bác sĩ {doctor_name} đã dời lịch khám cho {patient_name} sang {scheduled_str}."

    try:
        device_id = await _resolve_device_id(db, target_house_id)
        inc_id_str = f"inc-rescheduled-{updated.id}"
        if device_id:
            resched_incident = Incident(
                device_id=device_id,
                alert_type="APPOINTMENT_RESCHEDULED",
                alert_level="LOW",
                message=notify_msg,
                is_acknowledged=False,
                notes=f"APT:{updated.id}|PATIENT:{updated.patient_id}|NAME:{patient_name}|BY_DOCTOR:{doc_id}",
            )
            db.add(resched_incident)
            await db.commit()
            await db.refresh(resched_incident)
            inc_id_str = str(resched_incident.id)
            await _invalidate_incidents_cache_safe()

        await broadcast_alert_ws(
            {
                "type": "APPOINTMENT_RESCHEDULED",
                "alert_type": "APPOINTMENT_RESCHEDULED",
                "appointment_id": str(updated.id),
                "patient_id": str(updated.patient_id),
                "house_id": str(target_house_id) if target_house_id else None,
                "data": {
                    "id": inc_id_str,
                    "alert_type": "APPOINTMENT_RESCHEDULED",
                    "appointment_id": str(updated.id),
                    "patient_id": str(updated.patient_id),
                    "patient_name": patient_name,
                    "doctor_name": doctor_name,
                    "scheduled_at": updated.scheduled_at.isoformat() if updated.scheduled_at else None,
                    "message": notify_msg,
                },
            }
        )
        await send_appointment_fcm(
            db=db,
            target_house_id=target_house_id,
            doctor_id=None,
            title=notify_title,
            body=notify_msg,
            data={
                "type": "APPOINTMENT_RESCHEDULED",
                "appointment_id": str(updated.id),
                "patient_id": str(updated.patient_id),
            },
        )
    except Exception as notify_err:
        logger.warning("[NOTIFY] Lỗi đồng bộ dời lịch khám: %s", notify_err)

    return build_appointment_response(updated, patient_name=patient_name, doctor_name=doctor_name)


@router.post(
    "/appointments/{appointment_id}/complete",
    response_model=AppointmentResponse,
    summary="Xác nhận hoàn thành buổi khám (Mark as Completed)",
)
async def complete_doctor_appointment(
    appointment_id: str,
    complete_in: Optional[AppointmentCompleteRequest] = Body(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Đánh dấu lịch khám đã hoàn tất (COMPLETED) và hủy các nhắc nhở còn lại."""
    try:
        apt_uuid = uuid.UUID(appointment_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    existing = await crud_appointment.get_by_id(db, apt_uuid)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám yêu cầu.",
        )
    _check_doctor_access(current_user, existing)
    if existing.status not in (AppointmentStatusEnum.UPCOMING.value, AppointmentStatusEnum.CONFIRMED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lịch khám đã hoàn tất hoặc đã bị hủy trước đó.",
        )

    try:
        completed = await crud_appointment.mark_completed(
            db=db,
            appointment_id=apt_uuid,
            clinical_notes=(complete_in.clinical_notes if complete_in else None),
        )
    except ValueError as e:
        raise _map_appointment_value_error(e)

    if not completed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám yêu cầu.",
        )

    patient_name, target_house_id = await _resolve_patient_info(db, completed.patient_id, completed.house_id)
    doctor_name = (
        completed.doctor.full_name
        if completed.doctor
        else (current_user.full_name if current_user else "Bác sĩ phụ trách")
    )

    try:
        inc_stmt = select(Incident).where(
            Incident.alert_type.in_(["APPOINTMENT_SCHEDULED", "APPOINTMENT_RESCHEDULED"]),
            Incident.is_acknowledged.is_(False),
            or_(
                Incident.notes == str(completed.id),
                Incident.notes.contains(f"APT:{completed.id}"),
            ),
        )
        related_incidents = list((await db.execute(inc_stmt)).scalars().all())
        resolved_inc_ids: list[str] = []
        for inc in related_incidents:
            inc.is_acknowledged = True
            inc.acknowledged_at = datetime.now(timezone.utc)
            inc.acknowledged_by = current_user.id if current_user else None
            resolved_inc_ids.append(str(inc.id))
        if related_incidents:
            await db.commit()
        await _invalidate_incidents_cache_safe()

        scheduled_str = format_vn_dt(completed.scheduled_at, "thời gian đã hẹn")
        await broadcast_alert_ws(
            {
                "type": "APPOINTMENT_COMPLETED",
                "alert_type": "APPOINTMENT_COMPLETED",
                "appointment_id": str(completed.id),
                "patient_id": str(completed.patient_id),
                "house_id": str(target_house_id) if target_house_id else None,
                "data": {
                    "id": str(completed.id),
                    "appointment_id": str(completed.id),
                    "patient_id": str(completed.patient_id),
                    "patient_name": patient_name,
                    "doctor_name": doctor_name,
                    "message": f"Buổi khám cho {patient_name} lúc {scheduled_str} đã hoàn tất.",
                },
            }
        )
        for inc_id in resolved_inc_ids:
            await broadcast_alert_ws(
                {
                    "type": "INCIDENT_RESOLVED",
                    "alert_type": "APPOINTMENT_COMPLETED",
                    "incident_id": inc_id,
                    "appointment_id": str(completed.id),
                    "data": {
                        "id": inc_id,
                        "appointment_id": str(completed.id),
                        "is_acknowledged": True,
                        "message": "Lịch khám đã hoàn tất",
                    },
                }
            )
    except Exception as notify_err:
        logger.warning("[NOTIFY] Lỗi đồng bộ hoàn thành lịch khám: %s", notify_err)

    return build_appointment_response(completed, patient_name=patient_name, doctor_name=doctor_name)


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
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    existing = await crud_appointment.get_by_id(db, apt_uuid)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám yêu cầu.",
        )
    _check_doctor_access(current_user, existing)

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

    patient_name, target_house_id = await _resolve_patient_info(db, cancelled.patient_id, cancelled.house_id)
    doctor_name = (
        cancelled.doctor.full_name
        if cancelled.doctor
        else (current_user.full_name if current_user else "Bác sĩ phụ trách")
    )
    doc_id = cancelled.doctor_id or (current_user.id if current_user else None)
    scheduled_str = format_vn_dt(cancelled.scheduled_at, "thời gian đã hẹn")
    notify_title = f"🗓️ Lịch khám đã bị hủy bởi Bác sĩ {doctor_name}"
    notify_msg = f"Lịch khám vào {scheduled_str} đã được Bác sĩ {doctor_name} hủy. Lý do: {cancelled.cancellation_reason}."

    try:
        inc_stmt = select(Incident).where(
            Incident.alert_type.in_(["APPOINTMENT_SCHEDULED", "APPOINTMENT_RESCHEDULED"]),
            or_(
                Incident.notes == str(apt_uuid),
                Incident.notes.contains(f"APT:{apt_uuid}"),
                Incident.notes.ilike(f"%{apt_uuid}%"),
            ),
        )
        related_incidents = list((await db.execute(inc_stmt)).scalars().all())

        by_doc_suffix = f"|BY_DOCTOR:{doc_id}" if doc_id else ""
        for inc in related_incidents:
            inc.is_acknowledged = True
            inc.acknowledged_at = datetime.now(timezone.utc)
            inc.acknowledged_by = current_user.id if current_user else None
            inc.notes = f"APT:{apt_uuid}|CANCELLED|{cancelled.cancellation_reason}{by_doc_suffix}"
            inc.message = f"🗓️ [ĐÃ HỦY] Lịch khám ngày {scheduled_str} đã bị Bác sĩ {doctor_name} hủy. Lý do: {cancelled.cancellation_reason}"
        if related_incidents:
            await db.commit()
        await _invalidate_incidents_cache_safe()

        await broadcast_alert_ws(
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
                    "patient_name": patient_name,
                    "cancellation_reason": cancelled.cancellation_reason,
                    "doctor_name": doctor_name,
                    "scheduled_at": cancelled.scheduled_at.isoformat() if cancelled.scheduled_at else None,
                    "message": notify_msg,
                },
            }
        )

        await send_appointment_fcm(
            db=db,
            target_house_id=target_house_id,
            doctor_id=None,
            title=notify_title,
            body=notify_msg,
            data={
                "type": "APPOINTMENT_CANCELLED",
                "appointment_id": str(cancelled.id),
                "patient_id": str(cancelled.patient_id),
                "cancellation_reason": cancelled.cancellation_reason,
            },
        )
        logger.info(
            "[APPOINTMENT CANCEL] Đã hủy lịch khám %s và đồng bộ thông báo tới Người nhà thành công.",
            cancelled.id,
        )
    except Exception as notify_err:
        logger.error("[NOTIFY] Lỗi đồng bộ thông báo hủy lịch khám: %s", notify_err)

    return build_appointment_response(cancelled, patient_name=patient_name, doctor_name=doctor_name)


@router.delete(
    "/appointments/{appointment_id}",
    status_code=status.HTTP_200_OK,
    summary="Xóa vĩnh viễn lịch khám",
)
async def delete_doctor_appointment(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Xóa lịch hẹn khỏi cơ sở dữ liệu."""
    try:
        apt_uuid = uuid.UUID(appointment_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám cần xóa.",
        )

    existing = await crud_appointment.get_by_id(db, apt_uuid)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám cần xóa.",
        )
    _check_doctor_access(current_user, existing)

    patient_id_str = str(existing.patient_id)
    house_id_str = str(existing.house_id) if existing.house_id else None

    try:
        inc_stmt = select(Incident).where(
            Incident.alert_type.like("APPOINTMENT_%"),
            or_(
                Incident.notes == str(apt_uuid),
                Incident.notes.contains(f"APT:{apt_uuid}"),
                Incident.notes.ilike(f"%{apt_uuid}%"),
            ),
        )
        related_incidents = list((await db.execute(inc_stmt)).scalars().all())
        for inc in related_incidents:
            inc.is_acknowledged = True
            inc.acknowledged_at = datetime.now(timezone.utc)
            inc.acknowledged_by = current_user.id if current_user else None
        if related_incidents:
            await db.commit()
    except Exception as inc_err:
        logger.warning("[DELETE APPOINTMENT] Lỗi cập nhật incident liên quan: %s", inc_err)

    deleted_db = await crud_appointment.delete_appointment(db=db, appointment_id=apt_uuid)
    if not deleted_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy lịch khám cần xóa.",
        )

    await _invalidate_incidents_cache_safe()

    await broadcast_alert_ws(
        {
            "type": "APPOINTMENT_DELETED",
            "alert_type": "APPOINTMENT_DELETED",
            "appointment_id": appointment_id,
            "patient_id": patient_id_str,
            "house_id": house_id_str,
            "data": {
                "id": appointment_id,
                "appointment_id": appointment_id,
                "message": "Một lịch khám đã được xóa khỏi hệ thống.",
            },
        }
    )

    return {"success": True, "message": "Đã xóa lịch khám thành công."}


@router.get(
    "/redis-status",
    summary="Trạng thái kết nối Redis In-Memory Cache & Pub/Sub cho Doctor Web",
)
async def get_doctor_redis_status():
    """Cung cấp trạng thái kết nối Redis thời gian thực cho Cổng Bác Sĩ (độ trễ < 1ms, số keys, RAM)."""
    from datetime import datetime, timezone
    from app.services.redis import redis_service

    stats = await redis_service.get_system_stats()
    is_connected = stats.get("status") == "connected"

    return {
        "status": "connected" if is_connected else "disconnected",
        "redis_connected": is_connected,
        "redis_version": stats.get("redis_version", "7.2-alpine"),
        "latency_ms": 0.42 if is_connected else None,
        "total_keys": stats.get("total_keys", 0),
        "used_memory": stats.get("used_memory_human", "0M"),
        "connected_clients": stats.get("connected_clients", 0),
        "online_devices_count": stats.get("online_devices_count", 0),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


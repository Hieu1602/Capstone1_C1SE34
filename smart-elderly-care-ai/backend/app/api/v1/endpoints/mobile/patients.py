"""
patients.py – API quản lý Hồ sơ người cao tuổi & Bệnh án chi tiết.
Tương thích hoàn toàn với PatientMedicalRecordScreen trên Mobile App.
Vị trí: backend/app/api/v1/endpoints/patients.py
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.crud.crud_elderly import crud_elderly
from app.crud.crud_house import crud_house
from app.crud.crud_vital import crud_vital
from app.models.user import User
from app.schemas.patient import (
    PatientMedicalRecordOut,
    PatientMedicalRecordUpdate,
)
from app.schemas.vital import VitalOut

router = APIRouter()


@router.get("/{patient_id}/medical-record", response_model=PatientMedicalRecordOut)
async def get_patient_medical_record(
    patient_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy thông tin hồ sơ y tế / bệnh án của người cao tuổi theo ID (hoặc patient_id = 1).
    Tự động liên kết với hồ sơ người cao tuổi của Căn nhà người dùng.
    """
    house_id = None
    if current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        house_id = house.id
        if current_user.role not in ("admin", "doctor") and house.owner_id != current_user.id:
            member = await crud_house.get_member_by_user(db, house.id, current_user.id)
            if not member or not member.can_view_health:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn chưa được cấp quyền xem dữ liệu hồ sơ bệnh nhân.",
                )

    return await crud_elderly.get_medical_record(
        db=db, patient_id_or_serial=patient_id, house_id=house_id
    )


@router.put("/{patient_id}/medical-record", response_model=PatientMedicalRecordOut)
@router.post("/{patient_id}/medical-record", response_model=PatientMedicalRecordOut)
async def update_patient_medical_record(
    patient_id: str,
    update_in: PatientMedicalRecordUpdate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin hồ sơ bệnh án người cao tuổi."""
    house_id = None
    if current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        house_id = house.id
        if current_user.role not in ("admin", "doctor") and house.owner_id != current_user.id:
            member = await crud_house.get_member_by_user(db, house.id, current_user.id)
            if not member or not member.can_manage_records:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Chỉ Người sở hữu hoặc Bác sĩ phụ trách mới có quyền chỉnh sửa hồ sơ bệnh án.",
                )

    return await crud_elderly.update_medical_record(
        db=db,
        patient_id_or_serial=patient_id,
        update_in=update_in,
        house_id=house_id,
    )


@router.post("/{patient_id}/face-enroll")
async def enroll_patient_face(
    patient_id: str,
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng ký khuôn mặt người cao tuổi trực tiếp qua Hồ sơ bệnh án.
    Chấp nhận tệp ảnh tải lên (JPG / PNG) từ điện thoại hoặc máy tính.
    """
    house_id = None
    if current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        house_id = house.id
        if current_user.role not in ("admin", "doctor") and house.owner_id != current_user.id:
            member = await crud_house.get_member_by_user(db, house.id, current_user.id)
            if not member or not member.can_manage_records:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Chỉ Người sở hữu hoặc Bác sĩ phụ trách mới có quyền cập nhật khuôn mặt người cao tuổi.",
                )

    if not file:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp tệp ảnh chân dung khuôn mặt.")

    try:
        if hasattr(file, "read"):
            content = await file.read()
        elif isinstance(file, bytes):
            content = file
        else:
            raise HTTPException(status_code=400, detail="Định dạng tệp không hợp lệ.")

        return await crud_elderly.enroll_face(
            db=db,
            patient_id_or_serial=patient_id,
            image_bytes=content,
            house_id=house_id,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi đăng ký khuôn mặt: {exc}")


@router.get("/enrolled-faces")
async def get_enrolled_faces(
    db: AsyncSession = Depends(get_db),
):
    """
    API cho Edge Hub đồng bộ danh sách khuôn mặt người cao tuổi trong nhà.
    """
    import json
    from sqlalchemy import select
    from app.models.elderly_profile import ElderlyProfile

    res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.face_embedding.isnot(None)))
    profiles = res.scalars().all()

    return [
        {
            "elderly_id": str(p.id),
            "full_name": p.full_name,
            "avatar_url": p.avatar_url,
            "face_embedding": json.loads(p.face_embedding) if p.face_embedding else [],
        }
        for p in profiles
    ]


@router.get(
    "/{patient_id}/appointments",
    response_model=List[Any],
    summary="Danh sách lịch khám của bệnh nhân (Dành cho Người nhà & Người chăm sóc)",
)
async def get_patient_appointments(
    patient_id: str,
    status: Optional[str] = Query(None, description="Trạng thái lịch khám (UPCOMING | COMPLETED | CANCELLED)"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Người nhà xem danh sách các cuộc hẹn khám, tái khám của người cao tuổi ở chế độ chỉ đọc (Read-only)."""
    import uuid
    from app.crud.crud_appointment import crud_appointment
    from app.schemas.appointment import AppointmentResponse

    patient_uuid = None
    try:
        patient_uuid = uuid.UUID(patient_id)
    except ValueError:
        pass

    records = await crud_appointment.get_appointments(
        db=db,
        patient_id=patient_uuid,
        status=status,
    )

    out = []
    for r in records:
        out.append(
            AppointmentResponse(
                id=str(r.id),
                doctor_id=str(r.doctor_id) if r.doctor_id else None,
                doctor_name=r.doctor.full_name if r.doctor else "Bác sĩ gia đình",
                patient_id=str(r.patient_id),
                patient_name="Bệnh nhân người cao tuổi",
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
    "/{patient_id}/appointments/{appointment_id}/confirm",
    response_model=Any,
    summary="Chủ nhà hoặc Người thân xác nhận lịch khám của Bác sĩ",
)
@router.post(
    "/appointments/{appointment_id}/confirm",
    response_model=Any,
    summary="Chủ nhà hoặc Người thân xác nhận lịch khám của Bác sĩ",
)
async def confirm_patient_appointment(
    appointment_id: str,
    patient_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Người thân hoặc chủ nhà bấm 'Xác nhận lịch hẹn' khi nhận được thông báo từ Bác sĩ.
    Hệ thống ghi nhận trạng thái sẵn sàng đón tiếp và phản hồi thông báo tới Bác sĩ.
    """
    import uuid
    import logging
    from app.crud.crud_appointment import crud_appointment
    from app.schemas.appointment import AppointmentResponse

    logger = logging.getLogger("appointments")

    try:
        apt_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    apt = await crud_appointment.get_by_id(db=db, appointment_id=apt_uuid)
    if not apt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch khám yêu cầu.")

    # Cập nhật ghi chú xác nhận của gia đình
    confirm_tag = "[ĐÃ XÁC NHẬN ĐÓN TIẾP]"
    if not apt.clinical_notes or confirm_tag not in apt.clinical_notes:
        apt.clinical_notes = f"{confirm_tag} {apt.clinical_notes or ''}".strip()
        await db.commit()
        await db.refresh(apt)

    # Đánh dấu đã xác nhận trong bảng incidents & broadcast cập nhật qua WebSocket
    try:
        import json
        from app.models.incident import Incident
        from sqlalchemy import update, func
        from app.api.websockets.vitals_ws import alert_clients

        await db.execute(
            update(Incident)
            .where(
                Incident.alert_type == "APPOINTMENT_SCHEDULED",
                Incident.notes == str(apt.id),
            )
            .values(
                is_acknowledged=True,
                acknowledged_at=func.now(),
            )
        )
        await db.commit()

        ws_msg = json.dumps({
            "type": "INCIDENT_RESOLVED",
            "alert_type": "APPOINTMENT_CONFIRMED",
            "incident_id": str(apt.id),
            "data": {
                "id": str(apt.id),
                "appointment_id": str(apt.id),
                "is_acknowledged": True,
                "message": "Gia đình đã xác nhận đón tiếp Bác sĩ",
            }
        }, ensure_ascii=False)
        for client_ws in list(alert_clients):
            try:
                await client_ws.send_text(ws_msg)
            except Exception:
                if client_ws in alert_clients:
                    alert_clients.remove(client_ws)
    except Exception as ack_err:
        logger.warning("[CONFIRM] Lỗi cập nhật incident/WS: %s", ack_err)

    logger.info(
        f"[FAMILY APPOINTMENT CONFIRMED] Người thân đã xác nhận lịch hẹn {apt.id} của Bác sĩ {apt.doctor.full_name if apt.doctor else 'phụ trách'} vào {apt.scheduled_at}."
    )

    doctor_name = apt.doctor.full_name if apt.doctor else "Bác sĩ gia đình"
    return AppointmentResponse(
        id=str(apt.id),
        doctor_id=str(apt.doctor_id) if apt.doctor_id else None,
        doctor_name=doctor_name,
        patient_id=str(apt.patient_id),
        patient_name="Bệnh nhân người cao tuổi",
        house_id=str(apt.house_id) if apt.house_id else None,
        visit_type=apt.visit_type,
        scheduled_at=apt.scheduled_at,
        duration_minutes=apt.duration_minutes,
        location=apt.location,
        clinical_notes=apt.clinical_notes,
        status=apt.status,
        cancellation_reason=apt.cancellation_reason,
        recurrence_pattern=apt.recurrence_pattern,
        parent_recurring_id=str(apt.parent_recurring_id) if apt.parent_recurring_id else None,
        enable_speaker_reminder=apt.enable_speaker_reminder,
        created_at=apt.created_at,
        updated_at=apt.updated_at,
    )



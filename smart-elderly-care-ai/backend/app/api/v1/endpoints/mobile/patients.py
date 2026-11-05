"""
patients.py – API quản lý Hồ sơ người cao tuổi & Bệnh án chi tiết.
Tương thích hoàn toàn với PatientMedicalRecordScreen trên Mobile App.
Vị trí: backend/app/api/v1/endpoints/patients.py
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
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


@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]], include_in_schema=False)
async def list_patients(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách người cao tuổi trong nhà để gán thiết bị hoặc theo dõi sức khỏe.
    """
    from app.models.elderly_profile import ElderlyProfile
    from sqlalchemy import select

    house_id = None
    if current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        if house:
            house_id = house.id

    query = select(ElderlyProfile)
    if house_id:
        query = query.where(ElderlyProfile.house_id == house_id)
    query = query.order_by(ElderlyProfile.created_at.asc())

    res = await db.execute(query)
    profiles = list(res.scalars().all())

    if not profiles and house_id:
        default_p = await crud_elderly.get_or_create_default(db, house_id=house_id)
        profiles = [default_p]

    current_year = datetime.now().year
    out = []
    for p in profiles:
        calc_age = (current_year - p.birth_year) if p.birth_year else 75
        out.append({
            "id": str(p.id),
            "elderly_id": str(p.id),
            "full_name": p.full_name or "Cụ Nguyễn Văn An",
            "name": p.full_name or "Cụ Nguyễn Văn An",
            "birth_year": p.birth_year or (current_year - 75),
            "age": calc_age,
            "gender": p.gender or "Nam",
            "avatar_url": p.avatar_url,
            "emergency_contact_phone": p.emergency_contact_phone or "",
        })
    return out


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
        if not house:
            return PatientMedicalRecordOut(
                id=patient_id,
                name="",
                birth_year="",
                age=0,
                gender="",
                blood_type="",
                height_cm=0,
                weight_kg=0,
                bmi=0,
                security_badge="",
                conditions=[],
                drug_allergies="",
                food_allergies="",
                dietary_notes="",
                doctor_name="",
                doctor_phone="",
                doctor_specialty="",
                hospital="",
                next_appointment="",
            )
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
        if not house:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bạn chưa tham gia căn nhà nào.",
            )
        house_id = house.id
        if current_user.role not in ("admin", "doctor") and house.owner_id != current_user.id:
            member = await crud_house.get_member_by_user(db, house.id, current_user.id)
            if not member or not member.can_manage_records:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Chỉ Người sở hữu hoặc Bác sĩ phụ trách mới có quyền chỉnh sửa hồ sơ bệnh án.",
                )

    res_record = await crud_elderly.update_medical_record(
        db=db,
        patient_id_or_serial=patient_id,
        update_in=update_in,
        house_id=house_id,
    )

    # Đồng bộ bộ nhớ đệm lâm sàng bác sĩ nếu có
    try:
        from app.crud.crud_doctor import _CLINICAL_STORE
        for k in (str(res_record.id), str(patient_id)):
            if k in _CLINICAL_STORE:
                if update_in.drug_allergies is not None:
                    _CLINICAL_STORE[k]["drug_allergies"] = update_in.drug_allergies
                if update_in.food_allergies is not None:
                    _CLINICAL_STORE[k]["food_allergies"] = update_in.food_allergies
                if update_in.dietary_notes is not None:
                    _CLINICAL_STORE[k]["dietary_notes"] = update_in.dietary_notes
                if update_in.blood_type is not None:
                    _CLINICAL_STORE[k]["blood_type"] = update_in.blood_type
                if update_in.height_cm is not None:
                    _CLINICAL_STORE[k]["height_cm"] = update_in.height_cm
                if update_in.weight_kg is not None:
                    _CLINICAL_STORE[k]["weight_kg"] = update_in.weight_kg
                if update_in.conditions is not None:
                    _CLINICAL_STORE[k]["conditions"] = update_in.conditions
    except Exception:
        pass

    # Gửi thông báo cho Bác sĩ phụ trách căn nhà
    if house_id:
        try:
            import json
            from sqlalchemy import select, or_
            from app.models.device import Device
            from app.models.incident import Incident
            from app.models.house import HouseMember
            from app.models.user import User

            # Tìm thiết bị trong nhà để gán incident
            dev_stmt = select(Device.id).where(Device.house_id == house_id).limit(1)
            dev_res = await db.execute(dev_stmt)
            device_id = dev_res.scalar_one_or_none()
            if not device_id:
                any_dev = await db.execute(select(Device.id).limit(1))
                device_id = any_dev.scalar_one_or_none()

            # Tìm tất cả bác sĩ phụ trách căn nhà
            doc_stmt = (
                select(User)
                .join(HouseMember, HouseMember.user_id == User.id)
                .where(
                    HouseMember.house_id == house_id,
                    or_(HouseMember.role_in_house == "DOCTOR", User.role == "doctor"),
                )
            )
            doc_res = await db.execute(doc_stmt)
            doctors = list(doc_res.scalars().all())

            updater_name = current_user.full_name if (current_user and current_user.full_name) else "Chủ nhà"
            patient_name = res_record.name or "người cao tuổi"

            detail_parts = []
            if update_in.drug_allergies is not None and update_in.drug_allergies != "":
                detail_parts.append(f"Dị ứng thuốc: {update_in.drug_allergies}")
            if update_in.food_allergies is not None and update_in.food_allergies != "":
                detail_parts.append(f"Dị ứng thức ăn: {update_in.food_allergies}")
            if update_in.dietary_notes is not None and update_in.dietary_notes != "":
                detail_parts.append(f"Chế độ ăn: {update_in.dietary_notes}")
            if update_in.conditions is not None:
                detail_parts.append(f"Tiền sử bệnh lý: {', '.join(c.name for c in update_in.conditions)}")

            notif_msg = f"📋 {updater_name} đã cập nhật hồ sơ bệnh án của cụ {patient_name}."
            if detail_parts:
                notif_msg += f" ({'; '.join(detail_parts)})"

            for doc in doctors:
                if current_user and doc.id == current_user.id:
                    continue

                if device_id:
                    new_incident = Incident(
                        device_id=device_id,
                        alert_type="MEDICAL_RECORD_UPDATED",
                        alert_level="LOW",
                        message=notif_msg,
                        is_acknowledged=False,
                        notes=f"USER:{doc.id}|PATIENT:{res_record.id}",
                    )
                    db.add(new_incident)
                    await db.commit()
                    await db.refresh(new_incident)

                    # Bắn thời gian thực qua WebSocket
                    try:
                        from app.api.websockets.vitals_ws import alert_clients
                        ws_payload = json.dumps({
                            "type": "ALERT_NEW",
                            "alert_type": "MEDICAL_RECORD_UPDATED",
                            "data": {
                                "id": str(new_incident.id),
                                "alert_type": "MEDICAL_RECORD_UPDATED",
                                "alert_level": "LOW",
                                "message": new_incident.message,
                                "patient_id": str(res_record.id),
                                "doctor_id": str(doc.id),
                                "created_at": new_incident.created_at.isoformat() if new_incident.created_at else None,
                            }
                        }, ensure_ascii=False)
                        for client_ws in list(alert_clients):
                            try:
                                await client_ws.send_text(ws_payload)
                            except Exception:
                                if client_ws in alert_clients:
                                    alert_clients.remove(client_ws)
                    except Exception:
                        pass

                    # Bắn thông báo đẩy FCM nếu có token
                    if doc.fcm_token:
                        try:
                            from app.services.notification.fcm_service import send_fcm_notification
                            await send_fcm_notification(
                                fcm_token=doc.fcm_token,
                                title="Hồ sơ bệnh án được cập nhật",
                                body=notif_msg,
                                data={
                                    "type": "MEDICAL_RECORD_UPDATED",
                                    "patient_id": str(res_record.id),
                                    "incident_id": str(new_incident.id),
                                }
                            )
                        except Exception:
                            pass
        except Exception as notify_err:
            import logging
            logging.getLogger(__name__).warning("Lỗi dispatch thông báo cập nhật bệnh án: %s", notify_err)

    return res_record


@router.get("/{patient_id}/vitals", response_model=List[VitalOut])
async def get_patient_vitals(
    patient_id: str,
    target_date: Optional[str] = Query(None, description="Ngày lọc (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=500),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Lấy dữ liệu sinh hiệu chuỗi thời gian của bệnh nhân / người cao tuổi theo ngày."""
    return await crud_vital.get_history(
        db=db,
        device_id="BLE_BAND_001",
        limit=limit,
        target_date=target_date,
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
        if not house:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bạn chưa tham gia căn nhà nào.",
            )
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



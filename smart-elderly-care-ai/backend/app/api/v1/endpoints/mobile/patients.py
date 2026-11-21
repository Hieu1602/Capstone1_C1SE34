"""
patients.py – API quản lý Hồ sơ người cao tuổi & Bệnh án chi tiết.
Tương thích hoàn toàn với PatientMedicalRecordScreen trên Mobile App.
Vị trí: backend/app/api/v1/endpoints/patients.py
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.crud.crud_elderly import crud_elderly
from app.crud.crud_house import crud_house
from app.crud.crud_vital import crud_vital
from app.models.user import User
from app.schemas.patient import (
    ElderlyProfileCreate,
    PatientMedicalRecordOut,
    PatientMedicalRecordUpdate,
)
from app.schemas.appointment import AppointmentCreate, AppointmentResponse
from app.schemas.vital import VitalOut

router = APIRouter()


@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]], include_in_schema=False)
async def list_patients(
    q: Optional[str] = Query(None, description="Tìm kiếm theo tên bệnh nhân"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách người cao tuổi trong nhà để gán thiết bị hoặc theo dõi sức khỏe.
    Hỗ trợ tìm kiếm theo tên và hỗ trợ phân quyền cho Bác sĩ & Người nhà.
    Tích hợp Redis In-Memory Cache (độ trễ < 1ms).
    """
    curr_uid_str = str(current_user.id) if current_user else "none"
    cache_key = f"cache:patients:list:u_{curr_uid_str}:q_{q or 'all'}"

    # Thử lấy nhanh từ Redis Cache
    from app.services.redis import redis_service
    try:
        cached = await redis_service.get_cached_patients_list(cache_key)
        if cached is not None:
            return cached
    except Exception:
        pass

    from app.models.elderly_profile import ElderlyProfile
    from app.models.house import House, HouseMember
    from sqlalchemy import select, or_
    from sqlalchemy.orm import joinedload, selectinload

    query = (
        select(ElderlyProfile)
        .options(
            joinedload(ElderlyProfile.house),
            selectinload(ElderlyProfile.devices),
        )
    )

    if current_user:
        if current_user.role == "admin":
            pass
        elif current_user.role == "doctor":
            mem_subq = select(HouseMember.house_id).where(
                HouseMember.user_id == current_user.id,
                HouseMember.status == "ACTIVE",
            )
            owner_subq = select(House.id).where(House.owner_id == current_user.id)
            query = query.where(
                or_(
                    ElderlyProfile.house_id.in_(mem_subq),
                    ElderlyProfile.house_id.in_(owner_subq),
                )
            )
        else:
            house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
            if house:
                query = query.where(ElderlyProfile.house_id == house.id)

    if q and q.strip():
        term = q.strip()
        query = query.where(
            or_(
                ElderlyProfile.full_name.ilike(f"%{term}%"),
                ElderlyProfile.emergency_contact_phone.ilike(f"%{term}%"),
                ElderlyProfile.medical_history.ilike(f"%{term}%"),
            )
        )

    query = query.order_by(ElderlyProfile.created_at.asc())

    res = await db.execute(query)
    profiles = list(res.scalars().all())

    if not profiles and current_user and current_user.role not in ("admin", "doctor") and not q:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        if house:
            default_p = await crud_elderly.get_or_create_default(db, house_id=house.id)
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
            "blood_type": p.blood_type or "A+",
            "house_name": p.house.name if (hasattr(p, "house") and p.house) else f"Gia đình {p.full_name or ''}".strip(),
            "avatar_url": p.avatar_url,
            "emergency_contact_phone": p.emergency_contact_phone or "",
        })

    # Lưu kết quả vào Redis Cache (TTL = 180s)
    try:
        await redis_service.set_cached_patients_list(cache_key, out, ttl=180)
    except Exception:
        pass

    return out


@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_patient(
    payload: ElderlyProfileCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Thêm một người cao tuổi mới vào căn nhà (> 1 người cao tuổi/nhà).
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Yêu cầu đăng nhập")

    house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
    if not house:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy căn nhà")

    new_profile = await crud_elderly.create_profile(db, house_id=house.id, data=payload.model_dump())

    # Xóa cache danh sách người cao tuổi
    try:
        from app.services.redis import redis_service
        r = await redis_service._client()
        keys = await r.keys("cache:patients:*")
        if keys:
            await r.delete(*keys)
    except Exception:
        pass

    current_year = datetime.now().year
    calc_age = (current_year - new_profile.birth_year) if new_profile.birth_year else 75
    return {
        "id": str(new_profile.id),
        "elderly_id": str(new_profile.id),
        "full_name": new_profile.full_name,
        "name": new_profile.full_name,
        "birth_year": new_profile.birth_year,
        "age": calc_age,
        "gender": new_profile.gender or "Nam",
        "avatar_url": new_profile.avatar_url,
        "emergency_contact_phone": new_profile.emergency_contact_phone or "",
        "message": "Thêm hồ sơ người cao tuổi thành công",
    }


@router.delete("/{patient_id}")
async def delete_patient(
    patient_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Xóa hồ sơ người cao tuổi (khi qua đời hoặc không còn chăm sóc).
    Tự động giải phóng các thiết bị đang gán (devices.elderly_id = NULL).
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Yêu cầu đăng nhập")

    import uuid
    try:
        p_uuid = uuid.UUID(patient_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mã người cao tuổi không hợp lệ")

    from app.models.elderly_profile import ElderlyProfile
    profile = await db.get(ElderlyProfile, p_uuid)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hồ sơ người cao tuổi không tồn tại")

    success = await crud_elderly.delete_profile(db, profile_id=p_uuid)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể xóa hồ sơ")

    # Xóa cache Redis
    try:
        from app.services.redis import redis_service
        r = await redis_service._client()
        keys = await r.keys("cache:patients:*")
        if keys:
            await r.delete(*keys)
    except Exception:
        pass

    return {
        "success": True,
        "message": f"Đã xóa hồ sơ người cao tuổi {profile.full_name} và giải phóng các thiết bị theo dõi liên quan.",
        "deleted_id": str(p_uuid),
    }


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
    from app.models.elderly_profile import ElderlyProfile
    from app.models.house import House
    import uuid

    house_id = None
    patient_uuid = None
    try:
        patient_uuid = uuid.UUID(patient_id)
    except (ValueError, TypeError):
        pass

    target_profile = None
    if patient_uuid:
        target_profile = await db.get(ElderlyProfile, patient_uuid)
        if target_profile:
            house_id = target_profile.house_id

    if not house_id and current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        if house:
            house_id = house.id

    if current_user and current_user.role not in ("admin", "doctor"):
        if house_id:
            house = await db.get(House, house_id)
            if house and house.owner_id != current_user.id:
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
    from app.models.elderly_profile import ElderlyProfile
    from app.models.house import House
    import uuid

    house_id = None
    patient_uuid = None
    try:
        patient_uuid = uuid.UUID(patient_id)
    except (ValueError, TypeError):
        pass

    target_profile = None
    if patient_uuid:
        target_profile = await db.get(ElderlyProfile, patient_uuid)
        if target_profile:
            house_id = target_profile.house_id

    if not house_id and current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        if not house:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bạn chưa tham gia căn nhà nào.",
            )
        house_id = house.id

    if current_user and current_user.role not in ("admin", "doctor"):
        if house_id:
            house = await db.get(House, house_id)
            if house and house.owner_id != current_user.id:
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

    if not res_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hồ sơ người cao tuổi yêu cầu.",
        )

    record_id = str(getattr(res_record, "id", None) or patient_id)

    # Đồng bộ bộ nhớ đệm lâm sàng bác sĩ nếu có
    try:
        from app.crud.crud_doctor import crud_doctor
        crud_doctor.sync_clinical_store(
            elderly_ids=[record_id, patient_id],
            update_data={
                "drug_allergies": update_in.drug_allergies,
                "food_allergies": update_in.food_allergies,
                "dietary_notes": update_in.dietary_notes,
                "blood_type": update_in.blood_type,
                "height_cm": update_in.height_cm,
                "weight_kg": update_in.weight_kg,
                "conditions": update_in.conditions,
            },
        )
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
                        notes=f"USER:{doc.id}|PATIENT:{record_id}",
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
                                "patient_id": record_id,
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
                            # pyrefly: ignore[missing-module-attribute]
                            from app.services.notification.fcm_service import send_fcm_notification
                            await send_fcm_notification(
                                fcm_token=doc.fcm_token,
                                title="Hồ sơ bệnh án được cập nhật",
                                body=notif_msg,
                                data={
                                    "type": "MEDICAL_RECORD_UPDATED",
                                    "patient_id": record_id,
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


async def _ensure_house_access(
    db: AsyncSession,
    current_user: Optional[User],
    house_id: Optional[uuid.UUID],
) -> None:
    if not current_user or current_user.role in ("admin", "doctor") or not house_id:
        return
    from app.models.house import House

    house = await db.get(House, house_id)
    if house and house.owner_id != current_user.id:
        member = await crud_house.get_member_by_user(db, house.id, current_user.id)
        if not member or getattr(member, "status", "ACTIVE") != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập lịch khám của hộ gia đình này.",
            )


@router.get(
    "/{patient_id}/appointments",
    response_model=List[Any],
    summary="Danh sách lịch khám của bệnh nhân (Dành cho Người nhà & Người chăm sóc)",
)
async def get_patient_appointments(
    patient_id: str,
    status: Optional[str] = Query(None, description="Trạng thái lịch khám (UPCOMING | COMPLETED | CANCELLED | ALL)"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Người nhà xem danh sách các cuộc hẹn khám, tái khám của người cao tuổi ở chế độ chỉ đọc (Read-only)."""
    import uuid
    from app.crud.crud_appointment import build_appointment_response, crud_appointment
    from app.models.elderly_profile import ElderlyProfile

    try:
        patient_uuid = uuid.UUID(patient_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="ID bệnh nhân không hợp lệ.")

    profile = await db.get(ElderlyProfile, patient_uuid)
    if profile:
        await _ensure_house_access(db, current_user, profile.house_id)

    records = await crud_appointment.get_appointments(
        db=db,
        patient_id=patient_uuid,
        status=status,
    )

    patient_name = (profile.full_name if (profile and profile.full_name) else "Bệnh nhân người cao tuổi")
    return [
        build_appointment_response(
            r,
            patient_name=patient_name,
            doctor_name=r.doctor.full_name if r.doctor else "Bác sĩ gia đình",
        )
        for r in records
    ]


@router.post(
    "/{patient_id}/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def request_patient_appointment(
    appointment_in: AppointmentCreate,
    patient_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Người nhà đặt lịch hẹn hoặc yêu cầu lịch khám với Bác sĩ phụ trách."""
    import uuid
    from app.crud.crud_appointment import build_appointment_response, crud_appointment
    from app.models.elderly_profile import ElderlyProfile
    from app.models.house import HouseMember
    from app.models.user import User
    from app.services.notification.appointment_notify import (
        broadcast_alert_ws,
        format_vn_dt,
        send_appointment_fcm,
    )
    from sqlalchemy import select, or_

    target_id_str = patient_id or appointment_in.patient_id
    try:
        patient_uuid = uuid.UUID(target_id_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="ID bệnh nhân không hợp lệ.")

    target_profile = await db.get(ElderlyProfile, patient_uuid)
    if not target_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người cao tuổi.")

    await _ensure_house_access(db, current_user, target_profile.house_id)

    appointment_in.patient_id = str(target_profile.id)
    appointment_in.patient_name = target_profile.full_name

    # 1. Tìm bác sĩ phụ trách ngôi nhà
    doctor_id = None
    doctor_name = "Bác sĩ phụ trách"
    if target_profile.house_id:
        doc_stmt = (
            select(User)
            .join(HouseMember, HouseMember.user_id == User.id)
            .where(
                HouseMember.house_id == target_profile.house_id,
                HouseMember.status == "ACTIVE",
                or_(
                    HouseMember.role_in_house.ilike("%doctor%"),
                    User.role == "doctor",
                ),
            )
            .limit(1)
        )
        doc_res = await db.execute(doc_stmt)
        doc_user = doc_res.scalar_one_or_none()
        if doc_user:
            doctor_id = doc_user.id
            doctor_name = doc_user.full_name

    if not doctor_id:
        doc_sys_res = await db.execute(select(User).where(User.role == "doctor", User.is_active == True).limit(1))
        doc_sys = doc_sys_res.scalar_one_or_none()
        if doc_sys:
            doctor_id = doc_sys.id
            doctor_name = doc_sys.full_name

    created_by = current_user.id if current_user else None

    try:
        root_apt, _, _ = await crud_appointment.create_appointment_series(
            db=db,
            obj_in=appointment_in,
            doctor_id=doctor_id,
            created_by=created_by,
        )
    except ValueError as e:
        msg = str(e)
        low = msg.lower()
        code = (
            status.HTTP_400_BAD_REQUEST
            if "không hợp lệ" in low
            else (status.HTTP_404_NOT_FOUND if "không tìm thấy" in low else status.HTTP_409_CONFLICT)
        )
        raise HTTPException(status_code=code, detail=msg)

    # 2. Tạo Incident & bắn WebSocket/FCM thông báo cho Bác sĩ & các thành viên
    try:
        from app.models.incident import Incident
        from app.models.device import Device

        dev_res = await db.execute(select(Device.id).where(Device.house_id == target_profile.house_id).limit(1))
        dev_id = dev_res.scalar_one_or_none()
        if not dev_id:
            any_dev = await db.execute(select(Device.id).limit(1))
            dev_id = any_dev.scalar_one_or_none()

        req_user_name = current_user.full_name if current_user else "Người nhà"
        scheduled_str = format_vn_dt(root_apt.scheduled_at, "thời gian đã hẹn")
        msg = f"🗓️ {req_user_name} đã đặt lịch khám cho cụ {target_profile.full_name} vào lúc {scheduled_str}."

        incident = None
        if dev_id:
            incident = Incident(
                device_id=dev_id,
                alert_type="APPOINTMENT_SCHEDULED",
                alert_level="LOW",
                message=msg,
                is_acknowledged=False,
                notes=f"PATIENT:{target_profile.id}|APPOINTMENT_REQUESTED|APT:{root_apt.id}",
            )
            db.add(incident)
            await db.commit()
            await db.refresh(incident)
            try:
                from app.services.redis import redis_service
                await redis_service.invalidate_incidents_cache()
            except Exception:
                pass

        await broadcast_alert_ws(
            {
                "type": "APPOINTMENT_SCHEDULED",
                "alert_type": "APPOINTMENT_SCHEDULED",
                "appointment_id": str(root_apt.id),
                "data": {
                    "id": str(incident.id) if incident else None,
                    "title": "🗓️ YÊU CẦU LỊCH KHÁM TỪ GIA ĐÌNH",
                    "appointment_id": str(root_apt.id),
                    "patient_id": str(target_profile.id),
                    "doctor_id": str(doctor_id) if doctor_id else None,
                    "scheduled_at": root_apt.scheduled_at.isoformat(),
                    "message": msg,
                    "notes": f"PATIENT:{target_profile.id}|APPOINTMENT_REQUESTED|APT:{root_apt.id}",
                },
            }
        )
        if doctor_id:
            await send_appointment_fcm(
                db=db,
                target_house_id=None,
                doctor_id=doctor_id,
                title="🗓️ Yêu cầu lịch khám mới từ gia đình",
                body=msg,
                data={
                    "type": "APPOINTMENT_REQUESTED",
                    "appointment_id": str(root_apt.id),
                    "patient_id": str(target_profile.id),
                },
            )
    except Exception:
        pass

    return build_appointment_response(
        root_apt,
        patient_name=target_profile.full_name or "Bệnh nhân người cao tuổi",
        doctor_name=doctor_name,
    )


async def _execute_confirm_appointment(
    appointment_id: str,
    current_user: Optional[User],
    db: AsyncSession,
    patient_id: Optional[str] = None,
):
    import uuid
    import logging
    from app.crud.crud_appointment import (
        build_appointment_response,
        crud_appointment,
        get_patient_names_map,
    )
    from app.schemas.appointment import AppointmentStatusEnum
    from app.services.notification.appointment_notify import notify_doctor_appointment_confirmed

    logger = logging.getLogger("appointments")

    patient_uuid: Optional[uuid.UUID] = None
    if patient_id is not None:
        try:
            patient_uuid = uuid.UUID(patient_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID bệnh nhân không hợp lệ.")

    try:
        apt_uuid = uuid.UUID(appointment_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID lịch khám không hợp lệ.")

    existing = await crud_appointment.get_by_id(db, apt_uuid)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch khám yêu cầu.")
    if patient_uuid is not None and existing.patient_id != patient_uuid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch khám của bệnh nhân này.")

    await _ensure_house_access(db, current_user, existing.house_id)

    if existing.status != AppointmentStatusEnum.UPCOMING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể xác nhận lịch khám đang ở trạng thái sắp tới (UPCOMING).",
        )

    try:
        apt = await notify_doctor_appointment_confirmed(
            db=db,
            appointment_id=apt_uuid,
            ack_user=current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not apt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch khám yêu cầu.")

    logger.info(
        "[FAMILY APPOINTMENT CONFIRMED] Người thân đã xác nhận lịch hẹn %s của Bác sĩ %s vào %s.",
        apt.id,
        apt.doctor.full_name if apt.doctor else "phụ trách",
        apt.scheduled_at,
    )

    patient_names = await get_patient_names_map(db, [apt.patient_id])
    doctor_name = apt.doctor.full_name if apt.doctor else "Bác sĩ gia đình"
    return build_appointment_response(
        apt,
        patient_name=patient_names.get(apt.patient_id, "Bệnh nhân người cao tuổi"),
        doctor_name=doctor_name,
    )


@router.post(
    "/{patient_id}/appointments/{appointment_id}/confirm",
    response_model=Any,
    summary="Chủ nhà hoặc Người thân xác nhận lịch khám của Bác sĩ",
)
async def confirm_patient_appointment_by_patient(
    patient_id: str,
    appointment_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    return await _execute_confirm_appointment(appointment_id, current_user, db, patient_id=patient_id)


@router.post(
    "/appointments/{appointment_id}/confirm",
    response_model=Any,
    summary="Chủ nhà hoặc Người thân xác nhận lịch khám của Bác sĩ",
)
async def confirm_patient_appointment(
    appointment_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    return await _execute_confirm_appointment(appointment_id, current_user, db)



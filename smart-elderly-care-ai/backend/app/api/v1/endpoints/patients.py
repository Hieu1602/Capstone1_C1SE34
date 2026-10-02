"""
patients.py – API quản lý Hồ sơ người cao tuổi & Bệnh án chi tiết.
Tương thích hoàn toàn với PatientMedicalRecordScreen trên Mobile App.
Vị trí: backend/app/api/v1/endpoints/patients.py
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.crud.crud_elderly import crud_elderly
from app.crud.crud_house import crud_house
from app.models.user import User
from app.schemas.patient import (
    PatientMedicalRecordOut,
    PatientMedicalRecordUpdate,
)

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

"""
patients.py – API quản lý Hồ sơ người cao tuổi & Bệnh án chi tiết.
Tương thích hoàn toàn với PatientMedicalRecordScreen trên Mobile App.
Vị trí: backend/app/api/v1/endpoints/patients.py
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
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

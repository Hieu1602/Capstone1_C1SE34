"""
doctor.py – Endpoints nghiệp vụ y khoa dành cho Bác sĩ gia đình.
Vị trí: backend/app/api/v1/endpoints/doctor.py
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.crud.crud_doctor import crud_doctor
from app.crud.crud_elderly import crud_elderly
from app.models.user import User
from app.schemas.doctor import (
    DoctorPatientCard,
    DoctorPatientDetail,
    PrescriptionItem,
    PrescriptionCreate,
    DoctorVitalsAnalytics,
    ThresholdsUpdate,
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
    # Nếu không có token (đang test/demo), tạo mock User với ID bác sĩ mẫu
    if not current_user:
        current_user = User(
            id="b2222222-b4e1-4b08-b2d3-d949a0eb075c",
            phone="+84905111222",
            full_name="BS. Trần Văn Minh",
            role="user",
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


@router.put(
    "/patients/{elderly_id}/medical-record",
    response_model=PatientMedicalRecordOut,
    summary="Bác sĩ cập nhật hồ sơ bệnh án & dặn dò y khoa",
)
async def update_patient_medical_record(
    elderly_id: str,
    record_in: PatientMedicalRecordUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật chẩn đoán, tiền sử bệnh án, ghi chú dinh dưỡng hoặc ngày hẹn tái khám."""
    return await crud_elderly.update_medical_record(
        db=db,
        patient_id_or_serial=elderly_id,
        update_in=record_in,
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

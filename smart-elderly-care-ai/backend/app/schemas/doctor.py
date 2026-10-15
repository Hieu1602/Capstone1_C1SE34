"""
doctor.py – Pydantic Schemas cho Phân hệ Bác sĩ Gia đình (Doctor Subsystem).
Vị trí: backend/app/schemas/doctor.py
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.patient import MedicalCondition


class DoctorPatientCard(BaseModel):
    """Thẻ tóm tắt thông tin người cao tuổi dành cho danh sách Bác sĩ phụ trách."""
    id: str
    name: str
    birth_year: Optional[int] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    house_id: str
    house_name: str = ""
    house_address: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    avatar_url: Optional[str] = None
    has_face_enrolled: bool = False
    device_id: Optional[str] = None
    is_online: bool = False
    battery_level: Optional[int] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    skin_temp_max: Optional[float] = None
    blood_pressure: Optional[str] = None
    health_status: str = "NORMAL"  # NORMAL | WARNING | DANGER
    last_updated: Optional[str] = None


class DoctorPatientDetail(DoctorPatientCard):
    """Hồ sơ y tế toàn diện của bệnh nhân cho Bác sĩ."""
    conditions: List[MedicalCondition] = Field(default_factory=list)
    drug_allergies: Optional[str] = None
    food_allergies: Optional[str] = None
    dietary_notes: Optional[str] = None
    doctor_notes: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[int] = None
    bmi: Optional[float] = None
    next_appointment: Optional[str] = None
    prescriptions_count: int = 0


class PrescriptionItem(BaseModel):
    """Đơn thuốc được kê bởi Bác sĩ."""
    id: str
    patient_id: str
    medication_name: str
    dosage: str
    frequency: str = "Hàng ngày"
    schedule_times: List[str] = Field(default_factory=list)
    instructions: str = ""
    doctor_name: Optional[str] = None
    enable_speaker_reminder: bool = True
    created_at: Optional[str] = None


class PrescriptionCreate(BaseModel):
    """Yêu cầu kê đơn thuốc mới."""
    medication_name: str
    dosage: str
    frequency: Optional[str] = None
    schedule_times: Optional[List[str]] = None
    instructions: Optional[str] = None
    enable_speaker_reminder: bool = True


class PrescriptionUpdate(BaseModel):
    """Cập nhật đơn thuốc hiện có."""
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    schedule_times: Optional[List[str]] = None
    instructions: Optional[str] = None
    enable_speaker_reminder: Optional[bool] = None


class DoctorMedicalRecordUpdate(BaseModel):
    """Bác sĩ cập nhật hồ sơ bệnh án, bệnh lý nền, dị ứng, dinh dưỡng và dặn dò."""
    doctor_notes: Optional[str] = None
    next_appointment: Optional[str] = None
    conditions: Optional[List[MedicalCondition]] = None
    drug_allergies: Optional[str] = None
    food_allergies: Optional[str] = None
    dietary_notes: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[int] = None


class DoctorVitalsAnalytics(BaseModel):
    """Dữ liệu phân tích sinh hiệu chuỗi thời gian dài hạn từ TimescaleDB."""
    patient_id: str
    patient_name: str
    days: int = 7
    avg_heart_rate: Optional[float] = None
    min_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    avg_spo2: Optional[float] = None
    min_spo2: Optional[int] = None
    avg_skin_temp: Optional[float] = None
    hr_stability_score: Optional[int] = None
    spo2_drops_count: Optional[int] = None
    daily_trends: List[Dict[str, Any]] = Field(default_factory=list)


class ThresholdsUpdate(BaseModel):
    """Cập nhật cấu hình ngưỡng y tế khuyến nghị."""
    hr_threshold_high: Optional[int] = Field(None, ge=80, le=200)
    hr_threshold_low: Optional[int] = Field(None, ge=40, le=90)
    spo2_threshold_low: Optional[int] = Field(None, ge=75, le=95)
    immobility_seconds: Optional[int] = Field(None, ge=10, le=600)


class AppointmentItem(BaseModel):
    """Mục lịch hẹn và tái khám y tế dành cho Bác sĩ gia đình."""
    id: str
    patient_id: str
    patient_name: str
    scheduled_at: str
    exam_type: str
    location: str
    status: str = "UPCOMING"  # UPCOMING | COMPLETED | CANCELLED
    instructions: Optional[str] = None
    doctor_name: Optional[str] = None
    enable_speaker_reminder: bool = True
    created_at: Optional[str] = None


class AppointmentCreate(BaseModel):
    patient_id: str
    patient_name: str
    scheduled_at: str
    exam_type: str = "Tái khám định kỳ"
    location: str = "Tại nhà (Khám tại gia)"
    instructions: Optional[str] = "Người nhà chuẩn bị sổ đo huyết áp và các đơn thuốc đang dùng."
    enable_speaker_reminder: bool = True


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[str] = None
    exam_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    instructions: Optional[str] = None
    enable_speaker_reminder: Optional[bool] = None


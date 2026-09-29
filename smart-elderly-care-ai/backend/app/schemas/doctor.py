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
    birth_year: Optional[int] = 1948
    age: int = 78
    gender: str = "Nam"
    house_id: str
    house_name: str = "Nhà của tôi"
    house_address: Optional[str] = "123 Hải Phòng, TP. Đà Nẵng"
    medical_history: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    avatar_url: Optional[str] = None
    device_id: str = "BLE_BAND_001"
    is_online: bool = True
    battery_level: Optional[int] = 85
    heart_rate: Optional[int] = 76
    spo2: Optional[int] = 98
    skin_temp_max: Optional[float] = 36.6
    blood_pressure: Optional[str] = "120/80 mmHg"
    health_status: str = "NORMAL"  # NORMAL | WARNING | DANGER
    last_updated: Optional[str] = "Vừa xong"


class DoctorPatientDetail(DoctorPatientCard):
    """Hồ sơ y tế toàn diện của bệnh nhân cho Bác sĩ."""
    conditions: List[MedicalCondition] = Field(default_factory=list)
    drug_allergies: str = "Penicillin (dị ứng nổi mề đay)"
    food_allergies: str = "Hải sản có vỏ (tôm, cua)"
    dietary_notes: str = "Ăn nhạt, giảm muối < 3g/ngày, hạn chế đường và tinh bột"
    doctor_notes: Optional[str] = "Bệnh nhân tuân thủ điều trị tốt, cần theo dõi huyết áp buổi sáng."
    blood_type: str = "O+"
    height_cm: int = 165
    weight_kg: int = 62
    bmi: float = 22.8
    next_appointment: Optional[str] = "15/10/2026 - 08:30"
    prescriptions_count: int = 3


class PrescriptionItem(BaseModel):
    """Đơn thuốc được kê bởi Bác sĩ."""
    id: str
    patient_id: str
    medication_name: str
    dosage: str
    frequency: str = "Hàng ngày"
    schedule_times: List[str] = Field(default_factory=lambda: ["08:00"])
    instructions: str = "Uống sau ăn 15 phút với nước ấm"
    doctor_name: str = "BS. Trần Văn Minh"
    enable_speaker_reminder: bool = True
    created_at: str = "2026-09-29 08:00:00"


class PrescriptionCreate(BaseModel):
    """Yêu cầu kê đơn thuốc mới."""
    medication_name: str
    dosage: str
    frequency: Optional[str] = "Hàng ngày"
    schedule_times: List[str] = Field(default_factory=lambda: ["08:00"])
    instructions: Optional[str] = "Uống sau khi ăn sáng với nước ấm"
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
    avg_heart_rate: float = 75.4
    min_heart_rate: int = 58
    max_heart_rate: int = 108
    avg_spo2: float = 97.6
    min_spo2: int = 93
    avg_skin_temp: float = 36.6
    hr_stability_score: int = 94
    spo2_drops_count: int = 1
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
    doctor_name: str = "BS. Trần Văn Minh"
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


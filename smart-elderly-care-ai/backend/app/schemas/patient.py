"""
patient.py – Pydantic Schemas cho Hồ sơ Bệnh án Người cao tuổi.
Đồng bộ hoàn toàn với PatientMedicalRecordScreen và useVitalStore trên Mobile App.
Vị trí: backend/app/schemas/patient.py
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class MedicalCondition(BaseModel):
    id: str
    name: str
    severity: str = "warning"  # warning | danger | info
    note: str = ""


class PatientMedicalRecordOut(BaseModel):
    id: str
    name: str
    birth_year: str
    age: int
    gender: str = "Nam"
    blood_type: str = "O+"
    height_cm: int = 165
    weight_kg: int = 62
    conditions: List[MedicalCondition] = Field(default_factory=list)
    drug_allergies: str = "Penicillin (dị ứng nổi mề đay)"
    food_allergies: str = "Hải sản có vỏ (tôm, cua)"
    dietary_notes: str = "Ăn nhạt, giảm muối < 3g/ngày, hạn chế đường và tinh bột"
    doctor_name: str = "BS. CKII. Trần Tuấn Minh"
    doctor_phone: str = "0912 345 678"
    doctor_specialty: str = "Chuyên khoa Tim mạch & Lão khoa"
    hospital: str = "Bệnh viện Đa khoa Đà Nẵng"
    next_appointment: str = "15/10/2026 - 08:30"


class PatientMedicalRecordUpdate(BaseModel):
    name: Optional[str] = None
    birth_year: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[int] = None
    weight_kg: Optional[int] = None
    conditions: Optional[List[MedicalCondition]] = None
    drug_allergies: Optional[str] = None
    food_allergies: Optional[str] = None
    dietary_notes: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_phone: Optional[str] = None
    doctor_specialty: Optional[str] = None
    hospital: Optional[str] = None
    next_appointment: Optional[str] = None

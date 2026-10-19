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
    name: str = ""
    birth_year: str = ""
    age: int = 0
    gender: str = ""
    blood_type: str = ""
    height_cm: int = 0
    weight_kg: int = 0
    conditions: List[MedicalCondition] = Field(default_factory=list)
    drug_allergies: str = ""
    food_allergies: str = ""
    dietary_notes: str = ""
    doctor_name: str = ""
    doctor_phone: str = ""
    doctor_specialty: str = ""
    hospital: str = ""
    next_appointment: str = ""
    avatar_url: Optional[str] = None
    has_face_enrolled: bool = False


class FaceEnrollResponse(BaseModel):
    success: bool
    message: str
    elderly_id: str
    full_name: str
    avatar_url: str
    has_face_enrolled: bool = True


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

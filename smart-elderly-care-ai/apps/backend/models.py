# apps/backend/models.py
# Định nghĩa các bảng dữ liệu PostgreSQL bằng SQLAlchemy ORM

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    BigInteger,
)
from sqlalchemy.orm import relationship
from .database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=False)
    birth_year = Column(String(10), nullable=True, default="1948")
    gender = Column(String(20), nullable=True, default="Nam")
    blood_type = Column(String(10), nullable=True, default="O+")
    height_cm = Column(Integer, nullable=True, default=165)
    weight_kg = Column(Integer, nullable=True, default=62)
    emergency_contact = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    medical_records = relationship("MedicalRecord", back_populates="patient", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="patient", cascade="all, delete-orphan")
    vital_signs = relationship("VitalSign", back_populates="patient", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="patient", cascade="all, delete-orphan")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    medical_history = Column(Text, nullable=True)  # Chuỗi JSON lưu danh sách bệnh nền
    allergies = Column(Text, nullable=True)        # Chuỗi JSON lưu thông tin dị ứng thuốc/thực phẩm
    dietary_notes = Column(Text, nullable=True)    # Chế độ ăn uống sinh hoạt
    doctor_name = Column(String(255), nullable=True)
    doctor_hospital = Column(String(255), nullable=True)
    doctor_phone = Column(String(50), nullable=True)
    next_checkup_date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="medical_records")


class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    dosage = Column(String(100), nullable=True)
    instruction = Column(Text, nullable=True)
    reminder_time = Column(String(20), nullable=False)   # Ví dụ: "18:30"
    session = Column(String(20), default="EVENING")      # "MORNING", "NOON", "EVENING"
    is_taken = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="medications")


class VitalSign(Base):
    __tablename__ = "vital_signs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    heart_rate = Column(Integer, nullable=True, default=74)
    spo2 = Column(Integer, nullable=True, default=98)
    body_temp = Column(Float, nullable=True, default=36.8)
    activity_state = Column(String(100), nullable=True, default="Sinh hoạt")
    sound_state = Column(String(100), nullable=True, default="Bình thường")
    fall_detected_count = Column(Integer, default=0)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    patient = relationship("Patient", back_populates="vital_signs")


class SystemMode(Base):
    __tablename__ = "system_modes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    mode = Column(String(50), default="HOME")  # 'HOME', 'AWAY', 'MUTE', 'DISARM'
    is_mute_alarm = Column(Boolean, default=False)
    is_camera_privacy = Column(Boolean, default=False)
    mute_mode = Column(String(50), default="VIBRATE")
    alarm_snooze_until = Column(BigInteger, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True, index=True)
    type = Column(String(100), nullable=False)  # 'FALL_DETECTED', 'HIGH_HEART_RATE', 'ACOUSTIC_DISTRESS', etc.
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    alert_level = Column(String(20), default="MEDIUM")  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    confidence = Column(Float, default=0.92)
    video_clip_url = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    is_new = Column(Boolean, default=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    patient = relationship("Patient", back_populates="notifications")

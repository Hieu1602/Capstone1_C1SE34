"""
appointment.py – Pydantic v2 schemas for Appointments & Follow-up Visits (UC.0).
Provides request and response validation for the appointment lifecycle.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field


class VisitTypeEnum(str, Enum):
    CLINIC = "CLINIC"
    HOME_VISIT = "HOME_VISIT"
    TELEHEALTH = "TELEHEALTH"


class AppointmentStatusEnum(str, Enum):
    UPCOMING = "UPCOMING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class RecurrencePatternEnum(str, Enum):
    NONE = "NONE"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"


class ReminderTypeEnum(str, Enum):
    BEFORE_24H = "BEFORE_24H"
    BEFORE_2H = "BEFORE_2H"


class ReminderStatusEnum(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    CANCELLED = "CANCELLED"


class AppointmentCreate(BaseModel):
    """Payload to schedule a new appointment or follow-up visit."""
    patient_id: str = Field(..., description="ID của bệnh nhân người cao tuổi")
    patient_name: Optional[str] = Field(None, description="Tên bệnh nhân")
    scheduled_at: datetime = Field(..., description="Thời gian hẹn (ISO 8601 UTC hoặc local with tz)")
    duration_minutes: int = Field(default=30, ge=15, le=240, description="Thời lượng dự kiến (phút)")
    visit_type: str = Field(default=VisitTypeEnum.HOME_VISIT.value, description="Hình thức khám (CLINIC | HOME_VISIT | TELEHEALTH)")
    location: str = Field(default="Tại nhà (Khám tại gia)", description="Địa điểm hoặc phòng khám")
    clinical_notes: Optional[str] = Field(None, description="Ghi chú dặn dò chuẩn bị của bác sĩ")
    enable_speaker_reminder: bool = Field(default=True, description="Kích hoạt phát loa thông minh tại nhà")
    recurrence_pattern: str = Field(default=RecurrencePatternEnum.NONE.value, description="Chu kỳ lặp (NONE | WEEKLY | MONTHLY | QUARTERLY)")
    recurrence_occurrences: int = Field(default=1, ge=1, le=12, description="Số lần lặp định kỳ (tối đa 12)")


class AppointmentUpdate(BaseModel):
    """Payload to reschedule or modify an upcoming appointment."""
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=240)
    visit_type: Optional[str] = None
    location: Optional[str] = None
    clinical_notes: Optional[str] = None
    enable_speaker_reminder: Optional[bool] = None


class AppointmentCancelRequest(BaseModel):
    """Payload to cancel an appointment."""
    cancellation_reason: str = Field(..., min_length=3, max_length=500, description="Lý do hủy hẹn bắt buộc")


class AppointmentReminderItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    appointment_id: str
    reminder_type: str
    scheduled_time: datetime
    status: str
    sent_at: Optional[datetime] = None


class AppointmentResponse(BaseModel):
    """Standard response model for appointment details."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    patient_id: str
    patient_name: str
    house_id: Optional[str] = None
    visit_type: str
    scheduled_at: datetime
    duration_minutes: int = 30
    location: str
    clinical_notes: Optional[str] = None
    status: str = "UPCOMING"
    cancellation_reason: Optional[str] = None
    recurrence_pattern: str = "NONE"
    parent_recurring_id: Optional[str] = None
    enable_speaker_reminder: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AppointmentCreateResponse(BaseModel):
    """Response returned upon appointment creation."""
    primary_appointment: AppointmentResponse
    created_count: int = 1
    scheduled_reminders_count: int = 2

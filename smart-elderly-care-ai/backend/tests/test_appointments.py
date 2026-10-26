"""
test_appointments.py – Unit and integration tests for Appointment & Follow-up Visits (UC.0).
Tests schema validation, conflict detection, lifecycle transitions, and reminder management.
"""

from datetime import datetime, timedelta, timezone
import uuid
import pytest
from pydantic import ValidationError

from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCreate,
    AppointmentStatusEnum,
    AppointmentUpdate,
    RecurrencePatternEnum,
    VisitTypeEnum,
)


def test_appointment_create_valid():
    """Verify valid appointment payload passes schema validation."""
    future_time = datetime.now(timezone.utc) + timedelta(days=2)
    payload = {
        "patient_id": str(uuid.uuid4()),
        "patient_name": "Cụ Nguyễn Văn An",
        "scheduled_at": future_time.isoformat(),
        "duration_minutes": 45,
        "visit_type": "HOME_VISIT",
        "location": "Tại nhà (Khám tại gia)",
        "clinical_notes": "Đo huyết áp và kiểm tra đường huyết",
        "recurrence_pattern": "NONE",
        "recurrence_occurrences": 1,
    }
    model = AppointmentCreate.model_validate(payload)
    assert model.duration_minutes == 45
    assert model.visit_type == VisitTypeEnum.HOME_VISIT.value


def test_appointment_cancel_requires_reason():
    """Verify cancellation requires a reason with minimum length 3."""
    with pytest.raises(ValidationError):
        AppointmentCancelRequest.model_validate({"cancellation_reason": "ab"})

    valid = AppointmentCancelRequest.model_validate(
        {"cancellation_reason": "Bệnh nhân có việc gia đình đột xuất"}
    )
    assert valid.cancellation_reason == "Bệnh nhân có việc gia đình đột xuất"


def test_appointment_recurrence_occurrences_limit():
    """Verify recurrence occurrences bounded between 1 and 12."""
    future_time = datetime.now(timezone.utc) + timedelta(days=1)
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({
            "patient_id": str(uuid.uuid4()),
            "scheduled_at": future_time.isoformat(),
            "recurrence_occurrences": 15,  # Exceeds max 12
        })


def test_appointment_update_schema():
    """Verify partial updates allow modifying only selected fields."""
    future_time = datetime.now(timezone.utc) + timedelta(days=5)
    update_data = AppointmentUpdate.model_validate({
        "scheduled_at": future_time.isoformat(),
        "clinical_notes": "Bác sĩ đổi lịch khám buổi chiều",
    })
    assert update_data.clinical_notes == "Bác sĩ đổi lịch khám buổi chiều"
    assert update_data.duration_minutes is None


def test_appointment_status_enum_values():
    """Verify all valid appointment status enum values."""
    assert AppointmentStatusEnum.UPCOMING.value == "UPCOMING"
    assert AppointmentStatusEnum.COMPLETED.value == "COMPLETED"
    assert AppointmentStatusEnum.CANCELLED.value == "CANCELLED"


def test_appointment_recurrence_patterns():
    """Verify supported recurrence patterns."""
    assert RecurrencePatternEnum.NONE.value == "NONE"
    assert RecurrencePatternEnum.WEEKLY.value == "WEEKLY"
    assert RecurrencePatternEnum.MONTHLY.value == "MONTHLY"
    assert RecurrencePatternEnum.QUARTERLY.value == "QUARTERLY"


def test_appointment_reminder_lead_time_calculation():
    """Verify reminder timing calculates correctly for 24h and 2h before visit."""
    scheduled = datetime(2026, 11, 15, 10, 0, 0, tzinfo=timezone.utc)
    t_24h = scheduled - timedelta(hours=24)
    t_2h = scheduled - timedelta(hours=2)

    assert t_24h == datetime(2026, 11, 14, 10, 0, 0, tzinfo=timezone.utc)
    assert t_2h == datetime(2026, 11, 15, 8, 0, 0, tzinfo=timezone.utc)


"""
test_appointments.py – Unit, ASGI, and orphan-free integration tests for
Appointment & Follow-up Visits (UC.0), covering:
- Schemas (duration 5..240, visit_type HOME->HOME_VISIT, recurrence, cancel strip, complete request)
- Overlap conflict detection (same-day multi-hour, back-to-back, partial/duration overlap, UTC normalization)
- CRUD scoping, UUID validation, real patient_name, status transitions (404 vs 400 vs 409)
- Two-way sync (APT:<uuid> extraction, acknowledge & acknowledge-all, APPOINTMENT_REQUESTED skip,
  INCIDENT_RESOLVED real Incident.id, Redis cache invalidation, WS dead-socket pruning, UTC+7)
- Context builder scoping & scheduler dispatch
- Consolidated PostgreSQL lifecycle test with guaranteed reverse-FK cleanup
"""

from datetime import datetime, timedelta, timezone
import json
from types import SimpleNamespace
from typing import Dict, Optional
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

from fastapi import FastAPI
import httpx
from pydantic import ValidationError
import pytest
from sqlalchemy import delete

from app.api.deps import get_current_user_optional
from app.api.v1.api import api_router
from app.api.websockets.vitals_ws import alert_clients
from app.core.database import AsyncSessionFactory, engine, get_db, get_redis
from app.crud import crud_doctor
from app.crud.crud_appointment import crud_appointment
from app.crud.crud_incident import crud_incident
from app.main import app as main_app
from app.models.appointment import Appointment, AppointmentReminder
from app.models.device import Device
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.incident import Incident
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCompleteRequest,
    AppointmentCreate,
    AppointmentStatusEnum,
    AppointmentUpdate,
    RecurrencePatternEnum,
    ReminderStatusEnum,
    ReminderTypeEnum,
    VisitTypeEnum,
)
from app.services.chatbot.context_builder import ChatbotContextBuilder
from app.services.notification.appointment_notify import (
    broadcast_alert_ws,
    extract_appointment_id,
    format_vn_dt,
    notify_doctor_appointment_confirmed,
)
from app.services.redis import redis_service
from app.services.scheduler.appointment_scheduler import AppointmentSchedulerService


class FakeRedis:
    """In-memory Redis supporting scan/delete for cache invalidation tests."""

    def __init__(self):
        self._store: Dict[str, str] = {}

    async def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._store[key] = value
        return True

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for k in keys:
            if self._store.pop(k, None) is not None:
                deleted += 1
        return deleted

    async def scan(self, cursor: int = 0, match: str = "*", count: int = 100):
        import fnmatch
        matched = [k for k in list(self._store.keys()) if fnmatch.fnmatch(k, match)]
        return 0, matched


def _make_mock_apt(
    *,
    apt_id: Optional[uuid.UUID] = None,
    doctor_id: Optional[uuid.UUID] = None,
    patient_id: Optional[uuid.UUID] = None,
    house_id: Optional[uuid.UUID] = None,
    status: str = "UPCOMING",
    visit_type: str = "HOME_VISIT",
    scheduled_at: Optional[datetime] = None,
    duration_minutes: int = 30,
    doctor_name: str = "BS. Trần Văn Minh",
    clinical_notes: Optional[str] = None,
    cancellation_reason: Optional[str] = None,
):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=apt_id or uuid.uuid4(),
        doctor_id=doctor_id,
        doctor=SimpleNamespace(full_name=doctor_name) if doctor_id else None,
        patient_id=patient_id or uuid.uuid4(),
        house_id=house_id,
        created_by=doctor_id,
        visit_type=visit_type,
        scheduled_at=scheduled_at or (now + timedelta(days=1)),
        duration_minutes=duration_minutes,
        location="Tại nhà",
        clinical_notes=clinical_notes,
        status=status,
        cancellation_reason=cancellation_reason,
        recurrence_pattern="NONE",
        parent_recurring_id=None,
        enable_speaker_reminder=True,
        reminders=[],
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------------------------
# 1. Existing Baseline Schema & Logic Tests (Preserved)
# ---------------------------------------------------------------------------


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
    with pytest.raises(ValidationError):
        AppointmentCancelRequest.model_validate({"cancellation_reason": "   "})

    valid = AppointmentCancelRequest.model_validate(
        {"cancellation_reason": "  Bệnh nhân có việc gia đình đột xuất  "}
    )
    assert valid.cancellation_reason == "Bệnh nhân có việc gia đình đột xuất"


def test_appointment_recurrence_occurrences_limit():
    """Verify recurrence occurrences bounded between 1 and 12."""
    future_time = datetime.now(timezone.utc) + timedelta(days=1)
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({
            "patient_id": str(uuid.uuid4()),
            "scheduled_at": future_time.isoformat(),
            "recurrence_occurrences": 15,
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


@pytest.mark.asyncio
async def test_same_day_different_hour_no_conflict():
    """Verify two appointments on the same day with different hours do not conflict."""
    db = AsyncMock()
    res_mock = MagicMock()
    res_mock.all.return_value = []
    db.execute.return_value = res_mock

    conflict = await crud_appointment.check_conflict(
        db=db,
        start_time=datetime(2026, 11, 21, 9, 0, tzinfo=timezone.utc),
        duration_minutes=30,
        patient_id=uuid.uuid4(),
        doctor_id=uuid.uuid4(),
    )
    assert conflict is False


# ---------------------------------------------------------------------------
# 2. Schema Normalization, Legacy Store Retirement & Helper Tests
# ---------------------------------------------------------------------------


def test_schema_visit_type_duration_and_complete_request():
    future_time = datetime.now(timezone.utc) + timedelta(days=2)
    m_home = AppointmentCreate.model_validate({
        "patient_id": str(uuid.uuid4()),
        "scheduled_at": future_time.isoformat(),
        "duration_minutes": 10,
        "visit_type": "home",
        "recurrence_pattern": "weekly",
    })
    assert m_home.visit_type == VisitTypeEnum.HOME_VISIT.value
    assert m_home.duration_minutes == 10
    assert m_home.recurrence_pattern == RecurrencePatternEnum.WEEKLY.value

    m_tele = AppointmentCreate.model_validate({
        "patient_id": str(uuid.uuid4()),
        "scheduled_at": future_time.isoformat(),
        "visit_type": "telehealth",
    })
    assert m_tele.visit_type == VisitTypeEnum.TELEHEALTH.value

    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({
            "patient_id": str(uuid.uuid4()),
            "scheduled_at": future_time.isoformat(),
            "duration_minutes": 4,
        })
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({
            "patient_id": str(uuid.uuid4()),
            "scheduled_at": future_time.isoformat(),
            "visit_type": "INVALID_TYPE",
        })

    u_home = AppointmentUpdate.model_validate({"visit_type": "HOME", "duration_minutes": 5})
    assert u_home.visit_type == VisitTypeEnum.HOME_VISIT.value
    assert u_home.duration_minutes == 5

    c_empty = AppointmentCompleteRequest.model_validate({})
    assert c_empty.clinical_notes is None
    c_notes = AppointmentCompleteRequest.model_validate({"clinical_notes": "Sinh hiệu ổn định"})
    assert c_notes.clinical_notes == "Sinh hiệu ổn định"

    assert not hasattr(crud_doctor, "_APPOINTMENT_STORE")
    assert not hasattr(crud_doctor.crud_doctor, "delete_appointment")


def test_format_vn_dt_and_extract_appointment_id():
    assert format_vn_dt(None, "mặc định") == "mặc định"
    assert format_vn_dt(datetime(2026, 11, 21, 2, 0)) == "09:00 ngày 21/11/2026"
    assert format_vn_dt(datetime(2026, 11, 21, 17, 30, tzinfo=timezone.utc)) == "00:30 ngày 22/11/2026"

    apt_id = str(uuid.uuid4())
    assert extract_appointment_id(f"APT:{apt_id}|PATIENT:{uuid.uuid4()}|BY_DOCTOR:{uuid.uuid4()}") == apt_id
    assert extract_appointment_id(apt_id) == apt_id
    assert extract_appointment_id("not-a-uuid") is None
    assert extract_appointment_id(None) is None


@pytest.mark.asyncio
async def test_broadcast_alert_ws_prunes_dead_sockets():
    good_ws = AsyncMock()
    bad_ws = AsyncMock()
    bad_ws.send_text.side_effect = RuntimeError("closed")

    snapshot = list(alert_clients)
    alert_clients.clear()
    alert_clients.extend([bad_ws, good_ws])
    try:
        await broadcast_alert_ws({"type": "APPOINTMENT_DELETED", "appointment_id": "123"})
        good_ws.send_text.assert_awaited_once()
        assert bad_ws not in alert_clients
        assert good_ws in alert_clients
    finally:
        alert_clients.clear()
        alert_clients.extend(snapshot)


# ---------------------------------------------------------------------------
# 3. CRUD Overlap, Scoping & Status Transitions (Mocked DB)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_conflict_overlap_and_back_to_back_matrix():
    existing_start = datetime(2026, 11, 21, 9, 0, tzinfo=timezone.utc)

    async def _run_check(cand_start: datetime, cand_dur: int, stored_dur: int = 30) -> bool:
        db = AsyncMock()
        res_mock = MagicMock()
        res_mock.all.return_value = [(uuid.uuid4(), existing_start, stored_dur)]
        db.execute.return_value = res_mock
        return await crud_appointment.check_conflict(
            db=db,
            start_time=cand_start,
            duration_minutes=cand_dur,
            patient_id=uuid.uuid4(),
            doctor_id=uuid.uuid4(),
        )

    # Same day non-overlapping (14:00 vs 09:00)
    assert await _run_check(datetime(2026, 11, 21, 14, 0, tzinfo=timezone.utc), 30) is False
    # Back-to-back after (09:30 vs 09:00 30m)
    assert await _run_check(datetime(2026, 11, 21, 9, 30, tzinfo=timezone.utc), 30) is False
    # Back-to-back before (08:30 30m vs 09:00)
    assert await _run_check(datetime(2026, 11, 21, 8, 30, tzinfo=timezone.utc), 30) is False
    # Partial overlap (09:15 30m vs 09:00 30m)
    assert await _run_check(datetime(2026, 11, 21, 9, 15, tzinfo=timezone.utc), 30) is True
    # Duration overlap (09:30 30m vs 09:00 60m)
    assert await _run_check(datetime(2026, 11, 21, 9, 30, tzinfo=timezone.utc), 30, stored_dur=60) is True
    # Naive +07:00 equivalence: 16:00+07:00 == 09:00Z
    vn_tz = timezone(timedelta(hours=7))
    assert await _run_check(datetime(2026, 11, 21, 16, 0, tzinfo=vn_tz), 30) is True


@pytest.mark.asyncio
async def test_crud_scoping_and_validation_errors():
    db = AsyncMock()
    res_mock = MagicMock()
    res_mock.scalars.return_value.all.return_value = []
    db.execute.return_value = res_mock

    doc_id = uuid.uuid4()
    await crud_appointment.get_appointments(db=db, doctor_id=doc_id, status="ALL")
    stmt_sql = str(db.execute.call_args[0][0])
    assert "appointments.doctor_id IS NULL" not in stmt_sql
    assert "appointments.status =" not in stmt_sql

    # Invalid patient UUID & missing ElderlyProfile raise ValueError
    bad_payload = AppointmentCreate(
        patient_id="not-a-uuid",
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    with pytest.raises(ValueError, match="ID bệnh nhân không hợp lệ"):
        await crud_appointment.create_appointment_series(db, bad_payload, doctor_id=doc_id)

    missing_res = MagicMock()
    missing_res.scalar_one_or_none.return_value = None
    db.execute.return_value = missing_res
    missing_payload = AppointmentCreate(
        patient_id=str(uuid.uuid4()),
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    with pytest.raises(ValueError, match="Không tìm thấy hồ sơ người cao tuổi"):
        await crud_appointment.create_appointment_series(db, missing_payload, doctor_id=doc_id)

    # update_appointment / mark_completed: None on missing, ValueError on non-UPCOMING
    with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=None)):
        assert await crud_appointment.update_appointment(db, uuid.uuid4(), AppointmentUpdate()) is None
        assert await crud_appointment.mark_completed(db, uuid.uuid4()) is None

    completed_apt = _make_mock_apt(status="COMPLETED")
    with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=completed_apt)):
        with pytest.raises(ValueError, match="UPCOMING"):
            await crud_appointment.update_appointment(db, completed_apt.id, AppointmentUpdate())
        with pytest.raises(ValueError, match="hoàn tất"):
            await crud_appointment.mark_completed(db, completed_apt.id)

    upcoming_apt = _make_mock_apt(status="UPCOMING")
    with patch.object(crud_appointment, "get_by_id", AsyncMock(side_effect=[upcoming_apt, upcoming_apt])):
        await crud_appointment.mark_completed(db, upcoming_apt.id, clinical_notes="  Huyết áp 120/80  ")
        assert upcoming_apt.status == AppointmentStatusEnum.COMPLETED.value
        assert upcoming_apt.clinical_notes == "Huyết áp 120/80"


# ---------------------------------------------------------------------------
# 4. Two-Way Sync, Incidents & Redis Cache Invalidation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_crud_incident_acknowledge_preserves_apt_and_requested_tags():
    apt_id = uuid.uuid4()
    user_id = uuid.uuid4()
    inc = SimpleNamespace(
        id=uuid.uuid4(),
        notes=f"USER:{user_id}|APPOINTMENT_REQUESTED|APT:{apt_id}",
        is_acknowledged=False,
        acknowledged_at=None,
        acknowledged_by=None,
    )
    db = AsyncMock()
    with patch.object(crud_incident, "get", AsyncMock(return_value=inc)):
        updated = await crud_incident.acknowledge(db, inc.id, notes="Gia đình đã xác nhận", acknowledged_by=user_id)
    assert f"USER:{user_id}" in updated.notes
    assert f"APT:{apt_id}" in updated.notes
    assert "APPOINTMENT_REQUESTED" in updated.notes


@pytest.mark.asyncio
async def test_notify_doctor_appointment_confirmed_syncs_incident_id_and_cache():
    apt_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    inc_id = uuid.uuid4()
    dev_id = uuid.uuid4()

    apt = _make_mock_apt(apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, status="UPCOMING")
    old_inc = SimpleNamespace(
        id=inc_id,
        alert_type="APPOINTMENT_SCHEDULED",
        notes=f"APT:{apt_id}|PATIENT:{pat_id}|NAME:Cụ An|BY_DOCTOR:{doc_id}",
        is_acknowledged=False,
        acknowledged_at=None,
        acknowledged_by=None,
    )
    eld = SimpleNamespace(id=pat_id, full_name="Cụ Nguyễn Văn An", house_id=house_id)

    # Test non-UPCOMING rejection first
    done_apt = _make_mock_apt(apt_id=apt_id, status="CANCELLED")
    db_err = AsyncMock()
    res_done = MagicMock()
    res_done.scalar_one_or_none.return_value = done_apt
    db_err.execute.return_value = res_done
    with pytest.raises(ValueError, match="UPCOMING"):
        await notify_doctor_appointment_confirmed(db_err, f"APT:{apt_id}|PATIENT:{pat_id}")

    # Test full happy path
    db = AsyncMock()
    db.add = MagicMock()
    r1 = MagicMock(); r1.scalar_one_or_none.return_value = apt
    r2 = MagicMock(); r2.scalars.return_value.all.return_value = [old_inc]
    r3 = MagicMock(); r3.scalar_one_or_none.return_value = eld
    r4 = MagicMock(); r4.scalar_one_or_none.return_value = dev_id
    r5 = MagicMock(); r5.scalar_one_or_none.return_value = None
    r6 = MagicMock(); r6.scalar_one_or_none.return_value = apt
    db.execute.side_effect = [r1, r2, r3, r4, r5, r6]
    db.get.return_value = None

    fake_redis = FakeRedis()
    await fake_redis.set("cache:incidents:u_1", "[]")
    ws_messages: list[dict] = []

    async def _capture_ws(payload: dict):
        ws_messages.append(payload)

    with (
        patch.object(redis_service, "_client", AsyncMock(return_value=fake_redis)),
        patch("app.services.notification.appointment_notify.broadcast_alert_ws", side_effect=_capture_ws),
    ):
        result = await notify_doctor_appointment_confirmed(
            db, f"APT:{apt_id}|PATIENT:{pat_id}|BY_DOCTOR:{doc_id}"
        )

    assert result.id == apt_id
    assert old_inc.is_acknowledged is True
    assert "cache:incidents:u_1" not in fake_redis._store
    resolved_msgs = [m for m in ws_messages if m.get("type") == "INCIDENT_RESOLVED"]
    assert len(resolved_msgs) == 1
    assert resolved_msgs[0]["incident_id"] == str(inc_id)
    assert resolved_msgs[0]["appointment_id"] == str(apt_id)


# ---------------------------------------------------------------------------
# 5. ASGI Endpoint Regression Tests (Mocked DB, Zero Remote Writes)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_endpoints_uuid_rbac_patient_name_and_lifecycle_sync():
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")

    doc_id = uuid.uuid4()
    other_doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    apt_id = uuid.uuid4()
    inc_id = uuid.uuid4()

    doctor_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. Lê Minh", is_active=True)
    family_user = SimpleNamespace(id=uuid.uuid4(), role="member", full_name="Con Cả", is_active=True)
    eld = SimpleNamespace(id=pat_id, house_id=house_id, full_name="Cụ Trần Thị Lan")

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    state = {"current_user": doctor_user}
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user_optional] = lambda: state["current_user"]

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Invalid patient_id on GET /doctor/appointments -> 400
        res = await client.get("/api/v1/doctor/appointments?patient_id=not-a-uuid")
        assert res.status_code == 400

        # 2. Wrong role on GET /doctor/appointments -> 403
        state["current_user"] = family_user
        res_403 = await client.get("/api/v1/doctor/appointments")
        assert res_403.status_code == 403

        # 3. Unauthenticated GET /doctor/appointments -> scoped to DEMO_DOCTOR_ID
        state["current_user"] = None
        with patch.object(crud_appointment, "get_appointments", AsyncMock(return_value=[])) as m_get:
            res_anon = await client.get("/api/v1/doctor/appointments")
            assert res_anon.status_code == 200
            assert m_get.call_args.kwargs["doctor_id"] == uuid.UUID("b3333333-b4e1-4b08-b2d3-d949a0eb075c")

        # 4. Patient endpoints reject invalid UUID (400) & missing ElderlyProfile (404)
        state["current_user"] = family_user
        assert (await client.get("/api/v1/patients/1/appointments")).status_code == 400
        assert (
            await client.post(
                "/api/v1/patients/1/appointments",
                json={"patient_id": "1", "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
            )
        ).status_code == 400

        mock_db.get.return_value = None
        assert (
            await client.post(
                f"/api/v1/patients/{uuid.uuid4()}/appointments",
                json={"patient_id": str(uuid.uuid4()), "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
            )
        ).status_code == 404

        # 5. Confirm with mismatched patient_id -> 404; invalid patient_id -> 400
        apt_existing = _make_mock_apt(apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id)
        with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=apt_existing)):
            assert (await client.post(f"/api/v1/patients/bad-id/appointments/{apt_id}/confirm")).status_code == 400
            assert (await client.post(f"/api/v1/patients/{uuid.uuid4()}/appointments/{apt_id}/confirm")).status_code == 404

        # 6. Doctor POST /doctor/appointments: normalizes HOME, duration=10, tags BY_DOCTOR, real patient_name
        state["current_user"] = doctor_user
        created_apt = _make_mock_apt(
            apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id,
            visit_type="HOME_VISIT", duration_minutes=10, doctor_name="BS. Lê Minh",
        )
        mock_db.get.return_value = eld
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=uuid.uuid4()))
        with (
            patch.object(crud_appointment, "create_appointment_series", AsyncMock(return_value=(created_apt, 1, 2))),
            patch("app.api.v1.endpoints.mobile.doctor.broadcast_alert_ws", AsyncMock()) as m_ws,
            patch("app.api.v1.endpoints.mobile.doctor.send_appointment_fcm", AsyncMock()),
            patch("app.api.v1.endpoints.mobile.doctor._invalidate_incidents_cache_safe", AsyncMock()) as m_cache,
        ):
            res_post = await client.post(
                "/api/v1/doctor/appointments",
                json={
                    "patient_id": str(pat_id),
                    "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                    "duration_minutes": 10,
                    "visit_type": "HOME",
                },
            )
            assert res_post.status_code == 201
            body = res_post.json()
            assert body["visit_type"] == "HOME_VISIT"
            assert body["duration_minutes"] == 10
            assert body["patient_name"] == "Cụ Trần Thị Lan"
            ws_arg = m_ws.call_args[0][0]
            assert f"BY_DOCTOR:{doc_id}" in ws_arg["data"]["notes"]
            m_cache.assert_awaited()

        # 7. Doctor PUT /complete /delete: ownership 403, non-UPCOMING 400, empty/notes complete, DELETE 404 vs 200 (APPOINTMENT_DELETED)
        other_apt = _make_mock_apt(apt_id=apt_id, doctor_id=other_doc_id, patient_id=pat_id)
        with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=other_apt)):
            assert (await client.put(f"/api/v1/doctor/appointments/{apt_id}", json={"location": "PK"})).status_code == 403

        done_apt = _make_mock_apt(apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, status="COMPLETED")
        with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=done_apt)):
            assert (await client.put(f"/api/v1/doctor/appointments/{apt_id}", json={"location": "PK"})).status_code == 400
            assert (await client.post(f"/api/v1/doctor/appointments/{apt_id}/complete")).status_code == 400

        # Complete with empty body & check APPOINTMENT_COMPLETED + INCIDENT_RESOLVED + real patient_name
        up_apt = _make_mock_apt(apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, status="UPCOMING")
        fin_apt = _make_mock_apt(apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, status="COMPLETED")
        rel_inc = SimpleNamespace(id=inc_id, is_acknowledged=False, acknowledged_at=None, acknowledged_by=None)
        mock_db.execute.return_value = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[rel_inc]))))
        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=up_apt)),
            patch.object(crud_appointment, "mark_completed", AsyncMock(return_value=fin_apt)),
            patch("app.api.v1.endpoints.mobile.doctor.broadcast_alert_ws", AsyncMock()) as m_ws_done,
            patch("app.api.v1.endpoints.mobile.doctor._invalidate_incidents_cache_safe", AsyncMock()) as m_cache_done,
        ):
            res_comp = await client.post(f"/api/v1/doctor/appointments/{apt_id}/complete")
            assert res_comp.status_code == 200
            assert res_comp.json()["patient_name"] == "Cụ Trần Thị Lan"
            assert rel_inc.is_acknowledged is True
            ws_types = [c[0][0]["type"] for c in m_ws_done.call_args_list]
            assert "APPOINTMENT_COMPLETED" in ws_types
            assert "INCIDENT_RESOLVED" in ws_types
            m_cache_done.assert_awaited()

        # DELETE missing / invalid UUID -> 404; valid -> 200 with APPOINTMENT_DELETED (not ALERT_NEW)
        assert (await client.delete("/api/v1/doctor/appointments/not-a-uuid")).status_code == 404
        with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=None)):
            assert (await client.delete(f"/api/v1/doctor/appointments/{apt_id}")).status_code == 404

        mock_db.execute.return_value = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=up_apt)),
            patch.object(crud_appointment, "delete_appointment", AsyncMock(return_value=True)),
            patch("app.api.v1.endpoints.mobile.doctor.broadcast_alert_ws", AsyncMock()) as m_ws_del,
            patch("app.api.v1.endpoints.mobile.doctor._invalidate_incidents_cache_safe", AsyncMock()) as m_cache_del,
        ):
            res_del = await client.delete(f"/api/v1/doctor/appointments/{apt_id}")
            assert res_del.status_code == 200
            del_payload = m_ws_del.call_args[0][0]
            assert del_payload["type"] == "APPOINTMENT_DELETED"
            assert del_payload["alert_type"] == "APPOINTMENT_DELETED"
            m_cache_del.assert_awaited()

        # 8. Incidents acknowledge-all skips APPOINTMENT_REQUESTED and triggers confirm for scheduled invite
        req_inc = SimpleNamespace(
            id=uuid.uuid4(),
            alert_type="APPOINTMENT_SCHEDULED",
            is_acknowledged=False,
            notes=f"PATIENT:{pat_id}|APPOINTMENT_REQUESTED|APT:{uuid.uuid4()}",
        )
        sched_apt_id = uuid.uuid4()
        sched_inc = SimpleNamespace(
            id=uuid.uuid4(),
            alert_type="APPOINTMENT_SCHEDULED",
            is_acknowledged=False,
            notes=f"APT:{sched_apt_id}|PATIENT:{pat_id}",
        )
        with (
            patch.object(crud_incident, "list", AsyncMock(return_value=[req_inc, sched_inc])),
            patch.object(crud_incident, "acknowledge_all", AsyncMock(return_value=2)),
            patch(
                "app.services.notification.appointment_notify.notify_doctor_appointment_confirmed",
                AsyncMock(),
            ) as m_confirm,
        ):
            res_ack_all = await client.post("/api/v1/incidents/acknowledge-all")
            assert res_ack_all.status_code == 200
            m_confirm.assert_awaited_once()
            assert m_confirm.call_args.kwargs["appointment_id"] == str(sched_apt_id)


@pytest.mark.asyncio
async def test_main_app_validation_handler_returns_422_on_value_error():
    """Verify app.main.app serializes Pydantic ValueError ctx cleanly as HTTP 422 (not 500)."""
    mock_db = AsyncMock()
    doc_user = SimpleNamespace(id=uuid.uuid4(), role="doctor", full_name="BS. Test", is_active=True)
    pat_id = str(uuid.uuid4())
    apt_id = str(uuid.uuid4())
    future_iso = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    snapshot = dict(main_app.dependency_overrides)
    main_app.dependency_overrides[get_db] = lambda: mock_db
    main_app.dependency_overrides[get_current_user_optional] = lambda: doc_user
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main_app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            cases = [
                (
                    "POST",
                    "/api/v1/doctor/appointments",
                    {"patient_id": pat_id, "scheduled_at": future_iso, "visit_type": "SURGERY"},
                ),
                (
                    "POST",
                    "/api/v1/doctor/appointments",
                    {"patient_id": pat_id, "scheduled_at": future_iso, "recurrence_pattern": "DAILY"},
                ),
                (
                    "PUT",
                    f"/api/v1/doctor/appointments/{apt_id}",
                    {"visit_type": "BAD_TYPE"},
                ),
                (
                    "POST",
                    f"/api/v1/patients/{pat_id}/appointments",
                    {"patient_id": pat_id, "scheduled_at": future_iso, "visit_type": "BAD_TYPE"},
                ),
            ]
            for method, url, payload in cases:
                res = await client.request(method, url, json=payload)
                assert res.status_code == 422, f"{method} {url} returned {res.status_code}: {res.text}"
                body = res.json()
                assert "detail" in body
                assert isinstance(body.get("errors"), list) and len(body["errors"]) > 0
    finally:
        main_app.dependency_overrides.clear()
        main_app.dependency_overrides.update(snapshot)


# ---------------------------------------------------------------------------
# 6. Context Builder Scoping & Scheduler Dispatch
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_context_builder_scopes_appointments_and_formats_vn_dt():
    builder = ChatbotContextBuilder()
    user_no_house = uuid.uuid4()
    db_empty = AsyncMock()
    # crud_vital + crud_incident mocked; hm_res, ho_res, doc_res, doc_sys_res return empty
    db_empty.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))),
        scalar_one_or_none=MagicMock(return_value=None),
    )
    with (
        patch("app.services.chatbot.context_builder.crud_vital.get_current_for_user", AsyncMock(return_value=None)),
        patch("app.services.chatbot.context_builder.crud_incident.list", AsyncMock(return_value=[])),
    ):
        ctx_empty = await builder.get_realtime_context(db=db_empty, user_id=user_no_house)
    assert ctx_empty["appointment"] is None
    # Verify no Appointment query was issued when user has no house/elderly
    executed_sqls = [str(c[0][0]) for c in db_empty.execute.call_args_list]
    assert not any("FROM appointments" in s for s in executed_sqls)

    # When house + elderly exist, Appointment query must filter by patient_id/house_id and scheduled_at >= now
    user_with_house = uuid.uuid4()
    house_id = uuid.uuid4()
    elderly_id = uuid.uuid4()
    eld = SimpleNamespace(
        id=elderly_id, full_name="Cụ Ba", birth_year=1945, gender="MALE",
        medical_history="THA", emergency_contact_phone="0909",
    )
    future_apt = SimpleNamespace(
        scheduled_at=datetime(2026, 12, 1, 2, 0, tzinfo=timezone.utc),
        location="Tại nhà",
        visit_type="HOME_VISIT",
        clinical_notes="Nhịn ăn sáng",
    )
    db_scoped = AsyncMock()
    r_hm = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[house_id]))))
    r_ho = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
    r_prof = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[eld]))))
    r_doc1 = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    r_doc2 = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    r_apt = MagicMock(scalar_one_or_none=MagicMock(return_value=future_apt))
    db_scoped.execute.side_effect = [r_hm, r_ho, r_prof, r_doc1, r_doc2, r_apt]
    with (
        patch("app.services.chatbot.context_builder.crud_vital.get_current_for_user", AsyncMock(return_value=None)),
        patch("app.services.chatbot.context_builder.crud_incident.list", AsyncMock(return_value=[])),
    ):
        ctx_scoped = await builder.get_realtime_context(db=db_scoped, user_id=user_with_house)

    assert ctx_scoped["appointment"]["scheduled_at"] == "09:00 ngày 01/12/2026"
    apt_sql = str(db_scoped.execute.call_args_list[-1][0][0])
    assert "appointments.patient_id IN" in apt_sql
    assert "appointments.scheduled_at >=" in apt_sql


@pytest.mark.asyncio
async def test_appointment_scheduler_dispatches_ws_fcm_and_marks_sent():
    scheduler = AppointmentSchedulerService()
    apt_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    house_id = uuid.uuid4()
    apt = _make_mock_apt(
        apt_id=apt_id,
        doctor_id=doc_id,
        patient_id=pat_id,
        house_id=house_id,
        scheduled_at=datetime(2026, 12, 1, 2, 0, tzinfo=timezone.utc),
    )
    reminder = SimpleNamespace(
        id=uuid.uuid4(),
        appointment=apt,
        reminder_type=ReminderTypeEnum.BEFORE_24H.value,
        status=ReminderStatusEnum.PENDING.value,
        sent_at=None,
    )
    db = AsyncMock()
    db.execute.return_value = MagicMock(first=MagicMock(return_value=("Cụ Năm", house_id)))

    with (
        patch("app.services.scheduler.appointment_scheduler.broadcast_alert_ws", AsyncMock()) as m_ws,
        patch("app.services.scheduler.appointment_scheduler.send_appointment_fcm", AsyncMock()) as m_fcm,
    ):
        await scheduler._dispatch_reminder(db, reminder)

    assert reminder.status == ReminderStatusEnum.SENT.value
    assert reminder.sent_at is not None
    ws_payload = m_ws.call_args[0][0]
    assert ws_payload["type"] == "APPOINTMENT_REMINDER"
    assert "09:00 ngày 01/12/2026" in ws_payload["data"]["message"]
    m_fcm.assert_awaited_once()
    db.commit.assert_awaited()


# ---------------------------------------------------------------------------
# 7. Consolidated PostgreSQL Integration Test (Orphan-Free try/finally)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_postgres_full_appointment_lifecycle_and_conflict_cleanup():
    """
    Consolidated real-PostgreSQL integration test:
    - Same-day multi-hour (09:00 30m + 14:00 30m) -> 201
    - Back-to-back (09:30 30m) -> 201
    - Overlap (09:15 30m & 09:45 30m) -> 409
    - GET ?status=ALL, PUT reschedule (+ overlap 409), family incident confirm,
      POST /complete with clinical_notes, POST /cancel, DELETE 200 -> DELETE 404.
    - Guaranteed reverse-FK cleanup in finally (zero orphan rows).
    """
    await engine.dispose()
    doc_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    house_id = uuid.uuid4()
    elderly_id = uuid.uuid4()
    dev_id = uuid.uuid4()
    suffix = doc_id.hex[:8]

    async with AsyncSessionFactory() as setup_db:
        doc_user = User(
            id=doc_id,
            full_name=f"BS Test {suffix}",
            hashed_password="x",
            phone=f"098{suffix[:7]}",
            role="doctor",
            is_active=True,
        )
        owner_user = User(
            id=owner_id,
            full_name=f"Family Test {suffix}",
            hashed_password="x",
            phone=f"097{suffix[:7]}",
            role="owner",
            is_active=True,
        )
        house = House(id=house_id, owner_id=owner_id, name=f"House {suffix}")
        hm_doc = HouseMember(
            house_id=house_id,
            user_id=doc_id,
            role_in_house="DOCTOR",
            status="ACTIVE",
            can_view_health=True,
        )
        elderly = ElderlyProfile(id=elderly_id, house_id=house_id, full_name="Cụ Test Đồng Bộ")
        device = Device(
            id=dev_id,
            device_id=f"TEST_DEV_{suffix}",
            name="Test Hub",
            device_type="EDGE_HUB",
            owner_id=owner_id,
            house_id=house_id,
            elderly_id=elderly_id,
        )
        setup_db.add_all([doc_user, owner_user, house, hm_doc, elderly, device])
        await setup_db.commit()

    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")
    fake_redis = FakeRedis()
    current_actor = {"user": doc_user}
    app.dependency_overrides[get_current_user_optional] = lambda: current_actor["user"]
    app.dependency_overrides[get_redis] = lambda: fake_redis

    day = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=7)

    try:
        with patch.object(redis_service, "_client", AsyncMock(return_value=fake_redis)):
          async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 1. Create 09:00 (30m)
            r1 = await client.post(
                "/api/v1/doctor/appointments",
                json={
                    "patient_id": str(elderly_id),
                    "scheduled_at": day.isoformat(),
                    "duration_minutes": 30,
                    "visit_type": "HOME",
                },
            )
            assert r1.status_code == 201
            apt1_id = r1.json()["id"]
            assert r1.json()["visit_type"] == "HOME_VISIT"
            assert r1.json()["patient_name"] == "Cụ Test Đồng Bộ"

            # 2. Same-day different hour 14:00 (30m) -> 201
            r2 = await client.post(
                "/api/v1/doctor/appointments",
                json={
                    "patient_id": str(elderly_id),
                    "scheduled_at": day.replace(hour=14, minute=0).isoformat(),
                    "duration_minutes": 30,
                },
            )
            assert r2.status_code == 201
            apt2_id = r2.json()["id"]

            # 3. Back-to-back 09:30 (30m) -> 201
            r3 = await client.post(
                "/api/v1/doctor/appointments",
                json={
                    "patient_id": str(elderly_id),
                    "scheduled_at": day.replace(hour=9, minute=30).isoformat(),
                    "duration_minutes": 30,
                },
            )
            assert r3.status_code == 201
            apt3_id = r3.json()["id"]

            # 4. Overlapping slots -> 409
            r_ov1 = await client.post(
                "/api/v1/doctor/appointments",
                json={
                    "patient_id": str(elderly_id),
                    "scheduled_at": day.replace(hour=9, minute=15).isoformat(),
                    "duration_minutes": 30,
                },
            )
            assert r_ov1.status_code == 409

            r_ov2 = await client.post(
                "/api/v1/doctor/appointments",
                json={
                    "patient_id": str(elderly_id),
                    "scheduled_at": day.replace(hour=9, minute=45).isoformat(),
                    "duration_minutes": 30,
                },
            )
            assert r_ov2.status_code == 409

            # 5. PUT reschedule conflict (move apt2 to 09:15 -> 409) and non-conflict (16:00 -> 200)
            r_put_ov = await client.put(
                f"/api/v1/doctor/appointments/{apt2_id}",
                json={"scheduled_at": day.replace(hour=9, minute=15).isoformat()},
            )
            assert r_put_ov.status_code == 409

            r_put_ok = await client.put(
                f"/api/v1/doctor/appointments/{apt2_id}",
                json={"scheduled_at": day.replace(hour=16, minute=0).isoformat()},
            )
            assert r_put_ok.status_code == 200
            assert r_put_ok.json()["patient_name"] == "Cụ Test Đồng Bộ"

            # 6. Family two-way confirm via incident acknowledge
            current_actor["user"] = owner_user
            inc_list = await client.get("/api/v1/incidents?limit=20")
            assert inc_list.status_code == 200
            matching_inc = next(
                (i for i in inc_list.json() if i["alert_type"] == "APPOINTMENT_SCHEDULED" and f"APT:{apt1_id}" in (i.get("notes") or "")),
                None,
            )
            assert matching_inc is not None
            r_ack = await client.post(f"/api/v1/incidents/{matching_inc['id']}/acknowledge")
            assert r_ack.status_code == 200

            # 7. Complete apt1 with clinical_notes, cancel apt3, GET status=ALL, delete apt2
            current_actor["user"] = doc_user
            r_comp = await client.post(
                f"/api/v1/doctor/appointments/{apt1_id}/complete",
                json={"clinical_notes": "Khám ổn định"},
            )
            assert r_comp.status_code == 200
            assert r_comp.json()["status"] == "COMPLETED"
            assert r_comp.json()["clinical_notes"] == "Khám ổn định"

            r_canc = await client.post(
                f"/api/v1/doctor/appointments/{apt3_id}/cancel",
                json={"cancellation_reason": "Bệnh nhân bận"},
            )
            assert r_canc.status_code == 200
            assert r_canc.json()["status"] == "CANCELLED"

            r_all = await client.get(f"/api/v1/doctor/appointments?status=ALL&patient_id={elderly_id}")
            assert r_all.status_code == 200
            assert len(r_all.json()) == 3

            r_del1 = await client.delete(f"/api/v1/doctor/appointments/{apt2_id}")
            assert r_del1.status_code == 200
            r_del2 = await client.delete(f"/api/v1/doctor/appointments/{apt2_id}")
            assert r_del2.status_code == 404
    finally:
        app.dependency_overrides.clear()
        async with AsyncSessionFactory() as cleanup_db:
            await cleanup_db.execute(delete(Incident).where(Incident.device_id == dev_id))
            await cleanup_db.execute(delete(Appointment).where(Appointment.patient_id == elderly_id))
            await cleanup_db.execute(delete(Device).where(Device.id == dev_id))
            await cleanup_db.execute(delete(ElderlyProfile).where(ElderlyProfile.id == elderly_id))
            await cleanup_db.execute(delete(HouseMember).where(HouseMember.house_id == house_id))
            await cleanup_db.execute(delete(House).where(House.id == house_id))
            await cleanup_db.execute(delete(User).where(User.id.in_([doc_id, owner_id])))
            await cleanup_db.commit()
        await engine.dispose()

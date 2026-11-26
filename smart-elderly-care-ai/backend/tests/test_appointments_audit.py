"""
test_appointments_audit.py – Isolated, zero-AWS-DB audit test suite for R3/R4 appointment fixes.

Covers:
1. Past-date rejection (scheduled_at <= now) in create_appointment_series, update_appointment, and HTTP endpoints.
2. Doctor notification message mapping using exam_type or Vietnamese visit_type (never raw HOME_VISIT/CLINIC).
3. POST /doctor/appointments persisting/returning exam_type, instructions, created_by, and created_appointments
   for recurring series while keeping top-level "id" backward-compatible.
4. Doctor-household assignment enforcement (403 unassigned / 201 assigned) and admin doctor validation (400 vs 201).
5. APPOINTMENT_RESCHEDULED incident acknowledgement & confirmation sync in appointment_notify.py and incidents.py.
6. VoiceReminderSchedulerService._get_redis_safe() awaiting get_redis() cleanly with zero RuntimeWarning.
7. Patients R3 endpoints: GET /patients/{id}/appointments/busy-slots (PII-free),
   PUT /patients/{id}/appointments/{apt_id}, and POST /patients/{id}/appointments/{apt_id}/cancel.
"""

from datetime import datetime, timedelta, timezone
import gc
from types import SimpleNamespace
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
import warnings

from fastapi import FastAPI
import httpx
import pytest

from app.api.deps import get_current_user_optional
from app.api.v1.api import api_router
from app.core.database import get_db
from app.crud import crud_house
from app.crud.crud_appointment import crud_appointment
from app.crud.crud_incident import crud_incident
from app.models.appointment import Appointment
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House
from app.models.incident import Incident
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate
from app.services.notification.appointment_notify import notify_doctor_appointment_confirmed
from app.services.scheduler.voice_reminder_scheduler import VoiceReminderSchedulerService


def _make_apt(
    *,
    apt_id: Optional[uuid.UUID] = None,
    doctor_id: Optional[uuid.UUID] = None,
    patient_id: Optional[uuid.UUID] = None,
    house_id: Optional[uuid.UUID] = None,
    created_by: Optional[uuid.UUID] = None,
    visit_type: str = "HOME_VISIT",
    scheduled_at: Optional[datetime] = None,
    duration_minutes: int = 30,
    exam_type: Optional[str] = None,
    instructions: Optional[str] = None,
    clinical_notes: Optional[str] = None,
    status: str = "UPCOMING",
    recurrence_pattern: str = "NONE",
    parent_recurring_id: Optional[uuid.UUID] = None,
    doctor_name: str = "BS. Trần Văn Minh",
):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=apt_id or uuid.uuid4(),
        doctor_id=doctor_id,
        doctor=SimpleNamespace(full_name=doctor_name) if doctor_id else None,
        patient_id=patient_id or uuid.uuid4(),
        house_id=house_id,
        created_by=created_by,
        visit_type=visit_type,
        scheduled_at=scheduled_at or (now + timedelta(days=1)),
        duration_minutes=duration_minutes,
        location="Tại nhà",
        exam_type=exam_type,
        instructions=instructions,
        clinical_notes=clinical_notes,
        status=status,
        cancellation_reason=None,
        recurrence_pattern=recurrence_pattern,
        parent_recurring_id=parent_recurring_id,
        enable_speaker_reminder=True,
        reminders=[],
        created_at=now,
        updated_at=now,
    )


def _build_test_app(mock_db: AsyncMock, state: dict) -> FastAPI:
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user_optional] = lambda: state["user"]
    return app


# ---------------------------------------------------------------------------
# 1. Past-Date Rejection (CRUD + HTTP)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_and_update_reject_past_scheduled_at():
    db = AsyncMock()
    past = datetime.now(timezone.utc) - timedelta(minutes=10)
    now_eq = datetime.now(timezone.utc)

    with pytest.raises(ValueError, match="tương lai"):
        await crud_appointment.create_appointment_series(
            db,
            AppointmentCreate(patient_id=str(uuid.uuid4()), scheduled_at=past),
            doctor_id=uuid.uuid4(),
        )

    with pytest.raises(ValueError, match="tương lai"):
        await crud_appointment.create_appointment_series(
            db,
            AppointmentCreate(patient_id=str(uuid.uuid4()), scheduled_at=now_eq),
            doctor_id=uuid.uuid4(),
        )

    upcoming = _make_apt(doctor_id=uuid.uuid4(), status="UPCOMING")
    with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=upcoming)):
        with pytest.raises(ValueError, match="tương lai"):
            await crud_appointment.update_appointment(
                db, upcoming.id, AppointmentUpdate(scheduled_at=past)
            )

    # HTTP 400 checks on doctor & patient endpoints
    doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    doc_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. A", is_active=True)
    fam_user = SimpleNamespace(id=uuid.uuid4(), role="owner", full_name="Chủ hộ", is_active=True)
    eld = SimpleNamespace(id=pat_id, house_id=house_id, full_name="Cụ An")
    house = SimpleNamespace(id=house_id, owner_id=fam_user.id)

    mock_db = AsyncMock()
    mock_db.get.side_effect = lambda model, _id: eld if model is ElderlyProfile else (house if model is House else None)
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=house_id))
    state = {"user": doc_user}
    app = _build_test_app(mock_db, state)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        r_doc_post = await client.post(
            "/api/v1/doctor/appointments",
            json={"patient_id": str(pat_id), "scheduled_at": past.isoformat()},
        )
        assert r_doc_post.status_code == 400
        assert "tương lai" in r_doc_post.json()["detail"].lower()

        with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=_make_apt(apt_id=upcoming.id, doctor_id=doc_id, patient_id=pat_id))):
            r_doc_put = await client.put(
                f"/api/v1/doctor/appointments/{upcoming.id}",
                json={"scheduled_at": past.isoformat()},
            )
            assert r_doc_put.status_code == 400
            assert "tương lai" in r_doc_put.json()["detail"].lower()

        state["user"] = fam_user
        mock_db.execute.return_value = MagicMock(
            scalar_one_or_none=MagicMock(return_value=SimpleNamespace(id=doc_id, full_name="BS. A"))
        )
        r_pat_post = await client.post(
            f"/api/v1/patients/{pat_id}/appointments",
            json={"patient_id": str(pat_id), "scheduled_at": past.isoformat()},
        )
        assert r_pat_post.status_code == 400
        assert "tương lai" in r_pat_post.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Doctor Notification Label Mapping (Never Raw Enum Codes)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_doctor_create_notification_uses_exam_type_or_vietnamese_visit_type():
    doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    dev_id = uuid.uuid4()
    doc_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. Minh", is_active=True)
    eld = SimpleNamespace(id=pat_id, house_id=house_id, full_name="Cụ Bình")

    cases = [
        ("HOME_VISIT", None, "Khám bệnh tại nhà"),
        ("CLINIC", None, "Khám tại phòng khám"),
        ("CLINIC", "Đo huyết áp định kỳ", "Đo huyết áp định kỳ"),
    ]

    for visit_type, exam_type, expected_label in cases:
        mock_db = AsyncMock()
        added_objs = []
        mock_db.add = MagicMock(side_effect=lambda obj: added_objs.append(obj))
        mock_db.get.return_value = eld
        # execute #1: doctor-house assignment -> house_id; execute #2: _resolve_device_id -> dev_id
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=house_id)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=dev_id)),
        ]
        created_apt = _make_apt(
            doctor_id=doc_id,
            patient_id=pat_id,
            house_id=house_id,
            created_by=doc_id,
            visit_type=visit_type,
            exam_type=exam_type,
            doctor_name="BS. Minh",
        )
        app = _build_test_app(mock_db, {"user": doc_user})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            with (
                patch.object(crud_appointment, "create_appointment_series", AsyncMock(return_value=(created_apt, 1, 2))),
                patch("app.api.v1.endpoints.mobile.doctor.broadcast_alert_ws", AsyncMock()) as m_ws,
                patch("app.api.v1.endpoints.mobile.doctor.send_appointment_fcm", AsyncMock()) as m_fcm,
                patch("app.api.v1.endpoints.mobile.doctor._invalidate_incidents_cache_safe", AsyncMock()),
            ):
                payload = {
                    "patient_id": str(pat_id),
                    "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                    "visit_type": visit_type,
                }
                if exam_type is not None:
                    payload["exam_type"] = exam_type
                res = await client.post("/api/v1/doctor/appointments", json=payload)

        assert res.status_code == 201
        inc_msg = next(o.message for o in added_objs if isinstance(o, Incident))
        ws_msg = m_ws.call_args[0][0]["data"]["message"]
        fcm_body = m_fcm.call_args.kwargs["body"]
        for text in (inc_msg, ws_msg, fcm_body):
            assert expected_label in text
            assert "HOME_VISIT" not in text
            assert "CLINIC" not in text


# ---------------------------------------------------------------------------
# 3. Persistence & Response of exam_type, instructions, created_by, created_appointments
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_recurring_series_persists_exam_fields_and_returns_created_appointments():
    doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    eld = SimpleNamespace(id=pat_id, house_id=house_id, full_name="Cụ Lan")

    # 3a. Verify CRUD layer persists exam_type & instructions on root + child ORM objects
    added_models = []

    def _track_add(obj):
        if isinstance(obj, Appointment) and not getattr(obj, "id", None):
            obj.id = uuid.uuid4()
            obj.doctor = None
            obj.reminders = []
        added_models.append(obj)

    crud_db = AsyncMock()
    crud_db.add = MagicMock(side_effect=_track_add)
    crud_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=eld)),  # ElderlyProfile lookup
        MagicMock(all=MagicMock(return_value=[])),  # root check_conflict
        MagicMock(all=MagicMock(return_value=[])),  # child check_conflict
    ]
    with patch.object(crud_appointment, "get_by_id", AsyncMock(side_effect=lambda _db, aid: next(o for o in added_models if isinstance(o, Appointment) and o.id == aid))):
        root_orm, total_created, _ = await crud_appointment.create_appointment_series(
            crud_db,
            AppointmentCreate(
                patient_id=str(pat_id),
                scheduled_at=datetime.now(timezone.utc) + timedelta(days=3),
                visit_type="CLINIC",
                exam_type="  Khám tim mạch  ",
                instructions="  Nhịn ăn sáng  ",
                recurrence_pattern="WEEKLY",
                recurrence_occurrences=2,
            ),
            doctor_id=doc_id,
            created_by=doc_id,
        )

    apts = [o for o in added_models if isinstance(o, Appointment)]
    assert total_created == 2
    assert len(apts) == 2
    assert root_orm.exam_type == "Khám tim mạch"
    assert apts[0].instructions == "Nhịn ăn sáng"
    assert apts[1].exam_type == "Khám tim mạch"
    assert apts[1].instructions == "Nhịn ăn sáng"
    assert apts[1].parent_recurring_id == apts[0].id

    # 3b. Verify POST /doctor/appointments returns top-level id + created_appointments list
    root_id = uuid.uuid4()
    child_id = uuid.uuid4()
    root_ns = _make_apt(
        apt_id=root_id,
        doctor_id=doc_id,
        patient_id=pat_id,
        house_id=house_id,
        created_by=doc_id,
        visit_type="CLINIC",
        exam_type="Khám tim mạch",
        instructions="Nhịn ăn sáng",
        recurrence_pattern="WEEKLY",
    )
    child_ns = _make_apt(
        apt_id=child_id,
        doctor_id=doc_id,
        patient_id=pat_id,
        house_id=house_id,
        created_by=doc_id,
        visit_type="CLINIC",
        scheduled_at=root_ns.scheduled_at + timedelta(days=7),
        exam_type="Khám tim mạch",
        instructions="Nhịn ăn sáng",
        recurrence_pattern="WEEKLY",
        parent_recurring_id=root_id,
    )

    doc_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. Lan", is_active=True)
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.get.return_value = eld
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=house_id)),  # doctor-house check
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),      # _resolve_device_id (house)
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),      # _resolve_device_id (fallback)
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[child_ns])))),  # children query
    ]
    app = _build_test_app(mock_db, {"user": doc_user})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with (
            patch.object(crud_appointment, "create_appointment_series", AsyncMock(return_value=(root_ns, 2, 4))),
            patch("app.api.v1.endpoints.mobile.doctor.send_appointment_fcm", AsyncMock()),
        ):
            res = await client.post(
                "/api/v1/doctor/appointments",
                json={
                    "patient_id": str(pat_id),
                    "scheduled_at": root_ns.scheduled_at.isoformat(),
                    "visit_type": "CLINIC",
                    "exam_type": "Khám tim mạch",
                    "instructions": "Nhịn ăn sáng",
                    "recurrence_pattern": "WEEKLY",
                    "recurrence_occurrences": 2,
                },
            )

    assert res.status_code == 201
    body = res.json()
    assert body["id"] == str(root_id)
    assert body["exam_type"] == "Khám tim mạch"
    assert body["instructions"] == "Nhịn ăn sáng"
    assert body["created_by"] == str(doc_id)
    assert isinstance(body["created_appointments"], list)
    assert [item["id"] for item in body["created_appointments"]] == [str(root_id), str(child_id)]
    assert all(item["created_appointments"] is None for item in body["created_appointments"])
    assert body["created_appointments"][1]["exam_type"] == "Khám tim mạch"


# ---------------------------------------------------------------------------
# 4. Doctor-Household Assignment & Admin Doctor Guard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_doctor_appointments_enforces_assignment_and_admin_doctor_guard():
    doc_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    target_doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    eld = SimpleNamespace(id=pat_id, house_id=house_id, full_name="Cụ Hòa")
    eld_no_house = SimpleNamespace(id=pat_id, house_id=None, full_name="Cụ Không Nhà")

    doc_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. Hòa", is_active=True)
    admin_user = SimpleNamespace(id=admin_id, role="admin", full_name="Admin", is_active=True)
    future_iso = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    state = {"user": doc_user}
    app = _build_test_app(mock_db, state)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Unassigned doctor (house_id exists, query returns None) -> 403
        mock_db.get.return_value = eld
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        r_unassigned = await client.post(
            "/api/v1/doctor/appointments",
            json={"patient_id": str(pat_id), "scheduled_at": future_iso},
        )
        assert r_unassigned.status_code == 403

        # Unassigned doctor (elderly has no house_id) -> 403
        mock_db.get.return_value = eld_no_house
        r_no_house = await client.post(
            "/api/v1/doctor/appointments",
            json={"patient_id": str(pat_id), "scheduled_at": future_iso},
        )
        assert r_no_house.status_code == 403

        # Assigned doctor -> 201
        mock_db.get.return_value = eld
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=house_id)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
        created_doc = _make_apt(doctor_id=doc_id, patient_id=pat_id, house_id=house_id, created_by=doc_id)
        with (
            patch.object(crud_appointment, "create_appointment_series", AsyncMock(return_value=(created_doc, 1, 2))),
            patch("app.api.v1.endpoints.mobile.doctor.send_appointment_fcm", AsyncMock()),
        ):
            r_assigned = await client.post(
                "/api/v1/doctor/appointments",
                json={"patient_id": str(pat_id), "scheduled_at": future_iso},
            )
            assert r_assigned.status_code == 201

        # Admin without doctor_id and no household doctor -> 400
        state["user"] = admin_user
        mock_db.execute.side_effect = None
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        r_admin_missing = await client.post(
            "/api/v1/doctor/appointments",
            json={"patient_id": str(pat_id), "scheduled_at": future_iso},
        )
        assert r_admin_missing.status_code == 400

        # Admin with invalid doctor_id -> 400
        r_admin_bad_doc = await client.post(
            "/api/v1/doctor/appointments",
            json={"patient_id": str(pat_id), "scheduled_at": future_iso, "doctor_id": str(target_doc_id)},
        )
        assert r_admin_bad_doc.status_code == 400

        # Admin with valid doctor_id -> 201 using target_doc_id
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=target_doc_id)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
        created_admin = _make_apt(doctor_id=target_doc_id, patient_id=pat_id, house_id=house_id, created_by=admin_id)
        with (
            patch.object(crud_appointment, "create_appointment_series", AsyncMock(return_value=(created_admin, 1, 2))) as m_create,
            patch("app.api.v1.endpoints.mobile.doctor.send_appointment_fcm", AsyncMock()),
        ):
            r_admin_ok = await client.post(
                "/api/v1/doctor/appointments",
                json={"patient_id": str(pat_id), "scheduled_at": future_iso, "doctor_id": str(target_doc_id)},
            )
            assert r_admin_ok.status_code == 201
            assert m_create.call_args.kwargs["doctor_id"] == target_doc_id
            assert m_create.call_args.kwargs["created_by"] == admin_id

        # Admin without doctor_id, household has assigned doctor -> 201
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=target_doc_id)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
        with (
            patch.object(crud_appointment, "create_appointment_series", AsyncMock(return_value=(created_admin, 1, 2))) as m_create_hh,
            patch("app.api.v1.endpoints.mobile.doctor.send_appointment_fcm", AsyncMock()),
        ):
            r_admin_hh = await client.post(
                "/api/v1/doctor/appointments",
                json={"patient_id": str(pat_id), "scheduled_at": future_iso},
            )
            assert r_admin_hh.status_code == 201
            assert m_create_hh.call_args.kwargs["doctor_id"] == target_doc_id


# ---------------------------------------------------------------------------
# 5. APPOINTMENT_RESCHEDULED Confirmation & Incident Ack Sync
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rescheduled_appointment_confirm_and_incident_ack_sync():
    apt_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    inc_id = uuid.uuid4()
    dev_id = uuid.uuid4()
    fam_user = SimpleNamespace(id=uuid.uuid4(), role="owner", full_name="Người nhà", is_active=True)

    apt = _make_apt(apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, status="UPCOMING")
    resched_inc = SimpleNamespace(
        id=inc_id,
        alert_type="APPOINTMENT_RESCHEDULED",
        notes=f"APT:{apt_id}|PATIENT:{pat_id}|BY_DOCTOR:{doc_id}",
        is_acknowledged=False,
        acknowledged_at=None,
        acknowledged_by=None,
    )
    eld = SimpleNamespace(id=pat_id, full_name="Cụ Phúc", house_id=house_id)

    db = AsyncMock()
    db.add = MagicMock()
    db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=apt)),
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[resched_inc])))),
        MagicMock(scalar_one_or_none=MagicMock(return_value=eld)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=dev_id)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=apt)),
    ]
    db.get.return_value = None

    ws_msgs = []
    with (
        patch("app.services.notification.appointment_notify._invalidate_incidents_cache_safe", AsyncMock()),
        patch("app.services.notification.appointment_notify.broadcast_alert_ws", AsyncMock(side_effect=lambda p: ws_msgs.append(p))),
    ):
        await notify_doctor_appointment_confirmed(db, str(apt_id), ack_user=fam_user)

    assert resched_inc.is_acknowledged is True
    assert resched_inc.acknowledged_by == fam_user.id
    inc_stmt = db.execute.call_args_list[1][0][0]
    inc_query_sql = str(inc_stmt.compile(compile_kwargs={"literal_binds": False}))
    inc_params = str(inc_stmt.compile().params)
    assert "incidents.alert_type IN" in inc_query_sql
    assert "APPOINTMENT_SCHEDULED" in inc_params
    assert "APPOINTMENT_RESCHEDULED" in inc_params
    assert any(m.get("type") == "INCIDENT_RESOLVED" and m.get("incident_id") == str(inc_id) for m in ws_msgs)

    # Verify incidents.py acknowledge & acknowledge-all trigger confirm for APPOINTMENT_RESCHEDULED
    ack_inc = SimpleNamespace(
        id=inc_id,
        device_id=dev_id,
        alert_type="APPOINTMENT_RESCHEDULED",
        alert_level="LOW",
        message="Bác sĩ đã dời lịch",
        is_acknowledged=True,
        acknowledged_at=datetime.now(timezone.utc),
        acknowledged_by=fam_user.id,
        acknowledged_by_name="Người nhà",
        detected_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        video_url=None,
        notes=f"APT:{apt_id}|PATIENT:{pat_id}|BY_DOCTOR:{doc_id}",
    )
    unack_resched = SimpleNamespace(
        id=uuid.uuid4(),
        alert_type="APPOINTMENT_RESCHEDULED",
        is_acknowledged=False,
        notes=f"APT:{apt_id}|PATIENT:{pat_id}|BY_DOCTOR:{doc_id}",
    )
    unack_requested = SimpleNamespace(
        id=uuid.uuid4(),
        alert_type="APPOINTMENT_RESCHEDULED",
        is_acknowledged=False,
        notes=f"PATIENT:{pat_id}|APPOINTMENT_REQUESTED|APT:{uuid.uuid4()}",
    )

    api_db = AsyncMock()
    app = _build_test_app(api_db, {"user": fam_user})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with (
            patch.object(crud_incident, "acknowledge", AsyncMock(return_value=ack_inc)),
            patch.object(crud_incident, "get", AsyncMock(return_value=ack_inc)),
            patch(
                "app.services.notification.appointment_notify.notify_doctor_appointment_confirmed",
                AsyncMock(),
            ) as m_conf_single,
        ):
            r_one = await client.post(f"/api/v1/incidents/{inc_id}/acknowledge")
            assert r_one.status_code == 200
            m_conf_single.assert_awaited_once()
            assert m_conf_single.call_args.kwargs["appointment_id"] == str(apt_id)

        with (
            patch.object(crud_incident, "list", AsyncMock(return_value=[unack_requested, unack_resched])),
            patch.object(crud_incident, "acknowledge_all", AsyncMock(return_value=2)),
            patch(
                "app.services.notification.appointment_notify.notify_doctor_appointment_confirmed",
                AsyncMock(),
            ) as m_conf_all,
        ):
            r_all = await client.post("/api/v1/incidents/acknowledge-all")
            assert r_all.status_code == 200
            m_conf_all.assert_awaited_once()
            assert m_conf_all.call_args.kwargs["appointment_id"] == str(apt_id)


# ---------------------------------------------------------------------------
# 6. VoiceReminderSchedulerService._get_redis_safe() Zero RuntimeWarning
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_voice_reminder_get_redis_safe_awaits_cleanly_without_runtime_warning():
    svc = VoiceReminderSchedulerService()
    fake_redis = object()

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        with patch(
            "app.services.scheduler.voice_reminder_scheduler.get_redis",
            new=AsyncMock(return_value=fake_redis),
        ):
            got = await svc._get_redis_safe()
        with patch(
            "app.services.scheduler.voice_reminder_scheduler.get_redis",
            new=AsyncMock(side_effect=RuntimeError("redis offline")),
        ):
            got_err = await svc._get_redis_safe()
        gc.collect()

    assert got is fake_redis
    assert got_err is None
    runtime_warnings = [w for w in caught if issubclass(w.category, RuntimeWarning)]
    assert runtime_warnings == [], f"Unexpected RuntimeWarning: {[str(w.message) for w in runtime_warnings]}"


# ---------------------------------------------------------------------------
# 7. Patients R3 Endpoints: busy-slots, family PUT reschedule, family POST cancel
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patients_busy_slots_pii_free_and_family_reschedule_cancel_guards():
    fam_id = uuid.uuid4()
    other_fam_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    apt_id = uuid.uuid4()

    fam_user = SimpleNamespace(id=fam_id, role="owner", full_name="Con Gái", is_active=True)
    stranger_user = SimpleNamespace(id=other_fam_id, role="member", full_name="Người Lạ", is_active=True)
    doc_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. Nam", is_active=True)
    eld = SimpleNamespace(id=pat_id, house_id=house_id, full_name="Cụ Thọ")
    house = SimpleNamespace(id=house_id, owner_id=fam_id)

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.get.side_effect = lambda model, _id: eld if model is ElderlyProfile else (house if model is House else None)
    state = {"user": fam_user}
    app = _build_test_app(mock_db, state)

    slot_time = datetime.now(timezone.utc) + timedelta(days=2)
    other_apt_id = uuid.uuid4()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 7a. busy-slots returns minimal PII-free slot items for authorized family
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=doc_user)),
            MagicMock(all=MagicMock(return_value=[(other_apt_id, slot_time, 45, "HOME_VISIT")])),
        ]
        r_slots = await client.get(f"/api/v1/patients/{pat_id}/appointments/busy-slots")
        assert r_slots.status_code == 200
        slots = r_slots.json()
        assert len(slots) == 1
        assert set(slots[0].keys()) == {"id", "scheduled_at", "duration_minutes", "visit_type"}
        assert slots[0]["id"] == str(other_apt_id)
        assert slots[0]["duration_minutes"] == 45
        assert slots[0]["visit_type"] == "HOME_VISIT"

        # Stranger without house membership -> 403
        state["user"] = stranger_user
        with patch.object(crud_house.crud_house, "get_member_by_user", AsyncMock(return_value=None)):
            r_slots_403 = await client.get(f"/api/v1/patients/{pat_id}/appointments/busy-slots")
            assert r_slots_403.status_code == 403

        # 7b. PUT reschedule & POST cancel block doctor-created appointments with 403
        state["user"] = fam_user
        doctor_created_apt = _make_apt(
            apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, created_by=doc_id
        )
        new_future = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        with patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=doctor_created_apt)):
            assert (
                await client.put(
                    f"/api/v1/patients/{pat_id}/appointments/{apt_id}",
                    json={"scheduled_at": new_future},
                )
            ).status_code == 403
            assert (
                await client.post(
                    f"/api/v1/patients/{pat_id}/appointments/{apt_id}/cancel",
                    json={"cancellation_reason": "Muốn hủy"},
                )
            ).status_code == 403

        # 7c. PUT reschedule on family-created appointment -> 200, conflict -> 409, past -> 400
        family_created_apt = _make_apt(
            apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, created_by=fam_id
        )
        updated_apt = _make_apt(
            apt_id=apt_id,
            doctor_id=doc_id,
            patient_id=pat_id,
            house_id=house_id,
            created_by=fam_id,
            scheduled_at=datetime.fromisoformat(new_future),
            clinical_notes="Đổi sang buổi chiều",
        )
        mock_db.execute.side_effect = None
        mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=family_created_apt)),
            patch.object(crud_appointment, "update_appointment", AsyncMock(return_value=updated_apt)),
            patch("app.services.notification.appointment_notify.broadcast_alert_ws", AsyncMock()) as m_ws_put,
            patch("app.services.notification.appointment_notify.send_appointment_fcm", AsyncMock()) as m_fcm_put,
        ):
            r_put_ok = await client.put(
                f"/api/v1/patients/{pat_id}/appointments/{apt_id}",
                json={"scheduled_at": new_future, "clinical_notes": "Đổi sang buổi chiều"},
            )
            assert r_put_ok.status_code == 200
            assert r_put_ok.json()["clinical_notes"] == "Đổi sang buổi chiều"
            assert m_ws_put.call_args[0][0]["type"] == "APPOINTMENT_RESCHEDULED"
            m_fcm_put.assert_awaited_once()

        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=family_created_apt)),
            patch.object(
                crud_appointment,
                "update_appointment",
                AsyncMock(side_effect=ValueError("Khung giờ này đã có lịch khám khác.")),
            ),
        ):
            r_put_409 = await client.put(
                f"/api/v1/patients/{pat_id}/appointments/{apt_id}",
                json={"scheduled_at": new_future},
            )
            assert r_put_409.status_code == 409

        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=family_created_apt)),
            patch.object(
                crud_appointment,
                "update_appointment",
                AsyncMock(side_effect=ValueError("Thời gian hẹn phải ở tương lai")),
            ),
        ):
            r_put_400 = await client.put(
                f"/api/v1/patients/{pat_id}/appointments/{apt_id}",
                json={"scheduled_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()},
            )
            assert r_put_400.status_code == 400

        # 7d. POST cancel on family-created appointment -> 200, acks incidents, notifies doctor
        cancelled_apt = _make_apt(
            apt_id=apt_id,
            doctor_id=doc_id,
            patient_id=pat_id,
            house_id=house_id,
            created_by=fam_id,
            status="CANCELLED",
        )
        cancelled_apt.cancellation_reason = "Bận đột xuất"
        rel_inc = SimpleNamespace(id=uuid.uuid4(), is_acknowledged=False, acknowledged_at=None, acknowledged_by=None)
        mock_db.execute.return_value = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[rel_inc]))))
        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=family_created_apt)),
            patch.object(crud_appointment, "cancel_appointment", AsyncMock(return_value=cancelled_apt)),
            patch("app.services.notification.appointment_notify.broadcast_alert_ws", AsyncMock()) as m_ws_cancel,
            patch("app.services.notification.appointment_notify.send_appointment_fcm", AsyncMock()) as m_fcm_cancel,
        ):
            r_cancel_ok = await client.post(
                f"/api/v1/patients/{pat_id}/appointments/{apt_id}/cancel",
                json={"cancellation_reason": "Bận đột xuất"},
            )
            assert r_cancel_ok.status_code == 200
            assert r_cancel_ok.json()["status"] == "CANCELLED"
            assert r_cancel_ok.json()["cancellation_reason"] == "Bận đột xuất"
            assert rel_inc.is_acknowledged is True
            assert m_ws_cancel.call_args[0][0]["type"] == "APPOINTMENT_CANCELLED"
            m_fcm_cancel.assert_awaited_once()


@pytest.mark.asyncio
async def test_doctor_can_update_and_complete_confirmed_appointment():
    doc_id = uuid.uuid4()
    pat_id = uuid.uuid4()
    house_id = uuid.uuid4()
    apt_id = uuid.uuid4()
    doc_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. Minh", is_active=True)

    confirmed_apt = _make_apt(
        apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, status="CONFIRMED"
    )
    completed_apt = _make_apt(
        apt_id=apt_id, doctor_id=doc_id, patient_id=pat_id, house_id=house_id, status="COMPLETED"
    )
    future_time = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    mock_db = AsyncMock()
    mock_db.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))),
        scalar_one_or_none=MagicMock(return_value=None),
    )
    mock_db.get.return_value = SimpleNamespace(id=pat_id, full_name="Cụ An", house_id=house_id)
    app = _build_test_app(mock_db, {"user": doc_user})

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=confirmed_apt)),
            patch.object(crud_appointment, "update_appointment", AsyncMock(return_value=confirmed_apt)),
            patch("app.api.v1.endpoints.mobile.doctor._resolve_patient_info", AsyncMock(return_value=("Cụ An", house_id))),
            patch("app.api.v1.endpoints.mobile.doctor._resolve_device_id", AsyncMock(return_value=None)),
            patch("app.api.v1.endpoints.mobile.doctor.broadcast_alert_ws", AsyncMock()),
            patch("app.api.v1.endpoints.mobile.doctor.send_appointment_fcm", AsyncMock()),
        ):
            r_put = await client.put(
                f"/api/v1/doctor/appointments/{apt_id}",
                json={"scheduled_at": future_time, "clinical_notes": "Dời lịch đã xác nhận"},
            )
            assert r_put.status_code == 200

        with (
            patch.object(crud_appointment, "get_by_id", AsyncMock(return_value=confirmed_apt)),
            patch.object(crud_appointment, "mark_completed", AsyncMock(return_value=completed_apt)),
            patch("app.api.v1.endpoints.mobile.doctor._resolve_patient_info", AsyncMock(return_value=("Cụ An", house_id))),
            patch("app.api.v1.endpoints.mobile.doctor.broadcast_alert_ws", AsyncMock()),
        ):
            r_comp = await client.post(
                f"/api/v1/doctor/appointments/{apt_id}/complete",
                json={"clinical_notes": "Khám xong"},
            )
            assert r_comp.status_code == 200
            assert r_comp.json()["status"] == "COMPLETED"


@pytest.mark.anyio
async def test_acknowledge_all_skips_house_invite_and_doctor_ack_skips_family_confirm():
    import uuid
    from app.api.v1.endpoints.mobile.incidents import acknowledge_incident

    doc_id = uuid.uuid4()
    db = AsyncMock()
    db.get.return_value = SimpleNamespace(id=doc_id, role="doctor")
    exec_res = MagicMock()
    exec_res.fetchall.return_value = []
    exec_res.rowcount = 1
    db.execute.return_value = exec_res

    await crud_incident.acknowledge_all(db, current_user_id=doc_id)
    update_sql = str(
        db.execute.call_args_list[-1].args[0].compile(compile_kwargs={"literal_binds": True})
    )
    assert "HOUSE_INVITE_PENDING" in update_sql

    inc_id = uuid.uuid4()
    doc_user = SimpleNamespace(id=doc_id, role="doctor", full_name="BS. Minh", phone="0909")
    sched_inc = SimpleNamespace(
        id=inc_id,
        device_id=uuid.uuid4(),
        alert_type="APPOINTMENT_SCHEDULED",
        alert_level="LOW",
        message="Lịch khám mới",
        notes=f"APT:{uuid.uuid4()}",
        is_acknowledged=True,
        acknowledged_by=doc_id,
        acknowledged_by_name="BS. Minh",
        acknowledged_at=datetime.now(timezone.utc),
    )
    mock_confirm = AsyncMock()
    with (
        patch.object(crud_incident, "acknowledge", AsyncMock(return_value=sched_inc)),
        patch("app.services.notification.appointment_notify.notify_doctor_appointment_confirmed", mock_confirm),
    ):
        bg = SimpleNamespace(add_task=lambda *a, **kw: None)
        res = await acknowledge_incident(
            incident_id=inc_id,
            background_tasks=bg,
            ack=None,
            note=None,
            db=db,
            current_user=doc_user,
        )
    assert res.id == inc_id
    mock_confirm.assert_not_awaited()

"""
Tier 1 — Opaque-Box Feature Coverage (65 Tests: 5 per Feature F1–F13).
Maps 1-to-1 to T1-F01-01 .. T1-F13-05 in the 4-Tier Spec Matrix.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.database import AsyncSessionFactory
from app.models.appointment import Appointment, AppointmentReminder
from app.models.incident import Incident
from app.services.chatbot.context_builder import ChatbotContextBuilder, _STATIC_CARE_CACHE
from app.services.scheduler.appointment_scheduler import AppointmentSchedulerService
from tests.e2e.conftest import (
    CLIENT_CONTRACTS_DIR,
    E2EEntities,
    FakeRedis,
    RecorderWS,
    run_node_test,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

VN_TZ = timezone(timedelta(hours=7))
DOCTOR_WEB_CONTRACTS = CLIENT_CONTRACTS_DIR / "doctor_web_contracts.test.cjs"
MOBILE_CONTRACTS = CLIENT_CONTRACTS_DIR / "mobile_contracts.test.cjs"


def _future_utc(days: int = 2, hour: int = 9, minute: int = 0) -> datetime:
    base = (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    return base


async def _create_apt(
    client,
    headers: dict,
    patient_id: uuid.UUID,
    scheduled_at: datetime | str,
    **extra,
):
    iso = scheduled_at.isoformat() if isinstance(scheduled_at, datetime) else scheduled_at
    payload = {
        "patient_id": str(patient_id),
        "scheduled_at": iso,
        "duration_minutes": extra.pop("duration_minutes", 30),
        "visit_type": extra.pop("visit_type", "CLINIC"),
        "location": extra.pop("location", "Phòng khám SECA"),
        **extra,
    }
    return await client.post("/api/v1/doctor/appointments", json=payload, headers=headers)


# ============================================================================
# Feature 1: Same-day non-overlapping multi-hour conflict check
# ============================================================================


async def test_t1_f01_01_same_day_different_hour_same_doctor_and_patient(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 9, 0))
    assert r1.status_code == 201, r1.text
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 14, 0))
    assert r2.status_code == 201, r2.text

    listed = await client.get(
        f"/api/v1/doctor/appointments?patient_id={e2e_entities.patient_id}",
        headers=e2e_entities.doctor_headers,
    )
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()}
    assert {r1.json()["id"], r2.json()["id"]}.issubset(ids)


async def test_t1_f01_02_same_day_different_patients_same_doctor(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 8, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(2, 10, 0))
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text
    assert r1.json()["id"] != r2.json()["id"]
    assert r1.json()["patient_id"] == str(e2e_entities.patient_id)
    assert r2.json()["patient_id"] == str(e2e_entities.patient2_id)


async def test_t1_f01_03_exact_overlap_rejected_with_409(
    client, e2e_entities: E2EEntities, clean_schedule
):
    slot = _future_utc(2, 9, 0)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    assert r1.status_code == 201
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, slot)
    assert r2.status_code == 409
    assert r2.json().get("detail")

    listed = await client.get("/api/v1/doctor/appointments", headers=e2e_entities.doctor_headers)
    assert len(listed.json()) == 1


async def test_t1_f01_04_different_doctors_different_patients_allowed_same_time(
    client, e2e_entities: E2EEntities, clean_schedule
):
    slot = _future_utc(2, 9, 0)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    r2 = await _create_apt(client, e2e_entities.doctor2_headers, e2e_entities.patient3_id, slot)
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text


async def test_t1_f01_05_reschedule_to_free_same_day_hour(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 9, 0))
    assert r1.status_code == 201
    new_slot = _future_utc(2, 16, 0)
    upd = await client.put(
        f"/api/v1/doctor/appointments/{r1.json()['id']}",
        json={"scheduled_at": new_slot.isoformat()},
        headers=e2e_entities.doctor_headers,
    )
    assert upd.status_code == 200, upd.text
    assert datetime.fromisoformat(upd.json()["scheduled_at"].replace("Z", "+00:00")) == new_slot


# ============================================================================
# Feature 2: Backend patient UUID validation & query scoping
# ============================================================================


async def test_t1_f02_01_valid_patient_uuid_scopes_doctor_list(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(3, 8, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(3, 10, 0))
    assert r1.status_code == 201 and r2.status_code == 201

    res = await client.get(
        f"/api/v1/doctor/appointments?patient_id={e2e_entities.patient_id}",
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["patient_id"] == str(e2e_entities.patient_id)


async def test_t1_f02_02_status_all_returns_all_statuses(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r_up = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(3, 8, 0))
    r_cmp = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(3, 10, 0))
    r_can = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(3, 12, 0))
    assert r_up.status_code == 201 and r_cmp.status_code == 201 and r_can.status_code == 201

    c1 = await client.post(f"/api/v1/doctor/appointments/{r_cmp.json()['id']}/complete", headers=e2e_entities.doctor_headers)
    c2 = await client.post(
        f"/api/v1/doctor/appointments/{r_can.json()['id']}/cancel",
        json={"cancellation_reason": "Bận đột xuất"},
        headers=e2e_entities.doctor_headers,
    )
    assert c1.status_code == 200 and c2.status_code == 200

    res = await client.get(
        f"/api/v1/doctor/appointments?status=ALL&patient_id={e2e_entities.patient_id}",
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 200
    statuses = {a["status"] for a in res.json()}
    assert statuses == {"UPCOMING", "COMPLETED", "CANCELLED"}


async def test_t1_f02_03_doctor_list_excludes_other_doctor_and_unowned_records(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r_doc2 = await _create_apt(client, e2e_entities.doctor2_headers, e2e_entities.patient3_id, _future_utc(3, 9, 0))
    assert r_doc2.status_code == 201
    async with AsyncSessionFactory() as db:
        orphan = Appointment(
            doctor_id=None,
            patient_id=e2e_entities.patient_id,
            house_id=e2e_entities.house_id,
            scheduled_at=_future_utc(3, 11, 0),
            duration_minutes=30,
            visit_type="CLINIC",
            location="Orphan",
            status="UPCOMING",
        )
        db.add(orphan)
        await db.commit()
        orphan_id = str(orphan.id)

    res = await client.get("/api/v1/doctor/appointments", headers=e2e_entities.doctor_headers)
    assert res.status_code == 200
    returned_ids = {a["id"] for a in res.json()}
    assert r_doc2.json()["id"] not in returned_ids
    assert orphan_id not in returned_ids


async def test_t1_f02_04_patient_get_appointments_scopes_strictly_to_patient_id(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(3, 9, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(3, 11, 0))
    assert r1.status_code == 201 and r2.status_code == 201

    res = await client.get(
        f"/api/v1/patients/{e2e_entities.patient_id}/appointments",
        headers=e2e_entities.family_headers,
    )
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["id"] == r1.json()["id"]
    assert items[0]["patient_id"] == str(e2e_entities.patient_id)


async def test_t1_f02_05_create_appointment_binds_house_id_from_patient(
    client, e2e_entities: E2EEntities, clean_schedule
):
    res = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(3, 14, 0))
    assert res.status_code == 201
    data = res.json()
    assert data["patient_id"] == str(e2e_entities.patient_id)
    assert data["house_id"] == str(e2e_entities.house_id)


# ============================================================================
# Feature 3: Backend patient_name & schema/status correctness
# ============================================================================


async def test_t1_f03_01_post_resolves_real_patient_name_when_omitted(
    client, e2e_entities: E2EEntities, clean_schedule
):
    res = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 9, 0))
    assert res.status_code == 201
    assert res.json()["patient_name"] == e2e_entities.patient_name


async def test_t1_f03_02_put_complete_cancel_and_patient_get_return_real_patient_name(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(4, 9, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(4, 14, 0))
    assert r1.status_code == 201 and r2.status_code == 201
    apt1_id, apt2_id = r1.json()["id"], r2.json()["id"]

    put_res = await client.put(
        f"/api/v1/doctor/appointments/{apt1_id}",
        json={"location": "Phòng khám 2"},
        headers=e2e_entities.doctor_headers,
    )
    assert put_res.status_code == 200
    assert put_res.json()["patient_name"] == e2e_entities.patient2_name

    cmp_res = await client.post(
        f"/api/v1/doctor/appointments/{apt1_id}/complete",
        headers=e2e_entities.doctor_headers,
    )
    assert cmp_res.status_code == 200
    assert cmp_res.json()["patient_name"] == e2e_entities.patient2_name

    can_res = await client.post(
        f"/api/v1/doctor/appointments/{apt2_id}/cancel",
        json={"cancellation_reason": "Bệnh nhân đổi lịch"},
        headers=e2e_entities.doctor_headers,
    )
    assert can_res.status_code == 200
    assert can_res.json()["patient_name"] == e2e_entities.patient2_name

    pat_get = await client.get(
        f"/api/v1/patients/{e2e_entities.patient2_id}/appointments?status=ALL",
        headers=e2e_entities.family_headers,
    )
    assert pat_get.status_code == 200
    assert all(a["patient_name"] == e2e_entities.patient2_name for a in pat_get.json())


async def test_t1_f03_03_complete_accepts_optional_clinical_notes(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 10, 0))
    assert r1.status_code == 201
    res = await client.post(
        f"/api/v1/doctor/appointments/{r1.json()['id']}/complete",
        json={"clinical_notes": "Huyết áp ổn định 120/80"},
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"
    assert "Huyết áp ổn định 120/80" in (res.json().get("clinical_notes") or "")


async def test_t1_f03_04_cancel_transitions_to_cancelled_with_reason(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 11, 0))
    assert r1.status_code == 201
    res = await client.post(
        f"/api/v1/doctor/appointments/{r1.json()['id']}/cancel",
        json={"cancellation_reason": "Bác sĩ công tác đột xuất"},
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED"
    assert res.json()["cancellation_reason"] == "Bác sĩ công tác đột xuất"


async def test_t1_f03_05_delete_removes_existing_appointment(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 12, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    del_res = await client.delete(f"/api/v1/doctor/appointments/{apt_id}", headers=e2e_entities.doctor_headers)
    assert del_res.status_code == 200
    assert del_res.json().get("success") is True

    put_res = await client.put(
        f"/api/v1/doctor/appointments/{apt_id}",
        json={"location": "Missing"},
        headers=e2e_entities.doctor_headers,
    )
    assert put_res.status_code == 404


# ============================================================================
# Feature 4: Backend two-way sync, Incident.notes & Redis cache
# ============================================================================


async def test_t1_f04_01_create_writes_incident_with_apt_token_and_invalidates_redis(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, clean_schedule
):
    prime = await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    assert prime.status_code == 200
    assert any(k.startswith("cache:incidents:") for k in await fake_redis.keys("cache:incidents:*"))

    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 9, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    inc_res = await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    assert inc_res.status_code == 200
    matching = [i for i in inc_res.json() if i["alert_type"] == "APPOINTMENT_SCHEDULED" and f"APT:{apt_id}" in (i.get("notes") or "")]
    assert len(matching) == 1


async def test_t1_f04_02_family_incident_ack_extracts_apt_uuid_and_emits_ws(
    client, e2e_entities: E2EEntities, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 10, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    inc_res = await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    inc = next(i for i in inc_res.json() if f"APT:{apt_id}" in (i.get("notes") or ""))
    inc_id = inc["id"]
    ws_recorder.messages.clear()

    ack_res = await client.post(
        f"/api/v1/incidents/{inc_id}/acknowledge",
        headers=e2e_entities.family_headers,
    )
    assert ack_res.status_code == 200

    apts = (await client.get(f"/api/v1/doctor/appointments?patient_id={e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    target = next(a for a in apts if a["id"] == apt_id)
    assert "[ĐÃ XÁC NHẬN ĐÓN TIẾP]" in (target.get("clinical_notes") or "")

    assert any(
        m.get("type") == "INCIDENT_RESOLVED" and m.get("incident_id") == str(inc_id)
        for m in ws_recorder.messages
    )
    assert any(
        m.get("alert_type") == "APPOINTMENT_CONFIRMED"
        for m in ws_recorder.messages
    )


async def test_t1_f04_03_put_reschedule_emits_ws_and_invalidates_redis(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 9, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    assert await fake_redis.keys("cache:incidents:*")
    ws_recorder.messages.clear()

    upd = await client.put(
        f"/api/v1/doctor/appointments/{apt_id}",
        json={"scheduled_at": _future_utc(5, 14, 0).isoformat()},
        headers=e2e_entities.doctor_headers,
    )
    assert upd.status_code == 200
    assert await fake_redis.keys("cache:incidents:*") == []
    assert any(
        (m.get("type") == "APPOINTMENT_RESCHEDULED" or m.get("alert_type") == "APPOINTMENT_RESCHEDULED")
        and (m.get("appointment_id") == apt_id or m.get("data", {}).get("appointment_id") == apt_id)
        for m in ws_recorder.messages
    )


async def test_t1_f04_04_complete_emits_ws_resolves_incident_and_invalidates_cache(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 11, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]
    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    ws_recorder.messages.clear()

    cmp_res = await client.post(
        f"/api/v1/doctor/appointments/{apt_id}/complete",
        headers=e2e_entities.doctor_headers,
    )
    assert cmp_res.status_code == 200
    assert await fake_redis.keys("cache:incidents:*") == []
    assert any(
        m.get("type") == "APPOINTMENT_COMPLETED" or m.get("alert_type") == "APPOINTMENT_COMPLETED"
        for m in ws_recorder.messages
    )

    inc_res = await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    related = [i for i in inc_res.json() if f"APT:{apt_id}" in (i.get("notes") or "")]
    assert related and all(i["is_acknowledged"] is True for i in related)


async def test_t1_f04_05_delete_emits_appointment_deleted_and_cleans_cache(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 13, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]
    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    ws_recorder.messages.clear()

    del_res = await client.delete(
        f"/api/v1/doctor/appointments/{apt_id}",
        headers=e2e_entities.doctor_headers,
    )
    assert del_res.status_code == 200
    assert await fake_redis.keys("cache:incidents:*") == []
    assert any(
        m.get("type") == "APPOINTMENT_DELETED" and m.get("alert_type") == "APPOINTMENT_DELETED"
        for m in ws_recorder.messages
    )


# ============================================================================
# Feature 5: Backend UTC+7 formatting, context builder & scheduler
# ============================================================================


async def test_t1_f05_01_doctor_notification_formats_scheduled_at_in_utc7(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        "2026-12-01T02:30:00Z",  # 09:30 UTC+7
    )
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    incs = (await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)).json()
    inc = next(i for i in incs if f"APT:{apt_id}" in (i.get("notes") or ""))
    assert "09:30 ngày 01/12/2026" in inc["message"]
    assert "02:30" not in inc["message"]


async def test_t1_f05_02_family_confirm_formats_scheduled_at_in_utc7(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        "2026-12-01T07:00:00Z",  # 14:00 UTC+7
    )
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    conf = await client.post(
        f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{apt_id}/confirm",
        headers=e2e_entities.family_headers,
    )
    assert conf.status_code == 200

    doc_incs = (await client.get("/api/v1/incidents", headers=e2e_entities.doctor_headers)).json()
    conf_inc = next(i for i in doc_incs if i["alert_type"] == "APPOINTMENT_CONFIRMED" and apt_id in (i.get("notes") or ""))
    assert "14:00 ngày 01/12/2026" in conf_inc["message"]


async def test_t1_f05_03_chatbot_context_builder_scopes_to_house_and_utc7(
    client, e2e_entities: E2EEntities, clean_schedule
):
    # House 2 has earlier apt (+1h); House 1 has apt at T+1d 01:00Z (08:00 VN)
    h2_apt = await _create_apt(
        client,
        e2e_entities.doctor2_headers,
        e2e_entities.patient3_id,
        datetime.now(timezone.utc) + timedelta(hours=1),
    )
    h1_slot = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=1, minute=0, second=0, microsecond=0)
    h1_apt = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, h1_slot)
    assert h2_apt.status_code == 201 and h1_apt.status_code == 201

    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    try:
        async with AsyncSessionFactory() as db:
            ctx = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    finally:
        _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)

    assert ctx["appointment"] is not None
    expected_vn = h1_slot.astimezone(VN_TZ).strftime("%H:%M ngày %d/%m/%Y")
    assert ctx["appointment"]["scheduled_at"] == expected_vn


async def test_t1_f05_04_appointment_scheduler_formats_utc7_and_marks_sent(
    client, e2e_entities: E2EEntities, caplog, clean_schedule
):
    apt_dt = (datetime.now(timezone.utc) + timedelta(hours=1)).replace(second=0, microsecond=0)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, apt_dt)
    assert r1.status_code == 201
    apt_uuid = uuid.UUID(r1.json()["id"])

    async with AsyncSessionFactory() as db:
        rem = AppointmentReminder(
            appointment_id=apt_uuid,
            reminder_type="BEFORE_2H",
            scheduled_time=datetime.now(timezone.utc) - timedelta(minutes=5),
            status="PENDING",
        )
        db.add(rem)
        await db.commit()
        rem_id = rem.id

    with caplog.at_level(logging.INFO, logger="appointment_scheduler"):
        await AppointmentSchedulerService().process_due_reminders()

    async with AsyncSessionFactory() as db:
        refreshed = await db.get(AppointmentReminder, rem_id)
        assert refreshed is not None
        assert refreshed.status == "SENT"
        assert refreshed.sent_at is not None

    expected_vn = apt_dt.astimezone(VN_TZ).strftime("%H:%M ngày %d/%m/%Y")
    assert expected_vn in caplog.text


async def test_t1_f05_05_crud_doctor_patient_detail_reads_next_appointment_from_db(
    client, e2e_entities: E2EEntities, clean_schedule
):
    slot = _future_utc(6, 2, 30)  # 09:30 VN
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    assert r1.status_code == 201

    res = await client.get(
        f"/api/v1/doctor/patients/{e2e_entities.patient_id}",
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 200
    next_apt = res.json().get("next_appointment")
    assert next_apt is not None
    expected_vn = slot.astimezone(VN_TZ).strftime("%H:%M ngày %d/%m/%Y")
    assert expected_vn in next_apt


# ============================================================================
# Feature 6: Backend lifecycle endpoint contracts
# ============================================================================


async def test_t1_f06_01_create_telehealth_appointment(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        _future_utc(7, 9, 0),
        visit_type="TELEHEALTH",
        location="Video Call SECA",
    )
    assert r1.status_code == 201
    assert r1.json()["visit_type"] == "TELEHEALTH"
    assert r1.json()["status"] == "UPCOMING"


async def test_t1_f06_02_weekly_recurring_series_creates_children_and_reminders(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        _future_utc(7, 9, 0),
        recurrence_pattern="WEEKLY",
        recurrence_occurrences=3,
    )
    assert r1.status_code == 201
    root_id = uuid.UUID(r1.json()["id"])

    async with AsyncSessionFactory() as db:
        apts = (
            await db.execute(
                select(Appointment).where(
                    (Appointment.id == root_id) | (Appointment.parent_recurring_id == root_id)
                )
            )
        ).scalars().all()
        assert len(apts) == 3
        rems = (
            await db.execute(
                select(AppointmentReminder).where(
                    AppointmentReminder.appointment_id.in_([a.id for a in apts])
                )
            )
        ).scalars().all()
        assert len(rems) >= 6  # 24h + 2h for each of 3 future occurrences


async def test_t1_f06_03_partial_put_preserves_scheduled_at_and_duration(
    client, e2e_entities: E2EEntities, clean_schedule
):
    slot = _future_utc(7, 10, 0)
    r1 = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        slot,
        duration_minutes=45,
    )
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    upd = await client.put(
        f"/api/v1/doctor/appointments/{apt_id}",
        json={"location": "Phòng khám B", "clinical_notes": "Mang kết quả XN"},
        headers=e2e_entities.doctor_headers,
    )
    assert upd.status_code == 200
    body = upd.json()
    assert body["location"] == "Phòng khám B"
    assert body["clinical_notes"] == "Mang kết quả XN"
    assert body["duration_minutes"] == 45
    assert datetime.fromisoformat(body["scheduled_at"].replace("Z", "+00:00")) == slot


async def test_t1_f06_04_family_request_appointment_creates_apt_and_incident(
    client, e2e_entities: E2EEntities, clean_schedule
):
    res = await client.post(
        f"/api/v1/patients/{e2e_entities.patient_id}/appointments",
        json={
            "patient_id": str(e2e_entities.patient_id),
            "scheduled_at": _future_utc(7, 14, 0).isoformat(),
            "visit_type": "HOME_VISIT",
            "location": "Tại nhà",
        },
        headers=e2e_entities.family_headers,
    )
    assert res.status_code == 201, res.text
    apt_id = res.json()["id"]
    assert res.json()["doctor_id"] == str(e2e_entities.doctor_id)
    assert res.json()["patient_name"] == e2e_entities.patient_name

    incs = (await client.get("/api/v1/incidents", headers=e2e_entities.doctor_headers)).json()
    assert any(f"APT:{apt_id}" in (i.get("notes") or "") and "APPOINTMENT_REQUESTED" in (i.get("notes") or "") for i in incs)


async def test_t1_f06_05_family_confirm_endpoint_updates_clinical_notes(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(7, 15, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    conf = await client.post(
        f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{apt_id}/confirm",
        headers=e2e_entities.family_headers,
    )
    assert conf.status_code == 200
    assert "[ĐÃ XÁC NHẬN ĐÓN TIẾP]" in (conf.json().get("clinical_notes") or "")


# ============================================================================
# Features 7–13: Doctor Web & Mobile Client Contracts (Tier 1)
# ============================================================================


@pytest.mark.parametrize(
    "pattern",
    [
        "^T1-F07-01 ",
        "^T1-F07-02 ",
        "^T1-F07-03 ",
        "^T1-F07-04 ",
        "^T1-F07-05 ",
        "^T1-F08-01 ",
        "^T1-F08-02 ",
        "^T1-F08-03 ",
        "^T1-F08-04 ",
        "^T1-F08-05 ",
        "^T1-F09-01 ",
        "^T1-F09-02 ",
        "^T1-F09-03 ",
        "^T1-F09-04 ",
        "^T1-F09-05 ",
        "^T1-F10-01 ",
        "^T1-F10-02 ",
        "^T1-F10-03 ",
        "^T1-F10-04 ",
        "^T1-F10-05 ",
        "^T1-F11-01 ",
        "^T1-F11-02 ",
        "^T1-F11-03 ",
        "^T1-F11-04 ",
        "^T1-F11-05 ",
    ],
)
def test_t1_doctor_web_contracts(pattern: str):
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern=pattern, tz="Asia/Ho_Chi_Minh")


@pytest.mark.parametrize(
    "pattern",
    [
        "^T1-F12-01 ",
        "^T1-F12-02 ",
        "^T1-F12-03 ",
        "^T1-F12-04 ",
        "^T1-F12-05 ",
        "^T1-F13-01 ",
        "^T1-F13-02 ",
        "^T1-F13-03 ",
        "^T1-F13-04 ",
        "^T1-F13-05 ",
    ],
)
def test_t1_mobile_contracts(pattern: str):
    run_node_test(MOBILE_CONTRACTS, filter_pattern=pattern, tz="Asia/Ho_Chi_Minh")

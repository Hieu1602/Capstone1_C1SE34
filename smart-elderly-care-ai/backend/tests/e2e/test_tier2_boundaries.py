"""
Tier 2 — Opaque-Box Boundary & Corner Cases (65 Tests: 5 per Feature F1–F13).
Maps 1-to-1 to T2-F01-01 .. T2-F13-05 in the 4-Tier Spec Matrix.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.api.websockets.vitals_ws import alert_clients
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

DOCTOR_WEB_CONTRACTS = CLIENT_CONTRACTS_DIR / "doctor_web_contracts.test.cjs"
MOBILE_CONTRACTS = CLIENT_CONTRACTS_DIR / "mobile_contracts.test.cjs"


def _future_utc(days: int = 2, hour: int = 9, minute: int = 0) -> datetime:
    return (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )


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
# Feature 1 Boundaries: Interval Overlap & Strict Inequalities
# ============================================================================


async def test_t2_f01_01_back_to_back_slots_allowed(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 9, 0), duration_minutes=30)
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 9, 30), duration_minutes=30)
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text


async def test_t2_f01_02_partial_overlap_inside_stored_60m_window_rejected(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 9, 0), duration_minutes=60)
    assert r1.status_code == 201
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(2, 9, 15), duration_minutes=30)
    assert r2.status_code == 409


async def test_t2_f01_03_cross_timezone_offset_vs_z_overlap_detected(
    client, e2e_entities: E2EEntities, clean_schedule
):
    # 2026-12-10T09:00:00+07:00 == 2026-12-10T02:00:00Z
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, "2026-12-10T09:00:00+07:00", duration_minutes=30)
    assert r1.status_code == 201
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, "2026-12-10T02:15:00Z", duration_minutes=30)
    assert r2.status_code == 409


async def test_t2_f01_04_cancelled_and_completed_do_not_block_same_slot(
    client, e2e_entities: E2EEntities, clean_schedule
):
    slot = _future_utc(2, 9, 0)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    assert r1.status_code == 201
    can = await client.post(
        f"/api/v1/doctor/appointments/{r1.json()['id']}/cancel",
        json={"cancellation_reason": "Hủy để đặt lại"},
        headers=e2e_entities.doctor_headers,
    )
    assert can.status_code == 200

    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    assert r2.status_code == 201
    cmp_res = await client.post(
        f"/api/v1/doctor/appointments/{r2.json()['id']}/complete",
        headers=e2e_entities.doctor_headers,
    )
    assert cmp_res.status_code == 200

    r3 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    assert r3.status_code == 201


async def test_t2_f01_05_put_exclude_id_allows_self_shift_blocks_neighbor(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(2, 9, 0), duration_minutes=30)
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(2, 10, 0), duration_minutes=30)
    assert r1.status_code == 201 and r2.status_code == 201

    ok_put = await client.put(
        f"/api/v1/doctor/appointments/{r1.json()['id']}",
        json={"scheduled_at": _future_utc(2, 9, 15).isoformat()},
        headers=e2e_entities.doctor_headers,
    )
    assert ok_put.status_code == 200

    bad_put = await client.put(
        f"/api/v1/doctor/appointments/{r1.json()['id']}",
        json={"duration_minutes": 60},  # [09:15, 10:15) overlaps [10:00, 10:30)
        headers=e2e_entities.doctor_headers,
    )
    assert bad_put.status_code == 409


# ============================================================================
# Feature 2 Boundaries: Patient UUID Validation & Scoping
# ============================================================================


async def test_t2_f02_01_malformed_patient_id_rejected_on_doctor_get(
    client, e2e_entities: E2EEntities
):
    for bad in ("bad-uuid", "1"):
        res = await client.get(f"/api/v1/doctor/appointments?patient_id={bad}", headers=e2e_entities.doctor_headers)
        assert res.status_code == 400, f"Expected 400 for patient_id={bad}, got {res.status_code}"


async def test_t2_f02_02_malformed_patient_id_rejected_on_doctor_post(
    client, e2e_entities: E2EEntities, clean_schedule
):
    for bad in ("1", "bad-uuid"):
        res = await client.post(
            "/api/v1/doctor/appointments",
            json={
                "patient_id": bad,
                "scheduled_at": _future_utc(3, 9, 0).isoformat(),
                "visit_type": "CLINIC",
            },
            headers=e2e_entities.doctor_headers,
        )
        assert res.status_code in (400, 422), f"Expected 400/422 for patient_id={bad}, got {res.status_code}"


async def test_t2_f02_03_nonexistent_patient_uuid_rejected_on_doctor_post(
    client, e2e_entities: E2EEntities, clean_schedule
):
    res = await client.post(
        "/api/v1/doctor/appointments",
        json={
            "patient_id": str(uuid.uuid4()),
            "scheduled_at": _future_utc(3, 10, 0).isoformat(),
            "visit_type": "CLINIC",
        },
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 404


async def test_t2_f02_04_malformed_patient_id_rejected_on_patient_routes(
    client, e2e_entities: E2EEntities, clean_schedule
):
    for bad in ("1", "not-a-uuid"):
        g = await client.get(f"/api/v1/patients/{bad}/appointments", headers=e2e_entities.family_headers)
        assert g.status_code == 400, f"GET /patients/{bad}/appointments returned {g.status_code}"
        p = await client.post(
            f"/api/v1/patients/{bad}/appointments",
            json={"patient_id": bad, "scheduled_at": _future_utc(3, 11, 0).isoformat()},
            headers=e2e_entities.family_headers,
        )
        assert p.status_code in (400, 422), f"POST /patients/{bad}/appointments returned {p.status_code}"


async def test_t2_f02_05_nonexistent_patient_uuid_returns_404_on_patient_post(
    client, e2e_entities: E2EEntities, clean_schedule
):
    missing = str(uuid.uuid4())
    res = await client.post(
        f"/api/v1/patients/{missing}/appointments",
        json={"patient_id": missing, "scheduled_at": _future_utc(3, 12, 0).isoformat()},
        headers=e2e_entities.family_headers,
    )
    assert res.status_code == 404


# ============================================================================
# Feature 3 Boundaries: Status Transition Guards & Missing Resources
# ============================================================================


async def test_t2_f03_01_put_missing_appointment_returns_404(
    client, e2e_entities: E2EEntities
):
    res = await client.put(
        f"/api/v1/doctor/appointments/{uuid.uuid4()}",
        json={"location": "Missing"},
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 404


async def test_t2_f03_02_put_completed_or_cancelled_rejected_not_404(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 9, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 11, 0))
    assert r1.status_code == 201 and r2.status_code == 201
    await client.post(f"/api/v1/doctor/appointments/{r1.json()['id']}/complete", headers=e2e_entities.doctor_headers)
    await client.post(
        f"/api/v1/doctor/appointments/{r2.json()['id']}/cancel",
        json={"cancellation_reason": "Đã hủy trước"},
        headers=e2e_entities.doctor_headers,
    )

    u1 = await client.put(f"/api/v1/doctor/appointments/{r1.json()['id']}", json={"location": "X"}, headers=e2e_entities.doctor_headers)
    u2 = await client.put(f"/api/v1/doctor/appointments/{r2.json()['id']}", json={"location": "Y"}, headers=e2e_entities.doctor_headers)
    assert u1.status_code in (400, 409)
    assert u2.status_code in (400, 409)


async def test_t2_f03_03_complete_guard_and_404(
    client, e2e_entities: E2EEntities, clean_schedule
):
    miss = await client.post(f"/api/v1/doctor/appointments/{uuid.uuid4()}/complete", headers=e2e_entities.doctor_headers)
    assert miss.status_code == 404

    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 13, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 15, 0))
    await client.post(f"/api/v1/doctor/appointments/{r1.json()['id']}/complete", headers=e2e_entities.doctor_headers)
    await client.post(
        f"/api/v1/doctor/appointments/{r2.json()['id']}/cancel",
        json={"cancellation_reason": "Đã hủy trước"},
        headers=e2e_entities.doctor_headers,
    )

    re_cmp = await client.post(f"/api/v1/doctor/appointments/{r1.json()['id']}/complete", headers=e2e_entities.doctor_headers)
    can_cmp = await client.post(f"/api/v1/doctor/appointments/{r2.json()['id']}/complete", headers=e2e_entities.doctor_headers)
    assert re_cmp.status_code in (400, 409)
    assert can_cmp.status_code in (400, 409)


async def test_t2_f03_04_cancel_rejects_short_reason_and_completed_apt(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 16, 0))
    apt_id = r1.json()["id"]

    short = await client.post(
        f"/api/v1/doctor/appointments/{apt_id}/cancel",
        json={"cancellation_reason": "ab"},
        headers=e2e_entities.doctor_headers,
    )
    blank = await client.post(
        f"/api/v1/doctor/appointments/{apt_id}/cancel",
        json={"cancellation_reason": "   "},
        headers=e2e_entities.doctor_headers,
    )
    assert short.status_code in (400, 422)
    assert blank.status_code in (400, 422)

    await client.post(f"/api/v1/doctor/appointments/{apt_id}/complete", headers=e2e_entities.doctor_headers)
    after_cmp = await client.post(
        f"/api/v1/doctor/appointments/{apt_id}/cancel",
        json={"cancellation_reason": "Không thể hủy sau khi khám"},
        headers=e2e_entities.doctor_headers,
    )
    assert after_cmp.status_code in (400, 409)


async def test_t2_f03_05_delete_missing_or_invalid_uuid_returns_404_or_400(
    client, e2e_entities: E2EEntities
):
    miss = await client.delete(f"/api/v1/doctor/appointments/{uuid.uuid4()}", headers=e2e_entities.doctor_headers)
    assert miss.status_code == 404
    bad = await client.delete("/api/v1/doctor/appointments/invalid-id", headers=e2e_entities.doctor_headers)
    assert bad.status_code in (400, 404)


# ============================================================================
# Feature 4 Boundaries: Sync Guards, Regex, Idempotency & WS Pruning
# ============================================================================


async def test_t2_f04_01_confirm_blocked_on_cancelled_and_completed_appointments(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 9, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 11, 0))
    id1, id2 = r1.json()["id"], r2.json()["id"]
    await client.post(f"/api/v1/doctor/appointments/{id1}/cancel", json={"cancellation_reason": "Hủy hẹn"}, headers=e2e_entities.doctor_headers)
    await client.post(f"/api/v1/doctor/appointments/{id2}/complete", headers=e2e_entities.doctor_headers)

    c1 = await client.post(f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{id1}/confirm", headers=e2e_entities.family_headers)
    c2 = await client.post(f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{id2}/confirm", headers=e2e_entities.family_headers)
    assert c1.status_code in (400, 409)
    assert c2.status_code in (400, 409)


async def test_t2_f04_02_incident_ack_extracts_apt_uuid_with_pipe_metadata(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 14, 0))
    apt_id = r1.json()["id"]

    async with AsyncSessionFactory() as db:
        inc = Incident(
            device_id=e2e_entities.device_id,
            alert_type="APPOINTMENT_SCHEDULED",
            alert_level="LOW",
            message="Lịch khám pipe test",
            is_acknowledged=False,
            notes=f"PATIENT:{e2e_entities.patient_id}|APT:{apt_id}|EXTRA:1",
        )
        db.add(inc)
        await db.commit()
        inc_id = inc.id

    ack = await client.post(f"/api/v1/incidents/{inc_id}/acknowledge", headers=e2e_entities.family_headers)
    assert ack.status_code == 200
    apts = (await client.get(f"/api/v1/doctor/appointments?patient_id={e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    target = next(a for a in apts if a["id"] == apt_id)
    assert "[ĐÃ XÁC NHẬN ĐÓN TIẾP]" in (target.get("clinical_notes") or "")


async def test_t2_f04_03_double_confirm_is_idempotent(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 15, 0))
    apt_id = r1.json()["id"]

    c1 = await client.post(f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{apt_id}/confirm", headers=e2e_entities.family_headers)
    c2 = await client.post(f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{apt_id}/confirm", headers=e2e_entities.family_headers)
    assert c1.status_code == 200 and c2.status_code == 200
    notes = c2.json().get("clinical_notes") or ""
    assert notes.count("[ĐÃ XÁC NHẬN ĐÓN TIẾP]") == 1

    doc_incs = (await client.get("/api/v1/incidents", headers=e2e_entities.doctor_headers)).json()
    conf_incs = [i for i in doc_incs if i["alert_type"] == "APPOINTMENT_CONFIRMED" and apt_id in (i.get("notes") or "")]
    assert len(conf_incs) <= 1


async def test_t2_f04_04_dead_ws_client_pruned_without_failing_live_clients(
    client, e2e_entities: E2EEntities, ws_recorder: RecorderWS, clean_schedule
):
    dead_ws = RecorderWS(fail_on_send=True)
    alert_clients.append(dead_ws)
    try:
        r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 16, 0))
        assert r1.status_code == 201
        assert dead_ws not in alert_clients
        assert any(m.get("alert_type") == "APPOINTMENT_SCHEDULED" for m in ws_recorder.messages)

        alert_clients.append(dead_ws)
        d1 = await client.delete(f"/api/v1/doctor/appointments/{r1.json()['id']}", headers=e2e_entities.doctor_headers)
        assert d1.status_code == 200
        assert dead_ws not in alert_clients
        assert any(m.get("alert_type") == "APPOINTMENT_DELETED" for m in ws_recorder.messages)
    finally:
        if dead_ws in alert_clients:
            alert_clients.remove(dead_ws)


async def test_t2_f04_05_acknowledge_all_invalidates_redis_cache(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(5, 17, 0))
    assert r1.status_code == 201
    before = await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    assert any(not i["is_acknowledged"] for i in before.json())
    assert await fake_redis.keys("cache:incidents:*")

    ack_all = await client.post("/api/v1/incidents/acknowledge-all", headers=e2e_entities.family_headers)
    assert ack_all.status_code == 200
    assert await fake_redis.keys("cache:incidents:*") == []

    after = await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    assert all(i["is_acknowledged"] is True for i in after.json())


# ============================================================================
# Feature 5 Boundaries: Midnight UTC+7, Context Isolation & Scheduler Cancel
# ============================================================================


async def test_t2_f05_01_early_morning_utc7_crosses_utc_midnight_correctly(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        "2026-12-01T17:15:00Z",  # 2026-12-02 00:15 UTC+7
    )
    assert r1.status_code == 201
    apt_id = r1.json()["id"]
    incs = (await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)).json()
    inc = next(i for i in incs if f"APT:{apt_id}" in (i.get("notes") or ""))
    assert "00:15 ngày 02/12/2026" in inc["message"]


async def test_t2_f05_02_chatbot_context_ignores_past_upcoming_and_cancelled(
    client, e2e_entities: E2EEntities, clean_schedule
):
    async with AsyncSessionFactory() as db:
        past_apt = Appointment(
            doctor_id=e2e_entities.doctor_id,
            patient_id=e2e_entities.patient_id,
            house_id=e2e_entities.house_id,
            scheduled_at=datetime.now(timezone.utc) - timedelta(hours=2),
            duration_minutes=30,
            visit_type="CLINIC",
            location="Past",
            status="UPCOMING",
        )
        can_apt = Appointment(
            doctor_id=e2e_entities.doctor_id,
            patient_id=e2e_entities.patient_id,
            house_id=e2e_entities.house_id,
            scheduled_at=datetime.now(timezone.utc) + timedelta(hours=2),
            duration_minutes=30,
            visit_type="CLINIC",
            location="Cancelled",
            status="CANCELLED",
        )
        db.add_all([past_apt, can_apt])
        await db.commit()

    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    try:
        async with AsyncSessionFactory() as db:
            ctx = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    finally:
        _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)

    assert ctx["appointment"] is None


async def test_t2_f05_03_chatbot_context_isolates_across_houses(
    client, e2e_entities: E2EEntities, clean_schedule
):
    h2_apt = await _create_apt(
        client,
        e2e_entities.doctor2_headers,
        e2e_entities.patient3_id,
        datetime.now(timezone.utc) + timedelta(hours=3),
    )
    assert h2_apt.status_code == 201

    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    try:
        async with AsyncSessionFactory() as db:
            ctx = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    finally:
        _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)

    assert ctx["appointment"] is None


async def test_t2_f05_04_scheduler_cancels_reminder_when_appointment_cancelled(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, datetime.now(timezone.utc) + timedelta(hours=1))
    assert r1.status_code == 201
    apt_uuid = uuid.UUID(r1.json()["id"])

    can = await client.post(
        f"/api/v1/doctor/appointments/{apt_uuid}/cancel",
        json={"cancellation_reason": "Hủy trước khi gửi nhắc"},
        headers=e2e_entities.doctor_headers,
    )
    assert can.status_code == 200

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

    await AppointmentSchedulerService().process_due_reminders()

    async with AsyncSessionFactory() as db:
        refreshed = await db.get(AppointmentReminder, rem_id)
        assert refreshed is not None
        assert refreshed.status == "CANCELLED"


async def test_t2_f05_05_patient_detail_next_appointment_none_when_only_cancelled_or_past(
    client, e2e_entities: E2EEntities, clean_schedule
):
    async with AsyncSessionFactory() as db:
        db.add_all(
            [
                Appointment(
                    doctor_id=e2e_entities.doctor_id,
                    patient_id=e2e_entities.patient2_id,
                    house_id=e2e_entities.house_id,
                    scheduled_at=datetime.now(timezone.utc) - timedelta(hours=3),
                    duration_minutes=30,
                    visit_type="CLINIC",
                    location="Past",
                    status="UPCOMING",
                ),
                Appointment(
                    doctor_id=e2e_entities.doctor_id,
                    patient_id=e2e_entities.patient2_id,
                    house_id=e2e_entities.house_id,
                    scheduled_at=datetime.now(timezone.utc) + timedelta(days=2),
                    duration_minutes=30,
                    visit_type="CLINIC",
                    location="Cancelled",
                    status="CANCELLED",
                ),
            ]
        )
        await db.commit()

    res = await client.get(
        f"/api/v1/doctor/patients/{e2e_entities.patient2_id}",
        headers=e2e_entities.doctor_headers,
    )
    assert res.status_code == 200
    assert res.json().get("next_appointment") is None


# ============================================================================
# Feature 6 Boundaries: Schema Bounds, Recurrence Skip & Aliases
# ============================================================================


@pytest.mark.parametrize("bad_duration", [0, 14, 241])
async def test_t2_f06_01_duration_minutes_out_of_bounds_rejected(
    client, e2e_entities: E2EEntities, bad_duration: int
):
    res = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        _future_utc(7, 9, 0),
        duration_minutes=bad_duration,
    )
    assert res.status_code == 422


async def test_t2_f06_02_recurrence_occurrences_out_of_bounds_rejected(
    client, e2e_entities: E2EEntities
):
    for bad_occ in (0, 13):
        res = await _create_apt(
            client,
            e2e_entities.doctor_headers,
            e2e_entities.patient_id,
            _future_utc(7, 9, 0),
            recurrence_pattern="WEEKLY",
            recurrence_occurrences=bad_occ,
        )
        assert res.status_code == 422


async def test_t2_f06_03_invalid_scheduled_at_rejected_with_422(
    client, e2e_entities: E2EEntities
):
    for bad_dt in ("", "not-a-date"):
        res = await _create_apt(
            client,
            e2e_entities.doctor_headers,
            e2e_entities.patient_id,
            bad_dt,
        )
        assert res.status_code == 422


async def test_t2_f06_04_recurring_series_skips_conflicting_occurrence_cleanly(
    client, e2e_entities: E2EEntities, clean_schedule
):
    blocker = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient2_id,
        _future_utc(10, 9, 0),
    )
    assert blocker.status_code == 201

    series = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        _future_utc(3, 9, 0),
        recurrence_pattern="WEEKLY",
        recurrence_occurrences=3,  # T+3d, T+10d (conflict!), T+17d
    )
    assert series.status_code == 201, series.text
    root_id = uuid.UUID(series.json()["id"])

    async with AsyncSessionFactory() as db:
        rows = (
            await db.execute(
                select(Appointment).where(
                    (Appointment.id == root_id) | (Appointment.parent_recurring_id == root_id)
                )
            )
        ).scalars().all()
        assert len(rows) == 2


async def test_t2_f06_05_visit_type_home_alias_and_telehealth_accepted(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r_home = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        _future_utc(7, 9, 0),
        visit_type="HOME",
    )
    r_tele = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        _future_utc(7, 11, 0),
        visit_type="TELEHEALTH",
    )
    assert r_home.status_code == 201, r_home.text
    assert r_tele.status_code == 201, r_tele.text


# ============================================================================
# Features 7–13: Doctor Web & Mobile Client Contracts (Tier 2)
# ============================================================================


@pytest.mark.parametrize(
    "pattern",
    [
        "^T2-F07-01 ",
        "^T2-F07-02 ",
        "^T2-F07-03 ",
        "^T2-F07-04 ",
        "^T2-F07-05 ",
        "^T2-F08-01 ",
        "^T2-F08-02 ",
        "^T2-F08-03 ",
        "^T2-F08-04 ",
        "^T2-F08-05 ",
        "^T2-F09-01 ",
        "^T2-F09-02 ",
        "^T2-F09-03 ",
        "^T2-F09-04 ",
        "^T2-F09-05 ",
        "^T2-F10-01 ",
        "^T2-F10-02 ",
        "^T2-F10-03 ",
        "^T2-F10-04 ",
        "^T2-F10-05 ",
        "^T2-F11-01 ",
        "^T2-F11-02 ",
        "^T2-F11-03 ",
        "^T2-F11-04 ",
        "^T2-F11-05 ",
    ],
)
def test_t2_doctor_web_contracts(pattern: str):
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern=pattern, tz="Asia/Ho_Chi_Minh")


@pytest.mark.parametrize(
    "pattern",
    [
        "^T2-F12-01 ",
        "^T2-F12-02 ",
        "^T2-F12-03 ",
        "^T2-F12-04 ",
        "^T2-F12-05 ",
        "^T2-F13-01 ",
        "^T2-F13-02 ",
        "^T2-F13-03 ",
        "^T2-F13-04 ",
        "^T2-F13-05 ",
    ],
)
def test_t2_mobile_contracts(pattern: str):
    run_node_test(MOBILE_CONTRACTS, filter_pattern=pattern, tz="Asia/Ho_Chi_Minh")

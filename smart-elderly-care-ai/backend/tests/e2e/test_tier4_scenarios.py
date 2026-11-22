"""
Tier 4 — Real-World Application Scenarios (7 End-to-End Scenarios: T4-01 .. T4-07).
Maps 1-to-1 to T4-01 .. T4-07 in the 4-Tier Spec Matrix + TypeScript typecheck gates.
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.database import AsyncSessionFactory
from app.services.chatbot.context_builder import ChatbotContextBuilder, _STATIC_CARE_CACHE
from tests.e2e.conftest import (
    CLIENT_CONTRACTS_DIR,
    DOCTOR_WEB_DIR,
    E2EEntities,
    FakeRedis,
    MOBILE_DIR,
    RecorderWS,
    SMART_ELDERLY_ROOT,
    run_node_test,
    run_tsc_check,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

VN_TZ = timezone(timedelta(hours=7))
DOCTOR_WEB_CONTRACTS = CLIENT_CONTRACTS_DIR / "doctor_web_contracts.test.cjs"
MOBILE_CONTRACTS = CLIENT_CONTRACTS_DIR / "mobile_contracts.test.cjs"


def _vn_dt(days: int, hour: int, minute: int = 0) -> datetime:
    base = (datetime.now(VN_TZ) + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    return base


def _run_node_snippet(script: str, tz: str = "Asia/Ho_Chi_Minh") -> None:
    proc = subprocess.run(
        ["node", "-e", script],
        cwd=str(SMART_ELDERLY_ROOT),
        env={**os.environ, "TZ": tz},
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
        timeout=30,
    )
    if proc.returncode != 0:
        pytest.fail(f"Node scenario step failed:\n{proc.stdout}\n{proc.stderr}")


async def _create_apt(client, headers: dict, patient_id: uuid.UUID, scheduled_at: datetime, **extra):
    return await client.post(
        "/api/v1/doctor/appointments",
        json={
            "patient_id": str(patient_id),
            "scheduled_at": scheduled_at.isoformat(),
            "duration_minutes": extra.pop("duration_minutes", 30),
            "visit_type": extra.pop("visit_type", "CLINIC"),
            "location": extra.pop("location", "Phòng khám SECA"),
            **extra,
        },
        headers=headers,
    )


async def test_t4_01_same_day_multi_patient_clinic_schedule_and_overlap_rejection(
    client, e2e_entities: E2EEntities, clean_schedule
):
    # 1. Book patient_1 at T+2d 09:00+07:00 (30m, CLINIC)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _vn_dt(2, 9, 0), duration_minutes=30, visit_type="CLINIC")
    assert r1.status_code == 201
    assert r1.json()["patient_name"] == e2e_entities.patient_name

    # 2. Book back-to-back patient_2 at T+2d 09:30+07:00 (30m, TELEHEALTH)
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _vn_dt(2, 9, 30), duration_minutes=30, visit_type="TELEHEALTH")
    assert r2.status_code == 201
    assert r2.json()["visit_type"] == "TELEHEALTH"

    # 3. Attempt overlap at 09:15+07:00 -> 409 Conflict
    r_conflict = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _vn_dt(2, 9, 15), duration_minutes=30)
    assert r_conflict.status_code == 409

    # 4. Book patient_1 again same day at 14:00+07:00 (45m, HOME_VISIT)
    r3 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _vn_dt(2, 14, 0), duration_minutes=45, visit_type="HOME_VISIT")
    assert r3.status_code == 201

    # 5. GET status=ALL returns all 3 sorted chronologically
    all_res = await client.get("/api/v1/doctor/appointments?status=ALL", headers=e2e_entities.doctor_headers)
    assert all_res.status_code == 200
    items = all_res.json()
    assert len(items) == 3
    times = [datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00")) for a in items]
    assert times == sorted(times)

    # 6. Doctor Web slot/view contracts & tsc gate
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T1-F09-02 |^T1-F09-05 |^T1-F10-04 ")
    run_tsc_check(DOCTOR_WEB_DIR)


async def test_t4_02_cross_midnight_utc7_early_morning_workflow(
    client, e2e_entities: E2EEntities, clean_schedule
):
    # Book 00:30+07:00 (= 17:30Z previous UTC day)
    early_dt = datetime(2026, 12, 20, 0, 30, tzinfo=VN_TZ)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, early_dt)
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    incs = (await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)).json()
    inc = next(i for i in incs if f"APT:{apt_id}" in (i.get("notes") or ""))
    assert "00:30 ngày 20/12/2026" in inc["message"]

    # Verify Doctor Web & Mobile local date + 00:00/08:00 contracts under TZ=Asia/Ho_Chi_Minh + Mobile tsc gate
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T1-F08-01 |^T1-F08-04 |^T1-F08-05 |^T2-F08-01 ", tz="Asia/Ho_Chi_Minh")
    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T2-F12-01 |^T1-F12-03 |^T1-F12-04 |^T1-F12-05 |^T2-F12-05 ", tz="Asia/Ho_Chi_Minh")
    run_tsc_check(MOBILE_DIR)


async def test_t4_03_full_two_way_confirmation_loop(
    client, e2e_app, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    # Verify real ASGI /ws/alerts handshake first (reads FakeRedis, no cross-loop DB)
    def _ws_handshake():
        with TestClient(e2e_app).websocket_connect("/ws/alerts") as ws:
            init_msg = ws.receive_json()
            assert init_msg["type"] == "INITIAL_ALERTS"
            ws.send_text("ping")
            assert ws.receive_text() == "pong"

    await asyncio.to_thread(_ws_handshake)

    # 1. Prime incidents cache
    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    assert await fake_redis.keys("cache:incidents:*")

    # 2. Doctor creates appointment -> Incident created + cache invalidated
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _vn_dt(3, 9, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]
    assert await fake_redis.keys("cache:incidents:*") == []

    # 3. Family sees unacknowledged incident
    fam_incs = (await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)).json()
    inc = next(i for i in fam_incs if f"APT:{apt_id}" in (i.get("notes") or ""))
    assert inc["is_acknowledged"] is False
    inc_id = inc["id"]
    ws_recorder.messages.clear()

    # 4. Family acknowledges incident -> clinical_notes updated + APPOINTMENT_CONFIRMED + INCIDENT_RESOLVED
    ack = await client.post(f"/api/v1/incidents/{inc_id}/acknowledge", headers=e2e_entities.family_headers)
    assert ack.status_code == 200
    assert await fake_redis.keys("cache:incidents:*") == []

    apts = (await client.get(f"/api/v1/doctor/appointments?patient_id={e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    assert "[ĐÃ XÁC NHẬN ĐÓN TIẾP]" in (apts[0].get("clinical_notes") or "")

    assert any(m.get("type") == "INCIDENT_RESOLVED" and m.get("incident_id") == str(inc_id) for m in ws_recorder.messages)
    assert any(m.get("alert_type") == "APPOINTMENT_CONFIRMED" for m in ws_recorder.messages)

    # 5. Client WS contracts process events without alarm sirens
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T2-F11-04 ")
    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T2-F13-02 ")


async def test_t4_04_family_request_doctor_reschedule_slot_release_and_cache_refresh(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    slot_0900 = _vn_dt(3, 9, 0)
    req = await client.post(
        f"/api/v1/patients/{e2e_entities.patient_id}/appointments",
        json={
            "patient_id": str(e2e_entities.patient_id),
            "scheduled_at": slot_0900.isoformat(),
            "duration_minutes": 30,
            "visit_type": "HOME_VISIT",
            "location": "Tại nhà",
        },
        headers=e2e_entities.family_headers,
    )
    assert req.status_code == 201
    apt_id = req.json()["id"]

    # Mobile self-initiated check
    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T2-F13-03 ")

    # Doctor reschedules to 15:00+07:00 (60m)
    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    ws_recorder.messages.clear()
    slot_1500 = _vn_dt(3, 15, 0)
    upd = await client.put(
        f"/api/v1/doctor/appointments/{apt_id}",
        json={"scheduled_at": slot_1500.isoformat(), "duration_minutes": 60},
        headers=e2e_entities.doctor_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["patient_name"] == e2e_entities.patient_name
    assert await fake_redis.keys("cache:incidents:*") == []
    assert any(m.get("type") == "APPOINTMENT_RESCHEDULED" or m.get("alert_type") == "APPOINTMENT_RESCHEDULED" for m in ws_recorder.messages)

    # Old 09:00+07:00 slot is now free for another patient
    rebook = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, slot_0900)
    assert rebook.status_code == 201

    # Context builder & patient detail next_appointment reflect earliest future UPCOMING (09:00 for doc, 15:00 for patient_1)
    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    try:
        async with AsyncSessionFactory() as db:
            ctx = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    finally:
        _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    assert ctx["appointment"] is not None

    det = (await client.get(f"/api/v1/doctor/patients/{e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    expected_1500 = slot_1500.strftime("%H:%M ngày %d/%m/%Y")
    assert expected_1500 in (det.get("next_appointment") or "")
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T2-F11-03 ")


async def test_t4_05_cancellation_validation_slot_release_and_safe_deletion(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T2-F07-01 |^T2-F07-02 |^T2-F07-03 ")

    slot = _vn_dt(4, 9, 0)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    # Backend rejects <3 char reason
    bad_can = await client.post(
        f"/api/v1/doctor/appointments/{apt_id}/cancel",
        json={"cancellation_reason": "ab"},
        headers=e2e_entities.doctor_headers,
    )
    assert bad_can.status_code in (400, 422)

    ws_recorder.messages.clear()
    ok_can = await client.post(
        f"/api/v1/doctor/appointments/{apt_id}/cancel",
        json={"cancellation_reason": "Bệnh nhân xin hoãn"},
        headers=e2e_entities.doctor_headers,
    )
    assert ok_can.status_code == 200
    assert ok_can.json()["status"] == "CANCELLED"
    assert any(m.get("alert_type") == "APPOINTMENT_CANCELLED" for m in ws_recorder.messages)

    # Cancelled dot removed & card displays reason
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T2-F10-01 |^T2-F10-05 ")

    # Freed slot can be re-booked
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot)
    assert r2.status_code == 201

    # Safe DELETE emits APPOINTMENT_DELETED without fall alarm, invalidates cache, and repeat DELETE returns 404
    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    ws_recorder.messages.clear()
    del_res = await client.delete(f"/api/v1/doctor/appointments/{apt_id}", headers=e2e_entities.doctor_headers)
    assert del_res.status_code == 200
    assert await fake_redis.keys("cache:incidents:*") == []
    assert any(m.get("type") == "APPOINTMENT_DELETED" and m.get("alert_type") == "APPOINTMENT_DELETED" for m in ws_recorder.messages)

    rep_del = await client.delete(f"/api/v1/doctor/appointments/{apt_id}", headers=e2e_entities.doctor_headers)
    assert rep_del.status_code == 404
    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T2-F13-01 ")


async def test_t4_06_multi_tenant_isolation_and_invalid_patient_id_rejection(
    client, e2e_entities: E2EEntities, clean_schedule
):
    # House B booking under doctor2 / patient3
    h2_apt = await _create_apt(client, e2e_entities.doctor2_headers, e2e_entities.patient3_id, _vn_dt(4, 10, 0))
    assert h2_apt.status_code == 201

    # Invalid IDs rejected
    assert (await client.get("/api/v1/doctor/appointments?patient_id=1", headers=e2e_entities.doctor_headers)).status_code == 400
    assert (await client.get("/api/v1/doctor/appointments?patient_id=bad-uuid", headers=e2e_entities.doctor_headers)).status_code == 400
    assert (await client.get("/api/v1/patients/1/appointments", headers=e2e_entities.family_headers)).status_code == 400
    assert (
        await client.post(
            f"/api/v1/patients/{uuid.uuid4()}/appointments",
            json={"patient_id": str(uuid.uuid4()), "scheduled_at": _vn_dt(4, 11, 0).isoformat()},
            headers=e2e_entities.family_headers,
        )
    ).status_code == 404

    # Doctor 1 sees zero House B appointments
    doc1_list = (await client.get("/api/v1/doctor/appointments?status=ALL", headers=e2e_entities.doctor_headers)).json()
    assert all(a["patient_id"] != str(e2e_entities.patient3_id) for a in doc1_list)

    # Family 1 ChatbotContextBuilder never leaks House B appointment
    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    try:
        async with AsyncSessionFactory() as db:
            ctx = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    finally:
        _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    assert ctx["appointment"] is None

    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T1-F13-05 |^T2-F13-05 ")


async def test_t4_07_end_to_end_completion_guards_and_active_banner_progression(
    client, e2e_entities: E2EEntities, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _vn_dt(1, 9, 0))
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _vn_dt(2, 9, 0))
    assert r1.status_code == 201 and r2.status_code == 201
    apt1_id, apt2_id = r1.json()["id"], r2.json()["id"]
    ws_recorder.messages.clear()

    # Complete Apt 1 with clinical_notes
    cmp1 = await client.post(
        f"/api/v1/doctor/appointments/{apt1_id}/complete",
        json={"clinical_notes": "Sinh hiệu ổn định"},
        headers=e2e_entities.doctor_headers,
    )
    assert cmp1.status_code == 200
    assert cmp1.json()["status"] == "COMPLETED"
    assert "Sinh hiệu ổn định" in (cmp1.json().get("clinical_notes") or "")
    assert any(m.get("type") == "APPOINTMENT_COMPLETED" or m.get("alert_type") == "APPOINTMENT_COMPLETED" for m in ws_recorder.messages)

    # Transition guards block PUT, complete, cancel, and family confirm on completed Apt 1
    assert (await client.put(f"/api/v1/doctor/appointments/{apt1_id}", json={"location": "New"}, headers=e2e_entities.doctor_headers)).status_code in (400, 409)
    assert (await client.post(f"/api/v1/doctor/appointments/{apt1_id}/complete", headers=e2e_entities.doctor_headers)).status_code in (400, 409)
    assert (
        await client.post(
            f"/api/v1/doctor/appointments/{apt1_id}/cancel",
            json={"cancellation_reason": "Không thể hủy"},
            headers=e2e_entities.doctor_headers,
        )
    ).status_code in (400, 409)
    assert (
        await client.post(
            f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{apt1_id}/confirm",
            headers=e2e_entities.family_headers,
        )
    ).status_code in (400, 409)

    # Next active appointment advances to Apt 2 in ChatbotContextBuilder & PatientDetail
    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    async with AsyncSessionFactory() as db:
        ctx = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    expected_apt2 = _vn_dt(2, 9, 0).strftime("%H:%M ngày %d/%m/%Y")
    assert ctx["appointment"] and ctx["appointment"]["scheduled_at"] == expected_apt2

    # Complete Apt 2 -> no UPCOMING left -> ChatbotContextBuilder returns None
    assert (await client.post(f"/api/v1/doctor/appointments/{apt2_id}/complete", headers=e2e_entities.doctor_headers)).status_code == 200
    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    try:
        async with AsyncSessionFactory() as db:
            ctx_empty = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    finally:
        _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    assert ctx_empty["appointment"] is None

    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T1-F13-03 |^T2-F13-04 ")

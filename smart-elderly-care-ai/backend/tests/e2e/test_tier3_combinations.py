"""
Tier 3 — Cross-Feature Pairwise Combinations (15 Tests: T3-01 .. T3-15).
Covers every feature F1–F13 across backend and client contracts.
"""
from __future__ import annotations

import json
import os
import subprocess
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.database import AsyncSessionFactory
from app.models.appointment import AppointmentReminder
from app.services.chatbot.context_builder import ChatbotContextBuilder, _STATIC_CARE_CACHE
from tests.e2e.conftest import (
    CLIENT_CONTRACTS_DIR,
    E2EEntities,
    FakeRedis,
    RecorderWS,
    SMART_ELDERLY_ROOT,
    run_node_test,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

VN_TZ = timezone(timedelta(hours=7))
DOCTOR_WEB_CONTRACTS = CLIENT_CONTRACTS_DIR / "doctor_web_contracts.test.cjs"
MOBILE_CONTRACTS = CLIENT_CONTRACTS_DIR / "mobile_contracts.test.cjs"


def _future_utc(days: int = 2, hour: int = 9, minute: int = 0) -> datetime:
    return (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )


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
        pytest.fail(f"Node cross-layer contract failed:\n{proc.stdout}\n{proc.stderr}")


async def _create_apt(client, headers: dict, patient_id: uuid.UUID, scheduled_at: datetime | str, **extra):
    iso = scheduled_at.isoformat() if isinstance(scheduled_at, datetime) else scheduled_at
    return await client.post(
        "/api/v1/doctor/appointments",
        json={
            "patient_id": str(patient_id),
            "scheduled_at": iso,
            "duration_minutes": extra.pop("duration_minutes", 30),
            "visit_type": extra.pop("visit_type", "CLINIC"),
            "location": extra.pop("location", "Phòng khám SECA"),
            **extra,
        },
        headers=headers,
    )


async def test_t3_01_f1_f3_reschedule_overlap_preserves_db_and_patient_name(
    client, e2e_entities: E2EEntities, clean_schedule
):
    slot1 = _future_utc(2, 9, 0)
    slot2 = _future_utc(2, 10, 0)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot1)
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, slot2)
    assert r1.status_code == 201 and r2.status_code == 201
    apt2_id = r2.json()["id"]

    bad = await client.put(
        f"/api/v1/doctor/appointments/{apt2_id}",
        json={"scheduled_at": _future_utc(2, 9, 15).isoformat()},
        headers=e2e_entities.doctor_headers,
    )
    assert bad.status_code == 409

    # Verify DB state unchanged at 10:00
    cur = next(
        a
        for a in (await client.get("/api/v1/doctor/appointments", headers=e2e_entities.doctor_headers)).json()
        if a["id"] == apt2_id
    )
    assert datetime.fromisoformat(cur["scheduled_at"].replace("Z", "+00:00")) == slot2

    # Back-to-back at 09:30 succeeds and preserves real patient_name
    b2b = _future_utc(2, 9, 30)
    ok = await client.put(
        f"/api/v1/doctor/appointments/{apt2_id}",
        json={"scheduled_at": b2b.isoformat()},
        headers=e2e_entities.doctor_headers,
    )
    assert ok.status_code == 200
    assert ok.json()["patient_name"] == e2e_entities.patient2_name
    assert datetime.fromisoformat(ok.json()["scheduled_at"].replace("Z", "+00:00")) == b2b


async def test_t3_02_f1_f6_recurring_slot_release_after_single_cancel(
    client, e2e_entities: E2EEntities, clean_schedule
):
    series = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        _future_utc(3, 9, 0),
        recurrence_pattern="WEEKLY",
        recurrence_occurrences=2,
    )
    assert series.status_code == 201
    all_apts = (await client.get(f"/api/v1/doctor/appointments?patient_id={e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    assert len(all_apts) == 2
    second = all_apts[1]

    can = await client.post(
        f"/api/v1/doctor/appointments/{second['id']}/cancel",
        json={"cancellation_reason": "Hủy tuần 2"},
        headers=e2e_entities.doctor_headers,
    )
    assert can.status_code == 200

    rebook = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, second["scheduled_at"])
    assert rebook.status_code == 201
    still_blocked = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, all_apts[0]["scheduled_at"])
    assert still_blocked.status_code == 409


async def test_t3_03_f2_f3_uuid_guard_and_real_patient_names_across_routes(
    client, e2e_entities: E2EEntities, clean_schedule
):
    await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(3, 8, 0))
    await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, _future_utc(3, 10, 0))

    bad = await client.get("/api/v1/doctor/appointments?patient_id=bad", headers=e2e_entities.doctor_headers)
    assert bad.status_code == 400

    doc_p1 = await client.get(f"/api/v1/doctor/appointments?patient_id={e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)
    assert doc_p1.status_code == 200
    assert len(doc_p1.json()) == 1
    assert doc_p1.json()[0]["patient_name"] == e2e_entities.patient_name

    pat_p2 = await client.get(f"/api/v1/patients/{e2e_entities.patient2_id}/appointments", headers=e2e_entities.family_headers)
    assert pat_p2.status_code == 200
    assert len(pat_p2.json()) == 1
    assert pat_p2.json()[0]["patient_name"] == e2e_entities.patient2_name


async def test_t3_04_f3_f4_complete_with_notes_resolves_incident_cache_and_ws(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 9, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]

    incs_before = (await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)).json()
    assert any(f"APT:{apt_id}" in (i.get("notes") or "") and not i["is_acknowledged"] for i in incs_before)
    ws_recorder.messages.clear()

    cmp_res = await client.post(
        f"/api/v1/doctor/appointments/{apt_id}/complete",
        json={"clinical_notes": "Khám tốt"},
        headers=e2e_entities.doctor_headers,
    )
    assert cmp_res.status_code == 200
    assert cmp_res.json()["status"] == "COMPLETED"
    assert "Khám tốt" in (cmp_res.json().get("clinical_notes") or "")
    assert await fake_redis.keys("cache:incidents:*") == []
    assert any(
        m.get("type") == "APPOINTMENT_COMPLETED" or m.get("alert_type") == "APPOINTMENT_COMPLETED"
        for m in ws_recorder.messages
    )

    incs_after = (await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)).json()
    related = [i for i in incs_after if f"APT:{apt_id}" in (i.get("notes") or "")]
    assert related and all(i["is_acknowledged"] is True for i in related)


async def test_t3_05_f4_f6_reschedule_updates_reminders_ws_redis_and_allows_confirm(
    client, e2e_entities: E2EEntities, fake_redis: FakeRedis, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(4, 9, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]
    await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)
    ws_recorder.messages.clear()

    new_slot = _future_utc(4, 14, 0)  # 21:00 VN
    upd = await client.put(
        f"/api/v1/doctor/appointments/{apt_id}",
        json={"scheduled_at": new_slot.isoformat()},
        headers=e2e_entities.doctor_headers,
    )
    assert upd.status_code == 200
    assert await fake_redis.keys("cache:incidents:*") == []
    assert any(
        m.get("type") == "APPOINTMENT_RESCHEDULED" or m.get("alert_type") == "APPOINTMENT_RESCHEDULED"
        for m in ws_recorder.messages
    )

    async with AsyncSessionFactory() as db:
        rems = (
            await db.execute(
                select(AppointmentReminder).where(
                    AppointmentReminder.appointment_id == uuid.UUID(apt_id),
                    AppointmentReminder.status == "PENDING",
                )
            )
        ).scalars().all()
        assert any(abs((r.scheduled_time - (new_slot - timedelta(hours=2))).total_seconds()) < 5 for r in rems)

    conf = await client.post(
        f"/api/v1/patients/{e2e_entities.patient_id}/appointments/{apt_id}/confirm",
        headers=e2e_entities.family_headers,
    )
    assert conf.status_code == 200
    doc_incs = (await client.get("/api/v1/incidents", headers=e2e_entities.doctor_headers)).json()
    expected_vn = new_slot.astimezone(VN_TZ).strftime("%H:%M ngày %d/%m/%Y")
    assert any(i["alert_type"] == "APPOINTMENT_CONFIRMED" and expected_vn in i["message"] for i in doc_incs)


async def test_t3_06_f4_f5_family_ack_triggers_utc7_confirm_and_incident_resolved(
    client, e2e_entities: E2EEntities, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(
        client,
        e2e_entities.doctor_headers,
        e2e_entities.patient_id,
        "2026-12-05T20:00:00Z",  # 2026-12-06 03:00 VN
    )
    assert r1.status_code == 201
    apt_id = r1.json()["id"]
    incs = (await client.get("/api/v1/incidents", headers=e2e_entities.family_headers)).json()
    inc_id = next(i["id"] for i in incs if f"APT:{apt_id}" in (i.get("notes") or ""))
    ws_recorder.messages.clear()

    ack = await client.post(f"/api/v1/incidents/{inc_id}/acknowledge", headers=e2e_entities.family_headers)
    assert ack.status_code == 200

    assert any(m.get("type") == "INCIDENT_RESOLVED" and m.get("incident_id") == str(inc_id) for m in ws_recorder.messages)
    doc_incs = (await client.get("/api/v1/incidents", headers=e2e_entities.doctor_headers)).json()
    assert any(i["alert_type"] == "APPOINTMENT_CONFIRMED" and "03:00 ngày 06/12/2026" in i["message"] for i in doc_incs)


async def test_t3_07_f5_f6_context_builder_and_next_appointment_react_to_cancel_and_create(
    client, e2e_entities: E2EEntities, clean_schedule
):
    slot1 = _future_utc(2, 2, 0)  # 09:00 VN
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot1)
    assert r1.status_code == 201
    apt1_id = r1.json()["id"]

    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    async with AsyncSessionFactory() as db:
        ctx1 = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    assert ctx1["appointment"] is not None
    det1 = (await client.get(f"/api/v1/doctor/patients/{e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    assert det1["next_appointment"] is not None

    await client.post(
        f"/api/v1/doctor/appointments/{apt1_id}/cancel",
        json={"cancellation_reason": "Hủy để kiểm tra đồng bộ"},
        headers=e2e_entities.doctor_headers,
    )
    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    async with AsyncSessionFactory() as db:
        ctx_none = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    assert ctx_none["appointment"] is None
    det_none = (await client.get(f"/api/v1/doctor/patients/{e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    assert det_none["next_appointment"] is None

    slot2 = _future_utc(5, 7, 30)  # 14:30 VN
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, slot2)
    assert r2.status_code == 201
    expected_vn = slot2.astimezone(VN_TZ).strftime("%H:%M ngày %d/%m/%Y")

    _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    try:
        async with AsyncSessionFactory() as db:
            ctx2 = await ChatbotContextBuilder().get_realtime_context(db=db, user_id=e2e_entities.family_user_id)
    finally:
        _STATIC_CARE_CACHE.pop(str(e2e_entities.family_user_id), None)
    assert ctx2["appointment"] and ctx2["appointment"]["scheduled_at"] == expected_vn
    det2 = (await client.get(f"/api/v1/doctor/patients/{e2e_entities.patient_id}", headers=e2e_entities.doctor_headers)).json()
    assert expected_vn in (det2.get("next_appointment") or "")


def test_t3_08_f7_f10_cancel_modal_updates_week_strip_and_card_reason():
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T1-F07-04 |^T2-F10-01 |^T2-F10-05 ")


def test_t3_09_f8_f9_utc7_midnight_and_new_modal_free_slot():
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T1-F08-01 |^T1-F08-04 |^T1-F09-02 ", tz="Asia/Ho_Chi_Minh")


def test_t3_10_f9_f11_telehealth_reschedule_updates_store_and_drawer_cache():
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T1-F09-05 |^T2-F09-05 |^T2-F11-03 ")


def test_t3_11_f10_f11_doctor_layout_ws_refresh_and_patient_deeplink_without_siren():
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T1-F10-03 |^T1-F11-04 |^T2-F11-04 ")


def test_t3_12_f12_f13_mobile_00_08_slots_and_appointments_timeline():
    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T2-F12-01 |^T1-F13-03 |^T2-F13-04 ", tz="Asia/Ho_Chi_Minh")


async def test_t3_13_f4_f11_f13_backend_delete_ws_safe_across_doctor_web_and_mobile(
    client, e2e_entities: E2EEntities, ws_recorder: RecorderWS, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(6, 9, 0))
    assert r1.status_code == 201
    apt_id = r1.json()["id"]
    ws_recorder.messages.clear()

    del_res = await client.delete(f"/api/v1/doctor/appointments/{apt_id}", headers=e2e_entities.doctor_headers)
    assert del_res.status_code == 200
    del_evt = next(
        (m for m in ws_recorder.messages if m.get("alert_type") == "APPOINTMENT_DELETED"),
        None,
    )
    assert del_evt is not None
    assert del_evt.get("type") == "APPOINTMENT_DELETED"

    # Feed exact backend WS payload into Mobile alertsWS._handleStoreUpdate
    _run_node_snippet(
        f"""
        const assert = require('node:assert/strict');
        const path = require('node:path');
        const {{ transpileAndLoad, MOBILE_DIR }} = require('./backend/tests/e2e/client_contracts/harness.cjs');
        const calls = {{ siren: 0, esc: 0, urgent: 0 }};
        const vitalState = {{
          incidents: [], house: {{ id: 'h1' }}, iotDevices: [], patientsList: [],
          addIncident: (i) => {{ if (i.alert_level === 'HIGH' || i.alert_level === 'CRITICAL') calls.urgent++; }},
          acknowledgeIncident: () => {{}}, setVitals: () => {{}},
          setSirenActive: () => {{ calls.siren++; }},
        }};
        const {{ alertsWS }} = transpileAndLoad(path.join(MOBILE_DIR, 'src/services/websocket.ts'), {{
          'react-native': {{ Platform: {{ OS: 'ios' }} }},
          'expo-constants': {{ default: {{}}, expoConfig: {{}} }},
          '../store/useVitalStore': {{ useVitalStore: {{ getState: () => vitalState }} }},
          '../store/useAuthStore': {{ useAuthStore: {{ getState: () => ({{ userId: 'u1', viewRole: 'FAMILY' }}) }} }},
          '../store/useAlertStore': {{ useAlertStore: {{ getState: () => ({{}}) }} }},
          '../store/useEscalationStore': {{ useEscalationStore: {{ getState: () => ({{ triggerEscalation: () => calls.esc++, clearEscalation: () => {{}} }}) }} }},
          './notificationService': {{ notificationService: {{ triggerEmergencyNotification: (n) => {{ if (/SINH TỒN|TÉ NGÃ/i.test(n.title||'')) calls.urgent++; }}, stopEmergencyAlarm: () => {{}} }} }},
        }});
        alertsWS._handleStoreUpdate({json.dumps(del_evt)});
        assert.equal(calls.siren, 0);
        assert.equal(calls.esc, 0);
        assert.equal(calls.urgent, 0);
        """
    )
    run_node_test(DOCTOR_WEB_CONTRACTS, filter_pattern="^T2-F11-04 ")


async def test_t3_14_f1_f12_backend_409_overlap_propagated_to_mobile_contract(
    client, e2e_entities: E2EEntities, clean_schedule
):
    r1 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, "2026-12-15T09:00:00+07:00")
    assert r1.status_code == 201
    r2 = await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient2_id, "2026-12-15T09:15:00+07:00")
    assert r2.status_code == 409
    assert r2.json().get("detail")
    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T1-F12-02 |^T2-F12-04 ")


async def test_t3_15_f2_f13_mobile_patient_id_guard_and_backend_scoping(
    client, e2e_entities: E2EEntities, clean_schedule
):
    await _create_apt(client, e2e_entities.doctor_headers, e2e_entities.patient_id, _future_utc(6, 11, 0))
    bad = await client.get("/api/v1/patients/1/appointments", headers=e2e_entities.family_headers)
    assert bad.status_code == 400
    good = await client.get(f"/api/v1/patients/{e2e_entities.patient_id}/appointments", headers=e2e_entities.family_headers)
    assert good.status_code == 200
    assert all(a["patient_id"] == str(e2e_entities.patient_id) for a in good.json())
    run_node_test(MOBILE_CONTRACTS, filter_pattern="^T1-F13-05 |^T2-F13-05 ")

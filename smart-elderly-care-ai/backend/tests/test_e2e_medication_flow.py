"""
backend/tests/test_e2e_medication_flow.py
Comprehensive End-to-End Test Suite for SECA Medication Prescription and Scheduling Flow.
Covers 4 Tiers (49 Test Cases) as specified in TEST_INFRA.md.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db, get_redis
from app.core.security import create_access_token
from app.crud.crud_doctor import _CLINICAL_STORE, _PRESCRIPTION_STORE, crud_doctor
from app.main import app
from app.models.prescription import Prescription
from app.models.user import User


# ==============================================================================
# In-Memory Fast Redis Mock for Isolation
# ==============================================================================
class FakeRedis:
    """In-memory Redis fake implementing async get/set/delete."""

    def __init__(self):
        self._store: Dict[str, str] = {}

    async def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._store[key] = value
        return True

    async def delete(self, key: str) -> int:
        return 1 if self._store.pop(key, None) is not None else 0

    def clear(self):
        self._store.clear()


# ==============================================================================
# In-Memory Database Session Mock for Isolation
# ==============================================================================
class MockResult:
    """Mock query execution result matching SQLAlchemy Result interface."""

    def __init__(self, items: Any):
        self._items = items if isinstance(items, list) else ([items] if items is not None else [])

    def scalars(self):
        return self

    def all(self) -> List[Any]:
        return list(self._items)

    def scalar_one_or_none(self) -> Optional[Any]:
        return self._items[0] if self._items else None

    def scalar(self) -> Optional[Any]:
        return self._items[0] if self._items else None


class FakeDB:
    """In-memory AsyncSession fake handling Prescription, ElderlyProfile, and House queries."""

    def __init__(self):
        self.prescriptions: Dict[str, Prescription] = {}

    def add(self, obj: Any):
        if isinstance(obj, Prescription):
            if not obj.id:
                obj.id = uuid.uuid4()
            if not obj.created_at:
                obj.created_at = datetime.now(timezone.utc)
            if not obj.updated_at:
                obj.updated_at = datetime.now(timezone.utc)
            self.prescriptions[str(obj.id)] = obj

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def rollback(self):
        pass

    async def close(self):
        pass

    async def refresh(self, obj: Any):
        if isinstance(obj, Prescription):
            if not obj.id:
                obj.id = uuid.uuid4()
            if not obj.created_at:
                obj.created_at = datetime.now(timezone.utc)
            if not obj.updated_at:
                obj.updated_at = datetime.now(timezone.utc)

    async def delete(self, obj: Any):
        if isinstance(obj, Prescription):
            self.prescriptions.pop(str(obj.id), None)

    async def execute(self, stmt: Any) -> MockResult:
        stmt_str = str(stmt).lower()
        params = stmt.compile().params if hasattr(stmt, "compile") else {}

        # 1. ElderlyProfile queries
        if "from elderly_profiles" in stmt_str:
            target_id = params.get("id_1") or params.get("id")
            if target_id:
                return MockResult([target_id])
            return MockResult([uuid.uuid4()])

        # 2. House queries
        if "from houses" in stmt_str:
            return MockResult([None])

        # 3. Prescription queries
        if "from prescriptions" in stmt_str:
            # By single prescription ID
            if "prescriptions.id = " in stmt_str:
                rx_id = params.get("id_1") or params.get("id")
                rx = self.prescriptions.get(str(rx_id)) if rx_id else None
                return MockResult([rx] if rx else [])

            # Filtered by patient_id, status, start_date, end_date
            pat_id = params.get("patient_id_1") or params.get("patient_id")
            status_filter = params.get("status_1") or params.get("status")
            start_date_max = params.get("start_date_1")
            end_date_min = params.get("end_date_1")

            matches: List[Prescription] = []
            for rx in self.prescriptions.values():
                if pat_id and str(rx.patient_id) != str(pat_id):
                    continue
                if status_filter and rx.status != status_filter:
                    continue
                if start_date_max:
                    rx_start = rx.start_date
                    if rx_start:
                        if rx_start.tzinfo is None:
                            rx_start = rx_start.replace(tzinfo=timezone.utc)
                        if rx_start > start_date_max:
                            continue
                if end_date_min:
                    rx_end = rx.end_date
                    if rx_end:
                        if rx_end.tzinfo is None:
                            rx_end = rx_end.replace(tzinfo=timezone.utc)
                        if rx_end < end_date_min:
                            continue
                matches.append(rx)

            if "desc" in stmt_str:
                matches.sort(
                    key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc),
                    reverse=True,
                )
            else:
                matches.sort(
                    key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc)
                )

            return MockResult(matches)

        return MockResult([])


# ==============================================================================
# Pytest Fixtures
# ==============================================================================
@pytest.fixture
def fake_redis() -> FakeRedis:
    redis = FakeRedis()
    yield redis
    redis.clear()


@pytest.fixture
def fake_db() -> FakeDB:
    db = FakeDB()
    yield db
    db.prescriptions.clear()


@pytest.fixture
def doctor_user() -> User:
    return User(
        id=uuid.uuid4(),
        full_name="BS. Trần Văn Minh",
        phone="0901234567",
        role="doctor",
        is_active=True,
    )


@pytest.fixture
def doctor_headers(doctor_user: User) -> Dict[str, str]:
    token = create_access_token(subject=str(doctor_user.id), token_version=1)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


@pytest.fixture
async def client(
    fake_redis: FakeRedis, fake_db: FakeDB, doctor_user: User
) -> AsyncGenerator[AsyncClient, None]:
    # Reset internal memory stores before test
    _PRESCRIPTION_STORE.clear()
    _CLINICAL_STORE.clear()

    # Ensure database persistence is authoritative by disabling fallback store during tests
    orig_get_prescriptions = crud_doctor.get_prescriptions
    crud_doctor.get_prescriptions = lambda eid: []

    # Set FastAPI dependency overrides
    app.dependency_overrides[get_redis] = lambda: fake_redis
    app.dependency_overrides[get_db] = lambda: fake_db
    app.dependency_overrides[get_current_user] = lambda: doctor_user
    app.dependency_overrides[get_current_user_optional] = lambda: doctor_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    # Clean up overrides and restore functions
    app.dependency_overrides.clear()
    crud_doctor.get_prescriptions = orig_get_prescriptions
    _PRESCRIPTION_STORE.clear()
    _CLINICAL_STORE.clear()


# ==============================================================================
# TIER 1: FEATURE COVERAGE (20 Tests)
# ==============================================================================

# --- F1: Doctor Prescription Creation & Management ---


@pytest.mark.anyio
async def test_tier1_create_single_medication_prescription(client: AsyncClient, doctor_headers: Dict[str, str]):
    """1. F1: Valid prescription with 1 medication persists and returns 201."""
    patient_id = str(uuid.uuid4())
    payload = {
        "diagnosis": "Tăng huyết áp vô căn",
        "medications": [
            {
                "medication_name": "Amlodipine 5mg",
                "dosage": "1 viên/lần",
                "quantity": "30 viên",
                "frequency": "Hàng ngày",
                "schedule_times": ["08:00"],
                "instructions": "Uống sau ăn sáng",
            }
        ],
    }
    response = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json=payload,
        headers=doctor_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    item = data[0]
    assert item["medication_name"] == "Amlodipine 5mg"
    assert item["dosage"] == "1 viên/lần"
    assert item["id"] is not None and item["id"] != "None"


@pytest.mark.anyio
async def test_tier1_create_batch_medications_prescription(client: AsyncClient, doctor_headers: Dict[str, str]):
    """2. F1: Batch of multiple medications (3 items) persists accurately."""
    patient_id = str(uuid.uuid4())
    payload = {
        "diagnosis": "Đa bệnh lý nội khoa",
        "medications": [
            {"medication_name": "Amlodipine 5mg", "dosage": "1 viên", "schedule_times": ["08:00"]},
            {"medication_name": "Metformin 500mg", "dosage": "1 viên", "schedule_times": ["12:00"]},
            {"medication_name": "Losartan 50mg", "dosage": "1 viên", "schedule_times": ["20:00"]},
        ],
    }
    response = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json=payload,
        headers=doctor_headers,
    )
    assert response.status_code == 201
    items = response.json()
    assert len(items) == 3
    ids = {it["id"] for it in items}
    assert len(ids) == 3  # All distinct IDs


@pytest.mark.anyio
async def test_tier1_prescription_all_fields_retained(client: AsyncClient, doctor_headers: Dict[str, str]):
    """3. F1: Verifies name, dosage, quantity, frequency, schedule_times, instructions, diagnosis, notes."""
    patient_id = str(uuid.uuid4())
    payload = {
        "diagnosis": "Rối loạn lipid máu",
        "general_notes": "Kiêng mỡ động vật, tái khám sau 30 ngày",
        "enable_speaker_reminder": True,
        "medications": [
            {
                "medication_name": "Atorvastatin 20mg",
                "dosage": "1 viên",
                "quantity": "30 viên",
                "frequency": "Mỗi tối",
                "schedule_times": ["21:00"],
                "instructions": "Uống trước khi đi ngủ",
            }
        ],
    }
    response = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json=payload,
        headers=doctor_headers,
    )
    assert response.status_code == 201
    item = response.json()[0]
    assert item["medication_name"] == "Atorvastatin 20mg"
    assert item["dosage"] == "1 viên"
    assert item["quantity"] == "30 viên"
    assert item["frequency"] == "Mỗi tối"
    assert item["schedule_times"] == ["21:00"]
    assert "Uống trước khi đi ngủ" in item["instructions"]
    assert item["diagnosis"] == "Rối loạn lipid máu"
    assert item["enable_speaker_reminder"] is True


@pytest.mark.anyio
async def test_tier1_update_existing_prescription(client: AsyncClient, doctor_headers: Dict[str, str]):
    """4. F1: Doctor updates dosage or schedule times on existing prescription."""
    patient_id = str(uuid.uuid4())
    create_res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Amlodipine 5mg", "dosage": "5mg", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    rx_id = create_res.json()[0]["id"]

    update_res = await client.put(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_id}",
        json={"dosage": "10mg", "schedule_times": ["08:00", "20:00"], "instructions": "Tăng liều theo dõi huyết áp"},
        headers=doctor_headers,
    )
    assert update_res.status_code == 200
    updated_item = update_res.json()
    assert updated_item["dosage"] == "10mg"
    assert updated_item["schedule_times"] == ["08:00", "20:00"]
    assert updated_item["instructions"] == "Tăng liều theo dõi huyết áp"


@pytest.mark.anyio
async def test_tier1_delete_prescription(client: AsyncClient, doctor_headers: Dict[str, str]):
    """5. F1: Doctor deletes prescription, verifying removal from active list."""
    patient_id = str(uuid.uuid4())
    create_res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc tạm thời", "dosage": "1 gói", "schedule_times": ["09:00"]}]},
        headers=doctor_headers,
    )
    rx_id = create_res.json()[0]["id"]

    del_res = await client.delete(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_id}",
        headers=doctor_headers,
    )
    assert del_res.status_code == 200

    list_res = await client.get(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions",
        headers=doctor_headers,
    )
    assert list_res.status_code == 200
    remaining_ids = [it["id"] for it in list_res.json()]
    assert rx_id not in remaining_ids


# --- F2: Daily Reminders Sync & Session Grouping ---


@pytest.mark.anyio
async def test_tier1_sync_morning_dose_session(client: AsyncClient, doctor_headers: Dict[str, str]):
    """6. F2: Doses before 11:00 correctly categorized as MORNING."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc sáng", "dosage": "1 viên", "schedule_times": ["08:15"]}]},
        headers=doctor_headers,
    )
    res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert res.status_code == 200
    doses = res.json()["medications"]
    assert len(doses) == 1
    assert doses[0]["session"] == "MORNING"
    assert doses[0]["time"] == "08:15"


@pytest.mark.anyio
async def test_tier1_sync_noon_dose_session(client: AsyncClient, doctor_headers: Dict[str, str]):
    """7. F2: Doses between 11:00 and 14:00 categorized as NOON."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc trưa", "dosage": "1 gói", "schedule_times": ["12:30"]}]},
        headers=doctor_headers,
    )
    res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert res.status_code == 200
    doses = res.json()["medications"]
    assert len(doses) == 1
    assert doses[0]["session"] == "NOON"
    assert doses[0]["time"] == "12:30"


@pytest.mark.anyio
async def test_tier1_sync_evening_dose_session(client: AsyncClient, doctor_headers: Dict[str, str]):
    """8. F2: Doses at or after 14:00 categorized as EVENING."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc tối", "dosage": "1 viên", "schedule_times": ["18:45"]}]},
        headers=doctor_headers,
    )
    res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert res.status_code == 200
    doses = res.json()["medications"]
    assert len(doses) == 1
    assert doses[0]["session"] == "EVENING"
    assert doses[0]["time"] == "18:45"


@pytest.mark.anyio
async def test_tier1_deterministic_dose_id_format(client: AsyncClient, doctor_headers: Dict[str, str]):
    """9. F2: Dose ID matches rx-med-{prescription_id}-{hhmm} format."""
    patient_id = str(uuid.uuid4())
    post_res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc kiểm tra ID", "dosage": "1 viên", "schedule_times": ["09:30"]}]},
        headers=doctor_headers,
    )
    rx_id = post_res.json()[0]["id"]

    res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose = res.json()["medications"][0]
    expected_prefix = f"rx-med-{rx_id}-0930"
    assert dose["id"] == expected_prefix
    assert re.match(r"^rx-med-[0-9a-fA-F-]+-\d{4}$", dose["id"])


@pytest.mark.anyio
async def test_tier1_route_alias_parity(client: AsyncClient, doctor_headers: Dict[str, str]):
    """10. F2: GET /api/v1/mobile/reminders/today and GET /api/v1/reminders/today return identical payload."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc Parity", "dosage": "1 viên", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    res_base = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    res_mobile = await client.get(f"/api/v1/mobile/reminders/today?patient_id={patient_id}")

    assert res_base.status_code == 200
    assert res_mobile.status_code == 200
    assert res_base.json() == res_mobile.json()


# --- F3: Dose Intake Completion & State Toggle ---


@pytest.mark.anyio
async def test_tier1_toggle_dose_taken(client: AsyncClient, doctor_headers: Dict[str, str]):
    """11. F3: Marking dose taken updates taken: true and records takenAt timestamp."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc uống", "dosage": "1 viên", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    rem_res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose_id = rem_res.json()["medications"][0]["id"]

    toggle_res = await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")
    assert toggle_res.status_code == 200
    body = toggle_res.json()
    assert body["taken"] is True
    assert body["takenAt"] is not None


@pytest.mark.anyio
async def test_tier1_untoggle_dose_taken(client: AsyncClient, doctor_headers: Dict[str, str]):
    """12. F3: Toggling again untoggles dose back to taken: false and takenAt: null."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc uống", "dosage": "1 viên", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    rem_res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose_id = rem_res.json()["medications"][0]["id"]

    # First toggle: Taken
    await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")
    # Second toggle: Untaken
    t2 = await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")
    assert t2.status_code == 200
    body = t2.json()
    assert body["taken"] is False
    assert body["takenAt"] is None


@pytest.mark.anyio
async def test_tier1_today_endpoint_reflects_toggle(client: AsyncClient, doctor_headers: Dict[str, str]):
    """13. F3: Calling GET .../reminders/today immediately reflects updated taken status."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc kiểm tra reflect", "dosage": "1 viên", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    r_initial = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose_id = r_initial.json()["medications"][0]["id"]

    await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")

    r_after = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    med = r_after.json()["medications"][0]
    assert med["taken"] is True
    assert med["takenAt"] is not None


@pytest.mark.anyio
async def test_tier1_completed_medications_count_updates(client: AsyncClient, doctor_headers: Dict[str, str]):
    """14. F3: Total medications vs completed medications counter accurately increments."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "medications": [
                {"medication_name": "Thuốc 1", "dosage": "1 viên", "schedule_times": ["08:00"]},
                {"medication_name": "Thuốc 2", "dosage": "1 viên", "schedule_times": ["12:00"]},
            ]
        },
        headers=doctor_headers,
    )
    r1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert r1.json()["total_medications"] == 2
    assert r1.json()["completed_medications"] == 0

    dose1_id = r1.json()["medications"][0]["id"]
    await client.put(f"/api/v1/reminders/{dose1_id}/toggle?patient_id={patient_id}")

    r2 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert r2.json()["total_medications"] == 2
    assert r2.json()["completed_medications"] == 1


@pytest.mark.anyio
async def test_tier1_independent_dose_toggling(client: AsyncClient, doctor_headers: Dict[str, str]):
    """15. F3: Toggling dose A does not mutate dose B status."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "medications": [
                {"medication_name": "Dose A", "dosage": "1 viên", "schedule_times": ["08:00"]},
                {"medication_name": "Dose B", "dosage": "1 viên", "schedule_times": ["20:00"]},
            ]
        },
        headers=doctor_headers,
    )
    init_res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    doses = init_res.json()["medications"]
    dose_a_id = doses[0]["id"]
    dose_b_id = doses[1]["id"]

    # Toggle Dose A
    await client.put(f"/api/v1/reminders/{dose_a_id}/toggle?patient_id={patient_id}")

    after_res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    med_map = {m["id"]: m for m in after_res.json()["medications"]}
    assert med_map[dose_a_id]["taken"] is True
    assert med_map[dose_b_id]["taken"] is False


# --- F4: Clean Empty States & Zero Fake Data ---


@pytest.mark.anyio
async def test_tier1_empty_state_new_patient(client: AsyncClient):
    """16. F4: Patient with zero prescriptions receives empty list [] and count 0."""
    new_patient_id = str(uuid.uuid4())
    res = await client.get(f"/api/v1/reminders/today?patient_id={new_patient_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["total_medications"] == 0
    assert data["completed_medications"] == 0
    assert data["medications"] == []


@pytest.mark.anyio
async def test_tier1_empty_state_no_fake_data(client: AsyncClient):
    """17. F4: Response body contains zero mock, hardcoded, or demo drug names."""
    new_patient_id = str(uuid.uuid4())
    res = await client.get(f"/api/v1/reminders/today?patient_id={new_patient_id}")
    raw_text = res.text.lower()
    forbidden_fakes = ["panadol", "paracetamol", "aspirin", "demo drug", "mock dose"]
    for fake in forbidden_fakes:
        assert fake not in raw_text


@pytest.mark.anyio
async def test_tier1_empty_state_doctor_prescriptions_list(client: AsyncClient):
    """18. F4: doctor_prescriptions list is empty for patient without active Rx."""
    new_patient_id = str(uuid.uuid4())
    res = await client.get(f"/api/v1/reminders/today?patient_id={new_patient_id}")
    data = res.json()
    assert data.get("doctor_prescriptions") == []


@pytest.mark.anyio
async def test_tier1_empty_state_toggle_nonexistent_dose(client: AsyncClient):
    """19. F4: Attempting to toggle non-existent dose returns 404."""
    patient_id = str(uuid.uuid4())
    res = await client.put(f"/api/v1/reminders/nonexistent-dose-uuid-999/toggle?patient_id={patient_id}")
    assert res.status_code == 404


@pytest.mark.anyio
async def test_tier1_empty_state_patient_not_found(client: AsyncClient, doctor_headers: Dict[str, str]):
    """20. F4: Querying doctor prescriptions for non-existent patient ID returns clean empty structure."""
    unknown_id = str(uuid.uuid4())
    res = await client.get(f"/api/v1/doctor/patients/{unknown_id}/prescriptions", headers=doctor_headers)
    assert res.status_code == 200
    assert res.json() == []


# ==============================================================================
# TIER 2: BOUNDARY & CORNER CASES (20 Tests)
# ==============================================================================

# --- F1 Boundaries ---


@pytest.mark.anyio
async def test_tier2_prescription_start_date_today_end_date_today(client: AsyncClient, doctor_headers: Dict[str, str]):
    """21. F1: Single-day valid prescription starting today and ending today."""
    patient_id = str(uuid.uuid4())
    today_now = datetime.now(timezone.utc)
    today_start = today_now.replace(hour=0, minute=0, second=0)
    today_end = today_now.replace(hour=23, minute=59, second=59)

    res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": today_start.isoformat(),
            "end_date": today_end.isoformat(),
            "medications": [{"medication_name": "Thuốc 1 ngày", "dosage": "1 viên", "schedule_times": ["09:00"]}],
        },
        headers=doctor_headers,
    )
    assert res.status_code == 201

    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem.json()["medications"]) == 1


@pytest.mark.anyio
async def test_tier2_prescription_end_date_before_start_date(client: AsyncClient, doctor_headers: Dict[str, str]):
    """22. F1: Inverted date range handled safely (rejected with 400/422 or produces 0 active doses today)."""
    patient_id = str(uuid.uuid4())
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)

    res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": tomorrow.isoformat(),
            "end_date": yesterday.isoformat(),
            "medications": [{"medication_name": "Thuốc nghịch đảo", "dosage": "1 viên", "schedule_times": ["08:00"]}],
        },
        headers=doctor_headers,
    )
    assert res.status_code == 201
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert rem.status_code == 200
    assert len(rem.json()["medications"]) == 0


@pytest.mark.anyio
async def test_tier2_empty_schedule_times_list(client: AsyncClient, doctor_headers: Dict[str, str]):
    """23. F1: Prescription with empty schedule_times: [] handled gracefully."""
    patient_id = str(uuid.uuid4())
    res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc không hẹn giờ", "dosage": "1 viên", "schedule_times": []}]},
        headers=doctor_headers,
    )
    assert res.status_code == 201
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert rem.status_code == 200


@pytest.mark.anyio
async def test_tier2_maximum_schedule_times(client: AsyncClient, doctor_headers: Dict[str, str]):
    """24. F1: Prescription with 12 doses throughout the day handles all timestamps."""
    patient_id = str(uuid.uuid4())
    twelve_times = [f"{h:02d}:00" for h in range(6, 18)]  # 06:00 to 17:00
    res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc 12 cữ", "dosage": "10ml", "schedule_times": twelve_times}]},
        headers=doctor_headers,
    )
    assert res.status_code == 201
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    doses = rem.json()["medications"]
    assert len(doses) == 12
    returned_times = [d["time"] for d in doses]
    assert returned_times == twelve_times


@pytest.mark.anyio
async def test_tier2_special_characters_in_medication_fields(client: AsyncClient, doctor_headers: Dict[str, str]):
    """25. F1: Vietnamese Unicode names, accents, symbols, long instructions preserved."""
    patient_id = str(uuid.uuid4())
    complex_name = "Thuốc hạ áp tiếng Việt & đái tháo đường (Hasan 500mg)"
    complex_dosage = "1½ viên/ngày (sáng 1v, chiều ½v)"
    complex_instructions = "Uống sau ăn 15 phút. Tuyệt đối không dùng chung với rượu bia & nước ép bưởi chùm! (Lưu ý đặc biệt: #123)"
    res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "medications": [
                {
                    "medication_name": complex_name,
                    "dosage": complex_dosage,
                    "schedule_times": ["08:00"],
                    "instructions": complex_instructions,
                }
            ]
        },
        headers=doctor_headers,
    )
    assert res.status_code == 201
    item = res.json()[0]
    assert item["medication_name"] == complex_name
    assert item["dosage"] == complex_dosage
    assert complex_instructions in item["instructions"]


# --- F2 Boundaries ---


@pytest.mark.anyio
async def test_tier2_boundary_time_10_59_morning(client: AsyncClient, doctor_headers: Dict[str, str]):
    """26. F2: 10:59 is classified as MORNING (< 11:00)."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "T1059", "dosage": "1", "schedule_times": ["10:59"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert rem.json()["medications"][0]["session"] == "MORNING"


@pytest.mark.anyio
async def test_tier2_boundary_time_11_00_noon(client: AsyncClient, doctor_headers: Dict[str, str]):
    """27. F2: 11:00 is classified as NOON."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "T1100", "dosage": "1", "schedule_times": ["11:00"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert rem.json()["medications"][0]["session"] == "NOON"


@pytest.mark.anyio
async def test_tier2_boundary_time_13_59_noon(client: AsyncClient, doctor_headers: Dict[str, str]):
    """28. F2: 13:59 is classified as NOON (< 14:00)."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "T1359", "dosage": "1", "schedule_times": ["13:59"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert rem.json()["medications"][0]["session"] == "NOON"


@pytest.mark.anyio
async def test_tier2_boundary_time_14_00_evening(client: AsyncClient, doctor_headers: Dict[str, str]):
    """29. F2: 14:00 is classified as EVENING (>= 14:00)."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "T1400", "dosage": "1", "schedule_times": ["14:00"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert rem.json()["medications"][0]["session"] == "EVENING"


@pytest.mark.anyio
async def test_tier2_midnight_dose_00_00(client: AsyncClient, doctor_headers: Dict[str, str]):
    """30. F2: Midnight 00:00 dose correctly handled without crash or date rollover bug."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "T0000", "dosage": "1", "schedule_times": ["00:00"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose = rem.json()["medications"][0]
    assert dose["time"] == "00:00"
    assert dose["session"] == "MORNING"
    assert dose["id"].endswith("0000")


# --- F3 Boundaries ---


@pytest.mark.anyio
async def test_tier2_toggle_with_malformed_dose_id(client: AsyncClient):
    """31. F3: Invalid string id (malformed) rejected with 404."""
    patient_id = str(uuid.uuid4())
    res = await client.put(f"/api/v1/reminders/malformed-id-not-found/toggle?patient_id={patient_id}")
    assert res.status_code == 404


@pytest.mark.anyio
async def test_tier2_toggle_wrong_patient_id(client: AsyncClient, doctor_headers: Dict[str, str]):
    """32. F3: Toggling dose belonging to patient A with patient B id fails safely."""
    patient_a = str(uuid.uuid4())
    patient_b = str(uuid.uuid4())

    await client.post(
        f"/api/v1/doctor/patients/{patient_a}/prescriptions/batch",
        json={"medications": [{"medication_name": "Thuốc A", "dosage": "1", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    rem_a = await client.get(f"/api/v1/reminders/today?patient_id={patient_a}")
    dose_a_id = rem_a.json()["medications"][0]["id"]

    # Patient B tries to toggle patient A's dose
    toggle_res = await client.put(f"/api/v1/reminders/{dose_a_id}/toggle?patient_id={patient_b}")
    # Verify patient A's dose status was not corrupted
    rem_a_check = await client.get(f"/api/v1/reminders/today?patient_id={patient_a}")
    assert rem_a_check.json()["medications"][0]["taken"] is False


@pytest.mark.anyio
async def test_tier2_rapid_sequential_toggles(client: AsyncClient, doctor_headers: Dict[str, str]):
    """33. F3: 5 rapid sequential toggles back-and-forth results in consistent final state."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Rapid", "dosage": "1", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose_id = rem.json()["medications"][0]["id"]

    # 5 toggles: 1->True, 2->False, 3->True, 4->False, 5->True
    for _ in range(5):
        await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")

    final_rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert final_rem.json()["medications"][0]["taken"] is True


@pytest.mark.anyio
async def test_tier2_toggle_with_missing_query_param(client: AsyncClient, doctor_headers: Dict[str, str]):
    """34. F3: Omitting patient_id in toggle handled safely without server 500 error."""
    res = await client.put("/api/v1/reminders/rx-med-sample-0800/toggle")
    assert res.status_code in (200, 404, 422)
    assert res.status_code != 500


@pytest.mark.anyio
async def test_tier2_intake_timestamp_in_iso_or_hhmm_format(client: AsyncClient, doctor_headers: Dict[str, str]):
    """35. F3: takenAt matches standard HH:MM time formatting or ISO timestamp."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Timestamp Test", "dosage": "1", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose_id = rem.json()["medications"][0]["id"]

    res = await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")
    taken_at = res.json()["takenAt"]
    assert taken_at is not None
    # Matches either HH:MM or ISO timestamp
    assert re.match(r"^\d{2}:\d{2}$", taken_at) or re.match(r"^\d{4}-\d{2}-\d{2}", taken_at)


# --- F4 Boundaries ---


@pytest.mark.anyio
async def test_tier2_prescription_expired_yesterday(client: AsyncClient, doctor_headers: Dict[str, str]):
    """36. F4: Prescription that ended yesterday generates 0 doses for today."""
    patient_id = str(uuid.uuid4())
    start_dt = datetime.now(timezone.utc) - timedelta(days=10)
    end_dt = datetime.now(timezone.utc) - timedelta(days=1)

    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": start_dt.isoformat(),
            "end_date": end_dt.isoformat(),
            "medications": [{"medication_name": "Thuốc đã hết hạn", "dosage": "1", "schedule_times": ["08:00"]}],
        },
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem.json()["medications"]) == 0


@pytest.mark.anyio
async def test_tier2_prescription_starts_tomorrow(client: AsyncClient, doctor_headers: Dict[str, str]):
    """37. F4: Prescription starting tomorrow generates 0 doses for today."""
    patient_id = str(uuid.uuid4())
    start_dt = datetime.now(timezone.utc) + timedelta(days=1)
    end_dt = datetime.now(timezone.utc) + timedelta(days=7)

    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": start_dt.isoformat(),
            "end_date": end_dt.isoformat(),
            "medications": [{"medication_name": "Thuốc ngày mai bắt đầu", "dosage": "1", "schedule_times": ["08:00"]}],
        },
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem.json()["medications"]) == 0


@pytest.mark.anyio
async def test_tier2_prescription_starts_today_00_00(client: AsyncClient, doctor_headers: Dict[str, str]):
    """38. F4: Active starting today generates doses immediately."""
    patient_id = str(uuid.uuid4())
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    end_dt = today_start + timedelta(days=7)

    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": today_start.isoformat(),
            "end_date": end_dt.isoformat(),
            "medications": [{"medication_name": "Thuốc bắt đầu hôm nay", "dosage": "1", "schedule_times": ["08:00"]}],
        },
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem.json()["medications"]) == 1


@pytest.mark.anyio
async def test_tier2_prescription_ends_today_23_59(client: AsyncClient, doctor_headers: Dict[str, str]):
    """39. F4: Active ending today generates doses immediately."""
    patient_id = str(uuid.uuid4())
    start_dt = datetime.now(timezone.utc) - timedelta(days=7)
    today_end = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)

    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": start_dt.isoformat(),
            "end_date": today_end.isoformat(),
            "medications": [{"medication_name": "Thuốc kết thúc hôm nay", "dosage": "1", "schedule_times": ["08:00"]}],
        },
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem.json()["medications"]) == 1


@pytest.mark.anyio
async def test_tier2_multiple_prescriptions_one_expired_one_active(client: AsyncClient, doctor_headers: Dict[str, str]):
    """40. F4: Only active prescription's doses appear in today's schedule."""
    patient_id = str(uuid.uuid4())
    # Expired
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
            "end_date": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
            "medications": [{"medication_name": "Thuốc cũ", "dosage": "1", "schedule_times": ["08:00"]}],
        },
        headers=doctor_headers,
    )
    # Active
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
            "medications": [{"medication_name": "Thuốc mới", "dosage": "1", "schedule_times": ["12:00"]}],
        },
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    doses = rem.json()["medications"]
    assert len(doses) == 1
    assert doses[0]["name"] == "Thuốc mới"


# ==============================================================================
# TIER 3: PAIRWISE CROSS-FEATURE INTERACTIONS (4 Tests)
# ==============================================================================


@pytest.mark.anyio
async def test_tier3_pairwise_multi_prescription_multi_session(client: AsyncClient, doctor_headers: Dict[str, str]):
    """41. Pairwise: Multi-prescription multi-session correctly aggregated."""
    patient_id = str(uuid.uuid4())
    # Rx 1: Morning & Noon
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Rx 1", "dosage": "1v", "schedule_times": ["08:00", "12:00"]}]},
        headers=doctor_headers,
    )
    # Rx 2: Evening
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Rx 2", "dosage": "1v", "schedule_times": ["20:00"]}]},
        headers=doctor_headers,
    )
    rem = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    doses = rem.json()["medications"]
    assert len(doses) == 3

    sessions = {d["session"] for d in doses}
    assert sessions == {"MORNING", "NOON", "EVENING"}


@pytest.mark.anyio
async def test_tier3_pairwise_create_update_toggle_cycle(client: AsyncClient, doctor_headers: Dict[str, str]):
    """42. Pairwise: Doctor creates Rx -> Mobile toggles dose -> Doctor updates Rx -> Dose remains taken."""
    patient_id = str(uuid.uuid4())
    create_res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Amlodipine", "dosage": "5mg", "schedule_times": ["08:00"], "instructions": "Uống sau ăn"}]},
        headers=doctor_headers,
    )
    rx_id = create_res.json()[0]["id"]

    rem1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose_id = rem1.json()["medications"][0]["id"]

    # Mobile toggles dose
    await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")

    # Doctor updates instructions
    await client.put(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_id}",
        json={"instructions": "Uống sau ăn no với nhiều nước"},
        headers=doctor_headers,
    )

    # Mobile verifies dose remains taken and instructions are updated
    rem2 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose = rem2.json()["medications"][0]
    assert dose["taken"] is True
    assert dose["instructions"] == "Uống sau ăn no với nhiều nước"


@pytest.mark.anyio
async def test_tier3_pairwise_batch_create_and_multi_dose_toggle(client: AsyncClient, doctor_headers: Dict[str, str]):
    """43. Pairwise: Batch create 3 meds -> Toggle 2 -> Completion ratio is 2/3."""
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "medications": [
                {"medication_name": "Med 1", "dosage": "1", "schedule_times": ["08:00"]},
                {"medication_name": "Med 2", "dosage": "1", "schedule_times": ["12:00"]},
                {"medication_name": "Med 3", "dosage": "1", "schedule_times": ["20:00"]},
            ]
        },
        headers=doctor_headers,
    )
    rem1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    doses = rem1.json()["medications"]

    # Toggle 2 of 3
    await client.put(f"/api/v1/reminders/{doses[0]['id']}/toggle?patient_id={patient_id}")
    await client.put(f"/api/v1/reminders/{doses[1]['id']}/toggle?patient_id={patient_id}")

    rem2 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert rem2.json()["total_medications"] == 3
    assert rem2.json()["completed_medications"] == 2


@pytest.mark.anyio
async def test_tier3_pairwise_delete_prescription_clears_reminders(client: AsyncClient, doctor_headers: Dict[str, str]):
    """44. Pairwise: Doctor deletes active prescription -> Mobile schedule drops associated doses immediately."""
    patient_id = str(uuid.uuid4())
    create_res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Rx To Delete", "dosage": "1", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    rx_id = create_res.json()[0]["id"]

    rem1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem1.json()["medications"]) == 1

    # Doctor deletes Rx
    await client.delete(f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_id}", headers=doctor_headers)

    rem2 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem2.json()["medications"]) == 0
    assert rem2.json()["total_medications"] == 0


# ==============================================================================
# TIER 4: REAL-WORLD CLINICAL SCENARIOS (5 Tests)
# ==============================================================================


@pytest.mark.anyio
async def test_tier4_elderly_hypertension_daily_regimen(client: AsyncClient, doctor_headers: Dict[str, str]):
    """
    45. Clinical: 30-day elderly hypertension regimen (Amlodipine 5mg morning, Losartan 50mg evening).
    Verifies morning check, morning dose taken, midday state preservation, evening dose taken, 100% completion.
    """
    patient_id = str(uuid.uuid4())
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=30)

    # 1. Doctor prescribes 30-day regimen
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "diagnosis": "Tăng huyết áp nguyên phát độ 2",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "medications": [
                {
                    "medication_name": "Amlodipine 5mg",
                    "dosage": "1 viên",
                    "schedule_times": ["08:00"],
                    "instructions": "Uống sau ăn sáng",
                },
                {
                    "medication_name": "Losartan 50mg",
                    "dosage": "1 viên",
                    "schedule_times": ["20:00"],
                    "instructions": "Uống sau ăn tối",
                },
            ],
        },
        headers=doctor_headers,
    )

    # 2. Morning check
    morning_check = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    doses = morning_check.json()["medications"]
    assert len(doses) == 2
    assert morning_check.json()["completed_medications"] == 0

    amlo_dose = next(d for d in doses if "Amlodipine" in d["name"])
    losartan_dose = next(d for d in doses if "Losartan" in d["name"])

    # 3. Patient takes Amlodipine at 08:15
    t1 = await client.put(f"/api/v1/reminders/{amlo_dose['id']}/toggle?patient_id={patient_id}")
    assert t1.json()["taken"] is True

    # 4. Midday check
    midday_check = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert midday_check.json()["completed_medications"] == 1
    m_doses = {d["id"]: d for d in midday_check.json()["medications"]}
    assert m_doses[amlo_dose["id"]]["taken"] is True
    assert m_doses[losartan_dose["id"]]["taken"] is False

    # 5. Evening: Patient takes Losartan at 20:05
    t2 = await client.put(f"/api/v1/reminders/{losartan_dose['id']}/toggle?patient_id={patient_id}")
    assert t2.json()["taken"] is True

    # 6. End-of-day check: 100% completion
    final_check = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert final_check.json()["completed_medications"] == 2
    assert final_check.json()["total_medications"] == 2


@pytest.mark.anyio
async def test_tier4_acute_antibiotic_treatment_course(client: AsyncClient, doctor_headers: Dict[str, str]):
    """
    46. Clinical: Acute antibiotic treatment course (Amoxicillin 500mg, 3 times/day for 7 days).
    Verifies dose generation during the 7-day window and disappearance when course expires.
    """
    patient_id = str(uuid.uuid4())
    start_dt = datetime.now(timezone.utc)
    end_dt = start_dt + timedelta(days=7)

    # 1. Active 7-day course
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "diagnosis": "Nhiễm khuẩn đường hô hấp trên cấp tính",
            "start_date": start_dt.isoformat(),
            "end_date": end_dt.isoformat(),
            "medications": [
                {
                    "medication_name": "Amoxicillin 500mg",
                    "dosage": "1 viên",
                    "schedule_times": ["08:00", "13:00", "19:00"],
                    "instructions": "Uống sau ăn, uống đủ 7 ngày",
                }
            ],
        },
        headers=doctor_headers,
    )
    rem_active = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert len(rem_active.json()["medications"]) == 3

    # 2. Expired course simulation
    exp_patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{exp_patient_id}/prescriptions/batch",
        json={
            "diagnosis": "Đợt kháng sinh đã kết thúc",
            "start_date": (datetime.now(timezone.utc) - timedelta(days=14)).isoformat(),
            "end_date": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
            "medications": [
                {"medication_name": "Amoxicillin 500mg", "dosage": "1 viên", "schedule_times": ["08:00", "13:00", "19:00"]}
            ],
        },
        headers=doctor_headers,
    )
    rem_expired = await client.get(f"/api/v1/reminders/today?patient_id={exp_patient_id}")
    assert len(rem_expired.json()["medications"]) == 0


@pytest.mark.anyio
async def test_tier4_concurrent_doctor_adjustment_and_patient_intake(
    client: AsyncClient, doctor_headers: Dict[str, str]
):
    """
    47. Clinical: Patient takes morning dose, doctor adjusts evening dose time.
    Morning taken state is preserved, evening dose reflects doctor update.
    """
    patient_id = str(uuid.uuid4())
    create_res = await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={
            "medications": [
                {"medication_name": "Thuốc A", "dosage": "1", "schedule_times": ["08:00"]},
                {"medication_name": "Thuốc B", "dosage": "1", "schedule_times": ["19:00"]},
            ]
        },
        headers=doctor_headers,
    )
    rx_b_id = create_res.json()[1]["id"]

    # Patient takes morning dose
    rem1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    dose_a_id = rem1.json()["medications"][0]["id"]
    await client.put(f"/api/v1/reminders/{dose_a_id}/toggle?patient_id={patient_id}")

    # Doctor adjusts evening dose time from 19:00 to 20:00
    await client.put(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_b_id}",
        json={"schedule_times": ["20:00"]},
        headers=doctor_headers,
    )

    # Verify morning dose is still taken, evening dose is now at 20:00
    rem2 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    med_map = {m["name"]: m for m in rem2.json()["medications"]}
    assert med_map["Thuốc A"]["taken"] is True
    assert med_map["Thuốc B"]["time"] == "20:00"


@pytest.mark.anyio
async def test_tier4_multiple_patients_isolation(client: AsyncClient, doctor_headers: Dict[str, str]):
    """
    48. Clinical: Patient A and Patient B have different prescriptions and schedules.
    Changes and toggles on Patient A never leak or alter Patient B's reminders.
    """
    patient_a = str(uuid.uuid4())
    patient_b = str(uuid.uuid4())

    # Patient A: Metformin at 08:00
    await client.post(
        f"/api/v1/doctor/patients/{patient_a}/prescriptions/batch",
        json={"medications": [{"medication_name": "Metformin 500mg", "dosage": "1 viên", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )
    # Patient B: Aspirin at 09:00
    await client.post(
        f"/api/v1/doctor/patients/{patient_b}/prescriptions/batch",
        json={"medications": [{"medication_name": "Aspirin 81mg", "dosage": "1 viên", "schedule_times": ["09:00"]}]},
        headers=doctor_headers,
    )

    # Patient A takes medication
    rem_a = await client.get(f"/api/v1/reminders/today?patient_id={patient_a}")
    dose_a_id = rem_a.json()["medications"][0]["id"]
    await client.put(f"/api/v1/reminders/{dose_a_id}/toggle?patient_id={patient_a}")

    # Verify Patient A is taken, Patient B is untaken
    rem_a_final = await client.get(f"/api/v1/reminders/today?patient_id={patient_a}")
    rem_b_final = await client.get(f"/api/v1/reminders/today?patient_id={patient_b}")

    assert rem_a_final.json()["medications"][0]["taken"] is True
    assert rem_b_final.json()["medications"][0]["taken"] is False
    assert rem_a_final.json()["medications"][0]["name"] == "Metformin 500mg"
    assert rem_b_final.json()["medications"][0]["name"] == "Aspirin 81mg"


@pytest.mark.anyio
async def test_tier4_failover_and_idempotent_sync(client: AsyncClient, doctor_headers: Dict[str, str]):
    """
    49. Clinical: Network retries simulating duplicate mobile GET and PUT calls.
    Yields idempotent results without duplicate doses.
    """
    patient_id = str(uuid.uuid4())
    await client.post(
        f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
        json={"medications": [{"medication_name": "Idempotent Med", "dosage": "1", "schedule_times": ["08:00"]}]},
        headers=doctor_headers,
    )

    # 3 duplicate GET requests simulate network retry
    r1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    r2 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    r3 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")

    assert len(r1.json()["medications"]) == 1
    assert len(r2.json()["medications"]) == 1
    assert len(r3.json()["medications"]) == 1
    assert r1.json() == r2.json() == r3.json()

    dose_id = r1.json()["medications"][0]["id"]
    # Toggle to true
    t1 = await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")
    assert t1.json()["taken"] is True
    # Subsequent GET is deterministic
    after_t1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
    assert after_t1.json()["medications"][0]["taken"] is True

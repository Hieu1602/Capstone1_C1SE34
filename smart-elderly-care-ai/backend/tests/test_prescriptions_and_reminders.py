"""
test_prescriptions_and_reminders.py – Automated Pytest Suite for
Prescriptions & Daily Reminder Engine (Milestone 1).
Tests DB persistence, session grouping, bidirectional sync, route aliases, and dose toggling.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import uuid
import pytest
from fastapi import FastAPI
import httpx
from sqlalchemy import select, delete

from app.api.v1.api import api_router
from app.core.database import AsyncSessionFactory, engine, get_db, get_redis
from app.models.user import User
from app.models.house import House
from app.models.elderly_profile import ElderlyProfile
from app.models.prescription import Prescription
from app.schemas.doctor import (
    BatchPrescriptionCreate,
    MedicationItemCreate,
    PrescriptionCreate,
    PrescriptionUpdate,
)
from app.crud.crud_doctor import crud_doctor


class FakeRedis:
    """In-memory Redis implementation for fast, reliable unit testing."""

    def __init__(self):
        self._store: Dict[str, str] = {}

    async def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._store[key] = value
        return True

    async def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None

    def clear(self):
        self._store.clear()


@pytest.fixture
def fake_redis():
    return FakeRedis()


@pytest.fixture(autouse=True)
async def cleanup_db_connections():
    """Ensure engine connection pool is cleanly closed between different test event loops."""
    await engine.dispose()
    yield
    await engine.dispose()


@pytest.fixture
def test_app(fake_redis):
    """Clean FastAPI application instance without background MQTT threads."""
    app = FastAPI(title="Test SECA Backend")
    app.include_router(api_router, prefix="/api/v1")
    app.dependency_overrides[get_redis] = lambda: fake_redis
    yield app
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Test Batch Prescription Creation & DB Persistence
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_batch_prescription_creation_and_persistence(test_app, fake_redis):
    patient_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    end_iso = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test") as client:
        # 1. Tạo đơn thuốc gồm 2 loại thuốc
        payload = {
            "diagnosis": "Tăng huyết áp vô căn",
            "general_notes": "Uống sau ăn sáng và tối",
            "enable_speaker_reminder": True,
            "start_date": now_iso,
            "end_date": end_iso,
            "medications": [
                {
                    "medication_name": "Amlodipine 5mg",
                    "dosage": "1 viên/lần",
                    "quantity": "30 viên",
                    "frequency": "Hàng ngày",
                    "schedule_times": ["08:00"],
                    "instructions": "Uống sau ăn 15 phút",
                },
                {
                    "medication_name": "Losartan 50mg",
                    "dosage": "1 viên/lần",
                    "quantity": "30 viên",
                    "frequency": "Hàng ngày",
                    "schedule_times": ["20:00"],
                    "instructions": "Uống trước khi đi ngủ",
                },
            ],
        }

        res = await client.post(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
            json=payload,
        )
        assert res.status_code == 201
        created_items = res.json()
        assert len(created_items) == 2
        assert created_items[0]["medication_name"] == "Amlodipine 5mg"
        assert created_items[1]["medication_name"] == "Losartan 50mg"
        assert created_items[0]["schedule_times"] == ["08:00"]
        assert created_items[1]["schedule_times"] == ["20:00"]

        # 2. Truy vấn lại danh sách đơn thuốc của bệnh nhân
        res_get = await client.get(f"/api/v1/doctor/patients/{patient_id}/prescriptions")
        assert res_get.status_code == 200
        rx_list = res_get.json()
        assert len(rx_list) == 2
        names = [r["medication_name"] for r in rx_list]
        assert "Amlodipine 5mg" in names
        assert "Losartan 50mg" in names


# ---------------------------------------------------------------------------
# 2. Test Retrieving Daily Reminders & Route Alias
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_retrieving_daily_reminders_and_route_alias(test_app, fake_redis):
    patient_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    end_iso = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test") as client:
        # Kê đơn 1 loại thuốc
        await client.post(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
            json={
                "diagnosis": "Đái tháo đường type 2",
                "enable_speaker_reminder": True,
                "start_date": now_iso,
                "end_date": end_iso,
                "medications": [
                    {
                        "medication_name": "Metformin 500mg",
                        "dosage": "1 viên/lần",
                        "quantity": "60 viên",
                        "frequency": "Hàng ngày",
                        "schedule_times": ["08:30"],
                        "instructions": "Uống trong bữa ăn",
                    }
                ],
            },
        )

        # 1. Gọi route gốc /api/v1/reminders/today
        res1 = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["total_medications"] == 1
        assert data1["medications"][0]["name"] == "Metformin 500mg"
        assert data1["medications"][0]["time"] == "08:30"
        assert data1["medications"][0]["session"] == "MORNING"
        assert data1["medications"][0]["taken"] is False

        # 2. Gọi route alias /api/v1/mobile/reminders/today
        res2 = await client.get(f"/api/v1/mobile/reminders/today?patient_id={patient_id}")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["total_medications"] == 1
        assert data2["medications"][0]["id"] == data1["medications"][0]["id"]
        assert data2["medications"][0]["name"] == "Metformin 500mg"


# ---------------------------------------------------------------------------
# 3. Test Session Grouping (MORNING, NOON, EVENING)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_session_grouping_morning_noon_evening(test_app, fake_redis):
    patient_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    end_iso = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test") as client:
        await client.post(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
            json={
                "diagnosis": "Đa bệnh lý người cao tuổi",
                "enable_speaker_reminder": True,
                "start_date": now_iso,
                "end_date": end_iso,
                "medications": [
                    {
                        "medication_name": "Thuốc Sáng",
                        "dosage": "1 viên",
                        "schedule_times": ["07:00"],  # < 11:00 -> MORNING
                    },
                    {
                        "medication_name": "Thuốc Trưa",
                        "dosage": "1 viên",
                        "schedule_times": ["12:30"],  # 11:00 <= t < 14:00 -> NOON
                    },
                    {
                        "medication_name": "Thuốc Tối",
                        "dosage": "1 viên",
                        "schedule_times": ["19:30"],  # >= 14:00 -> EVENING
                    },
                ],
            },
        )

        res = await client.get(f"/api/v1/mobile/reminders/today?patient_id={patient_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["total_medications"] == 3

        session_map = {m["name"]: m["session"] for m in data["medications"]}
        assert session_map["Thuốc Sáng"] == "MORNING"
        assert session_map["Thuốc Trưa"] == "NOON"
        assert session_map["Thuốc Tối"] == "EVENING"

        for m in data["medications"]:
            assert m["id"].startswith("rx-med-")
            assert m["time"].replace(":", "") in m["id"]


# ---------------------------------------------------------------------------
# 4. Test Toggle Dose Taken State (PUT /toggle)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_toggling_dose_taken_state_and_taken_at(test_app, fake_redis):
    patient_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test") as client:
        # Kê đơn thuốc
        await client.post(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
            json={
                "diagnosis": "Hạ mỡ máu",
                "medications": [
                    {
                        "medication_name": "Atorvastatin 10mg",
                        "dosage": "1 viên",
                        "schedule_times": ["21:00"],
                    }
                ],
            },
        )

        # Lấy lịch nhắc nhở hôm nay
        res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
        assert res.status_code == 200
        med = res.json()["medications"][0]
        dose_id = med["id"]
        assert med["taken"] is False
        assert med["takenAt"] is None

        # 1. Đánh dấu đã uống qua PUT /api/v1/reminders/{id}/toggle
        put_res = await client.put(f"/api/v1/reminders/{dose_id}/toggle?patient_id={patient_id}")
        assert put_res.status_code == 200
        put_data = put_res.json()
        assert put_data["status"] == "success"
        assert put_data["reminder_id"] == dose_id
        assert put_data["taken"] is True
        assert put_data["takenAt"] is not None

        # 2. Kiểm tra GET /today phản ánh taken == True và takenAt
        res_after = await client.get(f"/api/v1/mobile/reminders/today?patient_id={patient_id}")
        assert res_after.status_code == 200
        med_after = res_after.json()["medications"][0]
        assert med_after["taken"] is True
        assert med_after["takenAt"] == put_data["takenAt"]
        assert res_after.json()["completed_medications"] == 1

        # 3. Toggle lại qua route alias /mobile/reminders/{id}/toggle để bỏ đánh dấu
        untoggle_res = await client.put(f"/api/v1/mobile/reminders/{dose_id}/toggle?patient_id={patient_id}")
        assert untoggle_res.status_code == 200
        untoggle_data = untoggle_res.json()
        assert untoggle_data["taken"] is False
        assert untoggle_data["takenAt"] is None

        # 4. Kiểm tra lại trạng thái
        res_final = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
        assert res_final.json()["medications"][0]["taken"] is False
        assert res_final.json()["completed_medications"] == 0


# ---------------------------------------------------------------------------
# 5. Test Clean Empty State (Zero Fake Data)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_empty_state_when_patient_has_no_prescriptions(test_app, fake_redis):
    fresh_patient_id = str(uuid.uuid4())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/mobile/reminders/today?patient_id={fresh_patient_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["total_medications"] == 0
        assert data["completed_medications"] == 0
        assert data["medications"] == []
        assert data["meals"] == []
        assert data["hydrations"] == []
        assert data["doctor_prescriptions"] == []


# ---------------------------------------------------------------------------
# 6. Test Expired Prescriptions Excluded from Today
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_expired_prescriptions_excluded_from_today(test_app, fake_redis):
    patient_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(days=1)
    ten_days_ago = now - timedelta(days=10)
    next_week = now + timedelta(days=7)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test") as client:
        # 1. Đơn thuốc đã hết hạn từ hôm qua
        await client.post(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
            json={
                "diagnosis": "Đợt cấp viêm phế quản",
                "start_date": ten_days_ago.isoformat(),
                "end_date": yesterday.isoformat(),
                "medications": [
                    {
                        "medication_name": "Kháng sinh Augmentin 1g",
                        "dosage": "1 viên",
                        "schedule_times": ["08:00"],
                    }
                ],
            },
        )

        # 2. Đơn thuốc dài hạn đang hoạt động
        await client.post(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/batch",
            json={
                "diagnosis": "Bổ sung vi chất",
                "start_date": ten_days_ago.isoformat(),
                "end_date": next_week.isoformat(),
                "medications": [
                    {
                        "medication_name": "Canxi D3",
                        "dosage": "1 viên",
                        "schedule_times": ["09:00"],
                    }
                ],
            },
        )

        res = await client.get(f"/api/v1/reminders/today?patient_id={patient_id}")
        assert res.status_code == 200
        data = res.json()
        # Chỉ có Canxi D3 còn hiệu lực xuất hiện trong ngày hôm nay
        assert data["total_medications"] == 1
        assert data["medications"][0]["name"] == "Canxi D3"
        med_names = [m["name"] for m in data["medications"]]
        assert "Kháng sinh Augmentin 1g" not in med_names


# ---------------------------------------------------------------------------
# 7. Test Doctor Prescription Update, Toggle Reminder & Delete
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_doctor_prescription_lifecycle(test_app, fake_redis):
    patient_id = str(uuid.uuid4())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=test_app), base_url="http://test") as client:
        # Create single prescription
        create_res = await client.post(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions",
            json={
                "medication_name": "Gliclazide 30mg",
                "dosage": "1 viên",
                "quantity": "30 viên",
                "frequency": "Hàng ngày",
                "schedule_times": ["07:30"],
                "instructions": "Trước ăn sáng",
                "diagnosis": "Hạ đường huyết",
                "enable_speaker_reminder": True,
            },
        )
        assert create_res.status_code == 201
        rx_item = create_res.json()
        rx_id = rx_item["id"]

        # Update prescription
        up_res = await client.put(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_id}",
            json={"dosage": "2 viên", "instructions": "Uống trước ăn sáng 30 phút"},
        )
        assert up_res.status_code == 200
        assert up_res.json()["dosage"] == "2 viên"
        assert up_res.json()["instructions"] == "Uống trước ăn sáng 30 phút"

        # Toggle reminder
        tog_res = await client.patch(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_id}/toggle-reminder"
        )
        assert tog_res.status_code == 200
        assert tog_res.json()["enable_speaker_reminder"] is False

        # Delete prescription
        del_res = await client.delete(
            f"/api/v1/doctor/patients/{patient_id}/prescriptions/{rx_id}"
        )
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # Verify list is empty
        list_res = await client.get(f"/api/v1/doctor/patients/{patient_id}/prescriptions")
        assert list_res.status_code == 200
        assert len(list_res.json()) == 0

"""
Opaque-box E2E test harness for Doctor Appointment lifecycle across Backend, Doctor Web, and Mobile.
Follows Explorer 1 (Backend ASGI + Live PostgreSQL + FakeRedis + RecorderWS) and
Explorer 2 (Node v24 client_contracts runner with TZ=Asia/Ho_Chi_Minh).
"""
from __future__ import annotations

import fnmatch
import json
import os
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from httpx import ASGITransport
from sqlalchemy import delete, or_, select

from app.api.v1.api import api_router
from app.api.websockets.vitals_ws import alert_clients, ws_router
from app.core import database as db_mod
from app.core.database import AsyncSessionFactory, engine, get_redis
from app.core.security import create_access_token
from app.main import (
    http_exception_handler,
    localize_api_messages,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.models.appointment import Appointment, AppointmentReminder
from app.models.device import Device
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.incident import Incident
from app.models.user import User
from app.services.redis import redis_service

E2E_DIR = Path(__file__).resolve().parent
CLIENT_CONTRACTS_DIR = E2E_DIR / "client_contracts"
SMART_ELDERLY_ROOT = E2E_DIR.parents[2]  # d:\Capstone1_C1SE34\smart-elderly-care-ai
DOCTOR_WEB_DIR = SMART_ELDERLY_ROOT / "apps" / "doctor-web"
MOBILE_DIR = SMART_ELDERLY_ROOT / "apps" / "mobile"


class FakeRedis:
    """In-memory async Redis supporting scan/keys/delete/list/set/hash for redis_service."""

    def __init__(self) -> None:
        self._store: Dict[str, str] = {}
        self._lists: Dict[str, List[str]] = {}
        self._sets: Dict[str, set[str]] = {}

    async def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._store[key] = value
        return True

    async def delete(self, *keys: str) -> int:
        removed = 0
        for k in keys:
            if self._store.pop(k, None) is not None:
                removed += 1
            if self._lists.pop(k, None) is not None:
                removed += 1
        return removed

    async def keys(self, pattern: str = "*") -> List[str]:
        return [k for k in self._store if fnmatch.fnmatch(k, pattern)]

    async def scan(self, cursor: int = 0, match: str = "*", count: int = 100):
        return 0, await self.keys(match)

    async def lpush(self, key: str, *values: str) -> int:
        lst = self._lists.setdefault(key, [])
        for v in values:
            lst.insert(0, v)
        return len(lst)

    async def ltrim(self, key: str, start: int, stop: int) -> bool:
        if key in self._lists:
            self._lists[key] = self._lists[key][start : stop + 1]
        return True

    async def lrange(self, key: str, start: int, stop: int) -> List[str]:
        lst = self._lists.get(key, [])
        return lst[start : (None if stop == -1 else stop + 1)]

    async def sadd(self, key: str, *values: str) -> int:
        s = self._sets.setdefault(key, set())
        before = len(s)
        s.update(values)
        return len(s) - before

    async def srem(self, key: str, *values: str) -> int:
        s = self._sets.get(key, set())
        before = len(s)
        for v in values:
            s.discard(v)
        return before - len(s)

    async def smembers(self, key: str) -> set[str]:
        return set(self._sets.get(key, set()))

    async def hset(self, *args, **kwargs) -> int:
        return 1

    async def info(self) -> Dict[str, Any]:
        return {"used_memory_human": "1M", "connected_clients": 1, "redis_version": "fake-7.2"}

    async def dbsize(self) -> int:
        return len(self._store)

    async def ping(self) -> bool:
        return True

    def clear(self) -> None:
        self._store.clear()
        self._lists.clear()
        self._sets.clear()


class RecorderWS:
    """Async WebSocket double registered in vitals_ws.alert_clients."""

    def __init__(self, fail_on_send: bool = False) -> None:
        self.messages: List[dict] = []
        self.fail_on_send = fail_on_send

    async def send_text(self, data: str) -> None:
        if self.fail_on_send:
            raise RuntimeError("Simulated dead WS client")
        self.messages.append(json.loads(data))


@dataclass
class E2EEntities:
    doctor_id: uuid.UUID
    doctor_name: str
    doctor_token: str
    doctor2_id: uuid.UUID
    doctor2_name: str
    doctor2_token: str
    family_user_id: uuid.UUID
    family_token: str
    family2_user_id: uuid.UUID
    family2_token: str
    house_id: uuid.UUID
    house2_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    patient2_id: uuid.UUID
    patient2_name: str
    patient3_id: uuid.UUID
    patient3_name: str
    device_id: uuid.UUID
    device2_id: uuid.UUID

    @property
    def doctor_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.doctor_token}"}

    @property
    def doctor2_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.doctor2_token}"}

    @property
    def family_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.family_token}"}

    @property
    def family2_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.family2_token}"}


def _build_e2e_app(fake_redis: FakeRedis) -> FastAPI:
    app = FastAPI(title="E2E SECA Backend")
    app.middleware("http")(localize_api_messages)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.include_router(api_router, prefix="/api/v1")
    app.include_router(ws_router, prefix="/ws")
    app.dependency_overrides[get_redis] = lambda: fake_redis
    return app


def run_node_test(
    test_file: str | Path,
    filter_pattern: Optional[str] = None,
    tz: str = "Asia/Ho_Chi_Minh",
) -> None:
    """Execute a Node --test contract file (optionally filtered) and fail with clean output."""
    cmd = ["node", "--test"]
    if filter_pattern:
        cmd.append(f"--test-name-pattern={filter_pattern}")
    cmd.append(str(test_file))
    proc = subprocess.run(
        cmd,
        cwd=str(SMART_ELDERLY_ROOT),
        env={**os.environ, "TZ": tz},
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
        timeout=60,
    )
    if proc.returncode != 0:
        details = (proc.stdout or "") + "\n" + (proc.stderr or "")
        pytest.fail(f"Node contract check failed ({filter_pattern or test_file}):\n{details.strip()}")


def run_tsc_check(app_dir: Path) -> None:
    """Run `tsc --noEmit` in target frontend app directory."""
    tsc_bin = app_dir / "node_modules" / ".bin" / ("tsc.cmd" if os.name == "nt" else "tsc")
    proc = subprocess.run(
        [str(tsc_bin), "--noEmit"],
        cwd=str(app_dir),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
        timeout=90,
    )
    if proc.returncode != 0:
        details = (proc.stdout or "") + "\n" + (proc.stderr or "")
        pytest.fail(f"TypeScript typecheck failed in {app_dir.name}:\n{details.strip()}")


@pytest.fixture(scope="session")
def fake_redis() -> FakeRedis:
    return FakeRedis()


@pytest.fixture(autouse=True)
def _reset_fake_redis_and_patch_service(fake_redis: FakeRedis, monkeypatch):
    fake_redis.clear()

    async def _client_override():
        return fake_redis

    monkeypatch.setattr(redis_service, "_client", _client_override)
    monkeypatch.setattr(db_mod, "_redis_client", fake_redis)
    yield
    fake_redis.clear()


@pytest.fixture(scope="session")
def e2e_app(fake_redis: FakeRedis) -> FastAPI:
    return _build_e2e_app(fake_redis)


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def e2e_entities() -> AsyncGenerator[E2EEntities, None]:
    engine.echo = False
    tag = uuid.uuid4().hex[:8]
    doc1_id, doc2_id = uuid.uuid4(), uuid.uuid4()
    fam1_id, fam2_id = uuid.uuid4(), uuid.uuid4()
    house1_id, house2_id = uuid.uuid4(), uuid.uuid4()
    pat1_id, pat2_id, pat3_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    dev1_id, dev2_id = uuid.uuid4(), uuid.uuid4()

    doc1_name = f"BS. E2E Một {tag}"
    doc2_name = f"BS. E2E Hai {tag}"
    pat1_name = f"Cụ E2E Nguyễn Thị Hoa {tag}"
    pat2_name = f"Cụ E2E Trần Văn Bình {tag}"
    pat3_name = f"Cụ E2E Lê Minh Tâm {tag}"

    async with AsyncSessionFactory() as db:
        db.add_all(
            [
                User(id=doc1_id, full_name=doc1_name, phone=f"+8491{doc1_id.int % 10**7:07d}", hashed_password="e2e", role="doctor", fcm_token=None),
                User(id=doc2_id, full_name=doc2_name, phone=f"+8492{doc2_id.int % 10**7:07d}", hashed_password="e2e", role="doctor", fcm_token=None),
                User(id=fam1_id, full_name=f"Người Nhà E2E 1 {tag}", phone=f"+8493{fam1_id.int % 10**7:07d}", hashed_password="e2e", role="owner", fcm_token=None),
                User(id=fam2_id, full_name=f"Người Nhà E2E 2 {tag}", phone=f"+8494{fam2_id.int % 10**7:07d}", hashed_password="e2e", role="owner", fcm_token=None),
            ]
        )
        await db.flush()
        db.add_all(
            [
                House(id=house1_id, name=f"Nhà E2E 1 {tag}", owner_id=fam1_id),
                House(id=house2_id, name=f"Nhà E2E 2 {tag}", owner_id=fam2_id),
            ]
        )
        await db.flush()
        db.add_all(
            [
                HouseMember(house_id=house1_id, user_id=doc1_id, role_in_house="DOCTOR", status="ACTIVE"),
                HouseMember(house_id=house1_id, user_id=fam1_id, role_in_house="OWNER", status="ACTIVE", can_manage_records=True),
                HouseMember(house_id=house2_id, user_id=doc2_id, role_in_house="DOCTOR", status="ACTIVE"),
                HouseMember(house_id=house2_id, user_id=fam2_id, role_in_house="OWNER", status="ACTIVE", can_manage_records=True),
                ElderlyProfile(id=pat1_id, house_id=house1_id, full_name=pat1_name, birth_year=1945, gender="FEMALE"),
                ElderlyProfile(id=pat2_id, house_id=house1_id, full_name=pat2_name, birth_year=1942, gender="MALE"),
                ElderlyProfile(id=pat3_id, house_id=house2_id, full_name=pat3_name, birth_year=1940, gender="MALE"),
                Device(id=dev1_id, device_id=f"E2E_DEV1_{tag}", name="E2E Hub 1", device_type="EDGE_HUB", owner_id=fam1_id, house_id=house1_id, elderly_id=pat1_id),
                Device(id=dev2_id, device_id=f"E2E_DEV2_{tag}", name="E2E Hub 2", device_type="EDGE_HUB", owner_id=fam2_id, house_id=house2_id, elderly_id=pat3_id),
            ]
        )
        await db.commit()

    entities = E2EEntities(
        doctor_id=doc1_id,
        doctor_name=doc1_name,
        doctor_token=create_access_token(doc1_id, token_version=1),
        doctor2_id=doc2_id,
        doctor2_name=doc2_name,
        doctor2_token=create_access_token(doc2_id, token_version=1),
        family_user_id=fam1_id,
        family_token=create_access_token(fam1_id, token_version=1),
        family2_user_id=fam2_id,
        family2_token=create_access_token(fam2_id, token_version=1),
        house_id=house1_id,
        house2_id=house2_id,
        patient_id=pat1_id,
        patient_name=pat1_name,
        patient2_id=pat2_id,
        patient2_name=pat2_name,
        patient3_id=pat3_id,
        patient3_name=pat3_name,
        device_id=dev1_id,
        device2_id=dev2_id,
    )
    try:
        yield entities
    finally:
        user_ids = [doc1_id, doc2_id, fam1_id, fam2_id]
        pat_ids = [pat1_id, pat2_id, pat3_id]
        house_ids = [house1_id, house2_id]
        dev_ids = [dev1_id, dev2_id]
        async with AsyncSessionFactory() as db:
            apt_subq = select(Appointment.id).where(
                or_(Appointment.patient_id.in_(pat_ids), Appointment.doctor_id.in_(user_ids), Appointment.house_id.in_(house_ids))
            )
            await db.execute(delete(Incident).where(or_(Incident.device_id.in_(dev_ids), Incident.acknowledged_by.in_(user_ids))))
            await db.execute(delete(AppointmentReminder).where(AppointmentReminder.appointment_id.in_(apt_subq)))
            await db.execute(delete(Appointment).where(or_(Appointment.patient_id.in_(pat_ids), Appointment.doctor_id.in_(user_ids), Appointment.house_id.in_(house_ids))))
            await db.execute(delete(Device).where(Device.id.in_(dev_ids)))
            await db.execute(delete(ElderlyProfile).where(ElderlyProfile.id.in_(pat_ids)))
            await db.execute(delete(HouseMember).where(HouseMember.house_id.in_(house_ids)))
            await db.execute(delete(House).where(House.id.in_(house_ids)))
            await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()
        await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def clean_schedule(e2e_entities: E2EEntities) -> AsyncGenerator[None, None]:
    """Per-test cleanup of appointments, reminders & incidents created for test entities."""
    yield
    user_ids = [e2e_entities.doctor_id, e2e_entities.doctor2_id, e2e_entities.family_user_id, e2e_entities.family2_user_id]
    pat_ids = [e2e_entities.patient_id, e2e_entities.patient2_id, e2e_entities.patient3_id]
    house_ids = [e2e_entities.house_id, e2e_entities.house2_id]
    dev_ids = [e2e_entities.device_id, e2e_entities.device2_id]
    async with AsyncSessionFactory() as db:
        apt_subq = select(Appointment.id).where(
            or_(Appointment.patient_id.in_(pat_ids), Appointment.doctor_id.in_(user_ids), Appointment.house_id.in_(house_ids))
        )
        await db.execute(delete(Incident).where(or_(Incident.device_id.in_(dev_ids), Incident.acknowledged_by.in_(user_ids))))
        await db.execute(delete(AppointmentReminder).where(AppointmentReminder.appointment_id.in_(apt_subq)))
        await db.execute(delete(Appointment).where(or_(Appointment.patient_id.in_(pat_ids), Appointment.doctor_id.in_(user_ids), Appointment.house_id.in_(house_ids))))
        await db.commit()


@pytest_asyncio.fixture(loop_scope="session")
async def client(e2e_app: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(transport=ASGITransport(app=e2e_app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
def ws_recorder():
    rec = RecorderWS()
    alert_clients.append(rec)
    try:
        yield rec
    finally:
        if rec in alert_clients:
            alert_clients.remove(rec)

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import auth


def test_password_reset_verifies_otp_and_persists_new_hash(monkeypatch):
    user = SimpleNamespace(is_active=True, hashed_password="old-hash")
    fake_db = SimpleNamespace(flush=AsyncMock())
    fake_crud_user = SimpleNamespace(get_by_phone=AsyncMock(return_value=user))
    monkeypatch.setattr(auth, "crud_user", fake_crud_user)
    monkeypatch.setattr(auth, "verify_otp", lambda phone, code: True)
    monkeypatch.setattr(auth, "hash_password", lambda password: f"hashed:{password}")

    async def run_in_threadpool(function, *args):
        return function(*args)

    monkeypatch.setattr(auth, "run_in_threadpool", run_in_threadpool)
    payload = auth.PasswordResetRequest(
        phone="0901234567",
        otp_code="123456",
        new_password="NewSecure2@",
    )

    result = asyncio.run(auth.reset_password(payload, db=fake_db))

    assert result == {"message": "Mật khẩu đã được cập nhật."}
    assert user.hashed_password == "hashed:NewSecure2@"
    fake_db.flush.assert_awaited_once()


def test_password_reset_does_not_change_hash_when_otp_is_invalid(monkeypatch):
    user = SimpleNamespace(is_active=True, hashed_password="old-hash")
    fake_db = SimpleNamespace(flush=AsyncMock())
    monkeypatch.setattr(
        auth,
        "crud_user",
        SimpleNamespace(get_by_phone=AsyncMock(return_value=user)),
    )
    monkeypatch.setattr(auth, "verify_otp", lambda phone, code: False)

    async def run_in_threadpool(function, *args):
        return function(*args)

    monkeypatch.setattr(auth, "run_in_threadpool", run_in_threadpool)
    payload = auth.PasswordResetRequest(
        phone="0901234567",
        otp_code="123456",
        new_password="NewSecure2@",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.reset_password(payload, db=fake_db))

    assert error.value.status_code == 400
    assert user.hashed_password == "old-hash"
    fake_db.flush.assert_not_awaited()

import asyncio
import logging
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.mobile import auth
from app.core.config import settings
from app.crud.crud_user import normalize_phone
from app.services.notification.twilio_verify import send_otp, verify_otp


def test_normalize_phone_supports_local_and_international_formats():
    assert normalize_phone("0901234567") == "+84901234567"
    assert normalize_phone("+84901234567") == "+84901234567"
    assert normalize_phone("+84 090 123 4567") == "+84901234567"
    assert normalize_phone("+84 0382694409") == "+84382694409"
    assert normalize_phone("0084 0382694409") == "+84382694409"
    assert normalize_phone("84901234567") == "+84901234567"
    assert normalize_phone(" 0901 234 567 ") == "+84901234567"


def test_registration_requires_otp_and_restricts_public_role():
    with pytest.raises(ValidationError):
        auth.UserRegistration.model_validate({
            "phone": "0901234567",
            "full_name": "Test User",
            "password": "password123",
        })

    with pytest.raises(ValidationError):
        auth.UserRegistration.model_validate({
            "phone": "0901234567",
            "full_name": "Test User",
            "password": "password123",
            "otp_code": "123456",
            "role": "admin",
        })


def test_registration_does_not_create_user_when_otp_is_invalid(monkeypatch):
    fake_crud_user = SimpleNamespace(
        get_by_phone=AsyncMock(return_value=None),
        create=AsyncMock(),
    )
    monkeypatch.setattr(auth, "crud_user", fake_crud_user)
    monkeypatch.setattr(auth, "verify_otp", lambda phone, code: False)
    payload = auth.UserRegistration(
        phone="0901234567",
        full_name="Test User",
        password="password123",
        otp_code="123456",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.register(payload, db=cast(AsyncSession, object())))

    assert error.value.status_code == 400
    fake_crud_user.create.assert_not_awaited()


def test_mock_otp_is_logged_and_verified_only_in_debug(monkeypatch, caplog):
    monkeypatch.setattr(settings, "OTP_MODE", "mock")
    monkeypatch.setattr(settings, "OTP_DEV_CODE", "654321")
    monkeypatch.setattr(settings, "DEBUG", True)

    with caplog.at_level(logging.WARNING):
        send_otp("+84901234567")

    assert "code=654321" in caplog.text
    assert "+84901234567" not in caplog.text
    assert verify_otp("+84901234567", "654321")
    assert not verify_otp("+84901234567", "000000")


def test_mock_otp_is_disabled_outside_debug(monkeypatch):
    monkeypatch.setattr(settings, "OTP_MODE", "mock")
    monkeypatch.setattr(settings, "DEBUG", False)

    with pytest.raises(RuntimeError, match="DEBUG=True"):
        send_otp("+84901234567")

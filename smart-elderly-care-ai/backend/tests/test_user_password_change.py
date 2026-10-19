import asyncio
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.web_admin import users
from app.models.user import User
from app.schemas.user import PasswordChange


def make_payload(**overrides):
    values = {
        "current_password": "CurrentPass1!",
        "new_password": "NewSecure2@",
        "confirm_new_password": "NewSecure2@",
    }
    values.update(overrides)
    return PasswordChange.model_validate(values)


@pytest.mark.parametrize(
    "password",
    ["short", "lowercase1!", "UPPERCASE1!", "NoDigits!!", "NoSpecial123", "LongPassword123456!"],
)
def test_password_change_rejects_passwords_that_do_not_meet_policy(password):
    with pytest.raises(ValidationError):
        make_payload(new_password=password, confirm_new_password=password)


def test_password_change_rejects_mismatched_confirmation():
    with pytest.raises(ValidationError):
        make_payload(confirm_new_password="Different2@")


def test_password_change_hashes_and_persists_password(monkeypatch):
    fake_user = SimpleNamespace(hashed_password="old-hash")
    fake_db = object()
    fake_crud_user = SimpleNamespace(update=AsyncMock(return_value=fake_user))
    monkeypatch.setattr(users, "crud_user", fake_crud_user)
    monkeypatch.setattr(users, "verify_password", lambda raw, hashed: raw == "CurrentPass1!" and hashed == "old-hash")
    monkeypatch.setattr(users, "hash_password", lambda password: f"hashed:{password}")

    result = asyncio.run(
        users.change_current_user_password(
            make_payload(),
            current_user=cast(User, fake_user),
            db=cast(AsyncSession, fake_db),
        )
    )

    assert result == {"message": "Mật khẩu đã được cập nhật."}
    fake_crud_user.update.assert_awaited_once_with(
        fake_db,
        db_obj=fake_user,
        obj_in={"hashed_password": "hashed:NewSecure2@"},
    )


def test_password_change_rejects_wrong_current_password_without_writing(monkeypatch):
    fake_user = SimpleNamespace(hashed_password="old-hash")
    fake_crud_user = SimpleNamespace(update=AsyncMock())
    monkeypatch.setattr(users, "crud_user", fake_crud_user)
    monkeypatch.setattr(users, "verify_password", lambda raw, hashed: False)

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            users.change_current_user_password(
                make_payload(),
                current_user=cast(User, fake_user),
                db=cast(AsyncSession, object()),
            )
        )

    assert error.value.status_code == 400
    fake_crud_user.update.assert_not_awaited()


def test_password_change_rejects_reusing_current_password_without_writing(monkeypatch):
    fake_user = SimpleNamespace(hashed_password="old-hash")
    fake_crud_user = SimpleNamespace(update=AsyncMock())
    monkeypatch.setattr(users, "crud_user", fake_crud_user)
    monkeypatch.setattr(
        users,
        "verify_password",
        lambda raw, hashed: raw == "CurrentPass1!" and hashed == "old-hash",
    )
    payload = make_payload(
        new_password="CurrentPass1!",
        confirm_new_password="CurrentPass1!",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            users.change_current_user_password(
                payload,
                current_user=cast(User, fake_user),
                db=cast(AsyncSession, object()),
            )
        )

    assert error.value.status_code == 400
    fake_crud_user.update.assert_not_awaited()

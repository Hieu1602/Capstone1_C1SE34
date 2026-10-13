import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.api.v1.endpoints import users
from app.schemas.user import FontSizePreferenceUpdate, UserUpdate


def test_user_font_preferences_are_supported():
    payload = UserUpdate.model_validate({
        "font_size_mode": "custom",
        "custom_font_scale": 3,
    })

    assert payload.font_size_mode == "custom"
    assert payload.custom_font_scale == 3


@pytest.mark.parametrize("scale", [0, 1, 2, 3, 4])
def test_font_preference_endpoint_accepts_supported_scale(scale):
    payload = FontSizePreferenceUpdate.model_validate({
        "font_size_mode": "custom",
        "custom_font_scale": scale,
    })

    assert payload.custom_font_scale == scale


@pytest.mark.parametrize(
    "payload",
    [
        {"font_size_mode": "large", "custom_font_scale": 2},
        {"font_size_mode": "custom", "custom_font_scale": -1},
        {"font_size_mode": "custom", "custom_font_scale": 5},
        {"font_size_mode": "custom"},
    ],
)
def test_font_preference_endpoint_rejects_invalid_values(payload):
    with pytest.raises(ValidationError):
        FontSizePreferenceUpdate.model_validate(payload)


def test_update_font_preferences_persists_user_settings(monkeypatch):
    fake_user = SimpleNamespace()
    fake_db = object()
    fake_crud_user = SimpleNamespace(update=AsyncMock(return_value=fake_user))
    monkeypatch.setattr(users, "crud_user", fake_crud_user)
    payload = FontSizePreferenceUpdate(font_size_mode="custom", custom_font_scale=4)

    result = asyncio.run(
        users.update_font_preferences(payload, current_user=fake_user, db=fake_db)
    )

    assert result is fake_user
    fake_crud_user.update.assert_awaited_once_with(
        fake_db,
        db_obj=fake_user,
        obj_in={"font_size_mode": "custom", "custom_font_scale": 4},
    )

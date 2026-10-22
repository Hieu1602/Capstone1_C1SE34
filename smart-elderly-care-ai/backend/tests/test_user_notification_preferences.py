import asyncio
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.web_admin import users
from app.models.user import User
from app.schemas.user import NotificationPreferenceUpdate, UserUpdate


def test_user_notification_preferences_in_user_update():
    payload = UserUpdate.model_validate({
        "notifications_enabled": False,
        "alert_sound_enabled": True,
        "critical_alert_enabled": False,
    })

    assert payload.notifications_enabled is False
    assert payload.alert_sound_enabled is True
    assert payload.critical_alert_enabled is False


def test_notification_preference_update_partial():
    payload = NotificationPreferenceUpdate.model_validate({
        "notifications_enabled": False,
    })
    assert payload.notifications_enabled is False
    assert payload.alert_sound_enabled is None
    assert payload.critical_alert_enabled is None


def test_update_notification_preferences_endpoint(monkeypatch):
    fake_user = SimpleNamespace(
        id="00000000-0000-0000-0000-000000000001",
        full_name="Ngô Lê Vĩnh",
        phone="0382694409",
        notifications_enabled=True,
        alert_sound_enabled=True,
        critical_alert_enabled=True,
    )
    fake_db = object()

    async def fake_update(db, db_obj, obj_in):
        for k, v in obj_in.items():
            setattr(db_obj, k, v)
        return db_obj

    fake_crud_user = SimpleNamespace(update=fake_update)
    monkeypatch.setattr(users, "crud_user", fake_crud_user)

    payload = NotificationPreferenceUpdate(
        notifications_enabled=False,
        alert_sound_enabled=False,
        critical_alert_enabled=True,
    )

    result = asyncio.run(
        users.update_notification_preferences(
            payload,
            current_user=cast(User, fake_user),
            db=cast(AsyncSession, fake_db),
        )
    )

    assert result.notifications_enabled is False
    assert result.alert_sound_enabled is False
    assert result.critical_alert_enabled is True


def test_get_notification_preferences_endpoint():
    fake_user = SimpleNamespace(
        notifications_enabled=False,
        alert_sound_enabled=True,
        critical_alert_enabled=True,
    )

    result = asyncio.run(
        users.get_my_notification_preferences(
            current_user=cast(User, fake_user),
        )
    )

    assert result["notifications_enabled"] is False
    assert result["alert_sound_enabled"] is True
    assert result["critical_alert_enabled"] is True


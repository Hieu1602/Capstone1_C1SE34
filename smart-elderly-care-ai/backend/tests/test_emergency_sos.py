import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.api.v1.endpoints import emergency
from app.schemas.emergency import EmergencySOSRequest


@pytest.mark.parametrize(
    "payload",
    [
        {"latitude": 91, "longitude": 0},
        {"latitude": 0, "longitude": -181},
        {"address": "x" * 501},
    ],
)
def test_emergency_sos_rejects_invalid_location_or_address(payload):
    with pytest.raises(ValidationError):
        EmergencySOSRequest.model_validate(payload)


def test_trigger_emergency_sos_notifies_household_and_returns_dial_target(monkeypatch):
    fake_user = SimpleNamespace(
        id="caller-id",
        full_name="Test Caller",
        location_address="Saved home address",
    )
    fake_db = object()
    recipient = SimpleNamespace(fcm_token="family-device-token")
    monkeypatch.setattr(
        emergency,
        "_get_household_recipients",
        AsyncMock(return_value=[recipient]),
    )
    send_notifications = AsyncMock(
        return_value={"success_count": 1, "failure_count": 0}
    )

    async def send_in_thread(*args, **kwargs):
        return await send_notifications(*args, **kwargs)

    monkeypatch.setattr(emergency.asyncio, "to_thread", send_in_thread)
    payload = EmergencySOSRequest(address="Current address", latitude=10.0, longitude=106.0)

    response = asyncio.run(
        emergency.trigger_emergency_sos(payload, current_user=fake_user, db=fake_db)
    )

    assert response.dial_number == "115"
    assert response.dial_uri == "tel:115"
    assert response.notification_sent == 1
    assert response.notification_failed == 0
    emergency._get_household_recipients.assert_awaited_once_with(
        fake_db, fake_user.id
    )
    send_notifications.assert_awaited_once()


def test_trigger_emergency_sos_still_returns_dial_target_without_recipients(monkeypatch):
    fake_user = SimpleNamespace(
        id="caller-id",
        full_name="Test Caller",
        location_address=None,
    )
    monkeypatch.setattr(
        emergency,
        "_get_household_recipients",
        AsyncMock(return_value=[]),
    )

    response = asyncio.run(
        emergency.trigger_emergency_sos(
            EmergencySOSRequest(), current_user=fake_user, db=object()
        )
    )

    assert response.dial_uri == "tel:115"
    assert response.notification_sent == 0
    assert response.notification_failed == 0

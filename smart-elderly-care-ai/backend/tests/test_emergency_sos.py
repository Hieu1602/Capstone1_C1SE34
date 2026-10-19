import asyncio
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.mobile import emergency
from app.models.user import User
from app.schemas.emergency import EmergencySOSRequest


@pytest.mark.parametrize(
    "payload",
    [
        {"latitude": 91, "longitude": 0},
        {"longitude": -181},
        {"address": "x" * 501},
        {"message": "x" * 501},
    ],
)
def test_emergency_sos_rejects_invalid_location_or_oversized_message(payload):
    with pytest.raises(ValidationError):
        EmergencySOSRequest.model_validate(payload)


def test_trigger_emergency_sos_notifies_household_and_returns_dial_target(monkeypatch):
    fake_user = SimpleNamespace(
        id="caller-id",
        full_name="Test Caller",
    )
    fake_db = object()
    recipient = SimpleNamespace(fcm_token="family-device-token")
    mock_get_recipients = AsyncMock(return_value=[recipient])
    monkeypatch.setattr(
        emergency,
        "_get_household_recipients",
        mock_get_recipients,
    )
    send_notifications = AsyncMock(
        return_value={"success_count": 1, "failure_count": 0}
    )

    async def send_in_thread(*args, **kwargs):
        return await send_notifications(*args, **kwargs)

    monkeypatch.setattr(emergency.asyncio, "to_thread", send_in_thread)
    payload = EmergencySOSRequest(
        address="Địa chỉ khẩn cấp",
        latitude=10,
        longitude=106,
        message="Cần hỗ trợ khẩn cấp",
    )

    response = asyncio.run(
        emergency.trigger_emergency_sos(
            payload,
            current_user=cast(User, fake_user),
            db=cast(AsyncSession, fake_db),
        )
    )

    assert response.dial_number == "115"
    assert response.dial_uri == "tel:115"
    assert response.notification_sent == 1
    assert response.notification_failed == 0
    mock_get_recipients.assert_awaited_once_with(
        fake_db, fake_user.id
    )
    send_notifications.assert_awaited_once()
    notification_args = send_notifications.await_args.args
    assert notification_args[3] == "Test Caller: Cần hỗ trợ khẩn cấp. Vị trí: Địa chỉ khẩn cấp"
    assert notification_args[4] == {
        "type": "EMERGENCY_SOS",
        "user_id": "caller-id",
        "address": "Địa chỉ khẩn cấp",
        "latitude": "10.0",
        "longitude": "106.0",
    }


def test_trigger_emergency_sos_still_returns_dial_target_without_recipients(monkeypatch):
    fake_user = SimpleNamespace(
        id="caller-id",
        full_name="Test Caller",
    )
    monkeypatch.setattr(
        emergency,
        "_get_household_recipients",
        AsyncMock(return_value=[]),
    )

    response = asyncio.run(
        emergency.trigger_emergency_sos(
            EmergencySOSRequest(),
            current_user=cast(User, fake_user),
            db=cast(AsyncSession, object()),
        )
    )

    assert response.dial_uri == "tel:115"
    assert response.notification_sent == 0
    assert response.notification_failed == 0

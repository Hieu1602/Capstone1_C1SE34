import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.mobile.devices import register_device
from app.crud.crud_device import crud_device
from app.crud.crud_house import crud_house
from app.schemas.device import DeviceCreate


def test_first_device_creates_house_and_owner_membership():
    user = SimpleNamespace(id=uuid4(), role="member")
    house = SimpleNamespace(id=uuid4(), owner_id=user.id)
    payload = DeviceCreate(device_id="TAPO_SN_22550A3009164", name="Tapo C200C")
    created_device = object()

    with (
        patch.object(crud_device, "get_by_device_id", AsyncMock(return_value=None)),
        patch.object(crud_house, "get_or_create_default_house", AsyncMock(return_value=None)),
        patch.object(crud_house, "create", AsyncMock(return_value=house)) as create_house,
        patch.object(crud_device, "create", AsyncMock(return_value=created_device)) as create_device,
    ):
        result = asyncio.run(register_device(payload, user, AsyncMock()))

    assert result is created_device
    assert payload.house_id == house.id
    assert create_house.await_args.kwargs["owner_id"] == user.id
    assert create_device.await_args.kwargs["owner_id"] == user.id


def test_member_without_permission_cannot_claim_another_house():
    user = SimpleNamespace(id=uuid4(), role="member")
    house = SimpleNamespace(id=uuid4(), owner_id=uuid4())
    payload = DeviceCreate(device_id="TAPO_SN_OTHER", name="Tapo C200C", house_id=house.id)

    with (
        patch.object(crud_device, "get_by_device_id", AsyncMock(return_value=None)),
        patch.object(crud_house, "get_by_id", AsyncMock(return_value=house)),
        patch.object(crud_house, "get_user_permissions", AsyncMock(return_value={"can_manage_devices": False})),
        patch.object(crud_device, "create", AsyncMock()) as create_device,
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(register_device(payload, user, AsyncMock()))

    assert exc_info.value.status_code == 403
    create_device.assert_not_awaited()

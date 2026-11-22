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
        patch.object(crud_device, "get_by_device_id_or_mac", AsyncMock(return_value=None)),
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
        patch.object(crud_device, "get_by_device_id_or_mac", AsyncMock(return_value=None)),
        patch.object(crud_house, "get_by_id", AsyncMock(return_value=house)),
        patch.object(crud_house, "get_user_permissions", AsyncMock(return_value={"can_manage_devices": False})),
        patch.object(crud_device, "create", AsyncMock()) as create_device,
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(register_device(payload, user, AsyncMock()))

    assert exc_info.value.status_code == 403
    create_device.assert_not_awaited()


def test_rescan_device_in_same_house_updates_or_returns_device():
    user = SimpleNamespace(id=uuid4(), role="member")
    house = SimpleNamespace(id=uuid4(), owner_id=user.id)
    existing_dev = SimpleNamespace(
        id=uuid4(),
        device_id="TAPO_SN_EXISTING",
        name="Tapo Old Name",
        sub_title="Sub",
        location="Living room",
        ip_address="192.168.1.50",
        mac_address="0C:EF:15:15:80:C5",
        house_id=house.id,
        owner_id=user.id,
        config=None,
    )
    payload = DeviceCreate(
        device_id="TAPO_SN_EXISTING",
        name="Tapo New Name",
        house_id=house.id,
    )
    updated_device = SimpleNamespace(id=existing_dev.id, name="Tapo New Name")

    with (
        patch.object(crud_house, "get_by_id", AsyncMock(return_value=house)),
        patch.object(crud_device, "get_by_device_id_or_mac", AsyncMock(return_value=existing_dev)),
        patch.object(crud_device, "update", AsyncMock(return_value=updated_device)) as update_device,
    ):
        result = asyncio.run(register_device(payload, user, AsyncMock()))

    assert result is updated_device
    update_device.assert_awaited_once()


def test_scan_device_belonging_to_another_house_raises_conflict():
    user = SimpleNamespace(id=uuid4(), role="member")
    my_house = SimpleNamespace(id=uuid4(), owner_id=user.id)
    other_house = SimpleNamespace(id=uuid4(), owner_id=uuid4(), name="Nhà Cụ An")
    existing_dev = SimpleNamespace(
        id=uuid4(),
        device_id="TAPO_SN_OTHER_HOUSE",
        name="Tapo C200",
        house_id=other_house.id,
        owner_id=other_house.owner_id,
        mac_address="0C:EF:15:15:80:C5",
    )
    payload = DeviceCreate(
        device_id="TAPO_SN_OTHER_HOUSE",
        name="Tapo C200",
        house_id=my_house.id,
    )

    with (
        patch.object(crud_house, "get_by_id", AsyncMock(side_effect=lambda db, id: my_house if id == my_house.id else other_house)),
        patch.object(crud_device, "get_by_device_id_or_mac", AsyncMock(return_value=existing_dev)),
        patch.object(crud_house, "get_member_by_user", AsyncMock(return_value=None)),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(register_device(payload, user, AsyncMock()))

    assert exc_info.value.status_code == 409
    assert "Nhà Cụ An" in exc_info.value.detail


def test_scan_device_by_mac_matches_existing_sn_device_and_raises_conflict():
    """Kiểm tra đối soát chéo: người A quét S/N, người B quét MAC cùng 1 thiết bị."""
    user = SimpleNamespace(id=uuid4(), role="member")
    my_house = SimpleNamespace(id=uuid4(), owner_id=user.id)
    other_house = SimpleNamespace(id=uuid4(), owner_id=uuid4(), name="Nhà Cụ An")
    # Camera đã đăng ký trước đó với S/N và có lưu MAC
    existing_dev = SimpleNamespace(
        id=uuid4(),
        device_id="CAM_SN_3097772888773",
        name="Tapo C200",
        house_id=other_house.id,
        owner_id=other_house.owner_id,
        mac_address="0C:EF:15:15:80:C5",
    )
    # Người B quét trúng mã MAC
    payload = DeviceCreate(
        device_id="CAM_MAC_0CEF151580C5",
        name="Tapo C200",
        house_id=my_house.id,
        mac_address="0C:EF:15:15:80:C5",
    )

    with (
        patch.object(crud_house, "get_by_id", AsyncMock(side_effect=lambda db, id: my_house if id == my_house.id else other_house)),
        patch.object(crud_device, "get_by_device_id_or_mac", AsyncMock(return_value=existing_dev)),
        patch.object(crud_house, "get_member_by_user", AsyncMock(return_value=None)),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(register_device(payload, user, AsyncMock()))

    assert exc_info.value.status_code == 409
    assert "Nhà Cụ An" in exc_info.value.detail



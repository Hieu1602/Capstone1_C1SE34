import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.mobile.devices import register_device
from app.crud.crud_device import crud_device
from app.crud.crud_house import crud_house
from app.schemas.device import DeviceConfigBase, DeviceConfigUpdate, DeviceCreate


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


def test_rescan_device_in_same_house_with_config_calls_update_config():
    """Kiểm tra quét lại thiết bị cùng nhà kèm config (DeviceConfigBase) gọi update_config đúng."""
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
    config_in = DeviceConfigBase(stream_url="rtsp://admin:123@192.168.1.50:554/live", resolution="FHD")
    payload = DeviceCreate(
        device_id="TAPO_SN_EXISTING",
        name="Tapo New Name",
        house_id=house.id,
        ip_address="192.168.1.51",
        config=config_in,
    )
    updated_device = SimpleNamespace(id=existing_dev.id, name="Tapo New Name")

    with (
        patch.object(crud_house, "get_by_id", AsyncMock(return_value=house)),
        patch.object(crud_device, "get_by_device_id_or_mac", AsyncMock(return_value=existing_dev)),
        patch.object(crud_device, "update_config", AsyncMock()) as update_config,
        patch.object(crud_device, "update", AsyncMock(return_value=updated_device)) as update_device,
    ):
        result = asyncio.run(register_device(payload, user, AsyncMock()))

    assert result is updated_device
    update_config.assert_awaited_once_with(mock_db := update_config.await_args.args[0], device=existing_dev, config_in=config_in)
    update_device.assert_awaited_once()


def test_move_device_from_old_house_owned_by_user_with_config():
    """Kiểm tra chuyển thiết bị thuộc sở hữu của user từ nhà cũ sang nhà mới có kèm config."""
    user = SimpleNamespace(id=uuid4(), role="member")
    new_house = SimpleNamespace(id=uuid4(), owner_id=user.id)
    old_house = SimpleNamespace(id=uuid4(), owner_id=user.id, name="Nhà Cũ")
    existing_dev = SimpleNamespace(
        id=uuid4(),
        device_id="CAM_MOVE_001",
        name="Camera Cu",
        sub_title="Sub",
        location="Phong ngu",
        ip_address="192.168.1.80",
        mac_address="0C:EF:15:15:80:D0",
        house_id=old_house.id,
        owner_id=user.id,
        config=None,
        is_online=False,
        status_text="Ngoại tuyến",
    )
    config_in = DeviceConfigBase(stream_url="rtsp://new_stream", resolution="2K")
    payload = DeviceCreate(
        device_id="CAM_MOVE_001",
        name="Camera Moi",
        house_id=new_house.id,
        location="San vuon",
        ip_address="192.168.1.99",
        config=config_in,
    )
    refreshed_dev = SimpleNamespace(id=existing_dev.id, name="Camera Moi", house_id=new_house.id)

    db_mock = AsyncMock()
    with (
        patch.object(crud_house, "get_by_id", AsyncMock(side_effect=lambda db, id: new_house if id == new_house.id else old_house)),
        patch.object(crud_device, "get_by_device_id_or_mac", AsyncMock(return_value=existing_dev)),
        patch.object(crud_device, "update_config", AsyncMock()) as update_config,
        patch.object(crud_device, "get_by_id", AsyncMock(return_value=refreshed_dev)),
    ):
        result = asyncio.run(register_device(payload, user, db_mock))

    assert result is refreshed_dev
    assert existing_dev.house_id == new_house.id
    assert existing_dev.name == "Camera Moi"
    assert existing_dev.location == "San vuon"
    assert existing_dev.ip_address == "192.168.1.99"
    assert existing_dev.is_online is True
    update_config.assert_awaited_once_with(db_mock, device=existing_dev, config_in=config_in)


def test_crud_device_update_config_handles_base_update_and_dict():
    """Kiểm tra hàm crud_device.update_config chấp nhận DeviceConfigBase, DeviceConfigUpdate, và dict."""
    config_obj = SimpleNamespace(
        stream_url=None,
        resolution="2K",
        is_sleep=False,
        is_ai_protect=True,
    )
    device: Any = SimpleNamespace(id=uuid4(), config=config_obj)
    db: Any = AsyncMock()

    # 1. DeviceConfigBase
    base_cfg = DeviceConfigBase(stream_url="rtsp://test/live", resolution="FHD")
    res1 = asyncio.run(crud_device.update_config(db, device, base_cfg))
    assert res1.stream_url == "rtsp://test/live"
    assert res1.resolution == "FHD"

    # 2. DeviceConfigUpdate
    update_cfg = DeviceConfigUpdate(is_sleep=True)
    res2 = asyncio.run(crud_device.update_config(db, device, update_cfg))
    assert res2.is_sleep is True

    # 3. dict
    dict_cfg = {"stream_url": "rtsp://dict/live", "is_ai_protect": False}
    res3 = asyncio.run(crud_device.update_config(db, device, dict_cfg))
    assert res3.stream_url == "rtsp://dict/live"
    assert res3.is_ai_protect is False




"""
device_groups.py – Endpoints quản lý Phân vùng Nhóm thiết bị / Khu vực phòng.
Người làm: DuongVanHieu
Nghiệp vụ: Quản lý nhóm phòng, kiểm tra tính duy nhất tên nhóm trong căn nhà,
phân công thiết bị và bảo toàn trạng thái thiết bị khi xóa nhóm.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_device_group import crud_device_group
from app.crud.crud_house import crud_house
from app.models.device_group import DeviceGroup
from app.models.user import User
from app.schemas.device import DeviceOut
from app.schemas.device_group import (
    BatchAssignDevices,
    DeviceGroupCreate,
    DeviceGroupOut,
    DeviceGroupUpdate,
)

router = APIRouter()


async def _get_group_or_404(db: AsyncSession, group_id: UUID) -> DeviceGroup:
    """Tra cứu nhóm khu vực theo UUID hoặc trả về HTTP 404 (Tách logic lặp lại từ lần 3 - Rule DRY)."""
    group = await crud_device_group.get_by_id(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nhóm khu vực không tồn tại.",
        )
    return group


def _to_group_out(group: DeviceGroup) -> DeviceGroupOut:
    """Chuyển đổi ORM Model DeviceGroup sang Schema hiển thị kèm số lượng trực tuyến (DRY)."""
    devs = group.devices or []
    return DeviceGroupOut(
        id=group.id,
        house_id=group.house_id,
        name=group.name,
        description=group.description,
        icon=group.icon,
        color=group.color,
        sort_order=group.sort_order,
        device_count=len(devs),
        online_count=sum(1 for d in devs if d.is_online),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.get("", response_model=List[DeviceGroupOut])
@router.get("/", response_model=List[DeviceGroupOut], include_in_schema=False)
async def list_device_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách tất cả các nhóm khu vực trong căn nhà hiện tại."""
    house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
    return await crud_device_group.get_groups_by_house(db, house_id=house.id)


@router.post("", response_model=DeviceGroupOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=DeviceGroupOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_device_group(
    group_in: DeviceGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Tạo nhóm khu vực mới trong nhà.
    Ràng buộc nghiệp vụ:
    1. Tên nhóm không được để trống (đã validate trong schema).
    2. Tên nhóm là duy nhất trong căn nhà (không phân biệt chữ hoa/thường).
    3. Hỗ trợ gán ngay danh sách thiết bị ban đầu vào nhóm.
    """
    house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)

    existing = await crud_device_group.get_by_house_and_name(
        db, house_id=house.id, name=group_in.name
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Tên nhóm "{group_in.name.strip()}" đã tồn tại. Tên nhóm mới phải là duy nhất.',
        )

    group = await crud_device_group.create(db, house_id=house.id, obj_in=group_in)
    return _to_group_out(group)


@router.get("/{group_id}", response_model=DeviceGroupOut)
async def get_device_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết một nhóm khu vực."""
    group = await _get_group_or_404(db, group_id)
    return _to_group_out(group)


@router.get("/{group_id}/devices", response_model=List[DeviceOut])
async def get_devices_in_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các thiết bị thuộc một nhóm cụ thể."""
    group = await _get_group_or_404(db, group_id)
    return group.devices or []


@router.patch("/{group_id}", response_model=DeviceGroupOut)
@router.put("/{group_id}", response_model=DeviceGroupOut)
async def update_device_group(
    group_id: UUID,
    obj_in: DeviceGroupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Chỉnh sửa nhóm: đổi tên và cập nhật lại danh sách thiết bị thuộc nhóm."""
    group = await _get_group_or_404(db, group_id)

    # Nếu đổi tên, kiểm tra trùng lặp với các nhóm khác trong nhà
    if obj_in.name and obj_in.name.strip().lower() != group.name.lower():
        existing = await crud_device_group.get_by_house_and_name(
            db, house_id=group.house_id, name=obj_in.name
        )
        if existing and existing.id != group.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Tên nhóm "{obj_in.name.strip()}" đã tồn tại. Tên nhóm mới phải là duy nhất.',
            )

    updated_group = await crud_device_group.update(db, group=group, obj_in=obj_in)
    return _to_group_out(updated_group)


@router.delete("/{group_id}", status_code=status.HTTP_200_OK)
async def delete_device_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Xóa nhóm khu vực:
    Toàn bộ thiết bị trong nhóm sẽ tự động chuyển về trạng thái 'Chưa nhóm' (group_id = NULL)
    chứ không bị xóa mất khỏi tài khoản.
    """
    group = await _get_group_or_404(db, group_id)
    group_name = group.name
    await crud_device_group.delete(db, group=group)
    return {"message": f"Đã xóa nhóm '{group_name}' thành công."}


@router.post("/assign", status_code=status.HTTP_200_OK)
async def assign_devices_to_group_body(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gán thiết bị vào nhóm với body chứa group_id và device_ids."""
    raw_group_id = payload.get("group_id")
    device_ids = payload.get("device_ids", [])
    if not raw_group_id:
        raise HTTPException(status_code=400, detail="Thiếu group_id")

    group = await _get_group_or_404(db, UUID(str(raw_group_id)))
    parsed_dev_ids = [UUID(str(d)) for d in device_ids]
    await crud_device_group.assign_devices(db, group=group, device_ids=parsed_dev_ids)
    return {
        "message": f"Đã gán {len(parsed_dev_ids)} thiết bị vào nhóm '{group.name}'.",
        "updated_count": len(parsed_dev_ids),
    }


@router.post("/{group_id}/assign", status_code=status.HTTP_200_OK)
async def assign_devices_to_group(
    group_id: UUID,
    assign_in: BatchAssignDevices,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gán hàng loạt thiết bị vào một nhóm."""
    group = await _get_group_or_404(db, group_id)
    await crud_device_group.assign_devices(
        db, group=group, device_ids=assign_in.device_ids
    )
    return {
        "message": f"Đã gán {len(assign_in.device_ids)} thiết bị vào nhóm '{group.name}'.",
        "updated_count": len(assign_in.device_ids),
    }

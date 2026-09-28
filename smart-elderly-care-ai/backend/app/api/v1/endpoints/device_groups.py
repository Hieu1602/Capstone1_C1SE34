"""
device_groups.py – Endpoints quản lý Phân vùng Nhóm thiết bị / Khu vực phòng.
Hỗ trợ:
- Lấy danh sách nhóm kèm số lượng thiết bị trực tuyến.
- Tạo nhóm mới (kiểm tra tên duy nhất không trùng lặp, không rỗng).
- Chỉnh sửa nhóm và phân công lại thiết bị.
- Xóa nhóm (tự động chuyển thiết bị về 'Chưa nhóm').
Vị trí: backend/app/api/v1/endpoints/device_groups.py
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_device_group import crud_device_group
from app.crud.crud_house import crud_house
from app.models.user import User
from app.schemas.device import DeviceOut
from app.schemas.device_group import (
    BatchAssignDevices,
    DeviceGroupCreate,
    DeviceGroupOut,
    DeviceGroupUpdate,
)

router = APIRouter()


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

    # Kiểm tra trùng lặp tên nhóm
    existing = await crud_device_group.get_by_house_and_name(
        db, house_id=house.id, name=group_in.name
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Tên nhóm "{group_in.name.strip()}" đã tồn tại. Tên nhóm mới phải là duy nhất.',
        )

    group = await crud_device_group.create(db, house_id=house.id, obj_in=group_in)
    
    # Trả về kèm số lượng thiết bị đã gán
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


@router.get("/{group_id}/devices", response_model=List[DeviceOut])
async def get_devices_in_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các thiết bị thuộc một nhóm cụ thể."""
    group = await crud_device_group.get_by_id(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nhóm khu vực không tồn tại.",
        )
    return group.devices or []


@router.patch("/{group_id}", response_model=DeviceGroupOut)
async def update_device_group(
    group_id: UUID,
    obj_in: DeviceGroupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chỉnh sửa nhóm: đổi tên và cập nhật lại danh sách thiết bị thuộc nhóm.
    """
    group = await crud_device_group.get_by_id(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nhóm khu vực không tồn tại.",
        )

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
    devs = updated_group.devices or []
    return DeviceGroupOut(
        id=updated_group.id,
        house_id=updated_group.house_id,
        name=updated_group.name,
        description=updated_group.description,
        icon=updated_group.icon,
        color=updated_group.color,
        sort_order=updated_group.sort_order,
        device_count=len(devs),
        online_count=sum(1 for d in devs if d.is_online),
        created_at=updated_group.created_at,
        updated_at=updated_group.updated_at,
    )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    group = await crud_device_group.get_by_id(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nhóm khu vực không tồn tại.",
        )

    await crud_device_group.delete(db, group=group)


@router.post("/{group_id}/assign", status_code=status.HTTP_200_OK)
async def assign_devices_to_group(
    group_id: UUID,
    assign_in: BatchAssignDevices,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gán hàng loạt thiết bị vào một nhóm."""
    group = await crud_device_group.get_by_id(db, id=group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nhóm khu vực không tồn tại.",
        )

    await crud_device_group.assign_devices(
        db, group=group, device_ids=assign_in.device_ids
    )
    return {"message": f"Đã gán {len(assign_in.device_ids)} thiết bị vào nhóm '{group.name}'."}


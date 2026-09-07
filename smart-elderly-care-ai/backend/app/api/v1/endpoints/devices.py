"""
devices.py – Quản lý các Hub Orange Pi 5.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_device import crud_device
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceOut, DeviceStatus

router = APIRouter()


@router.get("/", response_model=List[DeviceOut])
async def list_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách tất cả thiết bị Hub của người dùng."""
    return await crud_device.get_by_owner(db, owner_id=current_user.id)


@router.post("/", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def register_device(
    device_in: DeviceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Đăng ký Hub mới."""
    existing = await crud_device.get_by_device_id(db, device_id=device_in.device_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã thiết bị (device_id) đã được đăng ký.",
        )
    return await crud_device.create(db, owner_id=current_user.id, obj_in=device_in)


@router.get("/{device_id}/status", response_model=DeviceStatus)
async def get_device_status(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kiểm tra trạng thái online/offline và heartbeat của Hub."""
    device = await crud_device.get_by_id(db, id=device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thiết bị không tồn tại.",
        )
    return DeviceStatus(
        device_id=device.device_id,
        is_online=device.is_online,
        last_heartbeat=device.last_heartbeat,
    )


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa đăng ký Hub."""
    device = await crud_device.get_by_id(db, id=device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thiết bị không tồn tại.",
        )
    if device.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa thiết bị này.",
        )
    await crud_device.delete(db, db_obj=device)

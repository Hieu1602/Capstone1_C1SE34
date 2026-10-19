"""
devices.py – Endpoints Quản lý Thiết bị IoT Master (Camera AI, Smartband, Edge Hub).
Người làm: DuongVanHieu
Nghiệp vụ: Quản trị thiết bị ngoại vi, xử lý cấu hình tham số telemetry, heartbeat và điều khiển từ xa.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_device import crud_device
from app.crud.crud_house import crud_house
from app.models.device import Device
from app.models.user import User
from app.schemas.device import (
    DeviceConfigOut,
    DeviceConfigUpdate,
    DeviceCreate,
    DeviceOut,
    DeviceStatus,
    DeviceUpdate,
)

router = APIRouter()


async def _get_device_or_404(db: AsyncSession, device_id: str) -> Device:
    """Tra cứu thiết bị theo ID/UUID hoặc trả về HTTP 404 (Tách logic lặp lại từ lần 3 - Rule DRY)."""
    device = await crud_device.get_by_id_or_device_id(db, id_or_device_id=device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thiết bị không tồn tại.",
        )
    return device


@router.get("", response_model=List[DeviceOut])
@router.get("/", response_model=List[DeviceOut], include_in_schema=False)
async def list_devices(
    device_type: Optional[str] = Query(None, description="Lọc theo loại: CAMERA, SMARTBAND, EDGE_HUB, SENSOR"),
    group_id: Optional[UUID] = Query(None, description="Lọc theo ID nhóm khu vực phòng"),
    is_online: Optional[bool] = Query(None, description="Lọc theo trạng thái trực tuyến"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách thiết bị của người dùng hoặc toàn bộ thiết bị nếu là Admin."""
    return await crud_device.get_by_user(
        db,
        user_id=current_user.id,
        is_admin=current_user.role == "admin",
        device_type=device_type,
        group_id=group_id,
        is_online=is_online,
    )


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=DeviceOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def register_device(
    device_in: DeviceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng ký thiết bị IoT mới (thêm thủ công hoặc qua quét mã QR).
    Tự động liên kết vào căn nhà mặc định của người dùng nếu chưa chỉ định.
    """
    existing = await crud_device.get_by_device_id(db, device_id=device_in.device_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã thiết bị '{device_in.device_id}' đã được đăng ký trên hệ thống.",
        )

    if not device_in.house_id:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        device_in.house_id = house.id

    return await crud_device.create(db, owner_id=current_user.id, obj_in=device_in)


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết một thiết bị kèm cấu hình chuyên sâu (DeviceConfig). Hỗ trợ cả UUID hoặc mã chuỗi."""
    return await _get_device_or_404(db, device_id)


@router.patch("/{device_id}", response_model=DeviceOut)
@router.put("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: str,
    obj_in: DeviceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin cơ bản của thiết bị (tên, phân vùng nhóm phòng, trạng thái)."""
    device = await _get_device_or_404(db, device_id)
    return await crud_device.update(db, device=device, obj_in=obj_in)


@router.patch("/{device_id}/config", response_model=DeviceConfigOut)
@router.put("/{device_id}/config", response_model=DeviceConfigOut)
async def update_device_config(
    device_id: str,
    config_in: DeviceConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cập nhật cấu hình chuyên sâu của thiết bị:
    - Camera: luồng RTSP stream_url, resolution (2K/FHD/SD), is_sleep, is_ai_protect.
    - Smartband: hr_threshold_high, hr_threshold_low, spo2_threshold_low, fall_impact_threshold.
    """
    device = await _get_device_or_404(db, device_id)
    return await crud_device.update_config(db, device=device, config_in=config_in)


@router.get("/{device_id}/config", response_model=DeviceConfigOut)
async def get_device_config(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy cấu hình chi tiết và các ngưỡng an toàn của thiết bị."""
    device = await _get_device_or_404(db, device_id)
    return device.config or await crud_device.update_config(db, device=device, config_in=DeviceConfigUpdate())


@router.post("/{device_id}/reboot", status_code=status.HTTP_200_OK)
async def reboot_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gửi tín hiệu khởi động lại thiết bị IoT qua MQTT."""
    device = await _get_device_or_404(db, device_id)
    return {
        "status": "success",
        "message": f"Lệnh khởi động lại đã được gửi tới thiết bị '{device.name}' ({device.device_id}).",
    }


@router.get("/{device_id}/status", response_model=DeviceStatus)
async def get_device_status(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kiểm tra trạng thái online/offline, pin và heartbeat của thiết bị."""
    device = await _get_device_or_404(db, device_id)
    return DeviceStatus(
        device_id=device.device_id,
        is_online=device.is_online,
        last_heartbeat=device.last_heartbeat,
        battery_level=device.battery_level,
        status_text=device.status_text,
    )


@router.post("/{device_id}/heartbeat", status_code=status.HTTP_200_OK)
async def post_device_heartbeat(
    device_id: str,
    battery_level: Optional[int] = Query(None, ge=0, le=100),
    status_text: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """API nhận heartbeat định kỳ từ thiết bị hoặc Edge Hub."""
    await crud_device.update_heartbeat(
        db,
        device_id=device_id,
        battery_level=battery_level,
        status_text=status_text,
    )
    return {"status": "ok", "message": f"Heartbeat recorded for device '{device_id}'"}


@router.delete("/{device_id}", status_code=status.HTTP_200_OK)
async def delete_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gỡ bỏ thiết bị khỏi hệ thống."""
    device = await _get_device_or_404(db, device_id)
    if device.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa thiết bị này.",
        )
    await crud_device.delete(db, db_obj=device)
    return {"message": f"Đã xóa thiết bị '{device.name}' thành công"}

"""
system.py
API Quản lý Trạng thái Hệ thống & Redis Cache Diagnostics.
Cung cấp các endpoint giám sát bộ nhớ đệm Redis, thiết bị Online và cảnh báo khẩn cấp.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.crud.crud_house import crud_house
from app.models.user import User
from app.services.redis import redis_service

router = APIRouter()


@router.get("/redis-status", summary="Kiểm tra trạng thái & Thống kê Redis")
async def get_redis_status() -> Dict[str, Any]:
    """
    Trả về thông tin chẩn đoán kỹ thuật của máy chủ Redis:
    - Trạng thái kết nối
    - Tổng số lượng keys đang lưu trữ trong RAM
    - Dung lượng RAM đang chiếm dụng (ví dụ: 1.30M)
    - Số lượng thiết bị Edge Hub đang hoạt động (Online)
    - Phiên bản Redis và thời gian hoạt động liên tục (Uptime)
    """
    return await redis_service.get_system_stats()


@router.post("/redis-seed", summary="Nạp dữ liệu mẫu vào Redis", status_code=status.HTTP_201_CREATED)
async def seed_redis_data() -> Dict[str, Any]:
    """
    Nạp dữ liệu mẫu sinh động vào Redis Cache:
    1. Thiết bị 'hub-livingroom-01' (Phòng khách - Chỉ số sinh hiệu bình thường).
    2. Thiết bị 'hub-bedroom-02' (Phòng ngủ - Cảnh báo nhịp tim cao).
    3. 2 bản ghi sự cố khẩn cấp vào List 'alerts:recent'.

    => Sau khi gọi API này, bạn mở tiện ích 'Redis for VS Code' sẽ thấy ngay các key!
    """
    return await redis_service.seed_sample_data()


@router.get("/recent-alerts", summary="Lấy danh sách cảnh báo gần nhất từ Redis RAM")
async def get_recent_alerts(
    limit: int = Query(default=10, ge=1, le=50, description="Số lượng cảnh báo cần lấy (1-50)")
) -> List[Dict[str, Any]]:
    """
    Lấy nhanh danh sách cảnh báo sự cố khẩn cấp (té ngã, bất thường) từ hàng đợi Redis RAM.
    Tối ưu cho việc tải nhanh màn hình chuông thông báo trên ứng dụng Mobile.
    """
    return await redis_service.get_recent_alerts(limit=limit)


@router.get("/devices/online", summary="Danh sách thiết bị Edge Hub đang Online")
async def get_online_devices() -> List[str]:
    """
    Trả về danh sách các mã thiết bị (device_id) đang phát tín hiệu định kỳ lên máy chủ.
    """
    return await redis_service.get_online_devices()


@router.get("/mode", summary="Lấy trạng thái chế độ an ninh hệ thống")
async def get_system_mode(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Lấy chế độ an ninh hệ thống và cấu hình báo động hiện tại."""
    mode = "HOME"
    if current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        mode = house.current_mode
    return {
        "mode": mode,
        "is_mute_alarm": False,
        "is_camera_privacy": mode == "PRIVACY",
        "mute_mode": "SILENT",
        "duration_minutes": 60,
    }


@router.put("/mode", summary="Cập nhật chế độ an ninh hệ thống")
async def update_system_mode(
    payload: Dict[str, Any] = Body(...),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Cập nhật chế độ an ninh (HOME, AWAY, DISARM, ALARM, PRIVACY) và chế độ còi báo động."""
    mode = str(payload.get("mode", "HOME")).upper().strip()
    if current_user:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        await crud_house.update_mode(db, house=house, mode=mode)
    return {
        "status": "success",
        "mode": mode,
        "is_mute_alarm": payload.get("is_mute_alarm", False),
        "is_camera_privacy": mode == "PRIVACY",
    }


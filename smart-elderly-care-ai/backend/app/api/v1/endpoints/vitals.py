"""
vitals.py – API lấy và cập nhật dữ liệu nhịp tim, SpO2, nhiệt độ chuỗi thời gian (REST).
Hỗ trợ:
- Lấy sinh hiệu hiện tại chuẩn hóa cho Dashboard (/vitals/current).
- Tra cứu chỉ số mới nhất, lịch sử và thống kê theo mã phần cứng (VD: 'BLE_BAND_001') hoặc UUID.
- Tiếp nhận dữ liệu đo mới (POST) và tự động đồng bộ sang TimescaleDB, Redis và WebSocket.
Vị trí: backend/app/api/v1/endpoints/vitals.py
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.crud.crud_vital import crud_vital
from app.models.user import User
from app.schemas.vital import VitalCreate, VitalCurrentOut, VitalOut, VitalStats

router = APIRouter()


@router.get("/current", response_model=VitalCurrentOut)
async def get_current_vitals(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy chỉ số sinh hiệu hiện tại phục vụ hiển thị tức thì trên Dashboard Mobile.
    Nếu người dùng đã đăng nhập, tự động lấy dữ liệu từ thiết bị Smartband trong căn nhà.
    """
    user_id = current_user.id if current_user else UUID("640e3d97-b4e1-4b08-b2d3-d949a0eb075c")
    data = await crud_vital.get_current_for_user(db, user_id=user_id)
    return data


@router.get("/{device_identifier}/latest", response_model=VitalOut)
async def get_latest_vitals(
    device_identifier: str = Path(..., description="Mã phần cứng (VD: BLE_BAND_001) hoặc UUID thiết bị"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy chỉ số sinh hiệu mới nhất của một thiết bị."""
    vital = await crud_vital.get_latest(db, device_id=device_identifier)
    if not vital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chưa có dữ liệu sinh hiệu cho thiết bị '{device_identifier}'.",
        )
    return vital


@router.get("/{device_identifier}/history", response_model=List[VitalOut])
async def get_vital_history(
    device_identifier: str = Path(..., description="Mã phần cứng (VD: BLE_BAND_001) hoặc UUID thiết bị"),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """Lấy lịch sử chỉ số sinh hiệu theo chuỗi thời gian (phân trang)."""
    return await crud_vital.get_history(
        db, device_id=device_identifier, limit=limit, offset=offset
    )


@router.get("/{device_identifier}/stats", response_model=VitalStats)
async def get_vital_stats(
    device_identifier: str = Path(..., description="Mã phần cứng (VD: BLE_BAND_001) hoặc UUID thiết bị"),
    hours: int = Query(default=24, le=720, description="Khoảng thời gian thống kê tính theo giờ"),
    db: AsyncSession = Depends(get_db),
):
    """Thống kê sinh hiệu trong N giờ gần nhất (min, max, avg, số lần té ngã)."""
    return await crud_vital.get_stats(db, device_id=device_identifier, hours=hours)


@router.post("", response_model=VitalOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=VitalOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_vital_sign(
    payload: VitalCreate = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Tiếp nhận bản tin đo sinh hiệu mới từ IoT Edge Hub / Smartband.
    Tự động ghi vào TimescaleDB, cập nhật Redis RAM và đẩy WebSocket.
    """
    data = payload.model_dump(exclude_unset=True)
    if not data.get("device_id"):
        data["device_id"] = "BLE_BAND_001"
    
    return await crud_vital.create(db, data=data)


@router.post("/{device_identifier}", response_model=VitalOut, status_code=status.HTTP_201_CREATED)
async def create_vital_for_device(
    device_identifier: str = Path(...),
    payload: VitalCreate = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Tiếp nhận sinh hiệu cho một thiết bị cụ thể qua URL path."""
    data = payload.model_dump(exclude_unset=True)
    data["device_id"] = device_identifier
    return await crud_vital.create(db, data=data)

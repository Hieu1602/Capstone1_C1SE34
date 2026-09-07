"""
vitals.py – API lấy dữ liệu nhịp tim, SpO2, nhiệt độ (REST).
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.crud.crud_vital import crud_vital
from app.schemas.vital import VitalOut, VitalStats

router = APIRouter()


@router.get("/{device_id}/latest", response_model=VitalOut)
async def get_latest_vitals(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Lấy chỉ số sinh hiệu mới nhất của một thiết bị."""
    vital = await crud_vital.get_latest(db, device_id=device_id)
    if not vital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chưa có dữ liệu sinh hiệu cho thiết bị này.",
        )
    return vital


@router.get("/{device_id}/history", response_model=List[VitalOut])
async def get_vital_history(
    device_id: UUID,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """Lấy lịch sử chỉ số sinh hiệu (có phân trang)."""
    return await crud_vital.get_history(
        db, device_id=device_id, limit=limit, offset=offset
    )


@router.get("/{device_id}/stats", response_model=VitalStats)
async def get_vital_stats(
    device_id: UUID,
    hours: int = Query(default=24, le=720),
    db: AsyncSession = Depends(get_db),
):
    """Thống kê sinh hiệu trong N giờ gần nhất (min, max, avg)."""
    return await crud_vital.get_stats(db, device_id=device_id, hours=hours)

"""
incidents.py – API quản lý lịch sử sự kiện và clip video bằng chứng.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.crud.crud_incident import crud_incident
from app.schemas.incident import IncidentAck, IncidentOut

router = APIRouter()


@router.get("/", response_model=List[IncidentOut])
async def list_incidents(
    device_id: UUID | None = Query(default=None),
    alert_level: str | None = Query(default=None),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách sự kiện cảnh báo.
    Có thể lọc theo device_id và alert_level.
    """
    return await crud_incident.list(
        db=db,
        device_id=device_id,
        alert_level=alert_level,
        limit=limit,
        offset=offset,
    )


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết một sự kiện cụ thể kèm URL clip video 5 giây."""
    incident = await crud_incident.get(db, incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return incident


@router.patch("/{incident_id}/acknowledge", response_model=IncidentOut)
async def acknowledge_incident(
    incident_id: UUID,
    ack: IncidentAck = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Xác nhận đã xử lý sự kiện (caregiver/bác sĩ mark as handled)."""
    incident = await crud_incident.acknowledge(db, incident_id, notes=ack.notes)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return incident

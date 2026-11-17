"""
incidents.py – API quản lý lịch sử sự kiện và clip video bằng chứng.
"""

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.crud.crud_incident import crud_incident
from app.models.user import User
from app.schemas.incident import IncidentAck, IncidentOut

logger = logging.getLogger("incidents")

router = APIRouter()


@router.get("", response_model=List[IncidentOut])
@router.get("/", response_model=List[IncidentOut], include_in_schema=False)
async def list_incidents(
    device_id: str | None = Query(default=None),
    alert_level: str | None = Query(default=None),
    target_role: str | None = Query(default=None, description="Lọc đối tượng nhận: doctor | family | caregiver"),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Lấy danh sách sự kiện cảnh báo có phân tuyến thông minh (Smart Alert Routing).
    - Bác sĩ (Doctor Portal): Chỉ nhận Cảnh báo Nguy cấp (CRITICAL) và Lịch khám/Lời mời, kèm Cooldown 15-30 phút chống spam.
    - Gia đình (Family App): Nhận 100% sự kiện bao gồm tình trạng thiết bị (pin, kết nối) và cảnh báo sinh hiệu.
    """
    curr_uid = current_user.id if current_user else None
    effective_target_role = target_role or ("doctor" if (current_user and current_user.role == "doctor") else None)
    cache_key = f"cache:incidents:u_{str(curr_uid)}:r_{effective_target_role or 'all'}:d_{device_id or 'all'}:l_{alert_level or 'all'}:lim_{limit}:off_{offset}"

    # 1. Thử lấy từ Redis Cache (< 1ms)
    from app.services.redis import redis_service
    try:
        cached = await redis_service.get_cached_incidents(cache_key)
        if cached is not None:
            return [IncidentOut(**item) for item in cached]
    except Exception as e:
        logger.debug("[Redis] Cache miss hoặc lỗi: %s", e)

    resolved_dev_uuid = None
    if device_id:
        from app.crud.crud_vital import crud_vital
        resolved_dev_uuid = await crud_vital.resolve_device_uuid(db, device_id)

    incidents = await crud_incident.list(
        db=db,
        device_id=resolved_dev_uuid,
        alert_level=alert_level,
        limit=limit,
        offset=offset,
        current_user_id=curr_uid,
        target_role=effective_target_role,
    )

    # 2. Lưu vào Redis Cache (TTL = 180s)
    try:
        serialized = [IncidentOut.model_validate(inc).model_dump(mode="json") for inc in incidents]
        await redis_service.set_cached_incidents(cache_key, serialized, ttl=180)
    except Exception as cache_err:
        logger.debug("[Redis] Không thể lưu cache incidents: %s", cache_err)

    return incidents


@router.post("/acknowledge-all")
@router.patch("/acknowledge-all")
async def acknowledge_all_incidents(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Xác nhận đã đọc toàn bộ thông báo/cảnh báo và lưu vào CSDL."""
    curr_uid = current_user.id if current_user else None
    count = await crud_incident.acknowledge_all(db, current_user_id=curr_uid)
    try:
        from app.services.redis import redis_service
        await redis_service.invalidate_incidents_cache()
    except Exception:
        pass
    return {"status": "success", "acknowledged_count": count}


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
@router.post("/{incident_id}/acknowledge", response_model=IncidentOut)
async def acknowledge_incident(
    incident_id: UUID,
    ack: IncidentAck | None = Body(default=None),
    note: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Xác nhận đã xử lý sự kiện (caregiver/bác sĩ mark as handled)."""
    resolved_note = ack.notes if (ack and ack.notes) else note
    ack_by = current_user.id if current_user else None
    incident = await crud_incident.acknowledge(
        db, incident_id, notes=resolved_note, acknowledged_by=ack_by
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    # Nếu người nhà xác nhận thông báo đặt lịch khám của Bác sĩ -> đồng bộ xác nhận & báo Bác sĩ
    if incident.alert_type == "APPOINTMENT_SCHEDULED" and incident.notes:
        from app.services.notification.appointment_notify import notify_doctor_appointment_confirmed
        try:
            await notify_doctor_appointment_confirmed(
                db=db,
                appointment_id=incident.notes,
                ack_user=current_user,
            )
        except Exception as notify_err:
            logger.warning("[acknowledge_incident] Lỗi kích hoạt notify_doctor_appointment_confirmed: %s", notify_err)

    # Lấy tên hiển thị của người xử lý
    handler_name = incident.acknowledged_by_name
    if not handler_name and current_user:
        handler_name = current_user.full_name or current_user.phone
    if not handler_name:
        handler_name = "Bác sĩ phụ trách"

    # Broadcast WebSocket INCIDENT_RESOLVED tới tất cả client (Mobile + Web Bác sĩ + Web Admin)
    try:
        from app.api.websockets.vitals_ws import alert_clients
        import json
        ack_ws_payload = json.dumps({
            "type": "INCIDENT_RESOLVED",
            "incident_id": str(incident.id),
            "data": {
                "id": str(incident.id),
                "is_acknowledged": True,
                "acknowledged_by": str(incident.acknowledged_by) if incident.acknowledged_by else str(ack_by or ""),
                "acknowledged_by_name": handler_name,
                "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
                "note": resolved_note or "Đã xác nhận xử lý",
            }
        }, ensure_ascii=False)
        for client_ws in list(alert_clients):
            try:
                await client_ws.send_text(ack_ws_payload)
            except Exception:
                if client_ws in alert_clients:
                    alert_clients.remove(client_ws)
    except Exception as ws_err:
        logger.warning("[acknowledge_incident] WS broadcast error: %s", ws_err)

    try:
        from app.services.redis import redis_service
        await redis_service.invalidate_incidents_cache()
    except Exception:
        pass

    return incident


@router.patch("/{incident_id}/reopen", response_model=IncidentOut)
@router.post("/{incident_id}/reopen", response_model=IncidentOut)
async def reopen_incident(
    incident_id: UUID,
    note: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Mở lại cảnh báo sự cố nếu người cao tuổi chưa an toàn."""
    incident = await crud_incident.reopen(
        db, incident_id, notes=note or "Chưa an toàn - Người nhà đã mở lại cảnh báo khẩn cấp"
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    try:
        from app.services.redis import redis_service
        await redis_service.invalidate_incidents_cache()
    except Exception:
        pass
    return incident


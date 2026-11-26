"""
incidents.py – API quản lý lịch sử sự kiện và clip video bằng chứng.
"""

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, status
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
    from sqlalchemy import select
    from app.models.incident import Incident
    from app.services.notification.appointment_notify import (
        extract_appointment_id,
        notify_doctor_appointment_confirmed,
    )

    curr_uid = current_user.id if current_user else None

    apt_ids_to_confirm: list[str] = []
    if curr_uid:
        scoped_incidents = await crud_incident.list(db, limit=100, current_user_id=curr_uid)
    else:
        res = await db.execute(
            select(Incident).where(
                Incident.is_acknowledged.is_(False),
                Incident.alert_type.in_(["APPOINTMENT_SCHEDULED", "APPOINTMENT_RESCHEDULED"]),
            )
        )
        scoped_incidents = list(res.scalars().all())

    for inc in scoped_incidents:
        if (
            not inc.is_acknowledged
            and inc.alert_type in ("APPOINTMENT_SCHEDULED", "APPOINTMENT_RESCHEDULED")
            and inc.notes
            and "APPOINTMENT_REQUESTED" not in inc.notes
        ):
            apt_id = extract_appointment_id(inc.notes)
            if apt_id and apt_id not in apt_ids_to_confirm:
                apt_ids_to_confirm.append(apt_id)

    count = await crud_incident.acknowledge_all(db, current_user_id=curr_uid)
    await db.commit()

    for apt_id in apt_ids_to_confirm:
        try:
            await notify_doctor_appointment_confirmed(
                db=db,
                appointment_id=apt_id,
                ack_user=current_user,
            )
        except Exception as notify_err:
            logger.warning("[acknowledge_all_incidents] Lỗi đồng bộ xác nhận lịch %s: %s", apt_id, notify_err)

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


async def _bg_post_acknowledge(ack_ws_payload: str):
    """Background task: Phát WebSocket và xóa cache Redis sau khi phản hồi nhanh <200ms."""
    try:
        from app.api.websockets.vitals_ws import alert_clients
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


async def _bg_post_reopen(reopen_ws_payload: str):
    """Background task: Phát WebSocket kích hoạt lại còi & xóa cache Redis."""
    try:
        from app.api.websockets.vitals_ws import alert_clients
        for client_ws in list(alert_clients):
            try:
                await client_ws.send_text(reopen_ws_payload)
            except Exception:
                if client_ws in alert_clients:
                    alert_clients.remove(client_ws)
    except Exception as ws_err:
        logger.warning("[reopen_incident] WS broadcast error: %s", ws_err)

    try:
        from app.services.redis import redis_service
        await redis_service.invalidate_incidents_cache()
    except Exception:
        pass


@router.patch("/{incident_id}/acknowledge", response_model=IncidentOut)
@router.post("/{incident_id}/acknowledge", response_model=IncidentOut)
async def acknowledge_incident(
    incident_id: UUID,
    background_tasks: BackgroundTasks,
    ack: IncidentAck | None = Body(default=None),
    note: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Xác nhận đã xử lý sự kiện (caregiver/bác sĩ mark as handled) - phản hồi <200ms."""
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
    is_doctor_actor = bool(current_user and current_user.role == "doctor")
    if (
        not is_doctor_actor
        and incident.alert_type in ("APPOINTMENT_SCHEDULED", "APPOINTMENT_RESCHEDULED")
        and incident.notes
        and "APPOINTMENT_REQUESTED" not in incident.notes
    ):
        from app.services.notification.appointment_notify import (
            extract_appointment_id,
            notify_doctor_appointment_confirmed,
        )
        apt_id = extract_appointment_id(incident.notes)
        if apt_id:
            try:
                await notify_doctor_appointment_confirmed(
                    db=db,
                    appointment_id=apt_id,
                    ack_user=current_user,
                )
                incident = await crud_incident.get(db, incident_id) or incident
            except Exception as notify_err:
                logger.warning("[acknowledge_incident] Lỗi kích hoạt notify_doctor_appointment_confirmed: %s", notify_err)

    # Hủy bộ đếm ngược tự động gọi cấp cứu nếu đang chạy
    try:
        from app.services.escalation_service import cancel_auto_escalation
        cancel_auto_escalation(incident.id)
    except Exception:
        pass

    # Lấy tên hiển thị của người xử lý
    handler_name = incident.acknowledged_by_name
    if not handler_name and current_user:
        handler_name = current_user.full_name or current_user.phone
    if not handler_name:
        handler_name = "Bác sĩ phụ trách"

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
    background_tasks.add_task(_bg_post_acknowledge, ack_ws_payload)

    return incident


@router.patch("/{incident_id}/reopen", response_model=IncidentOut)
@router.post("/{incident_id}/reopen", response_model=IncidentOut)
async def reopen_incident(
    incident_id: UUID,
    background_tasks: BackgroundTasks,
    note: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Mở lại cảnh báo sự cố nếu người cao tuổi chưa an toàn - phản hồi <200ms."""
    incident = await crud_incident.reopen(
        db, incident_id, notes=note or "Chưa an toàn - Người nhà đã mở lại cảnh báo khẩn cấp"
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    import json
    reopen_ws_payload = json.dumps({
        "type": "ALERT_NEW",
        "alert_type": incident.alert_type,
        "data": {
            "id": str(incident.id),
            "device_id": str(incident.device_id),
            "type": incident.alert_type,
            "alert_type": incident.alert_type,
            "alert_level": incident.alert_level,
            "message": incident.message,
            "is_acknowledged": False,
        }
    }, ensure_ascii=False)
    background_tasks.add_task(_bg_post_reopen, reopen_ws_payload)

    return incident


@router.post("/{incident_id}/escalate")
async def escalate_incident(
    incident_id: UUID,
    ack: IncidentAck | None = Body(default=None),
    note: str | None = Query(default=None),
):
    """
    Leo thang khẩn cấp tự động (ESCALATED_AUTO_CALL):
    - Đánh dấu sự cố đã kích hoạt gọi cấp cứu tự động sau 45s không phản hồi hoặc gọi ngay.
    - Broadcast sự kiện INCIDENT_ESCALATED qua WebSocket tới Bác sĩ & Gia đình.
    """
    from app.services.escalation_service import cancel_auto_escalation, mark_incident_escalated

    cancel_auto_escalation(incident_id)
    reason = ack.notes if (ack and ack.notes) else note
    result = await mark_incident_escalated(incident_id, reason=reason)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return {"status": "ok", "data": result}


"""
escalation_service.py – Dịch vụ Leo thang Khẩn cấp Tự động (Auto-Escalation SOS).

Khi phát hiện té ngã AI (FALL_DETECTED / AI_FALL_DETECTED) hoặc tam chứng nguy kịch (CRITICAL_TRIAD):
- Bước 1 (0s - 45s): Chờ người nhà hoặc người tại chỗ xác nhận hỗ trợ.
- Bước 2 (Sau 45s): Nếu sự cố vẫn chưa được xác nhận (is_acknowledged == False),
  tự động chuyển trạng thái sang ESCALATED_AUTO_CALL và broadcast WebSocket INCIDENT_ESCALATED
  tới App Gia đình & Cổng thông tin Bác sĩ.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from app.core.database import AsyncSessionLocal

logger = logging.getLogger("escalation_service")

DEFAULT_ESCALATION_DELAY_SECONDS = 45
ESCALATION_TAG = "ESCALATED_AUTO_CALL"

# Lưu các task đếm ngược đang chạy theo incident_id để tránh trùng lặp
_active_timers: dict[str, asyncio.Task] = {}


async def broadcast_ws_event(payload: dict) -> None:
    """Phát sự kiện WebSocket tới toàn bộ client đang kết nối (/ws/alerts)."""
    try:
        from app.api.websockets.vitals_ws import alert_clients
        text = json.dumps(payload, ensure_ascii=False)
        for client_ws in list(alert_clients):
            try:
                await client_ws.send_text(text)
            except Exception:
                if client_ws in alert_clients:
                    alert_clients.remove(client_ws)
    except Exception as exc:
        logger.warning("[Escalation] Lỗi broadcast WS: %s", exc)


async def mark_incident_escalated(incident_id: str | UUID, reason: str | None = None) -> dict | None:
    """Đánh dấu sự cố sang trạng thái ESCALATED_AUTO_CALL và phát WebSocket."""
    inc_uuid = UUID(str(incident_id))
    async with AsyncSessionLocal() as session:
        from app.models.incident import Incident
        incident = await session.get(Incident, inc_uuid)
        if not incident:
            return None

        if incident.is_acknowledged:
            # Đã có người nhà/bác sĩ xử lý -> không leo thang nữa
            return {
                "id": str(incident.id),
                "is_acknowledged": True,
                "escalation_status": "RESOLVED",
            }

        existing_notes = (incident.notes or "").strip()
        if ESCALATION_TAG not in existing_notes:
            tag_line = f"{ESCALATION_TAG}|{reason or 'Tự động kích hoạt gọi cấp cứu 115 sau 45s không phản hồi'}"
            incident.notes = f"{existing_notes}\n{tag_line}".strip() if existing_notes else tag_line
            await session.commit()
            await session.refresh(incident)

        try:
            from app.services.redis import redis_service
            await redis_service.invalidate_incidents_cache()
        except Exception:
            pass

        ws_payload = {
            "type": "INCIDENT_ESCALATED",
            "incident_id": str(incident.id),
            "data": {
                "id": str(incident.id),
                "device_id": str(incident.device_id),
                "alert_type": incident.alert_type,
                "escalation_status": ESCALATION_TAG,
                "escalated_at": datetime.now(timezone.utc).isoformat(),
                "message": "Đã tự động kích hoạt gọi cấp cứu 115 (Chưa có người nhà hỗ trợ)",
            },
        }
        await broadcast_ws_event(ws_payload)
        logger.warning("[Escalation] Đã leo thang khẩn cấp sự cố %s -> %s", incident.id, ESCALATION_TAG)
        return ws_payload["data"]


async def _escalation_countdown_worker(incident_id: str, delay_seconds: int) -> None:
    """Chờ hết delay_seconds, kiểm tra nếu chưa ai xử lý thì tự động leo thang."""
    try:
        await asyncio.sleep(delay_seconds)
        await mark_incident_escalated(incident_id)
    except asyncio.CancelledError:
        logger.info("[Escalation] Đã hủy bộ đếm ngược cho sự cố %s", incident_id)
    except Exception as exc:
        logger.error("[Escalation] Lỗi trong worker đếm ngược %s: %s", incident_id, exc)
    finally:
        _active_timers.pop(incident_id, None)


def schedule_auto_escalation(incident_id: str | UUID, delay_seconds: int = DEFAULT_ESCALATION_DELAY_SECONDS) -> None:
    """Lên lịch bộ đếm ngược leo thang tự động cho sự cố té ngã / nguy kịch."""
    inc_str = str(incident_id)
    existing = _active_timers.get(inc_str)
    if existing and not existing.done():
        return
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(_escalation_countdown_worker(inc_str, delay_seconds))
        _active_timers[inc_str] = task
        logger.info("[Escalation] Đã bật bộ đếm ngược %ds cho sự cố %s", delay_seconds, inc_str)
    except RuntimeError:
        logger.debug("[Escalation] Không có event loop để tạo task đếm ngược cho %s", inc_str)


def cancel_auto_escalation(incident_id: str | UUID) -> None:
    """Hủy bộ đếm ngược khi người nhà hoặc bác sĩ đã xác nhận xử lý."""
    inc_str = str(incident_id)
    task = _active_timers.pop(inc_str, None)
    if task and not task.done():
        task.cancel()

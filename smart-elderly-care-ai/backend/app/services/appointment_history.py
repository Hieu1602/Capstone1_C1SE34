"""
appointment_history.py – Ghi & đọc lịch sử thao tác lịch khám (ai làm gì, lúc mấy giờ, đổi từ gì sang gì).
Lỗi ghi lịch sử không được làm hỏng thao tác chính -> chỉ log cảnh báo.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Iterable, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import AppointmentEvent

logger = logging.getLogger(__name__)

# Trường được theo dõi khi so sánh trước/sau một lần sửa
TRACKED_FIELDS = ("scheduled_at", "duration_minutes", "visit_type", "location", "exam_type", "instructions", "status")


def _plain(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def snapshot(apt: Any) -> dict:
    """Chụp giá trị hiện tại (gọi TRƯỚC khi sửa – cùng session nên object sẽ bị cập nhật tại chỗ)."""
    return {f: _plain(getattr(apt, f, None)) for f in TRACKED_FIELDS}


def diff(before: dict, after: dict) -> dict:
    return {f: [before.get(f), after.get(f)] for f in TRACKED_FIELDS if before.get(f) != after.get(f)}


def resolve_update_action(changes: dict) -> str:
    return "RESCHEDULED" if "scheduled_at" in changes else "UPDATED"


async def record(
    db: AsyncSession,
    apt: Any,
    action: str,
    actor: Any = None,
    *,
    before: Optional[dict] = None,
    note: Optional[str] = None,
) -> None:
    """Ghi 1 sự kiện. Với action UPDATED + before: tự tính thay đổi và đổi thành RESCHEDULED nếu dời giờ."""
    try:
        changes = None
        if before is not None:
            changes = diff(before, snapshot(apt))
            if action == "UPDATED":
                action = resolve_update_action(changes)
        db.add(
            AppointmentEvent(
                appointment_id=apt.id,
                patient_id=getattr(apt, "patient_id", None),
                action=action,
                actor_id=getattr(actor, "id", None),
                actor_name=getattr(actor, "full_name", None),
                actor_role=getattr(actor, "role", None),
                changes_json=json.dumps(changes, ensure_ascii=False) if changes else None,
                note=(note or None),
            )
        )
        await db.commit()
    except Exception as e:  # pragma: no cover - phòng vệ
        logger.warning("[APPOINTMENT HISTORY] Không ghi được sự kiện %s cho %s: %s", action, getattr(apt, "id", None), e)
        try:
            await db.rollback()
        except Exception:
            pass


def to_dict(ev: AppointmentEvent) -> dict:
    changes = None
    if ev.changes_json:
        try:
            changes = json.loads(ev.changes_json)
        except ValueError:
            changes = None
    return {
        "id": str(ev.id),
        "appointment_id": str(ev.appointment_id),
        "action": ev.action,
        "actor_id": str(ev.actor_id) if ev.actor_id else None,
        "actor_name": ev.actor_name,
        "actor_role": ev.actor_role,
        "changes": changes,
        "note": ev.note,
        "created_at": ev.created_at,
    }


async def list_events(db: AsyncSession, appointment_id: uuid.UUID) -> list[dict]:
    res = await db.execute(
        select(AppointmentEvent)
        .where(AppointmentEvent.appointment_id == appointment_id)
        .order_by(AppointmentEvent.created_at.asc())
    )
    return [to_dict(e) for e in res.scalars().all()]


async def latest_events_map(db: AsyncSession, appointment_ids: Iterable[Any]) -> dict[str, dict]:
    """Sự kiện gần nhất của từng lịch (1 truy vấn) – để thẻ lịch hiện 'Đã dời lịch · 14:32 · BS. X'."""
    ids = [uuid.UUID(str(i)) for i in appointment_ids if i]
    if not ids:
        return {}
    latest = (
        select(AppointmentEvent.appointment_id, func.max(AppointmentEvent.created_at).label("mx"))
        .where(AppointmentEvent.appointment_id.in_(ids))
        .group_by(AppointmentEvent.appointment_id)
        .subquery()
    )
    res = await db.execute(
        select(AppointmentEvent).join(
            latest,
            (AppointmentEvent.appointment_id == latest.c.appointment_id)
            & (AppointmentEvent.created_at == latest.c.mx),
        )
    )
    return {str(e.appointment_id): to_dict(e) for e in res.scalars().all()}


async def attach_last_events(db: AsyncSession, responses: list) -> list:
    """Gắn last_event vào danh sách AppointmentResponse (bỏ qua lỗi để không làm hỏng API danh sách)."""
    try:
        events = await latest_events_map(db, [r.id for r in responses])
        for r in responses:
            ev = events.get(str(r.id))
            if ev:
                r.last_event = ev
    except Exception as e:  # pragma: no cover
        logger.warning("[APPOINTMENT HISTORY] Không tải được last_event: %s", e)
    return responses

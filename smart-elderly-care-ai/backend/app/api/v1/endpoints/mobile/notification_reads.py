"""
notification_reads.py – Trạng thái "đã đọc" thông báo lưu trên server (kèm thời điểm đọc),
để Doctor Web và App bác sĩ đồng bộ với nhau thay vì mỗi nơi lưu riêng trong localStorage/AsyncStorage.
"""

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.activity_log import NotificationRead
from app.models.user import User
from app.services.notification.appointment_notify import broadcast_alert_ws

router = APIRouter()

MAX_KEYS_PER_REQUEST = 500


class NotificationReadOut(BaseModel):
    key: str
    read_at: datetime


class NotificationReadUpdate(BaseModel):
    keys: List[str] = Field(..., min_length=1, max_length=MAX_KEYS_PER_REQUEST)
    read: bool = True


def _clean_keys(keys: List[str]) -> List[str]:
    return sorted({k.strip()[:100] for k in keys if k and k.strip()})


@router.get("", response_model=List[NotificationReadOut], summary="Danh sách thông báo đã đọc của tôi (kèm giờ đọc)")
async def list_my_reads(
    days: int = Query(60, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    res = await db.execute(
        select(NotificationRead.notification_key, NotificationRead.read_at).where(
            NotificationRead.user_id == current_user.id, NotificationRead.read_at >= since
        )
    )
    return [NotificationReadOut(key=k, read_at=t) for k, t in res.all()]


@router.post("", response_model=List[NotificationReadOut], summary="Đánh dấu đã đọc / chưa đọc")
async def set_my_reads(
    body: NotificationReadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    keys = _clean_keys(body.keys)
    if not keys:
        return []
    now = datetime.now(timezone.utc)
    if body.read:
        # Giữ giờ đọc ĐẦU TIÊN nếu đã đọc trước đó (không ghi đè)
        stmt = (
            pg_insert(NotificationRead)
            .values([{"user_id": current_user.id, "notification_key": k, "read_at": now} for k in keys])
            .on_conflict_do_nothing(constraint="uq_notification_reads_user_key")
        )
        await db.execute(stmt)
    else:
        await db.execute(
            delete(NotificationRead).where(
                NotificationRead.user_id == current_user.id, NotificationRead.notification_key.in_(keys)
            )
        )
    await db.commit()

    rows = []
    if body.read:
        res = await db.execute(
            select(NotificationRead.notification_key, NotificationRead.read_at).where(
                NotificationRead.user_id == current_user.id, NotificationRead.notification_key.in_(keys)
            )
        )
        rows = [NotificationReadOut(key=k, read_at=t) for k, t in res.all()]

    # Thiết bị khác của CÙNG người dùng tự cập nhật (client lọc theo user_id)
    await broadcast_alert_ws(
        {
            "type": "NOTIFICATIONS_READ",
            "data": {
                "user_id": str(current_user.id),
                "read": body.read,
                "items": [{"key": r.key, "read_at": r.read_at.isoformat()} for r in rows] if body.read
                else [{"key": k} for k in keys],
            },
        }
    )
    return rows

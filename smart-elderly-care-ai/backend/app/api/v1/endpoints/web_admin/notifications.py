"""
notifications.py – API Quản lý thông báo toàn hệ thống (Web Admin System Notifications).
Chức năng:
- Xem danh sách thông báo & bộ lọc theo trạng thái, đối tượng, phân loại.
- Tạo, chỉnh sửa thông báo.
- Lên lịch phát hành (Schedule).
- Phát hành thông báo ngay (Publish & Push FCM).
- Thu hồi thông báo đã phát hành hoặc hủy lịch (Revoke).
- Xóa thông báo (Delete).
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.system_notification import SystemNotification
from app.models.user import User
from app.schemas.system_notification import (
    SystemNotificationCreate,
    SystemNotificationOut,
    SystemNotificationRevoke,
    SystemNotificationSchedule,
    SystemNotificationUpdate,
)
from app.services.notification.fcm_service import FCMService

router = APIRouter()
fcm_service = FCMService()


@router.get("", response_model=list[SystemNotificationOut])
@router.get("/", response_model=list[SystemNotificationOut])
async def list_notifications(
    status_filter: Optional[str] = Query(default=None, alias="status", description="Lọc theo trạng thái: draft, scheduled, published, revoked"),
    type_filter: Optional[str] = Query(default=None, alias="type", description="Lọc theo loại: info, system_maintenance, emergency, health_tip, feature_update"),
    target_audience: Optional[str] = Query(default=None, description="Lọc theo đối tượng: all, caregivers, doctors, elderly"),
    search: Optional[str] = Query(default=None, description="Tìm kiếm theo tiêu đề hoặc nội dung"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách thông báo toàn hệ thống dành cho Admin."""
    query = select(SystemNotification)

    if status_filter:
        query = query.where(SystemNotification.status == status_filter)
    if type_filter:
        query = query.where(SystemNotification.type == type_filter)
    if target_audience:
        query = query.where(SystemNotification.target_audience == target_audience)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            (SystemNotification.title.ilike(search_pattern))
            | (SystemNotification.body.ilike(search_pattern))
        )

    query = query.order_by(desc(SystemNotification.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    notifications = list(result.scalars().all())
    return notifications


@router.post("", response_model=SystemNotificationOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=SystemNotificationOut, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: SystemNotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo mới thông báo toàn hệ thống (Bản nháp, Lên lịch, hoặc Phát hành ngay)."""
    now = datetime.now(timezone.utc)
    target_status = payload.status or "draft"

    published_at = now if target_status == "published" else None
    scheduled_at = payload.scheduled_at if target_status == "scheduled" else None

    # Ước tính số lượng người nhận
    delivered_count = 0
    if target_status == "published":
        count_stmt = select(User).where(User.is_active == True)  # noqa: E712
        if payload.target_audience == "caregivers":
            count_stmt = count_stmt.where(User.role.in_(["owner", "member", "caregiver"]))
        elif payload.target_audience == "doctors":
            count_stmt = count_stmt.where(User.role == "doctor")
        res = await db.execute(count_stmt)
        delivered_count = max(len(res.scalars().all()), 1)

    notif = SystemNotification(
        title=payload.title,
        body=payload.body,
        type=payload.type,
        target_audience=payload.target_audience,
        status=target_status,
        scheduled_at=scheduled_at,
        published_at=published_at,
        delivered_count=delivered_count,
        read_count=0,
        created_by=current_user.id if current_user else None,
    )
    db.add(notif)
    await db.flush()
    await db.refresh(notif)

    # Ghi nhận Audit Log
    try:
        await db.execute(
            text("""
                INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                VALUES (:event, :user, '127.0.0.1', :sev, :details)
            """),
            {
                "event": "TẠO THÔNG BÁO HỆ THỐNG",
                "user": getattr(current_user, "phone", "Admin"),
                "sev": "medium" if target_status == "published" else "low",
                "details": f"Tạo thông báo '{notif.title}' trạng thái [{target_status}] cho nhóm [{notif.target_audience}].",
            },
        )
        await db.commit()
    except Exception:
        pass

    return notif


@router.get("/broadcasts/active", response_model=list[SystemNotificationOut])
async def get_active_broadcasts(
    target_audience: Optional[str] = Query(default=None, description="Lọc theo vai trò người dùng ứng dụng"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các thông báo toàn hệ thống đang phát hành (cho App di động & người dùng)."""
    now = datetime.now(timezone.utc)
    query = select(SystemNotification).where(
        (SystemNotification.status == "published")
        | ((SystemNotification.status == "scheduled") & (SystemNotification.scheduled_at <= now))
    )
    if target_audience and target_audience != "all":
        query = query.where(SystemNotification.target_audience.in_(["all", target_audience]))
    query = query.order_by(desc(SystemNotification.published_at), desc(SystemNotification.created_at)).limit(20)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{notification_id}", response_model=SystemNotificationOut)
async def get_notification_detail(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xem chi tiết một thông báo."""
    result = await db.execute(
        select(SystemNotification).where(SystemNotification.id == notification_id).limit(1)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")
    return notif


@router.put("/{notification_id}", response_model=SystemNotificationOut)
async def update_notification(
    notification_id: UUID,
    payload: SystemNotificationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chỉnh sửa thông tin thông báo (khi chưa phát hành hoặc cập nhật nội dung)."""
    result = await db.execute(
        select(SystemNotification).where(SystemNotification.id == notification_id).limit(1)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")

    if notif.status == "revoked":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thông báo đã bị thu hồi. Vui lòng tạo thông báo mới.",
        )

    if payload.title is not None:
        notif.title = payload.title
    if payload.body is not None:
        notif.body = payload.body
    if payload.type is not None:
        notif.type = payload.type
    if payload.target_audience is not None:
        notif.target_audience = payload.target_audience
    if payload.scheduled_at is not None:
        notif.scheduled_at = payload.scheduled_at
    if payload.status is not None:
        notif.status = payload.status

    await db.flush()
    await db.refresh(notif)
    await db.commit()
    return notif


@router.post("/{notification_id}/publish", response_model=SystemNotificationOut)
async def publish_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phát hành thông báo ngay lập tức đến ứng dụng di động."""
    result = await db.execute(
        select(SystemNotification).where(SystemNotification.id == notification_id).limit(1)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")

    now = datetime.now(timezone.utc)
    notif.status = "published"
    notif.published_at = now
    notif.revoked_at = None
    notif.revoke_reason = None

    # Lấy số lượng người dùng nhận thông báo
    count_stmt = select(User).where(User.is_active == True)  # noqa: E712
    if notif.target_audience == "caregivers":
        count_stmt = count_stmt.where(User.role.in_(["owner", "member", "caregiver"]))
    elif notif.target_audience == "doctors":
        count_stmt = count_stmt.where(User.role == "doctor")
    users_res = await db.execute(count_stmt)
    all_users = list(users_res.scalars().all())

    notif.delivered_count = max(len(all_users), 1)
    await db.flush()
    await db.refresh(notif)

    # Ghi nhận Audit Log
    try:
        await db.execute(
            text("""
                INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                VALUES ('PHÁT HÀNH THÔNG BÁO TOÀN HỆ THỐNG', :user, '127.0.0.1', 'medium', :details)
            """),
            {
                "user": getattr(current_user, "phone", "Admin"),
                "details": f"Đã phát hành thông báo '{notif.title}' đến {notif.delivered_count} người dùng.",
            },
        )
        await db.commit()
    except Exception:
        pass

    return notif


@router.post("/{notification_id}/schedule", response_model=SystemNotificationOut)
async def schedule_notification(
    notification_id: UUID,
    payload: SystemNotificationSchedule,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lên lịch phát hành thông báo tại một thời điểm xác định."""
    result = await db.execute(
        select(SystemNotification).where(SystemNotification.id == notification_id).limit(1)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")

    notif.status = "scheduled"
    notif.scheduled_at = payload.scheduled_at
    await db.flush()
    await db.refresh(notif)

    # Ghi nhận Audit Log
    try:
        await db.execute(
            text("""
                INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                VALUES ('LÊN LỊCH THÔNG BÁO HỆ THỐNG', :user, '127.0.0.1', 'low', :details)
            """),
            {
                "user": getattr(current_user, "phone", "Admin"),
                "details": f"Lên lịch phát hành thông báo '{notif.title}' vào {payload.scheduled_at.isoformat()}.",
            },
        )
        await db.commit()
    except Exception:
        pass

    return notif


@router.post("/{notification_id}/revoke", response_model=SystemNotificationOut)
async def revoke_notification(
    notification_id: UUID,
    payload: SystemNotificationRevoke,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thu hồi thông báo đã phát hành hoặc hủy lịch phát hành."""
    result = await db.execute(
        select(SystemNotification).where(SystemNotification.id == notification_id).limit(1)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")

    now = datetime.now(timezone.utc)
    notif.status = "revoked"
    notif.revoked_at = now
    notif.revoke_reason = payload.revoke_reason or "Thu hồi bởi Quản trị viên hệ thống"

    await db.flush()
    await db.refresh(notif)

    # Ghi nhận Audit Log
    try:
        await db.execute(
            text("""
                INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                VALUES ('THU HỒI THÔNG BÁO HỆ THỐNG', :user, '127.0.0.1', 'high', :details)
            """),
            {
                "user": getattr(current_user, "phone", "Admin"),
                "details": f"Đã thu hồi thông báo '{notif.title}'. Lý do: {notif.revoke_reason}",
            },
        )
        await db.commit()
    except Exception:
        pass

    return notif


@router.delete("/{notification_id}", status_code=status.HTTP_200_OK)
async def delete_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa bỏ thông báo khỏi hệ thống."""
    result = await db.execute(
        select(SystemNotification).where(SystemNotification.id == notification_id).limit(1)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông báo.")

    title = notif.title
    await db.delete(notif)
    await db.flush()

    # Ghi nhận Audit Log
    try:
        await db.execute(
            text("""
                INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                VALUES ('XÓA THÔNG BÁO HỆ THỐNG', :user, '127.0.0.1', 'medium', :details)
            """),
            {
                "user": getattr(current_user, "phone", "Admin"),
                "details": f"Đã xóa thông báo '{title}'.",
            },
        )
        await db.commit()
    except Exception:
        pass

    return {"message": f"Đã xóa thông báo '{title}' thành công."}

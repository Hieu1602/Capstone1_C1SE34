"""
emergency.py - API tiếp nhận yêu cầu SOS khẩn cấp.

Luồng xử lý:
1. Tìm các thành viên đang hoạt động cùng hộ với người gửi SOS.
2. Gửi thông báo SOS kèm địa chỉ/tọa độ chỉ khi người gửi chủ động cung cấp.
3. Trả số 115 cho ứng dụng mở trình gọi trên điện thoại.
"""

import asyncio
import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.house import House, HouseMember
from app.models.user import User
from app.schemas.emergency import EmergencySOSRequest, EmergencySOSResponse
from app.services.notification.fcm_service import FCMService

logger = logging.getLogger(__name__)
router = APIRouter()


# ------------------------------------------------------------------------------
# Tìm tài khoản người thân / thành viên cùng hộ để nhận thông báo SOS
# ------------------------------------------------------------------------------
async def _get_household_recipients(
    db: AsyncSession,
    current_user_id: UUID,
) -> list[User]:
    """Find active accounts sharing a household with the user who raised SOS."""
    house_result = await db.execute(
        select(House.id)
        .outerjoin(HouseMember, HouseMember.house_id == House.id)
        .where(
            or_(
                House.owner_id == current_user_id,
                HouseMember.user_id == current_user_id,
            )
        )
        .distinct()
    )
    house_ids = list(house_result.scalars().all())
    if not house_ids:
        return []

    owner_ids = select(House.owner_id).where(House.id.in_(house_ids))
    member_ids = select(HouseMember.user_id).where(
        HouseMember.house_id.in_(house_ids)
    )
    recipient_result = await db.execute(
        select(User)
        .where(
            User.is_active.is_(True),
            User.id != current_user_id,
            User.id.in_(owner_ids.union(member_ids)),
        )
        .distinct()
    )
    return list(recipient_result.scalars().all())


# ------------------------------------------------------------------------------
# Gửi thông báo SOS qua Firebase mà không chặn vòng lặp xử lý API
# ------------------------------------------------------------------------------
def _send_sos_notifications(
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, str],
) -> dict[str, int]:
    """Send FCM notifications in a worker thread so the API event loop stays responsive."""
    service = FCMService()
    credentials_path = Path(settings.FCM_SERVICE_ACCOUNT_PATH)
    if not credentials_path.is_absolute() and not credentials_path.is_file():
        credentials_path = Path(__file__).resolve().parents[4] / credentials_path
    if credentials_path.is_file():
        service.initialize(str(credentials_path))
    else:
        logger.warning(
            "FCM credentials file is unavailable at %s; SOS push notifications cannot be sent.",
            credentials_path,
        )
    return service.send_alert(tokens, title, body, data, priority="high")


# ------------------------------------------------------------------------------
# Endpoint SOS: báo người thân và trả số điện thoại cấp cứu cho mobile
# ------------------------------------------------------------------------------
@router.post("/sos", response_model=EmergencySOSResponse)
async def trigger_emergency_sos(
    payload: EmergencySOSRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmergencySOSResponse:
    """Notify household accounts and return 115 for the mobile app's phone dialer."""
    recipients = await _get_household_recipients(db, current_user.id)
    # Bỏ token trống và token trùng để chỉ gửi một thông báo đến mỗi thiết bị.
    tokens = list(
        dict.fromkeys(
            recipient.fcm_token
            for recipient in recipients
            if recipient.fcm_token
        )
    )

    if tokens:
        message = payload.message or "Cần hỗ trợ khẩn cấp"
        place = payload.address
        body = f"{current_user.full_name}: {message}"
        if place:
            body = f"{body}. Vị trí: {place}"
        notification_data = {
            "type": "EMERGENCY_SOS",
            "user_id": str(current_user.id),
        }
        if place:
            notification_data["address"] = place
        if payload.latitude is not None:
            notification_data["latitude"] = str(payload.latitude)
        if payload.longitude is not None:
            notification_data["longitude"] = str(payload.longitude)
        notification_result = await asyncio.to_thread(
            _send_sos_notifications,
            tokens,
            "Cảnh báo SOS khẩn cấp",
            body,
            notification_data,
        )
    else:
        # Không có người nhận vẫn phải phản hồi số 115 để app tiếp tục gọi cấp cứu.
        notification_result = {"success_count": 0, "failure_count": 0}
        logger.warning(
            "SOS triggered by user %s, but no household FCM tokens are available.",
            current_user.id,
        )

    # Backend không tự gọi điện; ứng dụng di động dùng dial_uri để mở trình gọi.
    return EmergencySOSResponse(
        status="accepted",
        dial_number="115",
        dial_uri="tel:115",
        notification_sent=notification_result["success_count"],
        notification_failed=notification_result["failure_count"],
    )

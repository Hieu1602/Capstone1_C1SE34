"""
houses.py – Endpoints quản lý Căn nhà, Chế độ an ninh và Phân quyền Thành viên (House Members RBAC).
Vị trí: backend/app/api/v1/endpoints/mobile/houses.py
"""

import json
import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_house import crud_house
from app.models.device import Device
from app.models.house import House, HouseMember
from app.models.incident import Incident
from app.models.user import User

logger = logging.getLogger(__name__)
from app.schemas.house import (
    HouseMemberCreate,
    HouseMemberOut,
    HouseMemberPermissionsUpdate,
    HouseModeUpdate,
    HouseOut,
    HouseUpdate,
    UserHousePermissionsOut,
)

router = APIRouter()


async def _resolve_house(db: AsyncSession, house_id: str, current_user: User) -> House:
    """Xử lý tra cứu căn nhà hỗ trợ cả 'current', ID số hoặc UUID."""
    if house_id in ("current", "1", "default", "me"):
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        if not house:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bạn chưa tham gia căn nhà nào.",
            )
        return house

    try:
        house_uuid = UUID(house_id)
    except ValueError:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        if not house:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bạn chưa tham gia căn nhà nào.",
            )
        return house

    house = await crud_house.get_by_id(db, id=house_uuid)
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Căn nhà không tồn tại.",
        )
    return house


def _format_member_out(m: HouseMember, house: House) -> HouseMemberOut:
    user = m.user
    is_owner = (m.user_id == house.owner_id and m.role_in_house == "OWNER")
    full_name = user.full_name if user else "Thành viên"
    phone_number = user.phone if user else None
    avatar_url = user.avatar_url if user else None
    user_role = user.role if user else "member"

    return HouseMemberOut(
        id=m.id,
        house_id=m.house_id,
        user_id=m.user_id,
        full_name=full_name,
        phone_number=phone_number,
        avatar_url=avatar_url,
        user_role=user_role,
        role=user_role,
        role_in_house="OWNER" if is_owner else ("DOCTOR" if (user_role == "doctor" or m.role_in_house == "DOCTOR") else m.role_in_house),
        permissions="ADMIN" if is_owner else m.permissions,
        can_view_health=True if is_owner else m.can_view_health,
        can_view_camera=True if is_owner else m.can_view_camera,
        can_handle_emergency=True if is_owner else m.can_handle_emergency,
        can_manage_devices=True if is_owner else m.can_manage_devices,
        can_manage_records=True if is_owner else m.can_manage_records,
        is_owner=is_owner,
        joined_at=m.joined_at,
    )


# ==============================================================================
# 1. QUẢN LÝ THÔNG TIN NHÀ & CHẾ ĐỘ AN NINH
# ==============================================================================

@router.get("/current", response_model=HouseOut)
async def get_current_house(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin căn nhà hiện tại của người dùng."""
    house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng chưa tham gia căn nhà nào.",
        )
    return house


@router.patch("/current/mode", response_model=HouseOut)
async def update_current_house_mode(
    mode_in: HouseModeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Chuyển đổi chế độ an ninh: HOME, AWAY, DISARM, ALARM, PRIVACY."""
    valid_modes = {"HOME", "AWAY", "DISARM", "ALARM", "PRIVACY"}
    normalized_mode = mode_in.mode.upper().strip()
    if normalized_mode not in valid_modes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chế độ '{mode_in.mode}' không hợp lệ. Phải là một trong: {', '.join(valid_modes)}.",
        )

    house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
    return await crud_house.update_mode(db, house=house, mode=normalized_mode)


@router.patch("/current", response_model=HouseOut)
async def update_current_house(
    obj_in: HouseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật tên căn nhà hoặc địa chỉ."""
    house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
    return await crud_house.update(db, house=house, obj_in=obj_in)


# ==============================================================================
# 2. PHÂN QUYỀN THÀNH VIÊN (HOUSE MEMBERS RBAC)
# ==============================================================================

@router.get("/current/my-permissions", response_model=UserHousePermissionsOut)
@router.get("/{house_id}/my-permissions", response_model=UserHousePermissionsOut)
async def get_my_house_permissions(
    house_id: str = "current",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kiểm tra danh sách quyền thực tế của người dùng đối với căn nhà này."""
    try:
        house = await _resolve_house(db, house_id, current_user)
    except HTTPException as e:
        if e.status_code == status.HTTP_404_NOT_FOUND:
            return UserHousePermissionsOut(
                can_view_health=False,
                can_view_camera=False,
                can_handle_emergency=False,
                can_manage_devices=False,
                can_manage_records=False,
                role_in_house="MEMBER",
                permissions="NONE",
            )
        raise e
    perms = await crud_house.get_user_permissions(db, house=house, user=current_user)
    return UserHousePermissionsOut(**perms)


@router.get("/current/members", response_model=List[HouseMemberOut])
@router.get("/{house_id}/members", response_model=List[HouseMemberOut])
async def list_house_members(
    house_id: str = "current",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách tất cả thành viên trong gia đình kèm theo quyền hạn chi tiết.
    """
    try:
        house = await _resolve_house(db, house_id, current_user)
    except HTTPException as e:
        if e.status_code == status.HTTP_404_NOT_FOUND:
            return []
        raise e
    members = await crud_house.get_members(db, house_id=house.id)
    return [_format_member_out(m, house) for m in members]


@router.post("/current/members", response_model=HouseMemberOut, status_code=status.HTTP_201_CREATED)
@router.post("/{house_id}/members", response_model=HouseMemberOut, status_code=status.HTTP_201_CREATED)
async def add_house_member(
    member_in: HouseMemberCreate,
    house_id: str = "current",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chủ sở hữu (Owner) mời thêm người thân hoặc Bác sĩ gia đình và cấp quyền ban đầu.
    """
    house = await _resolve_house(db, house_id, current_user)

    # Chỉ Chủ nhà hoặc Quản trị viên mới được phân quyền thêm người
    if current_user.role != "admin" and house.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Chủ sở hữu căn nhà mới có quyền mời và phân quyền thành viên.",
        )

    new_member = await crud_house.add_member(db, house=house, obj_in=member_in)

    # Tự động tạo thông báo gửi đến mục Thông báo của tài khoản thành viên mới
    try:
        dev_res = await db.execute(
            select(Device.id).where(Device.house_id == house.id).limit(1)
        )
        device_id = dev_res.scalar_one_or_none()
        if not device_id:
            any_dev = await db.execute(select(Device.id).limit(1))
            device_id = any_dev.scalar_one_or_none()

        target_user = getattr(new_member, "user", None)
        target_user_id = new_member.user_id
        owner_name = current_user.full_name or "Chủ hộ"
        role_desc = "Bác sĩ gia đình" if new_member.role_in_house == "DOCTOR" else "Thành viên gia đình"
        house_display = house.name or "Nhà của tôi"
        notif_msg = f"Bạn đã được Chủ hộ {owner_name} thêm vào căn nhà \"{house_display}\" với vai trò {role_desc}. Hãy vào mục Nhà của tôi để kiểm tra quyền hạn."

        if device_id:
            member_incident = Incident(
                device_id=device_id,
                alert_type="HOUSE_MEMBER_ADDED",
                alert_level="LOW",
                message=notif_msg,
                is_acknowledged=False,
                notes=f"USER:{target_user_id}",
            )
            db.add(member_incident)
            await db.commit()
            await db.refresh(member_incident)

            # Phát thời gian thực qua WebSocket cho mobile client đang online
            try:
                from app.api.websockets.vitals_ws import alert_clients
                ws_payload = json.dumps({
                    "type": "ALERT_NEW",
                    "alert_type": "HOUSE_MEMBER_ADDED",
                    "data": {
                        "id": str(member_incident.id),
                        "alert_type": "HOUSE_MEMBER_ADDED",
                        "alert_level": "LOW",
                        "message": member_incident.message,
                        "target_user_id": str(target_user_id),
                        "house_id": str(house.id),
                        "created_at": member_incident.created_at.isoformat() if member_incident.created_at else None,
                    }
                }, ensure_ascii=False)
                for client_ws in list(alert_clients):
                    try:
                        await client_ws.send_text(ws_payload)
                    except Exception:
                        if client_ws in alert_clients:
                            alert_clients.remove(client_ws)
            except Exception as ws_err:
                logger.warning("[add_house_member] WS broadcast error: %s", ws_err)

            # Gửi Push Notification qua FCM nếu thành viên đã có FCM Token
            if target_user and getattr(target_user, "fcm_token", None):
                try:
                    from app.services.notification.fcm_service import FCMService
                    from app.core.config import settings
                    from pathlib import Path
                    fcm = FCMService()
                    cred_path = Path(settings.FCM_SERVICE_ACCOUNT_PATH)
                    if cred_path.exists():
                        fcm.initialize(str(cred_path))
                        await fcm.send_alert(
                            fcm_tokens=[target_user.fcm_token],
                            title="Thành viên mới trong gia đình",
                            body=notif_msg,
                            data={"type": "HOUSE_MEMBER_ADDED", "house_id": str(house.id)},
                        )
                except Exception as fcm_err:
                    logger.warning("[add_house_member] FCM error: %s", fcm_err)
    except Exception as notif_err:
        logger.warning("[add_house_member] Failed to create member notification: %s", notif_err)

    return _format_member_out(new_member, house)


@router.patch("/current/members/{member_id}/permissions", response_model=HouseMemberOut)
@router.patch("/{house_id}/members/{member_id}/permissions", response_model=HouseMemberOut)
@router.put("/current/members/{member_id}", response_model=HouseMemberOut)
@router.put("/{house_id}/members/{member_id}", response_model=HouseMemberOut)
async def update_member_permissions(
    member_id: UUID,
    permissions_in: HouseMemberPermissionsUpdate,
    house_id: str = "current",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    [Cấp quyền cho thành viên]
    Chủ sở hữu (Owner) chỉnh sửa quyền hạn:
    - Theo dõi sức khỏe (Ủy quyền)
    - Giám sát camera (Được cấp quyền)
    - Xử lý khẩn cấp (Cảnh báo SOS)
    - Cấu hình thiết bị & Ngưỡng
    - Quản lý hồ sơ bệnh án
    """
    house = await _resolve_house(db, house_id, current_user)

    if current_user.role != "admin" and house.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Chủ sở hữu căn nhà mới có quyền thay đổi phân quyền cho thành viên.",
        )

    updated_member = await crud_house.update_member_permissions(
        db, house=house, member_id=member_id, obj_in=permissions_in
    )
    return _format_member_out(updated_member, house)


@router.delete("/current/members/{member_id}", status_code=status.HTTP_200_OK)
@router.delete("/{house_id}/members/{member_id}", status_code=status.HTTP_200_OK)
async def remove_house_member(
    member_id: UUID,
    house_id: str = "current",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Xóa thành viên khỏi căn nhà (hoặc thành viên tự rời nhà).
    Không cho phép xóa Chủ sở hữu.
    """
    house = await _resolve_house(db, house_id, current_user)

    # Tra cứu member
    member = await crud_house.get_member_by_id(db, house_id=house.id, member_id=member_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thành viên trong nhà.",
        )

    # Kiểm tra quyền: Owner, Admin hoặc chính thành viên đó tự rời khỏi
    is_owner = (house.owner_id == current_user.id)
    is_self = (member.user_id == current_user.id)
    is_admin = (current_user.role == "admin")

    if not (is_owner or is_self or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa thành viên này khỏi căn nhà.",
        )

    await crud_house.remove_member(db, house=house, member_id=member.id)
    return {"status": "success", "message": "Đã xóa thành viên khỏi căn nhà thành công."}


@router.post("/join", response_model=HouseOut)
async def join_house_by_code(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Tham gia căn nhà bằng mã mời hoặc liên kết (invite code / URL).
    Hỗ trợ mã dạng 'CARE-XXXX', UUID, hoặc URL chứa houseId.
    """
    import re
    raw_code = str(payload.get("code") or payload.get("invite_code") or "").strip()
    if not raw_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp mã mời hoặc liên kết tham gia nhà.",
        )

    target_house: Optional[House] = None
    uuid_match = re.search(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", raw_code)
    if uuid_match:
        try:
            target_house = await crud_house.get_by_id(db, id=UUID(uuid_match.group(0)))
        except Exception:
            target_house = None

    if not target_house:
        code_match = re.search(r"(?:CARE-)?([0-9a-zA-Z]{4})", raw_code, re.IGNORECASE)
        suffix = code_match.group(1).lower() if code_match else raw_code.lower()
        stmt = select(House)
        res = await db.execute(stmt)
        all_houses = res.scalars().all()
        for h in all_houses:
            if str(h.id).lower().replace("-", "").endswith(suffix) or str(h.id).lower().endswith(suffix):
                target_house = h
                break
        if not target_house and all_houses:
            target_house = all_houses[0]

    if not target_house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy căn nhà phù hợp với mã mời này hoặc mã đã hết hạn.",
        )

    is_owner = (target_house.owner_id == current_user.id)
    is_doctor = (current_user.role == "doctor")
    existing_member = await crud_house.get_member_by_user(db, house_id=target_house.id, user_id=current_user.id)
    if not existing_member and not is_owner:
        new_membership = HouseMember(
            house_id=target_house.id,
            user_id=current_user.id,
            role_in_house="DOCTOR" if is_doctor else "MEMBER",
            can_view_health=True,
            can_view_camera=True,
            can_handle_emergency=True,
            can_manage_devices=False,
            can_manage_records=True if is_doctor else False,
        )
        db.add(new_membership)
        await db.commit()


    return target_house


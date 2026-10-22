"""
houses.py – Endpoints quản lý Căn nhà, Chế độ an ninh (House Mode) và Thành viên (Members).
Vị trí: backend/app/api/v1/endpoints/mobile/houses.py
"""

from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_house import crud_house
from app.models.house import House, HouseMember
from app.models.user import User
from app.schemas.house import (
    HouseMemberCreate,
    HouseMemberOut,
    HouseModeUpdate,
    HouseOut,
    HouseUpdate,
)

router = APIRouter()


async def _resolve_house(db: AsyncSession, house_id: str, current_user: User) -> House:
    """Hỗ trợ giải quyết căn nhà linh hoạt qua UUID hoặc ID số / 'current'"""
    if str(house_id) in ("current", "1", "default") or not house_id:
        return await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
    try:
        house_uuid = uuid.UUID(str(house_id))
        house = await crud_house.get_by_id(db, house_uuid)
        if house:
            return house
    except (ValueError, AttributeError):
        pass
    # Fallback đến căn nhà mặc định của người dùng
    return await crud_house.get_or_create_default_house(db, owner_id=current_user.id)


@router.get("/current", response_model=HouseOut)
async def get_current_house(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy thông tin căn nhà hiện tại của người dùng.
    Nếu người dùng chưa có nhà, tự động khởi tạo căn nhà mặc định ('Nhà của tôi').
    """
    return await crud_house.get_or_create_default_house(db, owner_id=current_user.id)


@router.patch("/current/mode", response_model=HouseOut)
async def update_current_house_mode(
    mode_in: HouseModeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chuyển đổi chế độ an ninh của ngôi nhà:
    - HOME: Ở nhà (giám sát bình thường, không chuông báo động)
    - AWAY: Vắng nhà (tăng cường phát hiện bất thường)
    - DISARM: Tắt hệ thống cảnh báo
    - ALARM: Bật báo động khẩn cấp
    - PRIVACY: Chế độ riêng tư (tắt tạm thời stream camera)
    """
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
# QUẢN LÝ THÀNH VIÊN GIA ĐÌNH & BÁC SĨ (MEMBERS)
# ==============================================================================

@router.get("/{house_id}/members", response_model=List[HouseMemberOut])
@router.get("/current/members", response_model=List[HouseMemberOut])
async def get_house_members(
    house_id: str = "current",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách thành viên gia đình và bác sĩ trong căn nhà."""
    house = await _resolve_house(db, house_id, current_user)

    stmt = (
        select(HouseMember)
        .options(selectinload(HouseMember.user))
        .where(HouseMember.house_id == house.id)
        .order_by(HouseMember.joined_at.asc())
    )
    result = await db.execute(stmt)
    members = list(result.scalars().all())

    response_list: List[HouseMemberOut] = []
    owner_in_list = any(m.user_id == house.owner_id for m in members)

    if not owner_in_list:
        owner_user = await db.get(User, house.owner_id)
        if owner_user:
            response_list.append(
                HouseMemberOut(
                    id=str(house.id),
                    user_id=str(owner_user.id),
                    full_name=owner_user.full_name or "Chủ hộ",
                    phone_number=owner_user.phone,
                    role=owner_user.role or "user",
                    role_in_house="Chủ nhà / Người sở hữu",
                    permissions="Toàn quyền cấu hình AI và còi báo động",
                    is_owner=True,
                    avatar_url=owner_user.avatar_url,
                    joined_at=house.created_at,
                )
            )

    for m in members:
        is_owner = (m.user_id == house.owner_id) or (m.role_in_house.upper() == "OWNER")
        u = m.user
        response_list.append(
            HouseMemberOut(
                id=str(m.id),
                user_id=str(m.user_id) if m.user_id else None,
                full_name=(u.full_name if u and u.full_name else ("Chủ hộ" if is_owner else "Thành viên")),
                phone_number=(u.phone if u else None),
                role=(u.role if u and u.role else ("admin" if is_owner else "user")),
                role_in_house=m.role_in_house or ("Chủ nhà / Người sở hữu" if is_owner else "Người chăm sóc"),
                permissions=m.permissions or ("Toàn quyền cấu hình AI và còi báo động" if is_owner else "Theo dõi & Nhận cảnh báo"),
                is_owner=is_owner,
                avatar_url=(u.avatar_url if u else None),
                joined_at=m.joined_at,
            )
        )

    # Đưa chủ nhà lên đầu danh sách
    response_list.sort(key=lambda x: not x.is_owner)
    return response_list


@router.post("/{house_id}/members", response_model=HouseMemberOut)
@router.post("/current/members", response_model=HouseMemberOut)
async def add_house_member(
    member_in: HouseMemberCreate,
    house_id: str = "current",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Thêm người thân hoặc bác sĩ gia đình vào căn nhà."""
    house = await _resolve_house(db, house_id, current_user)
    phone_clean = member_in.phone_number.strip()
    if not phone_clean:
        raise HTTPException(status_code=400, detail="Số điện thoại không được để trống")

    # Tìm hoặc tạo tài khoản tương ứng với số điện thoại
    user_stmt = select(User).where(User.phone == phone_clean)
    user_res = await db.execute(user_stmt)
    target_user = user_res.scalar_one_or_none()

    if not target_user:
        new_role = "doctor" if (member_in.role and member_in.role.upper() == "DOCTOR") else "user"
        target_user = User(
            phone=phone_clean,
            full_name=member_in.full_name or f"Thành viên {phone_clean[-4:] if len(phone_clean)>=4 else phone_clean}",
            role=new_role,
            is_active=True,
        )
        db.add(target_user)
        await db.flush()
        await db.refresh(target_user)

    # Kiểm tra xem thành viên đã thuộc căn nhà chưa
    member_stmt = select(HouseMember).where(
        HouseMember.house_id == house.id,
        HouseMember.user_id == target_user.id,
    )
    existing_res = await db.execute(member_stmt)
    existing_member = existing_res.scalar_one_or_none()

    if existing_member:
        existing_member.role_in_house = member_in.role_in_house or existing_member.role_in_house
        existing_member.permissions = member_in.permissions or existing_member.permissions
        await db.commit()
        await db.refresh(existing_member)
        return HouseMemberOut(
            id=str(existing_member.id),
            user_id=str(target_user.id),
            full_name=target_user.full_name or "Thành viên",
            phone_number=target_user.phone,
            role=target_user.role or "user",
            role_in_house=existing_member.role_in_house,
            permissions=existing_member.permissions,
            is_owner=(target_user.id == house.owner_id),
            avatar_url=target_user.avatar_url,
            joined_at=existing_member.joined_at,
        )

    new_member = HouseMember(
        house_id=house.id,
        user_id=target_user.id,
        role_in_house=member_in.role_in_house or "Người chăm sóc",
        permissions=member_in.permissions or "Theo dõi & Nhận cảnh báo",
    )
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)

    return HouseMemberOut(
        id=str(new_member.id),
        user_id=str(target_user.id),
        full_name=target_user.full_name or "Thành viên",
        phone_number=target_user.phone,
        role=target_user.role or "user",
        role_in_house=new_member.role_in_house,
        permissions=new_member.permissions,
        is_owner=(target_user.id == house.owner_id),
        avatar_url=target_user.avatar_url,
        joined_at=new_member.joined_at,
    )


@router.delete("/{house_id}/members/{member_id}")
@router.delete("/current/members/{member_id}")
async def delete_house_member(
    house_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa thành viên khỏi căn nhà."""
    house = await _resolve_house(db, house_id, current_user)

    member = None
    try:
        mem_uuid = uuid.UUID(str(member_id))
        stmt = select(HouseMember).where(
            HouseMember.house_id == house.id,
            (HouseMember.id == mem_uuid) | (HouseMember.user_id == mem_uuid)
        )
        res = await db.execute(stmt)
        member = res.scalar_one_or_none()
    except (ValueError, AttributeError):
        pass

    if not member:
        user_stmt = select(User).where(User.phone == str(member_id))
        user_res = await db.execute(user_stmt)
        u = user_res.scalar_one_or_none()
        if u:
            stmt = select(HouseMember).where(
                HouseMember.house_id == house.id,
                HouseMember.user_id == u.id
            )
            res = await db.execute(stmt)
            member = res.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=404, detail="Không tìm thấy thành viên cần xóa")

    if member.user_id == house.owner_id or member.role_in_house.upper() == "OWNER":
        raise HTTPException(status_code=400, detail="Không thể xóa chủ nhà khỏi danh sách")

    await db.delete(member)
    await db.commit()
    return {"status": "success", "message": "Đã xóa thành viên khỏi ngôi nhà"}

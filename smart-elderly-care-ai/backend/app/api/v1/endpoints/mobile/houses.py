"""
houses.py – Endpoints quản lý Căn nhà, Chế độ an ninh và Phân quyền Thành viên (House Members RBAC).
Vị trí: backend/app/api/v1/endpoints/mobile/houses.py
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_house import crud_house
from app.models.house import House, HouseMember
from app.models.user import User
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
        return await crud_house.get_or_create_default_house(db, owner_id=current_user.id)

    try:
        house_uuid = UUID(house_id)
    except ValueError:
        return await crud_house.get_or_create_default_house(db, owner_id=current_user.id)

    house = await crud_house.get_by_id(db, id=house_uuid)
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Căn nhà không tồn tại.",
        )
    return house


def _format_member_out(m: HouseMember, house: House) -> HouseMemberOut:
    user = m.user
    is_owner = (m.user_id == house.owner_id)
    full_name = user.full_name if user else "Thành viên"
    phone_number = user.phone if user else None
    avatar_url = user.avatar_url if user else None
    user_role = user.role if user else "user"

    return HouseMemberOut(
        id=m.id,
        house_id=m.house_id,
        user_id=m.user_id,
        full_name=full_name,
        phone_number=phone_number,
        avatar_url=avatar_url,
        user_role=user_role,
        role=user_role,
        role_in_house="OWNER" if is_owner else m.role_in_house,
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
    return await crud_house.get_or_create_default_house(db, owner_id=current_user.id)


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
    house = await _resolve_house(db, house_id, current_user)
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
    Lấy danh sách tất cả thành viên trong gia đình kèm theo quyền hạn chi tiết:
    - Quyền xem camera
    - Quyền theo dõi sức khỏe
    - Quyền xử lý khẩn cấp SOS
    - Quyền cấu hình thiết bị
    - Quyền xem/quản lý hồ sơ bệnh án
    """
    house = await _resolve_house(db, house_id, current_user)
    members = await crud_house.get_members(db, house_id=house.id)
    
    # Nếu danh sách rỗng (dữ liệu cũ), tự bổ sung chủ sở hữu
    if not members:
        house = await crud_house.get_or_create_default_house(db, owner_id=house.owner_id)
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

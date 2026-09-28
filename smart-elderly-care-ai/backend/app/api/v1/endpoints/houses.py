"""
houses.py – Endpoints quản lý Căn nhà và Chế độ an ninh (House Mode).
Vị trí: backend/app/api/v1/endpoints/houses.py
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_house import crud_house
from app.models.user import User
from app.schemas.house import HouseModeUpdate, HouseOut, HouseUpdate

router = APIRouter()


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


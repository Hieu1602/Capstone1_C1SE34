"""
users.py – Quản lý tài khoản Caregiver / Bác sĩ.
"""

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud.crud_user import crud_user
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Lấy thông tin profile của người dùng hiện tại."""
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_profile(
    update_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin profile (tên, số điện thoại, FCM token)."""
    update_data = update_in.model_dump(exclude_unset=True)
    return await crud_user.update(db, db_obj=current_user, obj_in=update_data)


@router.patch("/me/fcm-token", response_model=UserOut)
async def update_fcm_token(
    fcm_token: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật FCM Push token khi app mobile khởi động."""
    return await crud_user.update(db, db_obj=current_user, obj_in={"fcm_token": fcm_token})

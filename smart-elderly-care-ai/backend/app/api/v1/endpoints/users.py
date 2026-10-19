"""
users.py – Quản lý tài khoản Caregiver / Bác sĩ.
"""

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.crud.crud_user import crud_user
from app.models.user import User
from app.schemas.user import PasswordChange, UserOut, UserUpdate

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
    """Cập nhật thông tin profile (tên, số điện thoại, FCM token, ngôn ngữ)."""
    update_data = update_in.model_dump(exclude_unset=True)
    return await crud_user.update(db, db_obj=current_user, obj_in=update_data)


@router.patch("/me/language", response_model=UserOut)
@router.put("/me/language", response_model=UserOut)
async def update_language(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật ngôn ngữ giao diện của người dùng (vi hoặc en)."""
    lang = (payload.get("preferred_language") or payload.get("language") or "").strip().lower()
    if lang not in ["vi", "en"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ngôn ngữ không hợp lệ. Chỉ chấp nhận 'vi' hoặc 'en'.",
        )
    return await crud_user.update(db, db_obj=current_user, obj_in={"preferred_language": lang})


@router.patch("/me/font-size", response_model=UserOut)
@router.put("/me/font-size", response_model=UserOut)
async def update_font_size(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật cấu hình cỡ chữ người dùng (font_size_mode: system/custom, custom_font_scale: 0-4)."""
    mode = payload.get("font_size_mode")
    scale = payload.get("custom_font_scale")
    update_data = {}
    if mode is not None:
        if mode not in ["system", "custom"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="font_size_mode không hợp lệ. Chỉ chấp nhận 'system' hoặc 'custom'.",
            )
        update_data["font_size_mode"] = mode
    if scale is not None:
        try:
            scale_int = int(scale)
            if not (0 <= scale_int <= 4):
                raise ValueError()
            update_data["custom_font_scale"] = scale_int
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="custom_font_scale phải là số nguyên từ 0 đến 4.",
            )
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần cung cấp ít nhất một trường: font_size_mode hoặc custom_font_scale.",
        )
    return await crud_user.update(db, db_obj=current_user, obj_in=update_data)


@router.patch("/me/password")
async def change_current_user_password(
    update_in: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(update_in.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác.",
        )

    if verify_password(update_in.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới phải khác mật khẩu hiện tại.",
        )

    hashed_password = hash_password(update_in.new_password)
    await crud_user.update(db, db_obj=current_user, obj_in={"hashed_password": hashed_password})
    return {"message": "Mật khẩu đã được cập nhật."}



@router.patch("/me/fcm-token", response_model=UserOut)
async def update_fcm_token(
    fcm_token: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật FCM Push token khi app mobile khởi động."""
    return await crud_user.update(db, db_obj=current_user, obj_in={"fcm_token": fcm_token})

"""
users.py – Quản lý tài khoản Caregiver / Bác sĩ.
"""

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.crud.crud_user import crud_user
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.user import User
from app.schemas.user import (
    FontSizePreferenceUpdate,
    LanguagePreferenceUpdate,
    PasswordChange,
    UserOut,
    UserUpdate,
)

router = APIRouter()


@router.get("", response_model=list[UserOut])
@router.get("/", response_model=list[UserOut])
async def list_users(
    include_elderly: bool = Query(default=True, description="Hiển thị cả người cao tuổi trong danh sách"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lấy danh sách người dùng trong hệ thống (dành cho Admin):
    - Chủ sở hữu (Owner)
    - Thành viên gia đình (Member / Caregiver)
    - Bác sĩ gia đình (Doctor)
    - Người cao tuổi (Elderly Profile)
    - Quản trị viên (Admin)
    """
    stmt = (
        select(User)
        .options(
            selectinload(User.owned_houses),
            selectinload(User.house_memberships).selectinload(HouseMember.house),
        )
        .order_by(User.created_at.desc())
    )
    result = await db.execute(stmt)
    users = list(result.scalars().all())

    user_outs: list[UserOut] = []
    for u in users:
        assigned_house = "Chưa gán nhà"
        role_title = "Thành viên gia đình"
        if u.role == "admin":
            assigned_house = "Toàn hệ thống (Root Admin)"
            role_title = "Quản trị viên"
        elif u.role == "doctor":
            role_title = "Bác sĩ gia đình"
            if u.house_memberships:
                h_name = u.house_memberships[0].house.name if u.house_memberships[0].house else "Nhà người cao tuổi"
                assigned_house = f"Phụ trách y tế ({h_name})"
            elif u.owned_houses:
                assigned_house = f"Phụ trách y tế ({u.owned_houses[0].name})"
            else:
                assigned_house = "Bác sĩ chuyên khoa dự phòng"
        elif u.owned_houses:
            house = u.owned_houses[0]
            assigned_house = f"{house.name} ({house.address or 'Chủ sở hữu'})"
            role_title = "Chủ sở hữu hệ thống"
        elif u.house_memberships:
            m = u.house_memberships[0]
            h_name = m.house.name if m.house else "Nhà của tôi"
            assigned_house = f"{h_name} ({m.role_in_house})"
            role_title = "Thành viên chăm sóc"

        user_out = UserOut.model_validate(u)
        user_out.assigned_house = assigned_house
        user_out.role_title = role_title
        user_outs.append(user_out)

    if include_elderly:
        try:
            eld_stmt = select(ElderlyProfile).options(selectinload(ElderlyProfile.house))
            eld_res = await db.execute(eld_stmt)
            eld_list = eld_res.scalars().all()
            for eld in eld_list:
                house_str = f"{eld.house.name} ({eld.house.address})" if eld.house else "Nhà của tôi (123 Hải Phòng)"
                eld_out = UserOut(
                    id=eld.id,
                    phone=eld.emergency_contact_phone or "+84905123456",
                    full_name=eld.full_name,
                    role="elderly",
                    role_title="Người cao tuổi",
                    is_active=True,
                    avatar_url=eld.avatar_url,
                    preferred_language="vi",
                    language="vi",
                    font_size_mode="system",
                    custom_font_scale=2,
                    vibration_enabled=True,
                    location_enabled=True,
                    created_at=eld.created_at,
                    updated_at=eld.updated_at,
                    last_login_at=eld.updated_at,
                    assigned_house=house_str,
                )
                user_outs.append(eld_out)
        except Exception:
            pass

    return user_outs


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    user_in: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tạo tài khoản người dùng hoặc hồ sơ người cao tuổi mới trực tiếp."""
    from app.schemas.user import UserCreate
    phone = (user_in.get("phone") or "").strip()
    full_name = (user_in.get("full_name") or "").strip()
    role = (user_in.get("role") or "user").strip().lower()

    if not full_name:
        raise HTTPException(status_code=400, detail="Thiếu họ tên người dùng")

    if role == "elderly":
        # Tạo hồ sơ người cao tuổi vào bảng elderly_profiles
        from app.models.house import House
        h_res = await db.execute(select(House).limit(1))
        default_house = h_res.scalar_one_or_none()
        if not default_house:
            raise HTTPException(status_code=400, detail="Chưa có căn nhà nào trong hệ thống để gán người cao tuổi")

        eld = ElderlyProfile(
            house_id=default_house.id,
            full_name=full_name,
            emergency_contact_phone=phone or "+84905123456",
            birth_year=1948,
            gender="MALE",
            medical_history="Theo dõi sức khỏe định kỳ",
        )
        db.add(eld)
        await db.commit()
        await db.refresh(eld)
        return UserOut(
            id=eld.id,
            phone=eld.emergency_contact_phone or phone,
            full_name=eld.full_name,
            role="elderly",
            role_title="Người cao tuổi",
            is_active=True,
            preferred_language="vi",
            language="vi",
            font_size_mode="system",
            custom_font_scale=2,
            vibration_enabled=True,
            location_enabled=True,
            created_at=eld.created_at,
            updated_at=eld.updated_at,
            assigned_house=f"{default_house.name} ({default_house.address})",
        )

    if not phone:
        raise HTTPException(status_code=400, detail="Thiếu số điện thoại đăng nhập")

    existing = await crud_user.get_by_phone(db, phone=phone)
    if existing:
        raise HTTPException(status_code=400, detail="Số điện thoại đã được đăng ký")

    password = user_in.get("password") or "12345678"
    user_create = UserCreate(
        full_name=full_name,
        phone=phone,
        password=password,
        role=role,
    )
    user = await crud_user.create(db, obj_in=user_create)
    await db.commit()
    await db.refresh(user)

    user_out = UserOut.model_validate(user)
    user_out.assigned_house = user_in.get("assigned_house") or "Nhà của tôi (123 Hải Phòng)"
    return user_out


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_by_admin(
    user_id: str,
    update_data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin cập nhật thông tin, vai trò hoặc trạng thái khóa/mở tài khoản."""
    from uuid import UUID
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="User ID không hợp lệ")

    # Kiểm tra trong bảng users
    user = await crud_user.get_by_id(db, uid)
    if user:
        if "password" in update_data and update_data["password"]:
            update_data["hashed_password"] = hash_password(update_data.pop("password"))

        updated_user = await crud_user.update(db, db_obj=user, obj_in=update_data)
        await db.commit()
        await db.refresh(updated_user)
        user_out = UserOut.model_validate(updated_user)
        user_out.assigned_house = update_data.get("assigned_house") or "Nhà của tôi"
        return user_out

    # Kiểm tra trong bảng elderly_profiles
    eld_res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id == uid))
    eld = eld_res.scalar_one_or_none()
    if eld:
        if "full_name" in update_data and update_data["full_name"]:
            eld.full_name = update_data["full_name"]
        if "phone" in update_data and update_data["phone"]:
            eld.emergency_contact_phone = update_data["phone"]
        await db.commit()
        await db.refresh(eld)
        return UserOut(
            id=eld.id,
            phone=eld.emergency_contact_phone or "+84905123456",
            full_name=eld.full_name,
            role="elderly",
            role_title="Người cao tuổi",
            is_active=True,
            preferred_language="vi",
            language="vi",
            font_size_mode="system",
            custom_font_scale=2,
            vibration_enabled=True,
            location_enabled=True,
            created_at=eld.created_at,
            updated_at=eld.updated_at,
            assigned_house=update_data.get("assigned_house") or "Nhà của tôi",
        )

    raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")


@router.delete("/{user_id}")
async def delete_user_by_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin xóa tài khoản người dùng hoặc hồ sơ người cao tuổi khỏi hệ thống."""
    from uuid import UUID
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="User ID không hợp lệ")

    # Kiểm tra người dùng
    user = await crud_user.get_by_id(db, uid)
    if user:
        if user.role == "admin":
            raise HTTPException(status_code=400, detail="Không thể xóa tài khoản Quản trị viên hệ thống!")
        await crud_user.delete(db, uid)
        await db.commit()
        return {"message": "Đã xóa tài khoản thành công", "user_id": user_id}

    # Kiểm tra người cao tuổi
    eld_res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id == uid))
    eld = eld_res.scalar_one_or_none()
    if eld:
        await db.delete(eld)
        await db.commit()
        return {"message": "Đã xóa hồ sơ người cao tuổi thành công", "user_id": user_id}

    raise HTTPException(status_code=404, detail="Không tìm thấy đối tượng để xóa")


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
    payload: LanguagePreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật ngôn ngữ giao diện của người dùng (vi hoặc en)."""
    return await crud_user.update(
        db,
        db_obj=current_user,
        obj_in={"preferred_language": payload.preferred_language},
    )


@router.patch("/me/font-preferences", response_model=UserOut)
@router.put("/me/font-preferences", response_model=UserOut)
async def update_font_preferences(
    payload: FontSizePreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lưu tùy chọn cỡ chữ để app khôi phục sau khi đăng nhập lại.

    FontSizePreferenceUpdate kiểm tra chế độ và mức cỡ chữ trước khi cập nhật
    hồ sơ người dùng; PATCH và PUT cùng được hỗ trợ để tương thích với client.
    """
    return await crud_user.update(
        db,
        db_obj=current_user,
        obj_in=payload.model_dump(),
    )


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

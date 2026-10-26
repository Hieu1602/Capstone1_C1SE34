"""
users.py – Quản lý tài khoản Caregiver / Bác sĩ.
"""

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional
import base64
import io
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)


def get_avatar_dir() -> Path:
    # static directory is mounted at backend/static in main.py
    current_file = Path(__file__).resolve()
    backend_dir = None
    for p in [current_file.parent, *current_file.parents]:
        if (p / "static").exists() and (p / "app").exists():
            backend_dir = p
            break
    if not backend_dir:
        backend_dir = current_file.parents[5] if len(current_file.parents) > 5 else Path(".").resolve()

    avatar_dir = backend_dir / "static" / "avatars"
    try:
        avatar_dir.mkdir(parents=True, exist_ok=True)
        return avatar_dir
    except Exception as e:
        logger.warning("[get_avatar_dir] Error creating %s: %s", avatar_dir, e)
        fallback = Path("static/avatars").resolve()
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.crud.crud_user import crud_user
from app.crud.crud_user_terminal import crud_user_terminal
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.user import User
from app.schemas.user import (
    FontSizePreferenceUpdate,
    LanguagePreferenceUpdate,
    NotificationPreferenceUpdate,
    PasswordChange,
    UserLoginHistoryOut,
    UserOut,
    UserTerminalOut,
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
                house_str = f"{eld.house.name} ({eld.house.address})" if eld.house else ("Chưa có địa chỉ" if not eld.house else eld.house.name)
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
    user_out.assigned_house = user_in.get("assigned_house") or ("Chưa có địa chỉ" if not eld.house else eld.house.name)
    return user_out


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Lấy thông tin profile của người dùng hiện tại."""
    return current_user


@router.patch("/me", response_model=UserOut)
@router.put("/me", response_model=UserOut)
async def update_profile(
    update_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin profile (tên, số điện thoại, FCM token, ngôn ngữ, avatar)."""
    update_data = update_in.model_dump(exclude_unset=True)

    # Nếu avatar_url gửi lên dưới dạng Base64 data URI, tự động lưu thành tệp static
    if update_data.get("avatar_url") and update_data["avatar_url"].startswith("data:image"):
        try:
            raw_val = update_data["avatar_url"]
            _, b64_str = raw_val.split(",", 1)
            raw_bytes = base64.b64decode(b64_str)
            avatar_dir = get_avatar_dir()
            fname = f"user_{current_user.id}_{int(time.time())}.jpg"
            with open(avatar_dir / fname, "wb") as f:
                f.write(raw_bytes)
            update_data["avatar_url"] = f"/static/avatars/{fname}"
        except Exception as e:
            logger.warning("[update_profile] Could not save avatar as file: %s", e)

    updated_user = await crud_user.update(db, db_obj=current_user, obj_in=update_data)
    await db.commit()
    await db.refresh(updated_user)
    return updated_user


async def _process_and_save_avatar(
    img_bytes: bytes,
    current_user: User,
    db: AsyncSession,
) -> User:
    if not img_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp ảnh tải lên bị rỗng.",
        )

    avatar_dir = get_avatar_dir()

    # Xóa avatar cũ trong static/avatars nếu có
    if current_user.avatar_url and "/static/avatars/" in current_user.avatar_url:
        old_filename = current_user.avatar_url.split("/static/avatars/")[-1]
        old_path = avatar_dir / old_filename
        if old_path.exists():
            try:
                old_path.unlink()
            except Exception:
                pass

    timestamp = int(time.time())
    new_filename = f"user_{current_user.id}_{timestamp}.jpg"
    new_path = avatar_dir / new_filename

    # Tối ưu ảnh qua PIL (cắt vuông, nén JPG 512x512) nếu có
    saved = False
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        w, h = img.size
        min_dim = min(w, h)
        left = (w - min_dim) // 2
        top = (h - min_dim) // 2
        img = img.crop((left, top, left + min_dim, top + min_dim))
        img.thumbnail((512, 512))
        img.save(new_path, format="JPEG", quality=90)
        saved = True
    except Exception:
        pass

    if not saved:
        try:
            with open(new_path, "wb") as f:
                f.write(img_bytes)
            saved = True
        except Exception as write_err:
            logger.warning("[_process_and_save_avatar] File write error: %s", write_err)

    # Lưu đường dẫn avatar_url mới vào database PostgreSQL
    if saved and new_path.exists():
        current_user.avatar_url = f"/static/avatars/{new_filename}"
    else:
        # Fallback: lưu trực tiếp Base64 data URI vào PostgreSQL TEXT column
        b64_encoded = base64.b64encode(img_bytes).decode("utf-8")
        current_user.avatar_url = f"data:image/jpeg;base64,{b64_encoded}"

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserOut)
@router.put("/me/avatar", response_model=UserOut)
@router.patch("/me/avatar", response_model=UserOut)
async def upload_my_avatar(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Tải lên và cập nhật ảnh đại diện (Avatar) cho tài khoản người dùng hiện tại.
    Hỗ trợ cả multipart/form-data (tệp ảnh) và JSON (Base64 data URI / URL ảnh).
    """
    content_type = request.headers.get("content-type", "").lower()
    img_bytes: Optional[bytes] = None

    # 1. Kiểm tra multipart/form-data
    if "multipart/form-data" in content_type:
        try:
            form = await request.form()
            uploaded_file = form.get("file") or form.get("avatar") or form.get("image")
            if uploaded_file and hasattr(uploaded_file, "read"):
                img_bytes = await uploaded_file.read()
            elif isinstance(uploaded_file, bytes):
                img_bytes = uploaded_file
        except Exception:
            pass

    # 2. Kiểm tra JSON body (Base64 data URI hoặc URL)
    if not img_bytes:
        try:
            body = await request.json()
            if isinstance(body, dict):
                raw_b64 = (
                    body.get("avatar_base64")
                    or body.get("avatar_url")
                    or body.get("image")
                    or body.get("avatar")
                    or body.get("data")
                )
                if raw_b64 and isinstance(raw_b64, str):
                    raw_b64 = raw_b64.strip()
                    if raw_b64.startswith("data:image"):
                        if "," in raw_b64:
                            _, data_str = raw_b64.split(",", 1)
                            raw_b64 = data_str
                        img_bytes = base64.b64decode(raw_b64)
                    elif raw_b64.startswith("http://") or raw_b64.startswith("https://") or raw_b64.startswith("/static/"):
                        current_user.avatar_url = raw_b64
                        await db.commit()
                        await db.refresh(current_user)
                        return current_user
                    else:
                        try:
                            img_bytes = base64.b64decode(raw_b64)
                        except Exception:
                            pass
        except Exception:
            pass

    if not img_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp tệp ảnh hoặc chuỗi ảnh đại diện hợp lệ.",
        )

    return await _process_and_save_avatar(img_bytes, current_user, db)


@router.post("/me/avatar/upload", response_model=UserOut)
async def upload_my_avatar_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint chuyên biệt nhận tệp ảnh đại diện qua Multipart form-data."""
    img_bytes = await file.read()
    return await _process_and_save_avatar(img_bytes, current_user, db)


@router.delete("/me/avatar", response_model=UserOut)
async def delete_my_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa ảnh đại diện hiện tại và khôi phục về mặc định."""
    avatar_dir = get_avatar_dir()
    if current_user.avatar_url and "/static/avatars/" in current_user.avatar_url:
        old_filename = current_user.avatar_url.split("/static/avatars/")[-1]
        old_path = avatar_dir / old_filename
        if old_path.exists():
            try:
                old_path.unlink()
            except Exception:
                pass

    current_user.avatar_url = None
    await db.commit()
    await db.refresh(current_user)
    return current_user


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


@router.get("/me/notification-preferences")
async def get_my_notification_preferences(
    current_user: User = Depends(get_current_user),
):
    """Lấy tùy chọn nhận thông báo cảnh báo của người dùng hiện tại."""
    return {
        "notifications_enabled": getattr(current_user, "notifications_enabled", True),
        "alert_sound_enabled": getattr(current_user, "alert_sound_enabled", True),
        "critical_alert_enabled": getattr(current_user, "critical_alert_enabled", True),
    }


@router.patch("/me/notification-preferences", response_model=UserOut)
@router.put("/me/notification-preferences", response_model=UserOut)
async def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật cài đặt nhận thông báo cảnh báo (thông báo đẩy, âm thanh, cảnh báo khẩn cấp)."""
    update_data = payload.model_dump(exclude_unset=True)
    return await crud_user.update(
        db,
        db_obj=current_user,
        obj_in=update_data,
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


# ==============================================================================
# QUẢN LÝ ĐẦU CUỐI (CLIENT TERMINALS / DEVICES) & LỊCH SỬ ĐĂNG NHẬP (LOGIN HISTORY)
# ==============================================================================

@router.get("/me/terminals", response_model=list[UserTerminalOut])
@router.get("/me/devices", response_model=list[UserTerminalOut])
async def get_my_terminals(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách thiết bị đầu cuối (Client Terminals) đang đăng nhập của tài khoản."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "")
    terminals = await crud_user_terminal.get_terminals_for_user(
        db, user=current_user, current_ip=client_ip, current_user_agent=user_agent
    )
    return terminals


@router.delete("/me/terminals/{terminal_id}")
@router.delete("/me/devices/{terminal_id}")
async def revoke_my_terminal(
    terminal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Thu hồi quyền và xóa thiết bị đầu cuối khỏi tài khoản."""
    from uuid import UUID
    try:
        t_uuid = UUID(terminal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID thiết bị không hợp lệ")

    deleted = await crud_user_terminal.delete_terminal(db, user_id=current_user.id, terminal_id=t_uuid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị hoặc không thuộc tài khoản của bạn")

    await db.commit()
    return {"message": "Đã thu hồi và xóa thiết bị thành công", "terminal_id": terminal_id}


@router.get("/me/login-history", response_model=list[UserLoginHistoryOut])
@router.get("/me/logins", response_model=list[UserLoginHistoryOut])
async def get_my_login_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách lịch sử các phiên đăng nhập của người dùng."""
    histories = await crud_user_terminal.get_login_history_for_user(
        db, user=current_user, limit=limit
    )
    return histories


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

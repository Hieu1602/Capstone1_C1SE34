"""

users.py – Quản lý tài khoản Caregiver / Bác sĩ.

"""

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile, status
from starlette.concurrency import run_in_threadpool
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

import math
from datetime import datetime, timezone, timedelta
from typing import Optional, Union, List

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.audit import record_audit_log
from app.core.database import get_db

from app.core.security import hash_password, verify_password
from app.crud.crud_user import crud_user, normalize_phone
from app.services.notification.otp_service import is_recently_verified, verify_otp
from app.crud.crud_user_terminal import crud_user_terminal

from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.device import Device
from app.models.incident import Incident
from app.models.system_notification import SystemNotification
from app.models.user import User, UserStatus
from sqlalchemy import func, or_, and_

from app.schemas.user import (
    FontSizePreferenceUpdate,
    LanguagePreferenceUpdate,
    NotificationPreferenceUpdate,
    PasswordChange,
    UserLoginHistoryOut,
    UserOut,
    UserTerminalOut,
    UserUpdate,
    UserStatusUpdate,
    UserPaginationOut,
    DormantPreviewOut,
    DormantBatchActionIn,
)

router = APIRouter()


def get_user_dormancy_level(user: User, now: datetime) -> str:
    """Tính mức độ ngủ đông theo last_login_at (hoặc created_at nếu chưa từng đăng nhập)."""
    last_act = user.last_login_at or user.created_at
    if not last_act:
        return "active"
    days = (now - last_act).total_seconds() / 86400
    if days >= settings.DORMANT_DELETE_DAYS:
        return "eligible_delete_1y"
    elif days >= settings.DORMANT_LOCK_DAYS:
        return "lock_6m"
    elif days >= settings.DORMANT_REMIND_DAYS:
        return "remind_3m"
    return "active"


async def check_user_deletion_guards(db: AsyncSession, target_user: User, current_admin: User) -> tuple[bool, Optional[str]]:
    """Ràng buộc 7: Kiểm tra điều kiện bắt buộc trước khi xóa tài khoản."""
    # 1. Admin không tự xóa mình
    if target_user.id == current_admin.id:
        return False, "Không thể tự xóa tài khoản của chính mình."

    # 2. Không xóa Admin cuối cùng
    if target_user.role == "admin":
        admin_count_res = await db.execute(
            select(func.count(User.id)).where(User.role == "admin", User.is_active == True)
        )
        admin_count = admin_count_res.scalar() or 0
        if admin_count <= 1:
            return False, "Không thể xóa Quản trị viên cuối cùng của hệ thống."

    # 3. Không xóa Owner khi nhà còn thành viên hoạt động
    houses_res = await db.execute(select(House).where(House.owner_id == target_user.id))
    owned_houses = list(houses_res.scalars().all())
    for house in owned_houses:
        mem_res = await db.execute(
            select(func.count(HouseMember.id)).where(
                HouseMember.house_id == house.id,
                HouseMember.user_id != target_user.id,
                HouseMember.status == "ACTIVE"
            )
        )
        active_mems = mem_res.scalar() or 0
        if active_mems > 0:
            return False, f"Căn nhà [{house.name}] còn {active_mems} thành viên hoạt động. Vui lòng chuyển quyền Chủ hộ hoặc giải tán nhà trước khi xóa."

    # 4. Không xóa tài khoản đang có cảnh báo khẩn cấp chưa xử lý
    inc_res = await db.execute(
        select(Incident.id)
        .join(Device, Incident.device_id == Device.id)
        .where(
            Device.owner_id == target_user.id,
            Incident.is_acknowledged == False,
        )
        .limit(1)
    )
    if inc_res.scalar_one_or_none():
        return False, "Tài khoản đang có cảnh báo khẩn cấp chưa được xử lý. Vui lòng xử lý cảnh báo trước."

    return True, None


async def check_user_locking_guards(db: AsyncSession, target_user: User, current_admin: User) -> tuple[bool, Optional[str]]:
    """Ràng buộc 7: Kiểm tra điều kiện bắt buộc trước khi khóa tài khoản."""
    if target_user.id == current_admin.id:
        return False, "Không thể tự khóa tài khoản của chính mình."
    if target_user.role == "admin":
        admin_count_res = await db.execute(
            select(func.count(User.id)).where(User.role == "admin", User.is_active == True)
        )
        admin_count = admin_count_res.scalar() or 0
        if admin_count <= 1:
            return False, "Không thể khóa Quản trị viên cuối cùng của hệ thống."
    return True, None


@router.get("", response_model=Union[UserPaginationOut, list[UserOut]])
@router.get("/", response_model=Union[UserPaginationOut, list[UserOut]])
async def list_users(
    page: Optional[int] = Query(default=None, ge=1, description="Số trang hiển thị"),
    page_size: Optional[int] = Query(default=10, ge=1, le=100, description="Số dòng mỗi trang"),
    search: Optional[str] = Query(default=None, description="Tìm theo số điện thoại, họ tên, email"),
    role: Optional[str] = Query(default=None, description="Bộ lọc vai trò"),
    status: Optional[str] = Query(default=None, description="Bộ lọc trạng thái (active, locked_auto, locked_admin)"),
    dormancy: Optional[str] = Query(default=None, description="Bộ lọc ngủ đông (active, remind_3m, lock_6m, eligible_delete_1y)"),
    include_elderly: bool = Query(default=True, description="Hiển thị cả người cao tuổi trong danh sách"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    1. Tra cứu người dùng có phân trang và bộ lọc chuyên sâu (dành cho Admin):
    - Tìm kiếm theo số điện thoại, họ tên, email
    - Lọc vai trò, trạng thái (active, locked_auto, locked_admin), mức ngủ đông
    - Kiểm tra trước điều kiện xóa (can_delete, cannot_delete_reason)
    """
    now = datetime.now(timezone.utc)

    # Tối ưu hóa truy vấn: Precompute các guard checks 1 lần duy nhất thay vì N+1 queries trong loop
    admin_count_res = await db.execute(
        select(func.count(User.id)).where(User.role == "admin", User.is_active == True)
    )
    admin_count = admin_count_res.scalar() or 0

    owner_with_active_members_res = await db.execute(
        select(House.owner_id)
        .join(HouseMember, House.id == HouseMember.house_id)
        .where(
            HouseMember.user_id != House.owner_id,
            HouseMember.status == "ACTIVE"
        )
        .distinct()
    )
    owners_with_members = set(owner_with_active_members_res.scalars().all())

    owner_with_unack_incident_res = await db.execute(
        select(Device.owner_id)
        .join(Incident, Device.id == Incident.device_id)
        .where(Incident.is_acknowledged == False)
        .distinct()
    )
    owners_with_incidents = set(owner_with_unack_incident_res.scalars().all())

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
            doctor_houses = []
            for m in u.house_memberships:
                if m.house and m.house.name:
                    h_label = f"{m.house.name} ({m.house.address})" if m.house.address else m.house.name
                    doctor_houses.append(h_label)
            for h in u.owned_houses:
                h_label = f"{h.name} ({h.address})" if h.address else h.name
                if h_label not in doctor_houses:
                    doctor_houses.append(h_label)

            if doctor_houses:
                assigned_house = f"Phụ trách y tế: {', '.join(doctor_houses)}"
            else:
                assigned_house = "Bác sĩ chuyên khoa dự phòng"
        elif u.owned_houses:
            house = u.owned_houses[0]
            assigned_house = f"{house.name} ({house.address or 'Chủ sở hữu'})"
            role_title = "Chủ sở hữu hệ thống"
        elif u.house_memberships:
            m = u.house_memberships[0]
            if m.house:
                addr_text = m.house.address or m.role_in_house
                assigned_house = f"{m.house.name} ({addr_text})"
            else:
                assigned_house = "Nhà của tôi"
            role_title = "Thành viên gia đình"

        u_dormancy = get_user_dormancy_level(u, now)

        # Kiểm tra Guard nhanh bằng in-memory set (0ms round-trip)
        u_can_del = True
        u_reason = None
        if u.id == current_user.id:
            u_can_del = False
            u_reason = "Không thể tự xóa tài khoản của chính mình."
        elif u.role == "admin" and admin_count <= 1:
            u_can_del = False
            u_reason = "Không thể xóa Quản trị viên cuối cùng của hệ thống."
        elif u.id in owners_with_members:
            u_can_del = False
            u_reason = "Căn nhà còn thành viên hoạt động. Vui lòng chuyển quyền Chủ hộ hoặc giải tán nhà trước khi xóa."
        elif u.id in owners_with_incidents:
            u_can_del = False
            u_reason = "Tài khoản đang có cảnh báo khẩn cấp chưa được xử lý."

        user_out = UserOut.model_validate(u)
        user_out.assigned_house = assigned_house
        user_out.role_title = role_title
        user_out.dormancy_level = u_dormancy
        user_out.can_delete = u_can_del
        user_out.cannot_delete_reason = u_reason
        user_outs.append(user_out)

    if include_elderly:
        try:
            eld_stmt = select(ElderlyProfile).options(selectinload(ElderlyProfile.house))
            eld_res = await db.execute(eld_stmt)
            eld_list = eld_res.scalars().all()

            for eld in eld_list:
                if not eld.full_name or not eld.full_name.strip():
                    continue

                house_str = f"{eld.house.name} ({eld.house.address})" if eld.house else ("Chưa có địa chỉ" if not eld.house else eld.house.name)
                eld_out = UserOut(
                    id=eld.id,
                    phone=eld.emergency_contact_phone or "", 
                    full_name=eld.full_name,
                    role="elderly",
                    role_title="Người cao tuổi",
                    is_active=True,
                    status="active",
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
                    dormancy_level="active",
                    can_delete=True,
                )
                user_outs.append(eld_out)
        except Exception:
            pass

    # Bộ lọc Tra cứu
    filtered = user_outs
    if search and search.strip():
        kw = search.strip().lower()
        filtered = [
            u for u in filtered
            if (u.full_name and kw in u.full_name.lower())
            or (u.phone and kw in u.phone)
            or (u.email and kw in u.email.lower())
            or (u.assigned_house and kw in u.assigned_house.lower())
        ]

    if role and role.strip() and role.strip() != "all":
        r = role.strip().lower()
        if r == "owner":
            filtered = [u for u in filtered if u.role in ("user", "owner")]
        elif r == "member":
            filtered = [u for u in filtered if u.role in ("member", "caregiver")]
        else:
            filtered = [u for u in filtered if u.role.lower() == r]

    if status and status.strip() and status.strip() != "all":
        st = status.strip().lower()
        filtered = [u for u in filtered if getattr(u, "status", "active") == st]

    if dormancy and dormancy.strip() and dormancy.strip() != "all":
        dm = dormancy.strip().lower()
        filtered = [u for u in filtered if getattr(u, "dormancy_level", "active") == dm]

    # Phân trang nếu page được truyền vào
    if page is not None:
        total = len(filtered)
        start = (page - 1) * page_size
        paged_items = filtered[start : start + page_size]
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        return UserPaginationOut(
            items=paged_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    return filtered


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
    role = (user_in.get("role") or "owner").strip().lower()
    if role == "user":
        role = "owner"

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

        await record_audit_log(
            db=db,
            event="TẠO HỒ SƠ NGƯỜI CAO TUỔI",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin tạo hồ sơ người cao tuổi [{eld.full_name}] - SĐT: {eld.emergency_contact_phone}",
            severity="low",
        )

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

    await record_audit_log(
        db=db,
        event="TẠO TÀI KHOẢN",
        user_name=f"{current_user.full_name} ({current_user.role})",
        details=f"Admin tạo tài khoản [{user.full_name}] - SĐT: {user.phone}, Vai trò: {user.role}",
        severity="low",
    )

    user_out = UserOut.model_validate(user)
    user_out.assigned_house = user_in.get("assigned_house")

    return user_out


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin profile của người dùng hiện tại."""
    # Nếu avatar_url trỏ tới đường dẫn file cục bộ /static/avatars/... và file tồn tại,
    # tự động đồng bộ chuyển đổi sang Base64 data URI vào database (Supabase)
    # để khi đăng nhập trên bất kỳ máy nào khác vẫn hiển thị đầy đủ ảnh đại diện.
    if current_user.avatar_url and current_user.avatar_url.startswith("/static/avatars/"):
        try:
            avatar_dir = get_avatar_dir()
            filename = current_user.avatar_url.split("/static/avatars/")[-1]
            local_file = avatar_dir / filename
            if local_file.exists():
                from PIL import Image
                img = Image.open(local_file)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                w, h = img.size
                min_dim = min(w, h)
                img = img.crop(((w - min_dim) // 2, (h - min_dim) // 2, (w + min_dim) // 2, (h + min_dim) // 2))
                img.thumbnail((384, 384))
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=85)
                b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
                current_user.avatar_url = f"data:image/jpeg;base64,{b64_str}"
                await db.commit()
                await db.refresh(current_user)
        except Exception as e:
            logger.warning("[get_current_user_profile] Auto-sync avatar error: %s", e)

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

    # Cập nhật số điện thoại
    if "phone" in update_data and update_data["phone"]:
        new_phone = normalize_phone(update_data["phone"])
        if new_phone != current_user.phone:
            existing = await crud_user.get_by_phone(db, phone=new_phone)
            if existing and existing.id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Số điện thoại này đã được sử dụng bởi một tài khoản khác.",
                )

            # Bắt buộc xác thực OTP với số điện thoại mới
            otp_code = update_data.pop("otp_code", None)
            if not is_recently_verified(new_phone):
                if otp_code:
                    try:
                        valid = await run_in_threadpool(verify_otp, new_phone, str(otp_code).strip())
                    except Exception as exc:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Lỗi xác thực mã OTP: {str(exc)}",
                        ) from exc
                    if not valid:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Mã xác thực OTP không chính xác hoặc đã hết hạn.",
                        )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Vui lòng nhập mã OTP để xác nhận thay đổi số điện thoại.",
                    )
            update_data["phone"] = new_phone
    else:
        update_data.pop("otp_code", None)

    # Nếu avatar_url gửi lên dưới dạng Base64 data URI, tối ưu và lưu trực tiếp vào database
    if update_data.get("avatar_url") and update_data["avatar_url"].startswith("data:image"):
        try:
            raw_val = update_data["avatar_url"]
            _, b64_str = raw_val.split(",", 1)
            raw_bytes = base64.b64decode(b64_str)
            from PIL import Image
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            w, h = img.size
            min_dim = min(w, h)
            img = img.crop(((w - min_dim) // 2, (h - min_dim) // 2, (w + min_dim) // 2, (h + min_dim) // 2))
            img.thumbnail((384, 384))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            opt_bytes = buf.getvalue()
            opt_b64 = base64.b64encode(opt_bytes).decode("utf-8")
            update_data["avatar_url"] = f"data:image/jpeg;base64,{opt_b64}"

            # Lưu dự phòng vào static/avatars/
            try:
                avatar_dir = get_avatar_dir()
                fname = f"user_{current_user.id}_{int(time.time())}.jpg"
                with open(avatar_dir / fname, "wb") as f:
                    f.write(opt_bytes)
            except Exception:
                pass
        except Exception as e:
            logger.warning("[update_profile] Could not optimize avatar: %s", e)

    updated_user = await crud_user.update(db, db_obj=current_user, obj_in=update_data)
    await db.commit()
    await db.refresh(updated_user)

    await record_audit_log(
        db=db,
        event="CẬP NHẬT HỒ SƠ",
        user_name=f"{current_user.full_name} ({current_user.role})",
        details="Người dùng đã cập nhật thông tin hồ sơ cá nhân",
        severity="low",
    )

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

    # Tối ưu ảnh qua PIL (cắt vuông, nén JPG 384x384 chất lượng 85 để tiết kiệm dung lượng và đồng bộ đa thiết bị)
    base64_data_uri = None
    optimized_bytes = img_bytes

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
        img.thumbnail((384, 384))

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        optimized_bytes = buf.getvalue()
        b64_str = base64.b64encode(optimized_bytes).decode("utf-8")
        base64_data_uri = f"data:image/jpeg;base64,{b64_str}"
    except Exception as e:
        logger.warning("[_process_and_save_avatar] PIL optimization failed: %s", e)

    # Lưu thêm bản tệp tĩnh cục bộ static/avatars
    try:
        with open(new_path, "wb") as f:
            f.write(optimized_bytes)
    except Exception as write_err:
        logger.warning("[_process_and_save_avatar] File write error: %s", write_err)

    if not base64_data_uri:
        b64_str = base64.b64encode(img_bytes).decode("utf-8")
        base64_data_uri = f"data:image/jpeg;base64,{b64_str}"

    # QUAN TRỌNG: Lưu Base64 data URI trực tiếp vào Supabase database.
    # Nhờ vậy, khi đăng nhập trên bất kỳ máy tính/thiết bị nào khác,
    # ứng dụng luôn hiển thị ảnh đại diện mới nhất mà không phụ thuộc file cục bộ hay IP server.
    current_user.avatar_url = base64_data_uri

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

            if isinstance(uploaded_file, UploadFile):
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


@router.patch("/me/language", response_model=UserOut)
@router.put("/me/language", response_model=UserOut)
async def update_my_language(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cap nhat ngon ngu uu tien cua nguoi dung."""
    lang = payload.get("preferred_language") or payload.get("language") or "vi"
    if lang not in ["vi", "en"]:
        lang = "vi"
    return await crud_user.update(
        db,
        db_obj=current_user,
        obj_in={"preferred_language": lang, "language": lang},
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

    await record_audit_log(
        db=db,
        event="ĐỔI MẬT KHẨU",
        user_name=f"{current_user.full_name} ({current_user.role})",
        details="Người dùng đổi mật khẩu tài khoản thành công",
        severity="medium",
    )

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
    client_location = request.headers.get("x-client-location")
    if client_location:
        try:
            from urllib.parse import unquote
            client_location = unquote(client_location).strip()
        except Exception:
            pass
    terminals = await crud_user_terminal.get_terminals_for_user(
        db, user=current_user, current_ip=client_ip, current_user_agent=user_agent, custom_location=client_location
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


# ==============================================================================
# NGHIỆP VỤ NÂNG CAO: TÀI KHOẢN NGỦ ĐÔNG, NHÀ HOANG, KHÓA / MỞ KHÓA & THIẾT BỊ
# ==============================================================================

@router.get("/dormant/preview", response_model=DormantPreviewOut)
async def preview_dormant_users(
    level: str = Query("3m", description="Mức ngủ đông: 3m (> 3 tháng), 6m (> 6 tháng), 1y (> 1 năm)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    3. Bộ lọc tài khoản ngủ đông (Preview):
    - Tính theo last_login_at (hoặc created_at nếu NULL)
    - Loại trừ Admin
    - Loại trừ Owner nếu căn nhà còn thiết bị hoặc thành viên hoạt động
    """
    now = datetime.now(timezone.utc)
    if level == "1y":
        days = settings.DORMANT_DELETE_DAYS
    elif level == "6m":
        days = settings.DORMANT_LOCK_DAYS
    else:
        days = settings.DORMANT_REMIND_DAYS

    threshold_dt = now - timedelta(days=days)

    stmt = (
        select(User)
        .options(
            selectinload(User.owned_houses).selectinload(House.devices),
            selectinload(User.owned_houses).selectinload(House.members),
            selectinload(User.house_memberships).selectinload(HouseMember.house),
        )
        .where(
            User.role != "admin",
            or_(
                and_(User.last_login_at.is_not(None), User.last_login_at <= threshold_dt),
                and_(User.last_login_at.is_(None), User.created_at <= threshold_dt),
            )
        )
    )
    res = await db.execute(stmt)
    candidates = list(res.scalars().all())

    eligible_users: list[UserOut] = []
    for u in candidates:
        skip_owner = False
        if u.owned_houses:
            for h in u.owned_houses:
                has_active_mems = any(m.user_id != u.id and m.status == "ACTIVE" for m in h.members)
                has_active_devs = any(
                    d.is_online or (d.last_heartbeat and d.last_heartbeat >= (now - timedelta(days=settings.DORMANT_LOCK_DAYS)))
                    for d in h.devices
                )
                if has_active_mems or has_active_devs:
                    skip_owner = True
                    break
        if skip_owner:
            continue

        u_out = UserOut.model_validate(u)
        u_out.dormancy_level = get_user_dormancy_level(u, now)
        can_del, r = await check_user_deletion_guards(db, u, current_user)
        u_out.can_delete = can_del
        u_out.cannot_delete_reason = r
        eligible_users.append(u_out)

    return DormantPreviewOut(
        level=level,
        threshold_days=days,
        count=len(eligible_users),
        items=eligible_users,
    )


@router.post("/dormant/batch-action")
async def execute_dormant_batch_action(
    payload: DormantBatchActionIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    3. Thực hiện hành động hàng loạt (Nhắc nhở, Khóa, Xóa) có xác nhận 2 bước.
    """
    if not payload.confirmed:
        raise HTTPException(status_code=400, detail="Cần xác nhận hai bước để thực hiện hành động hàng loạt.")

    preview = await preview_dormant_users(level=payload.level, db=db, current_user=current_user)
    target_ids = [u.id for u in preview.items]

    if not target_ids:
        return {"status": "success", "message": "Không có tài khoản nào phù hợp để thực hiện.", "count": 0}

    now = datetime.now(timezone.utc)
    res = await db.execute(select(User).where(User.id.in_(target_ids)))
    target_users = list(res.scalars().all())

    affected_count = 0
    if payload.action == "remind":
        for u in target_users:
            notif = SystemNotification(
                title="Nhắc nhở duy trì tài khoản",
                body=f"Xin chào {u.full_name}, tài khoản của bạn đã lâu không hoạt động. Vui lòng đăng nhập lại để duy trì dịch vụ chăm sóc gia đình.",
                type="info",
                target_audience="caregivers",
                status="published",
                published_at=now,
                created_by=current_user.id,
            )
            db.add(notif)
            affected_count += 1

        await record_audit_log(
            db=db,
            event="GỬI CẢNH BÁO NGỦ ĐÔNG HÀNG LOẠT",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin gửi thông báo nhắc nhở tới {affected_count} tài khoản ngủ đông mức [{payload.level}]. Lý do: {payload.reason}",
            severity="medium",
            admin_id=str(current_user.id),
            action="BATCH_REMIND_DORMANT",
            reason=payload.reason,
            commit=False,
        )

    elif payload.action == "lock":
        for u in target_users:
            u.status = UserStatus.LOCKED_ADMIN
            u.is_active = False
            u.lock_reason = payload.reason
            u.locked_at = now
            u.locked_by = current_user.id
            u.lock_until = None
            u.token_version = (u.token_version or 1) + 1
            db.add(u)
            affected_count += 1

        await record_audit_log(
            db=db,
            event="KHÓA TÀI KHOẢN NGỦ ĐÔNG HÀNG LOẠT",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin khóa {affected_count} tài khoản ngủ đông mức [{payload.level}]. Lý do: {payload.reason}",
            severity="high",
            admin_id=str(current_user.id),
            action="BATCH_LOCK_DORMANT",
            reason=payload.reason,
            commit=False,
        )

    elif payload.action == "delete":
        for u in target_users:
            if u.status not in (UserStatus.LOCKED_ADMIN, UserStatus.LOCKED_AUTO):
                continue
            can_del, _ = await check_user_deletion_guards(db, u, current_user)
            if not can_del:
                continue
            await crud_user.delete(db, u.id)
            affected_count += 1

        await record_audit_log(
            db=db,
            event="XÓA TÀI KHOẢN NGỦ ĐÔNG HÀNG LOẠT",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin xóa vĩnh viễn {affected_count} tài khoản ngủ đông mức [{payload.level}]. Lý do: {payload.reason}",
            severity="high",
            admin_id=str(current_user.id),
            action="BATCH_DELETE_DORMANT",
            reason=payload.reason,
            commit=False,
        )

    await db.commit()
    return {
        "status": "success",
        "message": f"Đã thực hiện thao tác [{payload.action}] thành công cho {affected_count} tài khoản.",
        "count": affected_count,
    }


@router.post("/houses/{house_id}/dissolve-or-transfer")
async def dissolve_or_transfer_house(
    house_id: str,
    payload: dict = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    4. Xử lý Nhà hoang:
    Nếu Owner không hoạt động và mọi thiết bị không hoạt động quá hạn:
    - Nếu còn thành viên hoạt động: Ưu tiên chuyển quyền Owner
    - Nếu không còn ai: Giải tán 4 bước (thông báo, gỡ thiết bị, xóa house_members, xóa nhà & Owner)
    """
    from uuid import UUID
    try:
        h_uuid = UUID(house_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="House ID không hợp lệ")

    stmt = (
        select(House)
        .options(
            selectinload(House.owner),
            selectinload(House.members).selectinload(HouseMember.user),
            selectinload(House.devices),
            selectinload(House.elderly_profiles),
            selectinload(House.device_groups),
        )
        .where(House.id == h_uuid)
    )
    res = await db.execute(stmt)
    house = res.scalar_one_or_none()
    if not house:
        raise HTTPException(status_code=404, detail="Không tìm thấy căn nhà")

    reason = payload.get("reason") or "Xử lý nhà không hoạt động dài hạn theo chính sách"
    now = datetime.now(timezone.utc)

    active_members = [
        m for m in house.members
        if m.user_id != house.owner_id and m.status == "ACTIVE" and m.user and m.user.is_active
    ]

    if active_members:
        active_members.sort(key=lambda m: m.user.last_login_at or m.user.created_at, reverse=True)
        new_owner_member = active_members[0]
        new_owner = new_owner_member.user
        old_owner = house.owner

        house.owner_id = new_owner.id
        new_owner_member.role_in_house = "OWNER"
        new_owner_member.permissions = "ADMIN"
        if new_owner.role in ("member", "caregiver", "user"):
            new_owner.role = "owner"

        notif = SystemNotification(
            title=f"Chỉ định Chủ hộ mới: {house.name}",
            body=f"Bạn đã được chỉ định làm Chủ hộ của căn nhà [{house.name}] do Chủ hộ trước đó đã ngừng hoạt động.",
            type="info",
            target_audience="all",
            status="published",
            published_at=now,
            created_by=current_user.id,
        )
        db.add(notif)

        await record_audit_log(
            db=db,
            event="CHUYỂN QUYỀN CHỦ HỘ",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Chuyển quyền Chủ hộ căn nhà [{house.name}] từ [{old_owner.full_name if old_owner else 'N/A'}] sang [{new_owner.full_name}]. Lý do: {reason}",
            severity="medium",
            admin_id=str(current_user.id),
            action="TRANSFER_HOUSE_OWNER",
            target_type="house",
            target_id=str(house.id),
            reason=reason,
            old_value=str(old_owner.id) if old_owner else None,
            new_value=str(new_owner.id),
            commit=False,
        )
        await db.commit()
        return {
            "status": "transferred",
            "action": "transfer_owner",
            "message": f"Đã chuyển quyền Chủ hộ căn nhà [{house.name}] cho thành viên [{new_owner.full_name}] thành công.",
            "house_id": str(house.id),
            "new_owner_id": str(new_owner.id),
            "new_owner_name": new_owner.full_name,
        }
    else:
        old_owner = house.owner
        for m in house.members:
            if m.user:
                notif = SystemNotification(
                    title=f"Thông báo giải tán căn nhà: {house.name}",
                    body=f"Căn nhà [{house.name}] đã bị giải tán do Chủ hộ và thiết bị ngừng hoạt động dài hạn. Mọi liên kết chăm sóc đã kết thúc.",
                    type="info",
                    target_audience="all",
                    status="published",
                    published_at=now,
                    created_by=current_user.id,
                )
                db.add(notif)

        for dev in house.devices:
            dev.house_id = None
            dev.group_id = None
            dev.is_online = False
            db.add(dev)

        for m in list(house.members):
            await db.delete(m)
        for eld in list(house.elderly_profiles):
            await db.delete(eld)
        for grp in list(house.device_groups):
            await db.delete(grp)

        house_name = house.name
        await db.delete(house)

        if old_owner and old_owner.role != "admin":
            can_del_owner, _ = await check_user_deletion_guards(db, old_owner, current_user)
            if can_del_owner:
                await crud_user.delete(db, old_owner.id)

        await record_audit_log(
            db=db,
            event="GIẢI TÁN CĂN NHÀ HOANG",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Đã giải tán căn nhà [{house_name}] và thu hồi tài nguyên do bỏ hoang dài hạn. Lý do: {reason}",
            severity="high",
            admin_id=str(current_user.id),
            action="DISSOLVE_DORMANT_HOUSE",
            target_type="house",
            target_id=str(h_uuid),
            reason=reason,
            commit=False,
        )
        await db.commit()
        return {
            "status": "dissolved",
            "action": "dissolve_house",
            "message": f"Đã giải tán căn nhà [{house_name}] và gỡ toàn bộ thiết bị thành công.",
            "house_id": str(h_uuid),
        }


@router.get("/{user_id}/terminals", response_model=list[UserTerminalOut])
async def get_user_terminals_by_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """5. Xem danh sách thiết bị đang đăng nhập của một tài khoản cụ thể."""
    from uuid import UUID
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="User ID không hợp lệ")

    user = await crud_user.get_by_id(db, uid)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    return await crud_user_terminal.get_terminals_for_user(db, user=user)


@router.delete("/{user_id}/terminals/{terminal_id}")
async def revoke_user_terminal_by_admin(
    user_id: str,
    terminal_id: str,
    payload: dict = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """5. Thu hồi quyền một thiết bị đầu cuối cụ thể."""
    from uuid import UUID
    try:
        uid = UUID(user_id)
        t_uuid = UUID(terminal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID không hợp lệ")

    user = await crud_user.get_by_id(db, uid)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    deleted = await crud_user_terminal.delete_terminal(db, user_id=uid, terminal_id=t_uuid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị của người dùng này")

    reason = payload.get("reason") or "Thu hồi thiết bị bởi Quản trị viên"
    await record_audit_log(
        db=db,
        event="THU HỒI THIẾT BỊ ĐẦU CUỐI",
        user_name=f"{current_user.full_name} ({current_user.role})",
        details=f"Admin đã thu hồi thiết bị [{terminal_id}] của tài khoản [{user.full_name}]. Lý do: {reason}",
        severity="medium",
        admin_id=str(current_user.id),
        action="REVOKE_TERMINAL",
        target_type="user_terminal",
        target_id=str(t_uuid),
        reason=reason,
        commit=False,
    )
    await db.commit()
    return {"message": "Đã thu hồi và xóa thiết bị thành công", "terminal_id": terminal_id}


@router.post("/{user_id}/logout-all")
async def logout_all_devices_by_admin(
    user_id: str,
    payload: dict = Body(default={}),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """5. Đăng xuất tất cả thiết bị (thu hồi token và gửi thông báo)."""
    from uuid import UUID
    from sqlalchemy import text
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="User ID không hợp lệ")

    user = await crud_user.get_by_id(db, uid)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    reason = payload.get("reason") or "Đăng xuất tất cả thiết bị để bảo mật tài khoản"
    user.token_version = (user.token_version or 1) + 1
    db.add(user)

    await db.execute(text("DELETE FROM user_terminals WHERE user_id = :uid"), {"uid": str(uid)})

    now = datetime.now(timezone.utc)
    notif = SystemNotification(
        title="Thông báo an ninh tài khoản",
        body=f"Tất cả phiên đăng nhập của bạn đã được đăng xuất bởi Quản trị viên vì lý do: {reason}. Vui lòng đăng nhập lại.",
        type="emergency",
        target_audience="all",
        status="published",
        published_at=now,
        created_by=current_user.id,
    )
    db.add(notif)

    await record_audit_log(
        db=db,
        event="ĐĂNG XUẤT TẤT CẢ THIẾT BỊ",
        user_name=f"{current_user.full_name} ({current_user.role})",
        details=f"Admin đã đăng xuất tất cả thiết bị của tài khoản [{user.full_name}]. Lý do: {reason}",
        severity="medium",
        admin_id=str(current_user.id),
        action="LOGOUT_ALL_DEVICES",
        target_type="user",
        target_id=str(user.id),
        reason=reason,
        commit=False,
    )
    await db.commit()
    return {"status": "success", "message": f"Đã đăng xuất toàn bộ thiết bị của tài khoản [{user.full_name}] thành công."}


@router.post("/{user_id}/status", response_model=UserOut)
@router.patch("/{user_id}/status", response_model=UserOut)
async def update_user_status_by_admin(
    user_id: str,
    payload: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    2. Khóa / Mở khóa tài khoản:
    - Bắt buộc nhập lý do (reason)
    - Lưu status, lock_reason, locked_at, locked_by
    - Khi khóa: tăng token_version để vô hiệu hóa token cũ
    - Kiểm tra ràng buộc không khóa Admin cuối hoặc tự khóa mình
    """
    from uuid import UUID
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="User ID không hợp lệ")

    user = await crud_user.get_by_id(db, uid)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    now = datetime.now(timezone.utc)
    target_name = user.full_name
    target_phone = user.phone or ""
    old_status = getattr(user, "status", "active")
    new_status = payload.status

    if new_status == "locked_admin":
        can_lock, lock_err = await check_user_locking_guards(db, user, current_user)
        if not can_lock:
            raise HTTPException(status_code=400, detail=lock_err)

        user.status = UserStatus.LOCKED_ADMIN
        user.is_active = False
        user.lock_reason = payload.reason
        user.locked_at = now
        user.locked_by = current_user.id
        user.lock_until = None
        user.token_version = (user.token_version or 1) + 1

        await record_audit_log(
            db=db,
            event="KHÓA TÀI KHOẢN THỦ CÔNG",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin đã khóa tài khoản [{target_name}] ({target_phone}). Lý do: {payload.reason}",
            severity="medium",
            admin_id=str(current_user.id),
            action="LOCK_USER_MANUAL",
            target_type="user",
            target_id=str(user.id),
            reason=payload.reason,
            old_value=old_status,
            new_value=new_status,
            commit=False,
        )
    else:
        user.status = UserStatus.ACTIVE
        user.is_active = True
        user.lock_reason = None
        user.locked_at = None
        user.locked_by = None
        user.lock_until = None

        await record_audit_log(
            db=db,
            event="MỞ KHÓA TÀI KHOẢN",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin đã mở khóa tài khoản [{target_name}] ({target_phone}). Lý do: {payload.reason}",
            severity="medium",
            admin_id=str(current_user.id),
            action="UNLOCK_USER",
            target_type="user",
            target_id=str(user.id),
            reason=payload.reason,
            old_value=old_status,
            new_value=new_status,
            commit=False,
        )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    user_out = UserOut.model_validate(user)
    user_out.dormancy_level = get_user_dormancy_level(user, now)
    can_del, r = await check_user_deletion_guards(db, user, current_user)
    user_out.can_delete = can_del
    user_out.cannot_delete_reason = r
    return user_out


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_by_admin(
    user_id: str,
    update_data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin cập nhật thông tin, vai trò hoặc mật khẩu tài khoản."""
    from uuid import UUID

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="User ID không hợp lệ")

    user = await crud_user.get_by_id(db, uid)

    if user:
        has_password_change = "password" in update_data and update_data["password"]
        target_name = user.full_name
        target_phone = user.phone or ""

        if has_password_change:
            update_data["hashed_password"] = hash_password(update_data.pop("password"))

        updated_user = await crud_user.update(db, db_obj=user, obj_in=update_data)
        await db.commit()
        await db.refresh(updated_user)

        if has_password_change:
            await record_audit_log(
                db=db,
                event="ĐẶT LẠI MẬT KHẨU",
                user_name=f"{current_user.full_name} ({current_user.role})",
                details=f"Admin đã đặt lại mật khẩu cho tài khoản [{target_name}] ({target_phone})",
                severity="medium",
                admin_id=str(current_user.id),
                action="RESET_PASSWORD",
                target_type="user",
                target_id=str(user.id),
            )
        else:
            await record_audit_log(
                db=db,
                event="CẬP NHẬT TÀI KHOẢN",
                user_name=f"{current_user.full_name} ({current_user.role})",
                details=f"Admin cập nhật thông tin tài khoản [{target_name}] ({target_phone})",
                severity="low",
                admin_id=str(current_user.id),
                action="UPDATE_USER",
                target_type="user",
                target_id=str(user.id),
            )

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

        await record_audit_log(
            db=db,
            event="CẬP NHẬT HỒ SƠ NGƯỜI CAO TUỔI",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin cập nhật hồ sơ người cao tuổi [{eld.full_name}]",
            severity="low",
            admin_id=str(current_user.id),
            action="UPDATE_ELDERLY",
            target_type="elderly_profile",
            target_id=str(eld.id),
        )

        return UserOut(
            id=eld.id,
            phone=eld.emergency_contact_phone or "",
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
    reason: Optional[str] = Query(default=None, description="Lý do xóa tài khoản"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    7. Ràng buộc bắt buộc khi xóa tài khoản:
    - Không xóa Admin cuối; Admin không tự xóa mình
    - Không xóa Owner khi nhà còn thành viên hoạt động
    - Không xóa tài khoản đang có cảnh báo khẩn cấp chưa xử lý
    - Thao tác và log nằm trong cùng một transaction
    """
    from uuid import UUID

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="User ID không hợp lệ")

    user = await crud_user.get_by_id(db, uid)

    if user:
        can_del, fail_reason = await check_user_deletion_guards(db, user, current_user)
        if not can_del:
            raise HTTPException(status_code=400, detail=fail_reason)

        target_name = user.full_name
        target_phone = user.phone or ""
        del_reason = reason or "Xóa tài khoản theo yêu cầu quản trị viên"

        # Ghi log trong cùng transaction (commit=False)
        await record_audit_log(
            db=db,
            event="XÓA TÀI KHOẢN VĨNH VIỄN",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin đã xóa vĩnh viễn tài khoản [{target_name}] ({target_phone}). Lý do: {del_reason}",
            severity="high",
            admin_id=str(current_user.id),
            action="DELETE_USER",
            target_type="user",
            target_id=str(user.id),
            reason=del_reason,
            old_value=f"phone:{target_phone}, role:{user.role}",
            commit=False,
        )

        await crud_user.delete(db, uid)
        await db.commit()

        return {"message": "Đã xóa tài khoản thành công", "user_id": user_id}

    # Kiểm tra người cao tuổi
    eld_res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id == uid))
    eld = eld_res.scalar_one_or_none()

    if eld:
        target_name = eld.full_name
        del_reason = reason or "Xóa hồ sơ người cao tuổi"
        await record_audit_log(
            db=db,
            event="XÓA HỒ SƠ NGƯỜI CAO TUỔI",
            user_name=f"{current_user.full_name} ({current_user.role})",
            details=f"Admin đã xóa hồ sơ người cao tuổi [{target_name}]. Lý do: {del_reason}",
            severity="high",
            admin_id=str(current_user.id),
            action="DELETE_ELDERLY",
            target_type="elderly_profile",
            target_id=str(eld.id),
            reason=del_reason,
            commit=False,
        )

        await db.delete(eld)
        await db.commit()

        return {"message": "Đã xóa hồ sơ người cao tuổi thành công", "user_id": user_id}

    raise HTTPException(status_code=404, detail="Không tìm thấy đối tượng để xóa")

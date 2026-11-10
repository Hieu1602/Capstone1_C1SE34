import logging
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.audit import get_client_ip, get_user_agent, record_audit_log
from app.core.config import settings
from app.core.database import get_db, AsyncSessionFactory
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.crud.crud_user import crud_user, normalize_phone
from app.crud.crud_user_terminal import crud_user_terminal
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLoginHistoryOut, UserOut, UserTerminalOut
from app.services.doctor import verify_doctor_cchn
from app.services.notification.otp_service import is_recently_verified, send_otp, verify_otp

logger = logging.getLogger(__name__)

router = APIRouter()


class OTPRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)


class OTPVerifyRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)
    otp_code: str = Field(min_length=6, max_length=6)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            if "otp_code" not in data and "code" in data:
                data["otp_code"] = data["code"]
            if "otp_code" in data and isinstance(data["otp_code"], str):
                data["otp_code"] = data["otp_code"].strip()
            if "phone" in data and isinstance(data["phone"], str):
                data["phone"] = data["phone"].strip()
        return data


class CCHNVerifyRequest(BaseModel):
    cchn_number: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=255)


class UserRegistration(UserCreate):
    password: str = Field(min_length=6, max_length=128)
    role: str = "member"
    otp_code: Optional[str] = Field(default=None)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8 or len(v) > 16:
            raise ValueError("Mật khẩu phải có độ dài từ 8 đến 16 ký tự.")
        if (
            not re.search(r"[a-z]", v)
            or not re.search(r"[A-Z]", v)
            or not re.search(r"\d", v)
            or not re.search(r"[^A-Za-z0-9]", v)
        ):
            raise ValueError("Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt (ví dụ: Care@123).")
        return v

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            if "otp_code" not in data and "code" in data:
                data["otp_code"] = data["code"]
            if "otp_code" in data:
                v = data["otp_code"]
                data["otp_code"] = str(v).strip() if v is not None and str(v).strip() else None
            if "phone" in data and isinstance(data["phone"], str):
                data["phone"] = data["phone"].strip()
        return data


class DoctorRegistration(UserCreate):
    password: str = Field(min_length=6, max_length=128)
    role: str = "doctor"
    otp_code: Optional[str] = Field(default=None)
    cchn_number: Optional[str] = Field(default=None, min_length=3, max_length=50)
    workplace: Optional[str] = Field(default=None, max_length=255)
    specialty: Optional[str] = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8 or len(v) > 16:
            raise ValueError("Mật khẩu phải có độ dài từ 8 đến 16 ký tự.")
        if (
            not re.search(r"[a-z]", v)
            or not re.search(r"[A-Z]", v)
            or not re.search(r"\d", v)
            or not re.search(r"[^A-Za-z0-9]", v)
        ):
            raise ValueError("Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt (ví dụ: Care@123).")
        return v

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            if "otp_code" not in data and "code" in data:
                data["otp_code"] = data["code"]
            if "otp_code" in data:
                v = data["otp_code"]
                data["otp_code"] = str(v).strip() if v is not None and str(v).strip() else None
            if "phone" in data and isinstance(data["phone"], str):
                data["phone"] = data["phone"].strip()
        return data


@router.post("/request-otp")
async def request_otp(
    payload: OTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Gửi mã OTP xác thực qua SMS tới số điện thoại để đăng ký tài khoản.
    Kiểm tra số điện thoại: Nếu đã tồn tại tài khoản thì báo lỗi 409 ngay lập tức, không gửi OTP.
    """
    phone = normalize_phone(payload.phone)

    # 1. Kiểm tra số điện thoại đã tồn tại trong hệ thống chưa
    existing_user = await crud_user.get_by_phone(db, phone=phone)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại này đã được đăng ký tài khoản trong hệ thống. Vui lòng đăng nhập hoặc dùng số khác.",
        )

    try:
        await run_in_threadpool(send_otp, phone, "register")
    except RuntimeError as exc:
        error_msg = str(exc)
        # Phân biệt lỗi rate-limit vs lỗi hệ thống
        if "chờ" in error_msg.lower() or "rate" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=error_msg,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg or "Không thể gửi mã xác minh SMS. Vui lòng kiểm tra lại số điện thoại.",
        ) from exc
    return {"message": "Mã xác minh đã được gửi thành công qua SMS."}


@router.post("/verify-otp")
async def verify_otp_endpoint(payload: OTPVerifyRequest):
    """Xác thực mã OTP 6 chữ số."""
    phone = normalize_phone(payload.phone)
    try:
        valid = await run_in_threadpool(verify_otp, phone, payload.otp_code)
    except RuntimeError as exc:
        # Xử lý lỗi khóa tạm do nhập sai quá nhiều lần
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi xác thực mã OTP: {str(exc)}",
        ) from exc
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác minh không chính xác hoặc đã hết hạn.",
        )
    return {"verified": True}


# ==============================================================================
# QUÊN MẬT KHẨU / ĐẶT LẠI MẬT KHẨU (Password Reset via OTP)
# ==============================================================================

class PasswordResetRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)
    otp_code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6, max_length=128)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            if "otp_code" not in data and "code" in data:
                data["otp_code"] = data["code"]
            if "new_password" not in data and "password" in data:
                data["new_password"] = data["password"]
            if "otp_code" in data and isinstance(data["otp_code"], str):
                data["otp_code"] = data["otp_code"].strip()
            if "phone" in data and isinstance(data["phone"], str):
                data["phone"] = data["phone"].strip()
        return data


@router.post("/password/request-otp")
async def request_password_reset_otp(
    payload: OTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Bước 1 – Quên mật khẩu: Gửi mã OTP xác thực tới số điện thoại đã đăng ký.
    Yêu cầu số điện thoại phải tồn tại trong hệ thống.
    """
    phone = normalize_phone(payload.phone)
    user = await crud_user.get_by_phone(db, phone=phone)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Số điện thoại chưa được đăng ký trong hệ thống.",
        )
    try:
        await run_in_threadpool(send_otp, phone, "reset_password")
    except RuntimeError as exc:
        error_msg = str(exc)
        if "chờ" in error_msg.lower() or "rate" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=error_msg,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg or "Không thể gửi mã xác minh SMS.",
        ) from exc
    return {"message": "Mã xác minh đặt lại mật khẩu đã được gửi qua SMS."}


@router.post("/password/reset")
@router.post("/reset-password")
async def complete_password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Bước 2 – Quên mật khẩu: Xác thực OTP và cập nhật mật khẩu mới.
    """
    phone = normalize_phone(payload.phone)

    # Xác thực mã OTP
    try:
        valid = await run_in_threadpool(verify_otp, phone, payload.otp_code)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi xác thực mã OTP: {str(exc)}",
        ) from exc
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác minh không chính xác hoặc đã hết hạn.",
        )

    # Tìm user và cập nhật mật khẩu mới
    user = await crud_user.get_by_phone(db, phone=phone)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản với số điện thoại này.",
        )

    from app.core.security import hash_password
    user.hashed_password = hash_password(payload.new_password)
    try:
        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        await db.rollback()
        logger.error("[password/reset] Lỗi cập nhật mật khẩu: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể cập nhật mật khẩu. Vui lòng thử lại.",
        ) from exc

    logger.info("[password/reset] Đặt lại mật khẩu thành công cho %s", phone)
    return {"message": "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại."}


@router.post("/verify-cchn")
async def check_doctor_cchn(payload: CCHNVerifyRequest):
    """
    Tự động kiểm tra Chứng chỉ hành nghề (CCHN) Bác sĩ qua Cổng Sở Y tế TP.HCM (Medinet)
    hoặc Whitelist Demo. Không cần số CCCD.
    """
    result = await verify_doctor_cchn(
        cchn_number=payload.cchn_number,
        full_name=payload.full_name,
    )
    if not result.get("valid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Số Chứng chỉ hành nghề không hợp lệ hoặc đang bị đình chỉ."),
        )
    return result


@router.post("/register", response_model=UserOut)
async def register(
    user_in: UserRegistration,
    db: AsyncSession = Depends(get_db),
):
    """Đăng ký tài khoản người thân / người chăm sóc."""
    user_in.phone = normalize_phone(user_in.phone)
    existing_phone = await crud_user.get_by_phone(db, phone=user_in.phone)
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại này đã được đăng ký tài khoản.",
        )

    # Xác thực OTP qua otp_service (hỗ trợ eSMS / Twilio / Mock)
    # Cho phép đăng ký nếu đã xác thực OTP gần đây (qua /auth/verify-otp) hoặc truyền otp_code hợp lệ
    if not is_recently_verified(user_in.phone):
        if user_in.otp_code:
            try:
                valid = await run_in_threadpool(verify_otp, user_in.phone, user_in.otp_code)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Lỗi xác thực mã OTP: {str(exc)}",
                ) from exc
            if not valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mã xác minh OTP không đúng hoặc đã hết hạn.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số điện thoại chưa được xác minh mã OTP.",
            )

    try:
        user_in.role = "member"
        user = await crud_user.create(db, obj_in=user_in)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tài khoản với thông tin này đã tồn tại.",
        ) from exc

    return user


@router.post("/register-doctor", response_model=UserOut)
async def register_doctor(
    doctor_in: DoctorRegistration,
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng ký tài khoản Bác sĩ gia đình (Doctor) với cơ chế tự động xác minh CCHN:
    - Xác thực số điện thoại qua OTP SMS.
    - Tự động tra cứu CCHN qua Cổng Sở Y tế TP.HCM (Medinet) hoặc Demo Whitelist.
    - Đảm bảo CCHN đang hoạt động, không bị đình chỉ/thu hồi.
    - Gán vai trò role='doctor' và quyền phụ trách bệnh án.
    """
    doctor_in.phone = normalize_phone(doctor_in.phone)
    existing_phone = await crud_user.get_by_phone(db, phone=doctor_in.phone)
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại này đã được đăng ký trong hệ thống.",
        )

    # 1. Xác thực OTP qua otp_service (hỗ trợ eSMS / Twilio / Mock)
    if not is_recently_verified(doctor_in.phone):
        if doctor_in.otp_code:
            try:
                valid = await run_in_threadpool(verify_otp, doctor_in.phone, doctor_in.otp_code)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Lỗi xác thực mã OTP: {str(exc)}",
                ) from exc
            if not valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mã xác minh OTP không đúng hoặc đã hết hạn.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số điện thoại chưa được xác minh mã OTP.",
            )

    if not doctor_in.cchn_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp số Chứng chỉ hành nghề (CCHN).",
        )

    # 2. Xác thực tự động Chứng chỉ hành nghề Bác sĩ (CCHN)
    cchn_result = await verify_doctor_cchn(
        cchn_number=doctor_in.cchn_number,
        full_name=doctor_in.full_name,
    )
    if not cchn_result.get("valid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=cchn_result.get("message", "Chứng chỉ hành nghề không hợp lệ hoặc đang bị đình chỉ."),
        )

    # 3. Điền thông tin chuyên môn chính thức từ Cổng Sở Y tế nếu chưa nhập
    if not doctor_in.specialty and cchn_result.get("scope_of_practice"):
        doctor_in.specialty = str(cchn_result["scope_of_practice"])
    if not doctor_in.workplace and cchn_result.get("workplace"):
        doctor_in.workplace = str(cchn_result["workplace"])

    try:
        doctor_user = await crud_user.create(db, obj_in=doctor_in)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại hoặc CCHN đã được đăng ký trong hệ thống.",
        ) from exc

    return doctor_user


async def _record_login_background(
    user_id: UUID,
    client_ip: str,
    user_agent: str,
    client_location: Optional[str],
    user_name: str,
    user_role: str,
):
    """Ghi nhận terminal, last_login_at và audit log chạy ngầm, không làm nghẽn quá trình đăng nhập."""
    async with AsyncSessionFactory() as session:
        try:
            await crud_user_terminal.record_login(
                session,
                user_id=user_id,
                ip_address=client_ip,
                user_agent=user_agent,
                custom_location=client_location,
            )
            await session.execute(
                text("UPDATE users SET last_login_at = :now WHERE id = :uid"),
                {"now": datetime.now(timezone.utc), "uid": str(user_id)},
            )
            await session.execute(
                text("""
                    INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                    VALUES ('ĐĂNG NHẬP THÀNH CÔNG', :u, :ip, 'low', :d)
                """),
                {
                    "u": f"{user_name} ({user_role})",
                    "ip": client_ip,
                    "d": f"Đăng nhập thành công qua {user_agent[:40]}.",
                },
            )
            await session.commit()
        except Exception as err:
            logger.warning("[_record_login_background] Lỗi ghi nhận nền: %s", err)
            await session.rollback()


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng nhập hệ thống bằng Số điện thoại + Mật khẩu.
    Tối ưu siêu tốc độ: trả về ngay Token kèm thông tin phân quyền người dùng.
    Các tác vụ ghi log và lưu thiết bị được đưa vào BackgroundTasks.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "")
    phone = normalize_phone(form_data.username)

    try:
        user = await crud_user.get_by_phone(db, phone=phone)
        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Số điện thoại hoặc mật khẩu không chính xác.",
            )

        now = datetime.now(timezone.utc)

        # Kiểm tra tự hết hạn khóa tự động (15-30 phút)
        if getattr(user, "status", "active") == "locked_auto":
            if user.lock_until and user.lock_until > now:
                mins_left = max(1, int((user.lock_until - now).total_seconds() // 60))
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Tài khoản bị tạm khóa tự động còn {mins_left} phút do nhập sai mật khẩu quá 5 lần.",
                )
            else:
                user.status = "active"
                user.is_active = True
                user.lock_reason = None
                user.lock_until = None
                user.locked_at = None
                db.add(user)
                await db.commit()

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Tài khoản đã bị khóa. Lý do: {user.lock_reason or 'Vi phạm chính sách'}.",
            )

        if not verify_password(form_data.password, user.hashed_password):
            # Tăng số lần thử sai mật khẩu
            fail_count = getattr(user, "_failed_attempts", 0) + 1
            setattr(user, "_failed_attempts", fail_count)
            # Khóa tự động khi nhập sai quá 5 lần
            if fail_count >= settings.AUTO_LOCK_MAX_FAILED_ATTEMPTS:
                user.status = "locked_auto"
                user.is_active = False
                user.locked_at = now
                user.lock_until = now + timedelta(minutes=settings.AUTO_LOCK_MINUTES)
                user.lock_reason = f"Tự động khóa {settings.AUTO_LOCK_MINUTES} phút do nhập sai mật khẩu {fail_count} lần liên tiếp"
                db.add(user)
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Tài khoản đã bị tạm khóa tự động {settings.AUTO_LOCK_MINUTES} phút do nhập sai mật khẩu quá 5 lần.",
                )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Số điện thoại hoặc mật khẩu không chính xác.",
            )

        user_id = user.id
        user_name = user.full_name or user.phone
        user_role = user.role or "user"

        # Lấy vị trí client
        client_location = request.headers.get("x-client-location")
        if client_location:
            try:
                from urllib.parse import unquote
                client_location = unquote(client_location).strip()
            except Exception:
                pass

        # Ghi nhận terminal, last_login_at và audit log chạy ngầm (Non-blocking)
        background_tasks.add_task(
            _record_login_background,
            user_id=user.id,
            client_ip=client_ip,
            user_agent=user_agent,
            client_location=client_location,
            user_name=user_name,
            user_role=user_role,
        )

        # Xây dựng UserOut kèm quyền hạn trực tiếp trong response để Frontend không phải gọi thêm /users/me
        user_out = UserOut.model_validate(user)
        try:
            from app.models.house import House, HouseMember
            from app.models.device import Device
            from sqlalchemy import func

            # 1 truy vấn duy nhất lấy nhà, vai trò, quyền hạn và số lượng thiết bị (tối ưu siêu tốc độ khi đăng nhập)
            stmt = (
                select(
                    House.id,
                    House.name,
                    House.owner_id,
                    HouseMember.role_in_house,
                    HouseMember.can_view_health,
                    HouseMember.can_view_camera,
                    HouseMember.can_handle_emergency,
                    HouseMember.can_manage_devices,
                    HouseMember.can_manage_records,
                    select(func.count(Device.id)).where(Device.house_id == House.id).scalar_subquery().label("device_count"),
                )
                .outerjoin(
                    HouseMember,
                    and_(
                        HouseMember.house_id == House.id,
                        HouseMember.user_id == user.id,
                        HouseMember.status == "ACTIVE",
                    ),
                )
                .where(or_(House.owner_id == user.id, HouseMember.user_id == user.id))
                .order_by((House.owner_id == user.id).desc())
                .limit(1)
            )
            res = await db.execute(stmt)
            house_row = res.first()

            if house_row:
                h_id, h_name, h_owner_id, m_role, m_health, m_cam, m_sos, m_dev, m_rec, dev_count = house_row
                dev_count = int(dev_count or 0)
                is_owner = (h_owner_id == user.id) or (user.role in ("admin", "owner"))
                role_in_house = "OWNER" if is_owner else (m_role or "MEMBER")
                user_out.has_house = True
                user_out.household_id = h_id
                user_out.assigned_house = h_name
                user_out.is_owner = is_owner
                user_out.role_in_house = role_in_house
                user_out.can_view_health = is_owner or bool(m_health)
                user_out.can_view_camera = is_owner or bool(m_cam)
                user_out.can_handle_emergency = is_owner or bool(m_sos)
                user_out.can_manage_devices = is_owner or bool(m_dev)
                user_out.can_manage_records = is_owner or bool(m_rec)
                user_out.device_count = dev_count
                user_out.has_devices = dev_count > 0
                user_out.role_title = "Chủ hộ" if is_owner else ("Bác sĩ" if user.role == "doctor" else "Thành viên")
            else:
                user_out.has_house = False
                user_out.household_id = None
                user_out.assigned_house = None
                user_out.is_owner = False
                user_out.role_in_house = "NEW_USER"
                user_out.can_view_health = False
                user_out.can_view_camera = False
                user_out.can_handle_emergency = False
                user_out.can_manage_devices = True  # Tài khoản mới được phép thêm thiết bị
                user_out.can_manage_records = False
                user_out.device_count = 0
                user_out.has_devices = False
                user_out.role_title = "Tài khoản mới"
        except Exception as err:
            logger.warning("[login] Tra cứu quyền hạn nhà: %s", err)

        user_token_version = getattr(user, "token_version", 1)
        return Token(
            access_token=create_access_token(subject=user_id, token_version=user_token_version),
            refresh_token=create_refresh_token(subject=user_id, token_version=user_token_version),
            token_type="bearer",
            user=user_out,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[login] Unhandled crash: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi hệ thống khi đăng nhập: {str(exc)}"
        )


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=Token)
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Làm mới Access Token từ Refresh Token hợp lệ."""
    try:
        decoded = jwt.decode(
            payload.refresh_token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        sub = decoded.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")
        uid = UUID(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ hoặc đã hết hạn")

    user = await crud_user.get(db, user_id=uid)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Người dùng không tồn tại hoặc đã bị khóa")

    return Token(
        access_token=create_access_token(subject=user.id),
        refresh_token=create_refresh_token(subject=user.id),
        token_type="bearer",
    )


@router.get("/me", response_model=UserOut)
async def get_current_auth_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin người dùng đang đăng nhập kèm phân quyền nhà."""
    from app.crud.crud_house import crud_house
    user_out = UserOut.model_validate(current_user)
    try:
        house = await crud_house.get_or_create_default_house(db, owner_id=current_user.id)
        if house:
            perms = await crud_house.get_user_permissions(db, house=house, user=current_user)
            user_out.has_house = True
            user_out.household_id = house.id
            user_out.assigned_house = house.name
            user_out.is_owner = perms.get("is_owner", False)
            user_out.role_in_house = perms.get("role_in_house", "MEMBER")
            user_out.can_view_health = perms.get("can_view_health", True)
            user_out.can_view_camera = perms.get("can_view_camera", True)
            user_out.can_handle_emergency = perms.get("can_handle_emergency", True)
            user_out.can_manage_devices = perms.get("can_manage_devices", False)
            user_out.can_manage_records = perms.get("can_manage_records", False)
            user_out.role_title = "Chủ hộ" if user_out.is_owner else ("Bác sĩ" if current_user.role == "doctor" else "Thành viên")
        else:
            user_out.has_house = False
            user_out.household_id = None
            user_out.assigned_house = None
            user_out.is_owner = False
            user_out.role_in_house = "NONE"
            user_out.can_view_health = False
            user_out.can_view_camera = False
            user_out.can_handle_emergency = False
            user_out.can_manage_devices = False
            user_out.can_manage_records = False
            user_out.role_title = "Tài khoản mới"
    except Exception as err:
        logger.warning("[get_current_auth_user] Tra cứu quyền hạn nhà: %s", err)

    return user_out


# ==============================================================================
# QUẢN LÝ ĐẦU CUỐI (TERMINALS) & LỊCH SỬ ĐĂNG NHẬP (LOGIN HISTORY)
# ==============================================================================

@router.get("/devices", response_model=list[UserTerminalOut])
@router.get("/terminals", response_model=list[UserTerminalOut])
async def get_user_devices(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách thiết bị đầu cuối của người dùng hiện tại."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "")
    client_location = request.headers.get("x-client-location")
    if client_location:
        try:
            from urllib.parse import unquote
            client_location = unquote(client_location).strip()
        except Exception:
            pass
    return await crud_user_terminal.get_terminals_for_user(
        db, user=current_user, current_ip=client_ip, current_user_agent=user_agent, custom_location=client_location
    )


@router.delete("/devices/{device_id}")
@router.delete("/terminals/{device_id}")
async def delete_user_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa / thu hồi thiết bị đầu cuối khỏi tài khoản."""
    try:
        d_uuid = UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID thiết bị không hợp lệ")

    deleted = await crud_user_terminal.delete_terminal(db, user_id=current_user.id, terminal_id=d_uuid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị hoặc không thuộc tài khoản của bạn")

    await db.commit()
    return {"message": "Đã xóa thiết bị thành công", "device_id": device_id}


@router.get("/login-history", response_model=list[UserLoginHistoryOut])
async def get_user_login_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách lịch sử đăng nhập của người dùng."""
    return await crud_user_terminal.get_login_history_for_user(
        db, user=current_user, limit=limit
    )


class LogoutPayload(BaseModel):
    user_name: Optional[str] = None
    role: Optional[str] = None


@router.post("/logout", summary="Đăng xuất và ghi nhận nhật ký kiểm toán")
async def logout(
    request: Request,
    payload: Optional[LogoutPayload] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Ghi nhận sự kiện ĐĂNG XUẤT vào System Audit Logs."""
    if current_user:
        u_name = f"{current_user.full_name} ({current_user.role})"
    elif payload and payload.user_name:
        role_label = f" ({payload.role})" if payload.role else ""
        u_name = f"{payload.user_name}{role_label}"
    else:
        u_name = "Người dùng ẩn danh"

    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    await record_audit_log(
        db=db,
        event="ĐĂNG XUẤT",
        user_name=u_name,
        details=f"Đăng xuất khỏi hệ thống qua {user_agent}.",
        severity="low",
        ip_address=client_ip,
    )

    return {"message": "Đăng xuất thành công"}


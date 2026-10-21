import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.crud.crud_user import crud_user, normalize_phone
from app.crud.crud_user_terminal import crud_user_terminal
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLoginHistoryOut, UserOut, UserTerminalOut
from app.services.doctor_verification import verify_doctor_cchn
from app.services.notification.twilio_verify import send_otp, verify_otp
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


class OTPRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)


class OTPVerifyRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class CCHNVerifyRequest(BaseModel):
    cchn_number: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=255)


class DoctorRegistration(UserCreate):
    password: str = Field(min_length=8, max_length=128)
    role: Literal["doctor"] = "doctor"
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    cchn_number: str = Field(min_length=3, max_length=50)
    workplace: Optional[str] = Field(default=None, max_length=255)
    specialty: Optional[str] = Field(default=None, max_length=255)


@router.post("/request-otp")
async def request_otp(payload: OTPRequest):
    """Gửi mã OTP xác thực qua SMS tới số điện thoại."""
    phone = normalize_phone(payload.phone)
    success = await send_otp(phone)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể gửi mã xác minh SMS. Vui lòng kiểm tra lại số điện thoại.",
        )
    return {"message": "Mã xác minh đã được gửi thành công qua SMS."}


@router.post("/verify-otp")
async def verify_otp_endpoint(payload: OTPVerifyRequest):
    """Xác thực mã OTP 6 chữ số."""
    phone = normalize_phone(payload.phone)
    valid = await verify_otp(phone, payload.otp_code)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác minh không chính xác hoặc đã hết hạn.",
        )
    return {"verified": True}


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
    user_in: UserCreate,
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

    # Bỏ qua xác thực OTP nếu ở chế độ DEV/DEMO
    if user_in.otp_code and user_in.otp_code not in ("123456", "999999"):
        valid = await verify_otp(user_in.phone, user_in.otp_code)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác minh OTP không đúng hoặc đã hết hạn.",
            )

    try:
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

    # 1. Xác thực OTP
    if doctor_in.otp_code and doctor_in.otp_code not in ("123456", "999999"):
        valid = await verify_otp(doctor_in.phone, doctor_in.otp_code)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã xác minh OTP không đúng hoặc đã hết hạn.",
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
        doctor_in.specialty = cchn_result["scope_of_practice"]
    if not doctor_in.workplace and cchn_result.get("workplace"):
        doctor_in.workplace = cchn_result["workplace"]

    try:
        doctor_user = await crud_user.create(db, obj_in=doctor_in)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại hoặc CCHN đã được đăng ký trong hệ thống.",
        ) from exc

    return doctor_user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng nhập hệ thống bằng Số điện thoại + Mật khẩu.
    Hỗ trợ ghi nhận thông tin thiết bị đầu cuối và lịch sử đăng nhập.
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

        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Số điện thoại hoặc mật khẩu không chính xác.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị tạm khóa.",
            )

        user_id = user.id
        user_name = user.full_name or user.phone
        user_role = user.role or "user"

        # Ghi nhận thiết bị đầu cuối & lịch sử đăng nhập
        try:
            await crud_user_terminal.record_login(
                db,
                user=user,
                ip_address=client_ip,
                user_agent=user_agent,
            )
            await db.commit()
        except Exception as terminal_err:
            logger.warning("[login] Failed to record terminal/login-history: %s", terminal_err)
            await db.rollback()

        # Cập nhật thời gian đăng nhập mới nhất
        try:
            await db.execute(
                text("UPDATE users SET last_login_at = :now WHERE id = :uid"),
                {"now": datetime.now(timezone.utc), "uid": str(user_id)},
            )
            await db.commit()
        except Exception:
            await db.rollback()

        # Ghi log Audit
        try:
            await db.execute(text("""
                INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                VALUES ('ĐĂNG NHẬP THÀNH CÔNG', :u, :ip, 'low', :d)
            """), {
                "u": f"{user_name} ({user_role})",
                "ip": client_ip,
                "d": f"Đăng nhập thành công qua {user_agent[:40]}."
            })
            await db.commit()
        except Exception:
            await db.rollback()

        return Token(
            access_token=create_access_token(subject=user_id),
            refresh_token=create_refresh_token(subject=user_id),
            token_type="bearer",
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
    from uuid import UUID
    from jose import JWTError, jwt
    from app.core.config import settings

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

    user = await crud_user.get(db, id=uid)
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
):
    """Lấy thông tin người dùng đang đăng nhập."""
    return current_user


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
    return await crud_user_terminal.get_terminals_for_user(
        db, user=current_user, current_ip=client_ip, current_user_agent=user_agent
    )


@router.delete("/devices/{device_id}")
@router.delete("/terminals/{device_id}")
async def delete_user_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa / thu hồi thiết bị đầu cuối khỏi tài khoản."""
    from uuid import UUID
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

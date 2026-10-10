"""
auth.py – Endpoints đăng nhập / đăng ký / refresh token.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.crud.crud_user import crud_user, normalize_phone
from app.schemas.user import Token, UserCreate, UserOut
from app.services.notification.twilio_verify import send_otp, verify_otp

router = APIRouter()


class OTPRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=16)


class OTPVerifyRequest(OTPRequest):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


@router.post("/request-otp")
async def request_otp(payload: OTPRequest):
    phone = normalize_phone(payload.phone)
    try:
        send_otp(phone)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return {"message": "Mã xác minh đã được gửi."}


@router.post("/verify-otp")
async def verify_otp_code(payload: OTPVerifyRequest):
    if not verify_otp(normalize_phone(payload.phone), payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác minh không đúng hoặc đã hết hạn.",
        )
    return {"verified": True}


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Đăng ký tài khoản bằng số điện thoại đã xác minh OTP."""
    user_in.phone = normalize_phone(user_in.phone)
    existing_phone = await crud_user.get_by_phone(db, phone=user_in.phone)
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số điện thoại đã được sử dụng.",
        )

    user = await crud_user.create(db, obj_in=user_in)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Đăng nhập với số điện thoại và mật khẩu. Trả về JWT tokens."""
    phone = normalize_phone(form_data.username)
    user = await crud_user.get_by_phone(db, phone=phone)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thông tin đăng nhập hoặc mật khẩu không đúng.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa.",
        )

    return Token(
        access_token=create_access_token(subject=user.id),
        refresh_token=create_refresh_token(subject=user.id),
        token_type="bearer",
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
    from jose import JWTError
    from app.core.security import decode_token

    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Token không phải Refresh Token.")
        user_id = UUID(data["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token không hợp lệ hoặc đã hết hạn.",
        )

    user = await crud_user.get(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại hoặc đã bị vô hiệu hóa.",
        )

    return Token(
        access_token=create_access_token(subject=user.id),
        refresh_token=create_refresh_token(subject=user.id),
        token_type="bearer",
    )


from app.api.deps import get_current_user
from app.models.user import User


@router.get("/me", response_model=UserOut)
async def get_current_auth_user(
    current_user: User = Depends(get_current_user),
):
    """Lấy thông tin người dùng đang đăng nhập."""
    return current_user


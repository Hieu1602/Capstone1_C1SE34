"""
auth.py – Endpoints đăng nhập / đăng ký / refresh token.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.crud.crud_user import crud_user, normalize_phone
from app.schemas.user import Token, UserCreate, UserOut
from app.services.notification.twilio_verify import send_otp, verify_otp

router = APIRouter()


class OTPRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=16)


class OTPVerifyRequest(OTPRequest):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class PasswordResetRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=16)
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


class UserRegistration(UserCreate):
    password: str = Field(min_length=8, max_length=128)
    role: Literal["user"] = "user"
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


@router.post("/request-otp")
async def request_otp(
    payload: OTPRequest,
    db: AsyncSession = Depends(get_db),
):
    phone = normalize_phone(payload.phone)
    if await crud_user.get_by_phone(db, phone=phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại đã được đăng ký.",
        )

    try:
        await run_in_threadpool(send_otp, phone)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return {"message": "Mã xác minh đã được gửi."}


@router.post("/verify-otp")
async def verify_otp_code(payload: OTPVerifyRequest):
    try:
        is_verified = await run_in_threadpool(
            verify_otp,
            normalize_phone(payload.phone),
            payload.code,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác minh không đúng hoặc đã hết hạn.",
        )
    return {"verified": True}


@router.post("/password/request-otp")
async def request_password_reset_otp(
    payload: OTPRequest,
    db: AsyncSession = Depends(get_db),
):
    phone = normalize_phone(payload.phone)
    user = await crud_user.get_by_phone(db, phone=phone)

    if user and user.is_active:
        try:
            await run_in_threadpool(send_otp, phone)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc

    return {"message": "Nếu tài khoản tồn tại, mã xác minh sẽ được gửi."}


@router.post("/password/reset")
async def reset_password(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    phone = normalize_phone(payload.phone)
    user = await crud_user.get_by_phone(db, phone=phone)

    try:
        is_verified = await run_in_threadpool(verify_otp, phone, payload.otp_code)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    if not is_verified or not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác minh không hợp lệ, đã hết hạn hoặc tài khoản không tồn tại.",
        )

    user.hashed_password = await run_in_threadpool(hash_password, payload.new_password)
    await db.flush()
    return {"message": "Mật khẩu đã được cập nhật."}


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegistration,
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

    try:
        is_verified = await run_in_threadpool(verify_otp, user_in.phone, user_in.otp_code)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác minh không đúng hoặc đã hết hạn.",
        )

    try:
        user = await crud_user.create(db, obj_in=user_in)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại đã được đăng ký.",
        ) from exc
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

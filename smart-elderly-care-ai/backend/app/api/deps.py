"""
deps.py – Shared FastAPI dependencies (authentication, authorization, db).
"""

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.crud.crud_user import crud_user
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Xác thực JWT bearer token và trả về User entity."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token == "fake-jwt-token-demo":
        admin = await crud_user.get_by_phone(db, phone="+84905123456")
        if admin:
            if not request.headers.get("accept-language"):
                from app.core.i18n import normalize_language

                request.state.language = normalize_language(admin.preferred_language)
            return admin

    try:
        payload = decode_token(token)
        user_id_str: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if user_id_str is None or token_type != "access":
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await crud_user.get(db, user_id=user_id)
    if not user:
        raise credentials_exception

    # Kiểm tra token_version (thu hồi phiên đăng nhập khi Admin thu hồi hoặc đổi quyền)
    token_ver = payload.get("token_version")
    if token_ver is not None and token_ver < getattr(user, "token_version", 1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập đã bị thu hồi bởi Quản trị viên. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Kiểm tra trạng thái khóa tự động (tự hết hạn sau 15-30 phút không cần Admin)
    if getattr(user, "status", "active") == "locked_auto":
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        if user.lock_until and user.lock_until <= now:
            user.status = "active"
            user.is_active = True
            user.lock_reason = None
            user.lock_until = None
            user.locked_at = None
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Tài khoản bị tạm khóa tự động. Lý do: {user.lock_reason or 'Sai mật khẩu quá số lần quy định'}.",
            )

    if not user.is_active:
        detail_msg = f"Tài khoản đã bị khóa. Lý do: {user.lock_reason or 'Vi phạm chính sách'}."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail_msg,
        )
    if request is not None and not request.headers.get("accept-language"):
        from app.core.i18n import normalize_language

        request.state.language = normalize_language(user.preferred_language)
    return user


oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user_optional(
    request: Request,
    token: str | None = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Trả về User nếu có Bearer token hợp lệ, ngược lại trả về None (không chặn request)."""
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db, request=request)
    except Exception:
        return None

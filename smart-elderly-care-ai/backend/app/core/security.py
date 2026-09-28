"""
security.py
JWT Authentication & Password hashing utilities.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
import bcrypt

from app.core.config import settings


# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Hash mật khẩu với bcrypt."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Xác minh mật khẩu so với hash đã lưu."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT Tokens
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Any,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Tạo JWT Access Token.

    Args:
        subject: User ID hoặc username (sẽ lưu vào 'sub' claim)
        expires_delta: Thời gian hết hạn (mặc định từ settings)

    Returns:
        Encoded JWT string
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Any) -> str:
    """Tạo JWT Refresh Token với thời gian hết hạn dài hơn."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Giải mã JWT Token.

    Raises:
        JWTError: Nếu token không hợp lệ hoặc hết hạn
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

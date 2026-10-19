"""
exceptions/__init__.py
Custom exception hierarchy cho Smart Elderly Care AI Backend.

Tất cả exceptions của ứng dụng đều kế thừa AppError để dễ
handle tập trung trong exception handler của FastAPI.
"""

from app.exceptions.app_exceptions import (
    AppError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    ValidationError,
    ServiceUnavailableError,
)

__all__ = [
    "AppError",
    "NotFoundError",
    "UnauthorizedError",
    "ForbiddenError",
    "ConflictError",
    "ValidationError",
    "ServiceUnavailableError",
]

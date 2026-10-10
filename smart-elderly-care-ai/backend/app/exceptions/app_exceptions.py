"""
app_exceptions.py
Custom exception hierarchy cho Smart Elderly Care AI Backend.

Tất cả exceptions kế thừa AppError, cho phép handler tập trung
trong main.py xử lý nhất quán các lỗi ứng dụng.
"""

from http import HTTPStatus
from typing import Any, Optional


class AppError(Exception):
    """
    Base exception cho tất cả custom errors của ứng dụng.

    Attributes:
        message: Thông điệp lỗi ngắn gọn (human-readable).
        status_code: HTTP status code tương ứng.
        detail: Chi tiết lỗi bổ sung (optional).
    """

    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR.value
    default_message: str = "Lỗi máy chủ nội bộ."

    def __init__(
        self,
        message: Optional[str] = None,
        detail: Optional[Any] = None,
    ) -> None:
        self.message = message or self.default_message
        self.detail = detail
        super().__init__(self.message)

    def to_dict(self) -> dict:
        """Chuyển exception sang dict để trả về JSON response."""
        payload: dict = {"error": self.message}
        if self.detail is not None:
            payload["detail"] = self.detail
        return payload


class NotFoundError(AppError):
    """404 – Tài nguyên không tồn tại."""
    status_code = HTTPStatus.NOT_FOUND.value
    default_message = "Tài nguyên không tìm thấy."


class UnauthorizedError(AppError):
    """401 – Chưa xác thực."""
    status_code = HTTPStatus.UNAUTHORIZED.value
    default_message = "Yêu cầu xác thực. Vui lòng đăng nhập."


class ForbiddenError(AppError):
    """403 – Không có quyền truy cập."""
    status_code = HTTPStatus.FORBIDDEN.value
    default_message = "Không có quyền thực hiện hành động này."


class ConflictError(AppError):
    """409 – Xung đột dữ liệu (ví dụ: trùng email)."""
    status_code = HTTPStatus.CONFLICT.value
    default_message = "Dữ liệu đã tồn tại."


class ValidationError(AppError):
    """422 – Dữ liệu đầu vào không hợp lệ."""
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY.value
    default_message = "Dữ liệu đầu vào không hợp lệ."


class ServiceUnavailableError(AppError):
    """503 – Dịch vụ phụ thuộc không khả dụng (Redis, MQTT, AI service)."""
    status_code = HTTPStatus.SERVICE_UNAVAILABLE.value
    default_message = "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau."

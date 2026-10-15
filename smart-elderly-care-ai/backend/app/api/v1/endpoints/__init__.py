"""
endpoints package – Cấu trúc API Endpoints phân định rõ ràng giữa:
1. web_admin/ : Cổng Quản trị Web Admin (4 Phân hệ: Người dùng, Bảo mật, Giám sát, Hạ tầng)
2. mobile/    : Ứng dụng di động Mobile App (Bác sĩ, Người nhà, Người cao tuổi)
"""

from app.api.v1.endpoints import mobile, web_admin

# Re-exports cho tính tương thích ngược (Backward compatibility)
from app.api.v1.endpoints.mobile import (
    auth,
    chatbot,
    device_groups,
    devices,
    doctor,
    emergency,
    houses,
    incidents,
    patients,
    reminders,
    reports,
    vitals,
)
from app.api.v1.endpoints.web_admin import (
    infrastructure,
    monitoring,
    notifications,
    security,
    users,
)

# Alias cho system -> monitoring
system = monitoring

__all__ = [
    "mobile",
    "web_admin",
    "auth",
    "chatbot",
    "device_groups",
    "devices",
    "doctor",
    "emergency",
    "houses",
    "incidents",
    "patients",
    "reminders",
    "reports",
    "vitals",
    "infrastructure",
    "monitoring",
    "notifications",
    "security",
    "users",
    "system",
]

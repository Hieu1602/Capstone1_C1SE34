"""
__init__.py – Khởi tạo và export toàn bộ SQLAlchemy ORM Models cho ứng dụng.
Vị trí: backend/app/models/__init__.py
"""

from app.models.user import User, UserRole
from app.models.house import House, HouseMember
from app.models.elderly_profile import ElderlyProfile
from app.models.device_group import DeviceGroup
from app.models.device import Device, DeviceType
from app.models.device_config import DeviceConfig
from app.models.vital_sign import VitalSign
from app.models.incident import Incident
from app.models.chat import ChatSession, ChatMessage
from app.models.system_notification import SystemNotification
from app.models.user_terminal import UserTerminal, UserLoginHistory
from app.models.support_ticket import SupportTicket
from app.models.appointment import Appointment, AppointmentReminder

__all__ = [
    "User",
    "UserRole",
    "House",
    "HouseMember",
    "ElderlyProfile",
    "DeviceGroup",
    "Device",
    "DeviceType",
    "DeviceConfig",
    "VitalSign",
    "Incident",
    "ChatSession",
    "ChatMessage",
    "SystemNotification",
    "UserTerminal",
    "UserLoginHistory",
    "SupportTicket",
    "Appointment",
    "AppointmentReminder",
]

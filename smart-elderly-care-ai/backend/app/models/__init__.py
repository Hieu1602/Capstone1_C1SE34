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
]

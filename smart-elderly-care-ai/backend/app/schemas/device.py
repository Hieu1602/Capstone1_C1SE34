"""
device.py – Pydantic Schemas cho Device endpoints.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DeviceBase(BaseModel):
    device_id: str
    name: str
    location: Optional[str] = None
    firmware_version: Optional[str] = None


class DeviceCreate(DeviceBase):
    pass


class DeviceOut(DeviceBase):
    id: UUID
    owner_id: UUID
    is_online: bool
    last_heartbeat: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceStatus(BaseModel):
    device_id: str
    is_online: bool
    last_heartbeat: Optional[datetime] = None

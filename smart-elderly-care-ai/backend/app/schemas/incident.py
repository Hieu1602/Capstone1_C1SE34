"""
incident.py – Pydantic Schemas cho Incident endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IncidentOut(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    elderly_id: Optional[uuid.UUID] = None
    alert_type: str
    alert_level: str
    message: str
    confidence: Optional[float] = None
    sources: Optional[str] = None
    video_clip_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_acknowledged: bool
    acknowledged_by: Optional[uuid.UUID] = None
    acknowledged_by_name: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    notes: Optional[str] = None
    repeat_count: Optional[int] = 1
    repeat_badge: Optional[str] = None
    patient_name: Optional[str] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentAck(BaseModel):
    notes: Optional[str] = None


class ReadStateUpdate(BaseModel):
    add: list[str] = []
    remove: list[str] = []


class ReadStateOut(BaseModel):
    read_ids: list[str] = []

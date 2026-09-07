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
    alert_type: str
    alert_level: str
    message: str
    confidence: Optional[float] = None
    sources: Optional[str] = None
    video_clip_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_acknowledged: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentAck(BaseModel):
    notes: Optional[str] = None

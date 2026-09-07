"""
vital.py – Pydantic Schemas cho Vital Signs endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VitalOut(BaseModel):
    id: uuid.UUID
    time: datetime
    device_id: uuid.UUID
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    skin_temp_max: Optional[float] = None
    person_count: Optional[int] = None
    fall_detected: Optional[bool] = None

    model_config = {"from_attributes": True}


class VitalStats(BaseModel):
    device_id: uuid.UUID
    period_hours: int
    heart_rate_min: Optional[float] = None
    heart_rate_max: Optional[float] = None
    heart_rate_avg: Optional[float] = None
    spo2_min: Optional[float] = None
    spo2_max: Optional[float] = None
    spo2_avg: Optional[float] = None
    fall_count: int = 0

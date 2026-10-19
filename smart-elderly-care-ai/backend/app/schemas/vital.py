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
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    skin_temp_max: Optional[float] = None
    person_count: Optional[int] = None
    fall_detected: Optional[bool] = None

    @property
    def recorded_at(self) -> datetime:
        return self.time

    model_config = {"from_attributes": True}


class VitalCreate(BaseModel):
    device_id: Optional[str] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    skin_temp_max: Optional[float] = None
    person_count: Optional[int] = None
    fall_detected: Optional[bool] = False
    raw_payload: Optional[dict] = None


class VitalCurrentOut(BaseModel):
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    skin_temp_max: Optional[float] = None
    body_temp: Optional[float] = None
    person_count: Optional[int] = 0
    fall_detected: bool = False
    timestamp: Optional[int] = None
    sound: Optional[str] = "Bình thường"
    bracelet_battery: Optional[int] = None
    bracelet_connected: bool = False
    edge_hub_connected: bool = False
    device_id: Optional[str] = None
    time: Optional[datetime] = None


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

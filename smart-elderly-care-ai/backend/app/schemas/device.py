"""
device.py – Pydantic v2 Schemas cho Device và DeviceConfig endpoints.
Vị trí: backend/app/schemas/device.py
"""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Device Config Schemas (Cấu hình chi tiết 1 - 1)
# ---------------------------------------------------------------------------

class DeviceConfigBase(BaseModel):
    stream_url: Optional[str] = Field(default=None, description="Luồng RTSP/WebRTC của camera")
    resolution: str = Field(default="2K", description="Độ phân giải: 2K, FHD, SD")
    is_sleep: bool = Field(default=False, description="Chế độ ngủ bảo vệ quyền riêng tư")
    is_ai_protect: bool = Field(default=True, description="Bật/tắt AI phát hiện ngã YOLO")
    has_two_way_audio: bool = Field(default=True, description="Đàm thoại 2 chiều")
    hr_threshold_high: int = Field(default=120, description="Ngưỡng nhịp tim cao (bpm)")
    hr_threshold_low: int = Field(default=50, description="Ngưỡng nhịp tim thấp (bpm)")
    spo2_threshold_low: int = Field(default=90, description="Ngưỡng SpO2 thấp (%)")
    fall_impact_threshold: float = Field(default=2.5, description="Ngưỡng gia tốc rơi (g)")
    immobility_seconds: int = Field(default=30, description="Thời gian bất động nghi ngã (s)")
    mqtt_topic: Optional[str] = None
    extra_settings: Optional[Dict[str, Any]] = None


class DeviceConfigUpdate(BaseModel):
    stream_url: Optional[str] = None
    resolution: Optional[str] = None
    is_sleep: Optional[bool] = None
    is_ai_protect: Optional[bool] = None
    has_two_way_audio: Optional[bool] = None
    hr_threshold_high: Optional[int] = None
    hr_threshold_low: Optional[int] = None
    spo2_threshold_low: Optional[int] = None
    fall_impact_threshold: Optional[float] = None
    immobility_seconds: Optional[int] = None
    extra_settings: Optional[Dict[str, Any]] = None


class DeviceConfigOut(DeviceConfigBase):
    device_id: UUID
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Device Schemas
# ---------------------------------------------------------------------------

class DeviceBase(BaseModel):
    device_id: str = Field(..., max_length=100, description="Mã phần cứng duy nhất (vd: SECA_001, BLE_BAND_01)")
    name: str = Field(..., max_length=150, description="Tên thiết bị (vd: SECA_001)")
    sub_title: Optional[str] = Field(default=None, max_length=255, description="Mô tả phụ / thông số")
    device_type: str = Field(default="CAMERA", description="CAMERA, SMARTBAND, EDGE_HUB")
    location: Optional[str] = Field(default=None, max_length=255, description="Tên phòng (vd: Phòng khách)")
    group_id: Optional[UUID] = Field(default=None, description="ID nhóm khu vực thuộc về")
    elderly_id: Optional[UUID] = Field(default=None, description="ID cụ ông/bà đang đeo thiết bị")
    status_text: Optional[str] = Field(default=None, max_length=150)
    battery_level: Optional[int] = Field(default=None, ge=0, le=100)
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    firmware_version: Optional[str] = None


class DeviceCreate(DeviceBase):
    house_id: Optional[UUID] = None
    config: Optional[DeviceConfigBase] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    sub_title: Optional[str] = Field(default=None, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    group_id: Optional[UUID] = None
    elderly_id: Optional[UUID] = None
    status_text: Optional[str] = None
    battery_level: Optional[int] = Field(default=None, ge=0, le=100)
    is_online: Optional[bool] = None
    firmware_version: Optional[str] = None


class DeviceOut(DeviceBase):
    id: UUID
    owner_id: UUID
    house_id: Optional[UUID] = None
    is_online: bool
    last_heartbeat: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    config: Optional[DeviceConfigOut] = None

    model_config = {"from_attributes": True}


class DeviceStatus(BaseModel):
    device_id: str
    is_online: bool
    last_heartbeat: Optional[datetime] = None
    battery_level: Optional[int] = None
    status_text: Optional[str] = None

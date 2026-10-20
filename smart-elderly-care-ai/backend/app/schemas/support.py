"""
support.py – Pydantic Schemas cho Tổng đài CSKH 24/7 và Hướng dẫn sử dụng & Giới thiệu đồ án.
"""

import uuid
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class SupportTicketCreate(BaseModel):
    topic: str = Field(
        default="Hỗ trợ kết nối camera, vòng tay, hub AI",
        description="Chủ đề yêu cầu hỗ trợ",
    )
    device_type: Optional[str] = Field(
        default="all",
        description="Loại thiết bị: camera, smartband, hub, app, other",
    )
    phone: Optional[str] = Field(default=None, description="Số điện thoại liên hệ")
    note: Optional[str] = Field(
        default=None, description="Mô tả chi tiết tình trạng gặp phải"
    )


class SupportTicketOut(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_name: str
    phone: str
    topic: str
    device_type: str
    note: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SupportHotlineOut(BaseModel):
    hotline_name: str
    hotline_number: str
    dial_uri: str
    operating_hours: str
    description: str
    support_channels: List[dict[str, str]]
    support_topics: List[str]


class FAQItem(BaseModel):
    question: str
    answer: str
    category: str


class UserGuideSection(BaseModel):
    id: str
    title: str
    icon: str
    badge: str
    description: str
    steps: List[str]
    tips: List[str]


class ProjectDocOut(BaseModel):
    project_name: str
    project_code: str
    version: str
    tagline: str
    description: str
    objectives: List[str]
    architecture: dict[str, Any]
    ai_models: List[dict[str, str]]
    iot_devices: List[dict[str, str]]
    user_guides: List[UserGuideSection]
    hotline_info: SupportHotlineOut


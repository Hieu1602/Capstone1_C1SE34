# -*- coding: utf-8 -*-
"""
reminders.py – API quản lý lịch nhắc nhở uống thuốc, đo sinh hiệu & sinh hoạt trong ngày.
Vị trí: backend/app/api/v1/endpoints/mobile/reminders.py

Nguyên tắc:
- Zero Fake Data: Tuyệt đối không hardcode dữ liệu thuốc hoặc lịch nhắc nhở ảo.
- Lưu trữ và truy xuất lịch nhắc nhở thực tế của người dùng qua Redis/Database.
- Khi người dùng chưa tạo cữ thuốc nào, trả về danh sách rỗng để Mobile hiển thị đúng trạng thái thực tế.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis

from app.api.deps import get_current_user_optional
from app.core.database import get_redis
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class ReminderItemIn(BaseModel):
    name: str = Field(..., description="Tên thuốc hoặc hoạt động nhắc nhở")
    time: str = Field(..., description="Giờ nhắc nhở (HH:MM)")
    session: str = Field(default="MORNING", description="Buổi: MORNING, NOON, EVENING")
    dose: str = Field(default="", description="Liều lượng (VD: 1 viên sau ăn)")
    purpose: str = Field(default="", description="Mục đích sử dụng hoặc bệnh nền liên quan")
    category: str = Field(default="MEDICATION", description="MEDICATION, VITALS, ACTIVITY, REST")


def _get_redis_key(user_id: Optional[str], date_str: str) -> str:
    uid = user_id or "default_user"
    return f"reminders:{uid}:{date_str}"


@router.get("/today", summary="Lấy danh sách nhắc nhở hôm nay của cụ")
async def get_today_reminders(
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """
    Trả về dữ liệu lịch nhắc nhở thực tế trong ngày:
    - Nếu chưa có cữ thuốc nào được tạo: trả về danh sách rỗng (Zero Fake Data).
    - Đồng bộ theo ngày hiện tại và tài khoản người dùng.
    """
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    redis_key = _get_redis_key(user_id_str, today_str)

    medications: List[Dict[str, Any]] = []
    meals: List[Dict[str, Any]] = []

    try:
        raw_data = await redis.get(redis_key)
        if raw_data:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                medications = parsed.get("medications", [])
                meals = parsed.get("meals", [])
            elif isinstance(parsed, list):
                medications = parsed
    except Exception as exc:
        logger.warning("[Reminders] Lỗi khi truy vấn nhắc nhở từ Redis: %s", exc)

    completed_count = sum(1 for m in medications if m.get("taken", False))

    return {
        "date": today_str,
        "total_medications": len(medications),
        "completed_medications": completed_count,
        "hub_voice_reminder_enabled": True,
        "medications": medications,
        "meals": meals,
    }


@router.post("", summary="Tạo cữ thuốc hoặc nhắc nhở mới")
async def create_reminder(
    item_in: ReminderItemIn,
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Thêm một cữ thuốc hoặc hoạt động nhắc nhở thực tế cho người cao tuổi."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    redis_key = _get_redis_key(user_id_str, today_str)

    medications: List[Dict[str, Any]] = []
    meals: List[Dict[str, Any]] = []

    try:
        raw_data = await redis.get(redis_key)
        if raw_data:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                medications = parsed.get("medications", [])
                meals = parsed.get("meals", [])
            elif isinstance(parsed, list):
                medications = parsed
    except Exception:
        pass

    new_item = {
        "id": f"rem-{uuid.uuid4().hex[:8]}",
        "name": item_in.name,
        "time": item_in.time,
        "session": item_in.session,
        "dose": item_in.dose,
        "purpose": item_in.purpose,
        "category": item_in.category,
        "taken": False,
        "created_at": datetime.now().isoformat(),
    }
    medications.append(new_item)

    # Lưu vào Redis với TTL 7 ngày
    data_to_store = {
        "medications": medications,
        "meals": meals,
    }
    await redis.set(redis_key, json.dumps(data_to_store), ex=7 * 86400)

    return {"status": "success", "message": "Đã tạo lịch nhắc nhở thành công", "data": new_item}


@router.put("/{reminder_id}/toggle", summary="Đánh dấu đã uống hoặc chưa uống thuốc")
async def toggle_reminder(
    reminder_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Cập nhật trạng thái đã uống thuốc / hoàn thành một cữ nhắc nhở."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    redis_key = _get_redis_key(user_id_str, today_str)

    try:
        raw_data = await redis.get(redis_key)
        if not raw_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch nhắc nhở")

        parsed = json.loads(raw_data)
        medications = parsed.get("medications", []) if isinstance(parsed, dict) else parsed

        found = False
        new_state = False
        for m in medications:
            if m.get("id") == reminder_id:
                m["taken"] = not m.get("taken", False)
                new_state = m["taken"]
                found = True
                break

        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mục nhắc nhở tương ứng")

        await redis.set(redis_key, json.dumps(parsed), ex=7 * 86400)
        return {"status": "success", "reminder_id": reminder_id, "taken": new_state}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Reminders] Lỗi khi cập nhật trạng thái nhắc nhở: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ")


@router.delete("/{reminder_id}", summary="Xóa một mục nhắc nhở")
async def delete_reminder(
    reminder_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Xóa một cữ thuốc khỏi lịch nhắc nhở hôm nay."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    redis_key = _get_redis_key(user_id_str, today_str)

    try:
        raw_data = await redis.get(redis_key)
        if not raw_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch nhắc nhở")

        parsed = json.loads(raw_data)
        medications = parsed.get("medications", []) if isinstance(parsed, dict) else parsed

        initial_len = len(medications)
        medications = [m for m in medications if m.get("id") != reminder_id]

        if len(medications) == initial_len:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mục nhắc nhở để xóa")

        if isinstance(parsed, dict):
            parsed["medications"] = medications
        else:
            parsed = medications

        await redis.set(redis_key, json.dumps(parsed), ex=7 * 86400)
        return {"status": "success", "message": "Đã xóa lịch nhắc nhở thành công"}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Reminders] Lỗi khi xóa nhắc nhở: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ")

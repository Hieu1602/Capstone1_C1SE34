"""
reminders.py – API quản lý lịch nhắc nhở uống thuốc, đo sinh hiệu & sinh hoạt trong ngày.
Vị trí: backend/app/api/v1/endpoints/reminders.py
"""

from typing import Any, Dict, List
from fastapi import APIRouter

router = APIRouter()


@router.get("/today", summary="Lấy danh sách nhắc nhở hôm nay của cụ")
async def get_today_reminders() -> List[Dict[str, Any]]:
    """
    Trả về danh sách các sự kiện nhắc nhở trong ngày:
    - Uống thuốc huyết áp & tim mạch
    - Đo sinh hiệu định kỳ
    - Giờ ăn & vận động
    """
    return [
        {
            "id": "rem-01",
            "time": "07:30",
            "title": "Đo huyết áp & Nhịp tim buổi sáng",
            "description": "Nghỉ ngơi 5 phút trước khi đo bằng vòng tay hoặc máy đo.",
            "is_completed": True,
            "category": "VITALS",
        },
        {
            "id": "rem-02",
            "time": "08:00",
            "title": "Uống thuốc hạ huyết áp (Amlodipine 5mg)",
            "description": "1 viên sau khi ăn sáng, uống với nước ấm.",
            "is_completed": True,
            "category": "MEDICATION",
        },
        {
            "id": "rem-03",
            "time": "11:30",
            "title": "Bữa trưa & Vận động nhẹ nhàng",
            "description": "Ăn thức ăn ít muối, vận động khớp tay chân trong phòng.",
            "is_completed": False,
            "category": "ACTIVITY",
        },
        {
            "id": "rem-04",
            "time": "19:30",
            "title": "Uống thuốc bổ tim & Kiểm tra SpO₂",
            "description": "Đo SpO₂ và uống thuốc theo đơn bác sĩ Minh.",
            "is_completed": False,
            "category": "MEDICATION",
        },
        {
            "id": "rem-05",
            "time": "21:00",
            "title": "Uống sữa ấm & Đi ngủ đúng giờ",
            "description": "Kiểm tra vòng tay đã sạc pin và đang đeo để theo dõi giấc ngủ.",
            "is_completed": False,
            "category": "REST",
        },
    ]

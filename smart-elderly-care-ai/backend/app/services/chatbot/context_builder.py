# -*- coding: utf-8 -*-
"""
context_builder.py – Xây dựng ngữ cảnh y tế thời gian thực (Real-time Clinical Context Builder).
Vị trí: backend/app/services/chatbot/context_builder.py

Nguyên tắc:
- 100% dữ liệu thực tế từ TimescaleDB (chỉ số sinh hiệu, pin, kết nối) và PostgreSQL (hồ sơ bệnh án, cảnh báo).
- Zero Fake Data: Nếu thiết bị đo chưa kết nối hoặc chưa bật, thông báo rõ ràng "Chưa kết nối",
  tuyệt đối không bịa đặt số liệu nhịp tim, SpO2, thân nhiệt.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_incident import crud_incident
from app.crud.crud_vital import crud_vital
from app.models.elderly_profile import ElderlyProfile
from app.models.user import User

logger = logging.getLogger(__name__)


class ChatbotContextBuilder:
    """Truy vấn và đóng gói toàn bộ ngữ cảnh lâm sàng của người cao tuổi từ cơ sở dữ liệu."""

    async def get_realtime_context(
        self, db: AsyncSession, user_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Truy vấn dữ liệu sinh hiệu thực tế, 3 cảnh báo gần nhất và hồ sơ bệnh nhân.
        """
        effective_user_id = user_id
        if not effective_user_id:
            try:
                res = await db.execute(select(User.id).limit(1))
                effective_user_id = res.scalar_one_or_none()
            except Exception as e:
                logger.warning("Không thể lấy user_id mặc định từ DB: %s", e)

        context: Dict[str, Any] = {
            "vitals": None,
            "incidents": [],
            "patient": {},
        }

        # 1. Sinh hiệu thực tế từ TimescaleDB
        if effective_user_id:
            try:
                v_data = await crud_vital.get_current_for_user(db, user_id=effective_user_id)
                # Chỉ coi là có dữ liệu khi có giá trị đo thực tế hoặc thiết bị báo có kết nối
                if v_data and (v_data.get("heart_rate") is not None or v_data.get("bracelet_connected") is True):
                    context["vitals"] = v_data
                else:
                    context["vitals"] = None
            except Exception as e:
                logger.warning("Lỗi truy vấn sinh hiệu thực tế từ DB: %s", e)
                context["vitals"] = None

        # 2. Cảnh báo sự cố gần nhất
        try:
            recent_incidents = await crud_incident.list(db, limit=3)
            context["incidents"] = [
                {
                    "alert_type": inc.alert_type,
                    "alert_level": inc.alert_level,
                    "message": inc.message,
                    "time": inc.created_at.strftime("%H:%M %d/%m/%Y") if inc.created_at else "",
                }
                for inc in recent_incidents
            ]
        except Exception as e:
            logger.warning("Lỗi truy vấn cảnh báo sự cố từ DB: %s", e)

        # 3. Hồ sơ người cao tuổi
        try:
            res = await db.execute(select(ElderlyProfile).limit(1))
            profile = res.scalar_one_or_none()
            if profile:
                context["patient"] = {
                    "full_name": profile.full_name or "Người cao tuổi",
                    "birth_year": profile.birth_year,
                    "gender": profile.gender,
                    "medical_history": profile.medical_history or "Chưa ghi nhận bệnh nền",
                    "emergency_contact": profile.emergency_contact_phone or "Chưa cập nhật",
                }
        except Exception as e:
            logger.warning("Lỗi truy vấn hồ sơ người cao tuổi từ DB: %s", e)

        return context

    def format_vitals_summary(
        self, vitals: Optional[Dict[str, Any]], language: str = "vi"
    ) -> str:
        """Định dạng báo cáo sinh hiệu thực tế trung thực."""
        if not vitals or vitals.get("heart_rate") is None:
            if language == "en":
                return (
                    "📊 **Real-time Vital Signs**: The health monitoring wearable is currently "
                    "disconnected or turned off. No live sensor readings are available at this moment."
                )
            return (
                "📊 **Sinh hiệu thời gian thực**: Thiết bị đo sinh hiệu (vòng đeo tay thông minh) "
                "hiện đang tắt hoặc chưa kết nối. Chưa có số liệu đo trực tiếp tại thời điểm này."
            )

        hr = vitals.get("heart_rate")
        spo2 = vitals.get("spo2")
        temp = vitals.get("skin_temp_max") or vitals.get("body_temp")
        fall = vitals.get("fall_detected")
        battery = vitals.get("bracelet_battery")

        if language == "en":
            hr_status = "Normal (60–100 BPM)" if 60 <= hr <= 100 else ("Elevated" if hr > 100 else "Low")
            spo2_status = "Optimal (≥95%)" if spo2 and spo2 >= 95 else "Low (<95%) - Needs observation"
            temp_status = "Normal" if temp and 36.0 <= temp <= 37.5 else "Abnormal"
            fall_str = "🚨 FALL ALERT DETECTED!" if fall else "Normal (No fall detected)"

            lines = [
                "📊 **Current Monitored Vital Signs**:",
                f"• Heart rate: **{hr} BPM** ({hr_status})",
                f"• Blood Oxygen SpO₂: **{spo2}%** ({spo2_status})",
                f"• Body Temperature: **{temp}°C** ({temp_status})" if temp else "",
                f"• Fall Detection: **{fall_str}**",
                f"• Wearable Battery: **{battery}%**" if battery is not None else "",
            ]
            return "\n".join([line for line in lines if line])

        hr_status = "Bình thường (60-100 BPM)" if 60 <= hr <= 100 else ("Nhanh" if hr > 100 else "Chậm")
        spo2_status = "An toàn (≥95%)" if spo2 and spo2 >= 95 else "Thấp (<95%) - Cần chú ý theo dõi"
        temp_status = "Bình thường (36.0 - 37.5°C)" if temp and 36.0 <= temp <= 37.5 else "Cần theo dõi"
        fall_str = "🚨 CẢNH BÁO: CÓ DẤU HIỆU TÉ NGÃ!" if fall else "Bình thường (Không ghi nhận té ngã)"

        lines = [
            "📊 **Số liệu sinh hiệu thực tế đo được từ thiết bị**:",
            f"• Nhịp tim: **{hr} BPM** ({hr_status})",
            f"• Nồng độ oxy SpO₂: **{spo2}%** ({spo2_status})",
            f"• Thân nhiệt: **{temp}°C** ({temp_status})" if temp else "",
            f"• Trạng thái té ngã: **{fall_str}**",
            f"• Pin vòng đeo tay: **{battery}%**" if battery is not None else "",
        ]
        return "\n".join([line for line in lines if line])

    def format_patient_summary(
        self, patient: Dict[str, Any], language: str = "vi"
    ) -> str:
        """Định dạng thông tin hồ sơ người cao tuổi."""
        if not patient or not patient.get("full_name"):
            if language == "en":
                return "No elderly profile registered in the system."
            return "Hệ thống chưa ghi nhận hồ sơ người cao tuổi trong cơ sở dữ liệu."

        full_name = patient.get("full_name", "Cụ")
        birth_year = patient.get("birth_year")
        current_year = datetime.now().year
        age_str = f" ({current_year - birth_year} tuổi)" if birth_year else ""
        gender = str(patient.get("gender", "")).upper()
        gender_str = "Nam" if gender in ["MALE", "NAM"] else ("Nữ" if gender in ["FEMALE", "NU"] else "Chưa rõ")
        history = patient.get("medical_history") or "Chưa ghi nhận bệnh nền"
        contact = patient.get("emergency_contact") or "Chưa cập nhật"

        if language == "en":
            return (
                f"📋 **Elderly Profile**: **{full_name}** | Year of birth: **{birth_year}**{age_str} | "
                f"Gender: **{gender_str}** | Medical history: {history} | Emergency contact: **{contact}**"
            )

        return (
            f"📋 **Hồ sơ người cao tuổi**: **{full_name}** | Năm sinh: **{birth_year}**{age_str} | "
            f"Giới tính: **{gender_str}** | Tiền sử bệnh lý: {history} | Liên hệ khẩn cấp: **{contact}**"
        )

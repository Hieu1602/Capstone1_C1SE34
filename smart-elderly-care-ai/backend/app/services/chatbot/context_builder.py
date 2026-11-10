# -*- coding: utf-8 -*-
"""
context_builder.py – Xây dựng ngữ cảnh y tế thời gian thực (Real-time Clinical Context Builder).
Vị trí: backend/app/services/chatbot/context_builder.py

Nguyên tắc:
- 100% dữ liệu thực tế từ TimescaleDB (chỉ số sinh hiệu, pin, kết nối) và PostgreSQL (hồ sơ bệnh án, cảnh báo, bác sĩ, lịch hẹn).
- Zero Fake Data: Nếu thiết bị đo chưa kết nối hoặc chưa bật, thông báo rõ ràng "Chưa kết nối",
  tuyệt đối không bịa đặt số liệu nhịp tim, SpO2, thân nhiệt.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_incident import crud_incident
from app.crud.crud_vital import crud_vital
from app.models.appointment import Appointment
from app.models.elderly_profile import ElderlyProfile
from app.models.house import HouseMember
from app.models.user import User

logger = logging.getLogger(__name__)

# Bộ nhớ đệm thông tin lâm sàng tĩnh (Hồ sơ cụ, Bác sĩ, Lịch khám) TTL 60s
# Giúp cắt giảm 3 lượt truy vấn mạng tuần tự tới Supabase trên mỗi tin nhắn chat
_STATIC_CARE_CACHE: Dict[str, Any] = {
    "patient": {},
    "doctor": None,
    "appointment": None,
    "timestamp": 0.0,
    "ttl": 60.0,
}


class ChatbotContextBuilder:
    """Truy vấn và đóng gói toàn bộ ngữ cảnh lâm sàng của người cao tuổi từ cơ sở dữ liệu."""

    async def get_realtime_context(
        self, db: Optional[AsyncSession] = None, user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Truy vấn dữ liệu sinh hiệu thực tế, 5 cảnh báo gần nhất, hồ sơ bệnh nhân,
        bác sĩ phụ trách và lịch khám bệnh sắp tới.
        """
        context: Dict[str, Any] = {
            "vitals": None,
            "incidents": [],
            "patient": {},
            "doctor": None,
            "appointment": None,
        }
        if not db:
            return context

        effective_user_id = user_id
        if not effective_user_id:
            try:
                res = await db.execute(select(User.id).limit(1))
                effective_user_id = res.scalar_one_or_none()
            except Exception as e:
                logger.warning("Không thể lấy user_id mặc định từ DB: %s", e)

        # 1. Sinh hiệu thực tế từ TimescaleDB
        if effective_user_id:
            try:
                v_data = await crud_vital.get_current_for_user(db, user_id=effective_user_id)
                # Chỉ coi là có dữ liệu khi có giá trị đo thực tế hoặc thiết bị báo có kết nối
                if v_data and (v_data.get("heart_rate") is not None or v_data.get("bracelet_connected") is True):
                    # Kiểm tra độ tươi của dữ liệu sinh hiệu (chống dữ liệu cũ từ nhiều giờ/ngày trước)
                    ts = v_data.get("timestamp") or 0
                    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
                    age_minutes = (now_ms - ts) / (60 * 1000)
                    if age_minutes > 30:
                        v_data["is_stale"] = True
                        v_data["fall_detected"] = False  # Sự cố té ngã cũ không phải là biến cố đang diễn ra
                        v_data["stale_time_str"] = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%H:%M ngày %d/%m/%Y")
                    context["vitals"] = v_data
                else:
                    context["vitals"] = None
            except Exception as e:
                logger.warning("Lỗi truy vấn sinh hiệu thực tế từ DB: %s", e)
                context["vitals"] = None

        # 2. Cảnh báo sự cố gần nhất (lấy 5 sự cố gần nhất để tra cứu lịch sử vượt ngưỡng)
        try:
            recent_incidents = await crud_incident.list(db, limit=5, current_user_id=effective_user_id)
            context["incidents"] = [
                {
                    "alert_type": inc.alert_type,
                    "alert_level": inc.alert_level,
                    "message": inc.message,
                    "is_acknowledged": bool(inc.is_acknowledged),
                    "time": inc.created_at.strftime("%H:%M ngày %d/%m/%Y") if inc.created_at else "Gần đây",
                }
                for inc in recent_incidents
            ]
        except Exception as e:
            logger.warning("Lỗi truy vấn cảnh báo sự cố từ DB: %s", e)

        now_ts = time.time()
        cached_ts = _STATIC_CARE_CACHE.get("timestamp", 0.0)
        cached_ttl = _STATIC_CARE_CACHE.get("ttl", 60.0)

        if (now_ts - cached_ts) < cached_ttl and _STATIC_CARE_CACHE.get("patient"):
            # Tái sử dụng ngữ cảnh tĩnh từ bộ nhớ đệm
            context["patient"] = _STATIC_CARE_CACHE.get("patient", {})
            context["doctor"] = _STATIC_CARE_CACHE.get("doctor")
            context["appointment"] = _STATIC_CARE_CACHE.get("appointment")
        else:
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

            # 4. Bác sĩ phụ trách y tế (Database Context Binding - Healthcare Chatbot pattern)
            try:
                stmt = (
                    select(User)
                    .join(HouseMember, HouseMember.user_id == User.id)
                    .where(HouseMember.role_in_house == "DOCTOR")
                    .limit(1)
                )
                doc_res = await db.execute(stmt)
                doc = doc_res.scalar_one_or_none()
                if not doc:
                    doc = (await db.execute(select(User).where(User.role == "DOCTOR").limit(1))).scalar_one_or_none()
                if doc:
                    context["doctor"] = {
                        "name": doc.full_name or "Bác sĩ phụ trách",
                        "phone": getattr(doc, "phone", None) or "Chưa cập nhật",
                        "specialty": getattr(doc, "specialty", None) or "Bác sĩ gia đình",
                    }
            except Exception as e:
                logger.warning("Lỗi truy vấn bác sĩ phụ trách từ DB: %s", e)

            # 5. Lịch khám / tái khám y tế sắp tới (Appointment Context Binding)
            try:
                appt_stmt = (
                    select(Appointment)
                    .where(Appointment.status == "UPCOMING")
                    .order_by(Appointment.scheduled_at.asc())
                    .limit(1)
                )
                appt_res = await db.execute(appt_stmt)
                appt = appt_res.scalar_one_or_none()
                if appt:
                    context["appointment"] = {
                        "scheduled_at": appt.scheduled_at.strftime("%H:%M ngày %d/%m/%Y") if appt.scheduled_at else None,
                        "location": appt.location or "Tại nhà",
                        "visit_type": appt.visit_type or "Khám sức khỏe",
                        "clinical_notes": appt.clinical_notes or "",
                    }
            except Exception as e:
                logger.warning("Lỗi truy vấn lịch khám từ DB: %s", e)

            # Lưu vào cache 60s
            _STATIC_CARE_CACHE["patient"] = context["patient"]
            _STATIC_CARE_CACHE["doctor"] = context["doctor"]
            _STATIC_CARE_CACHE["appointment"] = context["appointment"]
            _STATIC_CARE_CACHE["timestamp"] = now_ts

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
        is_stale = vitals.get("is_stale", False)
        stale_time = vitals.get("stale_time_str", "trước đó")

        if language == "en":
            hr_status = "Normal (60–100 BPM)" if 60 <= hr <= 100 else ("Elevated" if hr > 100 else "Low")
            spo2_status = "Optimal (≥95%)" if spo2 and spo2 >= 95 else "Low (<95%) - Needs observation"
            temp_status = "Normal" if temp and 36.0 <= temp <= 37.5 else "Abnormal"
            fall_str = "🚨 FALL ALERT DETECTED!" if fall and not is_stale else "Normal (No active fall detected)"
            header = "📊 **Current Monitored Vital Signs**:" if not is_stale else f"📊 **Last Recorded Vitals ({stale_time} - Device not live)**:"

            lines = [
                header,
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
        fall_str = "🚨 CẢNH BÁO: CÓ DẤU HIỆU TÉ NGÃ!" if fall and not is_stale else "Bình thường (Không ghi nhận té ngã thời gian thực)"
        header = "📊 **Số liệu sinh hiệu thực tế đo được từ thiết bị**:" if not is_stale else f"📊 **Chỉ số sinh hiệu đo lần gần nhất (Lúc {stale_time} - Thiết bị hiện không kết nối trực tuyến)**:"

        lines = [
            header,
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
        contact_display = "Đã lưu trên ứng dụng (kết nối qua nút SOS)" if contact != "Chưa cập nhật" else "Chưa cập nhật"
        contact_display_en = "Registered in app (connect via SOS button)" if contact != "Chưa cập nhật" else "Not updated"

        if language == "en":
            return (
                f"📋 **Elderly Profile**: **{full_name}** | Year of birth: **{birth_year}**{age_str} | "
                f"Gender: **{gender_str}** | Medical history: {history} | Emergency contact: **{contact_display_en}**"
            )

        return (
            f"📋 **Hồ sơ người cao tuổi**: **{full_name}** | Năm sinh: **{birth_year}**{age_str} | "
            f"Giới tính: **{gender_str}** | Tiền sử bệnh lý: {history} | Liên hệ khẩn cấp: **{contact_display}**"
        )

    def format_care_context_summary(
        self, context: Dict[str, Any], language: str = "vi"
    ) -> str:
        """Định dạng thông tin bác sĩ phụ trách và lịch khám sắp tới (Healthcare Chatbot pattern)."""
        is_en = language == "en"
        doctor = context.get("doctor")
        appointment = context.get("appointment")
        lines = []

        if doctor:
            doc_name = doctor.get("name", "Bác sĩ phụ trách")
            if is_en:
                lines.append(f"👨‍⚕️ **Assigned Doctor**: Dr. {doc_name} (Connect securely via 'Call Doctor' button in app)")
            else:
                lines.append(f"👨‍⚕️ **Bác sĩ phụ trách y tế**: BS. {doc_name} (Liên hệ an toàn qua nút 'Gọi bác sĩ' trên ứng dụng)")
        else:
            if is_en:
                lines.append("👨‍⚕️ **Assigned Doctor**: No designated doctor assigned yet.")
            else:
                lines.append("👨‍⚕️ **Bác sĩ phụ trách y tế**: Chưa phân công bác sĩ riêng cho hộ gia đình.")

        if appointment and appointment.get("scheduled_at"):
            sched = appointment.get("scheduled_at")
            loc = appointment.get("location", "Tại nhà")
            vtype = appointment.get("visit_type", "Khám định kỳ")
            notes = appointment.get("clinical_notes")
            note_str = f" (Ghi chú: {notes})" if notes else ""
            if is_en:
                lines.append(f"📅 **Upcoming Appointment**: {sched} | Type: {vtype} | Location: {loc}{note_str}")
            else:
                lines.append(f"📅 **Lịch khám sắp tới**: {sched} | Hình thức: {vtype} | Địa điểm: {loc}{note_str}")
        else:
            if is_en:
                lines.append("📅 **Upcoming Appointment**: No upcoming appointments scheduled.")
            else:
                lines.append("📅 **Lịch khám sắp tới**: Hiện không có lịch khám bệnh nào sắp tới.")

        return "\n".join(lines)

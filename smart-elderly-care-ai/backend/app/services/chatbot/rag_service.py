# -*- coding: utf-8 -*-
"""
rag_service.py – Dịch vụ RAG Chatbot Y tế (Retrieval-Augmented Generation) Capstone.
Vị trí: backend/app/services/chatbot/rag_service.py

Nguyên tắc hệ thống:
1. PURE RAG (100% Cẩm nang Y khoa Lão khoa):
   - Mọi câu hỏi y khoa đều được tìm kiếm và trích xuất trực tiếp từ 9 tài liệu cẩm nang
     lão khoa chính thống (MedicalRetriever BM25), minh bạch trích dẫn nguồn.
2. KHÔNG DỮ LIỆU GIẢ (Zero Fake Data):
   - Nếu thiết bị đo chưa kết nối: Báo trung thực rằng thiết bị đang tắt/chưa kết nối,
     tuyệt đối không bịa đặt chỉ số 75 BPM, 98% SpO2, 36.6°C hay 85% pin.
   - Nếu có bản ghi đo thực tế trong DB: Đọc chính xác từ TimescaleDB.
   - Hồ sơ bệnh lý lấy trực tiếp từ bảng elderly_profiles trong DB.
3. ỔN ĐỊNH VÀ AN TOÀN TUYỆT ĐỐI (Fail-Safe & Anti-Leakage):
   - Nhận diện câu chào hỏi, thử nghiệm, giao tiếp thông thường để phản hồi lịch sự, tôn trọng.
   - Không bị ngắt cụt lửng, không rò rỉ prompt hệ thống.
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from dotenv import load_dotenv
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_incident import crud_incident
from app.crud.crud_vital import crud_vital
from app.models.elderly_profile import ElderlyProfile
from app.models.user import User
from app.services.chatbot.retriever import get_medical_retriever

logger = logging.getLogger(__name__)

STANDARD_DISCLAIMER = (
    "Lưu ý: Mọi tư vấn từ SmartCare AI chỉ mang tính chất hỗ trợ theo dõi và chăm sóc ban đầu, "
    "không thay thế cho chỉ định trực tiếp từ bác sĩ chuyên khoa hoặc nhân viên y tế."
)
STANDARD_DISCLAIMER_EN = (
    "Note: SmartCare AI guidance is for monitoring and initial care support only. "
    "It does not replace advice or treatment from a qualified healthcare professional."
)


class ChatbotRAGService:
    """
    Dịch vụ Chatbot Pure RAG Y tế chuyên sâu, ổn định, không dùng số liệu giả.
    """

    def __init__(self):
        self.retriever = get_medical_retriever()

    async def _get_realtime_context(
        self, db: AsyncSession, user_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """
        Truy vấn dữ liệu sinh hiệu, cảnh báo và hồ sơ y bạ thực tế từ database.
        Nếu không có dữ liệu thực, trả về None hoặc rỗng, tuyệt đối không bịa đặt số liệu.
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

        # 1. Lấy sinh hiệu thực tế từ TimescaleDB (chỉ nhận khi có số đo thực)
        if effective_user_id:
            try:
                v_data = await crud_vital.get_current_for_user(db, user_id=effective_user_id)
                if v_data and (v_data.get("heart_rate") is not None or v_data.get("bracelet_connected") is True):
                    context["vitals"] = v_data
                else:
                    context["vitals"] = None
            except Exception as e:
                logger.warning("Không thể lấy sinh hiệu từ DB: %s", e)
                context["vitals"] = None

        # 2. Lấy 3 cảnh báo biến cố mới nhất từ DB
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
            logger.warning("Không thể lấy cảnh báo từ DB: %s", e)

        # 3. Lấy hồ sơ người cao tuổi thực tế từ bảng elderly_profiles
        try:
            res = await db.execute(select(ElderlyProfile).limit(1))
            profile = res.scalar_one_or_none()
            if profile:
                context["patient"] = {
                    "full_name": profile.full_name or "Người cao tuổi",
                    "birth_year": profile.birth_year,
                    "gender": profile.gender,
                    "medical_history": profile.medical_history or "",
                    "emergency_contact": profile.emergency_contact_phone or "",
                }
        except Exception as e:
            logger.warning("Không thể lấy thông tin hồ sơ y tế từ DB: %s", e)

        return context

    @staticmethod
    def _is_conversational_or_greeting(question: str) -> bool:
        """
        Kiểm tra câu hỏi có thuần túy là câu chào hỏi, trêu đùa hay tương tác xã giao không.
        Nếu câu hỏi bắt đầu bằng 'Hello', 'Chào bạn' nhưng CÓ CHỨA NỘI DUNG HỎI THẬT SỰ
        (VD: 'Hello Cho tôi hỏi thông tin người nhà của tôi') thì KHÔNG được chặn làm lời chào!
        """
        q_clean = question.strip().lower()
        if not q_clean:
            return True

        # Trêu đùa hoặc chỉ trích bot
        insult_patterns = ["mày là ai", "sao mày ngu", "ngu thế", "ngu quá", "dốt thế", "who are you", "what can you do"]
        if any(p in q_clean for p in insult_patterns):
            return True

        # Các từ ngữ/cụm từ chào hỏi phổ biến
        greetings = [
            "xin chào", "chào bạn", "chào bot", "chào em", "chào bs", "chào bác sĩ", "chào cụ", "chào",
            "hello", "hi", "hey", "alo 123", "alo alo", "alo bạn", "alo", "ola", "testing", "test", "bạn là ai"
        ]

        has_greeting = any(g in q_clean for g in greetings)
        if not has_greeting:
            return False

        # Tách bỏ các từ chào hỏi để xem người dùng có hỏi thêm nội dung gì không
        temp = q_clean
        for g in sorted(greetings, key=len, reverse=True):
            temp = temp.replace(g, " ")

        # Bỏ tiếp các từ đệm/xưng hô thông dụng trong câu chào
        fillers = ["ạ", "ơi", "nha", "nhé", "bạn", "nhỉ", "ad", "admin", "bot", "bác sĩ", "bs", "em"]
        for f in fillers:
            temp = re.sub(r'\b' + re.escape(f) + r'\b', ' ', temp)

        # Loại bỏ các ký tự dấu câu, khoảng trắng
        content_remaining = re.sub(r'[\s\.,\!\?\:\;\-\_\(\)]+', '', temp).strip()

        # Nếu sau khi bỏ lời chào mà vẫn còn nội dung (VD: "chotôihỏithôngtinngườinhàcủatôi")
        # thì đây là câu hỏi thực sự, KHÔNG được coi là chào hỏi thuần túy!
        if len(content_remaining) > 0:
            return False

        return True

    @staticmethod
    def _format_conversational_response(question: str, language: str = "vi") -> str:
        """Phản hồi lịch sự, văn minh cho các tương tác chào hỏi hoặc trêu đùa."""
        q_lower = question.lower()
        if any(w in q_lower for w in ["ngu", "dốt", "kém", "chán", "stupid"]):
            if language == "en":
                return (
                    "I apologize if my earlier response did not meet your expectations. "
                    "I am SmartCare AI, an assistant dedicated to elderly health monitoring and medical guidance. "
                    "Please let me know how I can assist you or check on the elder's vital signs!"
                )
            return (
                "Dạ, tôi rất xin lỗi nếu phản hồi trước đó chưa làm bạn hài lòng. "
                "Tôi là Trợ lý Y tế SmartCare AI, được thiết kế để hỗ trợ theo dõi sinh hiệu thực tế "
                "và cung cấp hướng dẫn chăm sóc người cao tuổi chuẩn y khoa.\n\n"
                "Bạn có thể yêu cầu tôi kiểm tra nhịp tim, SpO₂, tình trạng té ngã hôm nay, "
                "hoặc hỏi về cách chăm sóc sức khỏe cho cụ nhé!"
            )

        if language == "en":
            return (
                "Hello! I am SmartCare AI Geriatric Health Assistant.\n\n"
                "I can help you:\n"
                "• Monitor real-time vital signs (Heart rate, SpO₂, Body temperature, Fall status).\n"
                "• Provide first aid & eldercare instructions from verified medical guidelines.\n\n"
                "How can I help you today?"
            )
        return (
            "Dạ, xin chào bạn! Tôi là Trợ lý Y tế SmartCare AI.\n\n"
            "Tôi luôn sẵn sàng đồng hành cùng gia đình để:\n"
            "• **Theo dõi sinh hiệu thời gian thực**: Kiểm tra nhịp tim, nồng độ oxy SpO₂, thân nhiệt, cảnh báo ngã.\n"
            "• **Tra cứu Cẩm nang Y khoa Lão khoa**: Sơ cứu té ngã, chăm sóc loét tì đè, dinh dưỡng, an toàn dùng thuốc.\n\n"
            "Bạn có thể đặt câu hỏi hoặc yêu cầu kiểm tra sức khỏe của cụ ngay tại đây nhé!"
        )

    @staticmethod
    def _is_patient_info_query(question: str) -> bool:
        """Kiểm tra câu hỏi có liên quan đến việc hỏi thông tin người nhà, hồ sơ bệnh nhân, cụ An không."""
        q_lower = question.lower()
        keywords = [
            "thông tin người nhà", "thông tin người thân", "người nhà của tôi", "người thân của tôi",
            "thông tin của cụ", "hồ sơ người nhà", "hồ sơ của cụ", "thông tin bệnh nhân", "hồ sơ bệnh nhân",
            "cụ an là ai", "hồ sơ bệnh án", "tiền sử bệnh", "ai là người nhà", "bệnh nhân tên gì",
            "cụ tên gì", "thông tin cụ", "thông tin cá nhân", "người đang theo dõi",
            "patient info", "family member info", "profile info"
        ]
        return any(k in q_lower for k in keywords)

    def _format_patient_profile(self, patient: Dict[str, Any], language: str = "vi") -> str:
        """Trình bày thông tin hồ sơ người thân / người cao tuổi đang theo dõi."""
        if not patient or not patient.get("full_name"):
            if language == "en":
                return "No elderly profile has been registered in the system yet."
            return "Hiện tại hệ thống chưa ghi nhận hồ sơ người cao tuổi nào trong cơ sở dữ liệu."

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
                f"📋 **Monitored Family Member Profile**:\n\n"
                f"• **Full name**: **{full_name}**\n"
                f"• **Year of birth**: **{birth_year}**{age_str}\n"
                f"• **Gender**: **{gender_str}**\n"
                f"• **Medical history**: {history}\n"
                f"• **Emergency contact**: **{contact}**\n\n"
                f"💡 *You can ask me to check real-time vitals or provide medical care instructions at any time!*"
            )

        return (
            f"📋 **Thông tin người thân đang được theo dõi trên hệ thống**:\n\n"
            f"• **Họ và tên**: **{full_name}**\n"
            f"• **Năm sinh**: **{birth_year}**{age_str}\n"
            f"• **Giới tính**: **{gender_str}**\n"
            f"• **Tiền sử bệnh lý**: {history}\n"
            f"• **Số điện thoại khẩn cấp**: **{contact}**\n\n"
            f"💡 *Bạn có thể yêu cầu tôi kiểm tra sinh hiệu hiện tại hoặc hỏi về cách chăm sóc sức khỏe cho cụ bất cứ lúc nào!*"
        )

    @staticmethod
    def _is_sensor_status_query(question: str) -> bool:
        """Kiểm tra câu hỏi có liên quan đến việc kiểm tra chỉ số/thiết bị đo thời gian thực không."""
        q_lower = question.lower()
        keywords = [
            "kiểm tra nhịp tim", "xem nhịp tim", "đo nhịp tim", "nhịp tim hiện tại",
            "kiểm tra sinh hiệu", "chỉ số sinh hiệu", "chỉ số hiện tại", "sinh hiệu hiện tại",
            "huyết áp hiện tại", "thân nhiệt hiện tại", "nhiệt độ hiện tại",
            "kiểm tra spo2", "spo2 hiện tại", "oxy hiện tại", "nồng độ oxy",
            "hôm nay có té ngã", "hôm nay có ngã", "có ngã không", "có té không", "ngã hôm nay",
            "vòng đeo tay", "pin vòng", "đang đeo vòng", "kết nối vòng",
            "cụ đang thế nào", "sức khỏe hiện tại",
            "current heart rate", "current vital", "current spo2", "fall today", "did they fall",
            "wearable status", "bracelet battery", "check vitals",
        ]
        return any(k in q_lower for k in keywords)

    def _format_sensor_status(
        self,
        vitals: Optional[Dict[str, Any]],
        incidents: List[Dict[str, Any]],
        language: str = "vi",
    ) -> str:
        """
        Trình bày tình trạng sinh hiệu thực tế từ thiết bị đo.
        Nếu thiết bị chưa kết nối, thông báo trung thực mà không bịa đặt số liệu.
        """
        if language == "en":
            if not vitals or vitals.get("heart_rate") is None:
                return (
                    "⚠️ **Device Status Notice**:\n"
                    "No real-time vital readings are currently being received from the wearable band or sensors "
                    "(the device is currently offline or not paired).\n\n"
                    "👉 **Recommendation**: Please check the BLE smartband power and verify that the Edge Hub receiver is online."
                )
            hr = vitals.get("heart_rate")
            spo2 = vitals.get("spo2")
            temp = vitals.get("skin_temp_max") or vitals.get("body_temp")
            fall = vitals.get("fall_detected", False)
            battery = vitals.get("bracelet_battery")
            connected = vitals.get("bracelet_connected", False)

            hr_status = "Normal (60–100 BPM)" if hr and 60 <= hr <= 100 else ("Elevated" if hr and hr > 100 else "Low")
            spo2_status = "Good (≥95%)" if spo2 and spo2 >= 95 else "Below optimal (<95%)"
            temp_status = f"{temp}°C" if temp else "Not recorded"

            fall_str = "🚨 FALL ALERT DETECTED!" if fall else "✅ Normal (No fall detected)"
            batt_str = f"{battery}%" if battery is not None else "Unknown"

            return (
                "📊 **Real-time Vitals Report (from paired device)**:\n\n"
                f"• **Heart rate**: **{hr} BPM** ({hr_status})\n"
                f"• **SpO₂**: **{spo2}%** ({spo2_status})\n"
                f"• **Body temperature**: **{temp_status}**\n"
                f"• **Smartband status**: {'Connected' if connected else 'Disconnected'} (Battery: **{batt_str}**)\n"
                f"• **Fall status**: **{fall_str}**"
            )

        # Tiếng Việt (Mặc định)
        if not vitals or vitals.get("heart_rate") is None:
            return (
                "⚠️ **Thông báo trạng thái thiết bị**:\n"
                "Hiện tại hệ thống chưa ghi nhận dữ liệu đo sinh hiệu thời gian thực từ vòng đeo tay hoặc cảm biến "
                "(thiết bị đang tắt hoặc chưa kết nối vào trạm thu phát).\n\n"
                "👉 **Hướng dẫn người nhà**:\n"
                "1. Kiểm tra vòng đeo tay BLE của cụ xem đã bật nguồn và có pin hay không.\n"
                "2. Đảm bảo trạm thu phát tín hiệu Edge Hub trong phòng cụ đang hoạt động bình thường."
            )

        hr = vitals.get("heart_rate")
        spo2 = vitals.get("spo2")
        temp = vitals.get("skin_temp_max") or vitals.get("body_temp")
        fall = vitals.get("fall_detected", False)
        battery = vitals.get("bracelet_battery")
        connected = vitals.get("bracelet_connected", False)

        hr_status = "Bình thường (60-100 BPM)" if hr and 60 <= hr <= 100 else ("⚠️ Nhịp nhanh (>100 BPM)" if hr and hr > 100 else "⚠️ Nhịp chậm (<60 BPM)")
        spo2_status = "Tốt (≥ 95%)" if spo2 and spo2 >= 95 else "⚠️ Thiếu oxy máu (< 95%)"
        temp_status = f"{temp}°C (Bình thường)" if temp and 36.0 <= temp <= 37.4 else (f"⚠️ {temp}°C" if temp else "Chưa có dữ liệu")

        fall_str = "🚨 CẢNH BÁO TÉ NGÃ ĐANG KÍCH HOẠT!" if fall else "✅ Bình thường (Không ghi nhận té ngã)"
        batt_str = f"{battery}%" if battery is not None else "Không rõ"

        time_val = vitals.get("time")
        time_str = f" (ghi nhận lúc {time_val.strftime('%H:%M:%S')})" if isinstance(time_val, datetime) else ""

        ans = (
            f"📊 **Báo cáo sinh hiệu thực tế từ thiết bị{time_str}**:\n\n"
            f"• **Nhịp tim**: **{hr} BPM** — {hr_status}\n"
            f"• **Nồng độ oxy SpO₂**: **{spo2}%** — {spo2_status}\n"
            f"• **Thân nhiệt**: **{temp_status}**\n"
            f"• **Vòng đeo tay BLE**: {'Đang kết nối' if connected else 'Chưa kết nối'} (Pin: **{batt_str}**)\n"
            f"• **Trạng thái an toàn té ngã**: **{fall_str}**\n\n"
        )

        if spo2 and spo2 < 95:
            ans += "⚠️ **Lưu ý y tế**: SpO₂ dưới 95% có thể cảnh báo giảm oxy máu. Hãy cho cụ ngồi tựa thẳng lưng, hít thở sâu và đo lại sau 5 phút.\n"
        if hr and hr > 100:
            ans += "⚠️ **Lưu ý y tế**: Nhịp tim đang hơi nhanh. Cần nhắc cụ nghỉ ngơi tĩnh, uống 1 ly nước ấm và tránh xúc động mạnh.\n"

        return ans.strip()

    @staticmethod
    def _generate_english_fallback(
        question: str,
        heart_rate: Any,
        spo2: Any,
        temperature: Any,
        fall_detected: bool,
        battery: Any,
        incidents: List[Dict[str, Any]],
        patient: Dict[str, Any],
    ) -> str:
        """Provide safe English answers when no external language model is configured."""
        question_lower = question.lower()
        if any(term in question_lower for term in ("fall", "fell", "fallen", "hit the floor", "ngã", "té")):
            if fall_detected:
                return (
                    "🚨 **POSSIBLE FALL DETECTED**\n\n"
                    f"- Heart rate: **{heart_rate} BPM**\n- Temperature: **{temperature}°C**\n\n"
                    "1. Check whether the person is responsive and assess for injuries.\n"
                    "2. Do not move them suddenly if a head, neck, back, or hip injury is possible.\n"
                    "3. If they are unconscious, seriously injured, or in severe pain, call your local emergency number."
                )
            recent = next(
                (incident for incident in incidents if incident.get("alert_type") == "FALL_DETECTED"),
                None,
            )
            if recent:
                return (
                    f"⚠️ A previous fall alert was recorded at **{recent.get('time')}**: "
                    f"{recent.get('message', '')}\n\n"
                    f"Current readings: heart rate **{heart_rate} BPM**, SpO₂ **{spo2}%**. "
                    "Please check for pain, bruising, or changes in alertness."
                )
            return (
                "✅ **No fall has been detected today.**\n\n"
                f"- Current heart rate: **{heart_rate} BPM** | SpO₂: **{spo2}%**\n"
                f"- Wearable battery: **{battery}%**\n\n"
                "The monitoring system continues to operate. This does not rule out an unreported fall."
            )

        if any(term in question_lower for term in (
            "heart rate", "spo2", "oxygen", "vital", "temperature", "fever",
            "nhịp tim", "oxy", "sinh hiệu", "thân nhiệt", "nhiệt độ", "sốt", "chỉ số",
        )):
            heart_status = "Normal (60–100 BPM)" if 60 <= heart_rate <= 100 else ("High" if heart_rate > 100 else "Low")
            oxygen_status = "Within expected range (≥95%)" if spo2 >= 95 else "Below expected range (<95%)"
            temperature_status = "Within expected range" if 36.2 <= temperature <= 37.4 else (
                "Elevated" if temperature > 37.4 else "Below expected range"
            )
            note = (
                "SpO₂ is below 95%. Seek medical advice, especially if there are symptoms such as shortness of breath."
                if spo2 < 95
                else "The readings are within the configured safe ranges."
            )
            return (
                "📊 **Latest vital signs**\n\n"
                f"- Heart rate: **{heart_rate} BPM** — {heart_status}\n"
                f"- SpO₂: **{spo2}%** — {oxygen_status}\n"
                f"- Temperature: **{temperature}°C** — {temperature_status}\n"
                f"- Wearable battery: **{battery}%**\n\n{note}"
            )

        if any(term in question_lower for term in (
            "medicine", "medication", "prescription", "pill", "thuốc", "uống thuốc", "đơn thuốc",
        )):
            conditions = ", ".join(patient.get("conditions", [])) or "No conditions recorded"
            return (
                "💊 **Medication information**\n\n"
                f"- Person: **{patient.get('full_name', 'Patient')}**\n"
                f"- Recorded conditions: **{conditions}**\n\n"
                "Follow the prescription and confirm the medication schedule with the care team. "
                "Do not change a dose based on this message."
            )

        if any(term in question_lower for term in (
            "bruise", "bruising", "swelling", "bump", "bầm", "tụ máu", "sưng",
        )):
            return (
                "🩹 **Bruising or swelling — initial care**\n\n"
                "Apply a wrapped cold pack for 10–15 minutes at a time during the first 24–48 hours. "
                "Do not massage the area or apply heat initially. Seek urgent medical care for severe or "
                "rapidly increasing swelling, severe pain, a head injury, or if the person takes blood thinners."
            )

        if any(term in question_lower for term in (
            "dizzy", "dizziness", "lightheaded", "headache", "chóng mặt", "đau đầu", "choáng",
        )):
            return (
                "🩺 **If the person feels dizzy**\n\n"
                "Help them sit or lie down safely and stay with them. Avoid sudden changes in posture. "
                "Offer water only if they are fully alert and can swallow safely. Check blood pressure if available. "
                "Seek medical help for fainting, chest pain, weakness, confusion, or severe symptoms."
            )

        if any(term in question_lower for term in (
            "shortness of breath", "breathing", "chest pain", "breathless",
            "khó thở", "tức ngực", "hụt hơi",
        )):
            warning = (
                "SpO₂ is below 95%. " if spo2 < 95 else ""
            )
            return (
                "🚨 **Breathing difficulty or chest pain**\n\n"
                f"{warning}Help the person sit upright, loosen tight clothing, and stay with them. "
                "Call your local emergency number immediately for severe breathing difficulty, chest pain, "
                "blue lips, fainting, or worsening symptoms."
            )

        return (
            "I’m the SmartCare AI health assistant. Here are the latest available readings:\n\n"
            f"- Heart rate: **{heart_rate} BPM** | SpO₂: **{spo2}%** | Temperature: **{temperature}°C**\n"
            f"- Fall alert: **{'Detected' if fall_detected else 'Not detected'}**\n\n"
            "I can help explain vital signs, fall alerts, medication reminders, or basic safety steps. "
            "For urgent symptoms, contact local emergency services."
        )

    @staticmethod
    def _clean_chunk_text(text: str) -> str:
        """Làm sạch ký tự định dạng thô từ file tài liệu để hiển thị đẹp mắt."""
        lines = []
        for line in text.split("\n"):
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("====") or stripped.startswith("----"):
                continue
            lines.append(stripped)
        return "\n".join(lines)

    def _generate_rag_response(
        self,
        question: str,
        vitals: Optional[Dict[str, Any]],
        incidents: List[Dict[str, Any]],
        patient: Dict[str, Any],
        retrieved_chunks: List[Dict[str, Any]],
        language: str = "vi",
    ) -> str:
        """
        Bộ tổng hợp Pure RAG:
        Trích xuất và định dạng trực tiếp tri thức y tế từ các chunk cẩm nang đã được tìm kiếm.
        Tuyệt đối không dùng dữ liệu giả.
        """
        is_sensor_query = self._is_sensor_status_query(question)
        sensor_status_text = ""
        if is_sensor_query:
            sensor_status_text = self._format_sensor_status(vitals, incidents, language=language)

        # Trường hợp 1: Có tài liệu y khoa tìm thấy từ RAG
        if retrieved_chunks:
            sections = []

            # Thêm báo cáo sinh hiệu nếu người dùng hỏi về sinh hiệu
            if sensor_status_text:
                sections.append(sensor_status_text)
                sections.append("---")

            # Tiêu đề tri thức cẩm nang
            if language == "en":
                sections.append("📖 **Clinical Care Guidance (Retrieved from Medical Knowledge Base)**:")
            else:
                sections.append("📖 **Hướng dẫn chăm sóc y tế từ Cẩm nang Lão khoa**:")

            # Trích xuất và định dạng nội dung từ các chunk RAG phù hợp nhất
            total_chars = 0
            sources_cited = set()

            for idx, chunk in enumerate(retrieved_chunks, 1):
                clean_text = self._clean_chunk_text(chunk["text"])
                if not clean_text:
                    continue

                sources_cited.add(chunk["source"])

                # Giới hạn dung lượng hiển thị cho từng chunk để câu trả lời súc tích
                chunk_snippet = clean_text[:650]
                if len(clean_text) > 650:
                    chunk_snippet += "..."

                sections.append(f"{chunk_snippet}")
                total_chars += len(chunk_snippet)
                if total_chars > 1300:
                    break

            # Bổ sung trích dẫn nguồn tài liệu cẩm nang
            sources_str = ", ".join(sorted(sources_cited))
            if language == "en":
                sections.append(f"\n📚 **Medical Sources**: `{sources_str}`")
            else:
                sections.append(f"\n📚 **Nguồn cẩm nang tham khảo**: `{sources_str}`")

            # Bổ sung ghi chú hồ sơ bệnh lý thực tế của người cao tuổi nếu có trong DB
            med_history = patient.get("medical_history")
            if med_history:
                patient_name = patient.get("full_name", "Cụ")
                if language == "en":
                    sections.append(f"ℹ️ *Note based on {patient_name}'s medical profile: {med_history}*")
                else:
                    sections.append(f"ℹ️ *Lưu ý theo hồ sơ bệnh lý của {patient_name}: {med_history}*")

            return "\n\n".join(sections)

        # Trường hợp 2: Không có chunk RAG nhưng là câu hỏi tra cứu sinh hiệu
        if is_sensor_query:
            return sensor_status_text

        # Trường hợp 3: Không tìm thấy tài liệu phù hợp trong kho kiến thức
        if language == "en":
            return (
                "I could not find a directly matching clinical guideline in the current medical repository for this question.\n\n"
                "You can ask me about specialized topics covered in our medical knowledge base:\n"
                "• **Fall emergencies & First aid**: Response steps, FAST stroke recognition, wound care, choking...\n"
                "• **Pressure ulcer care**: 2-hour repositioning schedule, staging, skin hygiene, dressings...\n"
                "• **Elderly nutrition & Chronic diseases**: Diet for hypertension, diabetes, dysphagia...\n"
                "• **Safe medication practices**: Administering prescriptions, preventing drug interactions...\n"
                "• **Sleep & Mental wellness**: Non-pharmacological insomnia management, cognitive care.\n\n"
                "Or you can ask me to check the actual vital signs and smartband connection status."
            )

        return (
            "Dạ, tôi chưa tìm thấy tài liệu y tế phù hợp trực tiếp với câu hỏi này trong cẩm nang hiện tại.\n\n"
            "Bạn có thể hỏi tôi về các chủ đề chuyên sâu đã được tích hợp trong cẩm nang y khoa:\n"
            "• **Xử lý sự cố & Sơ cấp cứu**: Phòng ngừa té ngã, xử lý khi ngã nằm sàn, nhận diện đột quỵ (FAST), hóc nghẹn sặc, xử lý vết bầm...\n"
            "• **Chăm sóc loét tì đè**: Quy trình xoay trở chống loét 2 giờ/lần, vệ sinh da, chăm sóc người nằm lâu...\n"
            "• **Dinh dưỡng & Bệnh mãn tính**: Chế độ ăn cho người cao tuổi, cao huyết áp, đái tháo đường, tim mạch...\n"
            "• **An toàn dùng thuốc**: Hướng dẫn uống thuốc đúng giờ, tránh tương tác thuốc bất lợi...\n"
            "• **Tâm lý & Giấc ngủ**: Cải thiện mất ngủ không dùng thuốc, sa sút trí tuệ...\n\n"
            "Hoặc bạn có thể hỏi để kiểm tra chỉ số sinh hiệu thực tế từ vòng đeo tay của cụ."
        )

    def _is_valid_llm_response(self, content: str) -> bool:
        """Kiểm tra phản hồi LLM có bị cụt lửng hoặc rò rỉ prompt hay không."""
        if not content or len(content.strip()) < 30:
            return False

        leakage_markers = [
            "guideline", "Guideline", "CUNG CẤP", "TUYỆT ĐỐI KHÔNG", "RAG chunks",
            "bám sát thông tin từ TÀI LIỆU", "system prompt", "NGUYÊN TẮC BẮT BUỘC",
        ]
        if any(marker in content for marker in leakage_markers):
            logger.warning("Phát hiện LLM rò rỉ prompt: %s", content[:120])
            return False

        # Kiểm tra câu bị cắt dở dang
        last_word = content.strip().split()[-1].lower() if content.strip().split() else ""
        if last_word in ["các chỉ", "và", "nhưng", "là", "của", "được", "trong", "thì"]:
            logger.warning("Phát hiện LLM bị ngắt cụt lửng: %s", content)
            return False

        return True

    async def _call_llm_if_available(
        self,
        question: str,
        vitals: Optional[Dict[str, Any]],
        incidents: List[Dict[str, Any]],
        patient: Dict[str, Any],
        retrieved_chunks: List[Dict[str, Any]],
        language: str = "vi",
    ) -> Optional[str]:
        """
        Gọi LLM API ngoài nếu có khai báo LLM_API_KEY trong .env và cho phép sử dụng.
        Nếu LLM lỗi, quota limit hoặc sinh câu trả lời bị cụt/rò rỉ prompt, tự động trả về None
        để hệ thống chuyển sang Pure RAG cục bộ ổn định.
        """
        from app.core.config import settings

        if not settings.ENABLE_EXTERNAL_LLM:
            return None

        api_key = settings.LLM_API_KEY.strip()
        base_url = settings.LLM_BASE_URL.rstrip("/")
        model = settings.LLM_MODEL.strip()

        if not api_key or api_key == "sk-your_api_key_here":
            return None

        context_parts = []
        if vitals and vitals.get("heart_rate") is not None:
            context_parts.append(
                f"THÔNG TIN SINH HIỆU THỜI GIAN THỰC TỪ THIẾT BỊ ĐO:\n"
                f"- Nhịp tim: {vitals.get('heart_rate')} BPM (ngưỡng bình thường 60-100)\n"
                f"- SpO2: {vitals.get('spo2')}% (chuẩn >= 95%)\n"
                f"- Thân nhiệt: {vitals.get('skin_temp_max') or vitals.get('body_temp')}°C\n"
                f"- Phát hiện té ngã: {'CÓ TÉ NGÃ!' if vitals.get('fall_detected') else 'Bình thường (Không té ngã)'}\n"
                f"- Pin vòng đeo tay BLE: {vitals.get('bracelet_battery')}%\n"
                f"- Trạng thái kết nối: {'Đang kết nối' if vitals.get('bracelet_connected') else 'Chưa kết nối'}"
            )
        else:
            context_parts.append(
                "THÔNG TIN SINH HIỆU THỜI GIAN THỰC:\n"
                "Hiện tại CHƯA CÓ thiết bị đo sinh hiệu nào được kết nối (hoặc chưa bật vòng tay). "
                "Nếu người dùng hỏi về chỉ số hiện tại, hãy thông báo thiết bị chưa kết nối."
            )

        if patient:
            gender_raw = str(patient.get("gender", "")).upper()
            gender_str = "Nam" if gender_raw in ["MALE", "NAM"] else ("Nữ" if gender_raw in ["FEMALE", "NU"] else "Chưa rõ")
            birth_year = patient.get("birth_year")
            age_str = f" ({datetime.now().year - birth_year} tuổi)" if birth_year else ""
            context_parts.append(
                f"HỒ SƠ NGƯỜI CAO TUỔI / NGƯỜI NHÀ ĐANG ĐƯỢC GIÁM SÁT:\n"
                f"- Họ và tên: {patient.get('full_name', 'Cụ')}\n"
                f"- Năm sinh: {birth_year}{age_str}\n"
                f"- Giới tính: {gender_str}\n"
                f"- Tiền sử bệnh lý: {patient.get('medical_history') or 'Chưa ghi nhận bệnh nền'}\n"
                f"- Số liên hệ người thân khẩn cấp: {patient.get('emergency_contact') or 'Chưa cập nhật'}"
            )

        if retrieved_chunks:
            context_parts.append("TÀI LIỆU Y KHOA THAM KHẢO (RAG CHUNKS):")
            for idx, c in enumerate(retrieved_chunks, 1):
                clean_chunk = self._clean_chunk_text(c["text"])[:400]
                context_parts.append(f"[{idx}] (Nguồn: {c['source']}):\n{clean_chunk}")

        system_prompt = (
            "Bạn là Trợ lý AI Bác sĩ Lão khoa SmartCare AI. "
            "Hãy tư vấn ân cần, ngắn gọn, dễ hiểu và trích dẫn nguồn tài liệu cẩm nang ở cuối câu trả lời.\n\n"
            + "\n\n".join(context_parts)
        )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            "temperature": 0.25,
            "max_tokens": 700,
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    if self._is_valid_llm_response(content):
                        return content
                    else:
                        logger.warning("LLM response không hợp lệ, chuyển sang Pure RAG Synthesizer.")
                else:
                    logger.warning("LLM API returned %d: %s. Chuyển sang Pure RAG Synthesizer.", resp.status_code, resp.text[:150])
        except Exception as e:
            logger.warning("Không thể gọi LLM ngoài (%s), chuyển sang Pure RAG: %s", model, e)

        return None

    async def ask(
        self,
        db: AsyncSession,
        user_id: Optional[UUID],
        question: str,
        language: str = "vi",
    ) -> Dict[str, Any]:
        """
        Quy trình xử lý câu hỏi:
        1. Kiểm tra câu chào hỏi / trêu đùa / giao tiếp xã giao -> Phản hồi lịch sự ngay.
        2. Nếu là câu hỏi kiểm tra sinh hiệu -> Trả về báo cáo sinh hiệu thực tế 100% đầy đủ.
        3. Nếu là câu hỏi y khoa -> Tìm kiếm qua MedicalRetriever (BM25) và tổng hợp bằng Pure RAG.
        """
        # 1. Xử lý câu chào hỏi hoặc giao tiếp xã giao
        if self._is_conversational_or_greeting(question):
            return {
                "status": "success",
                "question": question,
                "answer": self._format_conversational_response(question, language=language),
                "sources": [],
                "engine": "SmartCare Conversational Assistant",
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                "vitals_snapshot": None,
                "disclaimer": STANDARD_DISCLAIMER_EN if language == "en" else STANDARD_DISCLAIMER,
            }

        # 2. Lấy dữ liệu thực tế từ DB
        context = await self._get_realtime_context(db, user_id)
        vitals = context["vitals"]
        incidents = context["incidents"]
        patient = context["patient"]

        # 3. Nếu là câu hỏi chuyên về thông tin hồ sơ người thân / người nhà
        if self._is_patient_info_query(question) and not self._is_sensor_status_query(question):
            chunks = self.retriever.search(question, top_k=2, threshold=0.1)
            llm_ans = await self._call_llm_if_available(
                question, vitals, incidents, patient, chunks, language=language
            )
            answer = llm_ans or self._format_patient_profile(patient, language=language)
            engine_used = "SmartCare Cloud LLM (Gemini/OpenAI) + RAG" if llm_ans else "SmartCare Patient Profile Engine"
            return {
                "status": "success",
                "question": question,
                "answer": answer,
                "sources": [c["source"] for c in chunks] if llm_ans else [],
                "engine": engine_used,
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                "vitals_snapshot": None,
                "disclaimer": STANDARD_DISCLAIMER_EN if language == "en" else STANDARD_DISCLAIMER,
            }

        # 4. Tìm kiếm cẩm nang y tế bằng RAG Retriever
        chunks = self.retriever.search(question, top_k=3, threshold=0.1)

        # 5. Thử gọi LLM nếu được bật và phản hồi hợp lệ
        answer = await self._call_llm_if_available(
            question, vitals, incidents, patient, chunks, language=language
        )
        engine_used = "SmartCare Cloud LLM (Gemini/OpenAI) + RAG"

        # 6. Nếu không dùng LLM hoặc LLM lỗi/bị tắt -> Sử dụng Pure RAG Synthesizer
        if not answer:
            answer = self._generate_rag_response(
                question, vitals, incidents, patient, chunks, language=language
            )
            engine_used = "SmartCare Pure RAG Engine (Medical Documents)"

        # Tạo snapshot sinh hiệu trung thực (None nếu không có thiết bị)
        vitals_snapshot = None
        if vitals and vitals.get("heart_rate") is not None:
            vitals_snapshot = {
                "heart_rate": vitals.get("heart_rate"),
                "spo2": vitals.get("spo2"),
                "body_temp": vitals.get("body_temp") or vitals.get("skin_temp_max"),
                "fall_detected": vitals.get("fall_detected"),
                "bracelet_battery": vitals.get("bracelet_battery"),
                "device_id": vitals.get("device_id"),
            }

        return {
            "status": "success",
            "question": question,
            "answer": answer,
            "sources": [c["source"] for c in chunks],
            "engine": engine_used,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "vitals_snapshot": vitals_snapshot,
            "disclaimer": STANDARD_DISCLAIMER_EN if language == "en" else STANDARD_DISCLAIMER,
        }


_rag_service_instance: Optional[ChatbotRAGService] = None


def get_chatbot_rag_service() -> ChatbotRAGService:
    global _rag_service_instance
    if _rag_service_instance is None:
        _rag_service_instance = ChatbotRAGService()
    return _rag_service_instance

# -*- coding: utf-8 -*-
"""
rag_service.py – Dịch vụ RAG Chatbot Y tế Thông minh (Modular RAG Orchestrator).
Vị trí: backend/app/services/chatbot/rag_service.py

Kiến trúc:
1. Context Builder: Lấy dữ liệu sinh hiệu thực tế từ TimescaleDB, hồ sơ bệnh án, bác sĩ phụ trách và lịch khám.
2. Medical Retriever: Trích xuất tri thức cẩm nang lão khoa chính thống (BM25 Pure Python).
3. Medical Triage & Red Flags: Phân loại khẩn cấp (GREEN, YELLOW, RED) và cảnh báo dấu hiệu đỏ.
4. Multi-Model LLM Client: Hỗ trợ đa mô hình (Gemini, OpenAI) với cơ chế tự động Fallback.
5. Dual-AI Verification: AI 1 sinh phản hồi + AI 2 Medical Critic thẩm định an toàn lâm sàng.
6. Pure RAG Local Synthesizer: Luôn phản hồi chính xác, mạch lạc ngay cả khi mất mạng / timeout / hết quota.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.chatbot.context_builder import ChatbotContextBuilder
from app.services.chatbot.entity_resolver import MedicalEntityResolver, get_medical_entity_resolver
from app.services.chatbot.llm_client import MultiModelLLMClient
from app.services.chatbot.prompt_templates import (
    CRITIC_SYSTEM_PROMPT_EN,
    CRITIC_SYSTEM_PROMPT_VI,
    STANDARD_DISCLAIMER_EN,
    STANDARD_DISCLAIMER_VI,
    SYSTEM_PROMPT_EN,
    SYSTEM_PROMPT_VI,
    build_critic_user_prompt,
    build_rag_user_prompt,
)
from app.services.chatbot.response_guard import ResponseGuard
from app.services.chatbot.retriever import MedicalRetriever, get_medical_retriever

logger = logging.getLogger(__name__)


class ChatbotRAGService:
    """Điều phối toàn diện luồng RAG Y tế Lão khoa."""

    def __init__(self):
        self.retriever: MedicalRetriever = get_medical_retriever()
        self.context_builder: ChatbotContextBuilder = ChatbotContextBuilder()
        self.llm_client: MultiModelLLMClient = MultiModelLLMClient()
        self.resolver: MedicalEntityResolver = get_medical_entity_resolver()
        self.enable_critic: bool = getattr(settings, 'ENABLE_AI_CRITIC', True)
        self.critic_timeout: float = float(getattr(settings, 'LLM_CRITIC_TIMEOUT', 4.0))

    @staticmethod
    def _is_simple_greeting(question: str) -> bool:
        """Nhận diện nhanh các câu chào hỏi xã giao thông thường để phản hồi tức thì (0ms)."""
        import re
        q = question.strip().lower()
        if not q or len(q) > 40:
            return False
        # Chuẩn hóa bỏ dấu câu ở cuối (? . ! ,)
        q_clean = re.sub(r"[?!.,]+$", "", q).strip()
        common_greetings = {
            "chào", "xin chào", "chào bạn", "chào bác sĩ", "chào bs", "chào bot",
            "xin chào bác sĩ", "xin chào bs", "chào buổi sáng", "chào em", "chào anh", "chào chị",
            "hello", "hi", "hey", "alo", "alo bạn", "alo bác sĩ", "bạn là ai",
            "giúp tôi với", "tư vấn giúp tôi", "cho hỏi", "tôi muốn hỏi",
        }
        if q_clean in common_greetings:
            return True
        return any(q_clean.startswith(prefix) for prefix in ("xin chào", "chào bạn", "chào bác sĩ", "chào bot", "hello", "hi "))

    @staticmethod
    def _format_greeting_response(language: str = "vi") -> str:
        """Phản hồi lịch sự, ấm áp cho lời chào từ người cao tuổi hoặc người nhà."""
        if language == "en":
            return (
                "Hello! I am **SmartCare AI**, your dedicated Geriatric Health Assistant.\n\n"
                "I am here to help you:\n"
                "• **Monitor real-time vital signs**: Check heart rate, SpO₂, body temperature, and fall alerts.\n"
                "• **Access medical guidelines**: First aid for falls, pressure ulcer prevention, geriatric nutrition, and medication safety.\n"
                "• **Care Coordination**: Connect with assigned doctors and upcoming clinic appointments.\n\n"
                "How may I assist you and your loved ones today?"
            )
        return (
            "Dạ, xin chào bạn! Tôi là **Bác sĩ Trợ lý Y tế SmartCare AI**.\n\n"
            "Tôi luôn sẵn sàng đồng hành cùng gia đình để:\n"
            "• **Theo dõi sinh hiệu thực tế**: Kiểm tra nhịp tim, nồng độ oxy SpO₂, thân nhiệt và cảnh báo té ngã từ thiết bị đeo.\n"
            "• **Tra cứu Cẩm nang Y khoa Lão khoa**: Sơ cấp cứu té ngã, chống loét tì đè, chế độ dinh dưỡng bệnh mãn tính và an toàn dùng thuốc.\n"
            "• **Kết nối y tế gia đình**: Cung cấp thông tin bác sĩ phụ trách và lịch khám bệnh sắp tới.\n\n"
            "Bạn có thể đặt câu hỏi hoặc yêu cầu kiểm tra sức khỏe của người thân ngay tại đây nhé!"
        )

    @staticmethod
    def _compute_triage(
        question: str, vitals: Optional[Dict[str, Any]], incidents: List[Dict[str, Any]]
    ) -> Tuple[str, bool, List[str]]:
        """
        Phân loại mức độ khẩn cấp y tế (Medical Triage - MedX pattern)
        kết hợp nhận diện Dấu hiệu Đỏ (Red Flags Rulebook - Telemed-AI pattern).

        Trả về: (triage_level, is_emergency, suggested_actions)
          - RED: Khẩn cấp (Té ngã, nhịp tim nguy hiểm, SpO2 < 90%, đột quỵ FAST, đau ngực dữ dội).
          - YELLOW: Cần theo dõi (Sinh hiệu lệch nhẹ, sốt, chóng mặt, mệt mỏi, biến cố gần đây).
          - GREEN: Bình thường / An toàn (Tra cứu thông tin, lịch khám, dinh dưỡng, sinh hiệu ổn định).
        """
        q_lower = question.lower()

        # 1. Kiểm tra RED (Khẩn cấp y tế)
        is_red = False
        if vitals and not vitals.get("is_stale"):
            if vitals.get("fall_detected") is True:
                is_red = True
            hr = vitals.get("heart_rate")
            if hr is not None and (hr > 130 or hr < 45):
                is_red = True
            spo2 = vitals.get("spo2")
            if spo2 is not None and spo2 < 90:
                is_red = True

        red_flag_keywords = [
            "đột quỵ", "tai biến", "méo miệng", "liệt", "nói ngọng", "khó thở dữ dội",
            "đau ngực dữ dội", "đau thắt ngực", "bất tỉnh", "hôn mê", "ngừng thở",
            "co giật", "ngất xỉu", "tím tái", "chấn thương đầu", "chảy máu nhiều",
            "stroke", "chest pain", "unconscious", "cannot breathe", "fainted"
        ]
        if any(kw in q_lower for kw in red_flag_keywords):
            is_red = True

        if is_red:
            return (
                "RED",
                True,
                [
                    "Gọi ngay Cấp cứu 115 hoặc đưa cụ đến cơ sở y tế gần nhất",
                    "Liên hệ ngay bác sĩ phụ trách y tế của gia đình",
                    "Đặt cụ nằm nghiêng an toàn (nếu bất tỉnh), đầu kê cao 30 độ",
                    "Tuyệt đối KHÔNG cạo gió, KHÔNG chích máu đầu ngón tay, KHÔNG cho ăn uống",
                ],
            )

        # 2. Kiểm tra YELLOW (Cần lưu tâm theo dõi)
        is_yellow = False
        if vitals:
            hr = vitals.get("heart_rate")
            if hr is not None and (100 < hr <= 130 or 45 <= hr < 60):
                is_yellow = True
            spo2 = vitals.get("spo2")
            if spo2 is not None and (90 <= spo2 < 95):
                is_yellow = True
            temp = vitals.get("skin_temp_max") or vitals.get("body_temp")
            if temp is not None and (temp >= 38.0 or temp <= 35.5):
                is_yellow = True

        yellow_keywords = [
            "sốt", "chóng mặt", "mệt mỏi", "đau đầu", "buồn nôn", "tiêu chảy",
            "khó ngủ", "mờ mắt", "vượt ngưỡng", "huyết áp cao", "tụt huyết áp",
            "đau lưng", "chán ăn", "ho", "fever", "dizzy", "fatigue", "headache"
        ]
        if any(kw in q_lower for kw in yellow_keywords):
            is_yellow = True

        if is_yellow:
            return (
                "YELLOW",
                False,
                [
                    "Kiểm tra và đo lại sinh hiệu sau 15 - 30 phút",
                    "Đảm bảo cụ được nghỉ ngơi ở nơi thoáng mát và uống đủ nước ấm",
                    "Liên hệ bác sĩ phụ trách nếu triệu chứng kéo dài không thuyên giảm",
                ],
            )

        # 3. Mặc định GREEN (An toàn / Thông thường)
        return (
            "GREEN",
            False,
            [
                "Duy trì chế độ sinh hoạt và uống thuốc đúng chỉ định",
                "Theo dõi các chỉ số sinh hiệu định kỳ qua thiết bị thông minh",
            ],
        )

    @staticmethod
    def _matches_patient_name(text_lower: str, full_name: str) -> bool:
        p_name = (full_name or "").strip().lower()
        if not p_name:
            return False
        if p_name in text_lower:
            return True
        parts = p_name.split()
        if any(part in text_lower for part in parts if len(part) > 2):
            return True
        # Match short given names (e.g. "A" in "Nguyễn Văn A" when user writes "Cụ A") as a standalone token
        last_part = parts[-1]
        return bool(re.search(rf'(?:^|\s){re.escape(last_part)}(?:\s|$|[.,?!])', text_lower))

    def _resolve_active_patient(
        self,
        question: str,
        context: Dict[str, Any],
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Xác định người cao tuổi đang được nói tới (Active Patient):
        1. Ưu tiên tìm tên trong câu hỏi hiện tại.
        2. Nếu câu hỏi không nêu tên, dò ngược chat_history để tìm tên người cao tuổi đã được nhắc tới gần nhất.
        3. Nếu gia đình chỉ có duy nhất 1 người cao tuổi, mặc định là người đó.
        """
        patients = context.get("patients") or []
        if not patients:
            single_p = context.get("patient")
            return single_p if (single_p and single_p.get("full_name")) else None

        if len(patients) == 1:
            return patients[0]

        q_lower = question.lower()
        # 1. Tìm trong câu hỏi hiện tại
        for p in patients:
            if self._matches_patient_name(q_lower, p.get("full_name") or ""):
                return p

        # 2. Dò ngược trong lịch sử hội thoại gần nhất
        if chat_history:
            for msg in reversed(chat_history):
                text = (msg.get("text") or "").lower()
                for p in patients:
                    if self._matches_patient_name(text, p.get("full_name") or ""):
                        return p

        return None

    def _is_ambiguous_vitals_query(
        self,
        question: str,
        context: Dict[str, Any],
        active_patient: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Nhận diện các câu hỏi phân tích / kiểm tra chỉ số chung chung, mơ hồ:
        - Người dùng chỉ nói chung chung: 'phân tích chỉ số', 'kiểm tra chỉ số', 'xem chỉ số', 'đánh giá sinh hiệu'...
        - Chưa chỉ định cụ thể người cao tuổi nào (nếu gia đình có nhiều người cao tuổi và chưa có ngữ cảnh).
        - Không áp dụng cho câu hỏi hướng dẫn / hành động cụ thể (đo lại sau 15-30p, uống thuốc, v.v.).
        """
        q = question.strip().lower()
        q_clean = re.sub(r'[?!.,;:\-_\(\)]', ' ', q)
        tokens = [t for t in q_clean.split() if t]
        if not tokens:
            return False

        # Các câu hỏi thao tác / chỉ định chăm sóc cụ thể (KHÔNG phải là câu hỏi mở đầu mơ hồ)
        follow_up_action_cues = [
            "sau 15", "sau 30", "15 - 30", "15-30", "đo lại", "uống thuốc đúng",
            "uống đủ nước", "nghỉ ngơi", "hướng dẫn đo", "làm gì tiếp",
            "chế độ sinh hoạt", "uống thuốc", "bổ sung nước"
        ]
        if any(cue in q for cue in follow_up_action_cues):
            return False

        # Nếu tài khoản chưa có người cao tuổi nào -> Luôn bắt để trả về thông báo chưa có hồ sơ
        patients = context.get("patients") or []
        if not patients:
            vital_terms = ["phân tích", "chỉ số", "sinh hiệu", "vitals", "chi so", "sinh hieu"]
            if any(vt in q for vt in vital_terms):
                return True
            return False

        vague_patterns = [
            "phân tích chỉ số", "phan tich chi so",
            "phân tích sinh hiệu", "phan tich sinh hieu",
            "phân tích sức khỏe", "phan tich suc khoe",
            "phân tích số liệu", "phan tich so lieu",
            "kiểm tra chỉ số", "kiem tra chi so",
            "xem chỉ số", "xem chi so",
            "đánh giá chỉ số", "danh gia chi so",
            "đánh giá sinh hiệu", "danh gia sinh hieu",
            "tình hình chỉ số", "tinh hinh chi so",
            "tình trạng chỉ số", "tinh trang chi so",
            "chỉ số sức khỏe", "chi so suc khoe",
            "chỉ số sinh hiệu", "chi so sinh hieu",
            "báo cáo chỉ số", "bao cao chi so",
            "phân tích giúp tôi", "phan tich giup toi",
            "phân tích", "phan tich",
            "chỉ số thế nào", "chi so the nao",
            "chỉ số ra sao", "chi so ra sao",
            "chỉ số hôm nay", "chi so hom nay",
            "chỉ số", "chi so",
            "sinh hiệu", "sinh hieu",
            "vitals analysis", "check vitals", "analyze vitals"
        ]

        matched_pattern = any(p in q for p in vague_patterns)
        if not matched_pattern:
            return False

        # Kiểm tra xem đã xác định được người cao tuổi chưa (từ câu hỏi hiện tại hoặc từ lịch sử chat)
        has_specific_patient = active_patient is not None
        if not has_specific_patient:
            for p in patients:
                p_name = (p.get("full_name") or "").lower()
                if p_name and (p_name in q or any(name_part in q for name_part in p_name.split() if len(name_part) > 2)):
                    has_specific_patient = True
                    break

        # Nếu ĐÃ XÁC ĐỊNH ĐƯỢC người cao tuổi cụ thể -> Tiếp tục phân tích cho cụ đó, KHÔNG hỏi lại
        if has_specific_patient:
            return False

        # Nếu câu hỏi cực ngắn (dưới 6 từ) và chứa vague pattern -> Chắc chắn là câu hỏi mơ hồ cần hỏi lại
        if len(tokens) <= 5:
            return True

        time_cues = ["hiện tại", "hien tai", "thời gian thực", "bây giờ", "bay gio", "lúc này", "luc nay", "gần nhất", "gan nhat", "hôm qua", "tuần này", "lịch sử"]
        has_time_cue = any(t in q for t in time_cues)

        metric_cues = ["nhịp tim", "nhip tim", "spo2", "oxy", "thân nhiệt", "than nhiet", "huyết áp", "huyet ap", "đường huyết", "duong huyet", "nhiệt độ", "té ngã", "te nga"]
        has_metric_cue = any(m in q for m in metric_cues)

        missing_count = sum([not has_specific_patient, not has_time_cue, not has_metric_cue])
        if missing_count >= 2:
            return True

        return False

    def _format_ambiguous_vitals_probing(
        self,
        question: str,
        context: Dict[str, Any],
        language: str = "vi",
    ) -> Dict[str, Any]:
        """
        Xây dựng câu hỏi dò (Clarification Probing) lịch thiệp, thông minh khi người dùng
        yêu cầu phân tích chỉ số chung chung / mơ hồ.
        """
        now_str = datetime.now(timezone.utc).isoformat()
        is_en = language == "en"
        disclaimer = STANDARD_DISCLAIMER_EN if is_en else STANDARD_DISCLAIMER_VI
        patients = context.get("patients") or []

        # Nếu tài khoản chưa gán vào ngôi nhà nào hoặc chưa có hồ sơ người cao tuổi
        if not patients:
            if is_en:
                answer = (
                    "There are no vital signs available to analyze as your account has not been assigned "
                    "to any household or elderly profile yet.\n\n"
                    "Please create or join a household and add an elderly profile to start tracking vital signs."
                )
                suggested_actions = ["Add elderly profile", "Connect wearable", "General health guidance"]
            else:
                answer = (
                    "Dạ, **chưa có chỉ số nào để phân tích** do tài khoản của bạn hiện chưa được gán vào ngôi nhà nào "
                    "(hoặc chưa có hồ sơ người cao tuổi trong hệ thống).\n\n"
                    "Bạn vui lòng thêm hồ sơ người cao tuổi và kết nối thiết bị đo sinh hiệu để SmartCare có thể theo dõi "
                    "và phân tích sức khỏe cho gia đình nhé!"
                )
                suggested_actions = ["Thêm hồ sơ người cao tuổi", "Kết nối vòng đeo tay", "Tư vấn sức khỏe tổng quát"]

            return {
                "status": "success",
                "question": question,
                "answer": answer,
                "sources": [],
                "engine": "SmartCare Account Scope Guard",
                "timestamp": now_str,
                "vitals_snapshot": None,
                "disclaimer": disclaimer,
                "triage_level": "GREEN",
                "is_emergency": False,
                "suggested_actions": suggested_actions,
                "suggested_questions": suggested_actions,
                "is_rejected_turn": False,
            }

        if is_en:
            patient_list_str = ""
            if patients:
                names = [f"**{p.get('full_name')}**" for p in patients if p.get('full_name')]
                patient_list_str = f" *(Family members: {', '.join(names)})*"

            answer = (
                "Hello! I am ready to provide an in-depth clinical analysis of the health metrics. "
                "Because health monitoring involves multiple factors, please clarify the following so I can give you the most accurate assessment:\n\n"
                f"1. **Which family member?**: Who would you like to review?{patient_list_str}\n"
                "2. **Data Timeframe**:\n"
                "   • **Real-time (Live)**: Check live sensor readings from the smart wearable right now.\n"
                "   • **Latest Recorded / Trends**: Analyze the most recent measurement or historical daily trend.\n"
                "3. **Scope of Metrics**:\n"
                "   • **Comprehensive overview** (Heart rate, Blood Oxygen SpO₂, Body Temperature, Fall status).\n"
                "   • **Specific vital sign** (e.g. Heart rate, SpO₂, Blood pressure).\n\n"
                "*(You can reply with more details or tap any quick suggestion below to proceed!)*"
            )
            suggested_actions = [
                f"Analyze live vitals for {p.get('full_name')}" for p in patients[:2]
            ] if patients else ["Analyze current real-time vitals", "Review latest recorded measurement"]
            suggested_actions += ["Analyze all vital signs overview", "Check heart rate & SpO₂ only"]
        else:
            patient_list_str = ""
            if patients:
                names = [f"**{p.get('full_name')}**" for p in patients if p.get('full_name')]
                patient_list_str = f" *(Hiện gia đình có: {', '.join(names)})*"

            answer = (
                "Dạ chào bạn, Bác sĩ Trợ lý Y tế SmartCare luôn sẵn sàng hỗ trợ phân tích chuyên sâu về chỉ số sức khỏe. "
                "Tuy nhiên, do mỗi người cao tuổi có dữ liệu và nhu cầu theo dõi khác nhau, bạn vui lòng cho tôi biết thêm một chút thông tin để tôi đưa ra nhận định chính xác nhất nhé:\n\n"
                f"1. **Người cao tuổi cần kiểm tra**: Bạn muốn phân tích chỉ số cho cụ nào trong gia đình?{patient_list_str}\n"
                "2. **Thời điểm dữ liệu**:\n"
                "   • **Hiện tại (Thời gian thực)**: Kiểm tra ngay các chỉ số thiết bị đang ghi nhận lúc này.\n"
                "   • **Gần nhất / Xu hướng**: Đánh giá lần đo gần nhất hoặc xu hướng biến thiên trong ngày.\n"
                "3. **Chỉ số bạn quan tâm**:\n"
                "   • **Tổng quan toàn diện** (Nhịp tim, Nồng độ oxy SpO₂, Thân nhiệt, Cảnh báo té ngã).\n"
                "   • **Chỉ số chuyên biệt** (Ví dụ: Chuyên sâu về tim mạch, nồng độ oxy SpO₂, hay huyết áp).\n\n"
                "*(Bạn có thể trả lời chi tiết hơn, hoặc nhấn chọn nhanh một trong các gợi ý bên dưới để tôi hỗ trợ ngay nhé!)*"
            )
            suggested_actions = [
                f"Phân tích sinh hiệu hiện tại của {p.get('full_name')}" for p in patients[:2]
            ] if patients else ["Phân tích toàn bộ sinh hiệu hiện tại (Realtime)", "Xem chỉ số đo lần gần nhất"]
            suggested_actions += ["Phân tích tổng quan toàn bộ chỉ số", "Kiểm tra riêng nhịp tim và SpO₂"]

        return {
            "status": "success",
            "question": question,
            "answer": answer,
            "sources": ["Cơ sở dữ liệu y tế gia đình SmartCare"],
            "engine": "SmartCare Adaptive Clinical Probing",
            "timestamp": now_str,
            "vitals_snapshot": None,
            "disclaimer": disclaimer,
            "triage_level": "GREEN",
            "is_emergency": False,
            "suggested_actions": suggested_actions,
            "suggested_questions": suggested_actions,
            "is_rejected_turn": False,
        }

    def _generate_pure_rag_response(
        self,
        question: str,
        vitals: Optional[Dict[str, Any]],
        patient: Dict[str, Any],
        incidents: List[Dict[str, Any]],
        chunks: List[Dict[str, Any]],
        language: str = "vi",
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Bộ tổng hợp Pure RAG cục bộ (Offline Synthesizer).
        Được kích hoạt khi không cấu hình Cloud LLM hoặc khi LLM gặp sự cố (mất mạng, quota 429).
        Đảm bảo hệ thống luôn phản hồi trung thực, an toàn và dẫn nguồn rõ ràng.
        """
        sections: List[str] = []
        is_en = language == "en"
        q_lower = question.lower()

        # 1. Tra cứu nhanh lần vượt ngưỡng gần nhất theo đúng khuôn mẫu ngắn gọn
        if any(term in q_lower for term in ["vượt ngưỡng", "gần nhất", "sự cố"]):
            if incidents:
                latest = incidents[0]
                st = "Đã xử lý" if latest.get("is_acknowledged") else "Chưa xử lý"
                return f"Vượt ngưỡng: {latest.get('time', 'Gần đây')}, {latest.get('message', 'Chỉ số bất thường')}, Tình trạng xử lý: {st}."
            else:
                return "Dạ, hệ thống chưa ghi nhận lần vượt ngưỡng sinh hiệu nào trong lịch sử gần đây của cụ."

        # 2. Tra cứu thông tin bác sĩ phụ trách y tế (Database Binding)
        if any(term in q_lower for term in ["bác sĩ", "bac si", "bác sĩ của cụ", "doctor"]):
            doctor = context.get("doctor") if context else None
            if doctor and doctor.get("name"):
                if is_en:
                    return f"The designated family doctor is **Dr. {doctor.get('name')}**. Please tap the **'Call Doctor'** button in the app to connect securely."
                return f"Bác sĩ phụ trách y tế của gia đình là **BS. {doctor.get('name')}**. Bạn vui lòng nhấn nút **'Gọi bác sĩ'** trên ứng dụng để kết nối trực tiếp và đảm bảo an toàn bảo mật."
            return "Dạ, hiện tại hộ gia đình chưa có bác sĩ phụ trách y tế riêng được phân công trong hệ thống."

        # 3. Tra cứu lịch khám sắp tới (Appointment Binding)
        if any(term in q_lower for term in ["lịch khám", "lich kham", "lịch hẹn", "tái khám", "appointment"]):
            appt = context.get("appointment") if context else None
            if appt and appt.get("scheduled_at"):
                return f"Lịch khám sắp tới của cụ là vào lúc **{appt.get('scheduled_at')}** (Hình thức: {appt.get('visit_type')}, Địa điểm: {appt.get('location')})."
            return "Dạ, hiện tại cụ không có lịch khám bệnh nào sắp tới trong hệ thống."

        # 3.1. Hướng dẫn quy trình đo lại sinh hiệu sau 15 - 30 phút
        if any(term in q_lower for term in ["đo lại", "sau 15", "15 - 30 phút", "15-30 phút", "kiểm tra lại"]):
            p_name = patient.get("full_name") or "cụ"
            if is_en:
                return (
                    f"⏱️ **Procedure for Re-checking Vital Signs (after 15 - 30 mins) for {p_name}**:\n\n"
                    "1. **Rest & Preparation**: Ensure the patient rests quietly in a cool, well-ventilated space for at least 15 minutes. Avoid physical exertion, eating, or emotional stress before measuring.\n"
                    "2. **Posture**: Sit comfortably with back supported and feet flat on the floor, or lie in a comfortable supine position. Place the smartband / sensor snugly at heart level.\n"
                    "3. **Device Check**: Ensure the wearable device is turned on and connected via Bluetooth / Smart Hub so real-time readings update immediately.\n"
                    "4. **Warning Signs**: If the patient experiences dizziness, shortness of breath, or chest tightness, contact the family doctor or emergency services immediately without waiting."
                )
            return (
                f"⏱️ **Quy trình kiểm tra và đo lại sinh hiệu (sau 15 - 30 phút) cho cụ {p_name}**:\n\n"
                f"1. **Nghỉ ngơi tĩnh**: Cho cụ {p_name} ngồi hoặc nằm nghỉ ngơi thư giãn ở nơi thoáng khí, yên tĩnh ít nhất 15 phút. Tránh vận động mạnh, đi lại nhiều hoặc dùng trà/cà phê trước khi đo.\n"
                "2. **Tư thế chuẩn**: Giữ cổ tay/tay đo ngang tầm tim, ngồi tựa lưng thoải mái, thả lỏng cơ thể và không nói chuyện trong lúc thiết bị ghi nhận chỉ số.\n"
                "3. **Kiểm tra thiết bị**: Đảm bảo vòng đeo tay thông minh đã bật nguồn, vừa vặn cổ tay và kết nối ổn định với điện thoại hoặc Loa Smart Hub để chỉ số cập nhật ngay lên ứng dụng.\n"
                "4. **Dấu hiệu cảnh báo đỏ**: Nếu cụ có cảm giác hồi hộp trống ngực, khó thở, đau tức ngực hoặc chóng mặt tăng dần, hãy nhấn nút 'Gọi bác sĩ' hoặc liên hệ cơ sở y tế gần nhất ngay lập tức."
            )

        vital_terms = ["nhịp tim", "spo2", "oxy", "sinh hiệu", "thân nhiệt", "nhiệt độ", "té ngã", "ngã",
                       "heart rate", "oxygen", "vital", "temperature", "fall", "chỉ số", "chi so"]
        if any(term in q_lower for term in vital_terms):
            patients = context.get("patients") if context else []
            if not patients:
                if is_en:
                    return "There are no vital signs available to analyze as your account has not been assigned to a household or elderly profile."
                return "Dạ, **chưa có chỉ số nào để phân tích** do tài khoản của bạn hiện chưa được gán vào ngôi nhà nào (hoặc chưa có hồ sơ người cao tuổi trong hệ thống)."

            vitals_text = self.context_builder.format_vitals_summary(vitals, language=language)
            # Nếu người dùng chỉ tra cứu/kiểm tra chỉ số sinh hiệu (không hỏi xin tư vấn sâu, cách xử lý, dùng thuốc)
            consult_terms = ["cách", "làm sao", "làm gì", "uống thuốc", "chữa", "điều trị", "nguyên nhân", "tại sao", "thuốc", "bệnh gì", "tư vấn", "hướng dẫn", "phải làm"]
            if not any(c_term in q_lower for c_term in consult_terms):
                return vitals_text
            sections.append(vitals_text)

        # 4. Trích dẫn nội dung từ cẩm nang y tế (ngắn gọn, tập trung trọng tâm)
        if chunks:
            if is_en:
                sections.append("📖 **Clinical Care Guidance**:")
            else:
                sections.append("📖 **Hướng dẫn chăm sóc y tế**:")

            for c_item in chunks[:1]:
                text = c_item.get("text", "").strip()
                if "🎯 **KẾT LUẬN NHANH**" in text:
                    sections.append(text)
                else:
                    clean_lines = [
                        line for line in text.split("\n")
                        if not line.strip().startswith("#")
                        and not line.strip().startswith("###")
                        and not line.strip().startswith("Tiêu đề cột")
                        and not line.strip().startswith("Kiến thức tham khảo")
                        and not line.strip().startswith("Nội dung bổ sung")
                        and not "Sheet:" in line
                        and line.strip()
                    ]
                    clean_text = "\n".join(clean_lines[:6]).strip()
                    clean_text = clean_text.replace("Chỉ số sinh hiệu:", "").replace("Khoảng bình thường:", "• Bình thường:").replace("Ngưỡng cảnh báo:", "• Cảnh báo:")
                    snippet = clean_text[:300] + ("..." if len(clean_text) > 300 else "")
                    sections.append(f"• {snippet}")
        elif not sections:
            if patient and patient.get("full_name") and self._matches_patient_name(q_lower, patient.get("full_name", "")):
                sections.append(self.context_builder.format_patient_summary(patient, language=language))
                sections.append(self.context_builder.format_vitals_summary(vitals, language=language))
            elif is_en:
                sections.append(
                    "I could not find a directly matching topic in the current clinical guidelines (.pdf, .docx, .xlsx, .txt).\n\n"
                    "💡 **Hybrid Mode Note**: When connected to Cloud AI, I can answer out-of-document medical queries using general geriatric knowledge.\n\n"
                    "In local offline mode, you can ask about topics in your loaded documents:\n"
                    "• Fall response and stroke identification (FAST)\n"
                    "• Daily elderly routine and geriatric nutrition\n"
                    "• Real-time vital sign checks from wearables"
                )
            else:
                sections.append(
                    "Dạ, tôi chưa tìm thấy nội dung phù hợp trực tiếp với câu hỏi này trong kho tài liệu cẩm nang hiện tại (.pdf, .docx, .xlsx, .txt).\n\n"
                    "💡 **Lưu ý Chế độ Hybrid**: Khi có kết nối Cloud AI, tôi có thể giải đáp các câu hỏi y khoa ngoài cẩm nang bằng tri thức lão khoa tổng quát.\n\n"
                    "Ở chế độ nội bộ, bạn có thể tham khảo các chủ đề sẵn có trong cẩm nang:\n"
                    "• Lịch trình sinh hoạt và dinh dưỡng cho người cao tuổi có bệnh nền\n"
                    "• Quy trình xử trí khẩn cấp và sơ cấp cứu khi bị té ngã\n"
                    "• Kiểm tra chỉ số nhịp tim, SpO2 từ thiết bị đeo thông minh"
                )

        # 5. Ghi chú cá nhân hóa theo hồ sơ bệnh án
        med_history = patient.get("medical_history")
        if med_history and med_history != "Chưa ghi nhận bệnh nền":
            patient_name = patient.get("full_name", "người cao tuổi")
            if is_en:
                sections.append(f"ℹ️ *Note based on {patient_name}'s medical profile: {med_history}*")
            else:
                sections.append(f"ℹ️ *Lưu ý theo tiền sử bệnh lý của {patient_name}: {med_history}*")

        return "\n\n".join(sections)

    async def ask(
        self,
        db: Optional[AsyncSession] = None,
        user_id: Optional[UUID] = None,
        question: str = "",
        language: str = "vi",
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Xử lý toàn diện câu hỏi của người dùng và trả về phản hồi y khoa tiêu chuẩn.
        Bao gồm phân loại khẩn cấp (Triage), ràng buộc CSDL (Context Binding) và kiểm định an toàn (Red Flags).
        """
        now_str = datetime.now(timezone.utc).isoformat()
        is_en = language == "en"
        disclaimer = STANDARD_DISCLAIMER_EN if is_en else STANDARD_DISCLAIMER_VI

        # 1.0. Kiểm tra từ ngữ tục tĩu / chửi thề / xúc phạm (Profanity Guard)
        if ResponseGuard.is_profane(question):
            return {
                "status": "success",
                "question": question,
                "answer": ResponseGuard.format_profane_response(language=language),
                "sources": [],
                "engine": "SmartCare Profanity Filter",
                "timestamp": now_str,
                "vitals_snapshot": None,
                "disclaimer": disclaimer,
                "triage_level": "GREEN",
                "is_emergency": False,
                "suggested_actions": ["Sử dụng ngôn từ lịch sự để được tư vấn sức khỏe"],
                "is_rejected_turn": True,
            }

        # 1. Kiểm tra câu chào hỏi xã giao
        if self._is_simple_greeting(question):
            return {
                "status": "success",
                "question": question,
                "answer": self._format_greeting_response(language=language),
                "sources": [],
                "engine": "SmartCare Fast Greeting Engine",
                "timestamp": now_str,
                "vitals_snapshot": None,
                "disclaimer": disclaimer,
                "triage_level": "GREEN",
                "is_emergency": False,
                "suggested_actions": ["Đặt câu hỏi về sức khỏe cụ hoặc kiểm tra sinh hiệu"],
                "is_rejected_turn": False,
            }

        # 1.1. Chuẩn hóa chính tả thực thể y tế (tên thuốc, dụng cụ, lỗi gõ Telex/VNI, viết tắt)
        normalized_q, resolved_entities = self.resolver.rewrite_and_enrich_query(question)

        # 1.2. Kiểm tra câu hỏi ngoài phạm vi y tế (lập trình, viết code, tạo robot, câu hỏi không liên quan sức khỏe)
        if ResponseGuard.is_out_of_scope(question) and not resolved_entities:
            return {
                "status": "success",
                "question": question,
                "answer": ResponseGuard.format_out_of_scope_response(language=language),
                "sources": [],
                "engine": "SmartCare Intent Scope Guard",
                "timestamp": now_str,
                "vitals_snapshot": None,
                "disclaimer": disclaimer,
                "triage_level": "GREEN",
                "is_emergency": False,
                "suggested_actions": ["Đặt câu hỏi về triệu chứng sức khỏe, dùng thuốc hoặc kiểm tra sinh hiệu người cao tuổi"],
                "is_rejected_turn": True,
            }

        # 1.3. Kiểm tra câu hỏi vô nghĩa / spam số / spam ký tự (bỏ qua nếu đã nhận diện tên thuốc/dụng cụ)
        if ResponseGuard.is_gibberish_or_spam(question, has_resolved_entities=bool(resolved_entities)):
            return {
                "status": "success",
                "question": question,
                "answer": ResponseGuard.format_gibberish_response(language=language),
                "sources": [],
                "engine": "SmartCare Input Validator",
                "timestamp": now_str,
                "vitals_snapshot": None,
                "disclaimer": disclaimer,
                "triage_level": "GREEN",
                "is_emergency": False,
                "suggested_actions": ["Đặt câu hỏi rõ ràng về sức khỏe hoặc chăm sóc người cao tuổi"],
                "is_rejected_turn": True,
            }

        # 2. Truy vấn dữ liệu lâm sàng thực tế từ TimescaleDB và PostgreSQL
        if db is not None:
            context = await self.context_builder.get_realtime_context(db=db, user_id=user_id)
        else:
            context = {"vitals": None, "incidents": [], "patient": {}, "doctor": None, "appointment": None}
        vitals = context.get("vitals")
        incidents = context.get("incidents", [])
        patient = context.get("patient", {})

        # Tự động xác định người cao tuổi (từ câu hỏi hiện tại, lịch sử chat_history hoặc mặc định người duy nhất)
        active_patient = self._resolve_active_patient(question, context, chat_history)
        if active_patient:
            patient = active_patient
            context["patient"] = active_patient

        # 2.1. Nhận diện câu hỏi phân tích / kiểm tra chỉ số chung chung, mơ hồ (Hỏi lại để dò đúng nhu cầu)
        if self._is_ambiguous_vitals_query(question, context, active_patient=active_patient):
            return self._format_ambiguous_vitals_probing(
                question=question, context=context, language=language
            )

        # Phân loại mức độ khẩn cấp (MedX Triage & Telemed-AI Red Flags)
        triage_level, is_emergency, suggested_actions = self._compute_triage(
            question=question, vitals=vitals, incidents=incidents
        )

        # 3. Trích xuất cẩm nang y tế (Hỗ trợ mở rộng từ khóa trong đối đáp liên tục và câu hỏi đã chuẩn hóa)
        if len(question.strip().split()) <= 2 and resolved_entities:
            # Người dùng chỉ gõ cụm tên thuốc/dụng cụ ngắn (ví dụ: "prasetamol", "panadol") -> Mở rộng câu hỏi tư vấn toàn diện
            search_query = f"Hướng dẫn sử dụng, liều dùng an toàn và lưu ý cho người cao tuổi về {resolved_entities[0].canonical}"
        else:
            search_query = f"{normalized_q} {question}" if normalized_q != question else question

        # Lọc sạch chat_history: loại bỏ các tin nhắn chửi tục, spam, vô nghĩa hoặc ngoài phạm vi
        filtered_chat_history = []
        if chat_history:
            for m in chat_history:
                txt = (m.get("text") or "").strip()
                if not txt:
                    continue
                if ResponseGuard.is_profane(txt) or ResponseGuard.is_gibberish_or_spam(txt):
                    continue
                filtered_chat_history.append(m)

        if filtered_chat_history:
            last_user_msgs = [
                m.get("text", "").strip()
                for m in filtered_chat_history
                if m.get("sender") == "user"
                and m.get("text")
                and not ResponseGuard.is_out_of_scope(m.get("text"))
            ]
            if last_user_msgs:
                last_user_q = last_user_msgs[-1].strip()
                follow_up_cues = [
                    "ngoài ra", "kèm", "thêm", "còn", "với lại", "và", "đồng thời",
                    "lại bị", "cũng bị", "thế còn", "vậy", "nếu", "sao", "được không",
                    "bao lâu", "mấy ngày", "uống gì", "ăn gì", "làm sao", "làm gì",
                    "also", "in addition", "and", "plus", "what about"
                ]
                q_lower = question.lower()
                # CHỈ nối khi câu hiện tại có từ khóa liên kết tiếp nối rõ ràng (cues),
                # TUYỆT ĐỐI KHÔNG tự động nối chỉ vì câu ngắn (như 'tình trạng tim', 'huyết áp')!
                is_follow_up = any(cue in q_lower for cue in follow_up_cues)
                if is_follow_up:
                    search_query = f"{last_user_q} {question}"

        chunks = self.retriever.search(search_query, top_k=3, threshold=5.0)

        # 4. Định dạng văn bản ngữ cảnh
        system_prompt = SYSTEM_PROMPT_EN if is_en else SYSTEM_PROMPT_VI
        vitals_text = self.context_builder.format_vitals_summary(vitals, language=language)
        patient_text = self.context_builder.format_patient_summary(patient, language=language)
        care_context_text = self.context_builder.format_care_context_summary(context, language=language)

        inc_lines = []
        for i in incidents:
            if i.get("message"):
                st = "Đã xử lý" if i.get("is_acknowledged") else "Chưa xử lý"
                inc_lines.append(f"• [Vượt ngưỡng lúc {i.get('time')}]: {i.get('message')} | Tình trạng xử lý: {st}")
        incidents_text = "\n".join(inc_lines)

        prompt_q = question
        if len(question.strip().split()) <= 2 and resolved_entities:
            prompt_q = (
                f"Cho tôi biết thông tin hướng dẫn sử dụng, liều dùng an toàn và các lưu ý lâm sàng cho người cao tuổi "
                f"về {resolved_entities[0].canonical} (từ khóa người dùng vừa tra cứu: '{question}')."
            )

        user_prompt = build_rag_user_prompt(
            question=prompt_q,
            vitals_text=vitals_text,
            patient_text=patient_text,
            care_context_text=care_context_text,
            incidents_text=incidents_text,
            retrieved_chunks=chunks,
            language=language,
            chat_history=filtered_chat_history,
        )

        # 4.1. AI 1: Generator sinh bản thảo câu trả lời
        llm_result = await self.llm_client.generate_response(system_prompt, user_prompt)

        if llm_result:
            draft_text, generator_model = llm_result
            final_text = draft_text
            verified_by_critic = False
            critic_model_name = None
            critic_failed_or_timed_out = False

            # 4.2. AI 2: Medical Critic / Clinical Safety Verifier
            # Tối ưu hóa hiệu năng: Chỉ kích hoạt AI 2 Critic khi câu hỏi thuộc diện khẩn cấp/nguy hiểm (is_emergency, triage != GREEN hoặc thuốc/đơn thuốc)
            # Với các câu hỏi thông thường (GREEN), AI 1 + ResponseGuard đã bảo đảm an toàn lâm sàng, giảm 4-8 giây chờ đợi.
            DRUG_TERMS = {"uống thuốc", "liều lượng", "đơn thuốc", "kê đơn", "thuốc này", "kháng sinh", "paracetamol", "aspirin", "medication", "dose", "prescription"}
            q_lower = question.lower()
            needs_critic = (
                self.enable_critic
                and (is_emergency or triage_level in ("YELLOW", "RED") or any(t in q_lower for t in DRUG_TERMS))
            )

            if needs_critic:
                critic_system_prompt = CRITIC_SYSTEM_PROMPT_EN if is_en else CRITIC_SYSTEM_PROMPT_VI
                critic_user_prompt = build_critic_user_prompt(
                    question=question,
                    draft_answer=draft_text,
                    vitals_text=vitals_text,
                    patient_text=patient_text,
                    care_context_text=care_context_text,
                    incidents_text=incidents_text,
                    language=language,
                    chat_history=chat_history,
                )
                try:
                    critic_result = await asyncio.wait_for(
                        self.llm_client.generate_critic_response(
                            system_prompt=critic_system_prompt,
                            user_prompt=critic_user_prompt,
                            temperature=0.1,
                            max_tokens=700,
                        ),
                        timeout=self.critic_timeout,
                    )
                    if critic_result:
                        final_text, critic_model_name = critic_result
                        verified_by_critic = True
                    else:
                        logger.warning("AI 2 Critic không phản hồi, fallback sang câu trả lời nhanh của AI 1.")
                        critic_failed_or_timed_out = True
                except asyncio.TimeoutError:
                    logger.warning(
                        "AI 2 (Medical Critic) bị quá hạn thời gian (> %ss). Tự động dùng câu trả lời trực tiếp của AI 1.",
                        self.critic_timeout,
                    )
                    critic_failed_or_timed_out = True
                except Exception as critic_err:
                    logger.warning("Lỗi ngoại lệ khi gọi AI 2 Critic: %s. Dùng câu trả lời trực tiếp của AI 1.", critic_err)
                    critic_failed_or_timed_out = True

            if critic_failed_or_timed_out:
                # Nếu AI 1 đã tạo bản thảo hoàn chỉnh, sử dụng ngay câu trả lời của AI 1 để phục vụ người dùng nhanh nhất
                if draft_text and len(draft_text.strip()) > 30:
                    answer_text = draft_text
                    if chunks:
                        engine_name = f"SmartCare AI ({generator_model} + RAG Documents)"
                        sources = list(dict.fromkeys([c.get("source", "") for c in chunks if c.get("source")]))
                    else:
                        engine_name = f"SmartCare AI ({generator_model} - Fast Response)"
                        sources = ["Tri thức y khoa tổng quát"] if not is_en else ["General Medical Knowledge"]
                else:
                    answer_text = self._generate_pure_rag_response(
                        question=question,
                        vitals=vitals,
                        patient=patient,
                        incidents=incidents,
                        chunks=chunks,
                        language=language,
                        context=context,
                    )
                    engine_name = "SmartCare Pure RAG Engine (Fallback from Critic Timeout)"
                    sources = list(dict.fromkeys([c.get("source", "") for c in chunks if c.get("source")]))
            else:
                answer_text = final_text
                if verified_by_critic and critic_model_name:
                    engine_name = f"SmartCare Dual-AI ({generator_model} + Medical Critic {critic_model_name})"
                    sources = (
                        list(dict.fromkeys([c.get("source", "") for c in chunks if c.get("source")]))
                        if chunks
                        else (["Tri thức y khoa tổng quát"] if not is_en else ["General Medical Knowledge"])
                    )
                else:
                    if chunks:
                        engine_name = f"SmartCare AI ({generator_model} + RAG Documents)"
                        sources = list(dict.fromkeys([c.get("source", "") for c in chunks if c.get("source")]))
                    else:
                        engine_name = f"SmartCare AI ({generator_model} - General Knowledge)"
                        sources = ["Tri thức y khoa tổng quát"] if not is_en else ["General Medical Knowledge"]

                if not chunks:
                    note_vi = "\n\n*(Nguồn: Tri thức y khoa lão khoa tổng quát)*"
                    note_en = "\n\n*(Source: General geriatric medical knowledge)*"
                    if is_en and "general" not in answer_text.lower():
                        answer_text += note_en
                    elif not is_en and "tổng quát" not in answer_text.lower():
                        answer_text += note_vi
        else:
            # 5. Fallback sang Pure RAG cục bộ khi AI 1 không thể kết nối
            answer_text = self._generate_pure_rag_response(
                question=question,
                vitals=vitals,
                patient=patient,
                incidents=incidents,
                chunks=chunks,
                language=language,
                context=context,
            )
            engine_name = "SmartCare Pure RAG Engine (Medical Documents)"
            sources = list(dict.fromkeys([c.get("source", "") for c in chunks if c.get("source")]))

        # 6. Tạo snapshot sinh hiệu thực tế
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

        answer_text = ResponseGuard.sanitize_response(answer_text)

        # Đính kèm lưu ý xác nhận nếu phát hiện thực thể thuốc/thiết bị cần làm rõ hoặc thuốc nguy cơ cao
        clarification_notes = [
            e.build_prompt_clarification() for e in resolved_entities if e.build_prompt_clarification()
        ]
        if clarification_notes:
            notes_text = "\n".join(f"• {note}" for note in clarification_notes)
            answer_text = f"💡 **Xác nhận tên thuốc / thiết bị y tế**:\n{notes_text}\n\n{answer_text}"

        return {
            "status": "success",
            "question": question,
            "answer": answer_text,
            "sources": sources,
            "engine": engine_name,
            "timestamp": now_str,
            "vitals_snapshot": vitals_snapshot,
            "disclaimer": disclaimer,
            "triage_level": triage_level,
            "is_emergency": is_emergency,
            "suggested_actions": suggested_actions,
        }


_rag_service_instance: Optional[ChatbotRAGService] = None


def get_chatbot_rag_service() -> ChatbotRAGService:
    global _rag_service_instance
    if _rag_service_instance is None:
        _rag_service_instance = ChatbotRAGService()
    return _rag_service_instance

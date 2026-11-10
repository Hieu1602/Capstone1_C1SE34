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

        vital_terms = ["nhịp tim", "spo2", "oxy", "sinh hiệu", "thân nhiệt", "nhiệt độ", "té ngã", "ngã",
                       "heart rate", "oxygen", "vital", "temperature", "fall"]
        if any(term in q_lower for term in vital_terms):
            vitals_text = self.context_builder.format_vitals_summary(vitals, language=language)
            sections.append(vitals_text)

        # 4. Trích dẫn nội dung từ cẩm nang y tế
        if chunks:
            if is_en:
                sections.append("📖 **Clinical Care Guidance (Retrieved from Geriatric Knowledge Base)**:")
            else:
                sections.append("📖 **Hướng dẫn chăm sóc y tế từ Cẩm nang Lão khoa**:")

            sources_cited = set()
            for c_item in chunks:
                text = c_item.get("text", "").strip()
                source = c_item.get("source", "Medical Documents")
                sources_cited.add(source)
                if "🎯 **KẾT LUẬN NHANH**" in text:
                    sections.append(text)
                else:
                    clean_lines = [
                        line for line in text.split("\n")
                        if not line.startswith("# ")
                        and not line.startswith("Kiến thức tham khảo")
                        and not line.startswith("Nội dung bổ sung")
                    ]
                    clean_text = "\n".join(clean_lines).strip()
                    snippet = clean_text[:800] + ("..." if len(clean_text) > 800 else "")
                    sections.append(f"• {snippet}")

            sources_str = ", ".join(sorted(sources_cited))
            if is_en:
                sections.append(f"📚 **Sources**: `{sources_str}`")
            else:
                sections.append(f"📚 **Nguồn cẩm nang tham khảo**: `{sources_str}`")
        elif not sections:
            if is_en:
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
            }

        # 2. Truy vấn dữ liệu lâm sàng thực tế từ TimescaleDB và PostgreSQL
        if db is not None:
            context = await self.context_builder.get_realtime_context(db=db, user_id=user_id)
        else:
            context = {"vitals": None, "incidents": [], "patient": {}, "doctor": None, "appointment": None}
        vitals = context.get("vitals")
        incidents = context.get("incidents", [])
        patient = context.get("patient", {})

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

        if chat_history:
            last_user_msgs = [m.get("text", "") for m in chat_history if m.get("sender") == "user" and m.get("text")]
            if last_user_msgs:
                last_user_q = last_user_msgs[-1].strip()
                follow_up_cues = [
                    "ngoài ra", "kèm", "thêm", "còn", "với lại", "và", "đồng thời",
                    "lại bị", "cũng bị", "thế còn", "vậy", "nếu", "sao", "được không",
                    "bao lâu", "mấy ngày", "uống gì", "ăn gì", "làm sao", "làm gì",
                    "also", "in addition", "and", "plus", "what about"
                ]
                q_lower = question.lower()
                is_follow_up = any(cue in q_lower for cue in follow_up_cues) or len(question.split()) <= 4
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
            chat_history=chat_history,
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

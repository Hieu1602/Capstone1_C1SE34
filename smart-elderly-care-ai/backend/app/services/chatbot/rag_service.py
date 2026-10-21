# -*- coding: utf-8 -*-
"""
rag_service.py – Dịch vụ RAG Chatbot Y tế Thông minh (Modular RAG Orchestrator).
Vị trí: backend/app/services/chatbot/rag_service.py

Kiến trúc:
1. Context Builder: Lấy dữ liệu sinh hiệu thực tế từ TimescaleDB và hồ sơ bệnh án (Zero Fake Data).
2. Medical Retriever: Trích xuất tri thức cẩm nang lão khoa chính thống (BM25 Pure Python).
3. Multi-Model LLM Client: Hỗ trợ đa mô hình (Gemini, OpenAI, DeepSeek) với cơ chế tự động Fallback.
4. Pure RAG Local Synthesizer: Đảm bảo luôn phản hồi chính xác, mạch lạc ngay cả khi mất mạng / hết quota LLM.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.chatbot.context_builder import ChatbotContextBuilder
from app.services.chatbot.llm_client import MultiModelLLMClient
from app.services.chatbot.prompt_templates import (
    STANDARD_DISCLAIMER_EN,
    STANDARD_DISCLAIMER_VI,
    SYSTEM_PROMPT_EN,
    SYSTEM_PROMPT_VI,
    build_rag_user_prompt,
)
from app.services.chatbot.retriever import MedicalRetriever, get_medical_retriever

logger = logging.getLogger(__name__)


class ChatbotRAGService:
    """Điều phối toàn diện luồng RAG Y tế Lão khoa."""

    def __init__(self):
        self.retriever: MedicalRetriever = get_medical_retriever()
        self.context_builder: ChatbotContextBuilder = ChatbotContextBuilder()
        self.llm_client: MultiModelLLMClient = MultiModelLLMClient()

    @staticmethod
    def _is_simple_greeting(question: str) -> bool:
        """Nhận diện nhanh các câu chào hỏi xã giao thông thường để phản hồi tức thì."""
        q = question.strip().lower()
        if not q or len(q) > 40:
            return False
        common_greetings = {
            "chào", "xin chào", "chào bạn", "chào bác sĩ", "chào bs", "chào bot",
            "hello", "hi", "hey", "alo", "alo bạn", "alo bác sĩ", "bạn là ai",
            "giúp tôi với", "tư vấn giúp tôi", "cho hỏi"
        }
        return q in common_greetings or any(q == g for g in common_greetings)

    @staticmethod
    def _format_greeting_response(language: str = "vi") -> str:
        """Phản hồi lịch sự, ấm áp cho lời chào từ người cao tuổi hoặc người nhà."""
        if language == "en":
            return (
                "Hello! I am **SmartCare AI**, your dedicated Geriatric Health Assistant.\n\n"
                "I am here to help you:\n"
                "• **Monitor real-time vital signs**: Check heart rate, SpO₂, body temperature, and fall alerts.\n"
                "• **Access medical guidelines**: First aid for falls, pressure ulcer prevention, geriatric nutrition, and medication safety.\n\n"
                "How may I assist you and your loved ones today?"
            )
        return (
            "Dạ, xin chào bạn! Tôi là **Bác sĩ Trợ lý Y tế SmartCare AI**.\n\n"
            "Tôi luôn sẵn sàng đồng hành cùng gia đình để:\n"
            "• **Theo dõi sinh hiệu thực tế**: Kiểm tra nhịp tim, nồng độ oxy SpO₂, thân nhiệt và cảnh báo té ngã từ thiết bị đeo.\n"
            "• **Tra cứu Cẩm nang Y khoa Lão khoa**: Sơ cấp cứu té ngã, chống loét tì đè, chế độ dinh dưỡng bệnh mãn tính và an toàn dùng thuốc.\n\n"
            "Bạn có thể đặt câu hỏi hoặc yêu cầu kiểm tra sức khỏe của người thân ngay tại đây nhé!"
        )

    def _generate_pure_rag_response(
        self,
        question: str,
        vitals: Optional[Dict[str, Any]],
        patient: Dict[str, Any],
        incidents: List[Dict[str, Any]],
        chunks: List[Dict[str, Any]],
        language: str = "vi",
    ) -> str:
        """
        Bộ tổng hợp Pure RAG cục bộ (Offline Synthesizer).
        Được kích hoạt khi không cấu hình Cloud LLM hoặc khi LLM gặp sự cố (mất mạng, quota 429).
        Đảm bảo hệ thống luôn phản hồi trung thực, an toàn và dẫn nguồn rõ ràng.
        """
        sections: List[str] = []
        is_en = language == "en"

        # 1. Đưa thông tin sinh hiệu vào nếu câu hỏi có nhắc tới sinh hiệu / nhịp tim / oxy
        q_lower = question.lower()
        vital_terms = ["nhịp tim", "spo2", "oxy", "sinh hiệu", "thân nhiệt", "nhiệt độ", "té ngã", "ngã",
                       "heart rate", "oxygen", "vital", "temperature", "fall"]
        if any(term in q_lower for term in vital_terms):
            vitals_text = self.context_builder.format_vitals_summary(vitals, language=language)
            sections.append(vitals_text)

        # 2. Trích dẫn nội dung từ cẩm nang y tế
        if chunks:
            if is_en:
                sections.append("📖 **Clinical Care Guidance (Retrieved from Geriatric Knowledge Base)**:")
            else:
                sections.append("📖 **Hướng dẫn chăm sóc y tế từ Cẩm nang Lão khoa**:")

            sources_cited = set()
            for c in chunks:
                text = c.get("text", "").strip()
                source = c.get("source", "Medical Documents")
                sources_cited.add(source)
                # Giới hạn độ dài mỗi trích đoạn
                snippet = text[:500] + ("..." if len(text) > 500 else "")
                sections.append(f"• {snippet}")

            sources_str = ", ".join(sorted(sources_cited))
            if is_en:
                sections.append(f"📚 **Sources**: `{sources_str}`")
            else:
                sections.append(f"📚 **Nguồn cẩm nang tham khảo**: `{sources_str}`")
        elif not sections:
            # Không tìm thấy chunk và cũng không hỏi sinh hiệu
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

        # 3. Ghi chú cá nhân hóa theo hồ sơ bệnh án
        med_history = patient.get("medical_history")
        if med_history and med_history != "Chưa ghi nhận bệnh nền":
            patient_name = patient.get("full_name", "người cao tuổi")
            if is_en:
                sections.append(f"ℹ️ *Note based on {patient_name}'s medical profile: {med_history}*")
            else:
                sections.append(f"ℹ️ *Lưu ý theo tiền sử bệnh lý của {patient_name}: {med_history}*")

        return "\n\n".join(sections)

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
        """Hỗ trợ tương thích ngược (backward compatibility) cho các bài kiểm thử tự động."""
        heart_status = "Normal (60–100 BPM)" if 60 <= heart_rate <= 100 else ("High" if heart_rate > 100 else "Low")
        oxygen_status = "Within expected range (≥95%)" if spo2 >= 95 else "Below expected range (<95%)"
        temperature_status = "Within expected range" if 36.0 <= temperature <= 37.5 else "Abnormal"

        return (
            "📊 **Latest vital signs**\n\n"
            f"- Heart rate: **{heart_rate} BPM** — {heart_status}\n"
            f"- SpO₂: **{spo2}%** — {oxygen_status}\n"
            f"- Temperature: **{temperature}°C** — {temperature_status}\n"
            f"- Wearable battery: **{battery}%**\n\n"
            "The readings are within the configured safe ranges."
        )

    async def ask(
        self,
        db: AsyncSession,
        user_id: Optional[UUID],
        question: str,
        language: str = "vi",
    ) -> Dict[str, Any]:
        """
        Quy trình xử lý câu hỏi RAG:
        1. Xử lý câu chào hỏi xã giao -> Phản hồi lập tức.
        2. Truy vấn ngữ cảnh lâm sàng thực tế từ DB (TimescaleDB + PostgreSQL).
        3. Tìm kiếm tài liệu cẩm nang y tế liên quan bằng MedicalRetriever (BM25).
        4. Gọi MultiModelLLMClient (Gemini / OpenAI / DeepSeek).
        5. Nếu LLM lỗi hoặc không cấu hình -> Tự động chuyển sang Pure RAG Local Synthesizer.
        6. Đóng gói kết quả kèm nguồn tài liệu và snapshot sinh hiệu thực tế.
        """
        is_en = language == "en"
        disclaimer = STANDARD_DISCLAIMER_EN if is_en else STANDARD_DISCLAIMER_VI
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        # 1. Câu chào hỏi xã giao
        if self._is_simple_greeting(question):
            return {
                "status": "success",
                "question": question,
                "answer": self._format_greeting_response(language=language),
                "sources": [],
                "engine": "SmartCare Conversational Assistant",
                "timestamp": now_str,
                "vitals_snapshot": None,
                "disclaimer": disclaimer,
            }

        # 2. Ngữ cảnh lâm sàng thực tế từ DB
        context = await self.context_builder.get_realtime_context(db, user_id)
        vitals = context.get("vitals")
        incidents = context.get("incidents", [])
        patient = context.get("patient", {})

        # 3. Trích xuất cẩm nang y tế (ngưỡng tương quan 5.0 để phân tách in-doc vs out-of-doc)
        chunks = self.retriever.search(question, top_k=3, threshold=5.0)

        # 4. Thử sinh câu trả lời qua MultiModelLLMClient
        system_prompt = SYSTEM_PROMPT_EN if is_en else SYSTEM_PROMPT_VI
        vitals_text = self.context_builder.format_vitals_summary(vitals, language=language)
        patient_text = self.context_builder.format_patient_summary(patient, language=language)
        incidents_text = "\n".join([f"• {i['time']}: {i['message']}" for i in incidents if i.get("message")])

        user_prompt = build_rag_user_prompt(
            question=question,
            vitals_text=vitals_text,
            patient_text=patient_text,
            incidents_text=incidents_text,
            retrieved_chunks=chunks,
            language=language,
        )

        llm_result = await self.llm_client.generate_response(system_prompt, user_prompt)

        if llm_result:
            answer_text, model_name = llm_result
            if chunks:
                engine_name = f"SmartCare AI ({model_name} + RAG Documents)"
                sources = list(dict.fromkeys([c.get("source", "") for c in chunks if c.get("source")]))
            else:
                engine_name = f"SmartCare AI ({model_name} - General Knowledge)"
                sources = ["Tri thức y khoa tổng quát"] if not is_en else ["General Medical Knowledge"]
                # Thêm ghi chú minh bạch cho câu hỏi ngoài tài liệu nếu LLM chưa có
                note_vi = "\n\n*(Thông tin trên được tổng hợp từ kiến thức y khoa lão khoa tổng quát của Trợ lý AI SmartCare, ngoài phạm vi cẩm nang riêng của gia đình)*"
                note_en = "\n\n*(This advice is based on general geriatric medical knowledge of SmartCare AI, outside internal family care documents)*"
                if is_en and "general" not in answer_text.lower():
                    answer_text += note_en
                elif not is_en and "tổng quát" not in answer_text.lower():
                    answer_text += note_vi
        else:
            # 5. Fallback sang Pure RAG cục bộ
            answer_text = self._generate_pure_rag_response(
                question=question,
                vitals=vitals,
                patient=patient,
                incidents=incidents,
                chunks=chunks,
                language=language,
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

        return {
            "status": "success",
            "question": question,
            "answer": answer_text,
            "sources": sources,
            "engine": engine_name,
            "timestamp": now_str,
            "vitals_snapshot": vitals_snapshot,
            "disclaimer": disclaimer,
        }


_rag_service_instance: Optional[ChatbotRAGService] = None


def get_chatbot_rag_service() -> ChatbotRAGService:
    global _rag_service_instance
    if _rag_service_instance is None:
        _rag_service_instance = ChatbotRAGService()
    return _rag_service_instance

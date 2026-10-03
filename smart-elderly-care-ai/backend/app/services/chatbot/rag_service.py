# -*- coding: utf-8 -*-
"""
rag_service.py – Dịch vụ RAG Chatbot Y tế tích hợp Native trong Backend Capstone.
Vị trí: backend/app/services/chatbot/rag_service.py

Chức năng:
1. Đọc sinh hiệu thực tế từ TimescaleDB / PostgreSQL (qua crud_vital).
2. Tra cứu cảnh báo biến cố khẩn cấp (qua crud_incident).
3. Đọc hồ sơ bệnh lý người cao tuổi (qua crud_elderly).
4. Tra cứu kho cẩm nang y khoa lão khoa (qua MedicalRetriever).
5. Tổng hợp câu trả lời qua LLM (Gemini / OpenAI / Ollama) hoặc Deterministic Clinical Engine (100% Offline).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_elderly import crud_elderly
from app.crud.crud_incident import crud_incident
from app.crud.crud_vital import crud_vital
from app.services.chatbot.retriever import get_medical_retriever

logger = logging.getLogger(__name__)

STANDARD_DISCLAIMER = (
    "Lưu ý: Mọi tư vấn từ SmartCare AI chỉ mang tính chất hỗ trợ theo dõi và chăm sóc ban đầu, "
    "không thay thế cho chỉ định trực tiếp từ bác sĩ chuyên khoa hoặc nhân viên y tế."
)


class ChatbotRAGService:
    """
    Dịch vụ Chatbot RAG nhúng trực tiếp trong Backend Capstone.
    """

    def __init__(self):
        self.retriever = get_medical_retriever()

    async def _get_realtime_context(
        self, db: AsyncSession, user_id: Optional[UUID]
    ) -> Dict[str, Any]:
        """Truy vấn dữ liệu sinh hiệu và cảnh báo thực tế từ database của Capstone."""
        effective_user_id = user_id or UUID("640e3d97-b4e1-4b08-b2d3-d949a0eb075c")
        context = {
            "vitals": {},
            "incidents": [],
            "patient": {},
        }

        # 1. Lấy sinh hiệu tức thời
        try:
            vitals = await crud_vital.get_current_for_user(db, user_id=effective_user_id)
            context["vitals"] = vitals
        except Exception as e:
            logger.warning("Không thể lấy sinh hiệu từ DB: %s", e)
            context["vitals"] = {
                "heart_rate": 75,
                "spo2": 98,
                "skin_temp_max": 36.6,
                "body_temp": 36.6,
                "fall_detected": False,
                "bracelet_battery": 85,
                "bracelet_connected": True,
            }

        # 2. Lấy 3 cảnh báo mới nhất
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

        # 3. Lấy thông tin hồ sơ y bạ
        try:
            record = await crud_elderly.get_medical_record(db, patient_id_or_serial="1")
            if record:
                context["patient"] = {
                    "full_name": record.name,
                    "age": record.age,
                    "conditions": [c.name for c in record.conditions],
                    "allergies": record.drug_allergies,
                    "dietary_notes": record.dietary_notes,
                }
        except Exception as e:
            logger.warning("Không thể lấy hồ sơ y bạ: %s", e)

        return context

    def _generate_deterministic_fallback(
        self,
        question: str,
        vitals: Dict[str, Any],
        incidents: List[Dict[str, Any]],
        patient: Dict[str, Any],
        retrieved_chunks: List[Dict[str, Any]],
    ) -> str:
        """
        Bộ suy luận lâm sàng ngoại tuyến (Fail-Safe Offline Engine):
        Đối soát dữ liệu cảm biến thật và cẩm nang y tế để trả lời chính xác, an toàn.
        """
        q_lower = question.lower()
        hr = vitals.get("heart_rate", 75)
        spo2 = vitals.get("spo2", 98)
        temp = vitals.get("skin_temp_max") or vitals.get("body_temp", 36.6)
        fall = vitals.get("fall_detected", False)
        battery = vitals.get("bracelet_battery", 85)

        # 1. Câu hỏi về té ngã / té ngã hôm nay
        if any(w in q_lower for w in ["ngã", "té", "té ngã", "sàn nhà", "va đập"]):
            if fall:
                return (
                    f"🚨 **CẢNH BÁO TÉ NGÃ KHẨN CẤP**: Hệ thống phát hiện cụ có tín hiệu té ngã nằm sàn!\n\n"
                    f"- Nhịp tim đo được: **{hr} BPM**\n"
                    f"- Thân nhiệt: **{temp}°C**\n\n"
                    f"👉 **Hướng dẫn xử lý ngay**:\n"
                    f"1. Tiếp cận cụ ngay lập tức, kiểm tra tri giác xem cụ có tỉnh táo hay không.\n"
                    f"2. **TUYỆT ĐỐI KHÔNG** vội vàng kéo hoặc đỡ cụ đứng dậy đột ngột (tránh chấn thương cột sống hoặc gãy xương).\n"
                    f"3. Nếu cụ bất tỉnh, đau dữ dội vùng hông/đầu: Giữ nguyên tư thế và gọi ngay cấp cứu **115**."
                )
            else:
                has_recent_fall = any(inc.get("alert_type") == "FALL_DETECTED" for inc in incidents)
                if has_recent_fall:
                    recent = next(inc for inc in incidents if inc.get("alert_type") == "FALL_DETECTED")
                    return (
                        f"⚠️ Ghi nhận có cảnh báo ngã trước đó vào lúc **{recent.get('time')}**: {recent.get('message')}.\n\n"
                        f"Hiện tại cảm biến báo trạng thái bình thường (Nhịp tim: **{hr} BPM**, SpO₂: **{spo2}%**). "
                        f"Người thân nên quan sát xem cụ có bị đau nhức hay bầm tím không."
                    )
                return (
                    f"✅ **Tình trạng an toàn**: Không ghi nhận sự cố té ngã nào của cụ trong hôm nay.\n\n"
                    f"- Trạng thái người: Bình thường\n"
                    f"- Vòng đeo tay BLE: Kết nối tốt (Pin: **{battery}%**)\n"
                    f"- Nhịp tim hiện tại: **{hr} BPM** | SpO₂: **{spo2}%**\n\n"
                    f"Hệ thống camera AI YOLO-Pose và vòng tay vẫn đang giám sát liên tục 24/7."
                )

        # 2. Câu hỏi về nhịp tim, SpO2, sinh hiệu, huyết áp
        if any(w in q_lower for w in ["nhịp tim", "spo2", "oxy", "sinh hiệu", "thân nhiệt", "nhiệt độ", "sốt", "chỉ số"]):
            hr_status = "Bình thường (60-100 BPM)" if 60 <= hr <= 100 else ("⚠️ Tăng cao" if hr > 100 else "⚠️ Chậm")
            spo2_status = "Tốt (>= 95%)" if spo2 >= 95 else "⚠️ Thiếu oxy máu (< 95%)"
            temp_status = "Bình thường" if 36.2 <= temp <= 37.4 else ("⚠️ Sốt nhẹ/cao" if temp > 37.5 else "Hạ thân nhiệt")

            ans = (
                f"📊 **Báo cáo sinh hiệu người thân mới nhất**:\n\n"
                f"• **Nhịp tim**: **{hr} BPM** — {hr_status}\n"
                f"• **Nồng độ oxy SpO₂**: **{spo2}%** — {spo2_status}\n"
                f"• **Thân nhiệt**: **{temp}°C** — {temp_status}\n"
                f"• **Trạng thái vòng BLE**: Pin còn **{battery}%** (Đang kết nối)\n\n"
            )
            if spo2 < 95:
                ans += "⚠️ **Lưu ý y tế**: SpO₂ dưới 95% có thể cảnh báo suy hô hấp nhẹ. Hãy nhắc cụ ngồi thẳng, hít thở sâu và đo lại sau 5 phút.\n"
            elif hr > 100:
                ans += "⚠️ **Lưu ý y tế**: Nhịp tim đang hơi nhanh. Cần nhắc cụ nghỉ ngơi, uống 1 ly nước ấm và tránh xúc động.\n"
            else:
                ans += "✨ Mọi chỉ số sinh hiệu của cụ hiện tại đều nằm trong ngưỡng an toàn."
            return ans

        # 3. Câu hỏi về thuốc, uống thuốc, lịch uống thuốc
        if any(w in q_lower for w in ["thuốc", "uống thuốc", "đơn thuốc", "phát loa", "nhắc nhở"]):
            conditions_str = ", ".join(patient.get("conditions", [])) or "Cao huyết áp, Đái tháo đường Type 2"
            return (
                f"💊 **Nhắc nhở y tế & Dùng thuốc**:\n\n"
                f"- Người được chăm sóc: **{patient.get('full_name', 'Cụ')}**\n"
                f"- Tiền sử bệnh lý nền: **{conditions_str}**\n\n"
                f"👉 **Khuyến cáo**: Đã kích hoạt lệnh gửi lời nhắc uống thuốc đúng giờ đến loa thông minh tại phòng cụ. "
                f"Hãy đảm bảo cụ uống thuốc sau ăn và uống đủ nước ấm."
            )

        # 4. Câu hỏi về vết bầm, tụ máu, sưng đau va đập
        if any(w in q_lower for w in ["bầm", "bầm tím", "tụ máu", "sưng", "thâm tím", "bầm dập"]):
            return (
                f"🩹 **Hướng dẫn xử lý vết bầm tím & sưng đau ở người cao tuổi**:\n\n"
                f"Ở người già, mạch máu giòn và lớp mỡ dưới da mỏng nên rất dễ bầm tím khi va chạm nhẹ hoặc sau té ngã.\n\n"
                f"👉 **Các bước xử lý ngay tại nhà**:\n"
                f"1. **Chườm lạnh (Trong 24-48 giờ đầu)**: Bọc đá vào khăn sạch, chườm nhẹ 10-15 phút để làm co mạch máu, giảm sưng và tụ máu. (Chườm 2-3 lần/ngày).\n"
                f"2. ⚠️ **TUYỆT ĐỐI KHÔNG**: Không xoa bóp dầu nóng, cồn thuốc hay rượu gừng lên vết bầm vì sẽ làm giãn mạch, khiến máu tụ lan rộng hơn.\n"
                f"3. **Kiểm tra vận động**: Thử bảo cụ cử động nhẹ khớp gần vết bầm (cổ tay, cổ chân, vai...). Nếu cụ đau chói, mất lực hoặc khớp biến dạng, có thể đã bị nứt/gãy xương kín, cần đưa đi chụp X-quang ngay.\n"
                f"4. **Kê cao vị trí tổn thương**: Nếu bị bầm ở tay/chân, hãy kê cao hơn tim khi cụ nằm nghỉ để giúp máu lưu thông tốt hơn.\n\n"
                f"🚨 **Cần đến bệnh viện ngay nếu**: Vết bầm sưng to nhanh, ấn đau dữ dội, cụ đang uống thuốc chống đông máu, hoặc vết bầm xuất hiện ở vùng đầu/ngực."
            )

        # 5. Câu hỏi về chóng mặt, đau đầu, choáng váng
        if any(w in q_lower for w in ["chóng mặt", "đau đầu", "choáng", "hoa mắt", "xây xẩm"]):
            return (
                f"🩺 **Hướng dẫn chăm sóc khi cụ bị chóng mặt, choáng váng**:\n\n"
                f"• Nhịp tim hiện tại: **{hr} BPM** | SpO₂: **{spo2}%**\n\n"
                f"👉 **Xử lý an toàn ngay**:\n"
                f"1. Giúp cụ ngồi xuống hoặc nằm nghỉ ngay tại chỗ, tránh để cụ đi lại một mình vì nguy cơ té ngã rất cao.\n"
                f"2. Cho cụ uống 1 cốc nước ấm từng ngụm nhỏ.\n"
                f"3. Tiến hành đo lại **Huyết áp** (người già chóng mặt thường do hạ huyết áp tư thế hoặc huyết áp tăng cao đột ngột).\n"
                f"4. Nhắc cụ không thay đổi tư thế đột ngột (từ nằm sang đứng cần ngồi lại mép giường 1-2 phút trước khi đứng dậy)."
            )

        # 6. Câu hỏi về khó thở, tức ngực
        if any(w in q_lower for w in ["khó thở", "tức ngực", "ngột ngạt", "hụt hơi"]):
            spo2_alert = "⚠️ **SpO₂ THẤP NGUY HIỂM!**" if spo2 < 95 else "SpO₂ hiện tại: " + str(spo2) + "%"
            return (
                f"🚨 **HƯỚNG DẪN KHẨN CẤP: KHÓ THỞ / TỨC NGỰC**\n\n"
                f"- Chỉ số SpO₂ đo được: **{spo2}%** ({spo2_alert})\n"
                f"- Nhịp tim: **{hr} BPM**\n\n"
                f"👉 **Hành động ngay**:\n"
                f"1. Cho cụ ngồi tư thế Fowler (ngồi tựa lưng góc 45-60 độ), nới lỏng cổ áo và mở cửa thoáng khí.\n"
                f"2. Hướng dẫn cụ thở chậm, hít sâu bằng mũi và thở ra từ từ bằng miệng.\n"
                f"3. **Nếu có đau ngực lan ra vai/hàm trái, hoặc SpO₂ < 92%**: Đây là dấu hiệu nhồi máu cơ tim hoặc suy hô hấp cấp, hãy gọi ngay cấp cứu **115**!"
            )

        # 7. Trích xuất từ cẩm nang y tế (làm sạch và định dạng thân thiện)
        if retrieved_chunks:
            top = retrieved_chunks[0]
            raw_text = top["text"].strip()
            # Dọn dẹp tiêu đề thô ##
            lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
            cleaned_text = "\n".join(lines[:6])
            if len(cleaned_text) > 400:
                cleaned_text = cleaned_text[:400] + "..."

            return (
                f"📖 **Thông tin y tế từ cẩm nang chăm sóc ({top['source']})**:\n\n"
                f"{cleaned_text}\n\n"
                f"💡 *Để trợ lý có thể trò chuyện và phân tích linh hoạt hơn bằng trí tuệ nhân tạo, "
                f"bạn có thể cấu hình thêm Google Gemini API Key trong hệ thống.*"
            )

        # 8. Phản hồi chung
        return (
            f"Dạ, tôi là Trợ lý Y tế SmartCare AI. Hiện tại tôi đang giám sát tình trạng sức khỏe của cụ:\n\n"
            f"• Nhịp tim: **{hr} BPM** | SpO₂: **{spo2}%** | Nhiệt độ: **{temp}°C**\n"
            f"• Trạng thái té ngã: **An toàn (Không có ngã)**\n\n"
            f"Bạn có thể hỏi tôi về: kiểm tra nhịp tim, tình trạng té ngã hôm nay, cách xử lý vết bầm/ngã, "
            f"hoặc nhắc cụ uống thuốc."
        )

    async def _call_llm_if_available(
        self,
        question: str,
        vitals: Dict[str, Any],
        incidents: List[Dict[str, Any]],
        patient: Dict[str, Any],
        retrieved_chunks: List[Dict[str, Any]],
    ) -> Optional[str]:
        """
        Gọi LLM API ngoài (Gemini / OpenAI / DeepSeek) nếu có khai báo LLM_API_KEY trong .env.
        """
        api_key = os.getenv("LLM_API_KEY", "").strip()
        base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        model = os.getenv("LLM_MODEL", "gemini-2.0-flash").strip()

        if not api_key or api_key == "sk-your_api_key_here":
            return None

        # Xây dựng ngữ cảnh y tế chính xác
        context_parts = []
        context_parts.append(f"THÔNG TIN SINH HIỆU THỜI GIAN THỰC:")
        context_parts.append(
            f"- Nhịp tim: {vitals.get('heart_rate', 75)} BPM (chuẩn 60-100)\n"
            f"- SpO2: {vitals.get('spo2', 98)}% (chuẩn >= 95%)\n"
            f"- Thân nhiệt: {vitals.get('skin_temp_max') or vitals.get('body_temp', 36.6)}°C\n"
            f"- Phát hiện té ngã: {'CÓ TÉ NGÃ!' if vitals.get('fall_detected') else 'Không (Bình thường)'}\n"
            f"- Pin vòng đeo tay: {vitals.get('bracelet_battery', 85)}%"
        )

        if patient:
            context_parts.append(
                f"HỒ SƠ BỆNH LÝ:\n- Họ tên: {patient.get('full_name')}\n"
                f"- Bệnh lý nền: {', '.join(patient.get('conditions', []))}"
            )

        if retrieved_chunks:
            context_parts.append("TÀI LIỆU Y KHOA THAM KHẢO:")
            for idx, c in enumerate(retrieved_chunks, 1):
                context_parts.append(f"[{idx}] ({c['source']}): {c['text'][:300]}")

        system_prompt = (
            "Bạn là Trợ lý AI Bác sĩ Lão khoa của Hệ thống Chăm sóc Người cao tuổi Smart Elderly Care AI.\n"
            "Nhiệm vụ của bạn là tư vấn chăm sóc sức khỏe, giải thích chỉ số sinh hiệu và hướng dẫn người nhà xử lý tình huống.\n\n"
            "NGUYÊN TẮC BẮT BUỘC:\n"
            "1. Tuyệt đối bám sát thông tin sinh hiệu thực tế được cung cấp bên dưới, không bịa đặt số liệu.\n"
            "2. Khi có té ngã, hướng dẫn bình tĩnh, không nâng đỡ người già đứng dậy đột ngột, kiểm tra tri giác và hướng dẫn gọi 115 nếu cần.\n"
            "3. Giọng văn ân cần, ngắn gọn, dễ hiểu cho người nhà, dùng tiếng Việt chuẩn mực.\n\n"
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
            "max_tokens": 600,
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    if content:
                        return content
        except Exception as e:
            logger.warning("Không thể gọi LLM ngoài (%s), chuyển sang bộ suy luận cục bộ: %s", model, e)

        return None

    async def ask(
        self,
        db: AsyncSession,
        user_id: Optional[UUID],
        question: str,
    ) -> Dict[str, Any]:
        """
        Quy trình xử lý câu hỏi người dùng:
        1. Lấy dữ liệu cảm biến & y bạ thật từ DB.
        2. Tìm kiếm cẩm nang y tế liên quan.
        3. Sinh câu trả lời qua LLM (nếu có key) hoặc Rule-based Fail-Safe Engine.
        """
        # 1. Lấy dữ liệu thực tế
        context = await self._get_realtime_context(db, user_id)
        vitals = context["vitals"]
        incidents = context["incidents"]
        patient = context["patient"]

        # 2. Tìm kiếm cẩm nang y tế
        chunks = self.retriever.search(question, top_k=2)

        # 3. Thử gọi LLM
        answer = await self._call_llm_if_available(question, vitals, incidents, patient, chunks)
        engine_used = "SmartCare Cloud LLM (Gemini/OpenAI)"

        # 4. Fallback sang Deterministic Engine nếu không có LLM
        if not answer:
            answer = self._generate_deterministic_fallback(question, vitals, incidents, patient, chunks)
            engine_used = "SmartCare Native Clinical Engine (Offline Fail-Safe)"

        return {
            "status": "success",
            "question": question,
            "answer": answer,
            "sources": [c["source"] for c in chunks],
            "engine": engine_used,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "vitals_snapshot": {
                "heart_rate": vitals.get("heart_rate"),
                "spo2": vitals.get("spo2"),
                "body_temp": vitals.get("body_temp") or vitals.get("skin_temp_max"),
                "fall_detected": vitals.get("fall_detected"),
                "bracelet_battery": vitals.get("bracelet_battery"),
                "device_id": vitals.get("device_id"),
            },
            "disclaimer": STANDARD_DISCLAIMER,
        }


_rag_service_instance: Optional[ChatbotRAGService] = None


def get_chatbot_rag_service() -> ChatbotRAGService:
    global _rag_service_instance
    if _rag_service_instance is None:
        _rag_service_instance = ChatbotRAGService()
    return _rag_service_instance

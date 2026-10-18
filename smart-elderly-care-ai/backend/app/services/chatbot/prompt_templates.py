# -*- coding: utf-8 -*-
"""
prompt_templates.py – Quản lý System Prompt và Prompt Templates cho RAG Y tế Lão khoa.
Vị trí: backend/app/services/chatbot/prompt_templates.py
"""
from __future__ import annotations

from typing import Any, Dict, List

STANDARD_DISCLAIMER_VI = (
    "Lưu ý y tế: Mọi thông tin từ SmartCare AI chỉ mang tính chất tham khảo và hỗ trợ chăm sóc ban đầu, "
    "không thay thế cho chẩn đoán hoặc chỉ định trực tiếp từ bác sĩ chuyên khoa."
)

STANDARD_DISCLAIMER_EN = (
    "Medical Disclaimer: Guidance provided by SmartCare AI is for monitoring and primary care support only. "
    "It does not substitute for professional medical advice, diagnosis, or clinical treatment."
)

SYSTEM_PROMPT_VI = """Bạn là Bác sĩ Trợ lý Y tế Thông minh (SmartCare AI) – chuyên gia theo dõi và chăm sóc sức khỏe người cao tuổi trong gia đình.

NGUYÊN TẮC HOẠT ĐỘNG BẮT BUỘC:
1. TRUNG THỰC VỚI SỐ LIỆU SINH HIỆU:
   - Bạn chỉ nhận định sức khỏe dựa trên các số liệu sinh hiệu thực tế được cung cấp trong ngữ cảnh.
   - Nếu ngữ cảnh báo rằng thiết bị chưa kết nối hoặc chưa bật, hãy thông báo rõ ràng cho người dùng, tuyệt đối KHÔNG tự suy đoán hay bịa đặt số liệu nhịp tim, SpO2, thân nhiệt.

2. CĂN CỨ VÀO TÀI LIỆU CẨM NANG Y KHOA (RAG):
   - Trả lời dựa trên các đoạn trích dẫn cẩm nang y tế được cung cấp (sơ cứu té ngã, chống loét tì đè, dinh dưỡng lão khoa, bệnh mãn tính, an toàn dùng thuốc).
   - Đưa ra các bước hướng dẫn cụ thể, rõ ràng, dễ thực hiện đối với người nhà và người chăm sóc.

3. DẤU HIỆU CẢNH BÁO NGUY HIỂM (RED FLAGS):
   - Nếu phát hiện SpO2 < 95%, nhịp tim > 120 bpm hoặc < 50 bpm, nghi ngờ té ngã chấn thương, đau tức ngực, khó thở hoặc dấu hiệu đột quỵ (FAST: méo miệng, yếu liệt tay chân, nói khó), phải lập tức hướng dẫn gọi cấp cứu 115 hoặc đưa người cao tuổi đến bệnh viện gần nhất.

4. PHONG CÁCH GIAO TIẾP:
   - Ân cần, lễ phép, đồng cảm, tôn trọng người cao tuổi và gia đình.
   - Trình bày mạch lạc, sử dụng các đầu dòng hoặc số thứ tự, in đậm các điểm then chốt.
   - Trả lời bằng tiếng Việt chuẩn mực.

5. LUÔN KÈM THEO LỜI NHẮC Y TẾ VÀ NGUỒN TÀI LIỆU Ở CUỐI CÂU TRẢ LỜI.
"""

SYSTEM_PROMPT_EN = """You are SmartCare AI – a dedicated Geriatric Health Assistant specializing in elderly care and remote health monitoring.

MANDATORY CLINICAL PRINCIPLES:
1. HONESTY WITH VITAL SIGNS (Zero Fake Data):
   - Only comment on vitals based strictly on real sensor readings provided in the context.
   - If the wearable is disconnected or off, clearly inform the user. Never fabricate vital signs.

2. EVIDENCE-BASED CARE (RAG Medical Guidelines):
   - Base recommendations on the retrieved medical knowledge chunks (fall response, pressure ulcer prevention, elderly nutrition, chronic condition management).
   - Provide clear, actionable, step-by-step instructions.

3. RED FLAGS & EMERGENCY ALERTS:
   - Immediately advise calling emergency services (115/911) or seeking urgent medical care if detecting signs of stroke (FAST), SpO2 < 95%, severe arrhythmias, trauma from falls, or chest pain.

4. TONE & MANNER:
   - Empathetic, respectful, professional, reassuring.
   - Format cleanly with bullet points and bold highlights.
"""


def build_rag_user_prompt(
    question: str,
    vitals_text: str,
    patient_text: str,
    incidents_text: str,
    retrieved_chunks: List[Dict[str, Any]],
    language: str = "vi",
) -> str:
    """Đóng gói toàn bộ ngữ cảnh lâm sàng và tri thức cẩm nang thành prompt hoàn chỉnh gửi tới LLM."""
    chunks_text_list = []
    for idx, c in enumerate(retrieved_chunks, 1):
        source = c.get("source", "Tài liệu y tế")
        text = c.get("text", "").strip()
        chunks_text_list.append(f"--- [Trích dẫn {idx} từ: {source}] ---\n{text}")

    docs_block = (
        "\n\n".join(chunks_text_list)
        if chunks_text_list
        else "Không tìm thấy đoạn trích cẩm nang khớp trực tiếp."
    )

    if language == "en":
        return f"""[CLINICAL CONTEXT]
{patient_text}

[REAL-TIME SENSOR READINGS]
{vitals_text}

[RECENT INCIDENTS & ALERTS]
{incidents_text if incidents_text else 'No recent incidents reported.'}

[RETRIEVED GERIATRIC GUIDELINES (RAG CHUNKS)]
{docs_block}

[USER QUESTION]
"{question}"

Please provide a caring, precise, and medically grounded answer in English following your instructions."""

    return f"""[HỒ SƠ NGƯỜI CAO TUỔI]
{patient_text}

[DỮ LIỆU SINH HIỆU THỜI GIAN THỰC TỪ THIẾT BỊ]
{vitals_text}

[CẢNH BÁO BIẾN CỐ GẦN ĐÂY]
{incidents_text if incidents_text else 'Không ghi nhận biến cố bất thường gần đây.'}

[TRI THỨC TRÍCH XUẤT TỪ CẨM NANG Y KHOA LÃO KHOA (RAG)]
{docs_block}

[CÂU HỎI CỦA NGƯỜI DÙNG]
"{question}"

Hãy trả lời câu hỏi trên bằng tiếng Việt một cách chu đáo, chính xác, dựa trên dữ liệu thực tế và cẩm nang y khoa được cung cấp."""

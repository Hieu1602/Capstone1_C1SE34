# -*- coding: utf-8 -*-
"""
prompt_templates.py – Quản lý System Prompt và Prompt Templates cho RAG Y tế Lão khoa.
Vị trí: backend/app/services/chatbot/prompt_templates.py
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

STANDARD_DISCLAIMER_VI = (
    "Lưu ý y tế: Mọi thông tin từ SmartCare AI chỉ mang tính chất tham khảo và hỗ trợ chăm sóc ban đầu, "
    "không thay thế cho chẩn đoán hoặc chỉ định trực tiếp từ bác sĩ chuyên khoa."
)

STANDARD_DISCLAIMER_EN = (
    "Medical Disclaimer: Guidance provided by SmartCare AI is for monitoring and primary care support only. "
    "It does not substitute for professional medical advice, diagnosis, or clinical treatment."
)

SYSTEM_PROMPT_VI = """Bạn là Bác sĩ Trợ lý Y tế Thông minh (SmartCare AI) – chuyên gia theo dõi và chăm sóc sức khỏe người cao tuổi trong gia đình.
Đối tượng người dùng trò chuyện với bạn là NGƯỜI TRẺ (con cái, cháu, người chăm sóc trong gia đình) đang chăm sóc cho ông bà hoặc cha mẹ già.

QUY TẮC BẮT BUỘC SỐ 1 TỪ NGƯỜI DÙNG:
"TRẢ LỜI ĐÚNG TRỌNG TÂM CÂU HỎI. GIẢI THÍCH CỰC KỲ GỌN, ĐÚNG MỤC TIÊU CÂU HỎI, KHÔNG DÀI DÒNG LAN MAN."
- Người dùng hỏi về vấn đề gì (ví dụ: đau răng, đau mắt, ho sốt, đau lưng, mất ngủ, té ngã, đau dạ dày, táo bón, thuốc men, dinh dưỡng, đói bụng, ăn uống...), BẠN PHẢI TRẢ LỜI TRỰC TIẾP VÀ DUY NHẤT VỀ VẤN ĐỀ ĐÓ.
- TUYỆT ĐỐI KHÔNG tự động nói sang bệnh khác (không tự ý nói về huyết áp, tim mạch hay bệnh khác nếu người dùng không hỏi).
- Dữ liệu sinh tồn từ thiết bị đeo (nếu có kèm trong ngữ cảnh) chỉ là thông tin tham khảo bổ trợ, tuyệt đối KHÔNG để các chỉ số này làm chệch trọng tâm câu hỏi nếu người dùng không hỏi về chúng.
- TUYỆT ĐỐI KHÔNG gạt bỏ hoặc bác bỏ câu hỏi của người dùng (TUYỆT ĐỐI KHÔNG ĐƯỢC nói "Cảm giác đói không phải là ưu tiên lúc này", "Câu hỏi này không quan trọng lúc này..."). Luôn luôn tôn trọng và giải đáp đúng vấn đề người dùng đang hỏi.

CẤU TRÚC 3 PHẦN CHUẨN Y KHOA CHO CÂU HỎI TRIỆU CHỨNG / BỆNH LÝ / CHĂM SÓC:
Mọi câu hỏi về triệu chứng, bệnh tật, dinh dưỡng, chăm sóc hãy trình bày theo 3 phần rõ ràng:
1. 🎯 **KẾT LUẬN NHANH** (1-2 câu ngắn): Trả lời trực diện vào câu hỏi, chỉ rõ nguyên nhân hay gặp ở người già và mức độ nguy cơ.
2. 📋 **HÀNH ĐỘNG CỤ THỂ CHO BẠN (Người trẻ chăm sóc)**: 3-4 gạch đầu dòng thực tế, súc tích (hướng dẫn cụ thể con cháu cần làm gì cho cụ: chăm sóc, tư thế, dinh dưỡng, an toàn thuốc...).
3. 🚨 **CẢNH BÁO ĐỎ (Cần đi viện/gọi 115 ngay)**: 2-3 dấu hiệu báo động nguy hiểm của chính triệu chứng đang hỏi.

CÂU HỎI TRA CỨU NHANH / CÂU HỎI CÓ-KHÔNG / KIỂM TRA 1 CHỈ SỐ / BÁC SĨ / LỊCH KHÁM:
- Trả lời TRỰC DIỆN, NGẮN GỌN trong 1 - 2 câu.
- Nêu ngay kết luận khẳng định/phủ định ngay câu đầu tiên.
- Tuyệt đối KHÔNG chia nhiều mục la liệt, KHÔNG chào hỏi vòng vo dài dòng.

ĐỐI ĐÁP LIÊN TỤC (MULTI-TURN CHAT) & BỔ SUNG TRIỆU CHỨNG:
- Đọc kỹ [LỊCH SỬ ĐỐI ĐÁP LIÊN TỤC TRƯỚC ĐÓ] để hiểu toàn bộ diễn tiến câu chuyện!
- Khi người dùng hỏi tiếp nối hoặc bổ sung triệu chứng (ví dụ câu trước nói "tôi chóng mặt", câu sau nói "ngoài ra, kèm thêm chảy máu mũi" hoặc "bị thêm sốt"):
  BẠN BẮT BUỘC PHẢI TỔNG HỢP TẤT CẢ CÁC TRIỆU CHỨNG ĐÃ NÊU TRƯỚC ĐÓ VÀ TRIỆU CHỨNG MỚI (ở đây là CHÓNG MẶT KÈM THEO CHẢY MÁU MŨI) để:
  1. 🎯 **KẾT LUẬN NHANH**: Đưa ra nhận định tổng hợp ngay (ví dụ: nguy cơ cơn tăng huyết áp kịch phát, rối loạn tuần hoàn mạch máu não kèm xuất huyết niêm mạc).
  2. 📋 **HÀNH ĐỘNG CỤ THỂ**: Hướng dẫn xử lý đồng thời (vừa cho cụ ngồi cúi nhẹ đầu ép cánh mũi cầm máu, vừa giữ yên tĩnh chống té ngã do chóng mặt, đo huyết áp ngay nếu có máy đo).
  3. 🚨 **CẢNH BÁO ĐỎ**: Dấu hiệu nguy cấp tổng hợp (huyết áp kịch phát, chảy máu không cầm, yếu liệt, lú lẫn).
  TUYỆT ĐỐI KHÔNG được trả lời tách rời hay bỏ quên các triệu chứng người dùng vừa chia sẻ ở câu nói ngay trước đó!
- Khi người dùng hỏi về "lần vượt ngưỡng gần nhất" / "sự cố gần nhất", BẮT BUỘC trả lời đúng 1 dòng theo mẫu:
  "Vượt ngưỡng: [giờ/ngày/tháng/năm], [loại chỉ số]: [ngưỡng đo được] (ngưỡng an toàn là [ngưỡng thiết lập]), Tình trạng xử lý: [Đã xử lý / Chưa xử lý]."
- Nếu không có lần vượt ngưỡng nào: Trả lời ngắn gọn: "Dạ, hệ thống chưa ghi nhận lần vượt ngưỡng sinh hiệu nào trong lịch sử gần đây của cụ."

NGUYÊN TẮC AN TOÀN Y TẾ & THUỐC (BR-5):
- BẠN TUYỆT ĐỐI KHÔNG được kê đơn thuốc mới hoặc tự ý thay đổi liều lượng thuốc của bác sĩ.
- Luôn kèm theo lời nhắc y tế tiêu chuẩn ngắn gọn ở cuối phản hồi.

QUY TẮC XỬ LÝ CÂU HỎI NGOÀI PHẠM VI (OUT OF SCOPE):
- Bạn là trợ lý y tế chăm sóc sức khỏe người cao tuổi. Nếu người dùng hỏi các câu hỏi KHÔNG liên quan đến y tế/sức khỏe (ví dụ: lập trình, viết code phần mềm, chế tạo robot, giải toán, chính trị, công nghệ ngoài luồng...), hãy lịch sự giải thích bạn là Trợ lý Y tế SmartCare chuyên về chăm sóc sức khỏe người cao tuổi và từ chối hỗ trợ.

QUY TẮC BẢO MẬT THÔNG TIN CÁ NHÂN & SỐ ĐIỆN THOẠI (PII PRIVACY):
- TUYỆT ĐỐI KHÔNG đưa số điện thoại cụ thể của bất kỳ ai (bác sĩ phụ trách, người thân, bệnh nhân) lên nội dung chat.
- Khi cần hướng dẫn liên hệ bác sĩ hoặc người thân, chỉ hướng dẫn: "Vui lòng nhấn nút 'Gọi bác sĩ' hoặc nút 'SOS' trên ứng dụng", hoặc gọi đường dây nóng cấp cứu công cộng 115.
"""

SYSTEM_PROMPT_EN = """You are SmartCare AI – a dedicated Geriatric Health Assistant specializing in elderly care.
Your users are YOUNG FAMILY CAREGIVERS (adult children, grandchildren) caring for aging parents and grandparents.

MANDATORY GOLDEN RULE:
"ANSWER STRICTLY ON-TOPIC. EXPLAIN ULTRA-CONCISELY, ADDRESS THE EXACT USER QUESTION, NO RAMBLING."
- Whatever the user asks about (e.g. eye blur, toothache, cough, back pain, insomnia, stomachache, constipation, diet...), you MUST answer directly and ONLY about that topic.
- NEVER divert into unrelated conditions (do not bring up cardiovascular or blood pressure if not asked).
- Live wearable vitals in context are supplemental only; do NOT let them derail the topic.

MANDATORY 3-PART CLINICAL STRUCTURE FOR SYMPTOM & CARE QUERIES:
1. 🎯 **QUICK CONCLUSION** (1-2 sentences): Direct answer, common geriatric root cause, risk level.
2. 📋 **ACTIONABLE STEPS FOR YOU (Caregiver)**: 3-4 concise, practical bullet points (what to do right now).
3. 🚨 **RED FLAGS (ER / Call 115/911)**: 2-3 emergency alarm signs specifically for this symptom.

SHORT LOOKUP / YES-NO / DOCTOR / APPOINTMENT QUERIES:
- Direct, concise 1 to 2 sentence answer. State conclusion upfront.

MEDICATION SAFETY (BR-5):
- Never prescribe new medications or alter existing dosages.

PRIVACY & PHONE NUMBER REDACTION:
- NEVER output specific personal phone numbers (doctor or emergency contacts) into chat text.
- Refer users to the in-app "Call Doctor" or "SOS" button, or call the 115/911 ambulance emergency hotline.
"""


def build_rag_user_prompt(
    question: str,
    vitals_text: str,
    patient_text: str,
    care_context_text: str,
    incidents_text: str,
    retrieved_chunks: List[Dict[str, Any]],
    language: str = "vi",
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Đóng gói toàn bộ ngữ cảnh lâm sàng, thông tin chăm sóc và tri thức cẩm nang thành prompt hoàn chỉnh gửi tới LLM."""
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
        history_block = ""
        if chat_history:
            lines = []
            for h in chat_history:
                sender = "User" if h.get("sender") == "user" else "SmartCare AI"
                lines.append(f"{sender}: {h.get('text', '')}")
            if lines:
                history_block = "[RECENT CONVERSATION HISTORY]\n" + "\n".join(lines) + "\n\n"

        return f"""{history_block}[CLINICAL CONTEXT]
{patient_text}

[ASSIGNED DOCTOR & APPOINTMENTS]
{care_context_text}

[REAL-TIME SENSOR READINGS]
{vitals_text}

[RECENT INCIDENTS & ALERTS]
{incidents_text if incidents_text else 'No recent incidents reported.'}

[RETRIEVED GERIATRIC GUIDELINES (RAG CHUNKS)]
{docs_block}

[USER QUESTION]
"{question}"

[INSTRUCTIONS]
1. Answer strictly on-topic. Do NOT digress into unrelated vitals unless asked.
2. If symptom/care inquiry: Use the 3-part layout (🎯 Quick Conclusion, 📋 Actionable Steps, 🚨 Red Flags).
3. If short lookup: direct 1-2 sentence answer."""

    vi_history_block = ""
    if chat_history:
        lines = []
        for h in chat_history:
            sender = "Người dùng" if h.get("sender") == "user" else "Trợ lý AI"
            lines.append(f"{sender}: {h.get('text', '')}")
        if lines:
            vi_history_block = "[LỊCH SỬ ĐỐI ĐÁP LIÊN TỤC TRƯỚC ĐÓ]\n" + "\n".join(lines) + "\n\n"

    user_question_text = f'"{question}"'
    if chat_history:
        last_user_msgs = [m.get("text", "") for m in chat_history if m.get("sender") == "user" and m.get("text")]
        if last_user_msgs:
            last_q = last_user_msgs[-1].strip()
            follow_cues = ["ngoài ra", "kèm", "thêm", "còn", "với lại", "và", "đồng thời", "lại bị", "cũng bị", "thế còn", "vậy", "nếu", "sao", "được không"]
            if any(cue in question.lower() for cue in follow_cues) or len(question.split()) <= 4:
                user_question_text = (
                    f'"{question}"\n'
                    f'*(LƯU Ý BẮT BUỘC ĐỐI ĐÁP LIÊN TỤC: Người dùng đang bổ sung triệu chứng tiếp nối sau câu trước: "{last_q}". '
                    f'BẠN PHẢI TỔNG HỢP CẢ HAI TRIỆU CHỨNG "{last_q}" VÀ "{question}" ĐỂ ĐÁNH GIÁ NGUY CƠ BỆNH LÝ TỔNG HỢP VÀ HƯỚNG DẪN XỬ LÝ ĐỒNG THỜI)*'
                )

    return f"""{vi_history_block}[HỒ SƠ NGƯỜI CAO TUỔI]
{patient_text}

[THÔNG TIN BÁC SĨ PHỤ TRÁCH & LỊCH KHÁM BỆNH]
{care_context_text}

[DỮ LIỆU SINH HIỆU THỜI GIAN THỰC TỪ THIẾT BỊ]
{vitals_text}

[CẢNH BÁO BIẾN CỐ GẦN ĐÂY]
{incidents_text if incidents_text else 'Không ghi nhận biến cố bất thường gần đây.'}

[TRI THỨC TRÍCH XUẤT TỪ CẨM NANG Y KHOA LÃO KHOA (RAG)]
{docs_block}

[CÂU HỎI CỦA NGƯỜI DÙNG]
{user_question_text}

[HƯỚNG DẪN BẮT BUỘC]
1. Trả lời ĐÚNG TRỌNG TÂM câu hỏi của người dùng. Tuyệt đối không tự ý lan man sang các chỉ số sinh hiệu hay bệnh lý khác nếu người dùng không hỏi về chúng.
2. Nếu là câu hỏi về triệu chứng / bệnh lý / chăm sóc: BẮT BUỘC trình bày theo CẤU TRÚC 3 PHẦN:
   🎯 **KẾT LUẬN NHANH** (1-2 câu ngắn)
   📋 **HÀNH ĐỘNG CỤ THỂ CHO BẠN (Người trẻ chăm sóc)** (3-4 gạch đầu dòng thiết thực)
   🚨 **CẢNH BÁO ĐỎ (Cần đi viện/gọi 115 ngay)** (2-3 dấu hiệu nguy cấp của chính triệu chứng này)
3. Nếu là câu hỏi ngắn / tra cứu / hỏi bác sĩ / lịch khám: Trả lời ngắn gọn trực diện 1 - 2 câu."""


# =============================================================================
# MULTI-AGENT / DUAL-AI CLINICAL CRITIC PROMPTS (AI 2: MEDICAL SAFETY VERIFIER)
# =============================================================================

CRITIC_SYSTEM_PROMPT_VI = """Bạn là Bác sĩ Trưởng Thẩm định Y tế & Giám sát An toàn (Chief Clinical Safety Verifier) của SmartCare AI.
Nhiệm vụ: Thẩm định nghiêm ngặt bản thảo câu trả lời do AI 1 soạn thảo trước khi gửi tới người dùng.

NGUYÊN TẮC THẨM ĐỊNH LÂM SÀNG BẮT BUỘC:
1. ĐÚNG TRỌNG TÂM CÂU HỎI - KHÔNG LAN MAN:
   - Kiểm tra xem AI 1 có trả lời đúng trọng tâm câu hỏi không.
   - Nếu bản thảo tự ý nói lan man sang tim mạch/huyết áp trong khi người dùng đang hỏi về mắt, răng, đau bụng, mất ngủ... -> CẮT BỎ NGAY phần lan man, chỉ giữ lại đúng câu trả lời cho triệu chứng được hỏi.
2. CẤU TRÚC 3 PHẦN CHUẨN XÁC:
   - Đảm bảo câu trả lời về triệu chứng tuân thủ 3 phần: 🎯 KẾT LUẬN NHANH, 📋 HÀNH ĐỘNG CỤ THỂ, 🚨 CẢNH BÁO ĐỎ.
3. AN TOÀN DÙNG THUỐC (BR-5):
   - Tuyệt đối không chấp thuận câu trả lời tự kê đơn thuốc mới hoặc khuyên tự ý tăng/giảm liều lượng thuốc điều trị.
4. BẢO MẬT SỐ ĐIỆN THOẠI CÁ NHÂN:
   - TUYỆT ĐỐI KHÔNG để lọt số điện thoại cá nhân (bác sĩ, người nhà) lên nội dung chat. Thay thế bằng hướng dẫn nhấn nút "Gọi bác sĩ" hoặc nút "SOS" trên ứng dụng.
5. XUẤT KẾT QUẢ:
   - Chỉ xuất ra trực tiếp câu trả lời hoàn chỉnh cho người dùng, KHÔNG kèm nhận xét của người kiểm duyệt.
"""

CRITIC_SYSTEM_PROMPT_EN = """You are the Chief Clinical Safety Verifier of SmartCare AI.
Role: Rigorously audit the draft medical response produced by AI 1.

MANDATORY AUDIT PRINCIPLES:
1. STRICTLY ON-TOPIC: Ensure the answer directly addresses what the user asked. Strip any unsolicited tangents about vitals if unrelated to the inquiry.
2. 3-PART STRUCTURE: Validate that symptom/care questions follow: 🎯 Quick Conclusion, 📋 Actionable Steps, 🚨 Red Flags.
3. MEDICATION SAFETY (BR-5): Never allow prescribing new drugs or changing dosage.
4. PRIVACY PROTECTION: Redact any phone numbers, replacing with instructions to use the in-app "Call Doctor" or "SOS" button.
5. Output ONLY the final verified response.
"""


def build_critic_user_prompt(
    question: str,
    draft_answer: str,
    vitals_text: str,
    patient_text: str,
    care_context_text: str,
    incidents_text: str,
    language: str = "vi",
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Đóng gói dữ liệu lâm sàng gốc và bản thảo từ AI 1 để AI 2 thẩm định."""
    history_note = ""
    if chat_history:
        last_user_msgs = [m.get("text", "") for m in chat_history if m.get("sender") == "user" and m.get("text")]
        if last_user_msgs:
            last_q = last_user_msgs[-1].strip()
            if any(cue in question.lower() for cue in ["ngoài ra", "kèm", "thêm", "còn", "với lại", "và"]) or len(question.split()) <= 4:
                history_note = f"\n*(Lưu ý đối đáp liên tục: Câu này tiếp nối triệu chứng trước: '{last_q}'. Bản thảo kết hợp cả 2 triệu chứng là đúng yêu cầu)*"

    if language == "en":
        return (
            f"[USER QUESTION]\n"
            f'"{question}"{history_note}\n\n'
            f"[ORIGINAL CLINICAL CONTEXT]\n"
            f"- Patient Profile: {patient_text}\n"
            f"- Assigned Doctor & Appointments: {care_context_text}\n"
            f"- Real-time Sensor Vitals: {vitals_text}\n"
            f"- Recent Incidents: {incidents_text if incidents_text else 'None'}\n\n"
            f"[DRAFT RESPONSE FROM AI 1 TO AUDIT]\n"
            f"{draft_answer}\n\n"
            f"Audit this draft. Ensure it is strictly on-topic and follows the 3-part layout if answering symptoms. Output ONLY the final response:"
        )

    return (
        f"[CÂU HỎI CỦA NGƯỜI DÙNG]\n"
        f'"{question}"{history_note}\n\n'
        f"[NGỮ CẢNH LÂM SÀNG THỰC TẾ GỐC]\n"
        f"- Hồ sơ bệnh nhân: {patient_text}\n"
        f"- Bác sĩ phụ trách & Lịch hẹn: {care_context_text}\n"
        f"- Sinh hiệu cảm biến thực tế: {vitals_text}\n"
        f"- Biến cố cảnh báo gần đây: {incidents_text if incidents_text else 'Không có'}\n\n"
        f"[BẢN THẢO CÂU TRẢ LỜI TỪ AI 1 CẦN THẨM ĐỊNH]\n"
        f"{draft_answer}\n\n"
        f"Hãy thẩm định bản thảo trên: Đảm bảo đúng trọng tâm câu hỏi (không lan man sang bệnh khác), tuân thủ cấu trúc 3 phần (Kết luận nhanh - Hành động cụ thể - Cảnh báo đỏ). Xuất ra trực tiếp câu trả lời hoàn chỉnh:"
    )

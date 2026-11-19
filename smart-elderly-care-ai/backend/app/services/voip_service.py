"""
voip_service.py – Dịch vụ Tổng đài Thoại Cloud (VoIP Cloud Gateway) cho SmartCare AI.

Hỗ trợ:
- Gọi thoại tự động (Outbound Emergency Voice Call) qua Twilio Voice API.
- Tự động chuyển đổi số điện thoại Việt Nam sang định dạng E.164 (+84...).
- Phát âm thông điệp cảnh báo giọng nói tiếng Việt (TwiML Text-to-Speech).
- Chế độ Mock / Fallback: Tự động ghi nhận cuộc gọi và chuyển lệnh cho App Mobile quay số nếu chưa cấu hình Twilio.
"""

import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("voip_service")


def format_e164_vietnam(phone: str) -> str:
    """Chuẩn hóa số điện thoại Việt Nam sang định dạng chuẩn quốc tế E.164 (+84...)."""
    clean = "".join(c for c in phone if c.isdigit() or c == "+")
    if clean.startswith("+"):
        return clean
    if clean.startswith("0"):
        return "+84" + clean[1:]
    if clean.startswith("84"):
        return "+" + clean
    return "+84" + clean


async def place_cloud_emergency_call(
    target_phone: str = "0898230852",
    patient_name: str = "Cụ Nguyễn Văn A",
    reason: str = "Phát hiện sự cố nguy kịch",
    incident_id: Optional[str] = None,
) -> dict:
    """
    Thực hiện cuộc gọi thoại khẩn cấp từ Cloud tới người giám hộ.
    Nếu có Twilio: Gọi thoại thật qua Twilio Voice API.
    Nếu không có Twilio: Chạy chế độ Mock Gateway & kích hoạt Fallback.
    """
    e164_phone = format_e164_vietnam(target_phone)
    has_credentials = bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and getattr(settings, "TWILIO_PHONE_NUMBER", None))

    if has_credentials:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

            # TwiML phát giọng nói tiếng Việt báo động khẩn cấp
            twiml_content = f"""<Response>
    <Pause length="1"/>
    <Say language="vi-VN" voice="Polly.Chi">Báo động đỏ khẩn cấp từ hệ thống SmartCare AI! {patient_name} đang trong tình trạng nguy cấp: {reason}. Đề nghị người nhà mở ứng dụng hoặc hỗ trợ cấp cứu ngay lập tức!</Say>
    <Pause length="2"/>
    <Say language="vi-VN" voice="Polly.Chi">Xin nhắc lại: {patient_name} cần được hỗ trợ khẩn cấp. Xin cảm ơn!</Say>
</Response>"""

            call = client.calls.create(
                to=e164_phone,
                from_=settings.TWILIO_PHONE_NUMBER,
                twiml=twiml_content,
            )
            logger.info("[VoIP Cloud] Đã phát cuộc gọi khẩn cấp Twilio tới %s (Call SID: %s)", e164_phone, call.sid)
            return {
                "status": "CALLED",
                "provider": "TWILIO",
                "call_sid": call.sid,
                "target_phone": e164_phone,
                "patient_name": patient_name,
            }
        except Exception as exc:
            logger.error("[VoIP Cloud] Lỗi khi gọi Twilio Voice API: %s. Chuyển sang chế độ Fallback.", exc)

    # Chế độ Mock / Fallback: Ghi log gateway và hỗ trợ app mobile tự quay số
    logger.warning(
        "[VoIP Cloud] Kích hoạt cổng thoại Cloud (Chế độ Demo/Fallback) tới %s | Bệnh nhân: %s | Lý do: %s | Sự cố: %s",
        e164_phone,
        patient_name,
        reason,
        incident_id or "N/A"
    )
    return {
        "status": "MOCK_CALLED",
        "provider": "MOCK_GATEWAY",
        "target_phone": e164_phone,
        "patient_name": patient_name,
        "message": f"Cổng VoIP Cloud đã phát lệnh gọi tới {e164_phone}",
    }

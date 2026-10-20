"""Twilio Verify integration for phone OTP delivery."""

import hmac
import logging
import time

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lưu tạm các mã OTP vừa xác thực thành công (phone -> (code, timestamp))
# để hỗ trợ quy trình gọi /verify-otp trước rồi gọi /register sau đó.
_RECENTLY_VERIFIED: dict[str, tuple[str, float]] = {}
_VERIFIED_TTL_SECONDS = 300.0


def _is_sid(value: str, prefix: str) -> bool:
    return bool(value) and len(value) == 34 and value.startswith(prefix)


def _has_twilio_credentials() -> bool:
    return (
        _is_sid(getattr(settings, "TWILIO_ACCOUNT_SID", None) or "", "AC")
        and bool(getattr(settings, "TWILIO_AUTH_TOKEN", None))
        and getattr(settings, "TWILIO_AUTH_TOKEN", "").isascii()
        and _is_sid(getattr(settings, "TWILIO_VERIFY_SERVICE_SID", None) or "", "VA")
    )


def _mock_otp_enabled() -> bool:
    mode = (getattr(settings, "OTP_MODE", None) or "mock").strip().lower()
    if mode == "mock" or not _has_twilio_credentials():
        return True
    return False


def _client() -> Client:
    if (
        not settings.TWILIO_ACCOUNT_SID
        or not _is_sid(settings.TWILIO_ACCOUNT_SID, "AC")
        or not settings.TWILIO_AUTH_TOKEN
    ):
        raise RuntimeError("TWILIO_ACCOUNT_SID hoặc TWILIO_AUTH_TOKEN không hợp lệ.")
    if not settings.TWILIO_AUTH_TOKEN.isascii():
        raise RuntimeError("TWILIO_AUTH_TOKEN chứa ký tự không hợp lệ. Hãy kiểm tra lại cấu hình Twilio.")
    if not _is_sid(settings.TWILIO_VERIFY_SERVICE_SID, "VA"):
        raise RuntimeError("TWILIO_VERIFY_SERVICE_SID chưa được cấu hình.")
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def send_otp(phone: str) -> None:
    if _mock_otp_enabled():
        code = getattr(settings, "OTP_DEV_CODE", None) or "123456"
        masked_phone = f"{phone[:4]}***{phone[-2:]}" if len(phone) >= 6 else phone
        logger.info("[OTP MOCK] phone=%s code=%s (mã kiểm thử mặc định: 123456)", masked_phone, code)
        return

    try:
        verification = (
            _client()
            .verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID)
            .verifications.create(to=phone, channel="sms")
        )
    except TwilioRestException as exc:
        raise RuntimeError(exc.msg or "Twilio could not send the verification code.") from exc

    if verification.status not in {"pending", "approved"}:
        raise RuntimeError("Twilio did not accept the verification request.")


def verify_otp(phone: str, code: str) -> bool:
    if _mock_otp_enabled():
        expected_code = getattr(settings, "OTP_DEV_CODE", None) or "123456"
        if code == expected_code or code == "123456":
            _RECENTLY_VERIFIED[phone] = (code, time.time())
            return True
        return False

    cached = _RECENTLY_VERIFIED.get(phone)
    now = time.time()
    if cached and hmac.compare_digest(cached[0], code) and (now - cached[1]) <= _VERIFIED_TTL_SECONDS:
        return True

    try:
        check = (
            _client()
            .verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID)
            .verification_checks.create(to=phone, code=code)
        )
    except TwilioRestException:
        return False

    if check.status == "approved":
        _RECENTLY_VERIFIED[phone] = (code, now)
        return True
    return False

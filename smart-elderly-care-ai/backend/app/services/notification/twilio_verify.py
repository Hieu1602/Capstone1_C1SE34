"""Twilio Verify integration for phone OTP delivery."""

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from app.core.config import settings


def _is_sid(value: str, prefix: str) -> bool:
    return len(value) == 34 and value.startswith(prefix)


def _client() -> Client:
    if (
        not settings.TWILIO_ACCOUNT_SID
        or not _is_sid(settings.TWILIO_ACCOUNT_SID, "AC")
        or not settings.TWILIO_AUTH_TOKEN
    ):
        raise RuntimeError("TWILIO_ACCOUNT_SID hoặc TWILIO_AUTH_TOKEN không hợp lệ.")
    if not _is_sid(settings.TWILIO_VERIFY_SERVICE_SID, "VA"):
        raise RuntimeError("TWILIO_VERIFY_SERVICE_SID chưa được cấu hình.")
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def send_otp(phone: str) -> None:
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
    try:
        check = (
            _client()
            .verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID)
            .verification_checks.create(to=phone, code=code)
        )
    except TwilioRestException:
        return False

    return check.status == "approved"

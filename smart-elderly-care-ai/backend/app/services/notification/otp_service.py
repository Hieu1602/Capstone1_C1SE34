"""
otp_service.py
Quản lý tạo mã OTP, gửi qua SMS (eSMS / Twilio / Mock), lưu trữ và xác thực.
Hỗ trợ cả quy trình Đăng ký tài khoản (register) và Quên / Đặt lại mật khẩu (reset_password).

Tính năng:
- Rate-limiting: Chống spam gửi OTP liên tục (mặc định 60 giây giữa 2 lần gửi).
- Giới hạn số lần nhập sai: Khóa tạm sau 5 lần nhập sai liên tiếp.
- Template ID cấu hình qua biến môi trường (ESMS_OTP_REGISTER_TEMPLATE_ID, ESMS_OTP_RESET_TEMPLATE_ID).
- Hỗ trợ lưu trữ OTP qua Redis (ưu tiên) hoặc In-memory cache (dự phòng).
"""

import hmac
import logging
import secrets
import time
from typing import Optional

from app.core.config import settings
from app.crud.crud_user import normalize_phone
from app.services.notification.esms_service import send_esms_sms

logger = logging.getLogger(__name__)

# Thời hạn mã OTP còn hiệu lực (giây) - mặc định 5 phút
OTP_TTL_SECONDS = 300
# Thời hạn trạng thái "đã xác thực" được lưu để gọi tiếp /register hoặc /password/reset (10 phút)
VERIFIED_TTL_SECONDS = 600

# Bộ nhớ đệm cục bộ (In-memory cache) dự phòng khi Redis không khả dụng
# phone -> (code, expire_at)
_LOCAL_OTP_STORE: dict[str, tuple[str, float]] = {}
# phone -> verified_at
_LOCAL_VERIFIED_STORE: dict[str, float] = {}
# phone -> last_sent_at (rate-limiting)
_LOCAL_RATE_LIMIT_STORE: dict[str, float] = {}
# phone -> failed_attempt_count
_LOCAL_FAILED_ATTEMPTS: dict[str, int] = {}


def _get_redis_client():
    """Lấy Redis connection client nếu cấu hình REDIS_URL khả dụng."""
    try:
        import redis
        if getattr(settings, "REDIS_URL", None):
            return redis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception as exc:
        logger.debug("[OTP] Không thể kết nối Redis, sử dụng in-memory cache: %s", exc)
    return None


def generate_otp_code(length: int = 6) -> str:
    """Tạo mã OTP ngẫu nhiên an toàn gồm 6 chữ số."""
    return f"{secrets.randbelow(10**length):0{length}d}"


def _check_rate_limit(phone: str) -> None:
    """
    Kiểm tra rate-limit: Không cho phép gửi OTP liên tục trong khoảng thời gian ngắn.
    Mặc định: 60 giây giữa 2 lần gửi.
    Raise RuntimeError nếu vi phạm.
    """
    rate_limit_seconds = getattr(settings, "OTP_RATE_LIMIT_SECONDS", 60)
    now = time.time()

    r = _get_redis_client()
    if r:
        try:
            last_sent = r.get(f"otp_rate:{phone}")
            if last_sent:
                elapsed = now - float(last_sent)
                if elapsed < rate_limit_seconds:
                    remaining = int(rate_limit_seconds - elapsed)
                    raise RuntimeError(
                        f"Vui lòng chờ {remaining} giây trước khi gửi lại mã xác minh."
                    )
        except RuntimeError:
            raise
        except Exception as exc:
            logger.warning("[OTP] Lỗi đọc rate-limit từ Redis: %s", exc)

    # Kiểm tra in-memory fallback
    last_sent_at = _LOCAL_RATE_LIMIT_STORE.get(phone)
    if last_sent_at:
        elapsed = now - last_sent_at
        if elapsed < rate_limit_seconds:
            remaining = int(rate_limit_seconds - elapsed)
            raise RuntimeError(
                f"Vui lòng chờ {remaining} giây trước khi gửi lại mã xác minh."
            )


def _record_rate_limit(phone: str) -> None:
    """Ghi nhận thời điểm gửi OTP gần nhất để áp dụng rate-limit."""
    now = time.time()
    rate_limit_seconds = getattr(settings, "OTP_RATE_LIMIT_SECONDS", 60)

    _LOCAL_RATE_LIMIT_STORE[phone] = now
    r = _get_redis_client()
    if r:
        try:
            r.setex(f"otp_rate:{phone}", rate_limit_seconds, str(now))
        except Exception as exc:
            logger.warning("[OTP] Lỗi ghi rate-limit Redis: %s", exc)


def _check_max_attempts(phone: str) -> None:
    """
    Kiểm tra số lần nhập sai OTP liên tiếp.
    Khóa tạm nếu vượt quá giới hạn (mặc định 5 lần).
    """
    max_attempts = getattr(settings, "OTP_MAX_ATTEMPTS", 5)

    r = _get_redis_client()
    if r:
        try:
            attempts = r.get(f"otp_attempts:{phone}")
            if attempts and int(attempts) >= max_attempts:
                raise RuntimeError(
                    "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng chờ 10 phút rồi thử lại."
                )
        except RuntimeError:
            raise
        except Exception as exc:
            logger.warning("[OTP] Lỗi đọc attempts từ Redis: %s", exc)

    # In-memory fallback
    local_attempts = _LOCAL_FAILED_ATTEMPTS.get(phone, 0)
    if local_attempts >= max_attempts:
        raise RuntimeError(
            "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng chờ 10 phút rồi thử lại."
        )


def _record_failed_attempt(phone: str) -> None:
    """Tăng bộ đếm lần nhập sai OTP."""
    max_attempts = getattr(settings, "OTP_MAX_ATTEMPTS", 5)

    _LOCAL_FAILED_ATTEMPTS[phone] = _LOCAL_FAILED_ATTEMPTS.get(phone, 0) + 1
    r = _get_redis_client()
    if r:
        try:
            key = f"otp_attempts:{phone}"
            r.incr(key)
            r.expire(key, OTP_TTL_SECONDS * 2)  # Tự hết hạn sau 10 phút
        except Exception as exc:
            logger.warning("[OTP] Lỗi ghi failed attempts Redis: %s", exc)

    current = _LOCAL_FAILED_ATTEMPTS.get(phone, 0)
    if current >= max_attempts:
        logger.warning("[OTP] Đã khóa tạm OTP cho %s sau %d lần nhập sai", phone, current)


def _reset_failed_attempts(phone: str) -> None:
    """Reset bộ đếm sau khi xác thực thành công."""
    _LOCAL_FAILED_ATTEMPTS.pop(phone, None)
    r = _get_redis_client()
    if r:
        try:
            r.delete(f"otp_attempts:{phone}")
        except Exception:
            pass


def send_otp(phone: str, purpose: str = "register") -> str:
    """
    Tạo mã OTP và gửi qua kênh cấu hình (eSMS, Twilio, hoặc Mock).
    - purpose: 'register' (đăng ký) hoặc 'reset_password' (quên/đổi mật khẩu).

    Bao gồm:
    - Rate-limiting: Chống gửi liên tục (mặc định 60s/lần).
    - Lưu mã OTP vào Redis / In-memory cache.
    - Gửi SMS qua cổng eSMS với Template Brandname đã đăng ký.
    """
    clean_phone = normalize_phone(phone)
    mode = (getattr(settings, "OTP_MODE", "esms") or "esms").strip().lower()

    # Kiểm tra rate-limit (trừ chế độ mock)
    if mode != "mock":
        _check_rate_limit(clean_phone)

    # Tạo mã OTP ngẫu nhiên (hoặc mã cố định nếu chế độ mock test)
    if mode == "mock":
        code = getattr(settings, "OTP_DEV_CODE", None) or "123456"
    else:
        code = generate_otp_code(6)

    # Lưu mã OTP vào Redis / in-memory cache
    now = time.time()
    expire_at = now + OTP_TTL_SECONDS

    r = _get_redis_client()
    if r:
        try:
            r.setex(f"otp:{clean_phone}", OTP_TTL_SECONDS, code)
            r.setex(f"otp_purpose:{clean_phone}", OTP_TTL_SECONDS, purpose)
        except Exception as redis_err:
            logger.warning("[OTP] Lỗi ghi Redis: %s", redis_err)
            _LOCAL_OTP_STORE[clean_phone] = (code, expire_at)
    else:
        _LOCAL_OTP_STORE[clean_phone] = (code, expire_at)

    # Reset bộ đếm lần nhập sai khi gửi mã mới
    _reset_failed_attempts(clean_phone)

    masked_phone = f"{clean_phone[:4]}***{clean_phone[-2:]}" if len(clean_phone) >= 6 else clean_phone

    # Gửi qua kênh được cấu hình
    if mode == "mock":
        logger.info("[OTP MOCK] Gửi OTP cho %s (purpose=%s): %s", masked_phone, purpose, code)
        return code

    if mode == "esms":
        # Lấy Template ID từ cấu hình (chỉ dùng nếu được thiết lập cụ thể trong .env)
        register_template = (getattr(settings, "ESMS_OTP_REGISTER_TEMPLATE_ID", "") or "").strip()
        reset_template = (getattr(settings, "ESMS_OTP_RESET_TEMPLATE_ID", "") or "").strip()

        if purpose in ("reset_password", "forgot_password"):
            content = f"{code} la ma dat lai mat khau Smart Elderly Care cua ban"
            temp_id = reset_template if reset_template else None
        else:
            content = f"{code} la ma xac minh dang ky Smart Elderly Care cua ban"
            temp_id = register_template if register_template else None

        try:
            send_esms_sms(
                phone=clean_phone,
                content=content,
                temp_id=temp_id,
                params=[code] if temp_id else None,
            )
            # Ghi nhận rate-limit sau khi gửi thành công
            _record_rate_limit(clean_phone)
            logger.info("[OTP eSMS] Đã gửi OTP thành công cho %s (purpose=%s)", masked_phone, purpose)
        except Exception as exc:
            logger.error("[OTP eSMS] Gửi OTP thất bại cho %s: %s", masked_phone, exc)
            raise RuntimeError(f"Không thể gửi tin nhắn xác minh SMS qua eSMS: {str(exc)}") from exc
        return code

    if mode == "twilio":
        # Fallback hỗ trợ Twilio Verify nếu được cấu hình
        try:
            from app.services.notification.twilio_verify import send_otp as twilio_send_otp
            twilio_send_otp(clean_phone)
            _record_rate_limit(clean_phone)
            return code
        except Exception as exc:
            logger.error("[OTP Twilio] Lỗi gửi Twilio: %s", exc)
            raise RuntimeError(str(exc)) from exc

    # Mặc định ghi log
    logger.info("[OTP] Gửi OTP mặc định tới %s: %s", masked_phone, code)
    return code


def verify_otp(phone: str, code: str) -> bool:
    """
    Kiểm tra mã OTP do người dùng nhập vào.
    Hỗ trợ mã DEV (123456, 999999) khi DEBUG bật.
    Có giới hạn số lần nhập sai liên tiếp.
    """
    clean_phone = normalize_phone(phone)
    clean_code = (code or "").strip()
    now = time.time()

    # Bỏ qua xác thực cho mã DEV nếu ở chế độ debug/dev
    dev_codes = {"123456", "999999"}
    if getattr(settings, "OTP_DEV_CODE", None):
        dev_codes.add(settings.OTP_DEV_CODE.strip())

    if getattr(settings, "DEBUG", False) and clean_code in dev_codes:
        _record_verified(clean_phone, now)
        _reset_failed_attempts(clean_phone)
        return True

    # Kiểm tra trạng thái đã xác thực gần đây
    if is_recently_verified(clean_phone):
        return True

    # Kiểm tra số lần nhập sai (khóa tạm nếu quá nhiều)
    _check_max_attempts(clean_phone)

    # Kiểm tra trong Redis
    r = _get_redis_client()
    expected_code: Optional[str] = None
    if r:
        try:
            expected_code = r.get(f"otp:{clean_phone}")
        except Exception as exc:
            logger.warning("[OTP] Lỗi đọc Redis: %s", exc)

    # Nếu Redis không có, kiểm tra in-memory cache
    if not expected_code and clean_phone in _LOCAL_OTP_STORE:
        stored_code, expire_at = _LOCAL_OTP_STORE[clean_phone]
        if now <= expire_at:
            expected_code = stored_code
        else:
            _LOCAL_OTP_STORE.pop(clean_phone, None)

    if expected_code and hmac.compare_digest(expected_code, clean_code):
        # Xác thực thành công: Ghi nhận trạng thái đã xác thực và xóa OTP 1 lần
        _record_verified(clean_phone, now)
        _reset_failed_attempts(clean_phone)
        if r:
            try:
                r.delete(f"otp:{clean_phone}")
            except Exception:
                pass
        _LOCAL_OTP_STORE.pop(clean_phone, None)
        return True

    # Xác thực thất bại: Ghi nhận lần nhập sai
    _record_failed_attempt(clean_phone)
    return False


def is_recently_verified(phone: str) -> bool:
    """Kiểm tra số điện thoại vừa xác thực OTP thành công trong khoảng 10 phút gần đây."""
    clean_phone = normalize_phone(phone)
    now = time.time()

    r = _get_redis_client()
    if r:
        try:
            if r.exists(f"verified:{clean_phone}"):
                return True
        except Exception:
            pass

    verified_at = _LOCAL_VERIFIED_STORE.get(clean_phone)
    if verified_at and (now - verified_at) <= VERIFIED_TTL_SECONDS:
        return True

    return False


def _record_verified(clean_phone: str, timestamp: float) -> None:
    """Ghi nhận số điện thoại đã xác thực thành công vào Redis và In-Memory."""
    _LOCAL_VERIFIED_STORE[clean_phone] = timestamp
    r = _get_redis_client()
    if r:
        try:
            r.setex(f"verified:{clean_phone}", VERIFIED_TTL_SECONDS, "1")
        except Exception:
            pass

"""eSMS (esms.vn) SMS Gateway integration."""

import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ESMS_SEND_URL = "http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/"
ESMS_BALANCE_URL = "http://rest.esms.vn/MainService.svc/json/GetBalance/{api_key}/{secret_key}"


def normalize_phone_for_esms(phone: str) -> str:
    """Chuẩn hóa số điện thoại về định dạng eSMS (09xxxxxxxx hoặc 84xxxxxxxx)."""
    clean = re.sub(r"[\s().-]", "", phone or "")
    if clean.startswith("+84"):
        return "0" + clean[3:]
    if clean.startswith("84") and len(clean) >= 11:
        return "0" + clean[2:]
    return clean


def send_esms_sms(
    phone: str,
    content: str,
    temp_id: Optional[str] = None,
    params: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Gửi tin nhắn SMS qua cổng eSMS API v4 (SendMultipleMessage_V4_post_json).
    Tương thích với các mẫu Template Brandname CSKH đã đăng ký trên eSMS.
    """
    api_key = (settings.ESMS_API_KEY or "").strip()
    secret_key = (settings.ESMS_SECRET_KEY or "").strip()
    if not api_key or not secret_key:
        raise RuntimeError("ESMS_API_KEY hoặc ESMS_SECRET_KEY chưa được cấu hình.")

    clean_phone = normalize_phone_for_esms(phone)
    payload: Dict[str, Any] = {
        "ApiKey": api_key,
        "SecretKey": secret_key,
        "Phone": clean_phone,
        "Content": content,
        "Brandname": settings.ESMS_BRANDNAME or "Baotrixemay",
        "SmsType": str(settings.ESMS_SMS_TYPE or "2"),
        "IsUnicode": "0",
        "Sandbox": str(getattr(settings, "ESMS_SANDBOX", "0")),
    }

    if temp_id:
        payload["TempID"] = str(temp_id)
    if params:
        payload["Params"] = params

    masked_phone = f"{clean_phone[:4]}***{clean_phone[-2:]}" if len(clean_phone) >= 6 else clean_phone
    logger.info(
        "[eSMS] Đang gửi SMS tới %s (Brandname=%s, Type=%s, Sandbox=%s, TempID=%s)",
        masked_phone,
        payload["Brandname"],
        payload["SmsType"],
        payload["Sandbox"],
        temp_id,
    )

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(ESMS_SEND_URL, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.error("[eSMS] Lỗi mạng khi gọi eSMS API: %s", exc)
        raise RuntimeError(f"Lỗi kết nối cổng eSMS: {str(exc)}") from exc

    code_result = str(data.get("CodeResult", ""))
    error_message = data.get("ErrorMessage") or "Không rõ nguyên nhân"

    # Xử lý tự động fallback khi eSMS báo lỗi 789 (TemplateId is not config)
    if code_result == "789" and "TempID" in payload:
        logger.warning(
            "[eSMS] Cổng eSMS báo lỗi 789 (TemplateId is not config) cho TempID=%s. Đang tự động gửi lại theo mẫu nội dung Brandname chuẩn...",
            payload.get("TempID"),
        )
        fallback_payload = dict(payload)
        fallback_payload.pop("TempID", None)
        fallback_payload.pop("Params", None)
        try:
            with httpx.Client(timeout=15.0) as client:
                retry_response = client.post(ESMS_SEND_URL, json=fallback_payload)
                retry_response.raise_for_status()
                retry_data = retry_response.json()
            retry_code = str(retry_data.get("CodeResult", ""))
            if retry_code == "100":
                logger.info("[eSMS] Gửi lại không dùng TempID thành công tới %s. SMSID=%s", masked_phone, retry_data.get("SMSID"))
                return retry_data
            else:
                data = retry_data
                code_result = retry_code
                error_message = retry_data.get("ErrorMessage") or error_message
        except Exception as retry_exc:
            logger.error("[eSMS] Lỗi khi thử gửi lại không dùng TempID: %s", retry_exc)

    # Mã 100: Thành công
    if code_result != "100":
        logger.error(
            "[eSMS] Gửi SMS thất bại cho %s. Mã: %s, Thông điệp: %s",
            masked_phone,
            code_result,
            error_message,
        )
        raise RuntimeError(f"Cổng eSMS báo lỗi ({code_result}): {error_message}")

    logger.info("[eSMS] Gửi SMS thành công tới %s. SMSID=%s", masked_phone, data.get("SMSID"))
    return data


def get_esms_balance() -> Dict[str, Any]:
    """Kiểm tra số dư tài khoản eSMS."""
    api_key = (settings.ESMS_API_KEY or "").strip()
    secret_key = (settings.ESMS_SECRET_KEY or "").strip()
    if not api_key or not secret_key:
        raise RuntimeError("ESMS_API_KEY hoặc ESMS_SECRET_KEY chưa được cấu hình.")

    url = ESMS_BALANCE_URL.format(api_key=api_key, secret_key=secret_key)
    with httpx.Client(timeout=10.0) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.json()

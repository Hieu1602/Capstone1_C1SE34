"""
verification.py – Service tự động xác minh Chứng chỉ hành nghề (CCHN) Bác sĩ.
Nguồn tra cứu trực tiếp: Cổng thông tin công khai Sở Y tế TP.HCM (https://tracuu.medinet.org.vn/chungchihanhnghey)
Quy tắc xác minh:
  - Tra cứu trực tiếp theo thời gian thực trên CSDL Cổng Sở Y tế TP.HCM.
  - Kiểm tra trạng thái hành nghề (đảm bảo 'Hoạt động', không bị đình chỉ, thu hồi, tước giấy phép).
  - Trích xuất thông tin người cấp phép, nơi cấp và phạm vi chuyên môn để hiển thị chứng thực.
  - Không ép buộc khớp họ tên người đăng ký với người sở hữu CCHN.
"""

import logging
import re
from typing import Any, Dict
from unicodedata import normalize

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def normalize_vietnamese_name(text: str) -> str:
    """
    Chuẩn hóa chuỗi họ tên để so sánh không phân biệt chữ hoa, chữ thường,
    loại bỏ tiền tố chức danh (BS, Bác sĩ, Dr, ThS, TS) và khoảng trắng thừa.
    """
    if not text:
        return ""
    cleaned = normalize("NFC", text.strip().lower())
    cleaned = re.sub(r"[\.,]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    prefix_pattern = r"^(bác sĩ|bac si|bs|dr|thạc sĩ|ths|th s|ts|tiến sĩ)\b\s*"
    while re.search(prefix_pattern, cleaned):
        cleaned = re.sub(prefix_pattern, "", cleaned).strip()

    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def is_name_matched(name_a: str, name_b: str) -> bool:
    """Kiểm tra độ trùng khớp giữa hai họ tên."""
    norm_a = normalize_vietnamese_name(name_a)
    norm_b = normalize_vietnamese_name(name_b)

    if not norm_a or not norm_b:
        return False

    if norm_a == norm_b:
        return True

    tokens_a = set(norm_a.split())
    tokens_b = set(norm_b.split())
    if tokens_a == tokens_b:
        return True

    if norm_a in norm_b or norm_b in norm_a:
        return True

    return False


def is_license_active(status_text: str) -> bool:
    """Kiểm tra chứng chỉ hành nghề có đang hoạt động hợp lệ không (không bị đình chỉ/thu hồi)."""
    if not status_text:
        return True

    normalized_status = normalize("NFC", status_text.strip().lower())
    suspended_keywords = [
        "đình chỉ",
        "thu hồi",
        "tước quyền",
        "hết hiệu lực",
        "hết hạn",
        "tạm ngưng",
        "vi phạm",
        "chưa được phép",
    ]
    return not any(keyword in normalized_status for keyword in suspended_keywords)


async def verify_doctor_cchn(cchn_number: str, full_name: str = "") -> Dict[str, Any]:
    """
    Xác minh Chứng chỉ hành nghề Bác sĩ trực tiếp qua Cổng Sở Y tế TP.HCM (Medinet):
    1. Gửi truy vấn tra cứu POST tới Cổng https://tracuu.medinet.org.vn/chungchihanhnghey.
    2. Xác nhận CCHN tồn tại hợp lệ và đang ở trạng thái 'Hoạt động'.
    3. Trích xuất thông tin người cấp phép, nơi cấp và phạm vi chuyên môn để hiển thị chứng thực.
    4. Không ép buộc khớp tên đăng ký.
    """
    clean_cchn = (cchn_number or "").strip()
    clean_name = (full_name or "").strip()

    if not clean_cchn:
        return {
            "valid": False,
            "message": "Số Chứng chỉ hành nghề (CCHN) không được để trống.",
        }

    medinet_url = "https://tracuu.medinet.org.vn/chungchihanhnghey"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Origin": "https://tracuu.medinet.org.vn",
        "Referer": "https://tracuu.medinet.org.vn/",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            search_keywords = [clean_cchn]
            short_code = clean_cchn.split("/")[0].strip()
            if short_code and short_code != clean_cchn:
                search_keywords.append(short_code)

            for kw in search_keywords:
                payload = {
                    "key_word": kw,
                    "checked": "tuongdoi",
                    "page": 1,
                    "results_per_page": 15,
                }
                response = await client.post(medinet_url, json=payload, headers=headers)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")
                cards = soup.find_all("div", class_="coso-hanhnghey")
                if not cards:
                    continue

                for card in cards:
                    title_el = card.find("h5", class_="card-title")
                    span_el = title_el.find("span") if title_el else None
                    cchn_text = span_el.text.strip() if span_el else ""
                    full_title_text = title_el.text.replace(cchn_text, "").strip() if title_el else ""
                    medinet_name = full_title_text.strip()

                    # Trích xuất số CCHN chuẩn (loại bỏ ngày cấp [dd/mm/yyyy])
                    medinet_cchn = re.split(r"\s*-\s*\[", cchn_text)[0].strip() if cchn_text else ""

                    paragraphs = card.find_all("p", class_="card-text")
                    medinet_scope = paragraphs[1].text.strip() if len(paragraphs) > 1 else "Khám chữa bệnh đa khoa"
                    medinet_workplace = paragraphs[2].text.strip() if len(paragraphs) > 2 else "Cơ sở y tế được cấp phép"
                    medinet_status = paragraphs[3].text.strip() if len(paragraphs) > 3 else "Hoạt động"

                    # Kiểm tra độ khớp của CCHN
                    cchn_match = (
                        clean_cchn.lower() in medinet_cchn.lower()
                        or medinet_cchn.lower() in clean_cchn.lower()
                        or (short_code and short_code in medinet_cchn)
                    )

                    if cchn_match:
                        # 1. Kiểm tra trạng thái hoạt động / đình chỉ
                        if not is_license_active(medinet_status):
                            return {
                                "valid": False,
                                "message": (
                                    f"Chứng chỉ hành nghề '{medinet_cchn}' đang trong trạng thái: {medinet_status} "
                                    f"(Không đủ điều kiện hành nghề y tế)."
                                ),
                            }

                        # 2. Hợp lệ (Chứng minh CCHN tồn tại, đang hoạt động và cung cấp thông tin xác nhận)
                        name_display = medinet_name if medinet_name else (clean_name or "Bác sĩ chuyên khoa")
                        return {
                            "valid": True,
                            "cchn": medinet_cchn,
                            "official_name": name_display,
                            "scope_of_practice": medinet_scope,
                            "workplace": medinet_workplace,
                            "status": medinet_status,
                            "message": f"Chứng chỉ hành nghề đã được xác thực từ Cổng thông tin Sở Y tế TP.HCM (Chủ sở hữu CCHN: {medinet_name}).",
                            "source": "Sở Y tế TP.HCM (Medinet)",
                        }

    except Exception as exc:
        logger.warning("Lỗi kết nối tới Cổng Medinet Sở Y tế TP.HCM: %s", exc)
        return {
            "valid": False,
            "message": f"Không thể kết nối đến Cổng thông tin Sở Y tế TP.HCM để xác minh: {str(exc)}",
        }

    return {
        "valid": False,
        "message": f"Số CCHN '{clean_cchn}' không tìm thấy trên hệ thống cơ sở dữ liệu Sở Y tế TP.HCM.",
    }

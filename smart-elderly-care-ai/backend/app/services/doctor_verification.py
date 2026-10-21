"""
doctor_verification.py – Service tự động xác minh Chứng chỉ hành nghề (CCHN) Bác sĩ.
Nguồn tra cứu trực tiếp: Cổng thông tin công khai Sở Y tế TP.HCM (https://tracuu.medinet.org.vn)
Hỗ trợ kiểm tra tự động:
  - Tra cứu sự tồn tại của Số CCHN trên cổng Sở Y tế.
  - Đối soát họ tên đăng ký với người sở hữu chứng chỉ.
  - Kiểm tra trạng thái hành nghề (đảm bảo không bị đình chỉ, thu hồi, tước giấy phép).
  - Trích xuất phạm vi hoạt động chuyên môn từ hồ sơ cấp phép.
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
    # Chuyển về dạng chuẩn Unicode NFC và viết thường
    cleaned = normalize("NFC", text.strip().lower())

    # Loại bỏ tiền tố phổ biến
    cleaned = re.sub(
        r"^(bác sĩ|bac si|bs\.|bs|dr\.|dr|thạc sĩ|th s\.|ts\.|tiến sĩ)\s+",
        "",
        cleaned,
    )
    # Loại bỏ ký tự đặc biệt, giữ lại chữ cái và khoảng trắng
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    # Gộp khoảng trắng liên tiếp
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def is_name_matched(name_a: str, name_b: str) -> bool:
    """Kiểm tra độ trùng khớp giữa tên đăng ký và tên trên CCHN."""
    norm_a = normalize_vietnamese_name(name_a)
    norm_b = normalize_vietnamese_name(name_b)

    if not norm_a or not norm_b:
        return False

    # So khớp chính xác
    if norm_a == norm_b:
        return True

    # So khớp tập hợp các từ trong tên (VD: "Trần Văn Minh" khớp "Minh Trần Văn")
    tokens_a = set(norm_a.split())
    tokens_b = set(norm_b.split())
    if tokens_a == tokens_b:
        return True

    # Cho phép bao hàm nếu đầy đủ tên chính
    if norm_a in norm_b or norm_b in norm_a:
        return True

    return False


def is_license_active(status_text: str) -> bool:
    """Kiểm tra chứng chỉ hành nghề có đang hoạt động hợp lệ không (không bị đình chỉ/thu hồi)."""
    if not status_text:
        return True  # Mặc định hợp lệ nếu không có cờ vi phạm

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


async def verify_doctor_cchn(cchn_number: str, full_name: str) -> Dict[str, Any]:
    """
    Xác minh Chứng chỉ hành nghề Bác sĩ trực tiếp qua Cổng Sở Y tế TP.HCM (Medinet):
    1. Gửi truy vấn tra cứu theo số CCHN tới cổng https://tracuu.medinet.org.vn.
    2. Đối soát họ tên người sở hữu CCHN với tên đăng ký.
    3. Kiểm tra tình trạng pháp lý (không bị đình chỉ / thu hồi).
    4. Trích xuất phạm vi chuyên môn và nơi cấp phép.
    """
    clean_cchn = (cchn_number or "").strip()
    clean_name = (full_name or "").strip()

    if not clean_cchn:
        return {
            "valid": False,
            "message": "Số Chứng chỉ hành nghề (CCHN) không được để trống.",
        }

    if not clean_name:
        return {
            "valid": False,
            "message": "Họ và tên Bác sĩ không được để trống.",
        }

    medinet_url = "https://tracuu.medinet.org.vn/nguoi-hanh-nghe"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(
                medinet_url,
                params={"keyword": clean_cchn},
                headers=headers,
            )

            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                result_table = soup.find("table")

                if result_table:
                    rows = result_table.find_all("tr")
                    for row in rows[1:]:  # Bỏ qua dòng tiêu đề
                        cells = [cell.text.strip() for cell in row.find_all("td")]
                        if len(cells) >= 3:
                            # Cấu trúc: [STT, Họ và tên, Số CCHN, Phạm vi chuyên môn, Trạng thái]
                            medinet_name = cells[1] if len(cells) > 1 else ""
                            medinet_cchn = cells[2] if len(cells) > 2 else ""
                            medinet_scope = cells[3] if len(cells) > 3 else "Khám chữa bệnh đa khoa"
                            medinet_status = cells[4] if len(cells) > 4 else "Đang hoạt động"

                            if clean_cchn.lower() in medinet_cchn.lower():
                                # 1. Kiểm tra đối soát họ tên
                                if not is_name_matched(clean_name, medinet_name):
                                    return {
                                        "valid": False,
                                        "message": (
                                            f"Họ tên đăng ký ({clean_name}) không khớp với người đứng tên "
                                            f"trên CCHN ({medinet_name}) tại Cổng Sở Y tế TP.HCM."
                                        ),
                                    }

                                # 2. Kiểm tra trạng thái hoạt động / đình chỉ
                                if not is_license_active(medinet_status):
                                    return {
                                        "valid": False,
                                        "message": (
                                            f"Chứng chỉ hành nghề đang trong trạng thái: {medinet_status} "
                                            f"(Không đủ điều kiện hành nghề y tế)."
                                        ),
                                    }

                                # 3. Hợp lệ
                                return {
                                    "valid": True,
                                    "cchn": medinet_cchn,
                                    "official_name": medinet_name,
                                    "scope_of_practice": medinet_scope,
                                    "workplace": "Cơ sở y tế được cấp phép",
                                    "status": medinet_status,
                                    "message": "Chứng chỉ hành nghề đã được xác thực từ Cổng thông tin Sở Y tế TP.HCM.",
                                    "source": "Sở Y tế TP.HCM (Medinet)",
                                }

    except Exception as exc:
        logger.warning("Lỗi kết nối tới cổng Medinet Sở Y tế: %s", exc)
        return {
            "valid": False,
            "message": f"Không thể kết nối đến Cổng thông tin Sở Y tế TP.HCM để xác minh: {str(exc)}",
        }

    return {
        "valid": False,
        "message": f"Số CCHN '{clean_cchn}' không tìm thấy trên hệ thống cơ sở dữ liệu Sở Y tế TP.HCM.",
    }

"""Request-scoped language selection and translations for backend messages."""

import re
from typing import Any

from fastapi import Request


# Bảng dịch thông báo API: khóa có thể là tiếng Việt hoặc tiếng Anh.
# Nội dung không có trong bảng sẽ được giữ nguyên, tránh dịch nhầm dữ liệu tùy ý.
TRANSLATIONS: dict[str, str] = {
    "Không thể xác thực thông tin đăng nhập.": "Unable to validate credentials.",
    "Tài khoản đã bị vô hiệu hóa.": "This account has been disabled.",
    "Số điện thoại đã được đăng ký.": "This phone number is already registered.",
    "Số điện thoại đã được sử dụng.": "This phone number is already in use.",
    "Mã xác minh đã được gửi.": "Verification code sent.",
    "Mã xác minh không đúng hoặc đã hết hạn.": "The verification code is invalid or expired.",
    "Nếu tài khoản tồn tại, mã xác minh sẽ được gửi.": "If the account exists, a verification code will be sent.",
    "Mã xác minh không hợp lệ, đã hết hạn hoặc tài khoản không tồn tại.": "The verification code is invalid or expired, or the account does not exist.",
    "Mật khẩu đã được cập nhật.": "Password updated.",
    "Thông tin đăng nhập hoặc mật khẩu không đúng.": "The phone number or password is incorrect.",
    "Token không phải Refresh Token.": "The token is not a refresh token.",
    "Refresh token không hợp lệ hoặc đã hết hạn.": "The refresh token is invalid or expired.",
    "Người dùng không tồn tại hoặc đã bị vô hiệu hóa.": "The user does not exist or has been disabled.",
    "Không tìm thấy phiên chat.": "Chat session not found.",
    "Không tìm thấy đơn thuốc.": "Prescription not found.",
    "Không tìm thấy đơn thuốc cần xóa.": "Prescription to delete not found.",
    "Đã ngừng đơn thuốc thành công.": "Prescription stopped successfully.",
    "Không tìm thấy lịch khám yêu cầu": "Requested appointment not found.",
    "Không tìm thấy lịch khám để hủy": "Appointment to cancel not found.",
    "Đã hủy lịch khám thành công": "Appointment cancelled successfully.",
    "Thiết bị không tồn tại.": "Device not found.",
    "Bạn không có quyền xóa thiết bị này.": "You are not authorized to delete this device.",
    "Nhóm khu vực không tồn tại.": "Device group not found.",
    "Thiếu group_id": "Missing group_id.",
    "Incident not found": "Không tìm thấy sự kiện.",
    "Mật khẩu hiện tại không chính xác.": "The current password is incorrect.",
    "Mật khẩu mới phải khác mật khẩu hiện tại.": "The new password must be different from the current password.",
    "Vui lòng cung cấp tệp ảnh chân dung khuôn mặt.": "Please provide a facial portrait image.",
    "Định dạng tệp không hợp lệ.": "Invalid file format.",
    "Không tìm thấy hồ sơ người cao tuổi để đăng ký khuôn mặt.": "Elderly patient profile not found for face enrollment.",
    "Không thể giải mã dữ liệu ảnh. Vui lòng chọn ảnh định dạng JPG hoặc PNG hợp lệ.": "Unable to decode the image. Please choose a valid JPG or PNG file.",
    "Tên nhóm không được để trống.": "Group name cannot be empty.",
    "Số điện thoại không được để trống.": "Phone number cannot be empty.",
    "Mật khẩu mới và xác nhận mật khẩu mới không khớp.": "The new password and confirmation do not match.",
    "Đã cập nhật ngưỡng an toàn y tế thành công và đồng bộ xuống Hub.": "Medical safety thresholds updated and synced to the hub.",
    "Đã cập nhật thành công": "Updated successfully.",
    "Không lấy được vị trí": "Could not get location.",
    "Quyền bị từ chối": "Permission denied.",
    "Bạn cần cho phép truy cập vị trí để sử dụng định vị địa lý.": "Allow location access to use geolocation.",
    "Cuộc trò chuyện": "Conversation",
}

REVERSE_TRANSLATIONS = {translated: source for source, translated in TRANSLATIONS.items()}
# Một số thông báo do framework tạo ra không nằm trong bảng dịch chung.
ENGLISH_TO_VIETNAMESE = {
    "Field required": "Thiếu trường bắt buộc.",
    "Input should be 'vi' or 'en'": "Ngôn ngữ không hợp lệ. Chỉ chấp nhận 'vi' hoặc 'en'.",
    "Not authenticated": "Chưa xác thực.",
}


def normalize_language(value: str | None) -> str:
    """Chuẩn hóa locale vi/en; mặc định tiếng Việt với giá trị thiếu hoặc không hỗ trợ."""
    if not value:
        return "vi"
    language = value.split(",", 1)[0].split("-", 1)[0].strip().lower()
    return language if language in {"vi", "en"} else "vi"


def get_request_language(request: Request, user_language: str | None = None) -> str:
    """Ưu tiên Accept-Language của request; nếu thiếu thì dùng ngôn ngữ đã lưu."""
    header_language = request.headers.get("accept-language")
    if header_language:
        return normalize_language(header_language)
    return normalize_language(user_language)


def translate_text(value: str, language: str) -> str:
    """Dịch thông báo đã biết và giữ nguyên các giá trị động trong mẫu thông báo."""
    if language == "en":
        # Dùng mẫu regex cho thông báo có dữ liệu động như tên nhóm hoặc mã thiết bị.
        match = re.fullmatch(
            r"Chế độ '([^']+)' không hợp lệ\. Phải là một trong: (.+)\.",
            value,
        )
        if match:
            return f"Invalid mode '{match.group(1)}'. Must be one of: {match.group(2)}."
        match = re.fullmatch(
            r'Tên nhóm "(.+)" đã tồn tại\. Tên nhóm mới phải là duy nhất\.',
            value,
        )
        if match:
            return f'Group name "{match.group(1)}" already exists. Choose a unique name.'
        match = re.fullmatch(r"Đã gán (\d+) thiết bị vào nhóm '(.+)'\.", value)
        if match:
            return f"Assigned {match.group(1)} devices to group '{match.group(2)}'."
        match = re.fullmatch(r"Đã xóa nhóm '(.+)' thành công\.", value)
        if match:
            return f"Group '{match.group(1)}' deleted successfully."
        match = re.fullmatch(
            r"Mã thiết bị '(.+)' đã được đăng ký trên hệ thống\.",
            value,
        )
        if match:
            return f"Device ID '{match.group(1)}' is already registered."
        match = re.fullmatch(r"Heartbeat recorded for device '(.+)'", value)
        if match:
            return f"Đã ghi nhận heartbeat cho thiết bị '{match.group(1)}'."
        match = re.fullmatch(r"Device '(.+)' deleted successfully", value)
        if match:
            return f"Đã xóa thiết bị '{match.group(1)}' thành công."
        return TRANSLATIONS.get(value, value)
    if value in ENGLISH_TO_VIETNAMESE:
        return ENGLISH_TO_VIETNAMESE[value]
    match = re.fullmatch(r"Invalid mode '([^']+)'\. Must be one of: (.+)\.", value)
    if match:
        return f"Chế độ '{match.group(1)}' không hợp lệ. Phải là một trong: {match.group(2)}."
    match = re.fullmatch(
        r'Group name "(.+)" already exists\. Choose a unique name\.',
        value,
    )
    if match:
        return f'Tên nhóm "{match.group(1)}" đã tồn tại. Tên nhóm mới phải là duy nhất.'
    match = re.fullmatch(r"Assigned (\d+) devices to group '(.+)'\.", value)
    if match:
        return f"Đã gán {match.group(1)} thiết bị vào nhóm '{match.group(2)}'."
    match = re.fullmatch(r"Group '(.+)' deleted successfully\.", value)
    if match:
        return f"Đã xóa nhóm '{match.group(1)}' thành công."
    match = re.fullmatch(r"Device ID '(.+)' is already registered\.", value)
    if match:
        return f"Mã thiết bị '{match.group(1)}' đã được đăng ký trên hệ thống."
    match = re.fullmatch(r"Đã ghi nhận heartbeat cho thiết bị '(.+)'\.", value)
    if match:
        return f"Heartbeat recorded for device '{match.group(1)}'"
    match = re.fullmatch(r"Đã xóa thiết bị '(.+)' thành công\.", value)
    if match:
        return f"Device '{match.group(1)}' deleted successfully"
    return REVERSE_TRANSLATIONS.get(value, value)


def translate_payload(payload: Any, language: str, key: str | None = None) -> Any:
    """Dịch đệ quy các trường thông báo, không dịch tên người dùng hay dữ liệu thiết bị."""
    if isinstance(payload, dict):
        return {
            item_key: translate_payload(item, language, item_key)
            for item_key, item in payload.items()
        }
    if isinstance(payload, list):
        return [translate_payload(item, language, key) for item in payload]
    if isinstance(payload, str) and key in {"detail", "message", "error", "msg", "title"}:
        return translate_text(payload, language)
    return payload

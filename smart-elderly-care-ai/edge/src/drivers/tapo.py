"""Cấu hình RTSP và điều khiển Tapo; không ghi credential vào log."""
import os
import threading
from urllib.parse import quote


def rtsp_url() -> str:
    """Camera Account dùng cho RTSP, khác tài khoản TP-Link cloud."""
    host = os.environ["TAPO_HOST"].strip()
    user, password = os.environ["TAPO_USERNAME"], os.environ["TAPO_PASSWORD"]
    stream = os.getenv("TAPO_STREAM", "stream1")
    if not host or any(c in host for c in "/@ :?#"):
        raise ValueError("TAPO_HOST phải là IPv4 hoặc hostname không kèm cổng")
    if not user or not password or stream not in ("stream1", "stream2"):
        raise ValueError("Thiếu Camera Account hoặc TAPO_STREAM không hợp lệ")
    # Encode từng credential để @, :, / trong mật khẩu không phá URL.
    return f"rtsp://{quote(user, safe='')}:{quote(password, safe='')}@{host}:554/{stream}"


class TapoControl:
    """Khởi tạo lười: lỗi điều khiển không làm mất luồng RTSP."""
    def __init__(self):
        self._client = None
        self._lock = threading.Lock()

    def call(self, method: str, *args):
        # pytapo đồng bộ và tái sử dụng session; tuần tự hóa các lệnh.
        with self._lock:
            try:
                if self._client is None:
                    from pytapo import Tapo
                    self._client = Tapo(
                        os.environ["TAPO_HOST"],
                        os.getenv("TAPO_CONTROL_USERNAME") or os.environ["TAPO_USERNAME"],
                        os.getenv("TAPO_CONTROL_PASSWORD") or os.environ["TAPO_PASSWORD"],
                        cloudPassword=os.getenv("TAPO_CLOUD_PASSWORD", ""),
                        printDebugInformation=False,
                    )
                return getattr(self._client, method)(*args)
            except Exception:
                self._client = None
                raise

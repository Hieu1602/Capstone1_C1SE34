"""OpenCV driver dùng chung cho AI edge và dịch vụ Tapo Docker."""
import logging
import os
import threading
import time
from typing import Any, Optional
import numpy as np

logger = logging.getLogger(__name__)


class CameraDriver:
    def __init__(self, config: dict):
        """Chuẩn bị nguồn ảnh, cấu hình đọc và bộ nhớ dùng chung.

        Args:
            config: Nguồn ảnh, FPS, độ phân giải và khoảng chờ kết nối lại.

        Returns:
            Không có. Chưa mở camera hoặc tạo thread.
        """
        self.source = config.get("source", 0)
        if os.getenv("TAPO_HOST"):
            from .tapo import rtsp_url
            self.source = rtsp_url()
        self.fps = max(1, int(config.get("fps", 15)))
        self.width = config.get("resolution", {}).get("width", 1280)
        self.height = config.get("resolution", {}).get("height", 720)
        self.reconnect_interval = float(config.get("reconnect_interval_sec", 5))
        self._cap: Any = None
        # Frame mới nhất và mốc monotonic để loại ảnh cũ khi mất kết nối.
        self._frame: Optional[np.ndarray] = None
        self._updated = 0.0
        # Đồng bộ frame giữa worker và luồng phục vụ HTTP/AI.
        self._lock = threading.Lock()
        # Event báo dừng và ngắt thời gian chờ kết nối lại.
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.archive = None

    def start(self) -> None:
        """Khởi động một thread đọc camera nếu chưa chạy.

        Returns:
            Không có. Tác động: tạo worker nền.
        """
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        if os.getenv("VIDEO_ARCHIVE_ENABLED", "false").lower() == "true":
            from src.services.video_archive import VideoArchive
            self.archive = VideoArchive(self.fps)
            self.archive.start()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Báo worker dừng và chờ tối đa 12 giây.

        Returns:
            Không có. Worker tự giải phóng VideoCapture để tránh đua với read().
        """
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=12)
        if self.archive:
            self.archive.close()
        # Chỉ thread đọc sở hữu VideoCapture; không release giữa lúc read().

    def get_latest_frame(self) -> Optional[np.ndarray]:
        """Lấy bản sao ảnh gần nhất dưới khóa đồng bộ.

        Returns:
            Ảnh NumPy hoặc None nếu chưa có ảnh/ảnh cũ quá 5 giây.
        """
        with self._lock:
            if self._frame is None or time.monotonic() - self._updated > 5:
                return None
            return self._frame.copy()

    def is_connected(self) -> bool:
        """Đánh giá kết nối theo tuổi của frame gần nhất.

        Returns:
            True khi có frame trong vòng 5 giây.
        """
        with self._lock:
            return self._frame is not None and time.monotonic() - self._updated <= 5

    def _capture_loop(self) -> None:
        """Đọc ảnh liên tục và kết nối lại khi mất nguồn.

        Returns:
            Không có. Tác động: mở/đóng camera, cập nhật frame dưới khóa cho đến khi dừng.
        """
        import cv2
        is_rtsp = isinstance(self.source, str) and self.source.startswith("rtsp://")
        # TCP tránh rơi gói qua Docker bridge. Không log URL chứa mật khẩu.
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
        try:
            while not self._stop.is_set():
                try:
                    if is_rtsp:
                        self._cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG, [
                            cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000,
                            cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000,
                        ])
                    else:
                        self._cap = cv2.VideoCapture(self.source)
                        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                        self._cap.set(cv2.CAP_PROP_FPS, self.fps)
                    while not self._stop.is_set() and self._cap.isOpened():
                        ok, frame = self._cap.read()
                        if not ok:
                            break
                        with self._lock:
                            self._frame = frame
                            self._updated = time.monotonic()
                        if self.archive:
                            self.archive.submit(frame)
                        # Đọc RTSP liên tục để không tích lũy độ trễ trong buffer.
                        if not is_rtsp:
                            self._stop.wait(1 / self.fps)
                except Exception:
                    logger.warning("Camera read failed; reconnecting")
                finally:
                    if self._cap is not None:
                        self._cap.release()
                        self._cap = None
                    with self._lock:
                        self._frame = None
                if not self._stop.is_set():
                    logger.warning("Camera disconnected; check LAN, Camera Account and privacy mode")
                    self._stop.wait(self.reconnect_interval)
        finally:
            logger.info("Camera stopped")

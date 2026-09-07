"""
camera.py
Camera driver – đọc frame từ RTSP stream hoặc USB Camera.

Hỗ trợ:
- RTSP (IP Camera)
- USB Camera (V4L2 / /dev/videoX)
- Mock frame generator (cho unit testing)
"""

import logging
import threading
import time
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


class CameraDriver:
    """
    Thread-safe camera driver sử dụng OpenCV VideoCapture.

    Usage:
        cam = CameraDriver(config)
        cam.start()
        frame = cam.get_latest_frame()
        cam.stop()
    """

    def __init__(self, config: dict):
        self.source = config.get("source", 0)  # RTSP URL hoặc device index
        self.fps: int = config.get("fps", 15)
        self.width: int = config.get("resolution", {}).get("width", 1280)
        self.height: int = config.get("resolution", {}).get("height", 720)
        self.reconnect_interval: float = config.get("reconnect_interval_sec", 5.0)

        self._cap = None
        self._frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Bắt đầu thread đọc frame liên tục."""
        self._running = True
        self._thread = threading.Thread(
            target=self._capture_loop, daemon=True, name="CameraThread"
        )
        self._thread.start()
        logger.info("[Camera] Started capture from: %s", self.source)

    def stop(self) -> None:
        """Dừng thread và giải phóng capture."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5.0)
        if self._cap:
            self._cap.release()
        logger.info("[Camera] Stopped.")

    # ------------------------------------------------------------------
    # Frame Access
    # ------------------------------------------------------------------

    def get_latest_frame(self) -> Optional[np.ndarray]:
        """Trả về frame mới nhất (thread-safe). None nếu chưa có frame."""
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    def is_connected(self) -> bool:
        """Kiểm tra camera có đang kết nối không."""
        return self._cap is not None and self._cap.isOpened()

    # ------------------------------------------------------------------
    # Internal Capture Loop
    # ------------------------------------------------------------------

    def _capture_loop(self) -> None:
        while self._running:
            if not self.is_connected():
                self._connect()
                if not self.is_connected():
                    logger.warning(
                        "[Camera] Không kết nối được, thử lại sau %.1fs",
                        self.reconnect_interval,
                    )
                    time.sleep(self.reconnect_interval)
                    continue

            ret, frame = self._cap.read()
            if ret and frame is not None:
                with self._lock:
                    self._frame = frame
            else:
                logger.warning("[Camera] Mất frame, đang kết nối lại...")
                self._disconnect()
                time.sleep(self.reconnect_interval)

            time.sleep(1.0 / self.fps)

    def _connect(self) -> None:
        try:
            import cv2  # type: ignore
            self._cap = cv2.VideoCapture(self.source)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self._cap.set(cv2.CAP_PROP_FPS, self.fps)
            if self._cap.isOpened():
                logger.info("[Camera] Kết nối thành công: %s", self.source)
        except Exception as exc:  # noqa: BLE001
            logger.error("[Camera] Lỗi kết nối: %s", exc)
            self._cap = None

    def _disconnect(self) -> None:
        if self._cap:
            self._cap.release()
            self._cap = None

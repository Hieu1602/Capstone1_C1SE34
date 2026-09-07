"""
ring_buffer.py
Ring Buffer lưu trữ luân phiên 5 giây video trong RAM.

Thiết kế:
- Thread-safe deque với maxlen tính theo số frame
- Hỗ trợ snapshot: xuất N giây cuối thành list frames
- Hỗ trợ ghi clip: lưu N giây video ra file (OpenCV VideoWriter)
"""

import logging
import threading
from collections import deque
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)


class VideoRingBuffer:
    """
    Bộ đệm vòng lưu frames video trong RAM.

    Usage:
        buf = VideoRingBuffer(duration_sec=5, fps=15)
        buf.push(frame)
        clip = buf.get_last_n_seconds(3)
    """

    def __init__(self, duration_sec: float = 5.0, fps: int = 15):
        self.duration_sec = duration_sec
        self.fps = fps
        self._maxlen = int(duration_sec * fps)
        self._buffer: deque = deque(maxlen=self._maxlen)
        self._lock = threading.Lock()
        logger.info(
            "[RingBuffer] Khởi tạo buffer: %.1fs × %dfps = %d frames",
            duration_sec, fps, self._maxlen,
        )

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def push(self, frame: np.ndarray) -> None:
        """Thêm frame mới vào buffer (thread-safe)."""
        with self._lock:
            self._buffer.append(frame.copy())

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_last_n_seconds(self, seconds: float) -> List[np.ndarray]:
        """
        Lấy N giây cuối từ buffer.

        Args:
            seconds: Số giây muốn lấy (tối đa = duration_sec)

        Returns:
            List of frames (từ cũ nhất đến mới nhất)
        """
        n_frames = min(int(seconds * self.fps), self._maxlen)
        with self._lock:
            buf_list = list(self._buffer)
        return buf_list[-n_frames:] if len(buf_list) >= n_frames else buf_list

    def get_all(self) -> List[np.ndarray]:
        """Trả về toàn bộ frames trong buffer."""
        with self._lock:
            return list(self._buffer)

    def is_full(self) -> bool:
        """Kiểm tra buffer đã đầy chưa."""
        with self._lock:
            return len(self._buffer) == self._maxlen

    def frame_count(self) -> int:
        """Số frame hiện tại trong buffer."""
        with self._lock:
            return len(self._buffer)

    def clear(self) -> None:
        """Xóa toàn bộ buffer."""
        with self._lock:
            self._buffer.clear()

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def save_clip(
        self,
        output_path: str,
        pre_event_sec: float = 5.0,
        post_frames: Optional[List[np.ndarray]] = None,
    ) -> bool:
        """
        Lưu clip video ra file MP4/AVI.

        Args:
            output_path: Đường dẫn file output (e.g., '/tmp/incident_001.mp4')
            pre_event_sec: Số giây trước sự kiện cần lưu
            post_frames: Frames sau sự kiện (thu thêm sau alert)

        Returns:
            True nếu lưu thành công
        """
        try:
            import cv2  # type: ignore
        except ImportError:
            logger.error("[RingBuffer] OpenCV không khả dụng. Không thể lưu clip.")
            return False

        frames = self.get_last_n_seconds(pre_event_sec)
        if post_frames:
            frames = frames + post_frames

        if not frames:
            logger.warning("[RingBuffer] Không có frame để lưu.")
            return False

        h, w = frames[0].shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, self.fps, (w, h))

        for f in frames:
            writer.write(f)

        writer.release()
        logger.info(
            "[RingBuffer] Đã lưu clip %d frames → %s", len(frames), output_path
        )
        return True

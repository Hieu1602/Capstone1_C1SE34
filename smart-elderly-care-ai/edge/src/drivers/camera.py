"""OpenCV driver dùng chung cho AI edge và dịch vụ Tapo Docker."""
from collections import deque
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
        self.source = config.get("source")
        if not self.source and os.getenv("CAMERA_SOURCE"):
            src = os.getenv("CAMERA_SOURCE", "").strip()
            self.source = int(src) if src.isdigit() else src
        elif not self.source and (os.getenv("TAPO_HOST") or os.getenv("TAPO_USERNAME")):
            try:
                from .tapo import rtsp_url
                self.source = rtsp_url()
            except Exception:
                pass
        if self.source is None:
            self.source = 0
        self.fps = max(1, int(config.get("fps", 25)))
        self.width = config.get("resolution", {}).get("width", 1280)
        self.height = config.get("resolution", {}).get("height", 720)
        self.reconnect_interval = float(config.get("reconnect_interval_sec", 5))
        self._cap: Any = None
        # Frame mới nhất và mốc monotonic để loại ảnh cũ khi mất kết nối.
        self._frame: Optional[np.ndarray] = None
        self._frame_id: int = 0
        self._updated = 0.0
        self._audio_chunks: deque[bytes] = deque(maxlen=10)
        self._audio_lock = threading.Lock()
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
        self._archive_continuous = os.getenv("VIDEO_ARCHIVE_CONTINUOUS", "false").lower() == "true"
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

    def get_latest_frame_with_id(self) -> tuple[Optional[np.ndarray], int]:
        """Lấy bản sao ảnh gần nhất cùng ID tuần tự để phát hiện frame mới.

        Returns:
            Tuple (Ảnh NumPy hoặc None, frame_id).
        """
        with self._lock:
            if self._frame is None or time.monotonic() - self._updated > 5:
                return None, 0
            return self._frame.copy(), self._frame_id

    def is_connected(self) -> bool:
        """Đánh giá kết nối theo tuổi của frame gần nhất.

        Returns:
            True khi có frame trong vòng 5 giây.
        """
        with self._lock:
            return self._frame is not None and time.monotonic() - self._updated <= 5

    def pop_audio_chunk(self) -> Optional[bytes]:
        """Lấy 1 chunk audio 16kHz float32 mono (1 giây) nếu có."""
        with self._audio_lock:
            return self._audio_chunks.popleft() if self._audio_chunks else None

    def _capture_loop(self) -> None:
        """Đọc ảnh (và audio RTSP nếu có) liên tục và kết nối lại khi mất nguồn."""
        import cv2
        import subprocess
        is_rtsp = isinstance(self.source, str) and self.source.startswith("rtsp://")
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
        fail_count = 0
        w_out, h_out = 640, 360
        frame_bytes = w_out * h_out * 3
        try:
            while not self._stop.is_set():
                proc = None
                r_fd = None
                try:
                    if is_rtsp:
                        sources = [self.source]
                        if "/stream1" in self.source:
                            sources.append(self.source.replace("/stream1", "/stream2"))
                        elif "/stream2" in self.source:
                            sources.append(self.source.replace("/stream2", "/stream1"))

                        import socket
                        from urllib.parse import urlparse
                        for src in sources:
                            u = urlparse(src)
                            if u.hostname:
                                try:
                                    with socket.create_connection((u.hostname, u.port or 554), timeout=1.0):
                                        pass
                                except Exception:
                                    continue
                            r_fd, w_fd = os.pipe()
                            proc = subprocess.Popen(
                                [
                                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostdin",
                                    "-rtsp_transport", "tcp", "-i", src,
                                    "-map", "0:v", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w_out}x{h_out}", "pipe:1",
                                    "-map", "0:a?", "-ac", "1", "-ar", "16000", "-f", "f32le", f"pipe:{w_fd}",
                                ],
                                stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL,
                                pass_fds=(w_fd,),
                            )
                            os.close(w_fd)
                            # Thread đọc audio PCM 16kHz song song ngay lập tức để không bao giờ nghẽn pipe
                            def _drain_audio(fd: int):
                                buf = bytearray()
                                try:
                                    while not self._stop.is_set():
                                        chunk = os.read(fd, 16000)
                                        if not chunk:
                                            break
                                        buf.extend(chunk)
                                        while len(buf) >= 64000:
                                            one_sec = bytes(buf[:64000])
                                            del buf[:64000]
                                            with self._audio_lock:
                                                self._audio_chunks.append(one_sec)
                                except Exception:
                                    pass
                            threading.Thread(target=_drain_audio, args=(r_fd,), daemon=True).start()
                            first = proc.stdout.read(frame_bytes) if proc.stdout else b""
                            if len(first) == frame_bytes:
                                self.source = src

                                frame = np.frombuffer(first, dtype=np.uint8).reshape((h_out, w_out, 3)).copy()
                                fail_count = 0
                                with self._lock:
                                    self._frame = frame
                                    self._frame_id += 1
                                    self._updated = time.monotonic()
                                if self.archive and self._archive_continuous:
                                    self.archive.submit(frame)

                                while not self._stop.is_set() and proc.stdout:
                                    raw = proc.stdout.read(frame_bytes)
                                    if len(raw) != frame_bytes:
                                        break
                                    frame = np.frombuffer(raw, dtype=np.uint8).reshape((h_out, w_out, 3)).copy()
                                    fail_count = 0
                                    with self._lock:
                                        self._frame = frame
                                        self._frame_id += 1
                                        self._updated = time.monotonic()
                                    if self.archive and self._archive_continuous:
                                        self.archive.submit(frame)
                                break
                            else:
                                proc.terminate()
                                proc.wait(timeout=2)
                                proc = None
                                os.close(r_fd)
                                r_fd = None
                    else:
                        self._cap = cv2.VideoCapture(self.source)
                        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                        self._cap.set(cv2.CAP_PROP_FPS, self.fps)
                        while not self._stop.is_set() and self._cap.isOpened():
                            ok, frame = self._cap.read()
                            if not ok:
                                break
                            fail_count = 0
                            with self._lock:
                                self._frame = frame
                                self._frame_id += 1
                                self._updated = time.monotonic()
                            if self.archive and self._archive_continuous:
                                self.archive.submit(frame)
                            self._stop.wait(1 / self.fps)
                except Exception:
                    logger.warning("Camera read failed; reconnecting")
                finally:
                    if proc is not None:
                        try:
                            proc.terminate()
                            proc.wait(timeout=2)
                        except Exception:
                            try:
                                proc.kill()
                            except Exception:
                                pass
                    if r_fd is not None:
                        try:
                            os.close(r_fd)
                        except Exception:
                            pass
                    if self._cap is not None:
                        self._cap.release()
                        self._cap = None
                    with self._lock:
                        self._frame = None
                if not self._stop.is_set():
                    fail_count += 1
                    logger.warning("Camera disconnected (lần %d); check LAN, Camera Account and privacy mode", fail_count)
                    if is_rtsp and fail_count >= 1:
                        try:
                            from .tapo import discover_tapo_host, rtsp_url
                            logger.info("Đang tự động quét mạng LAN tìm IP camera mới...")
                            new_host = discover_tapo_host()
                            if new_host:
                                self.source = rtsp_url(new_host)
                                logger.info("Đã cập nhật nguồn camera sang IP mới: %s", new_host)
                                fail_count = 0
                                try:
                                    import hashlib, urllib.request, urllib.parse
                                    cpwd = os.getenv("TAPO_CONTROL_PASSWORD") or os.getenv("TAPO_CLOUD_PASSWORD") or os.getenv("TAPO_PASSWORD", "")
                                    if cpwd:
                                        ph = hashlib.sha256(cpwd.encode("utf-8")).hexdigest().upper()
                                        q = urllib.parse.urlencode({"name": "tapo_intercom", "src": f"tapo://admin:{ph}@{new_host}"})
                                        urllib.request.urlopen(urllib.request.Request(f"http://tapo-audio:1984/api/streams?{q}", method="PUT"), timeout=3)
                                except Exception:
                                    pass
                        except Exception as e:
                            logger.debug("Auto-discovery error: %s", e)
                    self._stop.wait(self.reconnect_interval)
        finally:
            logger.info("Camera stopped")

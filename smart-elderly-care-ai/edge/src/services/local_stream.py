"""
local_stream.py
RTSP / WebRTC Live Streaming Server cho Edge Hub.

Cung cấp live stream từ camera để mobile app và web dashboard
có thể xem trực tiếp không qua cloud.

Hỗ trợ:
- RTSP re-streaming qua MediaMTX (rtsp-simple-server)
- WebRTC signaling qua aiortc
"""

import asyncio
import logging
import subprocess
import threading
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# RTSP Streamer (dùng MediaMTX subprocess)
# ---------------------------------------------------------------------------

class RTSPStreamer:
    """
    Đẩy camera frames lên RTSP server (MediaMTX) qua FFmpeg pipe.

    Yêu cầu: ffmpeg và mediamtx binary cài trên hệ thống.
    """

    def __init__(self, config: dict):
        self.rtsp_port: int = config.get("rtsp_port", 8554)
        self.fps: int = config.get("fps", 15)
        self.width: int = 1280
        self.height: int = 720
        self._ffmpeg_proc: Optional[subprocess.Popen] = None
        self._running = False

    def start(self, width: int, height: int) -> None:
        """Khởi động FFmpeg pipe để stream."""
        self.width = width
        self.height = height
        self._running = True

        rtsp_url = f"rtsp://localhost:{self.rtsp_port}/live"
        cmd = [
            "ffmpeg",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-pix_fmt", "bgr24",
            "-s", f"{width}x{height}",
            "-r", str(self.fps),
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-f", "rtsp",
            rtsp_url,
        ]

        self._ffmpeg_proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        logger.info("[RTSPStreamer] FFmpeg started → %s", rtsp_url)

    def push_frame(self, frame: np.ndarray) -> None:
        """Đẩy một frame vào pipe FFmpeg."""
        if self._ffmpeg_proc and self._ffmpeg_proc.stdin:
            try:
                self._ffmpeg_proc.stdin.write(frame.tobytes())
            except BrokenPipeError:
                logger.warning("[RTSPStreamer] FFmpeg pipe broken. Đang restart...")
                self._restart()

    def stop(self) -> None:
        """Dừng FFmpeg process."""
        self._running = False
        if self._ffmpeg_proc:
            self._ffmpeg_proc.stdin.close()
            self._ffmpeg_proc.terminate()
            self._ffmpeg_proc.wait(timeout=5)
        logger.info("[RTSPStreamer] Stopped.")

    def _restart(self) -> None:
        self.stop()
        if self._running:
            self.start(self.width, self.height)


# ---------------------------------------------------------------------------
# WebRTC Signaling Server (aiortc)
# ---------------------------------------------------------------------------

class WebRTCStreamer:
    """
    WebRTC streaming server sử dụng aiortc.
    Signaling qua HTTP (aiohttp) với endpoint /offer.
    """

    def __init__(self, config: dict):
        self.port: int = config.get("webrtc_signaling_port", 8080)
        self._peer_connections = set()
        self._current_frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._app = None
        self._runner = None

    def update_frame(self, frame: np.ndarray) -> None:
        """Cập nhật frame hiện tại cho WebRTC stream."""
        with self._lock:
            self._current_frame = frame.copy()

    async def start(self) -> None:
        """Khởi động HTTP signaling server."""
        try:
            from aiohttp import web  # type: ignore
            from aiortc import RTCPeerConnection, RTCSessionDescription  # type: ignore
            from aiortc.contrib.media import MediaPlayer  # type: ignore
        except ImportError:
            logger.warning("[WebRTC] aiortc/aiohttp chưa được cài. WebRTC disabled.")
            return

        from aiohttp import web

        async def offer_handler(request):
            params = await request.json()
            offer = RTCSessionDescription(
                sdp=params["sdp"], type=params["type"]
            )
            pc = RTCPeerConnection()
            self._peer_connections.add(pc)

            @pc.on("connectionstatechange")
            async def on_state_change():
                if pc.connectionState in ("failed", "closed"):
                    self._peer_connections.discard(pc)
                    await pc.close()

            # TODO: Add video track from frame source
            await pc.setRemoteDescription(offer)
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            return web.json_response({
                "sdp": pc.localDescription.sdp,
                "type": pc.localDescription.type,
            })

        self._app = web.Application()
        self._app.router.add_post("/offer", offer_handler)

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, "0.0.0.0", self.port)
        await site.start()
        logger.info("[WebRTC] Signaling server started on port %d", self.port)

    async def stop(self) -> None:
        """Dừng tất cả peer connections và signaling server."""
        for pc in list(self._peer_connections):
            await pc.close()
        if self._runner:
            await self._runner.cleanup()
        logger.info("[WebRTC] Stopped.")

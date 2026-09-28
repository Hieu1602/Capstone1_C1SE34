"""
vitals_ws.py
WebSocket endpoint – Đẩy chỉ số sinh hiệu Real-time xuống client.

Clients (mobile app / web dashboard) kết nối WebSocket và nhận
telemetry ngay khi MQTT message đến từ Edge Hub.
"""

import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

ws_router = APIRouter()

# ---- Connection Manager ----
class VitalsConnectionManager:
    """Quản lý tất cả WebSocket connections theo device_id."""

    def __init__(self):
        # device_id (str) → list of WebSocket clients
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, device_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(device_id, []).append(ws)
        logger.info("[WS] Client kết nối device=%s. Total: %d",
                    device_id, len(self._connections[device_id]))

    def disconnect(self, device_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(device_id, [])
        if ws in conns:
            conns.remove(ws)
        logger.info("[WS] Client ngắt kết nối device=%s.", device_id)

    async def broadcast_to_device(self, device_id: str, data: dict) -> None:
        """Gửi data đến tất cả clients đang theo dõi device_id."""
        conns = self._connections.get(device_id, [])
        if not conns:
            return

        message = json.dumps(data, ensure_ascii=False)
        dead: list[WebSocket] = []

        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception:  # noqa: BLE001
                dead.append(ws)

        for ws in dead:
            self.disconnect(device_id, ws)

    async def broadcast_all(self, data: dict) -> None:
        """Gửi data đến tất cả clients."""
        for device_id in list(self._connections.keys()):
            await self.broadcast_to_device(device_id, data)


from app.services.redis import redis_service

manager = VitalsConnectionManager()


@ws_router.websocket("/vitals/{device_id}")
async def vitals_websocket(websocket: WebSocket, device_id: str):
    """
    WebSocket endpoint cho real-time vital signs.

    Client kết nối: ws://host/ws/vitals/{device_id}
    Server sẽ:
    1. Chấp nhận kết nối và đăng ký vào ConnectionManager.
    2. [REDIS TỐI ƯU]: Lấy ngay chỉ số sinh hiệu mới nhất từ Redis Cache gửi cho client
       ngay trong 1ms đầu tiên, giúp giao diện không bị trắng/loading.
    3. Lắng nghe các bản tin đẩy tiếp theo từ MQTT Subscriber.
    """
    await manager.connect(device_id, websocket)

    # --------------------------------------------------------------------------
    # BƯỚC 1: LẤY DỮ LIỆU TỨC THÌ TỪ REDIS CACHE (KHÔNG ĐỢI MQTT)
    # --------------------------------------------------------------------------
    try:
        cached_vitals = await redis_service.get_latest_vitals(device_id)
        if cached_vitals:
            initial_payload = {
                "type": "initial_telemetry",
                "source": "redis_cache",
                "device_id": device_id,
                "data": cached_vitals,
            }
            await websocket.send_text(json.dumps(initial_payload, ensure_ascii=False))
            logger.info("[WS-Redis] Đã gửi bản tin sinh hiệu tức thời từ Redis cho client: %s", device_id)
    except Exception as exc:
        logger.warning("[WS-Redis] Không thể đọc cache sinh hiệu từ Redis: %s", exc)

    # --------------------------------------------------------------------------
    # BƯỚC 2: DUY TRÌ KẾT NỐI & XỬ LÝ HEARTBEAT PING/PONG
    # --------------------------------------------------------------------------
    try:
        while True:
            # Client có thể gửi 'ping' để giữ kết nối không bị timeout
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        # Ngắt kết nối an toàn khi client đóng app hoặc tắt tab web
        manager.disconnect(device_id, websocket)


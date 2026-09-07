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


manager = VitalsConnectionManager()


@ws_router.websocket("/vitals/{device_id}")
async def vitals_websocket(websocket: WebSocket, device_id: str):
    """
    WebSocket endpoint cho real-time vital signs.

    Client kết nối: ws://host/ws/vitals/{device_id}
    Server sẽ đẩy JSON mỗi khi có telemetry mới từ Edge Hub.

    Payload format:
    {
        "type": "telemetry",
        "device_id": "hub-001",
        "timestamp": 1700000000.0,
        "heart_rate": 72,
        "spo2": 98,
        "skin_temp_max": 36.2,
        "person_count": 1,
        "fall_detected": false
    }
    """
    await manager.connect(device_id, websocket)
    try:
        while True:
            # Giữ kết nối – client có thể gửi ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(device_id, websocket)

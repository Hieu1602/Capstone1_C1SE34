"""
mqtt_subscriber.py
MQTT Subscriber – Nhận telemetry & alert từ EMQX Broker và dispatch vào hệ thống.

Luồng:
EMQX → (paho-mqtt) → MQTTSubscriber → [DB save + WS broadcast + FCM notify]
"""

import json
import logging
import threading
import time
from typing import Callable

logger = logging.getLogger(__name__)


class MQTTSubscriber:
    """
    Background MQTT listener chạy trong thread riêng.

    Nhận:
    - care/+/telemetry  → Lưu DB + broadcast WebSocket
    - care/+/alert      → Gửi FCM + lưu Incident vào DB
    - care/+/heartbeat  → Cập nhật device online status
    """

    def __init__(self):
        from app.core.config import settings
        self.broker_host = settings.MQTT_BROKER_HOST
        self.broker_port = settings.MQTT_BROKER_PORT
        self.username    = settings.MQTT_USERNAME
        self.password    = settings.MQTT_PASSWORD
        self.client_id   = settings.MQTT_CLIENT_ID

        self._client     = None
        self._thread     = None
        self._running    = False

        # Pluggable handlers
        self._telemetry_handlers: list[Callable] = []
        self._alert_handlers:     list[Callable] = []

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Khởi chạy MQTT subscriber trong daemon thread."""
        self._running = True
        self._thread = threading.Thread(
            target=self._run, daemon=True, name="MQTTSubscriber"
        )
        self._thread.start()
        logger.info("[MQTTSub] Subscriber thread started.")

    def stop(self) -> None:
        """Dừng subscriber."""
        self._running = False
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
        logger.info("[MQTTSub] Subscriber stopped.")

    # ------------------------------------------------------------------
    # Handler Registration
    # ------------------------------------------------------------------

    def on_telemetry(self, handler: Callable) -> None:
        """Đăng ký callback được gọi khi nhận telemetry."""
        self._telemetry_handlers.append(handler)

    def on_alert(self, handler: Callable) -> None:
        """Đăng ký callback được gọi khi nhận alert."""
        self._alert_handlers.append(handler)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _run(self) -> None:
        while self._running:
            try:
                self._connect_and_loop()
            except Exception as exc:  # noqa: BLE001
                logger.error("[MQTTSub] Lỗi: %s. Reconnect sau 5s...", exc)
                time.sleep(5)

    def _connect_and_loop(self) -> None:
        import paho.mqtt.client as mqtt  # type: ignore

        client = mqtt.Client(client_id=self.client_id)
        client.username_pw_set(self.username, self.password)
        client.on_connect    = self._on_connect
        client.on_message    = self._on_message
        client.on_disconnect = self._on_disconnect
        self._client = client

        client.connect(self.broker_host, self.broker_port, keepalive=60)
        client.loop_forever()

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("[MQTTSub] Kết nối thành công đến broker.")
            client.subscribe("care/+/telemetry", qos=1)
            client.subscribe("care/+/alert",     qos=2)
            client.subscribe("care/+/heartbeat", qos=0)
        else:
            logger.error("[MQTTSub] Kết nối thất bại rc=%d", rc)

    def _on_disconnect(self, client, userdata, rc):
        logger.warning("[MQTTSub] Mất kết nối rc=%d", rc)

    def _on_message(self, client, userdata, message):
        topic   = message.topic
        try:
            payload = json.loads(message.payload.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("[MQTTSub] Invalid JSON: %s", message.payload[:100])
            return

        # Xác định loại message từ topic
        parts = topic.split("/")
        if len(parts) < 3:
            return

        msg_type = parts[2]  # telemetry | alert | heartbeat

        if msg_type == "telemetry":
            for handler in self._telemetry_handlers:
                try:
                    handler(payload)
                except Exception as exc:  # noqa: BLE001
                    logger.error("[MQTTSub] Telemetry handler error: %s", exc)

        elif msg_type == "alert":
            logger.warning("[MQTTSub] ALERT nhận: %s", payload)
            for handler in self._alert_handlers:
                try:
                    handler(payload)
                except Exception as exc:  # noqa: BLE001
                    logger.error("[MQTTSub] Alert handler error: %s", exc)

        elif msg_type == "heartbeat":
            device_id = payload.get("device_id")
            logger.debug("[MQTTSub] Heartbeat từ %s", device_id)
            # TODO: Update device online status in DB/Redis

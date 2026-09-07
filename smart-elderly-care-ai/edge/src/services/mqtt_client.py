"""
mqtt_client.py
MQTT Client – Gửi telemetry và alert lên EMQX Broker.

Sử dụng paho-mqtt với reconnect tự động.
Hỗ trợ TLS và authentication.
"""

import json
import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class MQTTClient:
    """
    MQTT Publisher kết nối đến EMQX Broker.

    Usage:
        client = MQTTClient(config)
        client.connect()
        client.publish_telemetry(data)
        client.publish_alert(alert_data)
    """

    def __init__(self, config: dict):
        self.broker_host: str = config.get("broker_host", "localhost")
        self.broker_port: int = config.get("broker_port", 1883)
        self.use_tls: bool = config.get("use_tls", False)
        self.tls_port: int = config.get("broker_tls_port", 8883)
        self.username: str = config.get("username", "")
        self.password: str = config.get("password", "")
        self.client_id: str = config.get("client_id", "edge-hub-001")
        self.keepalive: int = config.get("keepalive", 60)
        self.qos: int = config.get("qos", 1)

        # Topics template
        self._topics = config.get("topics", {})
        self._device_id = config.get("client_id", "unknown")

        self._client = None
        self._connected = False

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def connect(self) -> None:
        """Kết nối đến EMQX Broker."""
        try:
            import paho.mqtt.client as mqtt  # type: ignore

            self._client = mqtt.Client(client_id=self.client_id)
            self._client.username_pw_set(self.username, self.password)

            if self.use_tls:
                import ssl
                self._client.tls_set(tls_version=ssl.PROTOCOL_TLS)

            self._client.on_connect    = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message    = self._on_message

            port = self.tls_port if self.use_tls else self.broker_port
            self._client.connect(self.broker_host, port, self.keepalive)
            self._client.loop_start()
            logger.info("[MQTT] Đang kết nối đến %s:%d", self.broker_host, port)

        except ImportError:
            logger.error("[MQTT] paho-mqtt chưa được cài đặt.")
        except Exception as exc:  # noqa: BLE001
            logger.error("[MQTT] Lỗi kết nối: %s", exc)

    def disconnect(self) -> None:
        """Ngắt kết nối MQTT."""
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
        logger.info("[MQTT] Đã ngắt kết nối.")

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    def publish_telemetry(self, data: Dict[str, Any]) -> bool:
        """
        Gửi gói tin telemetry (chỉ số sinh hiệu, nhiệt độ, v.v.).

        Args:
            data: Dict chứa các trường dữ liệu cảm biến

        Returns:
            True nếu gửi thành công
        """
        topic = self._resolve_topic("telemetry")
        payload = {
            "device_id": self._device_id,
            "timestamp":  time.time(),
            **data,
        }
        return self._publish(topic, payload)

    def publish_alert(self, alert_data: Dict[str, Any]) -> bool:
        """
        Gửi gói tin cảnh báo khẩn cấp.

        Args:
            alert_data: Dict chứa thông tin cảnh báo từ DecisionMatrix

        Returns:
            True nếu gửi thành công
        """
        topic = self._resolve_topic("alert")
        payload = {
            "device_id": self._device_id,
            "timestamp":  time.time(),
            **alert_data,
        }
        return self._publish(topic, payload, qos=2)  # QoS 2 cho alert

    def publish_heartbeat(self) -> bool:
        """Gửi heartbeat định kỳ để cloud biết hub còn online."""
        topic = self._resolve_topic("heartbeat")
        payload = {
            "device_id": self._device_id,
            "timestamp":  time.time(),
            "status": "online",
        }
        return self._publish(topic, payload, qos=0)

    def _publish(
        self,
        topic: str,
        payload: Dict,
        qos: Optional[int] = None,
    ) -> bool:
        if not self._connected or self._client is None:
            logger.warning("[MQTT] Chưa kết nối, không thể gửi: %s", topic)
            return False
        try:
            result = self._client.publish(
                topic,
                json.dumps(payload, ensure_ascii=False),
                qos=qos if qos is not None else self.qos,
                retain=False,
            )
            return result.rc == 0
        except Exception as exc:  # noqa: BLE001
            logger.error("[MQTT] Lỗi publish: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Subscription (for receiving commands from cloud)
    # ------------------------------------------------------------------

    def subscribe_commands(self) -> None:
        """Đăng ký topic nhận lệnh từ cloud (ví dụ: bật/tắt camera)."""
        if self._client and self._connected:
            topic = self._resolve_topic("command")
            self._client.subscribe(topic, qos=1)
            logger.info("[MQTT] Subscribed command topic: %s", topic)

    # ------------------------------------------------------------------
    # Callbacks
    # ------------------------------------------------------------------

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            logger.info("[MQTT] Kết nối thành công.")
            self.subscribe_commands()
        else:
            logger.error("[MQTT] Kết nối thất bại, rc=%d", rc)

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        logger.warning("[MQTT] Mất kết nối (rc=%d). Paho sẽ tự reconnect.", rc)

    def _on_message(self, client, userdata, message):
        try:
            payload = json.loads(message.payload.decode("utf-8"))
            logger.info("[MQTT] Nhận lệnh từ cloud: %s → %s", message.topic, payload)
            # TODO: Dispatch command handler
        except Exception as exc:  # noqa: BLE001
            logger.error("[MQTT] Lỗi parse message: %s", exc)

    # ------------------------------------------------------------------
    # Helper
    # ------------------------------------------------------------------

    def _resolve_topic(self, key: str) -> str:
        """Thay thế {device_id} trong topic template."""
        template = self._topics.get(key, f"care/{{device_id}}/{key}")
        return template.replace("{device_id}", self._device_id)

    @property
    def is_connected(self) -> bool:
        return self._connected

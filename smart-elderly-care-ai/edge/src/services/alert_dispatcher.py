"""
alert_dispatcher.py
Điều phối tổng hợp cảnh báo: gửi MQTT + phát loa cục bộ đồng thời.

Tách biệt trách nhiệm điều phối khỏi EdgeGateway (Single Responsibility).
Các output channel (MQTT, Speaker) được inject qua constructor (DI).
"""

import asyncio
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class AlertDispatcher:
    """
    Điều phối phát cảnh báo qua đa kênh: MQTT Broker & Loa cục bộ.

    Nhận quyết định từ DecisionMatrix và fan-out đến các output channel.
    Không biết chi tiết triển khai của từng channel (loose coupling).

    Usage:
        dispatcher = AlertDispatcher(mqtt_client, speaker, ring_buffer)
        await dispatcher.dispatch(decision, incident_id)
    """

    # Alert levels kích hoạt còi SOS
    HIGH_ALERT_LEVELS = frozenset({"HIGH", "CRITICAL"})

    def __init__(
        self,
        mqtt_client: Any,
        speaker: Any,
        ring_buffer: Any,
    ) -> None:
        """
        Args:
            mqtt_client: MQTTClient instance – gửi alert lên EMQX Broker.
            speaker: LocalSpeaker instance – phát giọng nói tiếng Việt.
            ring_buffer: VideoRingBuffer instance – lưu clip bằng chứng.
        """
        self._mqtt = mqtt_client
        self._speaker = speaker
        self._ring_buffer = ring_buffer

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def dispatch(self, decision: Any) -> int:
        """
        Xử lý một quyết định cảnh báo từ DecisionMatrix.

        Thực hiện song song:
        1. Lưu video clip bằng chứng (5 giây trước sự kiện)
        2. Lưu 3 ảnh snapshot
        3. Publish alert MQTT kèm bằng chứng
        4. Phát giọng nói cảnh báo tiếng Việt qua loa
        5. Phát còi SOS nếu mức độ HIGH/CRITICAL

        Args:
            decision: Đối tượng AlertDecision từ DecisionMatrix.

        Returns:
            incident_id (int) – Unix timestamp dùng làm ID sự kiện.
        """
        incident_id = int(time.time())

        logger.warning(
            "[Alert] %s [%s] – %s",
            decision.alert_type.value,
            decision.alert_level.value,
            decision.message_vi,
        )

        # --- Lưu bằng chứng video ---
        clip_path = f"/tmp/incident_{incident_id}.mp4"
        self._ring_buffer.save_clip(clip_path, pre_event_sec=5.0)
        snapshot_paths = self._ring_buffer.save_incident_snapshots(
            f"/tmp/incident_{incident_id}"
        )

        # --- Gửi MQTT alert ---
        self._mqtt.publish_alert({
            "alert_type":  decision.alert_type.value,
            "alert_level": decision.alert_level.value,
            "message":     decision.message_vi,
            "confidence":  decision.confidence,
            "sources":     decision.sources,
            "incident_id": incident_id,
            "snapshots":   snapshot_paths,
            "clip_path":   clip_path,
        })

        # --- Phát âm thanh song song (non-blocking) ---
        asyncio.ensure_future(self._speaker.speak(decision.message_vi))
        if decision.alert_level.value in self.HIGH_ALERT_LEVELS:
            asyncio.ensure_future(self._speaker.play_alert_sound())

        return incident_id

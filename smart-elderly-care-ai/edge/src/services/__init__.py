"""
services/ – External Communication & Output Services.

  - mqtt_client   : Gửi telemetry/alert lên EMQX Broker
  - local_speaker : Text-to-Speech cảnh báo qua loa cục bộ
  - local_stream  : RTSP/WebRTC live stream từ camera
  - alert_dispatcher : Điều phối tổng hợp alert (MQTT + Speaker)
"""

from src.services.mqtt_client import MQTTClient
from src.services.local_speaker import LocalSpeaker
from src.services.local_stream import RTSPStreamer
from src.services.alert_dispatcher import AlertDispatcher

__all__ = [
    "MQTTClient",
    "LocalSpeaker",
    "RTSPStreamer",
    "AlertDispatcher",
]

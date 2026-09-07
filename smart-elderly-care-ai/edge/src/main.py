"""
main.py
Entry point – Khởi chạy toàn bộ Edge Gateway trên Orange Pi 5.

Pipeline:
1. Load config
2. Khởi tạo tất cả drivers (Camera, BLE, Thermal)
3. Khởi tạo AI models (PoseDetector, SoundClassifier)
4. Kết nối MQTT
5. Chạy vòng lặp inference song song (asyncio + threads)
6. Phát alert qua MQTT & loa khi Decision Matrix xác nhận
"""

import asyncio
import logging
import os
import signal
import time
from pathlib import Path

import yaml

# ---- Edge Modules ----
from src.ai.audio.sound_classifier import AudioAlertEvent, SoundClassifier
from src.ai.vision.pose_detector import PoseDetector
from src.drivers.ble_band import BLEBandDriver, VitalReading
from src.drivers.camera import CameraDriver
from src.drivers.thermal_amg8833 import ThermalAMG8833Driver
from src.fusion.decision_matrix import DecisionMatrix, SensorSignals
from src.fusion.ring_buffer import VideoRingBuffer
from src.services.local_speaker import LocalSpeaker
from src.services.local_stream import RTSPStreamer
from src.services.mqtt_client import MQTTClient

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("EdgeGateway")


# ---------------------------------------------------------------------------
# Config Loader
# ---------------------------------------------------------------------------

def load_config(path: str = "config/config.yaml") -> dict:
    """Load YAML config. Override with environment variables nếu có."""
    config_path = Path(__file__).parent.parent / path
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    # Override nhạy cảm từ environment
    mqtt_cfg = cfg.setdefault("mqtt", {})
    mqtt_cfg["password"] = os.environ.get("MQTT_PASSWORD", mqtt_cfg.get("password", ""))
    mqtt_cfg["username"] = os.environ.get("MQTT_USERNAME", mqtt_cfg.get("username", ""))

    return cfg


# ---------------------------------------------------------------------------
# EdgeGateway Application
# ---------------------------------------------------------------------------

class EdgeGateway:
    """Orchestrator chính của Edge Hub."""

    def __init__(self, config: dict):
        self.config = config
        self._shutdown_event = asyncio.Event()

        # Shared sensor state
        self._signals = SensorSignals()
        self._last_motion_time: float = time.time()

        # ---- Drivers ----
        self.camera    = CameraDriver(config["camera"])
        self.thermal   = ThermalAMG8833Driver(config["thermal"])
        self.ble_band  = BLEBandDriver(config["ble"])

        # ---- AI ----
        self.pose_detector    = PoseDetector(config["ai"]["vision"])
        self.sound_classifier = SoundClassifier(config["ai"]["audio"])

        # ---- Fusion ----
        # Merge thresholds vào config cho DecisionMatrix
        fusion_cfg = {**config["fusion"], "thresholds": config["thresholds"]}
        self.decision_matrix = DecisionMatrix(fusion_cfg)

        # ---- Ring Buffer ----
        fps = config["camera"]["fps"]
        self.ring_buffer = VideoRingBuffer(
            duration_sec=config["fusion"]["ring_buffer_duration_sec"],
            fps=fps,
        )

        # ---- Services ----
        self.mqtt_client = MQTTClient(config["mqtt"])
        self.speaker     = LocalSpeaker(config["speaker"])
        self.rtsp_stream = RTSPStreamer({
            **config["streaming"],
            "fps": fps,
        })

    # ------------------------------------------------------------------
    # Start / Stop
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Khởi động toàn bộ Edge Gateway."""
        logger.info("=== Edge Gateway đang khởi động ===")

        # Khởi tạo phần cứng
        self.camera.start()
        self.thermal.initialize()
        self.pose_detector.load_model()
        self.sound_classifier.load_model()
        self.mqtt_client.connect()

        # Khởi động RTSP stream
        if self.config["streaming"]["enabled"]:
            self.rtsp_stream.start(
                self.config["camera"]["resolution"]["width"],
                self.config["camera"]["resolution"]["height"],
            )

        # Chạy các task song song
        await asyncio.gather(
            self._vision_loop(),
            self._thermal_loop(),
            self._ble_loop(),
            self._heartbeat_loop(),
            self.speaker.run_scheduled_reminders(
                self.config["speaker"].get("reminder_schedule", [])
            ),
        )

    async def stop(self) -> None:
        """Tắt toàn bộ Edge Gateway một cách sạch sẽ."""
        logger.info("=== Edge Gateway đang dừng ===")
        self._shutdown_event.set()
        self.camera.stop()
        self.mqtt_client.disconnect()
        self.rtsp_stream.stop()
        self.pose_detector.release()
        await self.ble_band.disconnect()
        self.thermal.close()
        logger.info("=== Edge Gateway đã dừng ===")

    # ------------------------------------------------------------------
    # Main Loops
    # ------------------------------------------------------------------

    async def _vision_loop(self) -> None:
        """Vòng lặp chính: Đọc frame → Inference → Decision."""
        logger.info("[Vision] Loop bắt đầu.")
        fps = self.config["camera"]["fps"]
        interval = 1.0 / fps

        while not self._shutdown_event.is_set():
            frame = self.camera.get_latest_frame()
            if frame is None:
                await asyncio.sleep(interval)
                continue

            # Lưu vào ring buffer
            self.ring_buffer.push(frame)

            # Đẩy lên RTSP stream
            if self.config["streaming"]["enabled"]:
                self.rtsp_stream.push_frame(frame)

            # Chạy pose detection trong thread pool
            result = await asyncio.get_event_loop().run_in_executor(
                None, self.pose_detector.detect, frame
            )

            # Cập nhật signals
            self._signals.fall_detected_camera = result.is_fall_detected
            self._signals.person_count         = result.person_count

            if result.person_count > 0:
                self._last_motion_time = time.time()
                self._signals.last_motion_time = self._last_motion_time

            # Publish telemetry MQTT
            self.mqtt_client.publish_telemetry({
                "person_count": result.person_count,
                "fall_detected": result.is_fall_detected,
            })

            # Đánh giá Decision Matrix
            await self._evaluate_and_alert()

            await asyncio.sleep(interval)

    async def _thermal_loop(self) -> None:
        """Vòng lặp đọc cảm biến nhiệt AMG8833."""
        interval = self.config["thermal"]["poll_interval_sec"]
        while not self._shutdown_event.is_set():
            grid, max_temp = self.thermal.read_thermal_grid()
            if max_temp is not None:
                self._signals.max_skin_temp = max_temp
                self.mqtt_client.publish_telemetry({"skin_temp_max": max_temp})
            await asyncio.sleep(interval)

    async def _ble_loop(self) -> None:
        """Vòng lặp kết nối BLE và đọc HR / SpO2."""
        if not self.config["ble"]["enabled"]:
            return

        def on_vital(reading: VitalReading):
            self._signals.heart_rate = reading.heart_rate
            self._signals.spo2       = reading.spo2
            self.mqtt_client.publish_telemetry({
                "heart_rate": reading.heart_rate,
                "spo2":       reading.spo2,
            })

        while not self._shutdown_event.is_set():
            connected = await self.ble_band.connect()
            if connected:
                await self.ble_band.start_notifications(on_vital)
            else:
                await asyncio.sleep(
                    self.config["ble"]["reconnect_interval_sec"]
                )

    async def _heartbeat_loop(self) -> None:
        """Gửi heartbeat lên cloud mỗi 60 giây."""
        while not self._shutdown_event.is_set():
            self.mqtt_client.publish_heartbeat()
            await asyncio.sleep(60)

    # ------------------------------------------------------------------
    # Alert Handler
    # ------------------------------------------------------------------

    async def _evaluate_and_alert(self) -> None:
        """Gọi DecisionMatrix, nếu có alert thì xử lý."""
        decision = self.decision_matrix.evaluate(self._signals)
        if decision is None:
            return

        logger.warning(
            "[ALERT] %s [%s] – %s",
            decision.alert_type.value,
            decision.alert_level.value,
            decision.message_vi,
        )

        # Gửi alert MQTT
        self.mqtt_client.publish_alert({
            "alert_type":  decision.alert_type.value,
            "alert_level": decision.alert_level.value,
            "message":     decision.message_vi,
            "confidence":  decision.confidence,
            "sources":     decision.sources,
        })

        # Lưu video clip bằng chứng
        clip_path = f"/tmp/incident_{int(time.time())}.mp4"
        self.ring_buffer.save_clip(clip_path, pre_event_sec=5.0)

        # Phát cảnh báo qua loa
        asyncio.ensure_future(self.speaker.speak(decision.message_vi))
        if decision.alert_level.value in ("HIGH", "CRITICAL"):
            asyncio.ensure_future(self.speaker.play_alert_sound())


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

async def main():
    config = load_config()

    gateway = EdgeGateway(config)

    # Graceful shutdown
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.ensure_future(gateway.stop()))

    try:
        await gateway.start()
    except KeyboardInterrupt:
        await gateway.stop()


if __name__ == "__main__":
    asyncio.run(main())

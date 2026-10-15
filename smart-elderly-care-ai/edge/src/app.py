"""
app.py
EdgeApp – Lớp orchestrator trung tâm của Edge Gateway.

Chịu trách nhiệm:
- Khởi tạo và liên kết tất cả drivers, AI models, và services
- Điều phối các asyncio loops song song
- Graceful startup & shutdown

main.py chỉ còn đúng 1 việc: parse args và gọi EdgeApp.run().
"""

import asyncio
import logging
import time
from pathlib import Path

from src.ai.audio.sound_classifier import AudioAlertEvent, SoundClassifier
from src.ai.vision.pose_detector import PoseDetector, PoseResult
from src.drivers.ble_band import BLEBandDriver, VitalReading
from src.drivers.camera import CameraDriver
from src.drivers.thermal_amg8833 import ThermalAMG8833Driver
from src.fusion.decision_matrix import DecisionMatrix, SensorSignals
from src.fusion.ring_buffer import VideoRingBuffer
from src.services.alert_dispatcher import AlertDispatcher
from src.services.local_speaker import LocalSpeaker
from src.services.local_stream import RTSPStreamer
from src.services.mqtt_client import MQTTClient

logger = logging.getLogger("EdgeApp")


class EdgeApp:
    """
    Orchestrator trung tâm của Edge Gateway trên Orange Pi 5.

    Áp dụng Dependency Injection: tất cả dependencies được khởi tạo
    tại đây và truyền vào nhau, không có global state.

    Pipeline:
        1. Khởi tạo drivers (Camera, BLE, Thermal)
        2. Khởi tạo AI models (PoseDetector, SoundClassifier)
        3. Khởi tạo Fusion engine (DecisionMatrix, RingBuffer)
        4. Khởi tạo Services (MQTT, Speaker, RTSP, AlertDispatcher)
        5. Chạy vòng lặp inference song song (asyncio)
        6. Graceful shutdown khi nhận tín hiệu dừng

    Usage:
        app = EdgeApp(config)
        await app.start()
    """

    def __init__(self, config: dict) -> None:
        self.config = config
        self._shutdown_event = asyncio.Event()
        self._signals = SensorSignals()
        self._last_motion_time: float = time.time()

        # ---- Drivers ----
        self.camera   = CameraDriver(config["camera"])
        self.thermal  = ThermalAMG8833Driver(config["thermal"])
        self.ble_band = BLEBandDriver(config["ble"])

        # ---- AI Models ----
        self.pose_detector    = PoseDetector(config["ai"]["vision"])
        self.sound_classifier = SoundClassifier(config["ai"]["audio"])

        # ---- Fusion ----
        fusion_cfg = {**config["fusion"], "thresholds": config["thresholds"]}
        self.decision_matrix = DecisionMatrix(fusion_cfg)
        self.ring_buffer = VideoRingBuffer(
            duration_sec=config["fusion"]["ring_buffer_duration_sec"],
            fps=config["camera"]["fps"],
        )

        # ---- Services ----
        self.mqtt_client = MQTTClient(config["mqtt"])
        self.speaker     = LocalSpeaker(config["speaker"])
        self.rtsp_stream = RTSPStreamer({
            **config["streaming"],
            "fps": config["camera"]["fps"],
        })
        # AlertDispatcher điều phối alert thay vì để trong EdgeGateway
        self.alert_dispatcher = AlertDispatcher(
            mqtt_client=self.mqtt_client,
            speaker=self.speaker,
            ring_buffer=self.ring_buffer,
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Khởi động toàn bộ Edge Gateway."""
        logger.info("=== Edge Gateway đang khởi động ===")

        self.camera.start()
        self.thermal.initialize()
        self.pose_detector.load_model()
        self.sound_classifier.load_model()
        self.mqtt_client.connect()

        if self.config["streaming"]["enabled"]:
            res = self.config["camera"]["resolution"]
            self.rtsp_stream.start(res["width"], res["height"])

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
        """Tắt toàn bộ Edge Gateway sạch sẽ."""
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
    # Sensor Loops
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

            self.ring_buffer.push(frame)

            result = await asyncio.get_event_loop().run_in_executor(
                None, self.pose_detector.detect, frame
            )

            if self.config["streaming"]["enabled"]:
                stream_frame = (
                    result.anonymized_frame
                    if result.anonymized_frame is not None
                    else frame
                )
                self.rtsp_stream.push_frame(stream_frame)

            # Cập nhật sensor signals
            self._signals.fall_detected_camera       = result.is_fall_detected
            self._signals.immobility_detected_camera = result.is_immobile_detected
            self._signals.fall_confidence            = result.confidence
            self._signals.person_count               = result.person_count

            if result.person_count > 0:
                self._last_motion_time = time.time()
                self._signals.last_motion_time = self._last_motion_time

            # Publish telemetry MQTT
            telemetry_data = self._build_telemetry(result)
            self.mqtt_client.publish_telemetry(telemetry_data)

            # Đánh giá Decision Matrix và phát cảnh báo nếu cần
            await self._evaluate_and_alert()
            await asyncio.sleep(interval)

    async def _thermal_loop(self) -> None:
        """Vòng lặp đọc cảm biến nhiệt AMG8833."""
        interval = self.config["thermal"]["poll_interval_sec"]
        while not self._shutdown_event.is_set():
            _, max_temp = self.thermal.read_thermal_grid()
            if max_temp is not None:
                self._signals.max_skin_temp = max_temp
                self.mqtt_client.publish_telemetry({"skin_temp_max": max_temp})
            await asyncio.sleep(interval)

    async def _ble_loop(self) -> None:
        """Vòng lặp kết nối BLE và đọc HR / SpO2."""
        if not self.config["ble"]["enabled"]:
            return

        def on_vital(reading: VitalReading) -> None:
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
                await asyncio.sleep(self.config["ble"]["reconnect_interval_sec"])

    async def _heartbeat_loop(self) -> None:
        """Gửi heartbeat lên cloud mỗi 60 giây."""
        while not self._shutdown_event.is_set():
            self.mqtt_client.publish_heartbeat()
            await asyncio.sleep(60)

    # ------------------------------------------------------------------
    # Alert Evaluation
    # ------------------------------------------------------------------

    async def _evaluate_and_alert(self) -> None:
        """Gọi DecisionMatrix; nếu có alert thì delegate sang AlertDispatcher."""
        decision = self.decision_matrix.evaluate(self._signals)
        if decision is None:
            return
        await self.alert_dispatcher.dispatch(decision)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_telemetry(self, result: PoseResult) -> dict:
        """Xây dựng dict telemetry từ kết quả PoseDetector."""
        data: dict = {
            "person_count":      result.person_count,
            "fall_detected":     result.is_fall_detected,
            "immobile_detected": result.is_immobile_detected,
            "confidence":        round(result.confidence, 2),
        }
        if result.tracks:
            primary = result.tracks[0]
            state_val = getattr(primary.posture_state, "value", str(primary.posture_state))
            data["primary_activity"] = state_val
            data["adl_stats"] = {
                "activity":             state_val,
                "sitting_duration_sec": round(primary.adl_stats.sitting_duration_sec, 1),
                "standing_duration_sec": round(primary.adl_stats.standing_duration_sec, 1),
                "lying_duration_sec":   round(primary.adl_stats.lying_duration_sec, 1),
                "drinking_count":       primary.adl_stats.drinking_count,
                "sedentary_warning":    primary.adl_stats.sedentary_warning,
            }
            data["tracks"] = [
                {
                    "track_id":             t.track_id,
                    "state":                getattr(t.posture_state, "value", str(t.posture_state)),
                    "activity_duration_sec": round(time.time() - t.state_enter_time, 1),
                    "sedentary_warning":    t.adl_stats.sedentary_warning,
                }
                for t in result.tracks
            ]
        return data

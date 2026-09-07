"""
decision_matrix.py
Sensor Fusion Decision Matrix – loại trừ báo động giả (False Positive).

Logic:
- Thu thập tín hiệu từ nhiều nguồn (camera AI, âm thanh, BLE, nhiệt độ)
- Áp dụng ma trận quyết định để xác nhận alert thực sự
- Debounce để tránh spam cảnh báo
- Phân loại mức độ nghiêm trọng: LOW / MEDIUM / HIGH / CRITICAL
"""

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enumerations & Data Types
# ---------------------------------------------------------------------------

class AlertLevel(str, Enum):
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


class AlertType(str, Enum):
    FALL_DETECTED     = "FALL_DETECTED"
    ABNORMAL_HR       = "ABNORMAL_HR"
    LOW_SPO2          = "LOW_SPO2"
    HIGH_TEMPERATURE  = "HIGH_TEMPERATURE"
    EMERGENCY_SOUND   = "EMERGENCY_SOUND"
    INACTIVITY        = "INACTIVITY"
    COMPOUND          = "COMPOUND"  # Kết hợp nhiều nguồn


@dataclass
class SensorSignals:
    """Snapshot tín hiệu từ tất cả cảm biến tại một thời điểm."""
    timestamp: float = field(default_factory=time.time)

    # Vision
    fall_detected_camera: bool = False
    person_count: int = 0

    # Audio
    emergency_sound_detected: bool = False
    audio_class: Optional[str] = None
    audio_confidence: float = 0.0

    # BLE Band
    heart_rate: Optional[int] = None    # bpm
    spo2: Optional[int] = None          # %

    # Thermal
    max_skin_temp: Optional[float] = None  # °C

    # Presence / Activity
    last_motion_time: Optional[float] = None


@dataclass
class DecisionResult:
    """Kết quả phán quyết của Decision Matrix."""
    should_alert: bool
    alert_type: AlertType
    alert_level: AlertLevel
    confidence: float          # 0.0 – 1.0
    sources: list              # Danh sách nguồn xác nhận
    message_vi: str            # Thông điệp tiếng Việt
    timestamp: float = field(default_factory=time.time)


# ---------------------------------------------------------------------------
# Decision Matrix Engine
# ---------------------------------------------------------------------------

class DecisionMatrix:
    """
    Ma trận quyết định chống báo động giả cho hệ thống Smart Elderly Care.

    Quy tắc:
    - CRITICAL: ≥2 nguồn xác nhận té ngã, hoặc SpO2 < 90%
    - HIGH:     1 nguồn rõ ràng (ngã camera) + 1 nguồn hỗ trợ (âm thanh/nhiệt)
    - MEDIUM:   1 nguồn rõ ràng đơn lẻ
    - LOW:      Cảnh báo ngưỡng nhẹ (HR cao nhẹ, nhiệt độ hơi cao)
    """

    def __init__(self, config: dict):
        self.min_sources: int = config.get("fall_detection_min_sources", 2)
        self.debounce_sec: float = config.get("alert_debounce_sec", 30.0)
        self.inactivity_timeout: float = config.get(
            "thresholds", {}
        ).get("presence", {}).get("timeout_minutes", 30) * 60

        # Ngưỡng sinh hiệu
        thresholds = config.get("thresholds", {})
        self.hr_min: int = thresholds.get("heart_rate", {}).get("min", 50)
        self.hr_max: int = thresholds.get("heart_rate", {}).get("max", 120)
        self.spo2_critical: int = thresholds.get("spo2", {}).get("min", 90)
        self.spo2_warning: int = thresholds.get("spo2", {}).get("warning", 94)
        self.temp_max: float = thresholds.get("temperature", {}).get("skin_max", 38.5)
        self.temp_min: float = thresholds.get("temperature", {}).get("skin_min", 35.0)

        # Debounce state
        self._last_alert_times: Dict[AlertType, float] = {}

    # ------------------------------------------------------------------
    # Main Evaluation
    # ------------------------------------------------------------------

    def evaluate(self, signals: SensorSignals) -> Optional[DecisionResult]:
        """
        Phân tích tập hợp tín hiệu và trả về DecisionResult nếu cần alert.
        Trả về None nếu không có tình huống nguy hiểm.
        """
        # ---- Kiểm tra SpO2 nguy hiểm ----
        if signals.spo2 is not None and signals.spo2 < self.spo2_critical:
            return self._make_result(
                alert_type=AlertType.LOW_SPO2,
                level=AlertLevel.CRITICAL,
                confidence=0.95,
                sources=["ble_band"],
                message=f"SpO2 nguy hiểm: {signals.spo2}%. Cần kiểm tra ngay!",
            )

        # ---- Kiểm tra té ngã ----
        fall_sources = []
        if signals.fall_detected_camera:
            fall_sources.append("camera_ai")
        if signals.emergency_sound_detected and signals.audio_class in (
            "Thud", "Screaming"
        ):
            fall_sources.append("audio_ai")

        if len(fall_sources) >= self.min_sources:
            level = AlertLevel.CRITICAL
        elif len(fall_sources) == 1:
            level = AlertLevel.HIGH
        else:
            level = None

        if level:
            return self._make_result(
                alert_type=AlertType.FALL_DETECTED,
                level=level,
                confidence=min(0.6 + len(fall_sources) * 0.2, 1.0),
                sources=fall_sources,
                message=f"Phát hiện té ngã! Xác nhận bởi: {', '.join(fall_sources)}",
            )

        # ---- Kiểm tra HR bất thường ----
        if signals.heart_rate is not None:
            if signals.heart_rate > self.hr_max or signals.heart_rate < self.hr_min:
                return self._make_result(
                    alert_type=AlertType.ABNORMAL_HR,
                    level=AlertLevel.MEDIUM,
                    confidence=0.85,
                    sources=["ble_band"],
                    message=f"Nhịp tim bất thường: {signals.heart_rate} bpm",
                )

        # ---- Kiểm tra SpO2 cảnh báo (warning level) ----
        if signals.spo2 is not None and signals.spo2 < self.spo2_warning:
            return self._make_result(
                alert_type=AlertType.LOW_SPO2,
                level=AlertLevel.MEDIUM,
                confidence=0.80,
                sources=["ble_band"],
                message=f"SpO2 thấp: {signals.spo2}%. Cần theo dõi.",
            )

        # ---- Kiểm tra nhiệt độ da ----
        if signals.max_skin_temp is not None:
            if signals.max_skin_temp > self.temp_max:
                return self._make_result(
                    alert_type=AlertType.HIGH_TEMPERATURE,
                    level=AlertLevel.MEDIUM,
                    confidence=0.75,
                    sources=["thermal_sensor"],
                    message=f"Nhiệt độ da cao: {signals.max_skin_temp:.1f}°C",
                )

        # ---- Kiểm tra không có chuyển động (inactivity) ----
        if signals.last_motion_time and signals.person_count == 0:
            inactive_duration = time.time() - signals.last_motion_time
            if inactive_duration > self.inactivity_timeout:
                return self._make_result(
                    alert_type=AlertType.INACTIVITY,
                    level=AlertLevel.LOW,
                    confidence=0.65,
                    sources=["camera_ai"],
                    message=f"Không phát hiện hoạt động trong {inactive_duration/60:.0f} phút",
                )

        # ---- Âm thanh khẩn cấp đơn lẻ ----
        if signals.emergency_sound_detected:
            return self._make_result(
                alert_type=AlertType.EMERGENCY_SOUND,
                level=AlertLevel.HIGH,
                confidence=signals.audio_confidence,
                sources=["audio_ai"],
                message=f"Phát hiện âm thanh khẩn cấp: {signals.audio_class}",
            )

        return None  # Không có sự kiện cần cảnh báo

    # ------------------------------------------------------------------
    # Helper
    # ------------------------------------------------------------------

    def _make_result(
        self,
        alert_type: AlertType,
        level: AlertLevel,
        confidence: float,
        sources: list,
        message: str,
    ) -> Optional[DecisionResult]:
        """Tạo DecisionResult sau khi kiểm tra debounce."""
        now = time.time()
        last = self._last_alert_times.get(alert_type, 0)

        if now - last < self.debounce_sec:
            logger.debug(
                "[DecisionMatrix] Alert %s bị debounce (%.0fs còn lại)",
                alert_type.value,
                self.debounce_sec - (now - last),
            )
            return None

        self._last_alert_times[alert_type] = now
        logger.warning("[DecisionMatrix] ALERT %s [%s]: %s", level.value, alert_type.value, message)

        return DecisionResult(
            should_alert=True,
            alert_type=alert_type,
            alert_level=level,
            confidence=confidence,
            sources=sources,
            message_vi=message,
        )

    def reset_debounce(self, alert_type: AlertType) -> None:
        """Xóa debounce cho một loại alert (dùng khi sự kiện đã được xử lý)."""
        self._last_alert_times.pop(alert_type, None)

"""
sound_classifier.py
YAMNet-based audio emergency sound classifier for Edge Hub & Tapo Camera.

Supports ONNX Runtime (yamnet.onnx) and TFLite fallback for classifying
impact sounds (va đập) and distress/help sounds (kêu cứu).
"""

import asyncio
import csv
from dataclasses import dataclass
import inspect
import logging
import os
from pathlib import Path
import time
from typing import Callable, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

DISTRESS_CLASSES = frozenset({
    "Screaming", "Shout", "Yell", "Crying, sobbing", "Wail, moan", "Groan", "Whimper"
})
IMPACT_CLASSES = frozenset({
    "Thump, thud", "Smash, crash", "Glass", "Shatter", "Breaking", "Bang", "Slam", "Knock", "Tap"
})

CLASS_VI_LABELS = {
    "Screaming": "Tiếng hét thất thanh",
    "Shout": "Tiếng hô hoán / kêu cứu",
    "Yell": "Tiếng la lớn",
    "Crying, sobbing": "Tiếng khóc nức nở",
    "Wail, moan": "Tiếng rên rỉ đau đớn",
    "Groan": "Tiếng rên đau",
    "Whimper": "Tiếng rên nhỏ",
    "Thump, thud": "Tiếng va đập mạnh",
    "Smash, crash": "Tiếng đổ vỡ mạnh",
    "Glass": "Tiếng kính vỡ",
    "Shatter": "Tiếng vỡ vụn",
    "Breaking": "Tiếng gãy vỡ",
    "Bang": "Tiếng nổ / va chạm mạnh",
    "Slam": "Tiếng đóng sầm / va đập",
    "Knock": "Tiếng gõ / va chạm",
    "Tap": "Tiếng gõ nhẹ",
}


@dataclass
class AudioAlertEvent:
    """Sự kiện âm thanh khẩn cấp được phát hiện."""
    timestamp: float
    class_name: str
    confidence: float
    category: str = "DISTRESS"  # DISTRESS | IMPACT
    audio_snapshot: Optional[np.ndarray] = None  # raw PCM


class SoundClassifier:
    """YAMNet-based audio classifier chạy trên ONNX Runtime (ưu tiên) hoặc TFLite."""

    YAMNET_SAMPLE_RATE = 16000

    def __init__(self, config: Optional[dict] = None):
        config = config or {}
        self.config = config
        default_onnx = Path(__file__).resolve().parent / "models" / "yamnet.onnx"
        self.model_path: str = config.get("model_path") or (
            str(default_onnx) if default_onnx.exists() else "src/ai/audio/models/yamnet.onnx"
        )
        self.sample_rate: int = int(config.get("sample_rate", self.YAMNET_SAMPLE_RATE))
        self.chunk_duration: float = float(config.get("chunk_duration_sec", 1.0))
        self.alert_classes: List[str] = config.get(
            "alert_classes", sorted(DISTRESS_CLASSES | IMPACT_CLASSES)
        )
        self.alert_threshold: float = float(config.get("alert_confidence_threshold", 0.25))

        self._ort_session = None
        self._ort_input_name: Optional[str] = None
        self._interpreter = None
        self._class_names: List[str] = []
        self._running = False
        self._on_alert: Optional[Callable] = None

    def load_model(self) -> None:
        """Load YAMNet ONNX (hoặc TFLite fallback) và class map CSV."""
        if self.model_path.endswith(".onnx") or os.path.exists(self.model_path.replace(".tflite", ".onnx")):
            onnx_path = self.model_path if self.model_path.endswith(".onnx") else self.model_path.replace(".tflite", ".onnx")
            if os.path.exists(onnx_path):
                import onnxruntime as ort
                self._ort_session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
                self._ort_input_name = self._ort_session.get_inputs()[0].name
                self.model_path = onnx_path
                self._class_names = self._load_class_names()
                logger.info("[SoundClassifier] YAMNet ONNX loaded: %s (%d classes)", onnx_path, len(self._class_names))
                return

        try:
            import tflite_runtime.interpreter as tflite  # type: ignore
        except ImportError:
            try:
                import tensorflow as tf  # type: ignore
                tflite = tf.lite
            except ImportError as exc:
                raise RuntimeError("Không tìm thấy yamnet.onnx và TFLite runtime không khả dụng.") from exc

        self._interpreter = tflite.Interpreter(model_path=self.model_path)
        self._interpreter.allocate_tensors()
        self._class_names = self._load_class_names()
        logger.info("[SoundClassifier] YAMNet TFLite loaded: %s", self.model_path)

    def _load_class_names(self) -> List[str]:
        """Load YAMNet class map CSV cạnh model file bằng csv.reader."""
        csv_path = os.path.join(os.path.dirname(self.model_path), "yamnet_class_map.csv")
        if not os.path.exists(csv_path):
            logger.warning("[SoundClassifier] Class map CSV not found: %s", csv_path)
            return []
        names: List[str] = []
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 3 and row[0].isdigit():
                    names.append(row[2].strip())
        return names

    def classify(self, audio_chunk: np.ndarray) -> List[tuple]:
        """Phân loại đoạn âm thanh PCM 16kHz mono float32 -> list (class_name, score)."""
        if self._ort_session is None and self._interpreter is None:
            raise RuntimeError("Model chưa load. Gọi load_model() trước.")

        waveform = np.asarray(audio_chunk, dtype=np.float32)
        if waveform.ndim > 1:
            waveform = waveform.mean(axis=1)
        rms = float(np.sqrt(np.mean(waveform ** 2))) if waveform.size else 0.0
        peak = float(np.max(np.abs(waveform))) if waveform.size else 0.0
        if rms > 0.002 and 0 < peak < 0.35:
            waveform = waveform * min(0.5 / peak, 15.0)
        waveform = np.clip(waveform, -1.0, 1.0)

        if self._ort_session is not None and self._ort_input_name:
            scores = self._ort_session.run(None, {self._ort_input_name: waveform})[0]
        else:
            input_details = self._interpreter.get_input_details()
            output_details = self._interpreter.get_output_details()
            self._interpreter.resize_tensor_input(input_details[0]["index"], [len(waveform)])
            self._interpreter.allocate_tensors()
            self._interpreter.set_tensor(input_details[0]["index"], waveform)
            self._interpreter.invoke()
            scores = self._interpreter.get_tensor(output_details[0]["index"])

        # Dùng max theo frame để không làm loãng âm thanh va đập/hét ngắn
        peak_scores = scores.max(axis=0)
        results = [
            (self._class_names[idx] if idx < len(self._class_names) else str(idx), float(score))
            for idx, score in enumerate(peak_scores)
        ]
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def classify_emergency(self, audio_chunk: np.ndarray) -> Optional[AudioAlertEvent]:
        """Kiểm tra chunk có chứa âm thanh Va đập hoặc Kêu cứu vượt ngưỡng không."""
        results = self.classify(audio_chunk)
        for class_name, score in results[:10]:
            if class_name in self.alert_classes and score >= self.alert_threshold:
                category = "IMPACT" if class_name in IMPACT_CLASSES else "DISTRESS"
                return AudioAlertEvent(
                    timestamp=time.time(),
                    class_name=class_name,
                    confidence=score,
                    category=category,
                    audio_snapshot=audio_chunk,
                )
        return None

    async def start(self, on_alert: Callable[[AudioAlertEvent], None]) -> None:
        """Bắt đầu vòng lặp thu âm từ sounddevice (Edge Hub) và phân tích liên tục."""
        self._on_alert = on_alert
        self._running = True
        chunk_size = int(self.sample_rate * self.chunk_duration)

        try:
            import sounddevice as sd  # type: ignore
        except ImportError:
            logger.error("[SoundClassifier] sounddevice not installed. Audio disabled.")
            return

        loop = asyncio.get_event_loop()

        def audio_callback(indata: np.ndarray, frames: int, time_info, status):
            if status:
                logger.warning("[SoundClassifier] Audio status: %s", status)
            audio_data = indata[:, 0].copy()
            loop.call_soon_threadsafe(asyncio.ensure_future, self._process_chunk(audio_data))

        with sd.InputStream(
            samplerate=self.sample_rate,
            channels=1,
            dtype="float32",
            blocksize=chunk_size,
            callback=audio_callback,
        ):
            while self._running:
                await asyncio.sleep(0.1)

    async def _process_chunk(self, audio_chunk: np.ndarray) -> None:
        try:
            event = self.classify_emergency(audio_chunk)
            if event is not None:
                logger.warning("[SoundClassifier] ALERT [%s]: %s (%.2f)", event.category, event.class_name, event.confidence)
                if self._on_alert:
                    if inspect.iscoroutinefunction(self._on_alert):
                        await self._on_alert(event)
                    else:
                        self._on_alert(event)
        except Exception as exc:  # noqa: BLE001
            logger.error("[SoundClassifier] Error processing chunk: %s", exc)

    def stop(self) -> None:
        self._running = False
        logger.info("[SoundClassifier] Audio monitoring stopped.")

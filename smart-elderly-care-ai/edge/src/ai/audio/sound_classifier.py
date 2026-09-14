"""
sound_classifier.py
YAMNet-based audio emergency sound classifier for Edge Hub.

Responsibilities:
- Load YAMNet TFLite model
- Capture audio chunks from microphone
- Classify sounds and emit alerts for emergency classes
  (Screaming, Crying, Glass shatter, Thud)
- Expose SoundClassifier class used by main pipeline
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Callable, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class AudioAlertEvent:
    """Sự kiện âm thanh khẩn cấp được phát hiện."""
    timestamp: float
    class_name: str
    confidence: float
    audio_snapshot: Optional[np.ndarray] = None  # raw PCM


# ---------------------------------------------------------------------------
# SoundClassifier
# ---------------------------------------------------------------------------

class SoundClassifier:
    """
    YAMNet-based audio classifier chạy trên TFLite Interpreter.

    Usage:
        classifier = SoundClassifier(config)
        classifier.load_model()
        await classifier.start(on_alert_callback)
    """

    YAMNET_SAMPLE_RATE = 16000  # Hz

    def __init__(self, config: dict):
        self.config = config
        self.model_path: str = config.get("model_path", "src/ai/audio/models/yamnet.tflite")
        self.sample_rate: int = config.get("sample_rate", self.YAMNET_SAMPLE_RATE)
        self.chunk_duration: float = config.get("chunk_duration_sec", 1.0)
        self.alert_classes: List[str] = config.get("alert_classes", [
            "Screaming", "Crying", "Glass shatter", "Thud"
        ])
        self.alert_threshold: float = config.get("alert_confidence_threshold", 0.75)

        self._interpreter = None
        self._class_names: List[str] = []
        self._running = False
        self._on_alert: Optional[Callable] = None

    # ------------------------------------------------------------------
    # Model Loading
    # ------------------------------------------------------------------

    def load_model(self) -> None:
        """Load YAMNet TFLite model và class map."""
        try:
            import tflite_runtime.interpreter as tflite  # type: ignore
        except ImportError:
            try:
                import tensorflow as tf  # type: ignore
                tflite = tf.lite
            except ImportError as exc:
                raise RuntimeError(
                    "TFLite runtime không khả dụng. Cài tflite-runtime."
                ) from exc

        self._interpreter = tflite.Interpreter(model_path=self.model_path)
        self._interpreter.allocate_tensors()
        self._class_names = self._load_class_names()
        logger.info("[SoundClassifier] YAMNet model loaded: %s", self.model_path)

    def _load_class_names(self) -> List[str]:
        """Load YAMNet class map CSV cạnh model file."""
        import os
        csv_path = os.path.join(
            os.path.dirname(self.model_path), "yamnet_class_map.csv"
        )
        if not os.path.exists(csv_path):
            logger.warning("[SoundClassifier] Class map CSV not found: %s", csv_path)
            return []
        names = []
        with open(csv_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(",")
                if len(parts) >= 3:
                    names.append(parts[2].strip('"'))
        return names

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def classify(self, audio_chunk: np.ndarray) -> List[tuple]:
        """
        Phân loại một đoạn âm thanh PCM 16kHz mono.

        Args:
            audio_chunk: numpy float32 array, shape (N,)

        Returns:
            List of (class_name, score) tuples sorted by score descending
        """
        if self._interpreter is None:
            raise RuntimeError("Model chưa load. Gọi load_model() trước.")

        # Ensure float32 mono
        waveform = audio_chunk.astype(np.float32)
        if waveform.ndim > 1:
            waveform = waveform.mean(axis=1)

        input_details = self._interpreter.get_input_details()
        output_details = self._interpreter.get_output_details()

        self._interpreter.resize_tensor_input(
            input_details[0]["index"], [len(waveform)]
        )
        self._interpreter.allocate_tensors()
        self._interpreter.set_tensor(input_details[0]["index"], waveform)
        self._interpreter.invoke()

        scores = self._interpreter.get_tensor(output_details[0]["index"])  # (frames, 521)
        mean_scores = scores.mean(axis=0)  # average across time frames

        results = []
        for idx, score in enumerate(mean_scores):
            name = self._class_names[idx] if idx < len(self._class_names) else str(idx)
            results.append((name, float(score)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results

    # ------------------------------------------------------------------
    # Streaming / Async Loop
    # ------------------------------------------------------------------

    async def start(self, on_alert: Callable[[AudioAlertEvent], None]) -> None:
        """
        Bắt đầu vòng lặp thu âm và phân tích liên tục (async).

        Args:
            on_alert: Callback được gọi khi phát hiện âm thanh khẩn cấp
        """
        self._on_alert = on_alert
        self._running = True
        logger.info("[SoundClassifier] Audio monitoring started.")

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
            audio_data = indata[:, 0].copy()  # Mono
            loop.call_soon_threadsafe(
                asyncio.ensure_future,
                self._process_chunk(audio_data)
            )

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
        """Xử lý một chunk audio, emit alert nếu phát hiện âm thanh nguy hiểm."""
        try:
            results = self.classify(audio_chunk)
            for class_name, score in results[:5]:
                if class_name in self.alert_classes and score >= self.alert_threshold:
                    event = AudioAlertEvent(
                        timestamp=time.time(),
                        class_name=class_name,
                        confidence=score,
                        audio_snapshot=audio_chunk,
                    )
                    logger.warning(
                        "[SoundClassifier] ALERT: %s (%.2f)", class_name, score
                    )
                    if self._on_alert:
                        await asyncio.coroutine(self._on_alert)(event) \
                            if asyncio.iscoroutinefunction(self._on_alert) \
                            else self._on_alert(event)
                    break  # Chỉ emit một alert mỗi chunk
        except Exception as exc:  # noqa: BLE001
            logger.error("[SoundClassifier] Error processing chunk: %s", exc)

    def stop(self) -> None:
        """Dừng vòng lặp thu âm."""
        self._running = False
        logger.info("[SoundClassifier] Audio monitoring stopped.")

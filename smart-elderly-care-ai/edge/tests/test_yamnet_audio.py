"""Unit tests cho YAMNet ONNX SoundClassifier (Va đập & Kêu cứu)."""

from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock

import numpy as np

EDGE_DIR = Path(__file__).resolve().parents[1]
if str(EDGE_DIR) not in sys.path:
    sys.path.insert(0, str(EDGE_DIR))

from src.ai.audio.sound_classifier import (  # noqa: E402
    DISTRESS_CLASSES,
    IMPACT_CLASSES,
    SoundClassifier,
)


class SoundClassifierTests(unittest.TestCase):
    def test_load_class_names_handles_quoted_commas(self):
        csv_path = EDGE_DIR / "src" / "ai" / "audio" / "models" / "yamnet_class_map.csv"
        if not csv_path.exists():
            self.skipTest("yamnet_class_map.csv not present")
        clf = SoundClassifier({"model_path": str(csv_path.parent / "yamnet.onnx")})
        names = clf._load_class_names()
        self.assertEqual(len(names), 521)
        self.assertIn("Crying, sobbing", names)
        self.assertIn("Thump, thud", names)
        self.assertIn("Smash, crash", names)
        self.assertIn("Screaming", names)

    def test_classify_emergency_detects_impact_and_distress(self):
        clf = SoundClassifier({"alert_confidence_threshold": 0.40})
        clf._class_names = ["Speech", "Screaming", "Thump, thud"]
        clf._ort_input_name = "waveform"
        clf._ort_session = MagicMock()

        # Giả lập tiếng kêu cứu (Screaming = 0.82)
        clf._ort_session.run.return_value = [np.array([[0.10, 0.82, 0.08]], dtype=np.float32)]
        ev1 = clf.classify_emergency(np.zeros(16000, dtype=np.float32))
        self.assertIsNotNone(ev1)
        self.assertEqual(ev1.class_name, "Screaming")
        self.assertEqual(ev1.category, "DISTRESS")
        self.assertIn(ev1.class_name, DISTRESS_CLASSES)

        # Giả lập tiếng va đập (Thump, thud = 0.71)
        clf._ort_session.run.return_value = [np.array([[0.15, 0.14, 0.71]], dtype=np.float32)]
        ev2 = clf.classify_emergency(np.zeros(16000, dtype=np.float32))
        self.assertIsNotNone(ev2)
        self.assertEqual(ev2.class_name, "Thump, thud")
        self.assertEqual(ev2.category, "IMPACT")
        self.assertIn(ev2.class_name, IMPACT_CLASSES)

        # Giả lập âm thanh bình thường (Speech = 0.90) -> None
        clf._ort_session.run.return_value = [np.array([[0.90, 0.05, 0.05]], dtype=np.float32)]
        ev3 = clf.classify_emergency(np.zeros(16000, dtype=np.float32))
        self.assertIsNone(ev3)

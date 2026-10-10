"""
ai/ – AI/ML Inference Module cho Edge Gateway.

Sub-modules:
  - audio: Phân loại âm thanh (YAMNet / SoundClassifier)
  - vision: Phát hiện tư thế, té ngã, nhận diện khuôn mặt (YOLOv8-Pose)
"""

from src.ai.base import BaseAIModel

__all__ = ["BaseAIModel"]

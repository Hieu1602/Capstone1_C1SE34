"""
ai/vision/ – Vision inference module.

Bao gồm: pose detection, fall detection, multi-person tracking,
         face re-identification, kinematics analysis.
"""

from src.ai.vision.pose_detector import PoseDetector
from src.ai.vision.face_reid import FaceReIDEngine
from src.ai.vision.tracker import MultiPersonTracker
from src.ai.vision.kinematics import KinematicsAnalyzer

__all__ = [
    "PoseDetector",
    "FaceReIDEngine",
    "MultiPersonTracker",
    "KinematicsAnalyzer",
]

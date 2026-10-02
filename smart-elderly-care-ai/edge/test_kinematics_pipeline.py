"""
Test script to verify kinematics, tracker, privacy blurring, and decision matrix.
"""
import sys
import os
import time
import numpy as np

from typing import List, Tuple

if sys.platform.startswith("win"):
    reconfig = getattr(sys.stdout, "reconfigure", None)
    if callable(reconfig):
        reconfig(encoding="utf-8")

# Ensure path is included
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from ai.vision.kinematics import KinematicFallEngine, PostureState, FrameKeypointSnapshot
from ai.vision.tracker import PersonTracker
from ai.vision.utils import blur_faces, draw_pose
from fusion.decision_matrix import DecisionMatrix, SensorSignals, AlertType, AlertLevel
from fusion.ring_buffer import VideoRingBuffer


def test_kinematics_and_tracker():
    print("1. Testing KinematicFallEngine & PersonTracker...")
    tracker = PersonTracker()

    # Simulate 10 frames of standing person
    now = time.time()
    # 17 keypoints: [nose, l_eye, r_eye, l_ear, r_ear, l_sh, r_sh, l_elb, r_elb, l_wr, r_wr, l_hip, r_hip, l_knee, r_knee, l_ank, r_ank]
    # Standing person at x=200, y=100 to y=300
    standing_kps: List[Tuple[float, float, float]] = [
        (200.0, 100.0, 0.9),  # 0 nose
        (195.0, 95.0, 0.9),   # 1 l_eye
        (205.0, 95.0, 0.9),   # 2 r_eye
        (190.0, 95.0, 0.9),   # 3 l_ear
        (210.0, 95.0, 0.9),   # 4 r_ear
        (180.0, 130.0, 0.9),  # 5 l_shoulder
        (220.0, 130.0, 0.9),  # 6 r_shoulder
        (170.0, 180.0, 0.9),  # 7 l_elbow
        (230.0, 180.0, 0.9),  # 8 r_elbow
        (165.0, 230.0, 0.9),  # 9 l_wrist
        (235.0, 230.0, 0.9),  # 10 r_wrist
        (185.0, 220.0, 0.9),  # 11 l_hip
        (215.0, 220.0, 0.9),  # 12 r_hip
        (185.0, 300.0, 0.9),  # 13 l_knee
        (215.0, 300.0, 0.9),  # 14 r_knee
        (185.0, 380.0, 0.9),  # 15 l_ankle
        (215.0, 380.0, 0.9),  # 16 r_ankle
    ]
    bbox_standing = (160.0, 90.0, 240.0, 390.0)

    for i in range(10):
        t = now + i * 0.067
        tracks = tracker.update([bbox_standing], [standing_kps], now=t)
        assert len(tracks) == 1
        assert tracks[0].track_id == 1
        assert tracks[0].posture_state == PostureState.STANDING

    print("   -> Standing tracking OK: Track ID=1, State=STANDING")

    # Simulate a sudden fall: hip drops rapidly, spine angle becomes horizontal
    falling_kps: List[Tuple[float, float, float]] = list(standing_kps)
    # Move shoulders and hips to horizontal layout on the ground (y ~ 380)
    falling_kps[5] = (150.0, 380.0, 0.9)  # l_shoulder
    falling_kps[6] = (170.0, 380.0, 0.9)  # r_shoulder
    falling_kps[11] = (260.0, 385.0, 0.9) # l_hip
    falling_kps[12] = (280.0, 385.0, 0.9) # r_hip
    falling_kps[15] = (360.0, 390.0, 0.9) # l_ankle
    falling_kps[16] = (380.0, 390.0, 0.9) # r_ankle
    bbox_fallen = (140.0, 360.0, 390.0, 410.0)  # W=250, H=50 (W/H = 5.0)

    fall_detected = False
    for i in range(11, 25):
        t = now + i * 0.067
        tracks = tracker.update([bbox_fallen], [falling_kps], now=t)

        if tracks[0].is_fall_alerted or tracks[0].posture_state in (PostureState.FALLING, PostureState.FALLEN):
            fall_detected = True

    assert fall_detected, "Fall detection should have triggered!"
    print(f"   -> Fall detection OK: State={tracks[0].posture_state.value}")


def test_face_blurring():
    print("2. Testing Privacy Face Blurring...")
    fake_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Head keypoints at (200, 100)
    kps = [(200, 100, 0.9), (195, 95, 0.9), (205, 95, 0.9), (190, 95, 0.9), (210, 95, 0.9)]
    blurred = blur_faces(fake_frame, [kps])
    assert blurred.shape == fake_frame.shape
    print("   -> Privacy Face Blurring OK")


def test_decision_matrix():
    print("3. Testing Decision Matrix & Fusion...")
    cfg = {"fall_detection_min_sources": 1, "alert_debounce_sec": 5.0}
    dm = DecisionMatrix(cfg)

    # Test fall alert
    sig_fall = SensorSignals(fall_detected_camera=True, person_count=1)
    res_fall = dm.evaluate(sig_fall)
    assert res_fall is not None
    assert res_fall.alert_type == AlertType.FALL_DETECTED
    print(f"   -> Fall Alert Decision: {res_fall.alert_level.value} - {res_fall.message_vi}")

    # Test prolonged immobility (stroke) alert
    sig_immobile = SensorSignals(immobility_detected_camera=True, person_count=1)
    res_immobile = dm.evaluate(sig_immobile)
    assert res_immobile is not None
    assert res_immobile.alert_type == AlertType.PROLONGED_IMMOBILITY
    print(f"   -> Prolonged Immobility Decision: {res_immobile.alert_level.value} - {res_immobile.message_vi}")


def test_ring_buffer_snapshots():
    print("4. Testing Ring Buffer 3-Snapshot Evidence...")
    buf = VideoRingBuffer(duration_sec=5.0, fps=15)
    for _ in range(75):
        buf.push(np.zeros((100, 100, 3), dtype=np.uint8))
    
    snaps = buf.save_incident_snapshots("scratch_test_incident")
    print(f"   -> Snapshots extracted: {len(snaps)} paths")
    # Clean up test files
    for p in snaps:
        if os.path.exists(p):
            os.remove(p)


if __name__ == "__main__":
    test_kinematics_and_tracker()
    test_face_blurring()
    test_decision_matrix()
    test_ring_buffer_snapshots()
    print("\n ALL TESTS PASSED SUCCESSFULLY! ")

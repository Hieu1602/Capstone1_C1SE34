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
    tracks = []
    for i in range(11, 25):
        t = now + i * 0.067
        tracks = tracker.update([bbox_fallen], [falling_kps], now=t)

        if tracks[0].is_fall_alerted or tracks[0].posture_state in (PostureState.FALLING, PostureState.FALLEN):
            fall_detected = True

    assert fall_detected, "Fall detection should have triggered!"
    assert tracks and len(tracks) > 0
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


def test_adl_activities():
    print("5. Testing ADL (Activities of Daily Living) Engine...")
    tracker = PersonTracker(sedentary_threshold_sec=2.0)
    now = time.time()

    # Standing keypoints base
    standing_kps: List[Tuple[float, float, float]] = [
        (200.0, 100.0, 0.9),  # 0 nose
        (195.0, 95.0, 0.9),   # 1 l_eye
        (205.0, 95.0, 0.9),   # 2 r_eye
        (190.0, 95.0, 0.9),   # 3 l_ear
        (210.0, 95.0, 0.9),   # 4 r_ear
        (170.0, 130.0, 0.9),  # 5 l_shoulder
        (230.0, 130.0, 0.9),  # 6 r_shoulder
        (160.0, 180.0, 0.9),  # 7 l_elbow
        (240.0, 180.0, 0.9),  # 8 r_elbow
        (155.0, 230.0, 0.9),  # 9 l_wrist
        (245.0, 230.0, 0.9),  # 10 r_wrist
        (180.0, 220.0, 0.9),  # 11 l_hip
        (220.0, 220.0, 0.9),  # 12 r_hip
        (180.0, 300.0, 0.9),  # 13 l_knee
        (220.0, 300.0, 0.9),  # 14 r_knee
        (180.0, 380.0, 0.9),  # 15 l_ankle
        (220.0, 380.0, 0.9),  # 16 r_ankle
    ]

    # A. Test SITTING (Knees bent at 90°, hips lowered)
    sitting_kps = list(standing_kps)
    sitting_kps[11] = (180.0, 260.0, 0.9)  # l_hip
    sitting_kps[12] = (220.0, 260.0, 0.9)  # r_hip
    sitting_kps[13] = (160.0, 265.0, 0.9)  # l_knee forward
    sitting_kps[14] = (240.0, 265.0, 0.9)  # r_knee forward
    sitting_kps[15] = (160.0, 340.0, 0.9)  # l_ankle down
    sitting_kps[16] = (240.0, 340.0, 0.9)  # r_ankle down
    bbox_sitting = (150.0, 95.0, 250.0, 345.0)  # Aspect ratio: 100 / 250 = 0.4, knee angle ~ 90 deg

    # Feed sitting frames over 2.5 seconds to trigger sedentary warning
    tracks = []
    for i in range(15):
        t = now + i * 0.2
        tracks = tracker.update([bbox_sitting], [sitting_kps], now=t)
        assert len(tracks) == 1

    assert tracks and tracks[0].posture_state == PostureState.SITTING, f"Expected SITTING, got {tracks[0].posture_state if tracks else 'None'}"
    assert tracks[0].adl_stats.sitting_duration_sec > 1.5
    assert tracks[0].adl_stats.sedentary_warning is True, "Sedentary alert should trigger after 2.0s!"
    print(f"   -> Sitting & Sedentary Warning OK: Duration={tracks[0].adl_stats.sitting_duration_sec:.1f}s, Alert={tracks[0].adl_stats.sedentary_warning}")

    # B. Test DRINKING (Hand to mouth gesture)
    drinking_kps = list(sitting_kps)
    # Bring right wrist (10) close to nose (0)
    drinking_kps[10] = (205.0, 105.0, 0.9)
    drinking_kps[8] = (225.0, 125.0, 0.9)  # elbow flexed

    tracks = []
    for i in range(15, 20):
        t = now + i * 0.2
        tracks = tracker.update([bbox_sitting], [drinking_kps], now=t)

    assert tracks and tracks[0].posture_state == PostureState.DRINKING, f"Expected DRINKING, got {tracks[0].posture_state if tracks else 'None'}"
    assert tracks[0].adl_stats.drinking_count >= 1, "Drinking count should be incremented!"
    print(f"   -> Drinking Gesture OK: State={tracks[0].posture_state.value}, Count={tracks[0].adl_stats.drinking_count}")

    # C. Test LYING (Normal resting / sleeping without sudden drop velocity)
    lying_tracker = PersonTracker()
    lying_kps = list(standing_kps)
    lying_kps[5] = (150.0, 380.0, 0.9)   # l_sh
    lying_kps[6] = (170.0, 380.0, 0.9)   # r_sh
    lying_kps[11] = (260.0, 385.0, 0.9)  # l_hip
    lying_kps[12] = (280.0, 385.0, 0.9)  # r_hip
    lying_kps[15] = (360.0, 390.0, 0.9)  # l_ank
    lying_kps[16] = (380.0, 390.0, 0.9)  # r_ank
    bbox_lying = (140.0, 360.0, 390.0, 410.0)

    # Frame 1 & 2 already low or gentle transition (dt=1.0s, low drop velocity)
    t_lying = time.time()
    tracks_lying = lying_tracker.update([bbox_lying], [lying_kps], now=t_lying)
    tracks_lying = lying_tracker.update([bbox_lying], [lying_kps], now=t_lying + 0.1)

    assert tracks_lying[0].posture_state == PostureState.LYING, f"Expected LYING, got {tracks_lying[0].posture_state}"
    assert tracks_lying[0].is_fall_alerted is False, "Lying down normally should NOT trigger fall alarm!"
    print(f"   -> Normal Lying / Sleeping OK: State={tracks_lying[0].posture_state.value}, FallAlarm={tracks_lying[0].is_fall_alerted}")


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


def test_face_reid_identification():
    print("6. Testing Face Re-ID & Elderly Profile Enrollment...")
    import cv2
    from ai.vision.face_reid import FaceReIDManager, compute_face_embedding

    test_cache = "scratch_test_faces.json"
    tracker = PersonTracker(face_cache_file=test_cache)

    # 1. Tạo ảnh chân dung đăng ký hồ sơ của Cụ Nguyễn Văn An
    enrolled_face = np.zeros((112, 112, 3), dtype=np.uint8)
    cv2.circle(enrolled_face, (56, 56), 35, (220, 220, 220), -1)
    cv2.circle(enrolled_face, (40, 42), 6, (20, 20, 20), -1)   # mắt trái
    cv2.circle(enrolled_face, (72, 42), 6, (20, 20, 20), -1)   # mắt phải
    cv2.line(enrolled_face, (45, 75), (67, 75), (50, 50, 50), 3) # miệng

    # Đăng ký vào hệ thống qua Hồ sơ bệnh án
    tracker.face_manager.enroll_from_image(
        elderly_id="elderly_001",
        name="Cụ Nguyễn Văn An",
        image_bgr=enrolled_face,
        avatar_url="/static/faces/elderly_001.jpg",
    )

    # 2. Tạo khung hình camera có Cụ An đang đứng ở (200, 100)
    camera_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Gán khuôn mặt Cụ An vào tọa độ đầu
    camera_frame[50:162, 144:256] = enrolled_face

    standing_kps: List[Tuple[float, float, float]] = [
        (200.0, 100.0, 0.9),  # 0 nose
        (185.0, 92.0, 0.9),   # 1 l_eye
        (215.0, 92.0, 0.9),   # 2 r_eye
        (165.0, 95.0, 0.9),   # 3 l_ear
        (235.0, 95.0, 0.9),   # 4 r_ear
        (170.0, 150.0, 0.9),  # 5 l_shoulder
        (230.0, 150.0, 0.9),  # 6 r_shoulder
        (160.0, 210.0, 0.9),  # 7 l_elbow
        (240.0, 210.0, 0.9),  # 8 r_elbow
        (155.0, 270.0, 0.9),  # 9 l_wrist
        (245.0, 270.0, 0.9),  # 10 r_wrist
        (180.0, 260.0, 0.9),  # 11 l_hip
        (220.0, 260.0, 0.9),  # 12 r_hip
        (180.0, 340.0, 0.9),  # 13 l_knee
        (220.0, 340.0, 0.9),  # 14 r_knee
        (180.0, 420.0, 0.9),  # 15 l_ankle
        (220.0, 420.0, 0.9),  # 16 r_ankle
    ]
    bbox = (150.0, 60.0, 250.0, 430.0)

    tracks = tracker.update([bbox], [standing_kps], now=time.time(), raw_frame=camera_frame)
    assert len(tracks) == 1
    assert tracks[0].is_elderly is True, "Người già phải được nhận diện thành công qua Face ReID!"
    assert tracks[0].person_name == "Cụ Nguyễn Văn An"
    print(f"   -> Elderly Face Re-ID OK: Person={tracks[0].person_name}, Similarity={tracks[0].face_similarity:.2f}")

    # Dọn dẹp file test
    if os.path.exists(test_cache):
        os.remove(test_cache)


if __name__ == "__main__":
    test_kinematics_and_tracker()
    test_face_blurring()
    test_decision_matrix()
    test_ring_buffer_snapshots()
    test_adl_activities()
    test_face_reid_identification()
    print("\n ALL TESTS PASSED SUCCESSFULLY! ")

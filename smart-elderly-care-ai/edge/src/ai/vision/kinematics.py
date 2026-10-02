"""
kinematics.py
Temporal Kinematic & Posture Analysis Engine for Fall & Stroke Detection.
Inspired by ElderCare Vision & Fall-Stroke Monitoring System.

Calculates:
- Spine orientation angle (relative to vertical)
- Hip drop velocity normalized by body height (fall dynamic)
- Bounding box aspect ratio (W/H)
- Motion energy / Keypoint displacement over time (for prolonged immobility / stroke warning)
"""

import math
import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


class PostureState(str, Enum):
    STANDING = "STANDING"
    SITTING = "SITTING"
    LYING = "LYING"          # Nằm nghỉ ngơi / Ngủ bình thường (không có gia tốc ngã)
    DRINKING = "DRINKING"    # Uống nước / Cử động tay lên miệng
    FALLING = "FALLING"      # Đang rơi tự do
    FALLEN = "FALLEN"        # Đã ngã trên sàn
    IMMOBILE = "IMMOBILE"    # Bất động kéo dài sau ngã (nguy cơ đột quỵ)
    RECOVERING = "RECOVERING"# Hồi phục / Gượng dậy


@dataclass
class ADLStatistics:
    """
    Thống kê các hoạt động sinh hoạt hàng ngày (Activities of Daily Living - ADL).
    Phục vụ Nhật ký Sức khỏe (Daily Health Diary) trên Mobile App.
    """
    sitting_duration_sec: float = 0.0
    standing_duration_sec: float = 0.0
    lying_duration_sec: float = 0.0
    drinking_count: int = 0
    sedentary_warning: bool = False


@dataclass
class FrameKeypointSnapshot:
    """Ảnh chụp vị trí keypoint tại một mốc thời gian."""
    timestamp: float
    # 17 keypoints: list of (x, y, conf)
    keypoints: List[Tuple[float, float, float]]
    bbox: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    hip_center_y: float
    spine_angle_deg: float
    aspect_ratio: float


class KinematicFallEngine:
    """
    Phân tích động học chuỗi chuyển động cơ thể theo thời gian để phát hiện té ngã
    và trạng thái bất động kéo dài (nguy cơ đột quỵ/hôn mê).
    """

    def __init__(self, config: Optional[dict] = None):
        cfg = config or {}
        # Ngưỡng vận tốc rơi hông (tính theo số lần chiều cao cơ thể / giây)
        self.drop_velocity_threshold: float = cfg.get("drop_velocity_threshold", 1.2)
        # Góc cột sống nghiêng so với phương thẳng đứng để xem là nằm (> 60 độ)
        self.fallen_angle_threshold: float = cfg.get("fallen_angle_threshold", 60.0)
        # Tỷ lệ W/H bounding box khi nằm (> 1.1)
        self.aspect_ratio_threshold: float = cfg.get("aspect_ratio_threshold", 1.1)
        # Thời gian tối thiểu người đó phải nằm bất động ở tư thế thấp để xác nhận FALLEN (giây)
        self.min_fallen_duration: float = cfg.get("min_fallen_duration", 0.5)
        # Thời gian bất động kéo dài sau ngã để cảnh báo nguy cơ đột quỵ/bất tỉnh (giây)
        self.immobility_alert_sec: float = cfg.get("immobility_alert_sec", 15.0)
        # Ngưỡng dịch chuyển keypoint trung bình để xác định có cử động (pixel)
        self.motion_energy_threshold: float = cfg.get("motion_energy_threshold", 8.0)

    @staticmethod
    def calculate_spine_angle(kps: List[Tuple[float, float, float]]) -> float:
        """
        Tính góc nghiêng của cột sống (đoạn nối giữa trung điểm 2 vai và trung điểm 2 hông)
        so với phương thẳng đứng.
        Góc: 0° là đứng thẳng, 90° là nằm ngang hoàn toàn trên sàn.
        """
        if len(kps) < 13:
            return 0.0

        # COCO Keypoints: 5=L_Shoulder, 6=R_Shoulder, 11=L_Hip, 12=R_Hip
        l_sh, r_sh = kps[5], kps[6]
        l_hip, r_hip = kps[11], kps[12]

        # Kiểm tra độ tin cậy
        if min(l_sh[2], r_sh[2], l_hip[2], r_hip[2]) < 0.2:
            return 0.0

        sh_x = (l_sh[0] + r_sh[0]) / 2.0
        sh_y = (l_sh[1] + r_sh[1]) / 2.0
        hip_x = (l_hip[0] + r_hip[0]) / 2.0
        hip_y = (l_hip[1] + r_hip[1]) / 2.0

        dx = abs(sh_x - hip_x)
        dy = abs(sh_y - hip_y)

        # Góc so với phương thẳng đứng
        angle_rad = math.atan2(dx, dy + 1e-6)
        return math.degrees(angle_rad)

    @staticmethod
    def get_hip_center(kps: List[Tuple[float, float, float]]) -> Tuple[float, float]:
        """Lấy tọa độ trung tâm hông."""
        if len(kps) >= 13 and kps[11][2] > 0.2 and kps[12][2] > 0.2:
            return (kps[11][0] + kps[12][0]) / 2.0, (kps[11][1] + kps[12][1]) / 2.0
        return 0.0, 0.0

    @staticmethod
    def estimate_body_height(kps: List[Tuple[float, float, float]], bbox: Tuple[float, float, float, float]) -> float:
        """Ước tính chiều cao cơ thể theo keypoints hoặc bounding box."""
        h_bbox = bbox[3] - bbox[1]
        if len(kps) >= 17:
            # Khoảng cách từ vai đến hông + hông đến cổ chân
            sh_y = (kps[5][1] + kps[6][1]) / 2.0
            hip_y = (kps[11][1] + kps[12][1]) / 2.0
            ank_y = (kps[15][1] + kps[16][1]) / 2.0
            if ank_y > hip_y > sh_y:
                return max(h_bbox * 0.8, (ank_y - sh_y) * 1.2)
        return max(h_bbox, 50.0)

    @staticmethod
    def calculate_knee_angle(kps: List[Tuple[float, float, float]]) -> float:
        """
        Tính góc gập khớp gối (Hip - Knee - Ankle) bằng công thức vector.
        Đứng thẳng: ~160° - 180°
        Ngồi: ~70° - 120°
        """
        angles = []
        # Chân trái: Hip=11, Knee=13, Ankle=15
        if len(kps) > 15 and kps[11][2] > 0.25 and kps[13][2] > 0.25 and kps[15][2] > 0.25:
            v1 = (kps[11][0] - kps[13][0], kps[11][1] - kps[13][1])
            v2 = (kps[15][0] - kps[13][0], kps[15][1] - kps[13][1])
            dot = v1[0] * v2[0] + v1[1] * v2[1]
            mag1 = math.hypot(v1[0], v1[1])
            mag2 = math.hypot(v2[0], v2[1])
            if mag1 > 1e-4 and mag2 > 1e-4:
                cos_val = max(-1.0, min(1.0, dot / (mag1 * mag2)))
                angles.append(math.degrees(math.acos(cos_val)))

        # Chân phải: Hip=12, Knee=14, Ankle=16
        if len(kps) > 16 and kps[12][2] > 0.25 and kps[14][2] > 0.25 and kps[16][2] > 0.25:
            v1 = (kps[12][0] - kps[14][0], kps[12][1] - kps[14][1])
            v2 = (kps[16][0] - kps[14][0], kps[16][1] - kps[14][1])
            dot = v1[0] * v2[0] + v1[1] * v2[1]
            mag1 = math.hypot(v1[0], v1[1])
            mag2 = math.hypot(v2[0], v2[1])
            if mag1 > 1e-4 and mag2 > 1e-4:
                cos_val = max(-1.0, min(1.0, dot / (mag1 * mag2)))
                angles.append(math.degrees(math.acos(cos_val)))

        if angles:
            return sum(angles) / len(angles)
        return 180.0

    @staticmethod
    def is_hand_to_mouth_gesture(kps: List[Tuple[float, float, float]]) -> bool:
        """
        Kiểm tra cử động đưa tay lên gần miệng/mặt (uống nước / ăn / nghe điện thoại).
        Khoảng cách giữa cổ tay (Wrist: 9 hoặc 10) và mũi (Nose: 0) / miệng
        nhỏ hơn 0.65 lần chiều rộng vai (Shoulder width).
        """
        if len(kps) < 11 or kps[0][2] < 0.2:
            return False

        nose = kps[0]
        l_sh, r_sh = kps[5], kps[6]
        shoulder_width = math.hypot(l_sh[0] - r_sh[0], l_sh[1] - r_sh[1])
        if shoulder_width < 10.0:
            return False

        threshold_dist = 0.65 * shoulder_width

        # Cổ tay trái (9)
        l_wrist = kps[9]
        if l_wrist[2] > 0.25:
            dist_l = math.hypot(l_wrist[0] - nose[0], l_wrist[1] - nose[1])
            if dist_l <= threshold_dist and l_wrist[1] <= l_sh[1] + 25.0:
                return True

        # Cổ tay phải (10)
        r_wrist = kps[10]
        if r_wrist[2] > 0.25:
            dist_r = math.hypot(r_wrist[0] - nose[0], r_wrist[1] - nose[1])
            if dist_r <= threshold_dist and r_wrist[1] <= r_sh[1] + 25.0:
                return True

        return False

    def analyze_track(
        self,
        history: deque,  # Deque chứa FrameKeypointSnapshot
        current_state: PostureState,
        state_enter_time: float,
    ) -> Tuple[PostureState, float, bool, bool]:
        """
        Phân tích chuỗi snapshot thời gian của một track ID.
        Nhận diện cả ADL (Đứng, Ngồi, Nằm ngủ, Uống nước) và các tình huống té ngã / đột quỵ.

        Returns:
            (new_state, confidence, is_fall_event, is_prolonged_immobility)
        """
        if len(history) < 2:
            return current_state, 0.0, False, False

        curr_snap: FrameKeypointSnapshot = history[-1]
        now = curr_snap.timestamp
        w = curr_snap.bbox[2] - curr_snap.bbox[0]
        h = max(curr_snap.bbox[3] - curr_snap.bbox[1], 1.0)
        aspect_ratio = w / h

        # 1. Tính vận tốc rơi của hông (Hip drop velocity) trong 0.2s - 0.6s gần nhất
        drop_velocity = 0.0
        body_h = self.estimate_body_height(curr_snap.keypoints, curr_snap.bbox)

        for past_snap in reversed(list(history)[:-1]):
            dt = now - past_snap.timestamp
            if 0.2 <= dt <= 0.6:
                dy = curr_snap.hip_center_y - past_snap.hip_center_y
                drop_velocity = (dy / body_h) / dt
                break

        # 2. Đánh giá tư thế thấp (Low posture)
        is_low_posture = (
            aspect_ratio >= self.aspect_ratio_threshold
            or curr_snap.spine_angle_deg >= self.fallen_angle_threshold
        )

        # 3. Tính năng lượng chuyển động (Motion Energy) để phát hiện bất động
        recent_movement = 0.0
        if len(history) >= 5:
            snaps = list(history)[-5:]
            diffs = []
            for s1, s2 in zip(snaps[:-1], snaps[1:]):
                k1 = s1.keypoints
                k2 = s2.keypoints
                pt_diff = [
                    math.hypot(p1[0] - p2[0], p1[1] - p2[1])
                    for p1, p2 in zip(k1, k2)
                    if p1[2] > 0.3 and p2[2] > 0.3
                ]
                if pt_diff:
                    diffs.append(sum(pt_diff) / len(pt_diff))
            if diffs:
                recent_movement = sum(diffs) / len(diffs)

        is_immobile = recent_movement < self.motion_energy_threshold

        # 4. Máy trạng thái phân loại ADL & Fall Detection
        new_state = current_state
        is_fall_event = False
        is_stroke_alert = False

        if current_state in (PostureState.STANDING, PostureState.SITTING, PostureState.DRINKING):
            # A. Kiểm tra nguy cơ té ngã
            if drop_velocity >= self.drop_velocity_threshold and is_low_posture:
                new_state = PostureState.FALLING
            elif is_low_posture and aspect_ratio > 1.4 and drop_velocity > 0.6:
                # Trượt ngã có gia tốc rơi đáng kể
                new_state = PostureState.FALLING
            elif is_low_posture and drop_velocity < 0.6:
                # Nằm xuống giường/sofa từ từ nghỉ ngơi hoặc ngủ (không phải ngã)
                new_state = PostureState.LYING
            else:
                # B. Phân loại sinh hoạt thường nhật (ADL)
                if self.is_hand_to_mouth_gesture(curr_snap.keypoints):
                    new_state = PostureState.DRINKING
                else:
                    knee_angle = self.calculate_knee_angle(curr_snap.keypoints)
                    if knee_angle < 135.0 or (aspect_ratio > 0.55 and curr_snap.spine_angle_deg > 20.0):
                        new_state = PostureState.SITTING
                    else:
                        new_state = PostureState.STANDING

        elif current_state == PostureState.LYING:
            # Người nằm nghỉ / ngủ: kiểm tra xem khi nào ngồi dậy hoặc đứng dậy
            if not is_low_posture and curr_snap.spine_angle_deg < 45.0:
                knee_angle = self.calculate_knee_angle(curr_snap.keypoints)
                if knee_angle < 135.0 or aspect_ratio > 0.55:
                    new_state = PostureState.SITTING
                else:
                    new_state = PostureState.STANDING

        elif current_state == PostureState.FALLING:
            # Nếu duy trì tư thế thấp trên sàn đủ lâu -> xác nhận đã ngã
            fallen_duration = now - state_enter_time
            if is_low_posture:
                if fallen_duration >= self.min_fallen_duration:
                    new_state = PostureState.FALLEN
                    is_fall_event = True  # Kích hoạt báo động ngã khẩn cấp
            else:
                # Người đó đứng lên hoặc ngồi dậy ngay -> Báo giả hoặc phục hồi
                new_state = PostureState.STANDING

        elif current_state == PostureState.FALLEN:
            # Đang nằm ngã trên sàn
            time_since_fallen = now - state_enter_time
            if not is_low_posture and curr_snap.spine_angle_deg < 35.0 and aspect_ratio < 0.8:
                new_state = PostureState.RECOVERING
            elif is_immobile and time_since_fallen >= self.immobility_alert_sec:
                new_state = PostureState.IMMOBILE
                is_stroke_alert = True

        elif current_state == PostureState.IMMOBILE:
            # Bất động nguy hiểm, kiểm tra xem có dấu hiệu gượng dậy không
            if not is_low_posture and curr_snap.spine_angle_deg < 35.0:
                new_state = PostureState.RECOVERING

        elif current_state == PostureState.RECOVERING:
            # Sau khi đứng dậy ổn định 2 giây -> Re-arm về STANDING
            if now - state_enter_time >= 2.0:
                new_state = PostureState.STANDING

        # Độ tin cậy tính toán dựa trên độ rõ ràng của góc và tỷ lệ khung hình
        confidence = min(1.0, max(0.0, (curr_snap.spine_angle_deg / 90.0) * 0.5 + min(aspect_ratio, 2.0) * 0.25))

        return new_state, confidence, is_fall_event, is_stroke_alert

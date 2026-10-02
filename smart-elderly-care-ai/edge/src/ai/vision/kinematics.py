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
    FALLING = "FALLING"
    FALLEN = "FALLEN"
    IMMOBILE = "IMMOBILE"
    RECOVERING = "RECOVERING"


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

    def analyze_track(
        self,
        history: deque,  # Deque chứa FrameKeypointSnapshot
        current_state: PostureState,
        state_enter_time: float,
    ) -> Tuple[PostureState, float, bool, bool]:
        """
        Phân tích chuỗi snapshot thời gian của một track ID.

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

        # 1. Tính vận tốc rơi của hông (Hip drop velocity) trong 0.3s - 0.5s gần nhất
        drop_velocity = 0.0
        body_h = self.estimate_body_height(curr_snap.keypoints, curr_snap.bbox)

        for past_snap in reversed(list(history)[:-1]):
            dt = now - past_snap.timestamp
            if 0.2 <= dt <= 0.6:
                # Độ dịch chuyển theo trục Y (hướng xuống sàn là Y tăng)
                dy = curr_snap.hip_center_y - past_snap.hip_center_y
                # Vận tốc tính theo [chiều cao cơ thể / giây]
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
            # Lấy 5 frame gần nhất
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

        # 4. Máy trạng thái (Finite State Machine)
        new_state = current_state
        is_fall_event = False
        is_stroke_alert = False

        if current_state == PostureState.STANDING or current_state == PostureState.SITTING:
            # Phát hiện đang rơi nhanh xuống
            if drop_velocity >= self.drop_velocity_threshold and is_low_posture:
                new_state = PostureState.FALLING
            elif is_low_posture and aspect_ratio > 1.4:
                # Trường hợp ngã từ từ (trượt ngã không có gia tốc lớn)
                new_state = PostureState.FALLING

        elif current_state == PostureState.FALLING:
            # Nếu duy trì tư thế thấp trên sàn đủ lâu -> xác nhận đã ngã
            fallen_duration = now - state_enter_time
            if is_low_posture:
                if fallen_duration >= self.min_fallen_duration:
                    new_state = PostureState.FALLEN
                    is_fall_event = True  # Kích hoạt báo động ngã
            else:
                # Người đó đứng lên hoặc ngồi dậy ngay -> Báo giả hoặc phục hồi
                new_state = PostureState.STANDING

        elif current_state == PostureState.FALLEN:
            # Người đó đã ngã và đang nằm trên sàn
            time_since_fallen = now - state_enter_time
            # Nếu người đó đã tự đứng dậy (góc cột sống thẳng, aspect ratio dọc)
            if not is_low_posture and curr_snap.spine_angle_deg < 35.0 and aspect_ratio < 0.8:
                new_state = PostureState.RECOVERING
            # Nếu nằm bất động quá ngưỡng quy định -> Cảnh báo nguy cơ đột quỵ/hôn mê
            elif is_immobile and time_since_fallen >= self.immobility_alert_sec:
                new_state = PostureState.IMMOBILE
                is_stroke_alert = True

        elif current_state == PostureState.IMMOBILE:
            # Đang ở trạng thái bất động nguy hiểm, kiểm tra xem có dấu hiệu phục hồi không
            if not is_low_posture and curr_snap.spine_angle_deg < 35.0:
                new_state = PostureState.RECOVERING

        elif current_state == PostureState.RECOVERING:
            # Sau khi đứng dậy ổn định 2 giây -> Re-arm về STANDING
            if now - state_enter_time >= 2.0:
                new_state = PostureState.STANDING

        # Độ tin cậy tính toán dựa trên độ rõ ràng của góc và tỷ lệ khung hình
        confidence = min(1.0, max(0.0, (curr_snap.spine_angle_deg / 90.0) * 0.5 + min(aspect_ratio, 2.0) * 0.25))

        return new_state, confidence, is_fall_event, is_stroke_alert

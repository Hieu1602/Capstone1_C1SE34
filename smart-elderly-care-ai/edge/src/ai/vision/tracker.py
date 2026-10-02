"""
tracker.py
Lightweight Multi-Person Tracker with Causal Track Stitching for Fall Detection.
Inspired by ByteTrack & ElderCare Vision causal track stitcher.

Responsibilities:
- Assign consistent track IDs to detected persons across video frames.
- Re-stitch tracks when a person falls and their bounding box changes abruptly or is briefly lost.
- Maintain temporal keypoint history for each track (up to 30 frames / 2.0s).
"""

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import numpy as np

from .kinematics import (
    FrameKeypointSnapshot,
    KinematicFallEngine,
    PostureState,
)


@dataclass
class TrackedPerson:
    track_id: int
    bbox: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    keypoints: List[Tuple[float, float, float]] = field(default_factory=list)  # [(x, y, conf), ...]
    history: deque = field(default_factory=lambda: deque(maxlen=30))

    posture_state: PostureState = PostureState.STANDING
    state_enter_time: float = field(default_factory=time.time)
    last_seen_time: float = field(default_factory=time.time)
    missed_frames: int = 0
    confidence: float = 0.0
    is_fall_alerted: bool = False
    is_stroke_alerted: bool = False


class PersonTracker:
    """
    Theo dõi nhiều người qua các khung hình camera và lưu trữ lịch sử chuyển động.
    """

    def __init__(
        self,
        iou_threshold: float = 0.30,
        max_missed_frames: int = 15,  # 15 frames @ 15fps = 1.0 giây
        stitching_distance_threshold: float = 120.0,  # pixels
    ):
        self.iou_threshold = iou_threshold
        self.max_missed_frames = max_missed_frames
        self.stitching_distance_threshold = stitching_distance_threshold
        self.next_track_id: int = 1
        self.tracks: Dict[int, TrackedPerson] = {}
        self.recently_lost_tracks: List[TrackedPerson] = []
        self.kinematic_engine = KinematicFallEngine()

    @staticmethod
    def _compute_iou(boxA: Tuple[float, float, float, float], boxB: Tuple[float, float, float, float]) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        if interArea == 0.0:
            return 0.0

        boxAArea = max(0.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
        boxBArea = max(0.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

        iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
        return iou

    @staticmethod
    def _get_center(box: Tuple[float, float, float, float]) -> Tuple[float, float]:
        return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)

    def update(
        self,
        detections: Sequence[Tuple[float, float, float, float]],
        keypoints_list: Sequence[Sequence[Tuple[Union[float, int], ...]]],
        now: Optional[float] = None,
    ) -> List[TrackedPerson]:
        """
        Cập nhật danh sách phát hiện mới vào bộ theo dõi.

        Args:
            detections: Danh sách bounding box (x1, y1, x2, y2)
            keypoints_list: Danh sách 17 keypoint tương ứng
            now: Thời gian timestamp hiện tại

        Returns:
            Danh sách TrackedPerson hiện đang hoạt động
        """

        if now is None:
            now = time.time()

        num_det = len(detections)
        matched_tracks = set()
        matched_detections = set()

        # 1. Khớp nối theo IoU cao nhất (ưu tiên)
        for det_idx in range(num_det):
            det_box = detections[det_idx]
            best_iou = self.iou_threshold
            best_track_id = None

            for track_id, track in self.tracks.items():
                if track_id in matched_tracks:
                    continue
                iou = self._compute_iou(det_box, track.bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_track_id = track_id

            if best_track_id is not None:
                matched_tracks.add(best_track_id)
                matched_detections.add(det_idx)
                self._update_track(
                    self.tracks[best_track_id], det_box, keypoints_list[det_idx], now
                )

        # 2. Causal Track Stitching: Với detection chưa khớp, thử ghép với track active chưa khớp hoặc track vừa mất
        # Khi một người ngã, bounding box biến từ dọc (đứng) sang ngang (nằm) khiến IoU tụt xuống 0
        unmatched_dets = [i for i in range(num_det) if i not in matched_detections]
        candidates_to_stitch = [
            t for t_id, t in self.tracks.items() if t_id not in matched_tracks
        ] + [
            t for t in self.recently_lost_tracks if t.track_id not in self.tracks
        ]

        for det_idx in unmatched_dets:
            det_box = detections[det_idx]
            det_center = self._get_center(det_box)
            det_feet = ((det_box[0] + det_box[2]) / 2.0, det_box[3])

            stitched_track = None
            min_dist = self.stitching_distance_threshold

            for candidate in candidates_to_stitch:
                cand_center = self._get_center(candidate.bbox)
                cand_feet = ((candidate.bbox[0] + candidate.bbox[2]) / 2.0, candidate.bbox[3])
                
                # Tính khoảng cách tâm hoặc khoảng cách vị trí chân tiếp sàn
                dist_center = np.hypot(det_center[0] - cand_center[0], det_center[1] - cand_center[1])
                dist_feet = np.hypot(det_feet[0] - cand_feet[0], det_feet[1] - cand_feet[1])
                dist = min(dist_center, dist_feet)

                if dist < min_dist and (now - candidate.last_seen_time) < 2.0:
                    min_dist = dist
                    stitched_track = candidate

            if stitched_track is not None:
                if stitched_track in self.recently_lost_tracks:
                    self.recently_lost_tracks.remove(stitched_track)
                self.tracks[stitched_track.track_id] = stitched_track
                matched_tracks.add(stitched_track.track_id)
                matched_detections.add(det_idx)
                candidates_to_stitch.remove(stitched_track)
                self._update_track(
                    stitched_track, det_box, keypoints_list[det_idx], now
                )

        # 3. Tạo track mới cho các detection còn lại
        for det_idx in range(num_det):
            if det_idx not in matched_detections:
                new_track = TrackedPerson(
                    track_id=self.next_track_id,
                    bbox=detections[det_idx],
                    last_seen_time=now,
                )
                self.next_track_id += 1
                self._update_track(
                    new_track, detections[det_idx], keypoints_list[det_idx], now
                )
                self.tracks[new_track.track_id] = new_track
                matched_tracks.add(new_track.track_id)

        # 4. Xử lý các track không được cập nhật trong frame này
        active_track_ids = list(self.tracks.keys())
        for track_id in active_track_ids:
            if track_id not in matched_tracks and track_id in self.tracks:
                track = self.tracks[track_id]
                track.missed_frames += 1
                if track.missed_frames > self.max_missed_frames:
                    # Chuyển vào recently_lost_tracks để hỗ trợ nối vết
                    self.recently_lost_tracks.append(track)
                    del self.tracks[track_id]

        # Giữ danh sách recently_lost_tracks tối đa 5 người trong 3 giây
        self.recently_lost_tracks = [
            t for t in self.recently_lost_tracks if (now - t.last_seen_time) < 3.0
        ][-5:]

        # Chỉ trả về các track xuất hiện trong frame hiện tại
        return [t for t in self.tracks.values() if t.missed_frames == 0]


    def _update_track(
        self,
        track: TrackedPerson,
        bbox: Tuple[float, float, float, float],
        keypoints: Sequence[Tuple[Union[float, int], ...]],
        now: float,
    ) -> None:
        """Cập nhật frame và chạy đánh giá động học thời gian cho track."""
        float_kps: List[Tuple[float, float, float]] = [
            (float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else 1.0)
            for p in keypoints
        ]
        track.bbox = bbox
        track.keypoints = float_kps
        track.last_seen_time = now
        track.missed_frames = 0

        # Phân tích góc cột sống và trọng tâm hông
        spine_angle = KinematicFallEngine.calculate_spine_angle(float_kps)
        hip_x, hip_y = KinematicFallEngine.get_hip_center(float_kps)

        w = bbox[2] - bbox[0]
        h = max(bbox[3] - bbox[1], 1.0)

        snapshot = FrameKeypointSnapshot(
            timestamp=now,
            keypoints=float_kps,
            bbox=bbox,
            hip_center_y=hip_y if hip_y > 0 else (bbox[1] + bbox[3]) / 2.0,
            spine_angle_deg=spine_angle,
            aspect_ratio=w / h,
        )
        track.history.append(snapshot)

        # Chạy máy trạng thái động học
        old_state = track.posture_state
        new_state, conf, is_fall, is_immobile = self.kinematic_engine.analyze_track(
            history=track.history,
            current_state=old_state,
            state_enter_time=track.state_enter_time,
        )

        if new_state != old_state:
            track.posture_state = new_state
            track.state_enter_time = now

        track.confidence = conf
        if is_fall:
            track.is_fall_alerted = True
        if is_immobile:
            track.is_stroke_alerted = True

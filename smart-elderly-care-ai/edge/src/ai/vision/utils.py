"""
utils.py
Utility functions for vision AI module.

Provides:
- Frame annotation / visualization helpers
- NMS (Non-Maximum Suppression)
- Coordinate transformation helpers
"""

from typing import List, Optional, Tuple
import numpy as np
import logging

logger = logging.getLogger(__name__)

# COCO 17 Keypoint names for reference
COCO_KEYPOINTS = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# Skeleton connections for visualization
SKELETON_CONNECTIONS: List[Tuple[int, int]] = [
    (0, 1), (0, 2), (1, 3), (2, 4),           # Head
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # Arms
    (5, 11), (6, 12), (11, 12),                # Torso
    (11, 13), (13, 15), (12, 14), (14, 16),    # Legs
]


def blur_faces(
    frame: np.ndarray,
    keypoints_list: List,
    kernel_size: Tuple[int, int] = (51, 51),
    sigma: float = 30.0,
) -> np.ndarray:
    """
    Làm mờ khuôn mặt người cao tuổi để bảo vệ quyền riêng tư (Privacy Preservation).
    Trích xuất từ vị trí 5 keypoints vùng đầu (nose, eyes, ears) của COCO Pose.
    """
    try:
        import cv2  # type: ignore
    except ImportError:
        return frame

    if not keypoints_list:
        return frame

    h_img, w_img = frame.shape[:2]
    blurred = frame.copy()

    for kps in keypoints_list:
        # Lấy 5 keypoints vùng đầu: 0=nose, 1=left_eye, 2=right_eye, 3=left_ear, 4=right_ear
        head_pts = []
        for i in range(min(5, len(kps))):
            kp = kps[i]
            # Keypoint object hoặc tuple (x, y, conf)
            conf = getattr(kp, "confidence", kp[2] if len(kp) > 2 else 0.0)
            x = getattr(kp, "x", kp[0])
            y = getattr(kp, "y", kp[1])
            if conf > 0.25:
                head_pts.append((x, y))

        if not head_pts:
            continue

        xs = [p[0] for p in head_pts]
        ys = [p[1] for p in head_pts]

        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        head_w = max(max_x - min_x, 30.0)
        head_h = max(max_y - min_y, 30.0)

        # Mở rộng vùng mặt thêm margin 40% để che trọn khuôn mặt
        margin_x = head_w * 0.4
        margin_y = head_h * 0.5

        x1 = max(0, int(min_x - margin_x))
        y1 = max(0, int(min_y - margin_y))
        x2 = min(w_img, int(max_x + margin_x))
        y2 = min(h_img, int(max_y + margin_y))

        if x2 > x1 and y2 > y1:
            face_roi = blurred[y1:y2, x1:x2]
            face_roi = cv2.GaussianBlur(face_roi, kernel_size, sigma)
            blurred[y1:y2, x1:x2] = face_roi

    return blurred


def draw_pose(
    frame: np.ndarray,
    keypoints: List,
    bboxes: List[Tuple[float, float, float, float]],
    is_fall: bool = False,
    tracks: Optional[List] = None,
) -> np.ndarray:
    """
    Vẽ skeleton, bounding box và trạng thái tracking lên frame để hiển thị.

    Args:
        frame: BGR numpy array
        keypoints: List of Keypoint lists (one per person)
        bboxes: Bounding boxes (x1,y1,x2,y2)
        is_fall: True nếu phát hiện té ngã (vẽ màu đỏ)
        tracks: Danh sách TrackedPerson (nếu có)
    """
    try:
        import cv2  # type: ignore
    except ImportError:
        logger.warning("OpenCV not available, skipping visualization.")
        return frame

    output = frame.copy()
    color_normal   = (0, 255, 0)     # Green
    color_fall     = (0, 0, 255)     # Red
    color_immobile = (0, 140, 255)   # Orange (Cảnh báo đột quỵ/bất động)
    color_kp       = (255, 200, 0)   # Cyan/Yellow

    # Map track theo index nếu có
    track_dict = {}
    if tracks:
        for t in tracks:
            track_dict[t.track_id] = t

    for i, (x1, y1, x2, y2) in enumerate(bboxes):
        current_track = tracks[i] if (tracks and i < len(tracks)) else None

        # Xác định màu sắc và nhãn
        color = color_normal
        label = "Person"

        if current_track:
            state = getattr(current_track, "posture_state", "STANDING")
            state_val = getattr(state, "value", str(state))
            track_id = getattr(current_track, "track_id", i + 1)
            is_elderly = getattr(current_track, "is_elderly", False)
            person_name = getattr(current_track, "person_name", f"ID:{track_id}")

            if state_val in ("FALLEN", "FALLING") or is_fall:
                color = color_fall
                label = f"[{person_name}] [FALL DETECTED!]"
            elif state_val == "IMMOBILE":
                color = color_immobile
                label = f"[{person_name}] [IMMOBILE / STROKE RISK]"
            elif is_elderly:
                color = (0, 255, 128)  # Xanh ngọc nổi bật cho Người cao tuổi
                label = f"[{person_name}] [{state_val}]"
            else:
                color = (255, 220, 50)  # Vàng cam cho Khách / Người nhà
                label = f"ID:{track_id} [{person_name}] [{state_val}]"
        elif is_fall:
            color = color_fall
            label = "FALL DETECTED!"

        cv2.rectangle(output, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
        cv2.putText(
            output, label, (int(x1), max(20, int(y1) - 8)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2
        )

        if i < len(keypoints):
            kps = keypoints[i]
            # Draw keypoints
            for kp in kps:
                conf = getattr(kp, "confidence", kp[2] if len(kp) > 2 else 0.0)
                kx = getattr(kp, "x", kp[0])
                ky = getattr(kp, "y", kp[1])
                if conf > 0.3:
                    cv2.circle(output, (int(kx), int(ky)), 3, color_kp, -1)

            # Draw skeleton
            for (a, b) in SKELETON_CONNECTIONS:
                if a < len(kps) and b < len(kps):
                    ka, kb = kps[a], kps[b]
                    ca = getattr(ka, "confidence", ka[2] if len(ka) > 2 else 0.0)
                    cb = getattr(kb, "confidence", kb[2] if len(kb) > 2 else 0.0)
                    if ca > 0.3 and cb > 0.3:
                        pt_a = (int(getattr(ka, "x", ka[0])), int(getattr(ka, "y", ka[1])))
                        pt_b = (int(getattr(kb, "x", kb[0])), int(getattr(kb, "y", kb[1])))
                        cv2.line(output, pt_a, pt_b, color, 2)

    return output



def nms(
    boxes: List[Tuple[float, float, float, float]],
    scores: List[float],
    iou_threshold: float = 0.45,
) -> List[int]:
    """
    Non-Maximum Suppression.

    Returns:
        List of indices of boxes to keep.
    """
    if not boxes:
        return []

    x1 = np.array([b[0] for b in boxes])
    y1 = np.array([b[1] for b in boxes])
    x2 = np.array([b[2] for b in boxes])
    y2 = np.array([b[3] for b in boxes])
    sc = np.array(scores)

    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = sc.argsort()[::-1]

    keep: List[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        inter_x1 = np.maximum(x1[i], x1[order[1:]])
        inter_y1 = np.maximum(y1[i], y1[order[1:]])
        inter_x2 = np.minimum(x2[i], x2[order[1:]])
        inter_y2 = np.minimum(y2[i], y2[order[1:]])
        inter_area = np.maximum(0.0, inter_x2 - inter_x1 + 1) * \
                     np.maximum(0.0, inter_y2 - inter_y1 + 1)
        iou = inter_area / (areas[i] + areas[order[1:]] - inter_area)
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]

    return keep


def letterbox(
    image: np.ndarray,
    target_size: Tuple[int, int] = (640, 640),
    color: Tuple[int, int, int] = (114, 114, 114),
) -> Tuple[np.ndarray, float, Tuple[int, int]]:
    """
    Resize với letterbox padding để giữ tỷ lệ khung hình.

    Returns:
        (padded_image, scale_ratio, (pad_left, pad_top))
    """
    try:
        import cv2  # type: ignore
    except ImportError:
        return image, 1.0, (0, 0)

    h, w = image.shape[:2]
    th, tw = target_size
    ratio = min(th / h, tw / w)
    new_h, new_w = int(h * ratio), int(w * ratio)

    resized = cv2.resize(image, (new_w, new_h))

    pad_left = (tw - new_w) // 2
    pad_top  = (th - new_h) // 2

    padded = np.full((th, tw, 3), color, dtype=np.uint8)
    padded[pad_top:pad_top + new_h, pad_left:pad_left + new_w] = resized

    return padded, ratio, (pad_left, pad_top)


def scale_coords(
    coords: Tuple[float, float, float, float],
    original_shape: Tuple[int, int],
    input_shape: Tuple[int, int] = (640, 640),
    ratio: float = 1.0,
    pad: Tuple[int, int] = (0, 0),
) -> Tuple[float, float, float, float]:
    """
    Chuyển đổi tọa độ từ không gian model về không gian ảnh gốc.
    """
    x1, y1, x2, y2 = coords
    x1 = (x1 - pad[0]) / ratio
    y1 = (y1 - pad[1]) / ratio
    x2 = (x2 - pad[0]) / ratio
    y2 = (y2 - pad[1]) / ratio

    # Clamp
    x1 = max(0.0, min(x1, original_shape[1]))
    y1 = max(0.0, min(y1, original_shape[0]))
    x2 = max(0.0, min(x2, original_shape[1]))
    y2 = max(0.0, min(y2, original_shape[0]))

    return x1, y1, x2, y2

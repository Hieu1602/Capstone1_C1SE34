"""
utils.py
Utility functions for vision AI module.

Provides:
- Frame annotation / visualization helpers
- NMS (Non-Maximum Suppression)
- Coordinate transformation helpers
"""

from typing import List, Tuple
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


def draw_pose(
    frame: np.ndarray,
    keypoints: List,
    bboxes: List[Tuple[float, float, float, float]],
    is_fall: bool = False,
) -> np.ndarray:
    """
    Vẽ skeleton và bounding box lên frame để debug/visualization.

    Args:
        frame: BGR numpy array
        keypoints: List of Keypoint lists (one per person)
        bboxes: Bounding boxes (x1,y1,x2,y2)
        is_fall: True nếu phát hiện té ngã (vẽ màu đỏ)

    Returns:
        Annotated frame
    """
    try:
        import cv2  # type: ignore
    except ImportError:
        logger.warning("OpenCV not available, skipping visualization.")
        return frame

    output = frame.copy()
    color_normal = (0, 255, 0)   # Green
    color_fall   = (0, 0, 255)   # Red
    color_kp     = (255, 0, 0)   # Blue for keypoints

    for i, (x1, y1, x2, y2) in enumerate(bboxes):
        color = color_fall if is_fall else color_normal
        cv2.rectangle(output, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
        label = "FALL DETECTED!" if is_fall else "Person"
        cv2.putText(
            output, label, (int(x1), int(y1) - 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2
        )

        if i < len(keypoints):
            kps = keypoints[i]
            # Draw keypoints
            for kp in kps:
                if kp.confidence > 0.3:
                    cv2.circle(output, (int(kp.x), int(kp.y)), 4, color_kp, -1)

            # Draw skeleton
            for (a, b) in SKELETON_CONNECTIONS:
                if a < len(kps) and b < len(kps):
                    if kps[a].confidence > 0.3 and kps[b].confidence > 0.3:
                        pt_a = (int(kps[a].x), int(kps[a].y))
                        pt_b = (int(kps[b].x), int(kps[b].y))
                        cv2.line(output, pt_a, pt_b, color_normal, 2)

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

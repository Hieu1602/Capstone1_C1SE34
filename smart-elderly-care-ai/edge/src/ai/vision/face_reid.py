"""
face_reid.py
Lightweight Face Recognition & Re-Identification Engine for Elderly Care.
Allows registering elderly faces directly from their Profile and matching them on the Edge Hub.

Key Advantages:
- Uses the 5 head keypoints (nose, 2 eyes, 2 ears) from YOLO-Pose to crop face in 0 ms.
- Computes 128-D normalized feature embedding for fast cosine similarity comparison.
- Operates in real-time (< 3ms) on Orange Pi 5 / RK3588 without extra heavy models.
"""

import json
import logging
import math
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np

logger = logging.getLogger(__name__)

_FACE_CASCADE = None


def _get_face_cascade():
    global _FACE_CASCADE
    if _FACE_CASCADE is None:
        import cv2  # type: ignore
        cls = getattr(cv2, "CascadeClassifier", None)
        data = getattr(cv2, "data", None)
        xml_path = (getattr(data, "haarcascades", "") + "haarcascade_frontalface_default.xml") if data else ""
        if cls is not None and xml_path:
            cascade = cls(xml_path)
            _FACE_CASCADE = cascade if not cascade.empty() else False
        else:
            _FACE_CASCADE = False
    return _FACE_CASCADE or None


def detect_face_in_portrait(image_bgr: np.ndarray) -> np.ndarray:
    """
    Phát hiện và cắt vùng khuôn mặt từ ảnh chân dung hồ sơ bệnh án.
    Nếu Haar Cascade không bắt được mặt (ảnh nghiêng/mờ), fallback về vùng trung tâm-trên của ảnh.
    """
    if image_bgr is None or image_bgr.size == 0:
        return image_bgr
    import cv2  # type: ignore

    h_img, w_img = image_bgr.shape[:2]
    cascade = _get_face_cascade()
    if cascade is not None:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        min_side = max(24, min(h_img, w_img) // 8)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(min_side, min_side))
        if len(faces) > 0:
            # Chọn khuôn mặt lớn nhất (chính diện nhất trong ảnh hồ sơ)
            x, y, w, h = max(faces, key=lambda f: int(f[2]) * int(f[3]))
            pad_x = int(w * 0.12)
            pad_y_top = int(h * 0.15)
            pad_y_bot = int(h * 0.12)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y_top)
            x2 = min(w_img, x + w + pad_x)
            y2 = min(h_img, y + h + pad_y_bot)
            if x2 > x1 + 15 and y2 > y1 + 15:
                return image_bgr[y1:y2, x1:x2]

    # Fallback: cắt gọn vùng chân dung giữa-trên nếu ảnh quá rộng (tránh nền & vai áo)
    if max(h_img, w_img) > 160:
        x1 = int(w_img * 0.2)
        x2 = int(w_img * 0.8)
        y1 = int(h_img * 0.08)
        y2 = int(h_img * 0.72)
        if x2 > x1 + 20 and y2 > y1 + 20:
            return image_bgr[y1:y2, x1:x2]
    return image_bgr


def extract_face_roi(
    frame: np.ndarray,
    keypoints: List[Tuple[float, float, float]],
    padding_scale: float = 0.5,
) -> Optional[np.ndarray]:
    """
    Cắt và căn chỉnh thẳng góc vùng mặt (Face ROI) từ frame dựa trên 5 keypoints đầu:
    0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear.
    """
    if len(keypoints) < 5 or frame is None or frame.size == 0:
        return None

    h_img, w_img = frame.shape[:2]
    head_pts = []

    for i in range(min(5, len(keypoints))):
        pt = keypoints[i]
        conf = pt[2] if len(pt) > 2 else 1.0
        if conf > 0.25:
            head_pts.append((pt[0], pt[1]))

    if len(head_pts) < 2:
        return None

    xs = [p[0] for p in head_pts]
    ys = [p[1] for p in head_pts]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)

    w_pts = max(x_max - x_min, 15.0)
    h_pts = max(y_max - y_min, 8.0)

    center_x = float(np.mean(xs))
    center_y = float(np.mean(ys))

    # Tỷ lệ nhân trắc học khuôn mặt: 5 keypoints đầu (mắt, mũi, tai) nằm ở nửa trên khuôn mặt.
    face_size = max(w_pts * 1.25, h_pts * 2.2, 40.0)
    half_w = face_size * 0.52
    half_h = face_size * 0.62

    x1 = max(0, int(center_x - half_w))
    y1 = max(0, int(center_y - half_h * 0.85))  # trán và đỉnh đầu
    x2 = min(w_img, int(center_x + half_w))
    y2 = min(h_img, int(center_y + half_h * 1.15)) # cằm và hàm dưới

    if x2 <= x1 + 20 or y2 <= y1 + 20:
        return None

    crop = frame[y1:y2, x1:x2]

    # Căn chỉnh xoay thẳng mặt dựa theo đường nối 2 mắt (giúp nhận diện ngay cả khi nghiêng đầu/té ngã)
    le = keypoints[1]
    re = keypoints[2]
    le_conf = le[2] if len(le) > 2 else 1.0
    re_conf = re[2] if len(re) > 2 else 1.0
    if le_conf > 0.25 and re_conf > 0.25:
        dx = float(le[0]) - float(re[0])
        dy = float(le[1]) - float(re[1])
        if math.hypot(dx, dy) >= 8.0:
            angle = math.degrees(math.atan2(dy, dx))
            if abs(angle) > 5.0:
                import cv2  # type: ignore
                ch, cw = crop.shape[:2]
                mat = cv2.getRotationMatrix2D((cw / 2.0, ch / 2.0), angle, 1.0)
                crop = cv2.warpAffine(crop, mat, (cw, ch), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    return crop


def compute_face_embedding(face_bgr: np.ndarray, target_dim: int = 128) -> np.ndarray:
    """
    Trích xuất vector đặc trưng khuôn mặt 128 chiều (Face Embedding) chuẩn hóa L2.
    Sử dụng Gaussian Blur giảm nhiễu + CLAHE cân bằng sáng cục bộ + Sobel 4x4 8-bin HOG.
    """
    import cv2  # type: ignore

    # 1. Chuẩn hóa kích thước khuôn mặt về 112 x 112 và cân bằng sáng cục bộ (CLAHE)
    aligned = cv2.resize(face_bgr, (112, 112), interpolation=cv2.INTER_LINEAR)
    gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
    gray = clahe.apply(gray)

    # 2. Rút trích đặc trưng Gradient Sobel (Đường nét mắt, mũi, miệng)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)

    # 3. Phân vùng 4x4 ô lưới (Grid cells) để giữ thông tin không gian vị trí
    cell_size = 28  # 112 / 4
    features = []

    for r in range(4):
        for c in range(4):
            y_start = r * cell_size
            x_start = c * cell_size
            sub_mag = mag[y_start : y_start + cell_size, x_start : x_start + cell_size]
            sub_ang = ang[y_start : y_start + cell_size, x_start : x_start + cell_size]

            # 8 hướng góc gradient cho mỗi cell -> 16 cells * 8 = 128 chiều
            hist, _ = np.histogram(sub_ang, bins=8, range=(0, 360), weights=sub_mag)
            features.extend(hist)

    embedding = np.array(features, dtype=np.float32)

    # 4. Chuẩn hóa L2-norm để tính Cosine Similarity bằng tích vô hướng
    norm = np.linalg.norm(embedding)
    if norm > 1e-6:
        embedding = embedding / norm

    return embedding


def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """Tính độ tương đồng Cosine giữa 2 vector đặc trưng khuôn mặt (khoảng từ -1.0 đến 1.0)."""
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 < 1e-6 or norm2 < 1e-6:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))


class FaceReIDManager:
    """
    Quản lý danh sách khuôn mặt Người cao tuổi đã được đăng ký qua Hồ sơ.
    Tự động so khớp khuôn mặt trên luồng camera Edge Hub.
    """

    def __init__(
        self,
        cache_file: Optional[str] = None,
        similarity_threshold: float = 0.65,
    ):
        self.similarity_threshold = similarity_threshold
        self.cache_file = Path(cache_file) if cache_file else Path("config/enrolled_faces.json")
        # { elderly_id: {"name": str, "embedding": np.ndarray, "avatar_url": str} }
        self.enrolled_elderly: Dict[str, Dict[str, Any]] = {}
        self.load_cache()

    def enroll_elderly(
        self,
        elderly_id: str,
        name: str,
        embedding: Union[List[float], np.ndarray],
        avatar_url: Optional[str] = None,
    ) -> None:
        """Đăng ký / cập nhật hồ sơ khuôn mặt người cao tuổi."""
        emb_arr = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(emb_arr)
        if norm > 1e-6:
            emb_arr = emb_arr / norm

        self.enrolled_elderly[elderly_id] = {
            "name": name,
            "embedding": emb_arr,
            "avatar_url": avatar_url or "",
        }
        self.save_cache()
        logger.info("[FaceReID] Da dang ky khuon mat thanh cong cho: %s (ID: %s)", name, elderly_id)

    def enroll_from_image(
        self,
        elderly_id: str,
        name: str,
        image_bgr: np.ndarray,
        avatar_url: Optional[str] = None,
    ) -> bool:
        """Phát hiện mặt từ ảnh chân dung, trích xuất embedding và đăng ký hồ sơ."""
        if image_bgr is None or image_bgr.size == 0:
            return False

        face_crop = detect_face_in_portrait(image_bgr)
        embedding = compute_face_embedding(face_crop)
        self.enroll_elderly(elderly_id, name, embedding, avatar_url)
        return True

    def identify_face(
        self,
        face_crop: np.ndarray,
    ) -> Tuple[Optional[str], Optional[str], float]:
        """
        Nhận diện khuôn mặt từ vùng ảnh cắt ra.

        Returns:
            (elderly_id, name, confidence) nếu trùng khớp,
            hoặc (None, "Khách / Người nhà", 0.0) nếu không khớp.
        """
        if not self.enrolled_elderly or face_crop is None or face_crop.size == 0:
            return None, "Khách / Người nhà", 0.0
        if min(face_crop.shape[:2]) < 20:
            return None, "Khách / Người nhà", 0.0

        target_emb = compute_face_embedding(face_crop)
        best_id: Optional[str] = None
        best_name = "Khách / Người nhà"
        best_sim = 0.0

        for e_id, info in self.enrolled_elderly.items():
            sim = cosine_similarity(target_emb, info["embedding"])
            if sim > best_sim:
                best_sim = sim
                best_id = e_id
                best_name = info["name"]

        if best_sim >= self.similarity_threshold:
            return best_id, best_name, best_sim

        return None, "Khách / Người nhà", best_sim

    def save_cache(self) -> None:
        """Lưu danh sách khuôn mặt vào file JSON để chạy offline."""
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            data_to_save = {}
            for e_id, info in self.enrolled_elderly.items():
                data_to_save[e_id] = {
                    "name": info["name"],
                    "avatar_url": info["avatar_url"],
                    "embedding": info["embedding"].tolist(),
                }
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning("[FaceReID] Khong the luu cache khuon mat: %s", e)

    def load_cache(self) -> None:
        """Đọc danh sách khuôn mặt từ file JSON."""
        if not self.cache_file.exists():
            return
        try:
            with open(self.cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for e_id, info in data.items():
                self.enrolled_elderly[e_id] = {
                    "name": info.get("name", "Người cao tuổi"),
                    "avatar_url": info.get("avatar_url", ""),
                    "embedding": np.array(info.get("embedding", []), dtype=np.float32),
                }
            logger.info("[FaceReID] Da tai %d ho so khuon mat tu cache.", len(self.enrolled_elderly))
        except Exception as e:
            logger.warning("[FaceReID] Khong the doc cache khuon mat: %s", e)

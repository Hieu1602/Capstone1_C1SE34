"""
face_embedding.py – Thuật toán trích xuất vector đặc trưng khuôn mặt (128-D).
Đồng bộ thuật toán giữa Backend và Edge Hub. Hỗ trợ cả Pillow (PIL) và OpenCV/NumPy.
"""

import io
import math
from typing import Any, List


def compute_face_embedding(face_input: Any, target_dim: int = 128) -> List[float]:
    """
    Trích xuất vector đặc trưng khuôn mặt 128 chiều (Face Embedding) chuẩn hóa L2.
    Sử dụng biểu diễn đa thang không gian và gradient (Spatial Color-Gradient Descriptor).
    Chấp nhận: PIL Image, bytes, hoặc np.ndarray.
    """
    from PIL import Image

    if isinstance(face_input, bytes):
        img = Image.open(io.BytesIO(face_input)).convert("RGB")
    elif isinstance(face_input, Image.Image):
        img = face_input.convert("RGB")
    else:
        # Nếu là numpy array từ OpenCV (BGR hoặc RGB)
        try:
            import numpy as np
            if isinstance(face_input, np.ndarray):
                if face_input.shape[-1] == 3:
                    # Chuyển BGR sang RGB nếu từ OpenCV
                    rgb = face_input[:, :, ::-1]
                    img = Image.fromarray(rgb)
                else:
                    img = Image.fromarray(face_input)
            else:
                img = Image.open(face_input).convert("RGB")
        except Exception:
            img = Image.open(face_input).convert("RGB")

    # 1. Chuẩn hóa kích thước khuôn mặt về 112 x 112 chuẩn nhận diện
    resized = img.resize((112, 112), Image.Resampling.BILINEAR)
    gray = resized.convert("L")
    raw_bytes = gray.tobytes()

    # 2. Phân vùng 4x4 ô lưới (Grid cells: 28x28) và tính 8-bin Gradient
    features: List[float] = []
    cell_w = 28
    cell_h = 28

    for r in range(4):
        for c in range(4):
            hist = [0.0] * 8
            y_start = r * cell_h
            x_start = c * cell_w
            for y in range(y_start, y_start + cell_h):
                for x in range(x_start, x_start + cell_w):
                    x0 = max(0, x - 1)
                    x1 = min(111, x + 1)
                    y0 = max(0, y - 1)
                    y1 = min(111, y + 1)
                    gx = float(raw_bytes[y * 112 + x1]) - float(raw_bytes[y * 112 + x0])
                    gy = float(raw_bytes[y1 * 112 + x]) - float(raw_bytes[y0 * 112 + x])
                    mag = math.sqrt(gx * gx + gy * gy)
                    ang = math.degrees(math.atan2(gy, gx)) % 360.0
                    bin_idx = min(7, int(ang / 45.0))
                    hist[bin_idx] += mag
            features.extend(hist)

    # 3. Chuẩn hóa L2-norm
    norm = math.sqrt(sum(f * f for f in features))
    if norm > 1e-6:
        features = [float(f / norm) for f in features]

    return features

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

    # 1. Cắt vùng khuôn mặt khỏi ảnh chân dung để khớp với FaceReID trên Edge Hub
    w_img, h_img = img.size
    cropped_via_cv2 = False
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        bgr = np.array(img)[:, :, ::-1]
        data = getattr(cv2, "data", None)
        xml_path = (getattr(data, "haarcascades", "") + "haarcascade_frontalface_default.xml") if data else ""
        cascade_cls = getattr(cv2, "CascadeClassifier", None)
        if cascade_cls and xml_path:
            cascade = cascade_cls(xml_path)
            if not cascade.empty():
                gray_cv = cv2.equalizeHist(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
                min_side = max(24, min(h_img, w_img) // 8)
                faces = cascade.detectMultiScale(gray_cv, scaleFactor=1.1, minNeighbors=4, minSize=(min_side, min_side))
                if len(faces) > 0:
                    x, y, w, h = max(faces, key=lambda f: int(f[2]) * int(f[3]))
                    x1 = max(0, x - int(w * 0.12))
                    y1 = max(0, y - int(h * 0.15))
                    x2 = min(w_img, x + w + int(w * 0.12))
                    y2 = min(h_img, y + h + int(h * 0.12))
                    if x2 > x1 + 15 and y2 > y1 + 15:
                        img = img.crop((x1, y1, x2, y2))
                        cropped_via_cv2 = True
    except Exception:
        pass

    if not cropped_via_cv2 and max(w_img, h_img) > 160:
        x1, x2 = int(w_img * 0.2), int(w_img * 0.8)
        y1, y2 = int(h_img * 0.08), int(h_img * 0.72)
        if x2 > x1 + 20 and y2 > y1 + 20:
            img = img.crop((x1, y1, x2, y2))

    # 2. Chuẩn hóa kích thước khuôn mặt về 112 x 112 & cân bằng sáng (khớp với Edge Hub)
    from PIL import ImageOps
    resized = img.resize((112, 112), Image.Resampling.BILINEAR)
    gray = ImageOps.equalize(resized.convert("L"))
    raw_bytes = gray.tobytes()

    # 2. Phân vùng 4x4 ô lưới (Grid cells: 28x28) và tính 8-bin Sobel 3x3 Gradient
    features: List[float] = []
    cell_w = 28
    cell_h = 28

    for r in range(4):
        for c in range(4):
            hist = [0.0] * 8
            y_start = r * cell_h
            x_start = c * cell_w
            for y in range(y_start, y_start + cell_h):
                ym1 = max(0, y - 1) * 112
                y0 = y * 112
                yp1 = min(111, y + 1) * 112
                for x in range(x_start, x_start + cell_w):
                    xm1 = max(0, x - 1)
                    xp1 = min(111, x + 1)
                    p00 = float(raw_bytes[ym1 + xm1])
                    p01 = float(raw_bytes[ym1 + x])
                    p02 = float(raw_bytes[ym1 + xp1])
                    p10 = float(raw_bytes[y0 + xm1])
                    p12 = float(raw_bytes[y0 + xp1])
                    p20 = float(raw_bytes[yp1 + xm1])
                    p21 = float(raw_bytes[yp1 + x])
                    p22 = float(raw_bytes[yp1 + xp1])
                    gx = (p02 + 2.0 * p12 + p22) - (p00 + 2.0 * p10 + p20)
                    gy = (p20 + 2.0 * p21 + p22) - (p00 + 2.0 * p01 + p02)
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

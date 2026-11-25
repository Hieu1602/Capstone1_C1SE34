import math
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from src.ai.vision.face_reid import (
    FaceReIDManager,
    compute_face_embedding,
    cosine_similarity,
    detect_face_in_portrait,
    extract_face_roi,
)


def _draw_synthetic_face(size: int = 160, variant: int = 0) -> np.ndarray:
    """Tạo ảnh khuôn mặt giả lập với các đặc điểm mắt/mũi/miệng khác nhau theo variant."""
    img = np.full((size, size, 3), 210 if variant == 0 else 185, dtype=np.uint8)
    cx, cy = size // 2, size // 2
    cv2.ellipse(img, (cx, cy), (size // 3, int(size * 0.42)), 0, 0, 360, (170, 145, 130), -1)
    if variant == 0:
        cv2.circle(img, (cx - 18, cy - 14), 6, (30, 30, 30), -1)
        cv2.circle(img, (cx + 18, cy - 14), 6, (30, 30, 30), -1)
        cv2.line(img, (cx, cy - 8), (cx, cy + 12), (70, 50, 40), 3)
        cv2.ellipse(img, (cx, cy + 28), (16, 6), 0, 0, 180, (50, 40, 80), 3)
    else:
        cv2.rectangle(img, (cx - 26, cy - 22), (cx - 8, cy - 8), (20, 20, 20), -1)
        cv2.rectangle(img, (cx + 8, cy - 22), (cx + 26, cy - 8), (20, 20, 20), -1)
        cv2.circle(img, (cx, cy + 8), 8, (60, 60, 60), 2)
        cv2.line(img, (cx - 18, cy + 32), (cx + 18, cy + 26), (40, 40, 40), 4)
    return img


class FaceReIDTests(unittest.TestCase):
    def test_embedding_is_128d_unit_vector(self):
        face = _draw_synthetic_face(120, variant=0)
        emb = compute_face_embedding(face)
        self.assertEqual(emb.shape, (128,))
        self.assertAlmostEqual(float(np.linalg.norm(emb)), 1.0, places=4)

    def test_portrait_crop_removes_outer_background(self):
        face = _draw_synthetic_face(160, variant=0)
        portrait = np.full((360, 360, 3), 40, dtype=np.uint8)
        portrait[80:240, 100:260] = face
        cropped = detect_face_in_portrait(portrait)
        self.assertLess(cropped.shape[0], portrait.shape[0])
        self.assertLess(cropped.shape[1], portrait.shape[1])

    def test_extract_face_roi_aligns_tilted_face(self):
        face = _draw_synthetic_face(160, variant=0)
        canvas = np.full((320, 320, 3), 120, dtype=np.uint8)
        canvas[80:240, 80:240] = face

        # Xoay cả ảnh 35 độ (mô phỏng đầu nghiêng khi té ngã)
        angle = 35.0
        mat = cv2.getRotationMatrix2D((160.0, 160.0), angle, 1.0)
        tilted = cv2.warpAffine(canvas, mat, (320, 320))

        def rot_pt(x, y):
            nx = mat[0, 0] * x + mat[0, 1] * y + mat[0, 2]
            ny = mat[1, 0] * x + mat[1, 1] * y + mat[1, 2]
            return (nx, ny, 0.95)

        kps_upright = [
            (160.0, 160.0, 0.95),  # nose
            (178.0, 146.0, 0.95),  # left_eye
            (142.0, 146.0, 0.95),  # right_eye
            (205.0, 155.0, 0.90),  # left_ear
            (115.0, 155.0, 0.90),  # right_ear
        ]
        kps_tilted = [rot_pt(x, y) for (x, y, _) in kps_upright]

        roi_upright = extract_face_roi(canvas, kps_upright)
        roi_tilted = extract_face_roi(tilted, kps_tilted)
        self.assertIsNotNone(roi_upright)
        self.assertIsNotNone(roi_tilted)

        sim = cosine_similarity(
            compute_face_embedding(roi_upright),  # type: ignore[arg-type]
            compute_face_embedding(roi_tilted),   # type: ignore[arg-type]
        )
        self.assertGreater(sim, 0.70)

    def test_identify_face_distinguishes_enrolled_profiles(self):
        with tempfile.TemporaryDirectory() as tmp:
            mgr = FaceReIDManager(cache_file=str(Path(tmp) / "faces.json"), similarity_threshold=0.65)
            face_a = _draw_synthetic_face(160, variant=0)
            face_b = _draw_synthetic_face(160, variant=1)
            mgr.enroll_from_image("id-a", "Cu An", face_a)
            mgr.enroll_from_image("id-b", "Cu Binh", face_b)

            # Thay đổi độ sáng nhẹ trên ảnh test của Cụ An
            face_a_dark = np.clip(face_a.astype(np.int16) - 35, 0, 255).astype(np.uint8)
            eid, name, score = mgr.identify_face(face_a_dark)
            self.assertEqual(eid, "id-a")
            self.assertEqual(name, "Cu An")
            self.assertGreaterEqual(score, 0.65)


if __name__ == "__main__":
    unittest.main()

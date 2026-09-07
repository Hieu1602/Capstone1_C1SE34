"""
pose_detector.py
YOLOv8-Pose Fall Detection module for Orange Pi 5 (RKNN / ONNX fallback).

Responsibilities:
- Load YOLOv8-Pose model (RKNN NPU-accelerated or ONNX CPU fallback)
- Detect human keypoints from camera frames
- Analyze pose to determine fall events
- Expose PoseDetector class consumed by main pipeline
"""

import logging
import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class Keypoint:
    x: float
    y: float
    confidence: float


@dataclass
class PoseResult:
    """Kết quả phát hiện dáng người từ một frame."""
    timestamp: float
    person_count: int
    is_fall_detected: bool
    bounding_boxes: List[Tuple[float, float, float, float]] = field(default_factory=list)
    keypoints: List[List[Keypoint]] = field(default_factory=list)
    confidence: float = 0.0
    raw_frame: Optional[np.ndarray] = None


# ---------------------------------------------------------------------------
# PoseDetector
# ---------------------------------------------------------------------------

class PoseDetector:
    """
    YOLOv8-Pose based human pose estimator and fall detector.

    Usage:
        detector = PoseDetector(config)
        detector.load_model()
        result = detector.detect(frame)
    """

    def __init__(self, config: dict):
        self.config = config
        self.model = None
        self.backend = None  # 'rknn' | 'onnx'
        self.input_shape = (640, 640)
        self.conf_threshold: float = config.get("confidence_threshold", 0.60)
        self.horizontal_ratio_threshold: float = config.get(
            "fall_detection", {}
        ).get("horizontal_ratio_threshold", 0.5)
        self.consecutive_frames: int = config.get(
            "fall_detection", {}
        ).get("consecutive_frames", 5)
        self._fall_frame_counter: int = 0

    # ------------------------------------------------------------------
    # Model Loading
    # ------------------------------------------------------------------

    def load_model(self) -> None:
        """Load RKNN model nếu có NPU, fallback sang ONNX Runtime."""
        rknn_path: str = self.config.get("model_path", "")
        onnx_path: str = self.config.get("fallback_model", "")

        if self._try_load_rknn(rknn_path):
            logger.info("[PoseDetector] RKNN model loaded: %s", rknn_path)
            self.backend = "rknn"
        elif self._try_load_onnx(onnx_path):
            logger.info("[PoseDetector] ONNX model loaded: %s", onnx_path)
            self.backend = "onnx"
        else:
            raise RuntimeError("Không thể load model RKNN hoặc ONNX.")

    def _try_load_rknn(self, model_path: str) -> bool:
        try:
            from rknnlite.api import RKNNLite  # type: ignore
            rknn = RKNNLite()
            ret = rknn.load_rknn(model_path)
            if ret != 0:
                return False
            ret = rknn.init_runtime()
            if ret != 0:
                return False
            self.model = rknn
            return True
        except (ImportError, Exception) as exc:  # noqa: BLE001
            logger.debug("[PoseDetector] RKNN unavailable: %s", exc)
            return False

    def _try_load_onnx(self, model_path: str) -> bool:
        try:
            import onnxruntime as ort  # type: ignore
            self.model = ort.InferenceSession(
                model_path, providers=["CPUExecutionProvider"]
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("[PoseDetector] ONNX load failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def detect(self, frame: np.ndarray) -> PoseResult:
        """
        Chạy inference trên một frame BGR numpy array.
        Trả về PoseResult.
        """
        if self.model is None:
            raise RuntimeError("Model chưa được load. Gọi load_model() trước.")

        preprocessed = self._preprocess(frame)

        if self.backend == "rknn":
            raw_output = self._infer_rknn(preprocessed)
        else:
            raw_output = self._infer_onnx(preprocessed)

        bboxes, keypoints_list = self._postprocess(raw_output, frame.shape)
        is_fall = self._analyze_fall(bboxes, keypoints_list)

        return PoseResult(
            timestamp=time.time(),
            person_count=len(bboxes),
            is_fall_detected=is_fall,
            bounding_boxes=bboxes,
            keypoints=keypoints_list,
            confidence=max((kp.confidence for kps in keypoints_list for kp in kps), default=0.0),
            raw_frame=frame,
        )

    def _preprocess(self, frame: np.ndarray) -> np.ndarray:
        """Resize + normalize frame về input model."""
        import cv2  # type: ignore
        resized = cv2.resize(frame, self.input_shape)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        normalized = rgb.astype(np.float32) / 255.0
        return np.expand_dims(normalized, axis=0)  # (1, H, W, 3)

    def _infer_rknn(self, inputs: np.ndarray) -> List:
        outputs = self.model.inference(inputs=[inputs])
        return outputs

    def _infer_onnx(self, inputs: np.ndarray) -> List:
        input_name = self.model.get_inputs()[0].name
        # ONNX expects (1, 3, H, W)
        inputs_t = np.transpose(inputs, (0, 3, 1, 2))
        outputs = self.model.run(None, {input_name: inputs_t})
        return outputs

    def _postprocess(
        self,
        raw_output: List,
        original_shape: Tuple,
    ) -> Tuple[List, List]:
        """
        Parse YOLOv8-Pose output thành danh sách bounding boxes và keypoints.
        Đây là skeleton — cần tuỳ chỉnh theo định dạng output thực tế của model.
        """
        bboxes: List[Tuple[float, float, float, float]] = []
        keypoints_list: List[List[Keypoint]] = []

        if raw_output is None or len(raw_output) == 0:
            return bboxes, keypoints_list

        # Placeholder parsing logic — replace with actual YOLOv8 postprocess
        output = raw_output[0]  # shape: (1, num_detections, 56) for COCO 17 kp
        if output is None:
            return bboxes, keypoints_list

        h_orig, w_orig = original_shape[:2]
        h_in, w_in = self.input_shape

        for detection in output[0]:
            conf = float(detection[4])
            if conf < self.conf_threshold:
                continue

            x1 = float(detection[0]) * w_orig / w_in
            y1 = float(detection[1]) * h_orig / h_in
            x2 = float(detection[2]) * w_orig / w_in
            y2 = float(detection[3]) * h_orig / h_in
            bboxes.append((x1, y1, x2, y2))

            # Keypoints: 17 joints × 3 values (x, y, conf)
            kps: List[Keypoint] = []
            kp_data = detection[5:]
            for i in range(0, len(kp_data), 3):
                kps.append(
                    Keypoint(
                        x=float(kp_data[i]) * w_orig / w_in,
                        y=float(kp_data[i + 1]) * h_orig / h_in,
                        confidence=float(kp_data[i + 2]),
                    )
                )
            keypoints_list.append(kps)

        return bboxes, keypoints_list

    # ------------------------------------------------------------------
    # Fall Detection Logic
    # ------------------------------------------------------------------

    def _analyze_fall(
        self,
        bboxes: List[Tuple[float, float, float, float]],
        keypoints_list: List[List[Keypoint]],
    ) -> bool:
        """
        Phân tích tư thế để phát hiện té ngã.
        Tiêu chí: bounding box nằm ngang (width > height) kết hợp
        với keypoints vai & hông gần ngang bằng nhau.
        """
        fall_detected_this_frame = False

        for i, (x1, y1, x2, y2) in enumerate(bboxes):
            w = x2 - x1
            h = y2 - y1
            if h == 0:
                continue

            # Kiểm tra tỷ lệ bounding box
            if (w / h) > (1.0 / self.horizontal_ratio_threshold):
                fall_detected_this_frame = True
                break

            # Kiểm tra keypoints nếu có
            if i < len(keypoints_list) and len(keypoints_list[i]) >= 12:
                kps = keypoints_list[i]
                # Keypoint indices (COCO): 5=left_shoulder, 6=right_shoulder,
                # 11=left_hip, 12=right_hip
                shoulder_y = (kps[5].y + kps[6].y) / 2
                hip_y = (kps[11].y + kps[12].y) / 2
                # Nếu vai và hông gần ngang bằng -> ngã
                if abs(shoulder_y - hip_y) < (h * 0.2):
                    fall_detected_this_frame = True
                    break

        if fall_detected_this_frame:
            self._fall_frame_counter += 1
        else:
            self._fall_frame_counter = max(0, self._fall_frame_counter - 1)

        return self._fall_frame_counter >= self.consecutive_frames

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def release(self) -> None:
        """Giải phóng tài nguyên model."""
        if self.model and self.backend == "rknn":
            self.model.release()
        self.model = None
        logger.info("[PoseDetector] Resources released.")

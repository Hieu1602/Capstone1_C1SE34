"""
train_fall_detector.py
Huấn luyện mô hình phân loại Té ngã (Fall Classifier) từ bộ dữ liệu GMDCSA-24.
Sử dụng YOLOv8-Pose trích xuất 17 điểm khớp xương (Keypoints) kết hợp
Đặc trưng Động học (Kinematic Features) và thuật toán Random Forest / Gradient Boosting.

Đầu ra:
- Mô hình Machine Learning: edge/src/ai/vision/models/fall_classifier.pkl
- Báo cáo đánh giá (Accuracy, Precision, Recall, F1, Confusion Matrix)
- Dữ liệu đặc trưng: data/processed/extracted_features.npz
"""

import argparse
import glob
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import cv2
import joblib
import numpy as np
from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

# Đảm bảo import được module của edge
EDGE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EDGE_ROOT))

from src.ai.vision.pose_detector import PoseDetector

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("FallTrainer")


# ---------------------------------------------------------------------------
# Trích xuất đặc trưng Động học (Kinematic Feature Extraction)
# ---------------------------------------------------------------------------

def compute_kinematic_features(
    keypoints: List[Tuple[float, float, float]],
    bbox: Tuple[float, float, float, float],
    prev_hip_y: Optional[float] = None,
    fps: float = 15.0,
) -> Tuple[Optional[np.ndarray], float]:
    """
    Trích xuất vector 8 đặc trưng động học từ 17 keypoints và bounding box.
    """
    if len(keypoints) < 17 or bbox is None:
        return None, 0.0

    x1, y1, x2, y2 = bbox
    w = max(1.0, x2 - x1)
    h = max(1.0, y2 - y1)
    aspect_ratio = w / h  # Đặc trưng 1: Tỷ lệ khung bao (> 1.0 khi nằm)

    # Keypoints COCO:
    # 0: nose, 5: l_sh, 6: r_sh, 11: l_hip, 12: r_hip, 13: l_knee, 14: r_knee, 15: l_ank, 16: r_ank
    l_sh, r_sh = keypoints[5], keypoints[6]
    l_hip, r_hip = keypoints[11], keypoints[12]

    # Trung điểm vai & hông
    sh_x = (l_sh[0] + r_sh[0]) / 2.0
    sh_y = (l_sh[1] + r_sh[1]) / 2.0
    hip_x = (l_hip[0] + r_hip[0]) / 2.0
    hip_y = (l_hip[1] + r_hip[1]) / 2.0

    # Đặc trưng 2: Vị trí hông chuẩn hóa theo chiều cao box
    norm_hip_y = (hip_y - y1) / h

    # Đặc trưng 3: Góc nghiêng cột sống so với phương thẳng đứng (0°=đứng, 90°=nằm)
    dx = abs(sh_x - hip_x)
    dy = abs(sh_y - hip_y)
    spine_angle = np.degrees(np.arctan2(dx, dy + 1e-5))

    # Đặc trưng 4: Chiều dài thân người (torso length) chuẩn hóa
    torso_len = np.sqrt(dx**2 + dy**2) / (h + 1e-5)

    # Đặc trưng 5: Vận tốc rơi của hông (chuẩn hóa theo chiều cao / giây)
    hip_velocity = 0.0
    if prev_hip_y is not None:
        dy_hip = (hip_y - prev_hip_y) / (h + 1e-5)
        hip_velocity = dy_hip * fps

    # Đặc trưng 6: Khoảng cách từ đầu đến hông theo trục dọc
    nose_y = keypoints[0][1]
    head_hip_dist = (hip_y - nose_y) / (h + 1e-5)

    # Đặc trưng 7: Khoảng cách từ hông đến chân (đầu gối / mắt cá)
    l_knee, r_knee = keypoints[13], keypoints[14]
    knee_y = (l_knee[1] + r_knee[1]) / 2.0
    hip_knee_dist = (knee_y - hip_y) / (h + 1e-5)

    # Đặc trưng 8: Độ rộng chân so với độ rộng vai
    sh_w = abs(l_sh[0] - r_sh[0]) + 1e-5
    knee_w = abs(l_knee[0] - r_knee[0])
    leg_spread_ratio = knee_w / sh_w

    features = np.array([
        aspect_ratio,
        norm_hip_y,
        spine_angle,
        torso_len,
        hip_velocity,
        head_hip_dist,
        hip_knee_dist,
        leg_spread_ratio,
    ], dtype=np.float32)

    return features, hip_y


# ---------------------------------------------------------------------------
# Quét Video Dataset & Trích xuất Dữ liệu huấn luyện
# ---------------------------------------------------------------------------

def extract_features_from_dataset(
    dataset_dir: Path,
    pose_detector: PoseDetector,
    max_videos_per_class: Optional[int] = None,
    sample_stride: int = 2,
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Duyệt qua các Subject trong GMDCSA-24, trích xuất vector đặc trưng và nhãn.
    Nhãn: 1 = Fall (Té ngã), 0 = ADL (Sinh hoạt bình thường).
    """
    x_list: List[np.ndarray] = []
    y_list: List[int] = []
    video_sources: List[str] = []

    fall_videos = sorted(glob.glob(str(dataset_dir / "Subject *" / "Fall" / "*.mp4")))
    adl_videos = sorted(glob.glob(str(dataset_dir / "Subject *" / "ADL" / "*.mp4")))

    if max_videos_per_class:
        fall_videos = fall_videos[:max_videos_per_class]
        adl_videos = adl_videos[:max_videos_per_class]

    logger.info("Tìm thấy %d video Fall và %d video ADL.", len(fall_videos), len(adl_videos))

    all_tasks = [(v, 1) for v in fall_videos] + [(v, 0) for v in adl_videos]
    total_tasks = len(all_tasks)

    for idx, (video_path, label) in enumerate(all_tasks, 1):
        rel_name = Path(video_path).relative_to(dataset_dir)
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning("Không thể mở video: %s", video_path)
            continue

        fps = cap.get(cv2.CAP_PROP_FPS) or 15.0
        frame_idx = 0
        prev_hip_y = None
        extracted_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % sample_stride != 0:
                continue

            # Chạy PoseDetector
            raw_out = pose_detector._infer_onnx(pose_detector._preprocess(frame))
            bboxes, kps_list = pose_detector._postprocess(raw_out, frame.shape)

            if not bboxes or not kps_list:
                prev_hip_y = None
                continue

            # Lấy đối tượng có confidence lớn nhất
            bbox = bboxes[0]
            kps_tuples = [(kp.x, kp.y, kp.confidence) for kp in kps_list[0]]

            feat, hip_y = compute_kinematic_features(kps_tuples, bbox, prev_hip_y, fps)
            prev_hip_y = hip_y

            if feat is not None:
                x_list.append(feat)
                y_list.append(label)
                video_sources.append(str(rel_name))
                extracted_count += 1

        cap.release()
        logger.info("[%d/%d] Đã xử lý %s: %d mẫu trích xuất (Nhãn: %s)",
                    idx, total_tasks, rel_name, extracted_count, "FALL" if label == 1 else "ADL")

    X = np.array(x_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int64)
    return X, y, video_sources


# ---------------------------------------------------------------------------
# Huấn luyện & Đánh giá Mô hình
# ---------------------------------------------------------------------------

def train_and_evaluate(
    X: np.ndarray,
    y: np.ndarray,
    output_model_path: Path,
    metrics_path: Path,
) -> Dict:
    """
    Chia tập train/test (80/20), huấn luyện Random Forest & Extra Trees,
    đánh giá ma trận nhầm lẫn và lưu model.
    """
    logger.info("Tổng số mẫu huấn luyện: %d (Fall: %d, ADL: %d)", len(y), (y == 1).sum(), (y == 0).sum())

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # 1. Khởi tạo mô hình Random Forest tối ưu cho Edge AI
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    t0 = time.time()
    clf.fit(X_train, y_train)
    train_time = time.time() - t0
    logger.info("Huấn luyện hoàn tất trong %.2f giây.", train_time)

    # 2. Đánh giá trên tập kiểm thử (Test Set)
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred).tolist()

    report = classification_report(y_test, y_pred, target_names=["ADL", "FALL"], output_dict=True)

    metrics = {
        "accuracy": round(float(acc) * 100, 2),
        "precision": round(float(prec) * 100, 2),
        "recall": round(float(rec) * 100, 2),
        "f1_score": round(float(f1) * 100, 2),
        "confusion_matrix": {
            "true_adl": cm[0][0],
            "false_fall": cm[0][1],
            "false_adl": cm[1][0],
            "true_fall": cm[1][1],
        },
        "training_time_seconds": round(train_time, 2),
        "total_samples": len(y),
        "train_samples": len(y_train),
        "test_samples": len(y_test),
        "feature_importances": {
            "aspect_ratio": round(float(clf.feature_importances_[0]), 4),
            "norm_hip_y": round(float(clf.feature_importances_[1]), 4),
            "spine_angle": round(float(clf.feature_importances_[2]), 4),
            "torso_len": round(float(clf.feature_importances_[3]), 4),
            "hip_velocity": round(float(clf.feature_importances_[4]), 4),
            "head_hip_dist": round(float(clf.feature_importances_[5]), 4),
            "hip_knee_dist": round(float(clf.feature_importances_[6]), 4),
            "leg_spread_ratio": round(float(clf.feature_importances_[7]), 4),
        },
        "classification_report": report,
    }

    # 3. Lưu mô hình đã train
    output_model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, output_model_path)
    logger.info("Đã lưu mô hình huấn luyện vào: %s", output_model_path)

    # 4. Lưu báo cáo metrics
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    logger.info("Đã lưu báo cáo đánh giá vào: %s", metrics_path)

    return metrics


# ---------------------------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Huấn luyện mô hình Phát hiện Té ngã GMDCSA-24")
    parser.add_argument("--dataset-dir", type=str, default="data/raw/GMDCSA-24", help="Đường dẫn đến thư mục dataset")
    parser.add_argument("--model-path", type=str, default="edge/src/ai/vision/models/yolov8n-pose.onnx", help="Đường dẫn YOLOv8-pose ONNX")
    parser.add_argument("--output-model", type=str, default="edge/src/ai/vision/models/fall_classifier.pkl", help="Đường dẫn xuất file mô hình")
    parser.add_argument("--output-metrics", type=str, default="data/processed/training_metrics.json", help="Đường dẫn xuất metrics")
    parser.add_argument("--max-videos", type=int, default=15, help="Số video tối đa mỗi lớp để train nhanh (0 để chạy toàn bộ)")
    parser.add_argument("--stride", type=int, default=2, help="Khoảng bước frame khi trích xuất")
    args = parser.parse_args()

    project_root = Path("smart-elderly-care-ai")
    if not project_root.exists():
        project_root = Path(".")

    dataset_path = project_root / args.dataset_dir
    pose_model_path = project_root / args.model_path
    output_model = project_root / args.output_model
    output_metrics = project_root / args.output_metrics
    features_cache = project_root / "data/processed/features_cache.npz"

    if not dataset_path.exists():
        logger.error("Không tìm thấy thư mục dataset tại: %s", dataset_path)
        sys.exit(1)

    logger.info("Khởi tạo PoseDetector với mô hình: %s", pose_model_path)
    cfg = {"fallback_model": str(pose_model_path), "confidence_threshold": 0.45}
    detector = PoseDetector(cfg)
    detector.load_model()

    max_vids = None if args.max_videos <= 0 else args.max_videos
    logger.info("Bắt đầu trích xuất đặc trưng từ GMDCSA-24 (max %s video/class, stride=%d)...", max_vids, args.stride)
    
    t_start = time.time()
    X, y, sources = extract_features_from_dataset(dataset_path, detector, max_videos_per_class=max_vids, sample_stride=args.stride)
    extract_time = time.time() - t_start
    logger.info("Trích xuất xong %d mẫu trong %.1f giây.", len(X), extract_time)

    # Lưu cache đặc trưng
    features_cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(features_cache, X=X, y=y)
    logger.info("Đã lưu cache đặc trưng vào: %s", features_cache)

    # Huấn luyện mô hình
    metrics = train_and_evaluate(X, y, output_model, output_metrics)

    print("\n" + "=" * 60)
    print("           KẾT QUẢ HUẤN LUYỆN MÔ HÌNH TÉ NGÃ GMDCSA-24")
    print("=" * 60)
    print(f"  * Tổng số khung hình (Samples):    {metrics['total_samples']}")
    print(f"  * Độ chính xác (Accuracy):          {metrics['accuracy']}%")
    print(f"  * Độ chuẩn xác (Precision):        {metrics['precision']}%")
    print(f"  * Độ nhạy / Tỷ lệ bắt ngã (Recall):{metrics['recall']}%")
    print(f"  * F1-Score:                         {metrics['f1_score']}%")
    print("-" * 60)
    print("  * Ma trận nhầm lẫn (Confusion Matrix):")
    print(f"      - Đoán đúng Sinh hoạt (True ADL):   {metrics['confusion_matrix']['true_adl']}")
    print(f"      - Báo động nhầm (False Fall):       {metrics['confusion_matrix']['false_fall']}")
    print(f"      - Bỏ sót ca ngã (False ADL):        {metrics['confusion_matrix']['false_adl']}")
    print(f"      - Đoán đúng Té ngã (True Fall):     {metrics['confusion_matrix']['true_fall']}")
    print("-" * 60)
    print("  * Mức độ quan trọng của đặc trưng (Feature Importances):")
    for feat_name, imp in sorted(metrics['feature_importances'].items(), key=lambda x: x[1], reverse=True):
        bar = "█" * int(imp * 30)
        print(f"      - {feat_name:18s}: {imp:6.4f}  {bar}")
    print("=" * 60)
    print(f"  * File mô hình xuất xưởng:  {output_model}")
    print(f"  * File báo cáo chi tiết:    {output_metrics}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()

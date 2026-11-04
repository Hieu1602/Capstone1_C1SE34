"""
run_pose_monitor.py
Chạy giám sát camera thời gian thực với mô hình YOLOv8-Pose.
Tự động vẽ khung xương 17 khớp, phát hiện té ngã / bất động và gửi cảnh báo MQTT.

Cách chạy:
    .venv\\Scripts\\python edge/run_pose_monitor.py --view
Hoặc chạy ngầm:
    .venv\\Scripts\\python edge/run_pose_monitor.py
"""

import argparse
import json
import logging
import os
from pathlib import Path
import sys
import time

from dotenv import load_dotenv

# Nạp cấu hình từ .env.camera và .env
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env.camera")
load_dotenv(ROOT_DIR / ".env")

# Thêm edge vào sys.path
EDGE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EDGE_DIR))

import cv2
from src.ai.vision.pose_detector import PoseDetector
from src.ai.vision.utils import draw_pose
from src.drivers.tapo import rtsp_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PoseMonitor")


def try_connect_mqtt():
    """Khởi tạo kết nối MQTT tùy chọn tới EMQX broker."""
    try:
        from src.services.mqtt_client import MQTTClient
        mqtt_host = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
        mqtt_port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
        client = MQTTClient({
            "broker": mqtt_host,
            "port": mqtt_port,
            "username": os.getenv("MQTT_USERNAME", "backend"),
            "password": os.getenv("MQTT_PASSWORD", "mqtt_secure_pass_123"),
            "client_id": "edge-yolo-pose-monitor",
            "topics": {
                "telemetry": "seca/home/vitals/camera",
                "alerts": "seca/home/vitals/alerts",
            },
        })
        client.connect()
        logger.info("[MQTT] Đã kết nối MQTT broker %s:%d", mqtt_host, mqtt_port)
        return client
    except Exception as exc:
        logger.warning("[MQTT] Không kết nối được MQTT (%s). Chạy chế độ độc lập.", exc)
        return None


def main():
    parser = argparse.ArgumentParser(description="YOLOv8-Pose Camera Monitor")
    parser.add_argument("--view", action="store_true", help="Hiển thị cửa sổ video trực tiếp kèm khung xương (Press 'q' to quit)")
    parser.add_argument("--source", type=str, default="", help="Nguồn video (mặc định đọc RTSP Tapo hoặc webcam 0)")
    parser.add_argument("--conf", type=float, default=0.50, help="Ngưỡng tin cậy (mặc định 0.50)")
    args = parser.parse_args()

    # 1. Xác định nguồn video
    source = args.source
    if not source:
        try:
            source = rtsp_url()
            logger.info("Kết nối tới camera Tapo RTSP: %s:554", os.getenv("TAPO_HOST", "192.168.1.8"))
        except Exception:
            source = 0
            logger.info("Không có cấu hình Tapo hợp lệ, dùng Webcam 0")

    # 2. Khởi tạo PoseDetector
    model_onnx = str(EDGE_DIR / "src" / "ai" / "vision" / "models" / "yolov8n-pose.onnx")
    model_rknn = str(EDGE_DIR / "src" / "ai" / "vision" / "models" / "yolov8n-pose.rknn")

    detector = PoseDetector({
        "model_path": model_rknn,
        "fallback_model": model_onnx,
        "confidence_threshold": args.conf,
        "face_blurring": False,  # Tắt blur khi xem trực quan để thấy rõ
        "fall_detection": {
            "horizontal_ratio_threshold": 0.5,
            "consecutive_frames": 3,
        },
    })
    detector.load_model()
    logger.info("YOLOv8-Pose sẵn sàng (backend: %s)", detector.backend)

    # 3. Kết nối MQTT tùy chọn
    mqtt = try_connect_mqtt()

    # 4. Mở luồng camera
    cap = cv2.VideoCapture(int(source) if str(source).isdigit() else source, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        logger.error("Không thể mở nguồn video: %s", source)
        return

    logger.info("Bắt đầu giám sát. Nhấn Ctrl+C (hoặc 'q' trong cửa sổ xem) để thoát.")
    last_alert_time = 0.0
    frame_count = 0
    start_time = time.time()

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                logger.warning("Mất tín hiệu camera, đang thử kết nối lại...")
                time.sleep(1.0)
                continue

            frame_count += 1
            res = detector.detect(frame)

            # Phát hiện ngã -> Gửi cảnh báo
            if res.is_fall_detected:
                now = time.time()
                if now - last_alert_time > 5.0:  # Tránh spam cảnh báo quá dày
                    last_alert_time = now
                    logger.warning(">>> [CẢNH BÁO TÉ NGÃ] Phát hiện sự cố ngã tại camera! <<<")
                    if mqtt:
                        alert_payload = {
                            "event_type": "FALL_DETECTED",
                            "severity": "CRITICAL",
                            "confidence": res.confidence,
                            "timestamp": now,
                            "device_id": os.getenv("CAMERA_DEVICE_ID", "camera-main"),
                            "message": "Phát hiện té ngã (YOLOv8-Pose AI) từ camera!",
                        }
                        mqtt.publish_alert(alert_payload)

            # Hiển thị trực quan nếu có cờ --view
            if args.view:
                vis_frame = draw_pose(
                    frame=frame,
                    keypoints=res.keypoints,
                    bboxes=res.bounding_boxes,
                    is_fall=res.is_fall_detected,
                    tracks=res.tracks,
                )

                # Tính FPS hiển thị
                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0.0
                info_text = f"FPS: {fps:.1f} | Nguoi: {res.person_count} | Nga: {'CO' if res.is_fall_detected else 'Khong'}"
                cv2.putText(vis_frame, info_text, (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

                # Resize vừa màn hình nếu frame 1080p quá to
                h, w = vis_frame.shape[:2]
                if w > 1280:
                    vis_frame = cv2.resize(vis_frame, (1280, int(h * 1280 / w)))

                cv2.imshow("Smart Elderly Care AI - YOLOv8-Pose Monitor", vis_frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q") or key == 27:
                    break

    except KeyboardInterrupt:
        logger.info("Nhận tín hiệu dừng từ người dùng.")
    finally:
        cap.release()
        if args.view:
            cv2.destroyAllWindows()
        if mqtt:
            mqtt.disconnect()
        detector.release()
        logger.info("Đã tắt tiến trình giám sát AI an toàn.")


if __name__ == "__main__":
    main()


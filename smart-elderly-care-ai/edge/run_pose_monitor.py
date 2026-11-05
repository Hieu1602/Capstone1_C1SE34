"""
run_pose_monitor.py
Chạy giám sát camera thời gian thực với mô hình YOLOv8-Pose.
Tự động vẽ khung xương 17 khớp, phát hiện té ngã / bất động và gửi cảnh báo MQTT kèm video clip.

Cách chạy:
    .venv\\Scripts\\python edge/run_pose_monitor.py --view
Hoặc chạy ngầm:
    .venv\\Scripts\\python edge/run_pose_monitor.py
"""

import argparse
from collections import deque
import json
import logging
import os
from pathlib import Path
import sys
import time
import uuid

from dotenv import load_dotenv

# Nạp cấu hình từ .env của dự án (không dùng .env.camera)
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")
if (ROOT_DIR / "backend" / ".env").exists():
    load_dotenv(ROOT_DIR / "backend" / ".env")
if (Path(__file__).resolve().parent / ".env").exists():
    load_dotenv(Path(__file__).resolve().parent / ".env")

# Thêm edge vào sys.path
EDGE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EDGE_DIR))

import cv2
from src.ai.vision.pose_detector import PoseDetector
from src.ai.vision.utils import draw_pose

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PoseMonitor")


def get_video_source(cli_source: str = "") -> str | int:
    """Xác định nguồn camera từ tham số dòng lệnh, biến môi trường hoặc Tapo RTSP."""
    if cli_source:
        return int(cli_source) if cli_source.isdigit() else cli_source

    env_source = os.getenv("CAMERA_SOURCE", "").strip()
    if env_source:
        return int(env_source) if env_source.isdigit() else env_source

    # Nếu có cấu hình TAPO_HOST trong .env
    if os.getenv("TAPO_HOST"):
        try:
            from src.drivers.tapo import rtsp_url
            url = rtsp_url()
            logger.info("Kết nối tới camera Tapo RTSP: %s:554", os.getenv("TAPO_HOST"))
            return url
        except Exception as exc:
            logger.warning("Không thể tạo URL RTSP Tapo (%s). Chuyển sang webcam mặc định.", exc)

    logger.info("Dùng Webcam mặc định (index 0).")
    return 0


def try_connect_mqtt():
    """Khởi tạo kết nối MQTT tùy chọn tới EMQX broker theo chuẩn dự án."""
    try:
        from src.services.mqtt_client import MQTTClient

        mqtt_host = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
        mqtt_port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
        device_id = os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main"))

        client = MQTTClient({
            "broker_host": mqtt_host,
            "broker_port": mqtt_port,
            "username": os.getenv("MQTT_USERNAME", "backend"),
            "password": os.getenv("MQTT_PASSWORD", "mqtt_secure_pass_123"),
            "client_id": f"edge-pose-monitor-{uuid.uuid4().hex[:6]}",
            "topics": {
                "telemetry": f"care/{device_id}/telemetry",
                "alert": f"care/{device_id}/alert",
            },
        })
        client.connect()
        logger.info("[MQTT] Đã kết nối MQTT broker %s:%d (topic alert: care/%s/alert)", mqtt_host, mqtt_port, device_id)
        return client
    except Exception as exc:
        logger.warning("[MQTT] Không kết nối được MQTT (%s). Chạy chế độ độc lập.", exc)
        return None


def main():
    parser = argparse.ArgumentParser(description="YOLOv8-Pose Camera Monitor")
    parser.add_argument("--view", action="store_true", help="Hiển thị cửa sổ video trực tiếp kèm khung xương (Press 'q' to quit)")
    parser.add_argument("--source", type=str, default="", help="Nguồn video (RTSP URL, file mp4, hoặc index webcam)")
    parser.add_argument("--conf", type=float, default=float(os.getenv("POSE_CONF_THRESHOLD", "0.35")), help="Ngưỡng tin cậy (mặc định 0.35)")
    parser.add_argument("--drop-vel", type=float, default=float(os.getenv("FALL_DROP_VELOCITY", "0.55")), help="Ngưỡng vận tốc rơi hông (mặc định 0.55)")
    parser.add_argument("--duration", type=float, default=float(os.getenv("FALL_MIN_DURATION", "0.40")), help="Thời gian tối thiểu nằm sàn để xác nhận ngã (mặc định 0.40s)")
    parser.add_argument("--spine-angle", type=float, default=float(os.getenv("FALL_ANGLE_THRESHOLD", "55.0")), help="Góc nghiêng cột sống ngưỡng ngã (mặc định 55.0 độ)")
    parser.add_argument("--aspect-ratio", type=float, default=float(os.getenv("FALL_ASPECT_RATIO", "1.25")), help="Tỷ lệ W/H bounding box ngưỡng ngã (mặc định 1.25)")
    args = parser.parse_args()

    # 1. Xác định nguồn video
    source = get_video_source(args.source)

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
            "drop_velocity_threshold": args.drop_vel,
            "fallen_angle_threshold": args.spine_angle,
            "aspect_ratio_threshold": args.aspect_ratio,
            "min_fallen_duration": args.duration,
        },
    })
    detector.load_model()
    logger.info("YOLOv8-Pose sẵn sàng (backend: %s)", detector.backend)

    # 3. Kết nối MQTT tùy chọn
    mqtt = try_connect_mqtt()

    # 4. Mở luồng camera (tách biệt webcam index với RTSP/file)
    is_numeric = str(source).isdigit() or isinstance(source, int)
    if is_numeric:
        cam_idx = int(source)
        cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(cam_idx)
    else:
        cap = cv2.VideoCapture(str(source), cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap = cv2.VideoCapture(str(source))

    if not cap.isOpened():
        if not is_numeric:
            logger.warning("Không thể mở nguồn video '%s'. Thử chuyển sang webcam 0...", source)
            cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            logger.error("Không thể mở bất kỳ nguồn video nào.")
            return

    logger.info("Bắt đầu giám sát. Nhấn Ctrl+C (hoặc 'q' trong cửa sổ xem) để thoát.")
    last_alert_time = 0.0
    frame_count = 0
    start_time = time.time()
    frame_buffer: deque = deque(maxlen=90)  # lưu 5-6 giây video gần nhất
    recordings_dir = Path(os.getenv("CAMERA_RECORDINGS_DIR", "./data/recordings"))
    recordings_dir.mkdir(parents=True, exist_ok=True)
    device_id = os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main"))

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                logger.warning("Mất tín hiệu camera, đang thử kết nối lại...")
                time.sleep(1.0)
                continue

            frame_count += 1
            frame_buffer.append(frame.copy())
            res = detector.detect(frame)

            # Phát hiện ngã -> Lưu video clip và gửi cảnh báo
            if res.is_fall_detected:
                now = time.time()
                if now - last_alert_time > 10.0:  # Tránh spam cảnh báo quá dày
                    last_alert_time = now
                    event_id = uuid.uuid4().hex
                    logger.warning(">>> [CẢNH BÁO TÉ NGÃ] Phát hiện sự cố ngã tại camera! <<<")

                    # Ghi nhận đoạn video té ngã (MP4)
                    clip_filename = f"{event_id}.mp4"
                    clip_path = recordings_dir / clip_filename
                    try:
                        h, w = frame.shape[:2]
                        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                        writer = cv2.VideoWriter(str(clip_path), fourcc, 15.0, (w, h))
                        for f in list(frame_buffer):
                            writer.write(f)
                        writer.release()
                        logger.info("Đã lưu video clip té ngã: %s", clip_path)
                    except Exception as clip_err:
                        logger.error("Không thể ghi video clip té ngã: %s", clip_err)

                    if mqtt:
                        alert_payload = {
                            "id": event_id,
                            "device_id": device_id,
                            "alert_type": "FALL_DETECTED",
                            "alert_level": "CRITICAL",
                            "confidence": float(res.confidence),
                            "timestamp": now,
                            "message": "Phát hiện té ngã (YOLOv8-Pose AI) từ camera!",
                            "clip_path": str(clip_path),
                            "video_clip_url": f"/recordings/{clip_filename}",
                            "sources": ["camera"],
                        }
                        mqtt.publish_alert(alert_payload)
                        logger.info("Đã gửi thông báo té ngã kèm video qua MQTT: %s", clip_filename)

            # Hiển thị trực quan nếu có cờ --view
            if args.view:
                vis_frame = draw_pose(
                    frame=frame,
                    keypoints=res.keypoints,
                    bboxes=res.bounding_boxes,
                    is_fall=res.is_fall_detected,
                    tracks=res.tracks,
                )

                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0.0
                info_text = f"FPS: {fps:.1f} | Nguoi: {res.person_count} | Nga: {'CO' if res.is_fall_detected else 'Khong'}"
                cv2.putText(vis_frame, info_text, (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

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

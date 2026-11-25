#!/usr/bin/env python3
"""
simulate_fall.py – Giả lập cảnh báo sự cố té ngã (FALL_DETECTED) qua MQTT Broker.
Kích hoạt:
1. Ghi nhận sự cố mức CRITICAL vào database.
2. Broadcast real-time qua WebSocket tới ứng dụng Mobile và Doctor Web.
3. Kích hoạt thông báo đẩy FCM tới điện thoại người thân.
"""

import argparse
import json
import time
import uuid
import paho.mqtt.client as mqtt


def trigger_fall(
    host: str = "127.0.0.1",
    port: int = 1883,
    device_id: str = "077c83fd-1331-45bd-97b4-c42a37de0db5",
    patient_name: str = "Cụ Nguyễn Văn An",
    similarity: float = 0.94,
    message: str | None = None,
):
    event_id = str(uuid.uuid4())
    msg = message or f"🚨 CẢNH BÁO TÉ NGÃ: Phát hiện {patient_name} té ngã (Khớp khuôn mặt hồ sơ: {int(similarity * 100)}%)!"
    notes_dict = {
        "patient_name": patient_name,
        "face_similarity": similarity,
        "is_patient_matched": True,
    }
    payload = {
        "id": event_id,
        "device_id": device_id,
        "alert_type": "FALL_DETECTED",
        "alert_level": "CRITICAL",
        "confidence": 0.98,
        "timestamp": time.time(),
        "message": msg,
        "patient_name": patient_name,
        "sources": ["camera", "face_reid"],
        "notes": json.dumps(notes_dict, ensure_ascii=False),
    }
    topic = f"care/{device_id}/alert"

    client = mqtt.Client(client_id=f"fall-sim-{uuid.uuid4().hex[:6]}")
    client.username_pw_set("backend", "mqtt_secure_pass_123")
    print(f"Connecting to MQTT broker at {host}:{port}...")
    client.connect(host, port, 60)
    client.publish(topic, json.dumps(payload), qos=1)
    client.disconnect()
    print("✅ Đã phát thông báo té ngã thành công!")
    print(f"   - Event ID : {event_id}")
    print(f"   - Device ID: {device_id}")
    print(f"   - Topic    : {topic}")
    print(f"   - Message  : {msg}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Giả lập cảnh báo té ngã")
    parser.add_argument("--host", default="127.0.0.1", help="Địa chỉ MQTT broker (127.0.0.1 hoặc IP EC2)")
    parser.add_argument("--port", type=int, default=1883, help="Cổng MQTT broker (1883)")
    parser.add_argument("--device", default="077c83fd-1331-45bd-97b4-c42a37de0db5", help="UUID camera/thiết bị")
    parser.add_argument("--name", default="Cụ Nguyễn Văn An", help="Tên bệnh nhân nhận diện được")
    parser.add_argument("--sim", type=float, default=0.94, help="Độ tương đồng khuôn mặt (0.0 - 1.0)")
    parser.add_argument("--msg", default=None, help="Nội dung thông báo tùy chọn")
    args = parser.parse_args()
    trigger_fall(args.host, args.port, args.device, args.name, args.sim, args.msg)

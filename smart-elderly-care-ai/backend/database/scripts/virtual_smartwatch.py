"""
virtual_smartwatch.py - Trình giả lập Đồng hồ thông minh ảo (Virtual Smartwatch Simulator)
Phát sinh chỉ số sinh hiệu biến thiên liên tục theo nhịp sinh học tự nhiên mà KHÔNG cần sửa đổi code dự án.

Cách chạy:
    python backend/database/scripts/virtual_smartwatch.py
    python backend/database/scripts/virtual_smartwatch.py --mode drain   (Test pin giảm dần: 20% -> 15% pin yếu -> 0% hết pin)
    python backend/database/scripts/virtual_smartwatch.py --battery 12  (Test mức pin cụ thể: 12% hoặc 0%)
    python backend/database/scripts/virtual_smartwatch.py --mode tachy   (Test cảnh báo tim đập nhanh)
    python backend/database/scripts/virtual_smartwatch.py --mode hypoxia (Test cảnh báo tụt oxy SpO2)
    python backend/database/scripts/virtual_smartwatch.py --mode fall    (Test sự cố té ngã)
"""

import argparse
import math
import random
import sys
import time
from urllib import error, request
import json

def generate_vitals(step: int, mode: str = "normal", current_battery: int = 85):
    """Tạo chỉ số sinh hiệu với biến thiên mềm mại (hình sin + nhiễu ngẫu nhiên) và mức pin."""
    wave = math.sin(step * 0.2)
    
    if mode == "tachy":
        # Nhịp tim nhanh (112 - 128 bpm)
        hr = int(120 + wave * 6 + random.randint(-3, 3))
        spo2 = int(96 + random.choice([0, 1]))
        temp = round(37.1 + wave * 0.2 + random.uniform(-0.1, 0.1), 1)
        fall = False
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))
    elif mode == "hypoxia":
        # Thiếu oxy SpO2 tụt (86 - 91%)
        hr = int(98 + wave * 4 + random.randint(-2, 2))
        spo2 = int(88 + wave * 2 + random.randint(-1, 1))
        temp = round(36.3 + random.uniform(-0.1, 0.1), 1)
        fall = False
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))
    elif mode == "fall":
        # Sự cố té ngã
        hr = int(105 + random.randint(-2, 5))
        spo2 = 96
        temp = 36.5
        fall = True
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))
    elif mode in ("drain", "battery_drain", "low_battery"):
        # Chế độ xả pin nhanh: từ 20% giảm dần về 0%
        hr = int(75 + wave * 3 + random.randint(-1, 1))
        spo2 = 98
        temp = 36.5
        fall = False
        # Giảm mỗi bước 2 - 3%
        battery = max(0, current_battery - 3)
    else:
        # Bình thường: Nhịp tim 70 - 79 bpm, SpO2 97 - 99%, pin giảm tự nhiên chậm rãi
        hr = int(74 + wave * 4 + random.randint(-2, 2))
        spo2 = int(98 + random.choice([-1, 0, 1]))
        temp = round(36.5 + (wave * 0.15) + random.uniform(-0.05, 0.05), 1)
        fall = False
        battery = max(0, current_battery - (1 if step % 8 == 0 else 0))

    return hr, spo2, temp, fall, battery

def send_vital(endpoint: str, device_id: str, hr: int, spo2: int, temp: float, fall: bool, battery: int):
    payload = {
        "device_id": device_id,
        "heart_rate": hr,
        "spo2": spo2,
        "skin_temp_max": temp,
        "fall_detected": fall,
        "bracelet_battery": battery,
        "battery_level": battery,
    }
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(endpoint, data=data, headers={"Content-Type": "application/json"})
    try:
        with request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        return False

def main():
    parser = argparse.ArgumentParser(description="Đồng hồ ảo SECA Virtual Smartwatch")
    parser.add_argument("--host", default="http://localhost:8000", help="URL Backend (mặc định: http://localhost:8000)")
    parser.add_argument("--device", default="BLE_BAND_001", help="Mã thiết bị smartband")
    parser.add_argument("--interval", type=float, default=2.5, help="Chu kỳ gửi tính bằng giây (mặc định: 2.5s)")
    parser.add_argument(
        "--mode",
        choices=["normal", "tachy", "hypoxia", "fall", "drain", "battery_drain", "low_battery"],
        default="normal",
        help="Chế độ mô phỏng sinh hiệu hoặc cạn pin",
    )
    parser.add_argument("--battery", type=int, default=None, help="Chỉ định mức pin cố định hoặc bắt đầu (VD: 12 hoặc 0)")
    parser.add_argument("--count", type=int, default=0, help="Số lần gửi (0 = chạy vô hạn cho đến khi Ctrl+C)")

    args = parser.parse_args()
    endpoint = f"{args.host.rstrip('/')}/api/v1/vitals"

    # Mức pin ban đầu
    if args.battery is not None:
        current_bat = args.battery
    elif args.mode in ("drain", "battery_drain", "low_battery"):
        current_bat = 21
    else:
        current_bat = 85

    print("=" * 70)
    print("⌚ SECA VIRTUAL SMARTWATCH - ĐỒNG HỒ ẢO MÔ PHỎNG SINH HIỆU & PIN")
    print(f"📡 Backend Endpoint: {endpoint}")
    print(f"🏷️  Device ID:        {args.device}")
    print(f"⏱️  Chu kỳ cập nhật:  {args.interval} giây")
    print(f"🩺 Chế độ:           {args.mode.upper()}")
    print(f"🔋 Mức pin khởi tạo: {current_bat}%")
    print("=" * 70)
    print("Đang phát dữ liệu thời gian thực tới Mobile App & Web Dashboard...")
    print("Nhấn Ctrl + C để dừng đồng hồ ảo.\n")

    step = 0
    try:
        while True:
            step += 1
            hr, spo2, temp, fall, current_bat = generate_vitals(step, args.mode, current_bat)
            ok = send_vital(endpoint, args.device, hr, spo2, temp, fall, current_bat)

            status_icon = "🟢" if ok else "🔴 LỖI KẾT NỐI"
            fall_str = " | 🚨 TÉ NGÃ!" if fall else ""
            
            if current_bat <= 0:
                bat_str = " | ⛔ HẾT PIN 0% (Ngắt kết nối)"
            elif current_bat <= 20:
                bat_str = f" | 🪫 PIN YẾU: {current_bat}% [Cảnh báo!]"
            else:
                bat_str = f" | 🔋 Pin: {current_bat}%"

            print(
                f"[{time.strftime('%H:%M:%S')}] {status_icon} "
                f"💓 {hr:3d} bpm | "
                f"🫁 {spo2:2d}% | "
                f"🌡️ {temp:.1f}°C"
                f"{bat_str}{fall_str}"
            )

            if args.count > 0 and step >= args.count:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n⏹️ Đã dừng Đồng hồ ảo.")

if __name__ == "__main__":
    main()

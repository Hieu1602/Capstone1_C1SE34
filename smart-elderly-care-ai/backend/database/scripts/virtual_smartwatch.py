"""
virtual_smartwatch.py - Trình giả lập Đồng hồ thông minh ảo (Virtual Smartwatch Simulator)
Hỗ trợ đầy đủ các kịch bản kiểm thử:
  1. Bình thường (Normal)
  2. Vận động thể dục sinh lý (Exercise: nhịp tim tăng dần < 125 bpm -> Chống báo động giả)
  3. Nhịp tim tăng cao lúc nghỉ ngơi (Tachycardia lúc ngồi yên)
  4. Nhịp tim tăng vọt nguy hiểm (> 140 bpm)
  5. Nhịp tim tụt quá thấp (< 50 bpm)
  6. Tụt Oxy máu SpO2 đơn lẻ (< 90%)
  7. Quá tải Oxy khi gắng sức (Tim nhanh + SpO2 tụt)
  8. Sốt cao kèm tim đập nhanh (Nhiệt độ >= 38.2°C + Tim >= 100 bpm)
  9. Tam chứng nguy kịch (Sốt cao + Tim nhanh + Oxy tụt sâu)
  10. Sự cố té ngã (Fall Detected)
  11. Tháo vòng tay / Cắm sạc (is_worn=False -> Chống báo ngưng tim giả)
  12. Xả pin nhanh (20% -> 15% pin yếu -> 0% cạn pin)
"""

import argparse
import json
import math
import random
import sys
import time
from urllib import error, request


def generate_vitals(step: int, mode: str = "normal", current_battery: int = 85):
    """Tạo chỉ số sinh hiệu, mức pin, trạng thái đeo và hoạt động theo kịch bản."""
    wave = math.sin(step * 0.2)
    is_worn = True

    if mode == "exercise":
        # KỊCH BẢN 2: Vận động thể dục sinh lý (Nhịp tim tăng dần 80 -> 105 -> 120 bpm)
        # Điểm mấu chốt: SpO2 vẫn tốt >= 96%, Activity = "Vận động / Đi lại" -> CHỐNG BÁO ĐỘNG GIẢ
        hr = min(122, int(82 + step * 4.5 + wave * 2 + random.randint(-1, 1)))
        spo2 = int(97 + random.choice([-1, 0, 1]))
        temp = round(36.8 + wave * 0.1, 1)
        fall = False
        activity = "Vận động / Đi lại"
        battery = max(0, current_battery - (1 if step % 15 == 0 else 0))

    elif mode == "tachy":
        # KỊCH BẢN 3: Nhịp tim tăng cao lúc NGHỈ NGƠI (122 - 132 bpm)
        hr = int(126 + wave * 4 + random.randint(-2, 2))
        spo2 = int(96 + random.choice([0, 1]))
        temp = round(36.8 + random.uniform(-0.1, 0.1), 1)
        fall = False
        activity = "Ngồi nghỉ"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "tachy_critical":
        # KỊCH BẢN 4: Nhịp tim tăng vọt nguy hiểm (>= 140 bpm)
        hr = int(146 + wave * 4 + random.randint(-2, 2))
        spo2 = 95
        temp = 37.0
        fall = False
        activity = "Nằm nghỉ"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "brady":
        # KỊCH BẢN 5: Nhịp tim tụt quá thấp (< 50 bpm)
        hr = int(44 + wave * 2 + random.randint(-1, 1))
        spo2 = 95
        temp = 36.2
        fall = False
        activity = "Nghỉ ngơi"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "hypoxia":
        # KỊCH BẢN 6: Thiếu oxy SpO2 tụt đơn lẻ (< 90%)
        hr = int(92 + wave * 3 + random.randint(-1, 1))
        spo2 = int(87 + wave * 1.5 + random.choice([-1, 0]))
        temp = 36.5
        fall = False
        activity = "Nghỉ ngơi"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "exertion_hypoxia":
        # KỊCH BẢN 7: Quá tải tim phổi khi gắng sức (Tim nhanh + Oxy tụt)
        hr = int(120 + wave * 3 + random.randint(-1, 2))
        spo2 = int(88 + random.choice([-1, 0, 1]))
        temp = 36.7
        fall = False
        activity = "Vận động"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "fever":
        # KỊCH BẢN 8: Sốt cao kèm tim đập nhanh
        hr = int(108 + wave * 3 + random.randint(-1, 2))
        spo2 = 96
        temp = round(38.5 + wave * 0.15 + random.uniform(-0.05, 0.05), 1)
        fall = False
        activity = "Nằm nghỉ"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "critical_triad":
        # KỊCH BẢN 9: Tam chứng nguy kịch (Sốt cao + Tim nhanh + Oxy tụt)
        hr = int(126 + wave * 3 + random.randint(-2, 2))
        spo2 = int(86 + random.choice([-1, 0]))
        temp = round(38.9 + wave * 0.1, 1)
        fall = False
        activity = "Nằm nghỉ"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "fall":
        # KỊCH BẢN 10: Sự cố té ngã
        hr = int(105 + random.randint(-2, 5))
        spo2 = 96
        temp = 36.5
        fall = True
        activity = "Té ngã"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "off_wrist":
        # KỊCH BẢN 11: Tháo vòng tay / Cắm sạc (is_worn=False -> Không báo ngưng tim giả)
        hr = 0
        spo2 = 0
        temp = 28.0
        fall = False
        activity = "Tháo vòng tay / Sạc pin"
        is_worn = False
        battery = 100

    elif mode in ("drain", "battery_drain", "low_battery"):
        # KỊCH BẢN 12: Chế độ xả pin nhanh: từ 21% giảm dần về 0%
        hr = int(75 + wave * 3 + random.randint(-1, 1))
        spo2 = 98
        temp = 36.5
        fall = False
        activity = "Sinh hoạt"
        battery = max(0, current_battery - 3)

    else:
        # KỊCH BẢN 1: Bình thường: Nhịp tim 70 - 78 bpm, SpO2 97 - 99%, Thân nhiệt 36.5 - 36.7°C
        hr = int(74 + wave * 3 + random.randint(-1, 1))
        spo2 = int(98 + random.choice([-1, 0, 1]))
        temp = round(36.5 + (wave * 0.1) + random.uniform(-0.05, 0.05), 1)
        fall = False
        activity = "Sinh hoạt"
        battery = max(0, current_battery - (1 if step % 15 == 0 else 0))

    return hr, spo2, temp, fall, battery, activity, is_worn


def send_vital(
    endpoint: str,
    device_id: str,
    hr: int,
    spo2: int,
    temp: float,
    fall: bool,
    battery: int,
    activity: str,
    is_worn: bool,
):
    payload = {
        "device_id": device_id,
        "heart_rate": hr,
        "spo2": spo2,
        "skin_temp_max": temp,
        "fall_detected": fall,
        "bracelet_battery": battery,
        "battery_level": battery,
        "activity_state": activity,
        "is_worn": is_worn,
    }
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(endpoint, data=data, headers={"Content-Type": "application/json"})
    try:
        with request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="Đồng hồ ảo SECA Virtual Smartwatch")
    parser.add_argument("--host", default="http://localhost:8000", help="URL Backend (mặc định: http://localhost:8000)")
    parser.add_argument("--device", default="BLE_BAND_001", help="Mã thiết bị smartband")
    parser.add_argument("--interval", type=float, default=2.5, help="Chu kỳ gửi tính bằng giây (mặc định: 2.5s)")
    parser.add_argument(
        "--mode",
        choices=[
            "normal",
            "exercise",
            "tachy",
            "tachy_critical",
            "brady",
            "hypoxia",
            "exertion_hypoxia",
            "fever",
            "critical_triad",
            "fall",
            "off_wrist",
            "drain",
            "battery_drain",
            "low_battery",
        ],
        default="normal",
        help="Chế độ mô phỏng kiểm thử",
    )
    parser.add_argument("--battery", type=int, default=None, help="Chỉ định mức pin cố định (VD: 15 hoặc 0)")
    parser.add_argument("--count", type=int, default=0, help="Số lần gửi (0 = chạy vô hạn cho đến khi Ctrl+C)")

    args = parser.parse_args()
    endpoint = f"{args.host.rstrip('/')}/api/v1/vitals"

    if args.battery is not None:
        current_bat = args.battery
    elif args.mode in ("drain", "battery_drain", "low_battery"):
        current_bat = 21
    else:
        current_bat = 85

    mode_descs = {
        "normal": "🟢 Bình thường (Ổn định, không cảnh báo)",
        "exercise": "🏃 VẬN ĐỘNG THỂ DỤC SINH LÝ (Tim tăng dần 80->120 bpm, SpO2 97% -> CHỐNG BÁO ĐỘNG GIẢ)",
        "tachy": "⚠️ Nhịp tim tăng cao lúc NGHỈ NGƠI (~126 bpm -> Cảnh báo HIGH)",
        "tachy_critical": "🚨 Nhịp tim tăng vọt nguy hiểm (>= 145 bpm -> Báo động CRITICAL)",
        "brady": "⚠️ Nhịp tim tụt quá thấp (< 50 bpm -> Cảnh báo chậm nhịp)",
        "hypoxia": "🚨 Tụt Oxy máu SpO2 đơn lẻ (< 90% -> Cảnh báo CRITICAL)",
        "exertion_hypoxia": "🚨 Quá tải tim phổi khi gắng sức (Tim > 118 bpm + SpO2 < 90%)",
        "fever": "🌡️ Sốt cao kèm tim đập nhanh (Thân nhiệt 38.6°C + Tim 108 bpm)",
        "critical_triad": "🔥 TAM CHỨNG NGUY KỊCH (Sốt 38.9°C + Tim 126 bpm + SpO2 86%)",
        "fall": "🚨 Sự cố té ngã khẩn cấp (Fall Detected = True)",
        "off_wrist": "🔌 Tháo vòng tay / Cắm sạc (is_worn=False, HR=0 -> CHỐNG BÁO NGƯNG TIM GIẢ)",
        "drain": "🪫 Xả pin nhanh (21% -> 15% pin yếu -> 0% cạn pin)",
    }

    desc = mode_descs.get(args.mode, args.mode.upper())

    print("=" * 75)
    print("⌚ SECA VIRTUAL SMARTWATCH - ĐỒNG HỒ ẢO MÔ PHỎNG & KIỂM THỬ THÔNG MINH")
    print(f"📡 Backend Endpoint: {endpoint}")
    print(f"🏷️  Device ID:        {args.device}")
    print(f"⏱️  Chu kỳ cập nhật:  {args.interval} giây")
    print(f"🩺 Kịch bản:         {desc}")
    print(f"🔋 Mức pin khởi tạo: {current_bat}%")
    print("=" * 75)
    print("Đang phát dữ liệu thời gian thực tới Mobile App & Web Dashboard...")
    print("Nhấn Ctrl + C để dừng đồng hồ ảo.\n")

    step = 0
    try:
        while True:
            step += 1
            hr, spo2, temp, fall, current_bat, activity, is_worn = generate_vitals(
                step, args.mode, current_bat
            )
            ok = send_vital(
                endpoint,
                args.device,
                hr,
                spo2,
                temp,
                fall,
                current_bat,
                activity,
                is_worn,
            )

            status_icon = "🟢" if ok else "🔴 LỖI"
            fall_str = " | 🚨 TÉ NGÃ!" if fall else ""
            worn_str = " [Đeo tay]" if is_worn else " [THÁO VÒNG TAY / ĐANG SẠC]"

            if current_bat <= 0:
                bat_str = " | ⛔ HẾT PIN 0%"
            elif current_bat <= 20:
                bat_str = f" | 🪫 PIN YẾU: {current_bat}%"
            else:
                bat_str = f" | 🔋 Pin: {current_bat}%"

            print(
                f"[{time.strftime('%H:%M:%S')}] {status_icon} "
                f"💓 {hr:3d} bpm | "
                f"🫁 {spo2:2d}% | "
                f"🌡️ {temp:.1f}°C | "
                f"🏃 {activity}"
                f"{bat_str}{worn_str}{fall_str}"
            )

            if args.count > 0 and step >= args.count:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n⏹️ Đã dừng Đồng hồ ảo.")


if __name__ == "__main__":
    main()

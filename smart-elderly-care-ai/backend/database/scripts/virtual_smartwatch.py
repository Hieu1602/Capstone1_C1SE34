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

try:
    import msvcrt
except ImportError:
    msvcrt = None


def generate_vitals(step: int, mode: str = "normal", current_battery: int = 85):
    """Tạo chỉ số sinh hiệu đầy đủ (Tim, SpO2, Thân nhiệt, Huyết áp) đồng bộ sinh lý theo từng kịch bản."""
    wave = math.sin(step * 0.2)
    is_worn = True
    fall = False

    if mode == "exercise":
        # KỊCH BẢN 2: VẬN ĐỘNG THỂ DỤC SINH LÝ
        # - Nhịp tim tăng dần: 82 -> 95 -> 108 -> 120 bpm
        # - Thân nhiệt tăng do cơ bắp sinh nhiệt: 36.6°C -> 37.1°C -> 37.4°C
        # - Huyết áp tâm thu tăng do cung lượng tim: 120 -> 130 -> 142 mmHg
        # - SpO2 dao động nhẹ (96 - 98%), hô hấp đáp ứng tốt -> CHỐNG BÁO ĐỘNG GIẢ
        hr = min(122, int(82 + min(step * 3.5, 36.0) + wave * 2 + random.randint(-1, 1)))
        spo2 = max(95, min(99, int(98 - min(step * 0.25, 2.0) + wave * 0.5)))
        temp = round(min(37.4, 36.6 + min(step * 0.08, 0.7) + wave * 0.08), 1)
        bp_sys = min(144, int(120 + min(step * 2.2, 22.0) + wave * 2))
        bp_dia = int(80 + wave * 2)
        activity = "Vận động thể dục (Đi bộ / Dưỡng sinh)"
        battery = max(0, current_battery - (1 if step % 15 == 0 else 0))

    elif mode == "tachy":
        # KỊCH BẢN 4: Nhịp tim tăng cao lúc NGHỈ NGƠI (~126 bpm)
        hr = int(126 + wave * 4 + random.randint(-2, 2))
        spo2 = int(96 + random.choice([0, 1]))
        temp = round(36.9 + random.uniform(-0.1, 0.1), 1)
        bp_sys = int(134 + wave * 3)
        bp_dia = int(86 + wave * 2)
        activity = "Ngồi nghỉ (Nhịp nhanh lúc nghỉ)"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "tachy_critical":
        # KỊCH BẢN 5: Nhịp tim tăng vọt nguy hiểm (>= 145 bpm)
        # Huyết áp tăng vọt 160 mmHg, thân nhiệt sốt ruột 37.3°C, SpO2 giảm nhẹ do tim bóp quá nhanh
        hr = int(146 + wave * 4 + random.randint(-2, 2))
        spo2 = int(94 + random.choice([-1, 0, 1]))
        temp = round(37.3 + wave * 0.1, 1)
        bp_sys = int(162 + wave * 4)
        bp_dia = int(98 + wave * 2)
        activity = "Nằm nghỉ (Cơn nhịp nhanh kịch phát)"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "brady":
        # KỊCH BẢN 6: Nhịp tim tụt quá thấp (< 50 bpm)
        # Huyết áp tụt sâu (82/50 mmHg), thân nhiệt hạ 36.0°C (lạnh ngoại vi), SpO2 93%
        hr = int(44 + wave * 2 + random.randint(-1, 1))
        spo2 = int(93 + random.choice([0, 1]))
        temp = round(36.0 + wave * 0.1, 1)
        bp_sys = int(84 + wave * 3)
        bp_dia = int(52 + wave * 2)
        activity = "Nghỉ ngơi (Nhịp tim chậm nguy hiểm)"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "hypoxia":
        # KỊCH BẢN 7: Tụt Oxy SpO2 (< 90%)
        # Tim đập nhanh bù trừ (102 bpm), huyết áp tăng nhẹ 132 mmHg
        hr = int(102 + wave * 3 + random.randint(-1, 2))
        spo2 = int(87 + wave * 1.5 + random.choice([-1, 0]))
        temp = round(36.5 + wave * 0.1, 1)
        bp_sys = int(132 + wave * 2)
        bp_dia = int(84 + wave * 2)
        activity = "Nghỉ ngơi (Suy hô hấp / Tụt SpO2)"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "exertion_hypoxia":
        # KỊCH BẢN 8: Quá tải tim phổi khi gắng sức (Tim > 118 bpm + SpO2 < 90%)
        hr = int(124 + wave * 3 + random.randint(-1, 2))
        spo2 = int(87 + random.choice([-1, 0, 1]))
        temp = round(37.3 + wave * 0.1, 1)
        bp_sys = int(150 + wave * 3)
        bp_dia = int(92 + wave * 2)
        activity = "Vận động quá sức (Quá tải tim phổi)"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "fever":
        # KỊCH BẢN 9: Sốt cao kèm tim đập nhanh
        # Thân nhiệt 38.6 - 38.9°C, tim đập nhanh 110 bpm theo sinh lý sốt
        hr = int(110 + wave * 3 + random.randint(-1, 2))
        spo2 = int(95 + random.choice([0, 1]))
        temp = round(38.6 + min(step * 0.04, 0.4) + wave * 0.08, 1)
        bp_sys = int(130 + wave * 2)
        bp_dia = int(82 + wave * 2)
        activity = "Nằm sốt cao"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "critical_triad":
        # KỊCH BẢN 10: TAM CHỨNG NGUY KỊCH (Sốt 39°C + Tim 128 bpm + SpO2 85%)
        hr = int(128 + wave * 3 + random.randint(-2, 2))
        spo2 = int(85 + random.choice([-1, 0]))
        temp = round(39.0 + wave * 0.1, 1)
        bp_sys = int(144 + wave * 3)
        bp_dia = int(88 + wave * 2)
        activity = "Hôn mê / Nguy kịch (Tam chứng)"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "fall":
        # KỊCH BẢN 11: Sự cố té ngã khẩn cấp
        # Sau cú ngã: Tim đập nhanh 115 bpm (hoảng loạn/đau), huyết áp 145 mmHg, Fall = True
        hr = int(115 + random.randint(-2, 4))
        spo2 = 95
        temp = 36.5
        bp_sys = 145
        bp_dia = 90
        fall = True
        activity = "🚨 TÉ NGÃ TRÊN SÀN (FALL DETECTED)"
        battery = max(0, current_battery - (1 if step % 10 == 0 else 0))

    elif mode == "off_wrist":
        # KỊCH BẢN 3: Tháo vòng tay / Cắm sạc (is_worn=False -> Không báo ngưng tim giả)
        hr = 0
        spo2 = 0
        temp = 26.0
        bp_sys = 0
        bp_dia = 0
        activity = "Tháo vòng tay / Cắm sạc"
        is_worn = False
        battery = 100

    elif mode in ("drain", "battery_drain", "low_battery"):
        # KỊCH BẢN 12: Xả pin nhanh: từ 21% giảm dần về 0%
        hr = int(74 + wave * 2)
        spo2 = 98
        temp = 36.5
        bp_sys = 120
        bp_dia = 80
        activity = "Sinh hoạt bình thường"
        battery = max(0, current_battery - 3)

    else:
        # KỊCH BẢN 1: Bình thường: Tim 72-76 bpm, SpO2 98-99%, HA 120/80 mmHg, Thân nhiệt 36.5-36.7°C
        hr = int(74 + wave * 2 + random.randint(-1, 1))
        spo2 = int(98 + random.choice([0, 1]))
        temp = round(36.6 + (wave * 0.08) + random.uniform(-0.03, 0.03), 1)
        bp_sys = int(120 + wave * 2)
        bp_dia = int(80 + wave * 1)
        activity = "Sinh hoạt / Nghỉ ngơi"
        battery = max(0, current_battery - (1 if step % 15 == 0 else 0))

    return hr, spo2, temp, bp_sys, bp_dia, fall, battery, activity, is_worn


def send_vital(
    endpoint: str,
    device_id: str,
    hr: int,
    spo2: int,
    temp: float,
    bp_sys: int,
    bp_dia: int,
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
        "bp_systolic": bp_sys,
        "bp_diastolic": bp_dia,
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

    KEY_MODE_MAP = {
        "1": "normal",
        "2": "exercise",
        "3": "off_wrist",
        "4": "tachy",
        "5": "tachy_critical",
        "6": "brady",
        "7": "hypoxia",
        "8": "exertion_hypoxia",
        "9": "fever",
        "0": "critical_triad",
        "f": "fall",
        "F": "fall",
        "d": "drain",
        "D": "drain",
    }

    def print_menu():
        print("-" * 75)
        print("⌨️  BẤM PHÍM BẤT KỲ ĐỂ ĐỔI CHẾ ĐỘ TỨC THÌ (KHÔNG CẦN DỪNG LỆNH):")
        print("   [1] Bình thường       [2] Thể dục (chống ảo)   [3] Tháo vòng (chống ảo)")
        print("   [4] Tim cao (vàng)    [5] Tim vọt (đỏ)         [6] Tim chậm")
        print("   [7] Tụt SpO2 (đỏ)     [8] Quá tải gắng sức     [9] Sốt cao")
        print("   [0] Tam chứng         [F] Té ngã               [D] Xả pin")
        print("   [M] Xem lại menu      [Q] Thoát")
        print("-" * 75)

    current_mode = args.mode
    desc = mode_descs.get(current_mode, current_mode.upper())

    print("=" * 75)
    print("⌚ SECA VIRTUAL SMARTWATCH - ĐỒNG HỒ ẢO MÔ PHỎNG & KIỂM THỬ THÔNG MINH")
    print(f"📡 Backend Endpoint: {endpoint}")
    print(f"🏷️  Device ID:        {args.device}")
    print(f"⏱️  Chu kỳ cập nhật:  {args.interval} giây")
    print(f"🩺 Kịch bản ban đầu: {desc}")
    print(f"🔋 Mức pin khởi tạo: {current_bat}%")
    print("=" * 75)
    print_menu()
    print("Đang phát dữ liệu thời gian thực tới Mobile App & Web Dashboard...\n")

    step = 0
    try:
        while True:
            step += 1
            hr, spo2, temp, bp_sys, bp_dia, fall, current_bat, activity, is_worn = generate_vitals(
                step, current_mode, current_bat
            )
            ok = send_vital(
                endpoint,
                args.device,
                hr,
                spo2,
                temp,
                bp_sys,
                bp_dia,
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

            bp_str = f"🩸 {bp_sys:3d}/{bp_dia:2d} mmHg | " if is_worn else "🩸 --/-- mmHg | "

            print(
                f"[{time.strftime('%H:%M:%S')}] {status_icon} "
                f"💓 {hr:3d} bpm | "
                f"🫁 {spo2:2d}% | "
                f"{bp_str}"
                f"🌡️ {temp:.1f}°C | "
                f"🏃 {activity}"
                f"{bat_str}{worn_str}{fall_str}"
            )

            if args.count > 0 and step >= args.count:
                break

            # Chờ chu kỳ tiếp theo kèm lắng nghe phím bấm đổi chế độ tức thì
            end_time = time.time() + args.interval
            while time.time() < end_time:
                if msvcrt and msvcrt.kbhit():
                    ch = msvcrt.getch().decode("utf-8", errors="ignore")
                    if ch in ("q", "Q", "\x03", "\x1b"):
                        raise KeyboardInterrupt
                    if ch in KEY_MODE_MAP:
                        new_mode = KEY_MODE_MAP[ch]
                        if new_mode != current_mode:
                            current_mode = new_mode
                            step = 0
                            if current_mode == "drain":
                                current_bat = 21
                            elif current_bat <= 0:
                                current_bat = 85
                            new_desc = mode_descs.get(current_mode, current_mode.upper())
                            print(f"\n🔄 [ĐỔI CHẾ ĐỘ THÀNH CÔNG] ➔ {new_desc}\n")
                            break
                    elif ch in ("m", "M", "?", "h", "H"):
                        print_menu()
                time.sleep(0.05)
    except KeyboardInterrupt:
        print("\n⏹️ Đã dừng Đồng hồ ảo.")


if __name__ == "__main__":
    main()

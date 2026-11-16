"""
stream_hw706.py
Script chạy độc lập trên Edge / Laptop để kết nối và stream nhịp tim liên tục từ CooSpo HW706.
Hỗ trợ:
- Tự động đọc MAC và cấu hình từ config/config.yaml
- Tự động kết nối lại (Auto-reconnect) khi mất sóng
- Đọc % Pin, Nhịp tim thời gian thực (~1Hz), HRV (RR-intervals), Trạng thái tiếp xúc da
- Bấm Ctrl+C để dừng an toàn.
"""

import asyncio
import datetime
import os
import struct
import sys
from pathlib import Path

# Đảm bảo import được các module từ src nếu cần
SCRIPT_DIR = Path(__file__).resolve().parent
EDGE_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(EDGE_DIR))

try:
    import yaml
    CONFIG_PATH = EDGE_DIR / "config" / "config.yaml"
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    ble_cfg = config.get("ble", {})
    DEVICE_MAC = ble_cfg.get("device_mac", "C8:DE:BD:8F:78:3C")
    DEVICE_NAME = ble_cfg.get("device_name", "HW706-0011099")
    HR_UUID = ble_cfg.get("characteristic_uuid", "00002a37-0000-1000-8000-00805f9b34fb")
except Exception:
    DEVICE_MAC = "C8:DE:BD:8F:78:3C"
    DEVICE_NAME = "HW706-0011099"
    HR_UUID = "00002a37-0000-1000-8000-00805f9b34fb"

BATTERY_UUID = "00002a19-0000-1000-8000-00805f9b34fb"
BACKEND_VITALS_URL = "http://localhost:8000/api/v1/vitals"

readings_count = 0
current_battery = None
disconnected_event = asyncio.Event()


def _send_to_backend(hr: int, battery: int | None):
    """Gửi dữ liệu nhịp tim thời gian thực lên FastAPI Backend."""
    import json
    import urllib.request
    try:
        payload = json.dumps({
            "heart_rate": hr,
            "device_id": "HW706-0011099",
            "battery_level": battery,
        }).encode("utf-8")
        req = urllib.request.Request(
            BACKEND_VITALS_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            pass
    except Exception:
        pass


def on_disconnected(client):
    print("\n⚠️ [BLE] Mất kết nối tới HW706! Đang chờ kết nối lại...", flush=True)
    disconnected_event.set()


def handle_hr_data(sender, data: bytearray):
    global readings_count
    readings_count += 1
    now_str = datetime.datetime.now().strftime("%H:%M:%S")

    flags = data[0]
    hr_format = flags & 0x01

    if hr_format == 0:
        heart_rate = data[1]
        offset = 2
    else:
        heart_rate = struct.unpack("<H", data[1:3])[0]
        offset = 3

    sensor_contact = (flags >> 1) & 0x03
    contact_desc = "Đang đeo" if sensor_contact == 3 else ("Tháo vòng" if sensor_contact == 2 else "Đang đo")

    # Đẩy ngầm vào Backend FastAPI không chặn luồng BLE
    import threading
    threading.Thread(target=_send_to_backend, args=(heart_rate, current_battery), daemon=True).start()

    # Phân loại trạng thái nhịp tim y tế
    if heart_rate < 50:
        status_tag = "⚠️ [NGUY HIỂM: QUÁ CHẬM <50]"
    elif heart_rate < 60:
        status_tag = "🟡 [Nhịp chậm 50-60]"
    elif heart_rate <= 100:
        status_tag = "🟢 [Bình thường 60-100]"
    elif heart_rate <= 120:
        status_tag = "🟠 [Nhịp nhanh 100-120]"
    else:
        status_tag = "🚨 [NGUY HIỂM: QUÁ NHANH >120]"

    # HRV RR-Intervals
    rr_present = (flags & 0x10) >> 4
    rr_str = ""
    if rr_present and len(data) >= offset + 2:
        rr_vals = []
        while offset + 1 < len(data):
            rr = struct.unpack("<H", data[offset:offset+2])[0]
            rr_vals.append(round(rr / 1024.0 * 1000, 1))
            offset += 2
        rr_str = f" | HRV: {rr_vals}ms"

    bat_str = f" | Pin: {current_battery}%" if current_battery is not None else ""

    print(
        f"[{now_str}] #{readings_count:04d} ❤️ {heart_rate:3d} BPM "
        f"| {status_tag} | {contact_desc}{bat_str}{rr_str} ➔ [Live Sync Web/App]",
        flush=True
    )


async def main():
    global current_battery
    try:
        from bleak import BleakClient
    except ImportError:
        print("❌ Chưa cài đặt thư viện 'bleak'. Chạy lệnh: uv run --with bleak python stream_hw706.py")
        sys.exit(1)

    print("=" * 75, flush=True)
    print("   🏥 SMART ELDERLY CARE AI (SECA) - CONTINUOUS BLE STREAM HUB   ", flush=True)
    print(f"   Thiết bị: {DEVICE_NAME} [{DEVICE_MAC}]", flush=True)
    print("   Nhấn Ctrl+C để dừng chương trình.", flush=True)
    print("=" * 75, flush=True)

    while True:
        disconnected_event.clear()
        print(f"\n🔍 [1/3] Đang tìm kiếm và kết nối tới {DEVICE_NAME} ({DEVICE_MAC})...", flush=True)

        client = None
        try:
            client = BleakClient(DEVICE_MAC, disconnected_callback=on_disconnected, timeout=10.0)
            await client.connect()

            if not client.is_connected:
                print("❌ Kết nối thất bại. Thử lại sau 3 giây...", flush=True)
                await asyncio.sleep(3.0)
                continue

            print(f"✅ [2/3] Kết nối THÀNH CÔNG với CooSpo HW706!", flush=True)

            # Đọc pin
            try:
                bat_raw = await client.read_gatt_char(BATTERY_UUID)
                current_battery = bat_raw[0]
                print(f"🔋 [3/3] Dung lượng Pin: {current_battery}%", flush=True)
            except Exception as e:
                print(f"ℹ️ Không đọc được pin: {e}", flush=True)

            print(f"\n📡 ĐANG STREAM DỮ LIỆU NHỊP TIM LIÊN TỤC (Tần số ~1Hz):", flush=True)
            print("-" * 75, flush=True)
            await client.start_notify(HR_UUID, handle_hr_data)

            # Vòng lặp stream liên tục
            bat_counter = 0
            while not disconnected_event.is_set():
                await asyncio.sleep(1.0)
                bat_counter += 1
                if bat_counter >= 60:
                    bat_counter = 0
                    try:
                        bat_raw = await client.read_gatt_char(BATTERY_UUID)
                        current_battery = bat_raw[0]
                    except Exception:
                        pass

        except asyncio.CancelledError:
            print("\n🛑 Đang dừng stream...")
            if client and client.is_connected:
                try:
                    await client.stop_notify(HR_UUID)
                    await client.disconnect()
                except Exception:
                    pass
            break
        except Exception as e:
            print(f"⚠️ Lỗi kết nối: {e}")
            print("⏳ Tự động kết nối lại sau 4 giây...")
            await asyncio.sleep(4.0)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n🏁 Đã dừng stream an toàn. Tổng số bản tin nhận được: {readings_count}")

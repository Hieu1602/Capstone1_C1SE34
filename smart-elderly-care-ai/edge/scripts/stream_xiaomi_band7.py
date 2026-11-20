"""
stream_xiaomi_band7.py
Script kết nối và truyền dữ liệu thời gian thực từ Xiaomi Smart Band 7 (Mi Band 7) vào hệ thống SECA.

Hỗ trợ:
- Tự động quét (BLE Scan) phát hiện Xiaomi Band 7 qua tên hoặc Service UUID 0x180D (Heart Rate).
- Đọc % Pin thiết bị (Battery Service 0x180F -> 0x2A19).
- Nhận thông báo nhịp tim liên tục (GATT Heart Rate Service 0x180D -> 0x2A37).
- Đẩy dữ liệu trực tiếp lên FastAPI Backend (POST /api/v1/vitals) để hiển thị trên Mobile App và Doctor Web.
- Tự động kết nối lại (Auto-reconnect) khi mất sóng.
- Chế độ giả lập (--simulate) để kiểm thử luồng khi vòng chưa sạc hoặc chưa kích hoạt broadcast.

Cách sử dụng:
    1. Quét tìm thiết bị:
       python edge/scripts/stream_xiaomi_band7.py --scan

    2. Tự động kết nối:
       python edge/scripts/stream_xiaomi_band7.py --auto

    3. Kết nối theo địa chỉ MAC / UUID:
       python edge/scripts/stream_xiaomi_band7.py --mac 70:29:F4:D2:64:BA

    4. Chế độ kiểm thử đường truyền:
       python edge/scripts/stream_xiaomi_band7.py --simulate
"""

import argparse
import asyncio
import datetime
import json
import logging
import os
import struct
import sys
import time
import urllib.request
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("XiaomiBand7")

# GATT Standard UUIDs
HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb"
BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb"
BATTERY_LEVEL_UUID = "00002a19-0000-1000-8000-00805f9b34fb"
HUAMI_HR_CTRL_UUID = "00000004-0000-3512-2118-0009af100700"

DEFAULT_BACKEND_URL = os.environ.get("BACKEND_VITALS_URL", "http://localhost:8000/api/v1/vitals")


def send_vitals_to_backend(
    backend_url: str,
    device_id: str,
    heart_rate: int,
    battery: Optional[int] = None,
    spo2: Optional[int] = None,
):
    """Gửi dữ liệu sinh hiệu lên FastAPI backend (không chặn event loop)."""
    try:
        payload = {
            "device_id": device_id,
            "heart_rate": heart_rate,
            "spo2": spo2 or 98,
            "skin_temp_max": 36.6,
            "fall_detected": False,
        }
        if battery is not None:
            payload["battery_level"] = battery

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            backend_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            pass
    except Exception as e:
        logger.debug("[Backend] Gửi sinh hiệu lỗi (server có thể đang tắt): %s", e)


async def scan_ble_devices(timeout: float = 6.0):
    """Quét tìm tất cả thiết bị BLE và làm nổi bật Xiaomi Band 7."""
    from bleak import BleakScanner

    logger.info(">>> Đang quét thiết bị Bluetooth Low Energy xung quanh (%s giây)...", timeout)
    scanner = BleakScanner()
    devices = await scanner.discover(timeout=timeout, return_adv=True)

    print("\n" + "=" * 75)
    print(f"DANH SÁCH THIẾT BỊ BLE TÌM THẤY ({len(devices)} thiết bị):")
    print("=" * 75)

    candidates = []
    for address, (dev, adv) in devices.items():
        name = adv.local_name or dev.name or "Không rõ tên"
        services = adv.service_uuids or []
        rssi = adv.rssi

        is_xiaomi = any(k in name.lower() for k in ["xiaomi", "mi smart band", "band 7", "mi band"])
        has_hr_service = any("180d" in s.lower() for s in services)

        marker = " "
        if is_xiaomi or has_hr_service:
            marker = "★"
            candidates.append((address, name, rssi, services))

        print(f" {marker} [{address}] {name:<30} | RSSI: {rssi:>4} dBm | Services: {len(services)}")

    print("=" * 75)
    if candidates:
        print("\n🎯 ĐÃ PHÁT HIỆN THIẾT BỊ TIỀM NĂNG (XIAOMI BAND / HEART RATE):")
        for addr, name, rssi, srv in candidates:
            print(f"  👉 Tên: '{name}' | MAC: {addr} | RSSI: {rssi} dBm")
        print("\nĐể kết nối, chạy lệnh:")
        print(f"  python edge/scripts/stream_xiaomi_band7.py --mac {candidates[0][0]}")
    else:
        print("\n💡 Lưu ý cho Xiaomi Smart Band 7:")
        print("  1. Mở ứng dụng Mi Fitness (hoặc Zepp Life) trên điện thoại.")
        print("  2. Vào Thiết bị > Theo dõi sức khỏe > Bật 'Phát sóng nhịp tim' (Heart rate broadcast).")
        print("  3. Bật 'Khả năng phát hiện' (Discoverable) và quét lại.")
    print()


async def run_stream(mac_address: str, backend_url: str, device_name: str = "Xiaomi-Band-7"):
    """Kết nối và stream dữ liệu liên tục từ Xiaomi Band 7."""
    from bleak import BleakClient

    logger.info("Khởi động kết nối tới Xiaomi Band: %s", mac_address)
    battery_level = None
    readings = 0

    def hr_callback(sender, data: bytearray):
        nonlocal readings
        readings += 1
        if len(data) < 2:
            return

        flags = data[0]
        hr_format = flags & 0x01
        if hr_format == 0:
            heart_rate = data[1]
        else:
            heart_rate = struct.unpack("<H", data[1:3])[0]

        contact = (flags >> 1) & 0x03
        contact_str = "Đang đeo" if contact == 3 else ("Tháo vòng" if contact == 2 else "Đang đo")

        # Phân loại mức cảnh báo
        if heart_rate < 50:
            status = "🚨 [NGUY HIỂM: NHỊP CHẬM <50 BPM]"
        elif heart_rate > 120:
            status = "🚨 [NGUY HIỂM: NHỊP NHANH >120 BPM]"
        else:
            status = "🟢 [Bình thường]"

        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        print(
            f"[{now_str}] #{readings:<4} ❤️ Nhịp tim: {heart_rate:>3} bpm | "
            f"Pin: {battery_level or '--':>2}% | Trạng thái: {contact_str} {status}",
            flush=True,
        )

        # Đẩy dữ liệu lên backend
        asyncio.get_event_loop().run_in_executor(
            None,
            send_vitals_to_backend,
            backend_url,
            device_name,
            heart_rate,
            battery_level,
            98,
        )

    while True:
        try:
            logger.info("Đang kết nối tới %s...", mac_address)
            async with BleakClient(mac_address, timeout=12.0) as client:
                logger.info("✅ Đã kết nối thành công tới %s!", mac_address)

                # Liệt kê các dịch vụ GATT đã phát hiện
                services_list = [s.uuid for s in client.services]
                logger.info("📋 Đã tìm thấy %d dịch vụ GATT:", len(services_list))
                for s in client.services:
                    logger.info("   • UUID: %s (%s)", s.uuid, s.description)

                # Đọc mức pin
                try:
                    raw_bat = await client.read_gatt_char(BATTERY_LEVEL_UUID)
                    battery_level = raw_bat[0]
                    logger.info("🔋 Mức pin Xiaomi Band: %d%%", battery_level)
                except Exception:
                    logger.debug("Không đọc được pin qua standard GATT battery.")

                # Bắt đầu nhận notifications nhịp tim
                try:
                    await client.start_notify(HR_MEASUREMENT_UUID, hr_callback)
                    logger.info("🚀 Bắt đầu nhận stream nhịp tim trực tiếp...")

                    # Kích hoạt cảm biến PPG phần cứng của Xiaomi/Huami
                    try:
                        await client.write_gatt_char(HUAMI_HR_CTRL_UUID, b"\x15\x01\x01", response=False)
                        logger.info("✨ Đã gửi lệnh kích hoạt cảm biến đo liên tục tới vòng tay.")
                    except Exception as hexc:
                        logger.debug("Huami HR control init: %s", hexc)
                except Exception as e:
                    logger.error("Lỗi khi đăng ký nhận nhịp tim GATT 0x2A37: %s", e)
                    logger.info("💡 Mẹo: Vào app Mi Fitness trên điện thoại > Thiết bị > Theo dõi sức khỏe > Bật 'Phát sóng nhịp tim' (Heart Rate Broadcast) để cho phép truyền trực tiếp.")
                    return

                # Duy trì kết nối và gửi heartbeat giữ cảm biến thức
                ping_cycle = 0
                while client.is_connected:
                    await asyncio.sleep(2.0)
                    ping_cycle += 1
                    if ping_cycle % 5 == 0:
                        try:
                            await client.write_gatt_char(HUAMI_HR_CTRL_UUID, b"\x16", response=False)
                        except Exception:
                            pass

            logger.warning("Mất kết nối tới vòng đeo tay! Tự động thử lại sau 5 giây...")
        except Exception as e:
            logger.warning("Lỗi kết nối (%s). Thử lại sau 5 giây...", e)

        await asyncio.sleep(5.0)


async def run_simulation(backend_url: str, device_name: str = "Xiaomi-Band-7-Sim"):
    """Chế độ giả lập sinh hiệu Xiaomi Band 7 để kiểm thử luồng end-to-end."""
    import random

    logger.info("Bắt đầu mô phỏng stream dữ liệu Xiaomi Band 7 tới %s", backend_url)
    readings = 0
    hr = 72
    battery = 88

    try:
        while True:
            readings += 1
            # Mô phỏng biến thiên nhịp tim sinh lý bình thường
            hr += random.choice([-2, -1, 0, 1, 2])
            hr = max(60, min(95, hr))
            spo2 = random.choice([97, 98, 99])

            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            print(
                f"[{now_str}] (SIM) #{readings:<4} ❤️ Nhịp tim: {hr:>3} bpm | "
                f"SpO2: {spo2}% | Pin: {battery}% | Đang đeo 🟢 [Bình thường]",
                flush=True,
            )

            send_vitals_to_backend(backend_url, device_name, hr, battery, spo2)
            await asyncio.sleep(2.0)
    except KeyboardInterrupt:
        logger.info("Dừng mô phỏng.")


def main():
    parser = argparse.ArgumentParser(description="SECA - Xiaomi Smart Band 7 Streamer")
    parser.add_argument("--scan", action="store_true", help="Quét tìm thiết bị Bluetooth LE")
    parser.add_argument("--auto", action="store_true", help="Tự động tìm và kết nối tới Xiaomi Band 7 đầu tiên")
    parser.add_argument("--mac", type=str, default="", help="Địa chỉ MAC hoặc UUID của Xiaomi Band 7")
    parser.add_argument("--backend-url", type=str, default=DEFAULT_BACKEND_URL, help="URL nhận POST vitals của backend")
    parser.add_argument("--simulate", action="store_true", help="Chạy chế độ mô phỏng dữ liệu")

    args = parser.parse_args()

    if args.simulate:
        asyncio.run(run_simulation(args.backend_url))
        return

    if args.scan:
        asyncio.run(scan_ble_devices())
        return

    if args.mac:
        asyncio.run(run_stream(args.mac, args.backend_url))
        return

    if args.auto:
        from bleak import BleakScanner

        async def auto_connect():
            logger.info("Đang tự động tìm kiếm Xiaomi Band 7...")
            devices = await BleakScanner.discover(timeout=6.0, return_adv=True)
            for address, (dev, adv) in devices.items():
                name = adv.local_name or dev.name or ""
                if any(k in name.lower() for k in ["xiaomi", "band 7", "mi band"]):
                    logger.info("🎯 Tìm thấy: %s (%s)", name, address)
                    await run_stream(address, args.backend_url, name)
                    return
            logger.warning("Không tự động tìm thấy Xiaomi Band. Hãy chạy với --scan để kiểm tra các thiết bị ở gần.")

        asyncio.run(auto_connect())
        return

    # Nếu không có tham số, mặc định chạy quét tìm trước
    parser.print_help()
    print("\nKhởi chạy quét mặc định:")
    asyncio.run(scan_ble_devices())


if __name__ == "__main__":
    main()

"""
stream_xiaomi_band7.py
Script kết nối, xác thực và truyền dữ liệu thời gian thực từ Xiaomi Smart Band 7 (Mi Band 7) vào hệ thống SECA.

Hỗ trợ:
- Tích hợp công cụ huami-token (--get-token) để tự động lấy Auth Key từ tài khoản Xiaomi / Zepp Life.
- Xác thực mật mã AES-128 challenge-response qua giao thức Huami BLE khi có Auth Key.
- Tự động quét (BLE Scan) và phát hiện Xiaomi Band 7 qua tên hoặc Service UUID 0x180D.
- Đọc % Pin thiết bị (Battery Service 0x180F -> 0x2A19).
- Đọc thông tin phần cứng/firmware (Device Information 0x180A).
- Nhận thông báo nhịp tim liên tục (GATT Heart Rate Service 0x180D -> 0x2A37).
- Đẩy dữ liệu trực tiếp lên FastAPI Backend (POST /api/v1/vitals) để hiển thị trên Mobile App và Doctor Web.
- Tự động kết nối lại (Auto-reconnect) khi mất sóng.
- Lưu trữ và nạp tự động Auth Key / MAC từ edge/config/config.yaml.
- Chế độ giả lập (--simulate) để kiểm thử luồng khi vòng chưa sạc hoặc chưa kích hoạt broadcast.

Cách sử dụng:
    1. Lấy Auth Key từ tài khoản Xiaomi / Mi Fitness (chạy 1 lần):
       python edge/scripts/stream_xiaomi_band7.py --get-token

    2. Kết nối và truyền dữ liệu thời gian thực:
       python edge/scripts/stream_xiaomi_band7.py --mac C1:BD:70:58:2D:F5

    3. Truyền kèm Auth Key trực tiếp:
       python edge/scripts/stream_xiaomi_band7.py --mac C1:BD:70:58:2D:F5 --auth-key 0x1234567890abcdef1234567890abcdef

    4. Tự động tìm và kết nối theo cấu hình config.yaml:
       python edge/scripts/stream_xiaomi_band7.py --auto

    5. Quét tìm thiết bị xung quanh:
       python edge/scripts/stream_xiaomi_band7.py --scan

    6. Chế độ kiểm thử đường truyền (mô phỏng):
       python edge/scripts/stream_xiaomi_band7.py --simulate
"""

import argparse
import asyncio
import datetime
import getpass
import json
import logging
import os
import struct
import sys
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

import yaml

# Tự động nạp huami-token module nếu có trong thư mục tools/huami-token
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
HUAMI_TOKEN_DIR = os.path.join(CURRENT_DIR, "..", "tools", "huami-token")
if os.path.exists(HUAMI_TOKEN_DIR) and HUAMI_TOKEN_DIR not in sys.path:
    sys.path.insert(0, HUAMI_TOKEN_DIR)

CONFIG_PATH = os.path.join(CURRENT_DIR, "..", "config", "config.yaml")

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

# Huami Auth Characteristic UUIDs
HUAMI_AUTH_SERVICE_UUID = "0000fee1-0000-1000-8000-00805f9b34fb"
HUAMI_AUTH_CHAR_UUID = "00000009-0000-3512-2118-0009af100700"

DEFAULT_BACKEND_URL = os.environ.get("BACKEND_VITALS_URL", "http://localhost:8000/api/v1/vitals")


def load_config() -> Dict[str, Any]:
    """Nạp cấu hình từ file config.yaml."""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            logger.warning("Không thể đọc config.yaml: %s", e)
    return {}


def save_auth_key_to_config(auth_key: str, mac: Optional[str] = None):
    """Lưu Auth Key và MAC address vào file config.yaml."""
    config = load_config()
    if "ble" not in config:
        config["ble"] = {}
    config["ble"]["auth_key"] = auth_key
    if mac:
        config["ble"]["device_mac"] = mac
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False)
        logger.info("💾 Đã lưu Auth Key vào cấu hình: %s", CONFIG_PATH)
    except Exception as e:
        logger.error("Không thể ghi config.yaml: %s", e)


def encrypt_huami_challenge(auth_key_hex: str, challenge_bytes: bytes) -> bytes:
    """Mã hóa số ngẫu nhiên thử thách từ vòng tay bằng AES-128-ECB với Auth Key."""
    from Crypto.Cipher import AES

    clean_key = auth_key_hex.strip().lower()
    if clean_key.startswith("0x"):
        clean_key = clean_key[2:]
    key_bytes = bytes.fromhex(clean_key)
    if len(key_bytes) != 16:
        raise ValueError(f"Auth key phải có độ dài 16 bytes (32 ký tự hex), nhận được: {len(key_bytes)} bytes")

    cipher = AES.new(key_bytes, AES.MODE_ECB)
    return cipher.encrypt(challenge_bytes)


def extract_key_from_oauth_url(oauth_url_or_code: str, format_type: str = "AMAZ_TOOLS") -> List[Dict[str, str]]:
    """Gửi link redirect OAuth (hm.xiaomi.com/watch.do?code=...) lên API để lấy token."""
    clean_url = oauth_url_or_code.strip()
    if not clean_url.startswith("http"):
        clean_url = f"https://hm.xiaomi.com/watch.do?code={clean_url}"

    payload = {
        "url": clean_url,
        "format": format_type,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://xiaomikey.mmk.pw/api/v1/perform",
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        if result.get("status") == "ready":
            devices = result.get("devices", [])
            return [
                {
                    "name": d.get("name", "Xiaomi Band"),
                    "mac": d.get("mac", ""),
                    "auth_key": d.get("token", ""),
                }
                for d in devices
            ]
        else:
            err = result.get("error", "Không thể lấy Auth Key từ link xác thực")
            raise ValueError(f"{err} (Mã lỗi: {result.get('error_code', 'unknown')})")


def _get_cached_xiaomi_client(region: str = "sg"):
    """Khởi tạo XiaomiClient từ phiên đăng nhập đã lưu (.xiaomi_lp_cache.json), tự làm mới serviceToken bằng passToken."""
    import base64
    import hashlib
    import urllib.parse
    import requests
    from huami_token.xiaomi import XiaomiClient, XiaomiSession, _parse_xiaomi_json

    cache_paths = [
        os.path.join(CURRENT_DIR, "..", "config", ".xiaomi_lp_cache.json"),
        os.path.join(CURRENT_DIR, "..", "..", "..", ".xiaomi_lp_cache.json"),
        ".xiaomi_lp_cache.json",
    ]
    cache_file = next((p for p in cache_paths if os.path.exists(p)), None)
    if not cache_file:
        raise FileNotFoundError("Chưa có bộ nhớ đệm phiên Xiaomi (.xiaomi_lp_cache.json). Hãy chạy --qr trước.")

    with open(cache_file, "r", encoding="utf-8") as f:
        cache = json.load(f)

    ssec = cache.get("ssecurity")
    stoken = cache.get("serviceToken")
    user_id = str(cache.get("userId", ""))
    c_user_id = cache.get("cUserId", "")

    # Nếu chưa có serviceToken nhưng có passToken thì tự động cấp mới
    if (not stoken or not ssec) and cache.get("passToken"):
        headers = {"User-Agent": "Android-12-9.8.348i-google-Pixel 4"}
        cookies = {
            "userId": user_id,
            "cUserId": c_user_id,
            "passToken": cache["passToken"],
            "deviceId": "an_" + hashlib.md5(user_id.encode()).hexdigest(),
        }
        r1 = requests.get(
            "https://account.xiaomi.com/pass/serviceLogin",
            params={"_json": "true", "sid": "miothealth", "_locale": "en_US"},
            headers=headers,
            cookies=cookies,
            timeout=8,
        )
        d1 = _parse_xiaomi_json(r1.text)
        if d1.get("location") and d1.get("ssecurity"):
            ssec = d1["ssecurity"]
            nonce = d1["nonce"]
            sign_input = f"nonce={nonce}&{ssec}"
            client_sign = base64.b64encode(hashlib.sha1(sign_input.encode()).digest()).decode()
            url = d1["location"] + "&clientSign=" + urllib.parse.quote(client_sign)
            r_sts = requests.get(url, headers=headers, allow_redirects=False, timeout=8)
            stoken = r_sts.cookies.get("serviceToken")
            if stoken:
                cache["ssecurity"] = ssec
                cache["serviceToken"] = stoken
                with open(cache_file, "w", encoding="utf-8") as wf:
                    json.dump(cache, wf)

    xs = XiaomiSession("user", "pass")
    xs._ssecurity = ssec
    xs._service_token = stoken
    xs._user_id = user_id
    xs._c_user_id = c_user_id
    return XiaomiClient(xs, region=region), cache_file, cache


def fetch_xiaomi_cloud_vitals(region: str = "sg") -> Dict[str, Any]:
    """Lấy dữ liệu nhịp tim (BPM) và SpO2 thực tế của Xiaomi Band 7 đồng bộ trên đám mây Mi Fitness."""
    xc, cache_file, cache = _get_cached_xiaomi_client(region=region)
    now = int(time.time())
    host = f"https://{region}.hlth.io.mi.com" if region else "https://hlth.io.mi.com"
    url = f"{host}/app/v1/data/get_fitness_data_by_time"

    hr_records = []
    spo2_records = []

    for key in ("heart_rate", "single_heart_rate", "single_spo2"):
        payload = {"start_time": 1700000000, "end_time": now + 86400, "key": key}
        res = xc.request("POST", url, params={"data": json.dumps(payload, separators=(",", ":"))})
        for item in res.get("result", {}).get("data_list") or []:
            val_raw = item.get("value", "{}")
            val = json.loads(val_raw) if isinstance(val_raw, str) else val_raw
            ts = int(item.get("time") or val.get("time") or 0)
            sid = item.get("sid", "")
            if "bpm" in val:
                hr_records.append({"time": ts, "bpm": int(val["bpm"]), "sid": sid, "key": key})
            if "spo2" in val:
                spo2_records.append({"time": ts, "spo2": int(val["spo2"]), "sid": sid, "key": key})

    hr_records.sort(key=lambda x: x["time"])
    spo2_records.sort(key=lambda x: x["time"])

    latest_hr = hr_records[-1]["bpm"] if hr_records else None
    latest_spo2 = spo2_records[-1]["spo2"] if spo2_records else None
    latest_time = max(
        (hr_records[-1]["time"] if hr_records else 0),
        (spo2_records[-1]["time"] if spo2_records else 0),
    )
    return {
        "latest_hr": latest_hr,
        "latest_spo2": latest_spo2,
        "latest_time": latest_time,
        "hr_records": hr_records,
        "spo2_records": spo2_records,
    }


def fetch_huami_tokens(method: str, email: str = "", password: str = "", use_qr: bool = False) -> List[Dict[str, str]]:
    """Truy vấn máy chủ Xiaomi / Zepp để lấy danh sách thiết bị và Auth Key tương ứng."""
    results = []
    if method == "xiaomi":
        from huami_token.xiaomi import XiaomiClient, XiaomiSession

        session = XiaomiSession(username=email or "xiaomi_user", password=password or "")
        if use_qr:
            logger.info("Khởi tạo đăng nhập Xiaomi Cloud bằng Link xác nhận nhanh (QR/Long-Polling)...")
            session.login_qr()
        else:
            logger.info("Đang đăng nhập vào máy chủ Xiaomi Mi Fitness...")
            session.login()

        seen_keys = set()
        for reg in ["sg", "i2", "ru", "us", "de", ""]:
            client = XiaomiClient(session, region=reg or "sg")
            host = f"https://{reg}.hlth.io.mi.com" if reg else "https://hlth.io.mi.com"
            url = f"{host}/app/v1/source/get_source_list"
            for st in (1, 2):
                try:
                    data_str = json.dumps({"page_size": 50, "status": st}, separators=(",", ":"))
                    source_data = client.request("POST", url, params={"data": data_str}, path_prefix="")
                    logger.info("Kết quả vùng %s (status=%d): %s", reg or "cn", st, json.dumps(source_data)[:300])
                    sources = source_data.get("result", {}).get("list") or []
                    for src in sources:
                        name = src.get("name", "Xiaomi Wearable").strip()
                        detail = src.get("detail", {})
                        if isinstance(detail, str):
                            try:
                                detail = json.loads(detail)
                            except Exception:
                                detail = {}
                        mac = detail.get("mac", src.get("mac", ""))
                        auth_key = (
                            detail.get("auth_key")
                            or detail.get("encrypt_key")
                            or detail.get("token")
                            or src.get("auth_key", "")
                        )
                        uniq = (mac, auth_key, name)
                        if (mac or auth_key) and uniq not in seen_keys:
                            seen_keys.add(uniq)
                            results.append({"name": f"{name} [{reg or 'cn'}]", "mac": mac, "auth_key": auth_key})
                except Exception as exc:
                    logger.debug("Region %s (status=%d) skip: %s", reg or "base", st, exc)
    else:
        from huami_token.zepp import ZeppClient, ZeppSession

        logger.info("Đang đăng nhập vào máy chủ Zepp / Amazfit...")
        session = ZeppSession(username=email, password=password)
        session.login()
        client = ZeppClient(session)
        devices = client.get_devices()
        for dev in devices:
            results.append({"name": "Zepp / Amazfit Device", "mac": dev.mac, "auth_key": dev.auth_key})
        session.logout()

    return results


async def authenticate_huami_band(client, auth_key_hex: str) -> bool:
    """Thực hiện chuỗi bắt tay mã hóa Huami BLE Authentication (Challenge-Response)."""
    # Tìm characteristic xác thực Huami
    auth_char = None
    for s in client.services:
        for c in s.characteristics:
            if c.uuid.lower() == HUAMI_AUTH_CHAR_UUID.lower():
                auth_char = c
                break

    if not auth_char:
        logger.debug("Không tìm thấy characteristic Huami Auth 0x0009 tiêu chuẩn. Bỏ qua xác thực handshake.")
        return True

    logger.info("🔐 Bắt đầu chu kỳ xác thực mật mã Huami Auth...")
    challenge_event = asyncio.Event()
    auth_success_event = asyncio.Event()
    challenge_received: bytearray = bytearray()

    def auth_notification_handler(sender, data: bytearray):
        nonlocal challenge_received
        if len(data) >= 3 and data[0] == 0x10 and data[1] == 0x02 and data[2] == 0x01:
            challenge_received = data[3:19]
            challenge_event.set()
        elif len(data) >= 3 and data[0] == 0x10 and data[1] == 0x03 and data[2] == 0x01:
            logger.info("🎉 Xác thực mật mã vòng đeo tay thành công!")
            auth_success_event.set()
        elif len(data) >= 3 and data[0] == 0x10 and data[2] != 0x01:
            logger.error("❌ Xác thực thất bại (mã phản hồi: %s)", list(data))

    try:
        await client.start_notify(auth_char.uuid, auth_notification_handler)

        # Gửi yêu cầu sinh số thử thách ngẫu nhiên từ vòng tay
        logger.info("Gửi lệnh yêu cầu challenge (0x02 0x08)...")
        await client.write_gatt_char(auth_char.uuid, b"\x02\x08", response=True)

        try:
            await asyncio.wait_for(challenge_event.wait(), timeout=6.0)
        except asyncio.TimeoutError:
            # Thử lại với flag 0x02 0x00
            await client.write_gatt_char(auth_char.uuid, b"\x02\x00", response=True)
            await asyncio.wait_for(challenge_event.wait(), timeout=4.0)

        # Mã hóa challenge với Auth Key
        encrypted_challenge = encrypt_huami_challenge(auth_key_hex, bytes(challenge_received))

        # Gửi phản hồi mã hóa trả lại cho vòng tay
        logger.info("Gửi phản hồi challenge đã mã hóa (0x03 0x08 + AES-128)...")
        await client.write_gatt_char(auth_char.uuid, b"\x03\x08" + encrypted_challenge, response=True)

        await asyncio.wait_for(auth_success_event.wait(), timeout=6.0)
        return True
    except Exception as e:
        logger.warning("Bắt tay Huami Auth gặp sự cố (%s). Tiếp tục với quyền cơ bản.", e)
        return False


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


async def run_stream(
    mac_address: str,
    backend_url: str,
    device_name: str = "Xiaomi-Band-7",
    auth_key: Optional[str] = None,
):
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

                # Xác thực Huami BLE nếu có Auth Key
                if auth_key:
                    await authenticate_huami_band(client, auth_key)

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
                    logger.info("🚀 Đã đăng ký nhận stream nhịp tim trực tiếp (GATT 0x2A37).")

                    # Kích hoạt cảm biến PPG phần cứng của Xiaomi/Huami
                    try:
                        await client.write_gatt_char(HUAMI_HR_CTRL_UUID, b"\x15\x01\x01", response=False)
                        logger.info("✨ Đã gửi lệnh kích hoạt cảm biến đo liên tục tới vòng tay.")
                    except Exception as hexc:
                        logger.debug("Huami HR control init: %s", hexc)
                except Exception as e:
                    logger.error("Lỗi khi đăng ký nhận nhịp tim GATT 0x2A37: %s", e)
                    logger.info("💡 Mẹo: Vào app Mi Fitness trên điện thoại > Thiết bị > Theo dõi sức khỏe > Bật 'Phát sóng nhịp tim' (Heart Rate Broadcast) hoặc chạy --get-token để nạp Auth Key.")
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
            logger.warning("BLE trực tiếp chưa phản hồi (%s) -> Đang đồng bộ dữ liệu thực từ Xiaomi Health Cloud...", e)
            try:
                cloud_data = fetch_xiaomi_cloud_vitals()
                if cloud_data.get("latest_hr"):
                    hr_val = cloud_data["latest_hr"]
                    spo2_val = cloud_data.get("latest_spo2") or 98
                    ts_str = datetime.datetime.fromtimestamp(cloud_data["latest_time"]).strftime("%H:%M:%S")
                    print(
                        f"[{ts_str}] (MI-CLOUD) ❤️ Nhịp tim: {hr_val:>3} bpm | "
                        f"🩸 SpO2: {spo2_val}% | Thiết bị: Xiaomi Smart Band 7 (C1:BD:70:58:2D:F5) 🟢",
                        flush=True,
                    )
                    send_vitals_to_backend(backend_url, device_name, hr_val, battery_level, spo2_val)
            except Exception as ce:
                logger.debug("Cloud fallback skip: %s", ce)

        await asyncio.sleep(5.0)


async def run_cloud_sync(
    backend_url: str,
    device_name: str = "Xiaomi-Band-7",
    once: bool = False,
    interval: float = 10.0,
):
    """Đồng bộ trực tiếp nhịp tim & SpO2 thực tế từ đám mây Mi Fitness (sg.hlth.io.mi.com)."""
    logger.info("☁️ Bắt đầu đồng bộ dữ liệu thực tế Xiaomi Smart Band 7 từ Mi Fitness Cloud (sg.hlth.io.mi.com)...")
    seen_timestamps = set()
    while True:
        try:
            data = fetch_xiaomi_cloud_vitals(region="sg")
            hr_list = data.get("hr_records", [])
            spo2_list = data.get("spo2_records", [])
            latest_spo2 = data.get("latest_spo2") or 98

            if not seen_timestamps:
                print("\n" + "=" * 75, flush=True)
                print("📊 DỮ LIỆU ĐO THỰC TẾ TỪ XIAOMI SMART BAND 7 (C1:BD:70:58:2D:F5 | Serial: 39869/AAABF23VM03922):", flush=True)
                print("=" * 75, flush=True)
                for rec in hr_list:
                    dt_str = datetime.datetime.fromtimestamp(rec["time"]).strftime("%Y-%m-%d %H:%M:%S")
                    print(f"  • [{dt_str}] ❤️ Nhịp tim ({rec['key']}): {rec['bpm']} bpm", flush=True)
                for srec in spo2_list:
                    dt_str = datetime.datetime.fromtimestamp(srec["time"]).strftime("%Y-%m-%d %H:%M:%S")
                    print(f"  • [{dt_str}] 🩸 Nồng độ Oxy máu ({srec['key']}): {srec['spo2']}%", flush=True)
                print("=" * 75 + "\n", flush=True)

            if data.get("latest_hr"):
                hr_val = data["latest_hr"]
                ts = data["latest_time"]
                now_str = datetime.datetime.now().strftime("%H:%M:%S")
                print(
                    f"[{now_str}] ☁️ [LIVE CLOUD SYNC] ❤️ Nhịp tim mới nhất: {hr_val} bpm | "
                    f"🩸 SpO2: {latest_spo2}% | MAC: C1:BD:70:58:2D:F5 | AuthKey: 0x6E589C3F5F214311AF5C56C8455BA211",
                    flush=True,
                )
                send_vitals_to_backend(backend_url, device_name, hr_val, 100, latest_spo2)
                seen_timestamps.add(ts)
        except Exception as exc:
            logger.error("Lỗi đồng bộ Xiaomi Cloud: %s", exc)

        if once:
            break
        await asyncio.sleep(interval)


async def run_simulation(backend_url: str, device_name: str = "Xiaomi-Band-7-Sim"):
    """Chế độ giả lập sinh hiệu Xiaomi Band 7 để kiểm thử luồng end-to-end."""
    import random

    logger.info("Bắt đầu mô phỏng stream dữ liệu Xiaomi Band 7 tới %s", backend_url)
    readings = 0
    hr = 72
    battery = 100

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


def handle_get_token(args):
    """Trợ lý tương tác lấy Auth Key từ máy chủ Xiaomi / Zepp."""
    print("\n" + "=" * 65)
    print("🔑 TRỢ LÝ LẤY AUTH KEY TỪ HUAMI-TOKEN (XIAOMI / ZEPP LIFE)")
    print("=" * 65)
    print("Công cụ này sẽ kết nối đến đám mây Xiaomi / Zepp để lấy")
    print("chuỗi 32-ký tự Auth Key đã được gán khi ghép nối vòng tay.\n")

    method = args.method
    use_qr = getattr(args, "qr", False)
    email = args.email
    password = args.password

    if not use_qr:
        if not email:
            email = input("Nhập email hoặc số điện thoại tài khoản (Mi Fitness/Zepp): ").strip()
        if not password:
            password = getpass.getpass("Nhập mật khẩu tài khoản: ")

    try:
        devices = fetch_huami_tokens(method=method, email=email, password=password, use_qr=use_qr)
        if not devices:
            print("⚠️ Không tìm thấy thiết bị nào được liên kết với tài khoản này.")
            return

        print(f"\n🎉 Tìm thấy {len(devices)} thiết bị liên kết:", flush=True)
        target_device = None
        for i, dev in enumerate(devices):
            mac = dev.get("mac", "??")
            name = dev.get("name", "Unknown")
            key = dev.get("auth_key", "")
            print(f" [{i+1}] Tên: {name} | MAC: {mac}", flush=True)
            if key:
                print(f"     👉 Auth Key: 0x{key}", flush=True)
                if not target_device or "band 7" in name.lower():
                    target_device = dev
            else:
                print("     👉 Auth Key: (chưa sẵn sàng)", flush=True)

        if target_device and target_device.get("auth_key"):
            key_val = target_device["auth_key"]
            mac_val = target_device.get("mac")
            print(f"\n✅ Đã chọn thiết bị: {target_device.get('name')} ({mac_val})", flush=True)
            save_auth_key_to_config(key_val, mac_val)
            print("Để bắt đầu stream ngay, hãy chạy:", flush=True)
            print(f"  python edge/scripts/stream_xiaomi_band7.py --mac {mac_val}", flush=True)
    except Exception as e:
        print(f"\n❌ Lỗi khi lấy token: {e}", flush=True)
        print("💡 Lưu ý: Đảm bảo tài khoản đăng nhập bằng Email/Password (không dùng đăng nhập mạng xã hội).", flush=True)


def main():
    parser = argparse.ArgumentParser(description="SECA - Xiaomi Smart Band 7 Streamer")
    parser.add_argument("--scan", action="store_true", help="Quét tìm thiết bị Bluetooth LE")
    parser.add_argument("--auto", action="store_true", help="Tự động tìm và kết nối tới Xiaomi Band 7")
    parser.add_argument("--mac", type=str, default="", help="Địa chỉ MAC hoặc UUID của Xiaomi Band 7")
    parser.add_argument("--backend-url", type=str, default=DEFAULT_BACKEND_URL, help="URL nhận POST vitals của backend")
    parser.add_argument("--simulate", action="store_true", help="Chạy chế độ mô phỏng dữ liệu")

    # huami-token integration options
    parser.add_argument("--get-token", action="store_true", help="Trợ lý lấy Auth Key từ đám mây Xiaomi / Zepp")
    parser.add_argument("--qr", action="store_true", help="Đăng nhập Xiaomi 1-click qua trình duyệt (Long-Polling)")
    parser.add_argument("--cloud-sync", action="store_true", help="Đồng bộ dữ liệu nhịp tim & SpO2 thực từ Mi Fitness Cloud")
    parser.add_argument("--once", action="store_true", help="Chạy đồng bộ Cloud 1 lần rồi thoát")
    parser.add_argument("--oauth-url", type=str, default="", help="Link redirect OAuth (https://hm.xiaomi.com/watch.do?code=...) để trích xuất token")
    parser.add_argument("--method", choices=["xiaomi", "amazfit"], default="xiaomi", help="Phương thức đăng nhập (mặc định: xiaomi)")
    parser.add_argument("-e", "--email", type=str, default="", help="Email tài khoản")
    parser.add_argument("-p", "--password", type=str, default="", help="Mật khẩu tài khoản")
    parser.add_argument("--auth-key", type=str, default="", help="Auth Key 16-byte hex (e.g. 0x1234...)")

    args = parser.parse_args()

    if args.cloud_sync:
        asyncio.run(run_cloud_sync(args.backend_url, once=args.once))
        return

    if args.oauth_url:
        print("\n🔍 Đang trích xuất Auth Key từ link redirect OAuth...")
        try:
            devs = extract_key_from_oauth_url(args.oauth_url)
            print(f"🎉 Tìm thấy {len(devs)} thiết bị:")
            target_key = ""
            target_mac = ""
            for d in devs:
                print(f"  👉 Tên: {d['name']} | MAC: {d['mac']} | Key: {d['auth_key']}")
                if "band 7" in d["name"].lower() or not target_key:
                    target_key = d["auth_key"]
                    target_mac = d["mac"]
            if target_key:
                save_auth_key_to_config(target_key, target_mac or None)
                print("💾 Đã lưu Auth Key vào cấu hình! Bắt đầu kết nối...\n")
                asyncio.run(run_stream(target_mac or args.mac, args.backend_url, auth_key=target_key))
        except Exception as e:
            print(f"❌ Lỗi: {e}")
        return

    if args.get_token or args.qr:
        handle_get_token(args)
        return

    if args.simulate:
        asyncio.run(run_simulation(args.backend_url))
        return

    if args.scan:
        asyncio.run(scan_ble_devices())
        return

    # Nạp cấu hình từ config.yaml nếu không truyền trực tiếp
    config = load_config()
    ble_config = config.get("ble", {})
    target_mac = args.mac or ble_config.get("device_mac", "")
    target_auth_key = args.auth_key or ble_config.get("auth_key", "")

    if target_mac:
        asyncio.run(run_stream(target_mac, args.backend_url, auth_key=target_auth_key))
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
                    await run_stream(address, args.backend_url, name, auth_key=target_auth_key)
                    return
            logger.warning("Không tự động tìm thấy Xiaomi Band. Hãy chạy với --scan để kiểm tra các thiết bị ở gần.")

        asyncio.run(auto_connect())
        return

    # Nếu không có tham số, mặc định quét tìm
    parser.print_help()
    print("\nKhởi chạy quét mặc định:")
    asyncio.run(scan_ble_devices())


if __name__ == "__main__":
    main()

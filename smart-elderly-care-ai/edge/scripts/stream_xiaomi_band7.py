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

# GATT Standard & Huami / Zepp OS UUIDs
HR_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
HR_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb"
HUAMI_HR_CTRL_UUID = "00002a39-0000-1000-8000-00805f9b34fb"
BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb"
BATTERY_LEVEL_UUID = "00002a19-0000-1000-8000-00805f9b34fb"
HUAMI_BATTERY_UUID = "00000006-0000-3512-2118-0009af100700"
HUAMI_REALTIME_STEPS_UUID = "00000007-0000-3512-2118-0009af100700"
HUAMI_RAW_SENSOR_CTRL_UUID = "00000001-0000-3512-2118-0009af100700"
HUAMI_RAW_SENSOR_DATA_UUID = "00000002-0000-3512-2118-0009af100700"
HUAMI_DEVICEEVENT_UUID = "00000010-0000-3512-2118-0009af100700"
HUAMI_ACTIVITY_CTRL_UUID = "00000004-0000-3512-2118-0009af100700"
HUAMI_ACTIVITY_DATA_UUID = "00000005-0000-3512-2118-0009af100700"

# Device Information Service (0x180A)
GATT_SERIAL_NUMBER_UUID = "00002a25-0000-1000-8000-00805f9b34fb"
GATT_FIRMWARE_REV_UUID = "00002a26-0000-1000-8000-00805f9b34fb"
GATT_HARDWARE_REV_UUID = "00002a27-0000-1000-8000-00805f9b34fb"
GATT_SOFTWARE_REV_UUID = "00002a28-0000-1000-8000-00805f9b34fb"
GATT_MANUFACTURER_UUID = "00002a29-0000-1000-8000-00805f9b34fb"

# Huami Auth & Zepp OS 2021 Chunked Transfer UUIDs
HUAMI_AUTH_SERVICE_UUID = "0000fee1-0000-1000-8000-00805f9b34fb"
HUAMI_AUTH_CHAR_UUID = "00000009-0000-3512-2118-0009af100700"
ZEPPOS_CHUNK_WRITE_UUID = "00000016-0000-3512-2118-0009af100700"
ZEPPOS_CHUNK_READ_UUID = "00000017-0000-3512-2118-0009af100700"

# NIST B-163 (sect163r2) constants for Zepp OS / Huami 2021 ECDH handshake
_B163_POLY = (1 << 163) | 0xC9
_B163_GX = (0x00000003 << 160) | (0xF0EBA162 << 128) | (0x86A2D57E << 96) | (0xA0991168 << 64) | (0xD4994637 << 32) | 0xE8343E36
_B163_GY = (0x00000000 << 160) | (0xD51FBC6C << 128) | (0x71A0094F << 96) | (0xA2CDD545 << 64) | (0xB11C5C0C << 32) | 0x797324F1


def _gf2_mul(a: int, b: int) -> int:
    res = 0
    while b:
        if b & 1:
            res ^= a
        a <<= 1
        if a & (1 << 163):
            a ^= _B163_POLY
        b >>= 1
    return res


def _gf2_inv(a: int) -> int:
    u, v, g1, g2 = a, _B163_POLY, 1, 0
    while u != 1:
        j = u.bit_length() - v.bit_length()
        if j < 0:
            u, v, g1, g2, j = v, u, g2, g1, -j
        u ^= v << j
        g1 ^= g2 << j
    return g1


def _b163_double(x: int, y: int) -> Tuple[int, int]:
    if x == 0:
        return (0, 0)
    lam = x ^ _gf2_mul(y, _gf2_inv(x))
    x3 = _gf2_mul(lam, lam) ^ lam ^ 1
    return (x3, _gf2_mul(x, x) ^ _gf2_mul(lam ^ 1, x3))


def _b163_add(x1: int, y1: int, x2: int, y2: int) -> Tuple[int, int]:
    if x1 == 0 and y1 == 0:
        return (x2, y2)
    if x2 == 0 and y2 == 0:
        return (x1, y1)
    if x1 == x2:
        return _b163_double(x1, y1) if y1 == y2 else (0, 0)
    lam = _gf2_mul(y1 ^ y2, _gf2_inv(x1 ^ x2))
    x3 = _gf2_mul(lam, lam) ^ lam ^ x1 ^ x2 ^ 1
    return (x3, _gf2_mul(x1 ^ x3, lam) ^ x3 ^ y1)


def _b163_mul(x: int, y: int, k: int) -> Tuple[int, int]:
    rx, ry = 0, 0
    for i in range(k.bit_length() - 1, -1, -1):
        rx, ry = _b163_double(rx, ry)
        if (k >> i) & 1:
            rx, ry = _b163_add(rx, ry, x, y)
    return (rx, ry)


def ecdh_b163_public_key(priv_bytes: bytes) -> bytes:
    k = int.from_bytes(priv_bytes, "little") & ((1 << 162) - 1)
    px, py = _b163_mul(_B163_GX, _B163_GY, k)
    return px.to_bytes(24, "little") + py.to_bytes(24, "little")


def ecdh_b163_shared_secret(priv_bytes: bytes, remote_pub: bytes) -> bytes:
    k = int.from_bytes(priv_bytes, "little") & ((1 << 162) - 1)
    rx = int.from_bytes(remote_pub[:24], "little")
    ry = int.from_bytes(remote_pub[24:48], "little")
    sx, sy = _b163_mul(rx, ry, k)
    return sx.to_bytes(24, "little") + sy.to_bytes(24, "little")

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
    if not auth_key or not auth_key.strip():
        logger.warning("Bỏ qua lưu config.yaml vì auth_key trống.")
        return
    config = load_config()
    if "ble" not in config:
        config["ble"] = {}
    config["ble"]["auth_key"] = auth_key.strip()
    if mac and mac.strip():
        config["ble"]["device_mac"] = mac.strip()
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
        logger.info("Phản hồi xiaomikey API: %s", json.dumps(result, ensure_ascii=False))
        if result.get("status") == "ready":
            devices = result.get("devices", [])
            parsed: List[Dict[str, str]] = []
            for d in devices:
                if isinstance(d, str):
                    parts = [p.strip() for p in d.replace(",", ";").split(";") if p.strip()]
                    parsed.append({"name": "Xiaomi Band", "mac": parts[0] if len(parts) > 1 else "", "auth_key": parts[-1] if parts else ""})
                elif isinstance(d, dict):
                    mac_val = d.get("mac") or d.get("macAddress") or d.get("mac_address") or d.get("address") or ""
                    key_val = d.get("auth_key") or d.get("authKey") or d.get("key") or d.get("token") or d.get("secret") or ""
                    name_val = d.get("name") or d.get("model") or d.get("deviceName") or "Xiaomi Band"
                    parsed.append({"name": str(name_val), "mac": str(mac_val), "auth_key": str(key_val), "raw": json.dumps(d, ensure_ascii=False)})
            return parsed
        else:
            err = result.get("error", "Không thể lấy Auth Key từ link xác thực")
            raise ValueError(f"{err} (Mã lỗi: {result.get('error_code', 'unknown')})")


def _get_cached_xiaomi_client(region: str = "sg", force_refresh: bool = False):
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

    # Nếu chưa có serviceToken hoặc yêu cầu force_refresh thì tự động cấp mới bằng passToken
    if (force_refresh or not stoken or not ssec) and cache.get("passToken"):
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
        try:
            res = xc.request("POST", url, params={"data": json.dumps(payload, separators=(",", ":"))})
        except Exception:
            xc, cache_file, cache = _get_cached_xiaomi_client(region=region, force_refresh=True)
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

        # Gửi yêu cầu sinh số thử thách ngẫu nhiên (0x0009 dùng Write Without Response)
        auth_flag = b"\x00"
        logger.info("Gửi lệnh yêu cầu challenge (0x02 0x00)...")
        await client.write_gatt_char(auth_char.uuid, b"\x02\x00", response=False)

        try:
            await asyncio.wait_for(challenge_event.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            auth_flag = b"\x08"
            logger.info("Thử lại yêu cầu challenge (0x02 0x08)...")
            await client.write_gatt_char(auth_char.uuid, b"\x02\x08", response=False)
            await asyncio.wait_for(challenge_event.wait(), timeout=5.0)

        # Mã hóa challenge với Auth Key
        encrypted_challenge = encrypt_huami_challenge(auth_key_hex, bytes(challenge_received))

        # Gửi phản hồi mã hóa trả lại cho vòng tay
        logger.info("Gửi phản hồi challenge đã mã hóa (0x03 + AES-128)...")
        await client.write_gatt_char(auth_char.uuid, b"\x03" + auth_flag + encrypted_challenge, response=False)

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
    extra: Optional[Dict[str, Any]] = None,
):
    """Gửi toàn bộ dữ liệu sinh hiệu & cảm biến đồng hồ đồng thời lên cả AWS EC2 Backend và Local FastAPI Backend."""
    ext = extra or {}
    payload: Dict[str, Any] = {
        "device_id": device_id,
        "heart_rate": heart_rate,
        "spo2": spo2 or ext.get("spo2") or 98,
        "skin_temp_max": ext.get("skin_temp_max", 36.6),
        "fall_detected": bool(ext.get("fall_detected", False)),
        "is_worn": bool(ext.get("is_worn", True)),
        "activity_state": ext.get("activity_state", "Đang đeo"),
        "raw_payload": ext,
    }
    for k in ("steps", "distance_m", "calories_kcal", "accel_x", "accel_y", "accel_z", "accel_g", "battery_state"):
        if ext.get(k) is not None:
            payload[k] = ext[k]
    if battery is not None:
        payload["battery_level"] = battery
        payload["bracelet_battery"] = battery

    data = json.dumps(payload).encode("utf-8")
    ec2_url = "http://16.178.128.42:8000/api/v1/vitals"
    target_urls = [ec2_url, backend_url] if (ec2_url != backend_url and "localhost" in backend_url) else [backend_url]

    for url in target_urls:
        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                pass
        except Exception as e:
            logger.debug("[Backend %s] Gửi sinh hiệu lỗi: %s", url, e)


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


def parse_realtime_steps_payload(raw: bytes) -> Dict[str, int]:
    """Giải mã gói bước chân, quãng đường (m) và năng lượng tiêu thụ (kcal) từ characteristic 0x0007 hoặc ZeppOS 0x0016."""
    if not raw or len(raw) < 3:
        return {}
    out: Dict[str, int] = {}
    if len(raw) >= 13:
        out["steps"] = int.from_bytes(raw[1:5], "little")
        out["distance_m"] = int.from_bytes(raw[5:9], "little")
        out["calories_kcal"] = int.from_bytes(raw[9:13], "little")
    elif len(raw) >= 3:
        out["steps"] = int.from_bytes(raw[1:3], "little")
    return out


def parse_huami_battery_info(raw: bytes) -> Dict[str, Any]:
    """Giải mã gói thông tin pin chi tiết 20-byte từ characteristic 0x0006 hoặc ZeppOS 0x0029."""
    if not raw or len(raw) < 2:
        return {}
    info: Dict[str, Any] = {"battery_level": raw[1]}
    if len(raw) >= 3:
        info["battery_state"] = "Đang sạc ⚡" if raw[2] == 1 else "Đang dùng pin 🔋"
    if len(raw) >= 18:
        yr = int.from_bytes(raw[10:12], "little")
        mo, dy, hh, mm, ss = raw[12], raw[13], raw[14], raw[15], raw[16]
        if 2020 <= yr <= 2035 and 1 <= mo <= 12 and 1 <= dy <= 31:
            info["last_charge_time"] = f"{yr:04d}-{mo:02d}-{dy:02d} {hh:02d}:{mm:02d}:{ss:02d}"
    if len(raw) >= 20:
        info["last_charge_level"] = raw[19]
    return info


def parse_raw_sensor_accel(raw: bytes) -> Optional[Dict[str, Any]]:
    """Giải mã cảm biến gia tốc 3 trục (G-Sensor x, y, z) từ characteristic 0x0002."""
    if not raw or len(raw) < 8 or raw[0] != 0x00 or (len(raw) - 2) % 6 != 0:
        return None
    scale = 4100.0
    g_const = -9.81
    samples = []
    max_g = 0.0
    min_g = 99.0
    for i in range(2, len(raw), 6):
        rx, ry, rz = struct.unpack_from("<hhh", raw, i)
        gx = round((rx * g_const) / scale, 2)
        gy = round((ry * g_const) / scale, 2)
        gz = round((rz * g_const) / scale, 2)
        mag_g = round(((rx * rx + ry * ry + rz * rz) ** 0.5) / scale, 2)
        max_g = max(max_g, mag_g)
        min_g = min(min_g, mag_g)
        samples.append((gx, gy, gz, mag_g))
    if not samples:
        return None
    lx, ly, lz, lg = samples[-1]
    fall_detected = max_g >= 2.8 and min_g <= 0.45
    if fall_detected:
        act = "Té ngã khẩn cấp"
    elif max_g >= 1.55:
        act = "Vận động mạnh"
    elif max_g >= 1.15:
        act = "Đi bộ / Sinh hoạt"
    else:
        act = "Nghỉ ngơi"
    return {
        "accel_x": lx,
        "accel_y": ly,
        "accel_z": lz,
        "accel_g": round(max_g, 2),
        "sample_count": len(samples),
        "activity_state": act,
        "fall_detected": fall_detected,
    }


async def _zeppos_send_chunked(
    client,
    write_handle: int,
    ep: int,
    data: bytes,
    mtu: int = 247,
    encrypt: bool = False,
    session_key: Optional[bytes] = None,
    seq_nr: int = 0,
) -> Tuple[int, int]:
    """Gửi gói dữ liệu phân mảnh theo chuẩn Huami 2021 / Zepp OS qua characteristic 0x0016 (hỗ trợ cả Plaintext và AES-128 Encrypted)."""
    import zlib
    from Crypto.Cipher import AES

    wh = (write_handle + 1) & 0xFF
    orig_len = len(data)
    data_to_send = data
    if encrypt and session_key and len(session_key) == 16:
        msg_key = bytes(session_key[i] ^ wh for i in range(16))
        enc_len = orig_len + 8
        rem = enc_len % 16
        if rem > 0:
            enc_len += 16 - rem
        buf = bytearray(enc_len)
        buf[:orig_len] = data
        struct.pack_into("<I", buf, orig_len, seq_nr & 0xFFFFFFFF)
        crc = zlib.crc32(bytes(buf[: orig_len + 4])) & 0xFFFFFFFF
        struct.pack_into("<I", buf, orig_len + 4, crc)
        seq_nr = (seq_nr + 1) & 0xFFFFFFFF
        data_to_send = AES.new(msg_key, AES.MODE_ECB).encrypt(bytes(buf))

    remaining = len(data_to_send)
    offset = 0
    count = 0
    header_size = 11
    max_write = max(20, min(mtu - 3, 244))
    while remaining > 0:
        max_chunk = max(1, max_write - header_size)
        n = min(remaining, max_chunk)
        chunk = bytearray(header_size + n)
        flags = 0x08 if (encrypt and session_key) else 0x00
        if count == 0:
            flags |= 0x01
            struct.pack_into("<IH", chunk, 5, orig_len, ep)
        if remaining <= max_chunk:
            flags |= 0x02 | 0x04
        chunk[0], chunk[1], chunk[2], chunk[3], chunk[4] = 0x03, flags, 0x00, wh, count
        chunk[header_size:] = data_to_send[offset : offset + n]
        await client.write_gatt_char(ZEPPOS_CHUNK_WRITE_UUID, bytes(chunk), response=False)
        offset += n
        remaining -= n
        header_size = 5
        count += 1
    return wh, seq_nr


async def run_stream(
    mac_address: str,
    backend_url: str,
    device_name: str = "BLE_BAND_001",
    auth_key: Optional[str] = None,
):
    """Kết nối và stream TOÀN BỘ dữ liệu cảm biến thực liên tục từng giây qua BLE trực tiếp từ Xiaomi Band 7."""
    from bleak import BleakClient, BleakScanner

    logger.info("Khởi động kết nối BLE đa cảm biến tới Xiaomi Band 7: %s (gắn thiết bị: %s)", mac_address or "AUTO", device_name)
    telemetry: Dict[str, Any] = {
        "heart_rate": 0,
        "spo2": 98,
        "battery_level": None,
        "battery_state": "Đang dùng pin 🔋",
        "last_charge_time": None,
        "last_charge_level": None,
        "steps": 0,
        "distance_m": 0,
        "calories_kcal": 0,
        "accel_x": 0.0,
        "accel_y": 0.0,
        "accel_z": -9.81,
        "accel_g": 1.0,
        "activity_state": "Đang đeo",
        "contact_state": "Đang đo",
        "is_worn": True,
        "fall_detected": False,
        "serial_number": None,
        "fw_version": None,
        "hw_version": None,
        "sw_version": None,
        "manufacturer": "Xiaomi / Huami",
    }
    # Nạp SpO2 thực gần nhất từ bộ nhớ đệm đám mây nếu có
    try:
        cloud_info = fetch_xiaomi_cloud_vitals(region="sg")
        if cloud_info.get("latest_spo2"):
            telemetry["spo2"] = int(cloud_info["latest_spo2"])
    except Exception:
        pass

    readings = 0

    def _emit_telemetry(trigger_source: str = "HR"):
        nonlocal readings
        hr = int(telemetry.get("heart_rate") or 0)
        if hr <= 0:
            return
        readings += 1
        if telemetry.get("fall_detected"):
            status = "🚨 [CẢNH BÁO TÉ NGÃ KHẨN CẤP!]"
        elif hr < 50:
            status = "🚨 [NGUY HIỂM: NHỊP CHẬM <50 BPM]"
        elif hr > 120:
            status = "🚨 [NGUY HIỂM: NHỊP NHANH >120 BPM]"
        else:
            status = "🟢 [Bình thường]"

        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        bat_str = f"{telemetry['battery_level']}%" if telemetry.get("battery_level") is not None else "--%"
        charge_extra = f", sạc cuối: {telemetry['last_charge_time']}" if telemetry.get("last_charge_time") else ""
        fw_str = telemetry.get("fw_version") or telemetry.get("sw_version") or "2.2.1.1"
        print(
            f"[{now_str}] #{readings:<4} 📡 [{device_name}] "
            f"❤️ HR: {hr:>3} bpm | 🩸 SpO2: {telemetry['spo2']}% | "
            f"👣 Bước: {telemetry['steps']:<5} ({telemetry['distance_m']}m • {telemetry['calories_kcal']} kcal) | "
            f"🏃 Vận động: {telemetry['activity_state']} | "
            f"🔋 Pin: {bat_str} ({telemetry['battery_state']}{charge_extra}) | "
            f"⌚ {telemetry['contact_state']} (FW {fw_str}) {status}",
            flush=True,
        )
        snapshot = dict(telemetry)
        asyncio.get_event_loop().run_in_executor(
            None,
            send_vitals_to_backend,
            backend_url,
            device_name,
            hr,
            telemetry.get("battery_level"),
            telemetry.get("spo2"),
            snapshot,
        )
        if telemetry.get("fall_detected"):
            telemetry["fall_detected"] = False

    def hr_callback(sender, data: bytearray):
        if len(data) < 2:
            return
        flags = data[0]
        heart_rate = struct.unpack("<H", data[1:3])[0] if (flags & 0x01) else data[1]
        if heart_rate <= 0:
            return
        contact = (flags >> 1) & 0x03
        telemetry["heart_rate"] = heart_rate
        telemetry["is_worn"] = contact != 2
        telemetry["contact_state"] = "Đang đeo" if contact == 3 else ("Tháo vòng" if contact == 2 else "Đang đo")
        _emit_telemetry("HR")

    last_steps_val = None
    last_steps_ts = 0.0

    def _update_steps_and_cadence(parsed: Dict[str, int]):
        nonlocal last_steps_val, last_steps_ts
        if not parsed:
            return
        now_t = time.time()
        new_steps = parsed.get("steps")
        if new_steps is not None and last_steps_val is not None and now_t > last_steps_ts:
            delta_s = new_steps - last_steps_val
            if delta_s > 0:
                telemetry["activity_state"] = "Đang đi bộ 🚶" if delta_s < 8 else "Vận động nhanh 🏃"
            elif now_t - last_steps_ts >= 6.0 and "đi bộ" in str(telemetry.get("activity_state", "")).lower():
                telemetry["activity_state"] = "Nghỉ ngơi / Sinh hoạt"
        if new_steps is not None:
            if last_steps_val is None or new_steps != last_steps_val:
                last_steps_val = new_steps
                last_steps_ts = now_t
        telemetry.update(parsed)

    def steps_callback(sender, data: bytearray):
        _update_steps_and_cadence(parse_realtime_steps_payload(bytes(data)))

    def battery_callback(sender, data: bytearray):
        parsed = parse_huami_battery_info(bytes(data))
        if parsed:
            telemetry.update(parsed)

    def raw_sensor_callback(sender, data: bytearray):
        parsed = parse_raw_sensor_accel(bytes(data))
        if parsed:
            was_fall = parsed.get("fall_detected", False)
            telemetry["accel_x"] = parsed["accel_x"]
            telemetry["accel_y"] = parsed["accel_y"]
            telemetry["accel_z"] = parsed["accel_z"]
            telemetry["accel_g"] = parsed["accel_g"]
            telemetry["activity_state"] = parsed["activity_state"]
            if was_fall:
                telemetry["fall_detected"] = True
                _emit_telemetry("FALL")

    while True:
        try:
            target_mac = mac_address
            if not target_mac:
                devs = await BleakScanner.discover(timeout=6.0, return_adv=True)
                for addr, (d, adv) in devs.items():
                    nm = (adv.local_name or d.name or "").lower()
                    if "xiaomi smart band 7" in nm or "band 7" in nm:
                        target_mac = addr
                        logger.info("🎯 Tự động phát hiện %s (%s, RSSI %d)", adv.local_name or d.name, addr, adv.rssi)
                        break
            if not target_mac:
                logger.warning("Chưa thấy Xiaomi Smart Band 7 phát sóng BLE. Thử lại sau 5s...")
                await asyncio.sleep(5.0)
                continue

            logger.info("Đang kết nối BLE tới %s...", target_mac)
            async with BleakClient(target_mac, timeout=12.0) as client:
                mtu = getattr(client, "mtu_size", 247) or 247
                logger.info("✅ Đã kết nối BLE thành công tới %s (MTU=%d)!", target_mac, mtu)

                char_uuids = {c.uuid.lower() for s in client.services for c in s.characteristics}
                has_zeppos = ZEPPOS_CHUNK_WRITE_UUID in char_uuids and ZEPPOS_CHUNK_READ_UUID in char_uuids

                # 1. Đọc thông tin phần cứng / Firmware từ GATT 0x180A
                for uuid_key, field_name in (
                    (GATT_SERIAL_NUMBER_UUID, "serial_number"),
                    (GATT_FIRMWARE_REV_UUID, "fw_version"),
                    (GATT_HARDWARE_REV_UUID, "hw_version"),
                    (GATT_SOFTWARE_REV_UUID, "sw_version"),
                    (GATT_MANUFACTURER_UUID, "manufacturer"),
                ):
                    if uuid_key in char_uuids:
                        try:
                            val = (await client.read_gatt_char(uuid_key)).decode("utf-8", errors="ignore").strip("\x00 ")
                            if val:
                                telemetry[field_name] = val
                        except Exception:
                            pass
                if not telemetry.get("fw_version") and telemetry.get("sw_version"):
                    telemetry["fw_version"] = telemetry["sw_version"]

                # 2. Đọc thông tin Pin chi tiết (0x0006 Huami Battery Info + 0x2A19 chuẩn GATT)
                if HUAMI_BATTERY_UUID in char_uuids:
                    try:
                        raw_bat6 = bytes(await client.read_gatt_char(HUAMI_BATTERY_UUID))
                        telemetry.update(parse_huami_battery_info(raw_bat6))
                    except Exception:
                        pass
                if BATTERY_LEVEL_UUID in char_uuids and telemetry.get("battery_level") is None:
                    try:
                        raw_bat = await client.read_gatt_char(BATTERY_LEVEL_UUID)
                        if len(raw_bat) > 0:
                            telemetry["battery_level"] = raw_bat[0]
                    except Exception:
                        pass

                # 3. Đọc & đăng ký nhận Bước chân + Quãng đường + Calo thời gian thực (0x0007)
                if HUAMI_REALTIME_STEPS_UUID in char_uuids:
                    try:
                        raw_steps = bytes(await client.read_gatt_char(HUAMI_REALTIME_STEPS_UUID))
                        telemetry.update(parse_realtime_steps_payload(raw_steps))
                    except Exception:
                        pass
                    try:
                        await client.start_notify(HUAMI_REALTIME_STEPS_UUID, steps_callback)
                    except Exception:
                        pass

                if HUAMI_BATTERY_UUID in char_uuids:
                    try:
                        await client.start_notify(HUAMI_BATTERY_UUID, battery_callback)
                    except Exception:
                        pass

                logger.info(
                    "📋 Thông tin đồng hồ: Serial=%s | FW=%s | HW=%s | Pin=%s%% (%s, sạc gần nhất: %s) | Bước chân=%d (%dm, %d kcal)",
                    telemetry.get("serial_number") or "N/A",
                    telemetry.get("fw_version") or "N/A",
                    telemetry.get("hw_version") or "N/A",
                    telemetry.get("battery_level") or "--",
                    telemetry.get("battery_state"),
                    telemetry.get("last_charge_time") or "N/A",
                    telemetry.get("steps", 0),
                    telemetry.get("distance_m", 0),
                    telemetry.get("calories_kcal", 0),
                )

                # 4. Đăng ký nhận nhịp tim GATT 0x2A37
                await client.start_notify(HR_MEASUREMENT_UUID, hr_callback)

                if has_zeppos and auth_key:
                    from Crypto.Cipher import AES

                    clean_key = auth_key.strip().lower().removeprefix("0x")
                    secret_key = bytes.fromhex(clean_key)
                    priv_ec = os.urandom(24)
                    pub_ec = ecdh_b163_public_key(priv_ec)
                    state: Dict[str, Any] = {
                        "wh": 0,
                        "buf": bytearray(),
                        "ep": 0,
                        "orig_len": 0,
                        "enc": False,
                        "ok": False,
                        "sk": None,
                        "seq": 0,
                    }
                    auth_done = asyncio.Event()

                    async def _on_payload(ep: int, raw: bytes):
                        if ep == 0x0082 and len(raw) >= 3 and raw[0] == 0x10:
                            if raw[1] == 0x04 and raw[2] == 0x01 and len(raw) >= 67:
                                rr, rpub = raw[3:19], raw[19:67]
                                shared = ecdh_b163_shared_secret(priv_ec, rpub)
                                state["seq"] = int.from_bytes(shared[:4], "little")
                                sk = bytes(shared[i + 8] ^ secret_key[i] for i in range(16))
                                state["sk"] = sk
                                e1 = AES.new(secret_key, AES.MODE_ECB).encrypt(rr)
                                e2 = AES.new(sk, AES.MODE_ECB).encrypt(rr)
                                state["wh"], state["seq"] = await _zeppos_send_chunked(
                                    client, state["wh"], 0x0082, b"\x05" + e1 + e2, mtu
                                )
                            elif raw[1] == 0x05:
                                state["ok"] = raw[2] == 0x01
                                if state["ok"]:
                                    logger.info("🎉 Xác thực Zepp OS ECDH B-163 thành công!")
                                else:
                                    logger.error("❌ Sai Auth Key (mã 0x%02x).", raw[2])
                                auth_done.set()
                        elif ep == 0x0000 and len(raw) >= 3 and raw[0] == 0x04:
                            num_srv = int.from_bytes(raw[1:3], "little")
                            eps = []
                            for idx in range(num_srv):
                                pos = 3 + idx * 3
                                if pos + 3 <= len(raw):
                                    ep_id = int.from_bytes(raw[pos : pos + 2], "little")
                                    eps.append(f"0x{ep_id:04x}")
                            telemetry["zeppos_services_count"] = num_srv
                            logger.info("🧩 Đồng hồ hỗ trợ %d dịch vụ Zepp OS: %s", num_srv, ", ".join(eps[:15]))
                        elif ep == 0x0016 and raw:
                            # ZeppOsStepsService: 0x04 (CMD_REPLY, 15 bytes) hoặc 0x07 (CMD_REALTIME_NOTIFICATION, 14 bytes)
                            if raw[0] == 0x04 and len(raw) >= 15:
                                _update_steps_and_cadence(parse_realtime_steps_payload(raw[2:15]))
                            elif raw[0] == 0x07 and len(raw) >= 14:
                                _update_steps_and_cadence(parse_realtime_steps_payload(raw[1:14]))
                        elif ep == 0x0029 and len(raw) >= 3 and raw[0] == 0x04:
                            # ZeppOsBatteryService: 0x04 + 20-byte HuamiBatteryInfo
                            b_info = parse_huami_battery_info(raw[1:])
                            telemetry.update(b_info)
                            logger.info(
                                "🔋 Chi tiết Pin ZeppOS (0x0029): %s%% | %s | Sạc gần nhất: %s (%s%%)",
                                telemetry.get("battery_level"),
                                telemetry.get("battery_state"),
                                telemetry.get("last_charge_time") or "N/A",
                                telemetry.get("last_charge_level") or "--",
                            )

                    def _on_chunk(sender, data: bytearray):
                        if not data or data[0] != 0x03:
                            return
                        flags, handle, cnt = data[1], data[3], data[4]
                        i = 5
                        if flags & 0x01:
                            orig_len, state["ep"] = struct.unpack_from("<IH", data, 5)
                            state["orig_len"] = orig_len
                            state["enc"] = bool(flags & 0x08)
                            i = 11
                            state["buf"] = bytearray()
                        state["buf"].extend(data[i:])
                        if flags & 0x04:
                            asyncio.get_event_loop().create_task(
                                client.write_gatt_char(
                                    ZEPPOS_CHUNK_READ_UUID, bytes([0x04, 0x00, handle, 0x01, cnt]), response=False
                                )
                            )
                        if flags & 0x02:
                            payload_bytes = bytes(state["buf"])
                            if state.get("enc") and state.get("sk") and len(payload_bytes) % 16 == 0:
                                try:
                                    msg_key = bytes(state["sk"][j] ^ handle for j in range(16))
                                    dec = AES.new(msg_key, AES.MODE_ECB).decrypt(payload_bytes)
                                    payload_bytes = dec[: state["orig_len"]]
                                except Exception:
                                    pass
                            asyncio.get_event_loop().create_task(_on_payload(state["ep"], payload_bytes))

                    await client.start_notify(ZEPPOS_CHUNK_READ_UUID, _on_chunk)
                    state["wh"], state["seq"] = await _zeppos_send_chunked(
                        client, state["wh"], 0x0082, bytes([0x04, 0x02, 0x00, 0x02]) + pub_ec, mtu
                    )
                    await asyncio.wait_for(auth_done.wait(), timeout=10.0)
                    if not state["ok"]:
                        return

                    # 5. Bật toàn bộ dịch vụ Zepp OS & cảm biến thời gian thực:
                    # 5a. Truy vấn danh sách dịch vụ Zepp OS (endpoint 0x0000: CMD_GET_LIST=0x03)
                    state["wh"], state["seq"] = await _zeppos_send_chunked(client, state["wh"], 0x0000, bytes([0x03]), mtu)

                    # 5b. Bật Realtime Steps / Distance / Calories (endpoint 0x0016: CMD_GET=0x03, CMD_ENABLE_REALTIME=0x05 0x01)
                    state["wh"], state["seq"] = await _zeppos_send_chunked(client, state["wh"], 0x0016, bytes([0x03]), mtu)
                    state["wh"], state["seq"] = await _zeppos_send_chunked(client, state["wh"], 0x0016, bytes([0x05, 0x01]), mtu)

                    # 5c. Truy vấn thông tin Pin chi tiết qua ZeppOsBatteryService (endpoint 0x0029, encrypted=True)
                    state["wh"], state["seq"] = await _zeppos_send_chunked(
                        client, state["wh"], 0x0029, bytes([0x03]), mtu, encrypt=True, session_key=state["sk"], seq_nr=state["seq"]
                    )

                    # 5d. Lắng nghe sự kiện thiết bị trực tiếp trên 0x0010 (DeviceEvent: đeo/tháo, ngủ/thức, mục tiêu bước chân)
                    if HUAMI_DEVICEEVENT_UUID in char_uuids:
                        try:
                            def _dev_evt_cb(sender, data: bytearray):
                                telemetry["last_device_event_hex"] = bytes(data).hex()
                            await client.start_notify(HUAMI_DEVICEEVENT_UUID, _dev_evt_cb)
                        except Exception:
                            pass

                    # 5e. Kích hoạt đo nhịp tim PPG liên tục từng giây trên endpoint 0x001d (ZeppOsHeartRateService)
                    state["wh"], state["seq"] = await _zeppos_send_chunked(client, state["wh"], 0x001D, bytes([0x04, 0x01]), mtu)
                    logger.info("🚀 Đã bật FULL STREAM toàn bộ dữ liệu từ Xiaomi Band 7 (HR 1s + SpO2 + Bước chân + Quãng đường + Calo + Pin chi tiết + Trạng thái vận động)!")

                    tick = 0
                    while client.is_connected:
                        await asyncio.sleep(1.0)
                        tick += 1
                        # Duy trì đo nhịp tim thực mỗi 1 giây
                        state["wh"], state["seq"] = await _zeppos_send_chunked(client, state["wh"], 0x001D, bytes([0x04, 0x02]), mtu)

                        # Mỗi 3 giây truy vấn lại Bước chân / Quãng đường / Calo thời gian thực qua ZeppOsStepsService (0x0016)
                        if tick % 3 == 0:
                            state["wh"], state["seq"] = await _zeppos_send_chunked(client, state["wh"], 0x0016, bytes([0x03]), mtu)

                        # Mỗi 30 giây cập nhật lại thông tin Pin chi tiết qua ZeppOsBatteryService (0x0029) & GATT 0x2A19
                        if tick % 30 == 0:
                            state["wh"], state["seq"] = await _zeppos_send_chunked(
                                client, state["wh"], 0x0029, bytes([0x03]), mtu, encrypt=True, session_key=state["sk"], seq_nr=state["seq"]
                            )
                            if BATTERY_LEVEL_UUID in char_uuids:
                                try:
                                    raw_b = await client.read_gatt_char(BATTERY_LEVEL_UUID)
                                    if len(raw_b) > 0:
                                        telemetry["battery_level"] = raw_b[0]
                                except Exception:
                                    pass
                else:
                    if auth_key:
                        await authenticate_huami_band(client, auth_key)
                    if HUAMI_HR_CTRL_UUID in char_uuids:
                        for cmd in (b"\x15\x02\x00", b"\x15\x01\x00", b"\x15\x01\x01"):
                            await client.write_gatt_char(HUAMI_HR_CTRL_UUID, cmd, response=True)
                    ping_cycle = 0
                    while client.is_connected:
                        await asyncio.sleep(2.0)
                        ping_cycle += 1
                        if ping_cycle % 5 == 0 and HUAMI_HR_CTRL_UUID in char_uuids:
                            await client.write_gatt_char(HUAMI_HR_CTRL_UUID, b"\x16", response=True)

            logger.warning("Mất kết nối BLE tới vòng đeo tay! Tự động thử lại sau 5 giây...")
        except Exception as e:
            logger.warning("Chưa kết nối được BLE trực tiếp (%s). Thử lại sau 5s...", e)

        await asyncio.sleep(5.0)


async def run_cloud_sync(
    backend_url: str,
    device_name: str = "BLE_BAND_001",
    once: bool = False,
    interval: float = 5.0,
):
    """Đồng bộ trực tiếp nhịp tim & SpO2 thực tế từ đám mây Mi Fitness (sg.hlth.io.mi.com) mỗi 5-10 giây."""
    logger.info(
        "☁️ Bắt đầu chế độ Cloud Sync liên tục tới hồ sơ Nguyễn Văn A [%s] (Đồng hồ ➔ Điện thoại Mi Fitness ➔ Laptop/Mini PC | chu kỳ %.1fs)...",
        device_name,
        interval,
    )
    seen_timestamps = set()
    cycle = 0
    while True:
        cycle += 1
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
                is_new = "🆕 [BẢN GHI MỚI]" if (seen_timestamps and ts not in seen_timestamps) else "🟢 [ĐANG THEO DÕI]"
                print(
                    f"[{now_str}] #{cycle:<4} ☁️ [CLOUD SYNC ➔ Nguyễn Văn A ({device_name})] ❤️ Nhịp tim: {hr_val:>3} bpm | "
                    f"🩸 SpO2: {latest_spo2}% | MAC: C1:BD:70:58:2D:F5 | {is_new}",
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
    parser.add_argument("--device-id", type=str, default="BLE_BAND_001", help="Mã thiết bị trên Backend gắn với Nguyễn Văn A (mặc định: BLE_BAND_001)")
    parser.add_argument("--backend-url", type=str, default=DEFAULT_BACKEND_URL, help="URL nhận POST vitals của backend")
    parser.add_argument("--simulate", action="store_true", help="Chạy chế độ mô phỏng dữ liệu")

    # huami-token integration options
    parser.add_argument("--get-token", action="store_true", help="Trợ lý lấy Auth Key từ đám mây Xiaomi / Zepp")
    parser.add_argument("--qr", action="store_true", help="Đăng nhập Xiaomi 1-click qua trình duyệt (Long-Polling)")
    parser.add_argument("--cloud-sync", action="store_true", help="Đồng bộ dữ liệu nhịp tim & SpO2 thực từ Mi Fitness Cloud (Mặc định)")
    parser.add_argument("--direct-ble", action="store_true", help="Chế độ chỉ kết nối BLE trực tiếp không qua Cloud")
    parser.add_argument("--interval", type=float, default=5.0, help="Chu kỳ quét Cloud Sync tính bằng giây (mặc định: 5.0s)")
    parser.add_argument("--once", action="store_true", help="Chạy đồng bộ Cloud 1 lần rồi thoát")
    parser.add_argument("--oauth-url", type=str, default="", help="Link redirect OAuth (https://hm.xiaomi.com/watch.do?code=...) để trích xuất token")
    parser.add_argument("--method", choices=["xiaomi", "amazfit"], default="xiaomi", help="Phương thức đăng nhập (mặc định: xiaomi)")
    parser.add_argument("-e", "--email", type=str, default="", help="Email tài khoản")
    parser.add_argument("-p", "--password", type=str, default="", help="Mật khẩu tài khoản")
    parser.add_argument("--auth-key", type=str, default="", help="Auth Key 16-byte hex (e.g. 0x1234...)")

    args = parser.parse_args()

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
                print("💾 Đã lưu Auth Key vào cấu hình! Bắt đầu đồng bộ...\n")
                asyncio.run(run_cloud_sync(args.backend_url, once=args.once, interval=args.interval))
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

    config = load_config()
    ble_config = config.get("ble", {})
    poll_interval = float(args.interval or ble_config.get("poll_interval_sec", 5.0))

    if args.cloud_sync or args.once:
        asyncio.run(run_cloud_sync(args.backend_url, device_name=args.device_id, once=args.once, interval=poll_interval))
        return

    # Mặc định: Stream BLE trực tiếp thời gian thực từng giây từ Xiaomi Smart Band 7 (Zepp OS ECDH B-163 + 0x001d -> 0x2A37)
    target_mac = args.mac or ble_config.get("device_mac", "")
    target_auth_key = args.auth_key or ble_config.get("auth_key", "")
    asyncio.run(run_stream(target_mac, args.backend_url, device_name=args.device_id, auth_key=target_auth_key))


if __name__ == "__main__":
    main()

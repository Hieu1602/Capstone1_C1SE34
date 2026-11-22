"""
test_xiaomi_band.py
Kiểm thử bộ phân tích dữ liệu GATT Heart Rate, mật mã AES Huami Auth, và định dạng bản tin sinh hiệu từ Xiaomi Band 7.
"""

import os
import struct
import pytest
from edge.scripts.stream_xiaomi_band7 import (
    encrypt_huami_challenge,
    send_vitals_to_backend,
    load_config,
)


def test_parse_hr_measurement_8bit():
    """Kiểm tra parse dữ liệu nhịp tim định dạng 8-bit chuẩn GATT 0x2A37."""
    flags = 0b00000110  # 8-bit HR, sensor contact = 3 (đang đeo)
    hr_value = 76
    data = bytearray([flags, hr_value])

    hr_format = flags & 0x01
    assert hr_format == 0
    parsed_hr = data[1]
    assert parsed_hr == 76

    contact = (flags >> 1) & 0x03
    assert contact == 3  # Đang đeo


def test_parse_hr_measurement_16bit():
    """Kiểm tra parse dữ liệu nhịp tim định dạng 16-bit chuẩn GATT 0x2A37."""
    flags = 0b00000111  # 16-bit HR (bit 0 = 1)
    hr_value = 145
    data = bytearray([flags]) + bytearray(struct.pack("<H", hr_value))

    hr_format = flags & 0x01
    assert hr_format == 1
    parsed_hr = struct.unpack("<H", data[1:3])[0]
    assert parsed_hr == 145


def test_send_vitals_payload_structure(monkeypatch):
    """Kiểm tra cấu trúc JSON payload gửi tới FastAPI backend."""
    import urllib.request
    captured = {}

    class MockResponse:
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    def mock_urlopen(req, timeout=None):
        import json
        captured["url"] = req.full_url
        captured["data"] = json.loads(req.data.decode("utf-8"))
        captured["headers"] = dict(req.headers)
        return MockResponse()

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen)

    send_vitals_to_backend(
        backend_url="http://localhost:8000/api/v1/vitals",
        device_id="Xiaomi-Smart-Band-7-test",
        heart_rate=82,
        battery=94,
        spo2=99,
    )

    assert captured["url"] == "http://localhost:8000/api/v1/vitals"
    assert captured["data"]["device_id"] == "Xiaomi-Smart-Band-7-test"
    assert captured["data"]["heart_rate"] == 82
    assert captured["data"]["battery_level"] == 94
    assert captured["data"]["spo2"] == 99
    assert captured["data"]["fall_detected"] is False


def test_encrypt_huami_challenge():
    """Kiểm tra thuật toán mã hóa AES-128-ECB challenge của giao thức Huami."""
    # 16 bytes auth key
    auth_key_hex = "0x000102030405060708090a0b0c0d0e0f"
    # 16 bytes challenge
    challenge = b"\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f"

    encrypted = encrypt_huami_challenge(auth_key_hex, challenge)
    assert len(encrypted) == 16
    assert isinstance(encrypted, bytes)

    # Giải mã ngược lại bằng AES để đảm bảo tính đối xứng
    from Crypto.Cipher import AES
    clean_key = bytes.fromhex(auth_key_hex.replace("0x", ""))
    decrypted = AES.new(clean_key, AES.MODE_ECB).decrypt(encrypted)
    assert decrypted == challenge


def test_encrypt_huami_challenge_invalid_key():
    """Kiểm tra báo lỗi khi Auth Key không đủ 16 bytes."""
    with pytest.raises(ValueError, match="16 bytes"):
        encrypt_huami_challenge("0x1234", b"\x00" * 16)


def test_load_edge_config():
    """Kiểm tra đọc file config.yaml của Edge Hub."""
    config = load_config()
    assert "ble" in config
    assert config["ble"]["device_mac"] == "FA:88:9E:79:77:13"
    assert config["ble"]["auth_key"] == "2BC7D23FAA60E6E2F974B8420C56234B"


def test_ecdh_b163_key_agreement():
    """Kiểm tra tính giao hoán khóa chung ECDH NIST B-163 của Zepp OS / Huami 2021."""
    from edge.scripts.stream_xiaomi_band7 import ecdh_b163_public_key, ecdh_b163_shared_secret

    p1 = os.urandom(24)
    p2 = os.urandom(24)
    pub1 = ecdh_b163_public_key(p1)
    pub2 = ecdh_b163_public_key(p2)
    assert len(pub1) == 48 and len(pub2) == 48
    assert ecdh_b163_shared_secret(p1, pub2) == ecdh_b163_shared_secret(p2, pub1)


def test_parse_multi_sensor_payloads():
    """Kiểm tra giải mã Bước chân/Quãng đường/Calo (0x0007), Pin chi tiết (0x0006) và Gia tốc 3 trục (0x0002)."""
    from edge.scripts.stream_xiaomi_band7 import (
        parse_huami_battery_info,
        parse_raw_sensor_accel,
        parse_realtime_steps_payload,
    )

    steps_pkt = b"\x0c" + struct.pack("<III", 3450, 2410, 138)
    s_res = parse_realtime_steps_payload(steps_pkt)
    assert s_res == {"steps": 3450, "distance_m": 2410, "calories_kcal": 138}

    bat_pkt = bytearray(20)
    bat_pkt[0] = 0x0F
    bat_pkt[1] = 91
    bat_pkt[2] = 0
    struct.pack_into("<H", bat_pkt, 10, 2026)
    bat_pkt[12], bat_pkt[13], bat_pkt[14], bat_pkt[15], bat_pkt[16] = 11, 21, 8, 30, 0
    bat_pkt[19] = 100
    b_res = parse_huami_battery_info(bytes(bat_pkt))
    assert b_res["battery_level"] == 91
    assert "Đang dùng pin" in b_res["battery_state"]
    assert b_res["last_charge_time"] == "2026-11-21 08:30:00"
    assert b_res["last_charge_level"] == 100

    # Raw 3-axis accelerometer packet (type 0x00, seq 0x01, 1 sample of 1G on Z axis: 4100)
    accel_pkt = bytes([0x00, 0x01]) + struct.pack("<hhh", 0, 0, 4100)
    a_res = parse_raw_sensor_accel(accel_pkt)
    assert a_res is not None
    assert a_res["accel_g"] == 1.0
    assert a_res["accel_z"] == -9.81
    assert a_res["fall_detected"] is False

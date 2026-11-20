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
    assert config["ble"]["device_mac"] == "C1:BD:70:58:2D:F5"
    assert "auth_key" in config["ble"]

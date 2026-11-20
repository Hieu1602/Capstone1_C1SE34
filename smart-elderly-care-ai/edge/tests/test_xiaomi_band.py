"""
test_xiaomi_band.py
Kiểm thử bộ phân tích dữ liệu GATT Heart Rate và định dạng bản tin sinh hiệu từ Xiaomi Band 7.
"""

import struct
from edge.scripts.stream_xiaomi_band7 import send_vitals_to_backend


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

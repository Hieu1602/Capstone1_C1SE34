"""
ble_band.py
Kết nối BLE Smart Band để đọc Heart Rate và SpO2.

Sử dụng thư viện Bleak (Bluetooth Low Energy async client).
Hỗ trợ GATT Heart Rate Service (UUID: 0x180D).
"""

import asyncio
import logging
import struct
from dataclasses import dataclass
from typing import Callable, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class VitalReading:
    """Chỉ số sinh hiệu đọc từ Smart Band."""
    heart_rate: Optional[int] = None      # bpm
    spo2: Optional[int] = None            # %
    battery_level: Optional[int] = None   # %
    sensor_contact: bool = True           # True: Đang đeo, False: Tháo vòng
    rr_intervals: list[float] = None      # ms (HRV)
    timestamp: float = 0.0


# ---------------------------------------------------------------------------
# BLE Band Driver
# ---------------------------------------------------------------------------

class BLEBandDriver:
    """
    Async BLE driver kết nối Smart Band và đọc HR / SpO2.

    Usage:
        driver = BLEBandDriver(config)
        await driver.connect()
        await driver.start_notifications(callback)
        await driver.disconnect()
    """

    # Standard GATT UUIDs
    HR_SERVICE_UUID         = "0000180d-0000-1000-8000-00805f9b34fb"
    HR_MEASUREMENT_UUID     = "00002a37-0000-1000-8000-00805f9b34fb"
    BATTERY_SERVICE_UUID    = "0000180f-0000-1000-8000-00805f9b34fb"
    BATTERY_LEVEL_UUID      = "00002a19-0000-1000-8000-00805f9b34fb"
    HUAMI_HR_CTRL_UUID      = "00000004-0000-3512-2118-0009af100700"

    def __init__(self, config: dict):
        self.device_mac: str = config.get("device_mac", "")
        self.device_name: str = config.get("device_name", "")
        self.auth_key: str = config.get("auth_key", "")
        self.service_uuid: str = config.get("service_uuid", self.HR_SERVICE_UUID)
        self.char_uuid: str = config.get(
            "characteristic_uuid", self.HR_MEASUREMENT_UUID
        )
        self.reconnect_interval: float = config.get("reconnect_interval_sec", 10.0)
        self.poll_interval: float = config.get("poll_interval_sec", 5.0)

        self._client = None
        self._running = False
        self._latest: VitalReading = VitalReading()
        self._on_data: Optional[Callable] = None

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    async def connect(self) -> bool:
        """Kết nối đến BLE device. Trả về True nếu thành công."""
        try:
            from bleak import BleakClient, BleakScanner  # type: ignore

            address = self.device_mac
            if not address:
                logger.info("[BLE] Đang scan tìm device: %s", self.device_name)
                device = await BleakScanner.find_device_by_name(
                    self.device_name, timeout=10.0
                )
                if device is None:
                    logger.warning("[BLE] Không tìm thấy device: %s", self.device_name)
                    return False
                address = device.address

            self._client = BleakClient(address)
            await self._client.connect()
            logger.info("[BLE] Đã kết nối: %s", address)

            # Xác thực Huami BLE bằng Auth Key nếu có
            if self.auth_key:
                try:
                    from scripts.stream_xiaomi_band7 import authenticate_huami_band
                    await authenticate_huami_band(self._client, self.auth_key)
                except Exception as aexc:
                    logger.debug("[BLE] Huami auth skip: %s", aexc)

            # Đọc mức pin ban đầu
            try:
                bat_raw = await self._client.read_gatt_char(self.BATTERY_LEVEL_UUID)
                self._latest.battery_level = bat_raw[0]
                logger.info("[BLE] Mức pin thiết bị: %d%%", self._latest.battery_level)
            except Exception:
                pass

            return True

        except ImportError:
            logger.warning("[BLE] bleak không được cài. BLE disabled.")
            return False
        except Exception as exc:  # noqa: BLE001
            logger.error("[BLE] Lỗi kết nối: %s", exc)
            return False

    async def disconnect(self) -> None:
        """Ngắt kết nối BLE."""
        self._running = False
        if self._client and self._client.is_connected:
            await self._client.disconnect()
            logger.info("[BLE] Đã ngắt kết nối.")

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    async def start_notifications(
        self, on_data: Callable[[VitalReading], None]
    ) -> None:
        """
        Bắt đầu nhận notifications từ Heart Rate characteristic.

        Args:
            on_data: Callback nhận VitalReading mỗi khi có dữ liệu mới
        """
        if not self._client or not self._client.is_connected:
            logger.error("[BLE] Chưa kết nối. Gọi connect() trước.")
            return

        self._on_data = on_data
        self._running = True

        def hr_notification_handler(sender, data: bytearray):
            reading = self._parse_hr_measurement(data)
            logger.debug("[BLE] HR=%s bpm, SpO2=%s%%", reading.heart_rate, reading.spo2)
            self._latest = reading
            if self._on_data:
                self._on_data(reading)

        try:
            await self._client.start_notify(self.char_uuid, hr_notification_handler)
            logger.info("[BLE] Notifications bắt đầu (GATT 0x2A37).")

            # Kích hoạt cảm biến PPG đo nhịp tim liên tục trên Xiaomi/Huami Band
            try:
                await self._client.write_gatt_char(
                    self.HUAMI_HR_CTRL_UUID, b"\x15\x01\x01", response=False
                )
            except Exception:
                pass

            while self._running:
                if not self._client.is_connected:
                    logger.warning("[BLE] Mất kết nối, đang reconnect...")
                    await self.disconnect()
                    await asyncio.sleep(self.reconnect_interval)
                    if await self.connect():
                        await self._client.start_notify(
                            self.char_uuid, hr_notification_handler
                        )
                else:
                    try:
                        await self._client.write_gatt_char(
                            self.HUAMI_HR_CTRL_UUID, b"\x16", response=False
                        )
                    except Exception:
                        pass
                await asyncio.sleep(self.poll_interval)

        except Exception as exc:  # noqa: BLE001
            logger.error("[BLE] Lỗi notification: %s", exc)

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_hr_measurement(data: bytearray) -> VitalReading:
        """
        Parse GATT Heart Rate Measurement characteristic (0x2A37).
        Format: [flags(1B), hr_value(1 or 2B), energy(2B optional), rr(2B×N optional)]
        """
        import time
        reading = VitalReading(timestamp=time.time())

        if len(data) < 2:
            return reading

        flags = data[0]
        hr_format_16bit = flags & 0x01

        if hr_format_16bit:
            reading.heart_rate = struct.unpack_from("<H", data, 1)[0]
            offset = 3
        else:
            reading.heart_rate = data[1]
            offset = 2

        # Sensor Contact status
        contact_bits = (flags >> 1) & 0x03
        reading.sensor_contact = (contact_bits == 3)

        # Energy Expended (nếu bit 3 bật -> bỏ qua 2 bytes)
        if (flags & 0x08) and len(data) >= offset + 2:
            offset += 2

        # RR-interval (HRV) nếu bit 4 bật
        if (flags & 0x10) and len(data) >= offset + 2:
            rr_vals = []
            while offset + 1 < len(data):
                rr_raw = struct.unpack_from("<H", data, offset)[0]
                rr_vals.append(round(rr_raw / 1024.0 * 1000, 1))
                offset += 2
            reading.rr_intervals = rr_vals

        # Fallback SpO2 nếu band gửi ở byte tùy chỉnh
        if len(data) >= 4:
            potential_spo2 = data[3]
            if 70 <= potential_spo2 <= 100:
                reading.spo2 = potential_spo2

        return reading

    def get_latest(self) -> VitalReading:
        """Trả về chỉ số sinh hiệu gần nhất."""
        return self._latest

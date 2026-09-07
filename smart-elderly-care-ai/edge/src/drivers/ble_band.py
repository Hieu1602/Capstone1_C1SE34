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

    def __init__(self, config: dict):
        self.device_mac: str = config.get("device_mac", "")
        self.device_name: str = config.get("device_name", "")
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
            logger.info("[BLE] Notifications bắt đầu.")

            while self._running:
                if not self._client.is_connected:
                    logger.warning("[BLE] Mất kết nối, đang reconnect...")
                    await self.disconnect()
                    await asyncio.sleep(self.reconnect_interval)
                    if await self.connect():
                        await self._client.start_notify(
                            self.char_uuid, hr_notification_handler
                        )
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
        else:
            reading.heart_rate = data[1]

        # SpO2 thường nằm ở byte tùy chỉnh (không chuẩn GATT)
        # Một số band gửi SpO2 ở byte 2 hoặc 3
        if len(data) >= 4:
            potential_spo2 = data[3]
            if 70 <= potential_spo2 <= 100:
                reading.spo2 = potential_spo2

        return reading

    def get_latest(self) -> VitalReading:
        """Trả về chỉ số sinh hiệu gần nhất."""
        return self._latest

"""
thermal_amg8833.py
Driver đọc dữ liệu nhiệt độ từ cảm biến AMG8833 qua I2C.

AMG8833: Ma trận nhiệt 8×8 pixel, range -20°C ~ 80°C.
Giao tiếp qua I2C (bus 1, address 0x69 hoặc 0x68).
"""

import logging
import time
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# AMG8833 Registers
AMG8833_PCTL_REG    = 0x00  # Power Control
AMG8833_RST_REG     = 0x01  # Reset
AMG8833_FPSC_REG    = 0x02  # Frame Rate
AMG8833_INTC_REG    = 0x03  # Interrupt Control
AMG8833_STAT_REG    = 0x04  # Status
AMG8833_SCLR_REG    = 0x05  # Status Clear
AMG8833_TTHL_REG    = 0x0E  # Thermistor (Low)
AMG8833_TTHH_REG    = 0x0F  # Thermistor (High)
AMG8833_PIXEL_BASE  = 0x80  # Pixel data start


class ThermalAMG8833Driver:
    """
    Driver cảm biến nhiệt AMG8833.

    Usage:
        sensor = ThermalAMG8833Driver(config)
        sensor.initialize()
        grid, max_temp = sensor.read_thermal_grid()
    """

    PIXEL_COUNT = 64  # 8×8

    def __init__(self, config: dict):
        self.bus_id: int = config.get("i2c_bus", 1)
        self.address: int = config.get("i2c_address", 0x69)
        self.poll_interval: float = config.get("poll_interval_sec", 2.0)
        self._bus = None
        self._last_read: Optional[np.ndarray] = None

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def initialize(self) -> None:
        """Khởi tạo I2C bus và cấu hình cảm biến."""
        try:
            import smbus2  # type: ignore
            self._bus = smbus2.SMBus(self.bus_id)
            # Normal mode
            self._bus.write_byte_data(self.address, AMG8833_PCTL_REG, 0x00)
            time.sleep(0.05)
            # Software reset
            self._bus.write_byte_data(self.address, AMG8833_RST_REG, 0x3F)
            time.sleep(0.05)
            # Frame rate 10 FPS
            self._bus.write_byte_data(self.address, AMG8833_FPSC_REG, 0x00)
            time.sleep(0.05)
            logger.info("[AMG8833] Cảm biến nhiệt khởi tạo thành công.")
        except ImportError:
            logger.warning("[AMG8833] smbus2 không khả dụng. Chạy ở chế độ mock.")
        except Exception as exc:  # noqa: BLE001
            logger.error("[AMG8833] Lỗi khởi tạo I2C: %s", exc)

    # ------------------------------------------------------------------
    # Data Reading
    # ------------------------------------------------------------------

    def read_thermal_grid(self) -> Tuple[Optional[np.ndarray], Optional[float]]:
        """
        Đọc ma trận nhiệt độ 8×8 từ cảm biến.

        Returns:
            (grid_celsius, max_temp) hoặc (None, None) nếu lỗi.
            grid_celsius: numpy float32 array shape (8, 8)
        """
        if self._bus is None:
            return self._mock_read()

        try:
            raw = self._bus.read_i2c_block_data(
                self.address, AMG8833_PIXEL_BASE, self.PIXEL_COUNT * 2
            )
            pixels = []
            for i in range(self.PIXEL_COUNT):
                low  = raw[i * 2]
                high = raw[i * 2 + 1]
                value = (high << 8) | low
                # 12-bit two's complement
                if value & 0x800:
                    value -= 0x1000
                temp_c = value * 0.25
                pixels.append(temp_c)

            grid = np.array(pixels, dtype=np.float32).reshape(8, 8)
            self._last_read = grid
            return grid, float(grid.max())

        except Exception as exc:  # noqa: BLE001
            logger.error("[AMG8833] Lỗi đọc dữ liệu: %s", exc)
            return None, None

    def read_device_temperature(self) -> Optional[float]:
        """Đọc nhiệt độ thermistor nội bộ của AMG8833 (°C)."""
        if self._bus is None:
            return 25.0  # Mock

        try:
            raw = self._bus.read_i2c_block_data(self.address, AMG8833_TTHL_REG, 2)
            low  = raw[0]
            high = raw[1]
            value = ((high & 0x07) << 8) | low
            if high & 0x08:
                value -= 0x1000
            return value * 0.0625
        except Exception as exc:  # noqa: BLE001
            logger.error("[AMG8833] Lỗi đọc thermistor: %s", exc)
            return None

    def get_last_grid(self) -> Optional[np.ndarray]:
        """Trả về ma trận nhiệt độ từ lần đọc gần nhất."""
        return self._last_read

    # ------------------------------------------------------------------
    # Mock for Testing
    # ------------------------------------------------------------------

    def _mock_read(self) -> Tuple[np.ndarray, float]:
        """Sinh dữ liệu giả lập khi không có phần cứng thực."""
        grid = np.random.uniform(32.0, 36.5, (8, 8)).astype(np.float32)
        return grid, float(grid.max())

    def close(self) -> None:
        """Đóng kết nối I2C bus."""
        if self._bus:
            self._bus.close()
            self._bus = None
            logger.info("[AMG8833] I2C bus đã đóng.")

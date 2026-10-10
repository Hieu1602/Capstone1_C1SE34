"""
drivers/ – Hardware Abstraction Layer (HAL) cho Edge Gateway.

Mỗi driver implement BaseDriver để đảm bảo interface thống nhất.
"""

from src.drivers.base import BaseDriver
from src.drivers.camera import CameraDriver
from src.drivers.ble_band import BLEBandDriver, VitalReading
from src.drivers.thermal_amg8833 import ThermalAMG8833Driver

__all__ = [
    "BaseDriver",
    "CameraDriver",
    "BLEBandDriver",
    "VitalReading",
    "ThermalAMG8833Driver",
]

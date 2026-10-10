"""
base.py – Abstract Base Class cho tất cả Hardware Drivers.

Áp dụng Port & Adapter pattern: mỗi driver là một Adapter
implement Port (BaseDriver), giúp dễ dàng swap hoặc mock
trong unit testing mà không thay đổi business logic.
"""

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseDriver(ABC):
    """
    Abstract base class cho tất cả hardware drivers của Edge Gateway.

    Mọi driver (Camera, BLE, Thermal) phải kế thừa class này và
    implement các phương thức vòng đời: initialize, start, stop, is_healthy.

    Design pattern: Template Method + Port & Adapter.

    Usage:
        class MyDriver(BaseDriver):
            def initialize(self) -> None: ...
            def is_healthy(self) -> bool: ...
    """

    def __init__(self, config: dict) -> None:
        self.config = config
        self._initialized: bool = False
        self.logger = logging.getLogger(self.__class__.__name__)

    # ------------------------------------------------------------------
    # Abstract Interface (Port definition)
    # ------------------------------------------------------------------

    @abstractmethod
    def initialize(self) -> None:
        """Khởi tạo kết nối / tài nguyên phần cứng."""

    @abstractmethod
    def is_healthy(self) -> bool:
        """Kiểm tra driver có đang hoạt động bình thường không."""

    # ------------------------------------------------------------------
    # Optional lifecycle hooks (có thể override)
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Bắt đầu hoạt động (override nếu cần background thread/task)."""
        if not self._initialized:
            self.initialize()
            self._initialized = True
        self.logger.info("[%s] Driver started.", self.__class__.__name__)

    def stop(self) -> None:
        """Dừng hoạt động và giải phóng tài nguyên."""
        self._initialized = False
        self.logger.info("[%s] Driver stopped.", self.__class__.__name__)

    def close(self) -> None:
        """Alias của stop() – để tương thích backward."""
        self.stop()

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        status = "healthy" if self.is_healthy() else "unhealthy"
        return f"<{self.__class__.__name__} status={status}>"

"""
base.py – Abstract Base Class cho tất cả AI Inference Models.

Cung cấp interface thống nhất để load model, inference, và release tài nguyên.
Áp dụng Strategy pattern: mỗi model là một ConcreteStrategy.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any


class BaseAIModel(ABC):
    """
    Abstract base class cho tất cả AI/ML models của Edge Gateway.

    Các model kế thừa class này phải implement:
    - load_model(): nạp weights từ file
    - predict(): chạy inference trên một input
    - release(): giải phóng GPU/memory resources

    Design pattern: Strategy + Template Method.

    Usage:
        class MyModel(BaseAIModel):
            def load_model(self) -> None: ...
            def predict(self, input: Any) -> Any: ...
            def release(self) -> None: ...
    """

    def __init__(self, config: dict) -> None:
        self.config = config
        self._model_loaded: bool = False
        self.logger = logging.getLogger(self.__class__.__name__)

    # ------------------------------------------------------------------
    # Abstract Interface
    # ------------------------------------------------------------------

    @abstractmethod
    def load_model(self) -> None:
        """Nạp model weights vào bộ nhớ / GPU."""

    @abstractmethod
    def predict(self, input: Any) -> Any:
        """Chạy inference. Input/output type phụ thuộc vào từng model."""

    @abstractmethod
    def release(self) -> None:
        """Giải phóng model khỏi bộ nhớ."""

    # ------------------------------------------------------------------
    # Optional lifecycle helpers
    # ------------------------------------------------------------------

    def is_loaded(self) -> bool:
        """Kiểm tra model đã được nạp vào bộ nhớ chưa."""
        return self._model_loaded

    def __repr__(self) -> str:
        state = "loaded" if self._model_loaded else "unloaded"
        return f"<{self.__class__.__name__} state={state}>"

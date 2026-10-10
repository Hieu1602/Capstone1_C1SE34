"""
main.py
Entry point tối giản – Khởi chạy Edge Gateway trên Orange Pi 5.

Trách nhiệm DUY NHẤT của file này:
  1. Thiết lập sys.path và logging
  2. Load config từ YAML + environment variables
  3. Khởi tạo EdgeApp và chạy

Toàn bộ business logic đã được chuyển sang:
  - src/app.py          : EdgeApp orchestrator
  - src/services/alert_dispatcher.py : Alert fan-out
  - src/drivers/base.py : BaseDriver interface
  - src/ai/base.py      : BaseAIModel interface
"""

import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

# Thêm thư mục gốc của edge vào sys.path để hỗ trợ chạy trực tiếp trên mọi OS
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yaml

from src.app import EdgeApp

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("EdgeGateway")


# ---------------------------------------------------------------------------
# Config Loader
# ---------------------------------------------------------------------------

def load_config(path: str = "config/config.yaml") -> dict:
    """Load YAML config và override bằng environment variables nhạy cảm."""
    config_path = Path(__file__).parent.parent / path
    with open(config_path, "r", encoding="utf-8") as f:
        loaded = yaml.safe_load(f)
    cfg: dict = loaded if isinstance(loaded, dict) else {}

    mqtt_cfg = cfg.setdefault("mqtt", {})
    if isinstance(mqtt_cfg, dict):
        mqtt_cfg["password"] = os.environ.get("MQTT_PASSWORD", mqtt_cfg.get("password", ""))
        mqtt_cfg["username"] = os.environ.get("MQTT_USERNAME", mqtt_cfg.get("username", ""))

    return cfg


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

async def main() -> None:
    config = load_config()
    app = EdgeApp(config)

    # Graceful shutdown (Unix: SIGINT/SIGTERM | Windows: KeyboardInterrupt)
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: asyncio.ensure_future(app.stop()))
        except (NotImplementedError, AttributeError):
            pass

    try:
        await app.start()
    except KeyboardInterrupt:
        await app.stop()


if __name__ == "__main__":
    asyncio.run(main())

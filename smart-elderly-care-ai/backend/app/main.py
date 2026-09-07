"""
main.py
FastAPI Application Entry Point – Smart Elderly Care AI Backend.

Microservices Architecture:
- REST API (v1) với authentication, vitals, incidents, reports
- WebSocket cho real-time vital signs
- MQTT Subscriber nhận dữ liệu từ Edge Hub
- Background tasks: FCM notification, MQTT listener
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.api import api_router
from app.api.websockets.vitals_ws import ws_router
from app.core.config import settings
from app.core.database import close_db, init_db
from app.services.mqtt.mqtt_subscriber import MQTTSubscriber

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

mqtt_subscriber: MQTTSubscriber | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown lifecycle."""
    global mqtt_subscriber

    # ---- Startup ----
    logger.info("🚀 Starting Smart Elderly Care AI Backend...")

    # Database connections
    await init_db()

    # MQTT Subscriber (background thread)
    mqtt_subscriber = MQTTSubscriber()
    mqtt_subscriber.start()
    logger.info("✅ MQTT Subscriber started.")

    yield

    # ---- Shutdown ----
    logger.info("🛑 Shutting down...")
    if mqtt_subscriber:
        mqtt_subscriber.stop()
    await close_db()
    logger.info("✅ Shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Smart Elderly Care AI – API",
    description=(
        "Cloud Backend cho hệ thống chăm sóc người cao tuổi thông minh. "
        "Nhận telemetry từ Edge Hub, xử lý cảnh báo, cung cấp API cho Mobile & Web."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ---- Middleware ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

# ---- Routers ----
app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/ws")


# ---- Health & Root ----
@app.get("/", include_in_schema=False)
async def root():
    """Chuyển hướng trang chủ về tài liệu Swagger API."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/docs")


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

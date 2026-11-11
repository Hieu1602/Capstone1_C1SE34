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
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.api import api_router
from app.api.websockets.vitals_ws import ws_router
from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.i18n import normalize_language, translate_payload
from app.services.mqtt.mqtt_subscriber import MQTTSubscriber

logger = logging.getLogger(__name__)

from pathlib import Path
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_STATIC_DIR = _BACKEND_DIR / "static" 


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

    import asyncio
    loop = asyncio.get_running_loop()

    def handle_telemetry(payload: dict):
        async def _save():
            try:
                from app.core.database import AsyncSessionFactory
                from app.crud.crud_vital import crud_vital
                async with AsyncSessionFactory() as session:
                    await crud_vital.create(session, payload)
                    await session.commit()
            except Exception as e:
                logger.error("[Lifespan] Error saving MQTT telemetry: %s", e)
        asyncio.run_coroutine_threadsafe(_save(), loop)

    def handle_alert(payload: dict):
        async def _save_alert():
            try:
                from app.core.database import AsyncSessionFactory
                from app.crud.crud_incident import crud_incident
                from app.crud.crud_vital import crud_vital
                async with AsyncSessionFactory() as session:
                    raw_dev = payload.get("device_id")
                    if raw_dev:
                        dev_uuid = await crud_vital.resolve_device_uuid(session, raw_dev)
                        if dev_uuid:
                            payload["device_id"] = dev_uuid

                    # Tự động đẩy video clip & ảnh sự cố lên Supabase Storage
                    clip_path = payload.get("clip_path")
                    if clip_path:
                        try:
                            from app.services.storage.supabase_storage import supabase_storage
                            event_name = f"{payload.get('id', 'incident')}.mp4"
                            cloud_url = await supabase_storage.upload_file(clip_path, event_name, "video/mp4")
                            if cloud_url:
                                payload["video_clip_url"] = cloud_url
                        except Exception as up_err:
                            logger.warning("[Lifespan] Không thể upload clip lên Supabase: %s", up_err)

                    thumb_path = payload.get("thumbnail_path")
                    if thumb_path:
                        try:
                            from app.services.storage.supabase_storage import supabase_storage
                            thumb_name = f"{payload.get('id', 'incident')}.jpg"
                            cloud_thumb = await supabase_storage.upload_file(thumb_path, thumb_name, "image/jpeg")
                            if cloud_thumb:
                                payload["thumbnail_url"] = cloud_thumb
                        except Exception as up_err:
                            logger.warning("[Lifespan] Không thể upload ảnh lên Supabase: %s", up_err)

                    incident = await crud_incident.create_from_edge(session, payload)
                    await session.commit()

                    # Real-time WebSocket broadcast
                    try:
                        from app.api.websockets.vitals_ws import manager
                        ws_data = {
                            "type": "incident_alert",
                            "alert_type": incident.alert_type,
                            "alert_level": incident.alert_level,
                            "message": incident.message,
                            "incident_id": str(incident.id),
                            "video_clip_url": incident.video_clip_url,
                            "device_id": str(incident.device_id),
                        }
                        await manager.broadcast_to_device(str(incident.device_id), ws_data)
                    except Exception as ws_err:
                        logger.warning("[Lifespan] WS broadcast warning: %s", ws_err)

                    # Gửi thông báo khẩn cấp (FCM) tới người nhà khi té ngã hoặc cảnh báo nguy cấp
                    if incident.alert_type in ("FALL_DETECTED", "CRITICAL") or incident.alert_level in ("HIGH", "CRITICAL"):
                        try:
                            from app.models.device import Device
                            from app.models.house import House, HouseMember
                            from app.models.user import User
                            from app.services.notification.fcm_service import FCMService
                            from sqlalchemy import select, or_

                            device = await session.get(Device, incident.device_id)
                            if device and device.house_id:
                                house = await session.get(House, device.house_id)
                                member_subq = select(HouseMember.user_id).where(HouseMember.house_id == device.house_id)
                                user_query = select(User).where(
                                    User.is_active.is_(True),
                                    or_(
                                        User.id == house.owner_id if house else False,
                                        User.id.in_(member_subq),
                                    ),
                                )
                                users_res = await session.execute(user_query)
                                house_users = users_res.scalars().all()
                                tokens = [u.fcm_token for u in house_users if u.fcm_token]
                                if tokens:
                                    fcm = FCMService()
                                    cred_path = Path(settings.FCM_SERVICE_ACCOUNT_PATH)
                                    if not cred_path.is_absolute() and not cred_path.is_file():
                                        cred_path = Path(__file__).resolve().parents[1] / cred_path
                                    if cred_path.is_file():
                                        fcm.initialize(str(cred_path))
                                    fcm.send_alert(
                                        fcm_tokens=tokens,
                                        title="🚨 CẢNH BÁO TÉ NGÃ KHẨN CẤP",
                                        body=incident.message or "Phát hiện sự cố té ngã tại camera!",
                                        data={
                                            "type": "FALL_ALERT",
                                            "incident_id": str(incident.id),
                                            "device_id": str(incident.device_id),
                                            "alert_type": incident.alert_type,
                                            "alert_level": incident.alert_level,
                                            "video_clip_url": incident.video_clip_url or "",
                                        },
                                        priority="high",
                                    )
                                    logger.info("[Lifespan] Đã gửi thông báo té ngã tới %d thiết bị.", len(tokens))
                        except Exception as fcm_err:
                            logger.warning("[Lifespan] FCM push notification warning: %s", fcm_err)
            except Exception as e:
                logger.error("[Lifespan] Error saving MQTT alert: %s", e)
        asyncio.run_coroutine_threadsafe(_save_alert(), loop)

    mqtt_subscriber.on_telemetry(handle_telemetry)
    mqtt_subscriber.on_alert(handle_alert)
    mqtt_subscriber.start()
    logger.info("✅ MQTT Subscriber started and handlers registered.")

    # Appointment reminder background worker (UC.0)
    from app.services.scheduler import appointment_scheduler_service
    await appointment_scheduler_service.start()
    logger.info("✅ AppointmentSchedulerService started.")

    # Background task: Tự động đồng bộ các avatar dạng static file cục bộ lên Base64 trong Supabase
    async def _sync_local_avatars_to_cloud():
        try:
            import io, base64
            from PIL import Image
            from sqlalchemy import select
            from app.core.database import AsyncSessionFactory
            from app.models.user import User
            async with AsyncSessionFactory() as session:
                result = await session.execute(select(User).where(User.avatar_url.like('%/static/avatars/%')))
                legacy_users = result.scalars().all()
                updated_count = 0
                for u in legacy_users:
                    if not u.avatar_url:
                        continue
                    fname = Path(u.avatar_url.split('?')[0].split('#')[0]).name
                    if not fname:
                        continue
                    local_p = _STATIC_DIR / "avatars" / fname
                    if local_p.exists() and local_p.is_file():
                        img = Image.open(local_p)
                        if img.mode in ('RGBA', 'P'):
                            img = img.convert('RGB')
                        w, h = img.size
                        min_dim = min(w, h)
                        img = img.crop(((w-min_dim)//2, (h-min_dim)//2, (w+min_dim)//2, (h+min_dim)//2))
                        img.thumbnail((384, 384))
                        buf = io.BytesIO()
                        img.save(buf, format='JPEG', quality=85)
                        u.avatar_url = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
                        updated_count += 1
                if updated_count > 0:
                    await session.commit()
                    logger.info("✅ Auto-migrated %d local avatar(s) to cloud Base64.", updated_count)
        except Exception as e:
            logger.warning("[Lifespan] Avatar cloud sync warning: %s", e)

    asyncio.create_task(_sync_local_avatars_to_cloud())

    yield

    # ---- Shutdown ----
    logger.info("🛑 Shutting down...")
    from app.services.scheduler import appointment_scheduler_service
    await appointment_scheduler_service.stop()
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
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def localize_api_messages(request: Request, call_next):
    """Set request language."""
    request.state.language = normalize_language(request.headers.get("accept-language"))
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    language = getattr(request.state, "language", "vi")
    content = {"detail": exc.detail}
    try:
        content = translate_payload(content, language)
    except Exception:
        pass
    origin = request.headers.get("origin") or "*"
    headers = dict(exc.headers or {})
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Credentials"] = "true"
    headers["Access-Control-Allow-Methods"] = "*"
    headers["Access-Control-Allow-Headers"] = "*"
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    logger.error("[422 Validation Error] Path: %s | Errors: %s", request.url.path, errors)
    first_err = errors[0] if errors else {}
    loc = " -> ".join(str(l) for l in first_err.get("loc", []))
    msg = first_err.get("msg", "Dữ liệu không hợp lệ.")
    error_msg = f"Dữ liệu không hợp lệ tại [{loc}]: {msg}"
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": error_msg, "errors": errors},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("[App] Unhandled server error: %s", exc)
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Lỗi máy chủ nội bộ: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


# ---- Middleware ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *settings.ALLOWED_ORIGINS,
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$",
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

# ---- Static Files (Ảnh hồ sơ khuôn mặt người cao tuổi, avatar người dùng) ----
from fastapi.staticfiles import StaticFiles

_STATIC_DIR.mkdir(parents=True, exist_ok=True)
(_STATIC_DIR / "faces").mkdir(parents=True, exist_ok=True)
(_STATIC_DIR / "avatars").mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


# ---- Health, Docs & Root ----
@app.get("/", include_in_schema=False)
async def root():
    """Chuyển hướng trang chủ về tài liệu Swagger API."""

    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=f"{app.title} - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        init_oauth=app.swagger_ui_init_oauth,
    )


@app.get("/api/docs", include_in_schema=False)
async def api_docs_redirect():

    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=f"{app.title} - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        init_oauth=app.swagger_ui_init_oauth,
    )


@app.get("/api/redoc", include_in_schema=False)
async def api_redoc_redirect():

    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/redoc")


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

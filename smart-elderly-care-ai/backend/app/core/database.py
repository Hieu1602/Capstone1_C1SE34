"""
database.py
Kết nối PostgreSQL (async SQLAlchemy) và Redis.
Hỗ trợ TimescaleDB hypertable cho vital_signs.
"""

from collections.abc import AsyncGenerator
import logging

from redis.asyncio import Redis, from_url  # type: ignore[import-untyped]
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SQLAlchemy – PostgreSQL / TimescaleDB
# ---------------------------------------------------------------------------

def _async_database_url(database_url: str):
    url = make_url(database_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+asyncpg")

    if url.drivername == "postgresql+asyncpg":
        query = dict(url.query)
        sslmode = query.pop("sslmode", None)
        if sslmode and "ssl" not in query:
            query["ssl"] = sslmode
        if (
            not query.get("ssl")
            and url.host
            and (url.host.endswith(".supabase.co") or url.host.endswith(".pooler.supabase.com"))
        ):
            query["ssl"] = "require"
        if query != dict(url.query):
            url = url.set(query=query)

    return url


engine = create_async_engine(
    _async_database_url(settings.DATABASE_URL),
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class cho tất cả SQLAlchemy ORM models."""
    pass


async def init_db() -> None:
    """Tạo tất cả tables nếu chưa tồn tại (dev only, prod dùng Alembic)."""
    from sqlalchemy import text
    try:
        import app.models  # noqa: F401
        
        # 1. Tạo các bảng cơ sở và cập nhật cột mới (Idempotent schema upgrades)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'vi';"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size_mode VARCHAR(20) DEFAULT 'system';"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_font_scale INTEGER DEFAULT 2;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS vibration_enabled BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_sound_enabled BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS critical_alert_enabled BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS cchn_number VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS conditions_json TEXT;"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10);"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS height_cm INTEGER;"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS weight_kg INTEGER;"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS drug_allergies TEXT;"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS food_allergies TEXT;"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS dietary_notes TEXT;"))
            await conn.execute(text("ALTER TABLE elderly_profiles ADD COLUMN IF NOT EXISTS face_embedding TEXT;"))
            await conn.execute(text("ALTER TABLE device_configs ADD COLUMN IF NOT EXISTS bp_systolic_high INTEGER NOT NULL DEFAULT 140;"))
            await conn.execute(text("ALTER TABLE device_configs ADD COLUMN IF NOT EXISTS bp_systolic_low INTEGER NOT NULL DEFAULT 90;"))
            await conn.execute(text("ALTER TABLE device_configs ADD COLUMN IF NOT EXISTS bp_diastolic_high INTEGER NOT NULL DEFAULT 90;"))
            await conn.execute(text("ALTER TABLE device_configs ADD COLUMN IF NOT EXISTS bp_diastolic_low INTEGER NOT NULL DEFAULT 60;"))
            await conn.execute(text("ALTER TABLE device_configs ADD COLUMN IF NOT EXISTS is_custom_thresholds BOOLEAN NOT NULL DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS bp_systolic INTEGER;"))
            await conn.execute(text("ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS bp_diastolic INTEGER;"))
            await conn.execute(text("ALTER TABLE house_members ADD COLUMN IF NOT EXISTS can_view_health BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE house_members ADD COLUMN IF NOT EXISTS can_view_camera BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE house_members ADD COLUMN IF NOT EXISTS can_handle_emergency BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE house_members ADD COLUMN IF NOT EXISTS can_manage_devices BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE house_members ADD COLUMN IF NOT EXISTS can_manage_records BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS location_address;"))
            await conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS location_longitude;"))
            await conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS location_latitude;"))
            await conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS location_enabled;"))

        # 2. Tạo các bảng hỗ trợ và quản trị
        async with engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS support_tickets (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    user_name VARCHAR(255) NOT NULL,
                    phone VARCHAR(20) NOT NULL,
                    topic VARCHAR(255) NOT NULL,
                    device_type VARCHAR(50) DEFAULT 'other',
                    note TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS security_policies (
                    id VARCHAR(50) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    category VARCHAR(50) NOT NULL,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    value VARCHAR(100),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    event VARCHAR(150) NOT NULL,
                    user_name VARCHAR(255) NOT NULL,
                    ip_address VARCHAR(50) NOT NULL,
                    severity VARCHAR(20) NOT NULL DEFAULT 'low',
                    details TEXT NOT NULL
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp ON audit_logs(timestamp DESC);"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_incidents (
                    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    service VARCHAR(100) NOT NULL,
                    incident_type VARCHAR(20) NOT NULL DEFAULT 'WARNING',
                    message TEXT NOT NULL,
                    resolved BOOLEAN NOT NULL DEFAULT FALSE,
                    resolved_at TIMESTAMPTZ
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_system_incidents_timestamp ON system_incidents(timestamp DESC);"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_terminals (
                    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    device_name VARCHAR(255) NOT NULL,
                    device_type VARCHAR(50) NOT NULL DEFAULT 'mobile',
                    os VARCHAR(100),
                    browser VARCHAR(100),
                    ip_address VARCHAR(50) NOT NULL DEFAULT '127.0.0.1',
                    location VARCHAR(255) DEFAULT 'Đà Nẵng, Việt Nam',
                    last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_terminals_user_id ON user_terminals(user_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_terminals_last_active ON user_terminals(last_active_at DESC);"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_login_histories (
                    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    device_name VARCHAR(255) NOT NULL,
                    ip_address VARCHAR(50) NOT NULL,
                    location VARCHAR(255) DEFAULT 'Đà Nẵng, Việt Nam',
                    login_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    login_method VARCHAR(50) NOT NULL DEFAULT 'Mật khẩu',
                    status VARCHAR(20) NOT NULL DEFAULT 'success',
                    user_agent VARCHAR(500)
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_login_histories_user_id ON user_login_histories(user_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_login_histories_login_time ON user_login_histories(login_time DESC);"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_notifications (
                    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    body TEXT NOT NULL,
                    type VARCHAR(50) NOT NULL DEFAULT 'info',
                    target_audience VARCHAR(50) NOT NULL DEFAULT 'all',
                    status VARCHAR(50) NOT NULL DEFAULT 'draft',
                    scheduled_at TIMESTAMPTZ,
                    published_at TIMESTAMPTZ,
                    revoked_at TIMESTAMPTZ,
                    revoke_reason TEXT,
                    delivered_count INTEGER NOT NULL DEFAULT 0,
                    read_count INTEGER NOT NULL DEFAULT 0,
                    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS appointments (
                    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                    doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    patient_id UUID NOT NULL,
                    house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
                    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    visit_type VARCHAR(30) NOT NULL DEFAULT 'HOME_VISIT',
                    scheduled_at TIMESTAMPTZ NOT NULL,
                    duration_minutes INT NOT NULL DEFAULT 30,
                    location VARCHAR(255) NOT NULL DEFAULT 'Tại nhà (Khám tại gia)',
                    clinical_notes TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
                    cancellation_reason TEXT,
                    recurrence_pattern VARCHAR(20) NOT NULL DEFAULT 'NONE',
                    recurrence_end_date TIMESTAMPTZ,
                    parent_recurring_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
                    enable_speaker_reminder BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_appointments_doctor_time ON appointments(doctor_id, scheduled_at);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_appointments_patient_time ON appointments(patient_id, scheduled_at);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_appointments_status ON appointments(status, scheduled_at);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_appointments_house_id ON appointments(house_id);"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS appointment_reminders (
                    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
                    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
                    reminder_type VARCHAR(20) NOT NULL,
                    scheduled_time TIMESTAMPTZ NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    sent_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_reminders_status_time ON appointment_reminders(status, scheduled_time);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_reminders_appointment_id ON appointment_reminders(appointment_id);"))

        # 3. Dữ liệu khởi tạo (Seeding an toàn)
        try:
            async with engine.begin() as conn:
                await conn.execute(text("""
                    INSERT INTO users (
                        id, phone, full_name, hashed_password, role, 
                        preferred_language, font_size_mode, custom_font_scale,
                        vibration_enabled, is_active
                    ) 
                    SELECT 
                        'b3333333-b4e1-4b08-b2d3-d949a0eb075c',
                        '+84905111222',
                        'BS. Trần Văn Minh',
                        COALESCE((SELECT hashed_password FROM users WHERE hashed_password IS NOT NULL LIMIT 1), '$2b$12$e868N806V08VlP1G4W066eZ0/C19Y2b2e55j4Uu6dO9Yv8k9k2'),
                        'doctor',
                        'vi', 'system', 2,
                        TRUE, TRUE
                    WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone = '+84905111222');
                """))
        except Exception as seed_err:
            logger.debug("[DB] Doctor seed: %s", seed_err)

        logger.info("[DB] Database initialized and Web Admin schema tables verified.")
    except Exception as e:
        logger.warning(f"[DB] Could not connect to database immediately: {e}")
        logger.warning(f"[DB] Could not connect to database immediately: {e}")


async def close_db() -> None:
    """Đóng connection pool."""
    await engine.dispose()
    logger.info("[DB] Database connections closed.")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency – yield AsyncSession."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            if session.is_active:
                try:
                    await session.commit()
                except Exception as commit_err:
                    logger.debug("[get_db] Auto-commit rolled back: %s", commit_err)
                    await session.rollback()
        except Exception:
            if session.is_active:
                await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------

_redis_client: Redis | None = None


async def get_redis() -> Redis:
    """FastAPI dependency – trả về Redis client (singleton)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = await from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client

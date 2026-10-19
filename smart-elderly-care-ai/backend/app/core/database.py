"""
database.py
Kết nối PostgreSQL (async SQLAlchemy) và Redis.
Hỗ trợ TimescaleDB hypertable cho vital_signs.
"""

from collections.abc import AsyncGenerator
import logging

from redis.asyncio import Redis, from_url  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SQLAlchemy – PostgreSQL / TimescaleDB
# ---------------------------------------------------------------------------

engine = create_async_engine(
    settings.DATABASE_URL,
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
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Idempotent schema upgrades for Web Admin Portal & User Preferences
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'vi';"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size_mode VARCHAR(20) DEFAULT 'system';"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_font_scale INTEGER DEFAULT 2;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS vibration_enabled BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS location_address VARCHAR(500);"))
            # Ensure Doctor +84905111222 exists and has same password
            await conn.execute(text("""
                INSERT INTO users (
                    id, phone, full_name, hashed_password, role, 
                    preferred_language, font_size_mode, custom_font_scale,
                    vibration_enabled, location_enabled, is_active
                ) VALUES (
                    'b3333333-b4e1-4b08-b2d3-d949a0eb075c',
                    '+84905111222',
                    'BS. Trần Văn Minh',
                    (SELECT hashed_password FROM users WHERE phone = '+84905123456' LIMIT 1),
                    'doctor',
                    'vi', 'system', 2,
                    TRUE, TRUE, TRUE
                ) ON CONFLICT (phone) DO UPDATE 
                SET role = 'doctor',
                    hashed_password = (SELECT hashed_password FROM users WHERE phone = '+84905123456' LIMIT 1);
            """))
            await conn.execute(text("""
                INSERT INTO house_members (id, house_id, user_id, role_in_house, permissions)
                SELECT gen_random_uuid(), 'c3333333-b4e1-4b08-b2d3-d949a0eb075c', 'b3333333-b4e1-4b08-b2d3-d949a0eb075c', 'DOCTOR', 'VIEW'
                WHERE EXISTS (SELECT 1 FROM houses WHERE id = 'c3333333-b4e1-4b08-b2d3-d949a0eb075c')
                ON CONFLICT (house_id, user_id) DO NOTHING;
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

            # Seed default policies if empty
            pol_count = await conn.execute(text("SELECT COUNT(*) FROM security_policies;"))
            if pol_count.scalar() == 0:
                await conn.execute(text("""
                    INSERT INTO security_policies (id, name, description, category, enabled, value) VALUES
                    ('pol-1', 'Xác thực đa yếu tố (2FA / OTP)', 'Bắt buộc xác thực OTP số điện thoại khi đăng nhập tài khoản Bác sĩ và Quản trị viên.', 'authentication', TRUE, NULL),
                    ('pol-2', 'Mật khẩu độ phức tạp cao', 'Yêu cầu mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.', 'authentication', TRUE, NULL),
                    ('pol-3', 'Thời gian hết hạn phiên làm việc (JWT Access Token)', 'Tự động thu hồi phiên làm việc sau thời gian không hoạt động để bảo vệ dữ liệu y tế.', 'session', TRUE, '24 giờ'),
                    ('pol-4', 'Khóa tài khoản sau 5 lần đăng nhập sai', 'Tự động tạm khóa tài khoản trong 15 phút nếu phát hiện tấn công Brute-force.', 'access_control', TRUE, '5 lần'),
                    ('pol-5', 'Mã hóa dữ liệu nhạy cảm (At-Rest & In-Transit)', 'Toàn bộ sinh hiệu, hình ảnh khuôn mặt được mã hóa bằng AES-256 và TLS 1.3.', 'data_protection', TRUE, NULL),
                    ('pol-6', 'Giới hạn IP Whitelist cho cổng Admin', 'Chỉ cho phép truy cập trang quản trị từ các dải IP nội bộ hoặc VPN y tế đã xác thực.', 'access_control', FALSE, '192.168.1.0/24');
                """))

            # Quản lý thông báo toàn hệ thống (Web Admin System Notifications)
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
            await conn.execute(text("ALTER TABLE system_notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_system_notifications_status ON system_notifications(status);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_system_notifications_created_at ON system_notifications(created_at DESC);"))

            notif_count = await conn.execute(text("SELECT COUNT(*) FROM system_notifications;"))
            if notif_count.scalar() == 0:
                await conn.execute(text("""
                    INSERT INTO system_notifications (id, title, body, type, target_audience, status, published_at, delivered_count, read_count) VALUES
                    (gen_random_uuid(), 'Bảo trì nâng cấp hệ thống định kỳ', 'Hệ thống Smart Elderly Care AI sẽ tiến hành tối ưu hóa kết nối IoT và sao lưu cơ sở dữ liệu từ 01:00 đến 03:00 ngày 18/10/2026. Trong thời gian này, các tính năng báo cáo có thể bị chậm nhẹ.', 'system_maintenance', 'all', 'published', CURRENT_TIMESTAMP - INTERVAL '1 day', 152, 128),
                    (gen_random_uuid(), 'Khuyến cáo sức khỏe mùa giao mùa', 'Nhiệt độ thay đổi đột ngột có thể ảnh hưởng đến huyết áp của người cao tuổi. Gia đình vui lòng kiểm tra thiết bị đo sinh hiệu phòng ngủ và duy trì nhiệt độ phòng 26-28 độ C.', 'health_tip', 'caregivers', 'published', CURRENT_TIMESTAMP - INTERVAL '5 hours', 89, 74),
                    (gen_random_uuid(), 'Cập nhật tính năng trợ lý AI Y khoa', 'Phiên bản mới của Chatbot y khoa đã được tích hợp mô hình phân tích triệu chứng chuyên sâu dành cho bác sĩ gia đình và người chăm sóc.', 'feature_update', 'all', 'scheduled', NULL, 0, 0);
                """))
        logger.info("[DB] Database initialized and Web Admin schema tables verified.")
    except Exception as e:
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
            await session.commit()
        except Exception:
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

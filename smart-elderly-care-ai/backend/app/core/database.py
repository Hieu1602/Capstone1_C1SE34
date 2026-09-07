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
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("[DB] Database initialized.")
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

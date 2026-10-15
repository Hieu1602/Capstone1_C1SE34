"""
reset_vitals.py – Script xóa sạch toàn bộ dữ liệu mẫu trong bảng vital_signs (TimescaleDB)
và làm sạch cache sinh hiệu trong Redis.

Cách chạy:
    cd backend
    ./.venv/bin/python database/scripts/reset_vitals.py
"""

import asyncio
import logging
from sqlalchemy import text
from app.core.database import AsyncSessionFactory
from app.services.redis import redis_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("reset_vitals")


async def main():
    logger.info("Bắt đầu dọn sạch bảng dữ liệu đo sinh hiệu (vital_signs)...")
    
    # 1. Xóa dữ liệu trong bảng vital_signs của PostgreSQL / TimescaleDB
    async with AsyncSessionFactory() as db:
        try:
            # Xóa toàn bộ bản ghi trong bảng vital_signs
            res = await db.execute(text("DELETE FROM vital_signs;"))
            await db.commit()
            logger.info("✅ Đã xóa toàn bộ bản ghi đo sinh tồn trong bảng 'vital_signs'.")
        except Exception as e:
            logger.error("❌ Lỗi khi xóa bảng vital_signs: %s", e)
            await db.rollback()

    # 2. Xóa cache Redis nếu có
    try:
        if redis_service.redis_client:
            keys = await redis_service.redis_client.keys("vitals:*")
            if keys:
                await redis_service.redis_client.delete(*keys)
                logger.info("✅ Đã xóa sạch %d khóa cache sinh hiệu trong Redis.", len(keys))
            else:
                logger.info("ℹ️ Không có khóa cache vitals:* nào trong Redis.")
    except Exception as e:
        logger.warning("⚠️ Không thể kết nối Redis để xóa cache: %s", e)

    logger.info("🎉 Hoàn tất dọn dẹp dữ liệu sinh tồn mẫu! Ứng dụng hiện đang ở trạng thái trống hoàn toàn (Empty state).")


if __name__ == "__main__":
    asyncio.run(main())

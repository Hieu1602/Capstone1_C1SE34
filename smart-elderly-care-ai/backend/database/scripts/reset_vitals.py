"""
reset_vitals.py – Script xóa sạch toàn bộ dữ liệu mẫu trong bảng vital_signs (TimescaleDB)
và bảng incidents (Nhật ký cảnh báo & sự cố), đồng thời làm sạch cache sinh hiệu trong Redis.

Cách chạy:
    cd smart-elderly-care-ai/backend
    PYTHONPATH=. ./.venv/bin/python database/scripts/reset_vitals.py
"""

import asyncio
import logging
from sqlalchemy import text
from app.core.database import AsyncSessionFactory
from app.services.redis import redis_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("reset_vitals")


async def main():
    logger.info("Bắt đầu dọn sạch bảng dữ liệu đo sinh hiệu (vital_signs) và sự cố (incidents)...")
    
    # 1. Xóa dữ liệu trong bảng vital_signs và incidents của PostgreSQL
    async with AsyncSessionFactory() as db:
        try:
            # Xóa toàn bộ bản ghi trong bảng vital_signs
            await db.execute(text("DELETE FROM vital_signs;"))
            logger.info("✅ Đã xóa toàn bộ bản ghi đo sinh tồn trong bảng 'vital_signs'.")
            
            # Xóa toàn bộ bản ghi sự cố trong bảng incidents
            await db.execute(text("DELETE FROM incidents;"))
            logger.info("✅ Đã xóa toàn bộ bản ghi cảnh báo trong bảng 'incidents'.")
            
            await db.commit()
        except Exception as e:
            logger.error("❌ Lỗi khi xóa bảng vital_signs / incidents: %s", e)
            await db.rollback()

    # 2. Xóa cache Redis nếu có
    try:
        from app.core.database import get_redis
        r = await get_redis()
        patterns = ["vitals:*", "device:*:vitals", "alerts:recent"]
        total_deleted = 0
        for pattern in patterns:
            keys = await r.keys(pattern)
            if keys:
                await r.delete(*keys)
                total_deleted += len(keys)
        if total_deleted > 0:
            logger.info("✅ Đã xóa sạch %d khóa cache sinh hiệu/cảnh báo trong Redis.", total_deleted)
        else:
            logger.info("ℹ️ Không có khóa cache vitals/alerts nào trong Redis.")
    except Exception as e:
        logger.warning("⚠️ Không thể kết nối Redis để xóa cache: %s", e)

    logger.info("🎉 Hoàn tất dọn dẹp dữ liệu mẫu! Toàn bộ màn hình Sinh hiệu và Thông báo & Sự kiện hiện đang ở trạng thái trống hoàn toàn (Empty state).")


if __name__ == "__main__":
    asyncio.run(main())

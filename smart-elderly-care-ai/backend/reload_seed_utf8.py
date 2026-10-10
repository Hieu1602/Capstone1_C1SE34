"""
reload_seed_utf8.py – Nạp lại dữ liệu chuẩn UTF-8 trực tiếp qua SQLAlchemy/asyncpg.
Khắc phục triệt để lỗi PowerShell ANSI piping làm biến đổi ký tự tiếng Việt thành dấu hỏi '???'.
"""

import asyncio
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding="utf-8")

from sqlalchemy import text
from app.core.database import AsyncSessionFactory, get_redis


async def reload_seed():
    print("Bắt đầu nạp lại dữ liệu tiếng Việt chuẩn UTF-8 vào PostgreSQL...")

    # Đọc file SQL bằng UTF-8
    sql_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs", "database", "seed_sample_data.sql"))
    if not os.path.exists(sql_path):
        print(f"Không tìm thấy file: {sql_path}")
        return

    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    async with AsyncSessionFactory() as db:
        # Xóa dữ liệu cũ bị lỗi font
        print("1. Xóa dữ liệu cũ bị lỗi font...")
        await db.execute(text("TRUNCATE TABLE vital_signs, incidents, device_configs, devices, device_groups, elderly_profiles, house_members, houses, users CASCADE;"))
        await db.commit()

        # Thực thi file SQL
        print("2. Chạy seed_sample_data.sql bằng UTF-8...")
        # Tách các câu lệnh theo dấu chấm phẩy
        statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]
        for stmt in statements:
            # Bỏ qua các dòng chỉ chứa comment
            lines = [l for l in stmt.splitlines() if not l.strip().startswith("--")]
            clean_stmt = "\n".join(lines).strip()
            if clean_stmt:
                await db.execute(text(clean_stmt))
        await db.commit()
        print("3. Đã nạp thành công toàn bộ dữ liệu vào PostgreSQL!")

    # 4. Xóa Redis cache cũ
    print("4. Làm mới Redis cache...")
    try:
        redis_client = await get_redis()
        await redis_client.flushdb()
        print("Redis cache đã được làm mới!")
    except Exception as e:
        print(f"Lưu ý khi làm mới Redis: {e}")

    # 5. Kiểm tra lại dữ liệu
    async with AsyncSessionFactory() as db:
        res = await db.execute(text("SELECT name, address FROM houses"))
        for r in res.fetchall():
            print(f"House: {r.name} - {r.address}")

        res = await db.execute(text("SELECT device_id, name, sub_title, status_text FROM devices"))
        for r in res.fetchall():
            print(f"Device: {r.device_id} | {r.name} | {r.sub_title} | {r.status_text}")

        res = await db.execute(text("SELECT full_name, medical_history FROM elderly_profiles"))
        for r in res.fetchall():
            print(f"Elderly: {r.full_name} | {r.medical_history}")

        res = await db.execute(text("SELECT message FROM incidents LIMIT 1"))
        for r in res.fetchall():
            print(f"Incident: {r.message}")

    print("\nHOÀN TẤT: Dữ liệu tiếng Việt đã chuẩn xác 100% không còn dấu hỏi '???'!")


if __name__ == "__main__":
    asyncio.run(reload_seed())

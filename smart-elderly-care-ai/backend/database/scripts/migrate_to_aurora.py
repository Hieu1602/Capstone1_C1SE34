"""migrate_to_aurora.py – Script tự động khởi tạo DDL schema và dữ liệu mẫu vào AWS Aurora PostgreSQL."""
import asyncio
import os
import sys
import ssl
from pathlib import Path
import asyncpg

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

async def test_and_migrate(db_url: str):
    print(f"🔄 Đang kết nối tới AWS Aurora: {db_url.split('@')[-1]} ...")
    try:
        # Làm sạch protocol nếu có asyncpg
        clean_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        conn = await asyncpg.connect(clean_url, ssl=ctx, timeout=20)
        print("✅ Kết nối AWS Aurora thành công!")
        
        if not SCHEMA_PATH.exists():
            print(f"❌ Không tìm thấy file schema tại: {SCHEMA_PATH}")
            return False
            
        print(f"📄 Đang đọc schema từ: {SCHEMA_PATH.name} ({SCHEMA_PATH.stat().st_size} bytes)...")
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            sql_content = f.read()

        print("🚀 Đang khởi tạo DDL các bảng và dữ liệu mẫu vào Aurora PostgreSQL...")
        await conn.execute(sql_content)
        print("✅ Đã nạp thành công toàn bộ Database Schema & Dữ liệu mẫu vào AWS Aurora!")
        
        # Kiểm tra số lượng bảng
        rows = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        table_names = [r["table_name"] for r in rows]
        print(f"📊 Tổng số bảng đã tạo ({len(table_names)}): {', '.join(table_names[:8])}...")
        
        # Kiểm tra user admin
        users_count = await conn.fetchval("SELECT COUNT(*) FROM users;")
        print(f"👥 Tổng số người dùng trong database: {users_count}")
        
        await conn.close()
        return True
    except Exception as e:
        print(f"❌ Lỗi khi khởi tạo database trên AWS Aurora: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
    else:
        target_url = os.getenv("AURORA_DATABASE_URL", "")
        
    if not target_url:
        print("Cách dùng:")
        print("  python migrate_to_aurora.py postgresql://postgres:matkhau@database-1.cluster-xxx.ap-southeast-2.rds.amazonaws.com:5432/postgres")
        sys.exit(1)
        
    asyncio.run(test_and_migrate(target_url))

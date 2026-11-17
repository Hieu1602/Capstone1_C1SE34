"""inspect_db.py – Script xem nhanh danh sách bảng và số lượng dòng dữ liệu trên AWS RDS."""
import asyncio
import ssl
import sys
import asyncpg

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

DB_URL = "postgresql://postgres:Seca2026@seca.cdeea4mcuj3h.ap-southeast-2.rds.amazonaws.com:5432/postgres"

async def inspect():
    conn = await asyncpg.connect(DB_URL, ssl=ctx)
    print("=" * 60)
    print("📊 TỔNG QUAN DỮ LIỆU CƠ SỞ DỮ LIỆU AWS RDS (seca)")
    print("=" * 60)
    
    rows = await conn.fetch("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    
    for idx, r in enumerate(rows, 1):
        tbl = r["table_name"]
        cnt = await conn.fetchval(f'SELECT COUNT(*) FROM "{tbl}"')
        print(f"{idx:02d}. {tbl:<30} : {cnt:>5} dòng")
        
    print("=" * 60)
    
    # In mẫu người dùng
    users = await conn.fetch('SELECT id, full_name, phone, role, is_active FROM users LIMIT 5')
    print("\n👥 DANH SÁCH TÀI KHOẢN MẪU (Bảng users):")
    for u in users:
        print(f" - [{u['role']}] {u['full_name']} | SĐT: {u['phone']} | Active: {u['is_active']}")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(inspect())

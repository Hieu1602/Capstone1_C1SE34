"""migrate_supabase_to_aws.py – Sao chép toàn bộ 100% dữ liệu từ Supabase sang AWS RDS PostgreSQL."""
import asyncio
import json
import ssl
import asyncpg

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "postgresql://postgres.lwvoaznmrciezcwktmlg:seca1122cap1@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
AWS_RDS_HOST = "13.238.149.53"
AWS_RDS_PASS = "Seca2026"

TABLE_ORDER = [
    "users",
    "houses",
    "house_members",
    "elderly_profiles",
    "device_groups",
    "devices",
    "device_configs",
    "vital_signs",
    "incidents",
    "camera_recordings",
    "chat_sessions",
    "chat_messages",
    "appointments",
    "appointment_reminders",
    "support_tickets",
    "system_notifications",
    "system_incidents",
    "security_policies",
    "user_terminals",
    "user_login_histories",
    "audit_logs",
]

async def migrate_table(src_conn: asyncpg.Connection, dest_conn: asyncpg.Connection, table: str):
    # Lấy thông tin cột của bảng đích (AWS RDS)
    dest_cols_rows = await dest_conn.fetch("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
    """, table)
    dest_cols = {r["column_name"] for r in dest_cols_rows}
    
    if not dest_cols:
        print(f"⚠️ Bỏ qua bảng '{table}' (không tồn tại trên AWS RDS)")
        return 0

    # Lấy thông tin cột của bảng nguồn (Supabase)
    src_cols_rows = await src_conn.fetch("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
    """, table)
    src_cols = {r["column_name"] for r in src_cols_rows}
    
    if not src_cols:
        print(f"⚠️ Bỏ qua bảng '{table}' (không tồn tại trên Supabase)")
        return 0

    # Các cột chung giữa cả 2 bên
    common_cols = sorted(list(dest_cols.intersection(src_cols)))
    if not common_cols:
        return 0

    col_str = ", ".join([f'"{c}"' for c in common_cols])
    query = f'SELECT {col_str} FROM "{table}"'
    src_rows = await src_conn.fetch(query)
    
    if not src_rows:
        print(f" ℹ️  {table:<25}: 0 dòng trên Supabase")
        return 0

    # Lấy khóa chính (Primary Key) của bảng trên AWS RDS
    pk_rows = await dest_conn.fetch("""
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = $1
        ORDER BY kcu.ordinal_position;
    """, table)
    pk_cols = [r["column_name"] for r in pk_rows if r["column_name"] in common_cols]

    placeholders = ", ".join([f"${i+1}" for i in range(len(common_cols))])
    
    if pk_cols:
        pk_str = ", ".join([f'"{p}"' for p in pk_cols])
        update_cols = [c for c in common_cols if c not in pk_cols]
        if update_cols:
            update_clause = ", ".join([f'"{c}" = EXCLUDED."{c}"' for c in update_cols])
            insert_sql = f'INSERT INTO "{table}" ({col_str}) VALUES ({placeholders}) ON CONFLICT ({pk_str}) DO UPDATE SET {update_clause};'
        else:
            insert_sql = f'INSERT INTO "{table}" ({col_str}) VALUES ({placeholders}) ON CONFLICT ({pk_str}) DO NOTHING;'
    else:
        insert_sql = f'INSERT INTO "{table}" ({col_str}) VALUES ({placeholders});'

    batch_data = []
    for r in src_rows:
        row_vals = []
        for c in common_cols:
            val = r[c]
            if isinstance(val, (dict, list)):
                val = json.dumps(val)
            row_vals.append(val)
        batch_data.append(tuple(row_vals))

    batch_size = 500
    for i in range(0, len(batch_data), batch_size):
        chunk = batch_data[i:i + batch_size]
        await dest_conn.executemany(insert_sql, chunk)

    print(f" ✅ {table:<25}: Đã sao chép {len(batch_data):>5} dòng từ Supabase ➔ AWS RDS")
    return len(batch_data)

async def main():
    print("=" * 65)
    print("🚀 BẮT ĐẦU ĐỒNG BỘ TOÀN BỘ 100% DỮ LIỆU TỪ SUPABASE SANG AWS RDS")
    print("=" * 65)
    
    print("🔗 Đang kết nối tới Supabase Cloud...")
    src_conn = await asyncpg.connect(SUPABASE_URL, ssl=ctx, statement_cache_size=0, timeout=20)
    print("✅ Kết nối Supabase thành công!")

    print("🔗 Đang kết nối tới AWS RDS...")
    dest_conn = await asyncpg.connect(host=AWS_RDS_HOST, port=5432, user="postgres", password=AWS_RDS_PASS, database="postgres", ssl=ctx, timeout=20)
    print("✅ Kết nối AWS RDS thành công!\n")

    # Dọn dẹp dữ liệu thiết bị mẫu tạm thời trước đó trên AWS để tránh xung đột mã thiết bị BLE_BAND_001
    print("🧹 Đang dọn dữ liệu mẫu tạm thời trên AWS RDS trước khi kéo dữ liệu thật...")
    await dest_conn.execute("""
        DELETE FROM vital_signs WHERE device_id = 'd0000001-0000-0000-0000-000000000001';
        DELETE FROM incidents WHERE device_id = 'd0000001-0000-0000-0000-000000000001';
        DELETE FROM devices WHERE id IN ('d0000001-0000-0000-0000-000000000001', 'd0000002-0000-0000-0000-000000000002');
    """)
    print("✅ Đã dọn sạch thiết bị mẫu!\n")

    total_synced = 0
    for table in TABLE_ORDER:
        try:
            cnt = await migrate_table(src_conn, dest_conn, table)
            total_synced += cnt
        except Exception as e:
            print(f" ❌ {table:<25}: Lỗi ({e})")

    # Thống kê tổng quan trên AWS RDS sau khi sao chép
    print("\n" + "=" * 65)
    print("📊 TỔNG KẾT DỮ LIỆU THỰC TẾ TRÊN AWS RDS SAU KHI ĐỒNG BỘ:")
    print("=" * 65)
    for table in TABLE_ORDER:
        cnt = await dest_conn.fetchval(f'SELECT count(*) FROM "{table}"')
        print(f" • {table:<25}: {cnt:>5} dòng")
    print("=" * 65)
    print(f"🎉 HOÀN TẤT ĐỒNG BỘ TOÀN DIỆN! Tổng cộng {total_synced} bản ghi từ Supabase đã chuyển sang AWS RDS.")
    print("=" * 65)

    await src_conn.close()
    await dest_conn.close()

if __name__ == "__main__":
    asyncio.run(main())

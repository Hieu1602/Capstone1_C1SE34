"""seed_realtime_vitals.py – Nạp thiết bị mẫu và dữ liệu chuỗi thời gian sinh hiệu vào AWS RDS."""
import asyncio
import ssl
import uuid
from datetime import datetime, timedelta, timezone
import random
import asyncpg

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

DB_HOST = "13.238.149.53"
DB_PASS = "Seca2026"

async def seed():
    conn = await asyncpg.connect(host=DB_HOST, port=5432, user="postgres", password=DB_PASS, database="postgres", ssl=ctx)
    print("🔄 Đang nạp thiết bị và dữ liệu sinh hiệu thời gian thực...")

    # Lấy thông tin user và house có sẵn
    user_row = await conn.fetchrow("SELECT id FROM users WHERE role = 'user' LIMIT 1")
    house_row = await conn.fetchrow("SELECT id FROM houses LIMIT 1")
    elderly_row = await conn.fetchrow("SELECT id FROM elderly_profiles LIMIT 1")

    user_id = user_row["id"] if user_row else uuid.uuid4()
    house_id = house_row["id"] if house_row else uuid.uuid4()
    elderly_id = elderly_row["id"] if elderly_row else None

    # 1. Tìm hoặc thêm thiết bị Smartband & Camera
    band_row = await conn.fetchrow("SELECT id FROM devices WHERE device_id = 'BLE_BAND_001' OR device_type = 'SMARTBAND' LIMIT 1")
    if band_row:
        band_id = band_row["id"]
        print(f"ℹ️ Sử dụng Smartband có sẵn: {band_id}")
    else:
        band_id = uuid.UUID("d0000001-0000-0000-0000-000000000001")
        await conn.execute("""
            INSERT INTO devices (id, device_id, name, sub_title, device_type, location, is_online, status_text, battery_level, owner_id, house_id, elderly_id, last_heartbeat, created_at, updated_at)
            VALUES ($1, 'BLE_BAND_001', 'Vòng đeo tay Smartband CooSpo', 'Theo dõi nhịp tim & SpO2', 'SMARTBAND', 'Phòng ngủ', true, 'Đang hoạt động', 88, $2, $3, $4, now(), now(), now())
            ON CONFLICT (id) DO UPDATE SET is_online = true, updated_at = now();
        """, band_id, user_id, house_id, elderly_id)
        print("✅ Đã tạo thiết bị BLE_BAND_001 thành công!")

    # 2. Tạo 100 bản ghi sinh hiệu liên tục trong 2 giờ qua
    now = datetime.now(timezone.utc)
    vitals_data = []
    
    for i in range(120, -1, -1):
        ts = now - timedelta(minutes=i)
        hr = int(76 + random.randint(-4, 6))
        spo2 = int(98 + random.choice([0, -1, 1]))
        spo2 = min(99, max(95, spo2))
        sys_bp = int(120 + random.randint(-3, 5))
        dia_bp = int(80 + random.randint(-2, 3))
        temp = round(36.7 + random.uniform(-0.2, 0.3), 1)
        
        vitals_data.append((
            uuid.uuid4(),
            ts,
            band_id,
            hr,
            spo2,
            sys_bp,
            dia_bp,
            temp,
            1,
            False
        ))

    await conn.executemany("""
        INSERT INTO vital_signs (id, "time", device_id, heart_rate, spo2, bp_systolic, bp_diastolic, skin_temp_max, person_count, fall_detected)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    """, vitals_data)
    print(f"✅ Đã nạp thành công {len(vitals_data)} bản ghi dữ liệu sinh hiệu (vital_signs) vào AWS RDS!")

    # 3. Tạo cảnh báo sự cố mẫu (chỉ khi vượt ngưỡng bệnh lý thực tế lúc nghỉ ngơi)
    incident_id = uuid.uuid4()
    await conn.execute("""
        INSERT INTO incidents (id, device_id, alert_type, alert_level, message, confidence, is_acknowledged, created_at)
        VALUES ($1, $2, 'HIGH_HEART_RATE', 'HIGH', 'Cảnh báo: Nhịp tim tăng vọt 128 bpm bất thường khi đang nghỉ ngơi (vượt ngưỡng 100 bpm)', 0.95, false, now())
        ON CONFLICT DO NOTHING;
    """, incident_id, band_id)
    print("✅ Đã tạo 1 cảnh báo sự cố mẫu (incidents) thành công!")

    # Đếm lại
    total_dev = await conn.fetchval("SELECT count(*) FROM devices")
    total_vit = await conn.fetchval("SELECT count(*) FROM vital_signs")
    total_inc = await conn.fetchval("SELECT count(*) FROM incidents")
    print(f"📊 Kết quả: {total_dev} thiết bị, {total_vit} bản ghi sinh hiệu, {total_inc} sự cố.")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())

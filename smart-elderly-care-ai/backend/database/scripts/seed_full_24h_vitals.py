"""
seed_full_24h_vitals.py – Bổ sung dữ liệu sinh hiệu cho đủ 24 giờ mỗi ngày (00:00 -> 23:00)
cho tất cả các vòng đeo tay Smartband trong 30 ngày qua trên AWS RDS.
"""

import asyncio
import random
import ssl
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

DB_HOST = "13.238.149.53"
DB_PASS = "Seca2026"
VN_TZ = timezone(timedelta(hours=7))


async def seed_24h():
    print("🔄 Đang kết nối đến AWS RDS TimescaleDB...")
    conn = await asyncpg.connect(
        host=DB_HOST,
        port=5432,
        user="postgres",
        password=DB_PASS,
        database="postgres",
        ssl=ctx,
    )

    try:
        # Lấy danh sách tất cả các vòng Smartband
        bands = await conn.fetch("""
            SELECT d.id, d.name, ep.full_name
            FROM devices d
            LEFT JOIN elderly_profiles ep ON ep.id = d.elderly_id
            WHERE d.device_type = 'SMARTBAND'
        """)
        print(f"📋 Tìm thấy {len(bands)} thiết bị Smartband:")
        for b in bands:
            print(f"  - {b['name']} ({b['full_name']}) id={b['id']}")

        now_vn = datetime.now(VN_TZ)
        start_date = (now_vn - timedelta(days=30)).date()
        today = now_vn.date()

        total_inserted = 0

        for b in bands:
            band_id = b["id"]
            # Lấy các giờ đã có dữ liệu theo giờ Việt Nam
            existing_hours_rows = await conn.fetch("""
                SELECT 
                    TO_CHAR(time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as day_str,
                    EXTRACT(HOUR FROM (time AT TIME ZONE 'Asia/Ho_Chi_Minh')) as hr
                FROM vital_signs
                WHERE device_id = $1
                  AND time >= $2
                GROUP BY day_str, hr
            """, band_id, datetime.combine(start_date, datetime.min.time(), tzinfo=VN_TZ))

            existing_set = set()
            for r in existing_hours_rows:
                existing_set.add((r["day_str"], int(r["hr"])))

            to_insert = []
            cur_date = start_date
            while cur_date <= today:
                day_str = cur_date.strftime("%Y-%m-%d")
                is_today = (cur_date == today)
                max_hour = now_vn.hour if is_today else 23

                for h in range(max_hour + 1):
                    if (day_str, h) in existing_set:
                        continue  # Giờ này đã có dữ liệu

                    # Sinh 1-2 bản ghi trong khung giờ này
                    minute = random.randint(5, 55)
                    dt_local = datetime(
                        cur_date.year, cur_date.month, cur_date.day, h, minute, random.randint(0, 59), tzinfo=VN_TZ
                    )
                    dt_utc = dt_local.astimezone(timezone.utc)

                    # Sinh chỉ số sinh hiệu theo nhịp sinh học
                    if 22 <= h or h <= 5:
                        # Giờ ngủ đêm
                        hr = int(60 + random.randint(-3, 6))
                        spo2 = int(97 + random.choice([-1, 0, 1]))
                        sys_bp = int(112 + random.randint(-4, 4))
                        dia_bp = int(72 + random.randint(-3, 3))
                        temp = round(36.4 + random.uniform(-0.1, 0.2), 1)
                    elif 6 <= h <= 8:
                        # Thức dậy & buổi sáng
                        hr = int(72 + random.randint(-4, 5))
                        spo2 = int(98 + random.choice([-1, 0, 1]))
                        sys_bp = int(120 + random.randint(-4, 5))
                        dia_bp = int(78 + random.randint(-3, 4))
                        temp = round(36.6 + random.uniform(-0.1, 0.2), 1)
                    elif 9 <= h <= 17:
                        # Ban ngày
                        hr = int(75 + random.randint(-5, 8))
                        spo2 = int(98 + random.choice([-1, 0, 1]))
                        sys_bp = int(122 + random.randint(-4, 6))
                        dia_bp = int(80 + random.randint(-3, 4))
                        temp = round(36.7 + random.uniform(-0.2, 0.3), 1)
                    else:
                        # Buổi tối (18h - 21h)
                        hr = int(70 + random.randint(-4, 5))
                        spo2 = int(98 + random.choice([-1, 0, 1]))
                        sys_bp = int(118 + random.randint(-3, 5))
                        dia_bp = int(76 + random.randint(-3, 3))
                        temp = round(36.5 + random.uniform(-0.1, 0.2), 1)

                    spo2 = min(100, max(93, spo2))
                    to_insert.append((
                        uuid.uuid4(),
                        dt_utc,
                        band_id,
                        hr,
                        spo2,
                        sys_bp,
                        dia_bp,
                        temp,
                        1,
                        False,
                    ))

                cur_date += timedelta(days=1)

            if to_insert:
                await conn.executemany("""
                    INSERT INTO vital_signs (id, "time", device_id, heart_rate, spo2, bp_systolic, bp_diastolic, skin_temp_max, person_count, fall_detected)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """, to_insert)
                print(f"  ✅ Đã bổ sung {len(to_insert)} bản ghi cho Smartband '{b['name']}' ({b['full_name']})")
                total_inserted += len(to_insert)
            else:
                print(f"  👌 Smartband '{b['name']}' ({b['full_name']}) đã đủ 24 giờ!")

        print(f"\n🎉 Hoàn thành! Đã bổ sung tổng cộng {total_inserted} bản ghi sinh hiệu 24/7 vào cơ sở dữ liệu.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_24h())

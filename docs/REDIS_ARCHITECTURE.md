# ⚡ Tài Liệu Kiến Trúc & Thiết Kế Redis (Smart Elderly Care AI)

> **Dự án**: Hệ thống chăm sóc & giám sát người cao tuổi thông minh với AI Edge Computing  
> **Nhóm thực hiện**: C1SE.34  
> **Thành phần**: In-Memory Cache, Real-time Liveness Tracking & Emergency Alert Buffer  

---

## 1. 📌 Tổng quan: Redis là gì và tại sao hệ thống cần Redis?

Trong kiến trúc của **Smart Elderly Care AI**, hệ thống xử lý luồng dữ liệu sinh hiệu (nhịp tim, SpO2, nhiệt độ da) liên tục từ các thiết bị Edge Hub và camera AI. 

Nếu mọi yêu cầu từ **Mobile App** hoặc **Web Dashboard** đều truy vấn trực tiếp vào ổ cứng của **TimescaleDB (PostgreSQL)**, hệ thống sẽ gặp các vấn đề:
* Độ trễ cao khi người nhà mở app xem nhịp tim hiện tại.
* Gây quá tải I/O đĩa cứng khi hàng chục thiết bị gửi tin cùng lúc.
* Khó phát hiện ngay lập tức khi một thiết bị camera/hub bị mất nguồn hoặc ngắt mạng.

**Redis (Remote Dictionary Server)** giải quyết triệt để các bài toán này bằng cách lưu trữ toàn bộ dữ liệu "nóng" trên **bộ nhớ RAM siêu tốc**, đem lại thời gian phản hồi **dưới 1 miligiây (< 1ms)**.

---

## 2. ⚖️ Phân định nhiệm vụ: Redis vs. TimescaleDB

| Đặc điểm so sánh | ⚡ Redis Cache (RAM) | 🗄️ TimescaleDB (PostgreSQL) |
| :--- | :--- | :--- |
| **Nơi lưu trữ** | Bộ nhớ RAM | Ổ đĩa cứng (SSD/HDD) |
| **Mục đích chính** | Dữ liệu tức thời, Real-time, Cache, Liveness | Dữ liệu lịch sử, Báo cáo, Thống kê dài hạn |
| **Tốc độ đọc/ghi** | Siêu nhanh (**< 1ms**) | Nhanh (**10 - 100ms**) |
| **Dữ liệu quản lý** | Chỉ số mới nhất, Thiết bị đang online, 50 cảnh báo mới nhất | Hàng triệu bản ghi đo đạc qua nhiều tháng, năm |
| **Cơ chế mất điện** | Có thể mất hoặc đồng bộ RDB/AOF | Bền vững tuyệt đối (ACID Transaction) |

---

## 3. 🔑 Thiết kế cấu trúc Key (Redis Keyspace Schema)

Hệ thống tuân thủ nghiêm ngặt quy ước đặt tên Key theo chuẩn công nghiệp: `domain:identifier:attribute`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CẤU TRÚC KEY TRONG REDIS                          │
├────────────────────────────────┬──────────────┬────────────┬─────────────────┤
│ Tên Key (Key Pattern)          │ Kiểu dữ liệu │ Hạn (TTL)  │ Ý nghĩa         │
├────────────────────────────────┼──────────────┼────────────┼─────────────────┤
│ device:{device_id}:vitals      │ String (JSON)│ 24 giờ     │ Sinh hiệu mới   │
│ device:{device_id}:status      │ String       │ 60 giây    │ Trạng thái sống │
│ devices:online_set             │ Set          │ Vĩnh viễn  │ DS thiết bị ON  │
│ devices:last_seen              │ Hash         │ Vĩnh viễn  │ Mốc giờ cuối    │
│ alerts:recent                  │ List (FIFO)  │ Vĩnh viễn  │ 50 cảnh báo mới │
│ channel:vitals:{device_id}     │ Pub/Sub      │ N/A        │ Kênh bắn tin    │
└────────────────────────────────┴──────────────┴────────────┴─────────────────┘
```

### Chi tiết từng Key:

#### A. Chỉ số sinh hiệu mới nhất: `device:{device_id}:vitals`
* **Kiểu dữ liệu**: `String` (chuỗi JSON).
* **TTL**: 86400 giây (24 giờ).
* **Mục đích**: Lưu bản tin đo đạc gần nhất. Khi Mobile App hoặc WebSocket vừa mở lên, đọc ngay key này để vẽ biểu đồ mà không cần chờ bản tin tiếp theo.
* **Cấu trúc JSON**:
  ```json
  {
    "device_id": "hub-livingroom-01",
    "location": "Phòng khách - Tầng 1",
    "elderly_name": "Cụ Nguyễn Văn An (78 tuổi)",
    "heart_rate": 74,
    "spo2": 98,
    "skin_temp_max": 36.5,
    "person_count": 1,
    "fall_detected": false,
    "cached_at": 1727520000.0,
    "cached_at_iso": "2026-09-28 17:50:00"
  }
  ```

#### B. Trạng thái sống thiết bị (Heartbeat): `device:{device_id}:status`
* **Kiểu dữ liệu**: `String` (giá trị: `"ONLINE"`).
* **TTL**: 60 giây (Auto-expiry).
* **Nguyên lý hoạt động**:
  - Thiết bị Edge Hub gửi heartbeat định kỳ mỗi 15 - 30 giây.
  - Mỗi lần nhận tin, Backend gia hạn `SET device:{id}:status "ONLINE" EX 60`.
  - Nếu thiết bị mất mạng / mất điện quá 60s, Key này tự biến mất khỏi Redis.
  - API kiểm tra `EXISTS device:{id}:status` -> Nếu không có => Thiết bị đã **OFFLINE**.

#### C. Tập hợp các thiết bị đang kết nối: `devices:online_set`
* **Kiểu dữ liệu**: `Set` (tập hợp không trùng lặp các `device_id`).
* **Mục đích**: Cho phép Dashboard lấy nhanh toàn bộ danh sách thiết bị đang trực tuyến qua lệnh `SMEMBERS devices:online_set`.

#### D. Mốc thời gian nhìn thấy cuối cùng: `devices:last_seen`
* **Kiểu dữ liệu**: `Hash` (Field: `device_id`, Value: `timestamp_string`).
* **Mục đích**: Lưu lại thời điểm chính xác cuối cùng thiết bị gửi tín hiệu.

#### E. Hàng đợi cảnh báo khẩn cấp: `alerts:recent`
* **Kiểu dữ liệu**: `List` (danh sách đẩy từ đầu `LPUSH`, cắt giữ `LTRIM 0 49`).
* **Mục đích**: Lưu trữ tối đa 50 cảnh báo té ngã / nhịp tim bất thường gần nhất. Mobile App chỉ cần gọi 1 lần là lấy được toàn bộ danh sách thông báo mà không cần query SQL.

---

## 4. 💻 Mã nguồn Service triển khai (`app/services/redis/redis_service.py`)

Toàn bộ logic tương tác Redis được gom vào lớp `RedisService` bất đồng bộ:

```python
from app.services.redis import redis_service

# 1. Lưu chỉ số sinh hiệu vào Cache
await redis_service.set_latest_vitals(device_id="hub-01", data={
    "heart_rate": 75,
    "spo2": 98,
    "fall_detected": False
})

# 2. Đọc nhanh từ Cache (<1ms)
vitals = await redis_service.get_latest_vitals(device_id="hub-01")

# 3. Ghi nhận nhịp tim sống (Heartbeat)
await redis_service.set_device_heartbeat(device_id="hub-01")

# 4. Kiểm tra thiết bị có Online không
is_online = await redis_service.is_device_online(device_id="hub-01")

# 5. Đẩy sự cố khẩn cấp vào List
await redis_service.push_recent_alert({
    "device_id": "hub-01",
    "alert_type": "FALL_DETECTED",
    "message": "Phát hiện té ngã tại phòng khách!"
})

# 6. Lấy 10 cảnh báo mới nhất
alerts = await redis_service.get_recent_alerts(limit=10)
```

---

## 5. 🔌 Tích hợp với WebSocket (`vitals_ws.py`)

Khi ứng dụng Mobile kết nối tới `ws://localhost:8000/ws/vitals/{device_id}`:
1. Server chấp nhận kết nối.
2. **Ngay lập tức đọc cache từ Redis**:
   ```python
   cached_vitals = await redis_service.get_latest_vitals(device_id)
   if cached_vitals:
       await websocket.send_text(json.dumps({
           "type": "initial_telemetry",
           "source": "redis_cache",
           "data": cached_vitals
       }))
   ```
3. Người dùng trên điện thoại nhìn thấy ngay nhịp tim và nhiệt độ tức thì, không có cảm giác bị "đơ" hay "chờ loading".

---

## 6. 🌐 REST API Endpoints quản trị Redis

Tài liệu Swagger UI tại: **`http://localhost:8000/api/docs`** (Mục **System & Redis Cache**):

| Phương thức | Đường dẫn API | Chức năng |
| :---: | :--- | :--- |
| `GET` | `/api/v1/system/redis-status` | Xem tình trạng kết nối, dung lượng RAM (used_memory), số lượng keys, danh sách devices online |
| `POST` | `/api/v1/system/redis-seed` | Nạp bộ dữ liệu mẫu sinh động vào Redis (2 thiết bị mẫu + 2 cảnh báo mẫu) |
| `GET` | `/api/v1/system/recent-alerts` | Lấy danh sách sự cố khẩn cấp gần nhất từ RAM |
| `GET` | `/api/v1/system/devices/online` | Lấy danh sách các mã thiết bị đang phát tín hiệu Online |

---

## 7. 🖥️ Hướng dẫn xem dữ liệu trên tiện ích "Redis for VS Code"

Sau khi cài đặt tiện ích mở rộng **Redis for VS Code**:

1. Mở tab kết nối Redis trên VS Code và nhập chính xác:
   * **Host**: `127.0.0.1`
   * **Port**: `6379`
   * **Username**: `default`
   * **Password**: `redis_secure_pass_123`
   * Bỏ tích `Use TLS`
2. Bấm **`Add Redis Database`**.
3. Bạn sẽ thấy cây thư mục dữ liệu xuất hiện:
   * 📁 `device:`
     * 📁 `hub-livingroom-01` ➔ `vitals`, `status`
     * 📁 `hub-bedroom-02` ➔ `vitals`, `status`
   * 📄 `alerts:recent` ➔ Danh sách cảnh báo dạng List
   * 📄 `devices:online_set` ➔ Danh sách thiết bị dạng Set
   * 📄 `devices:last_seen` ➔ Bảng băm thời gian dạng Hash

---

## 8. 🔍 Các lệnh `redis-cli` hữu ích để kiểm tra bằng dòng lệnh

Nếu muốn tra cứu trực tiếp qua Terminal:

```bash
# Vào container Redis
docker exec -it elderly_care_redis redis-cli -a redis_secure_pass_123

# Xem toàn bộ các Key hiện có
KEYS *

# Xem sinh hiệu của thiết bị phòng khách
GET device:hub-livingroom-01:vitals

# Xem trạng thái Online và thời gian sống còn lại (TTL)
GET device:hub-livingroom-01:status
TTL device:hub-livingroom-01:status

# Xem danh sách cảnh báo khẩn cấp gần nhất
LRANGE alerts:recent 0 -1

# Xem thông số RAM và hệ thống
INFO memory
```

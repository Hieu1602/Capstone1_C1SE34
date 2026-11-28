# ⚡ Tài Liệu Kiến Trúc & Thiết Kế Redis — Smart Elderly Care AI (SECA)

> **Dự án:** Hệ thống chăm sóc & giám sát người cao tuổi thông minh với AI Edge Computing  
> **Nhóm thực hiện:** C1SE.34  
> **Thành phần:** In-Memory Cache, Liveness Tracking, Vital State Machine Lock, OTP & Reminder Queue  
> **Runtime:** Redis `7.2-alpine` (`elderly_care_redis`, port `6379`) kết nối qua `redis.asyncio` (`app/core/database.py`) và `sync redis` (`otp_service.py`)

---

## 1. 📌 Tổng quan: Vai trò của Redis trong hệ thống SECA

Trong hệ thống **Smart Elderly Care AI**, các luồng dữ liệu thời gian thực (telemetry nhịp tim/SpO2, heartbeat thiết bị Edge/Camera, khóa phân tán phát hiện loạn nhịp, hàng đợi cảnh báo tức thời, OTP xác thực, phiên đăng nhập và nhắc thuốc hàng ngày) yêu cầu độ trễ đọc/ghi **dưới 1ms (`< 1ms`)** để tránh gây nghẽn cho cơ sở dữ liệu quan hệ **PostgreSQL** (AWS RDS PostgreSQL 18.3 / local Docker TimescaleDB PG16).

Redis đảm nhiệm **6 nhóm tác vụ thực tế** trong Backend:
1. **Cache sinh hiệu & Liveness thiết bị** (`RedisService`).
2. **Hàng đợi 50 cảnh báo gần nhất** (`alerts:recent`) đẩy tức thì khi WebSocket `/ws/alerts` kết nối.
3. **Khóa phân tán & Máy trạng thái sinh hiệu 4 tầng** (`VitalStateMachine` trong `app/services/vitals/vital_state_machine.py`).
4. **Quản lý phiên đăng nhập, thu hồi token & mã mời hộ gia đình** (`auth.py`, `web_admin/security.py`, `houses.py`).
5. **Xác thực OTP, chống spam gửi mã & khóa tạm khi nhập sai** (`otp_service.py`, tự fallback sang bộ nhớ RAM nội bộ nếu Redis tạm mất kết nối).
6. **Cache API truy vấn thường xuyên & Trạng thái nhắc uống thuốc/nước hàng ngày** (`crud_doctor.py`, `patients.py`, `incidents.py`, `reminders.py`, `voice_reminder_scheduler.py`).

---

## 2. ⚖️ Phân định nhiệm vụ: Redis vs. PostgreSQL

| Đặc điểm so sánh | ⚡ Redis (`elderly_care_redis` 7.2) | 🗄️ PostgreSQL (AWS RDS PG 18.3 / TimescaleDB PG16 local) |
| :--- | :--- | :--- |
| **Nơi lưu trữ** | Bộ nhớ RAM (kèm volume `/data` trên Docker) | Lưu trữ bền vững trên đĩa cloud SSD / EBS |
| **Tốc độ đọc/ghi** | **< 1ms** (in-memory) | **10 – 100ms** (TLS + query planner + ACID) |
| **Dữ liệu đảm nhiệm** | Sinh hiệu mới nhất, TTL heartbeat thiết bị, trạng thái máy loạn nhịp 60 phút, OTP, cache API, cữ thuốc theo ngày, 50 cảnh báo gần nhất | Tài khoản, hộ gia đình, hồ sơ bệnh án, thiết bị, đơn thuốc, lịch khám, lịch sử chuỗi thời gian `vital_signs`, sự cố `incidents`, audit logs |
| **Vòng đời dữ liệu** | Ngắn hạn theo **TTL** (`3s` lock, `60s` liveness, `180s`–`24h` cache/session, `7–30 ngày` reminder) | Lưu trữ dài hạn với ràng buộc khóa ngoại (FK) và ACID |

---

## 3. 🔑 Bảng Tổng Hợp Redis Keyspace (Khớp Thực Tế Mã Nguồn)

### 3.1. Sinh hiệu, Trạng thái Online & Cảnh báo (`app/services/redis/redis_service.py`)

| Key / Channel Pattern | Kiểu dữ liệu | TTL mặc định | Nơi ghi / đọc chính | Mục đích |
| :--- | :--- | :--- | :--- | :--- |
| `device:{device_id}:vitals` | `String` (JSON) | `86400s` (24 giờ) | `crud_vital.py`, `crud_doctor.py`, `vitals_ws.py` | Lưu snapshot sinh hiệu mới nhất (`heart_rate`, `spo2`, `skin_temp_max`, `bp_*`, `cached_at`, `cached_at_iso`) để WebSocket & Doctor Web đọc ngay không cần quét bảng `vital_signs`. |
| `device:{device_id}:status` | `String` (`"ONLINE"`) | `60s` (auto-expire) | `redis_service.py` (`set_device_heartbeat`) | Tự động gia hạn mỗi khi nhận telemetry/heartbeat; hết `60s` key tự mất => coi là Offline. |
| `devices:online_set` | `Set` | Không TTL (tự dọn) | `redis_service.py` (`get_online_devices`) | Tập hợp `device_id` đang kết nối; hàm đọc tự kiểm tra lại `device:{id}:status` và `SREM` thiết bị đã hết hạn. |
| `devices:last_seen` | `Hash` | Không TTL | `redis_service.py` (`set_device_heartbeat`) | Lưu chuỗi thời gian lần cuối thấy thiết bị theo từng field `device_id`. |
| `alerts:recent` | `List` (FIFO/LIFO) | Không TTL (giữ 50 phần tử) | `crud_vital.py`, `vitals_ws.py`, `monitoring.py` | Đẩy mới bằng `LPUSH` và cắt giữ bằng `LTRIM 0 49` tối đa 50 cảnh báo mới nhất. |
| `channel:vitals:{device_id}` | `Pub/Sub` Channel | N/A (transient) | `redis_service.py` (`publish_vital_update`) | Kênh publish cập nhật sinh hiệu liên worker (hiện WS client đang đọc snapshot Redis và broadcast qua in-process `VitalsConnectionManager`). |

### 3.2. Máy Trạng Thái Sinh Hiệu & Phát Hiện Loạn Nhịp (`app/services/vitals/vital_state_machine.py`)

| Key Pattern | Kiểu dữ liệu | TTL mặc định | Mục đích |
| :--- | :--- | :--- | :--- |
| `secai:lock:vitals:{elder_id}` | Lock (`redis.lock`) | `timeout=3s` (`blocking=1s`) | Khóa phân tán tuần tự hóa xử lý mẫu sinh hiệu cho từng người cao tuổi, chống race condition. |
| `secai:state:{elder_id}` | `Hash` | `7200s` (2 giờ) | Trạng thái hiện tại của máy 4 trạng thái (`NORMAL`, `SUSPECT`, `EPISODE`, `RECOVERY`), `abn_count`, `ep_peak`, `min_spo2`, `last_ts`. |
| `secai:episodes:{elder_id}` | `Sorted Set` | `7200s` (2 giờ) | Cửa sổ trượt 60 phút (`WINDOW_SEC=3600s`) lưu các cơn bất thường đã đóng theo score timestamp để phát hiện cơn tái diễn (PAF). |
| `secai:cooldown:{elder_id}:{level}` / `secai:cooldown:{elder_id}:sustained_high_hr` | `String` (`"1"`, `NX`) | `900s` (15 phút) | Chống bắn lặp cảnh báo cùng cấp độ hoặc cơn kéo dài >= 10 phút trong vòng 15 phút (`COOLDOWN_SEC=900`). |

### 3.3. Phiên Đăng Nhập, OTP & Mã Mời Gia Đình

| Key Pattern | Kiểu dữ liệu | TTL mặc định | Nơi ghi / đọc chính | Mục đích |
| :--- | :--- | :--- | :--- | :--- |
| `session:{session_id}` | `String` (JSON) | `86400s` (24 giờ) | `auth.py`, `redis_service.py` | Lưu thông tin phiên đăng nhập hiện hành (kết hợp cùng bảng `user_terminals`). |
| `sessions:active_set` | `Set` | Không TTL (tự dọn) | `redis_service.py`, `web_admin/security.py` | Danh sách ID các phiên hoạt động hiển thị trên trang Bảo mật Web Admin. |
| `session:revoked:{session_id}` | `String` (`"revoked"`) | `86400s` (24 giờ) | `redis_service.py` (`revoke_session`) | Danh sách đen đánh dấu phiên đã bị Admin thu hồi từ xa. |
| `otp:{phone}` & `otp_purpose:{phone}` | `String` | `300s` (5 phút) | `otp_service.py` | Lưu mã OTP 6 chữ số và mục đích (`register` / `reset_password`). |
| `otp_rate:{phone}` | `String` (timestamp) | `60s` (`OTP_RATE_LIMIT_SECONDS`) | `otp_service.py` | Giới hạn tối thiểu 60 giây giữa 2 lần yêu cầu gửi SMS OTP. |
| `otp_attempts:{phone}` | `String` (int counter) | `600s` (10 phút) | `otp_service.py` | Đếm số lần nhập sai OTP; đạt ngưỡng `OTP_MAX_ATTEMPTS=5` sẽ khóa tạm 10 phút. |
| `verified:{phone}` | `String` (`"1"`) | `600s` (10 phút) | `otp_service.py` | Đánh dấu số điện thoại vừa xác thực OTP thành công để bước `/register` hoặc `/password/reset` hoàn tất. |
| `house_invite_code:{code}` | `String` (`house_id`) | `600s` (10 phút) | `mobile/houses.py` | Mã mời 10 phút để thành viên mới tham gia hộ gia đình. |

### 3.4. API Cache & Nhắc Nhở Thuốc / Uống Nước Hàng Ngày

| Key Pattern | Kiểu dữ liệu | TTL mặc định | Nơi ghi / đọc chính | Mục đích |
| :--- | :--- | :--- | :--- | :--- |
| `cache:incidents:*` | `String` (JSON list) | `180s` (3 phút) | `incidents.py`, `redis_service.py` | Cache danh sách thông báo/sự cố; tự động invalidate bằng `SCAN` khi có sự cố/lịch khám/đơn thuốc/ACK mới. |
| `cache:doctor:{doctor_id}:patients` | `String` (JSON list) | `5s` (`crud_doctor.py`, default `180s`) | `crud_doctor.py` | Cache danh sách bệnh nhân phụ trách của bác sĩ; xóa khi cập nhật hồ sơ/đơn thuốc/phân quyền. |
| `cache:patients:list:*` | `String` (JSON list) | `180s` (3 phút) | `patients.py`, `redis_service.py` | Cache danh sách người cao tuổi theo hộ gia đình; tự xóa khi thêm/xóa hồ sơ. |
| `doctor:analytics:{elderly_id}:{days}:{start_date}:{end_date}` | `String` (JSON) | `20s` | `crud_doctor.py` (`get_vitals_analytics`) | Cache ngắn hạn kết quả tổng hợp biểu đồ sinh hiệu dài ngày cho Doctor Web & Mobile Doctor. |
| `reminders:{target_id}:{YYYY-MM-DD}` | `String` (JSON dict) | `7 ngày` (`604800s`) | `mobile/reminders.py`, `voice_reminder_scheduler.py` | Trạng thái uống thuốc trong ngày (`taken`), thuốc thêm thủ công và lịch uống nước. |
| `prescriptions:{target_id}` | `String` (JSON list) | `30 ngày` (`2592000s`) | `mobile/reminders.py` | Lưu cache danh sách đơn thuốc tóm tắt theo tài khoản/bệnh nhân từ luồng reminders. |
| `voice_reminded:{date}:{pid}:{med\|hyd}:{hh:mm}` (và `_repeat`, `mobile_pre15_reminded:...`, `mobile_reminded:...`, `mobile_reminded_repeat:...`) | `String` (`"1"`) | `48 giờ` (`172800s`) | `voice_reminder_scheduler.py` | Chống phát lặp nhắc thuốc/nước qua loa camera và thông báo đẩy Mobile (bao gồm nhắc trước 15 phút, đúng giờ và nhắc lại sau 15 phút). |

---

## 4. 💻 Sử dụng `RedisService` trong Backend (`app/services/redis/redis_service.py`)

```python
from app.services.redis import redis_service

# 1. Cache sinh hiệu mới nhất & gia hạn heartbeat 60s
await redis_service.set_latest_vitals(device_id="hub-01", data={
    "heart_rate": 75,
    "spo2": 98,
    "fall_detected": False,
})
vitals = await redis_service.get_latest_vitals(device_id="hub-01")

# 2. Kiểm tra liveness thiết bị
is_online = await redis_service.is_device_online(device_id="hub-01")
online_ids = await redis_service.get_online_devices()

# 3. Đẩy và đọc hàng đợi 50 cảnh báo gần nhất
await redis_service.push_recent_alert({
    "device_id": "hub-01",
    "alert_type": "FALL_DETECTED",
    "message": "Phát hiện té ngã tại phòng khách!",
})
alerts = await redis_service.get_recent_alerts(limit=10)

# 4. Invalidate cache an toàn bằng SCAN (không block Redis như KEYS)
await redis_service.invalidate_incidents_cache()
await redis_service.invalidate_doctor_patients(doctor_id="...")
```

---

## 5. 🔌 Tích hợp WebSocket (`app/api/websockets/vitals_ws.py`)

Backend gắn `ws_router` tại prefix `/ws` (`app/main.py`) với **2 WebSocket endpoints**:

1. **`ws://<host>:8000/ws/vitals/{device_id}`** *(Realtime telemetry theo thiết bị)*:
   - Khi client kết nối, server đọc ngay `await redis_service.get_latest_vitals(device_id)` và gửi frame `type: "initial_telemetry", source: "redis_cache"` để giao diện hiển thị ngay chỉ số gần nhất.
   - Sau đó nhận broadcast trực tiếp từ MQTT Subscriber / in-process `VitalsConnectionManager`, hỗ trợ heartbeat `"ping"` / `"pong"`.

2. **`ws://<host>:8000/ws/alerts`** *(Cảnh báo khẩn cấp & Đồng bộ lịch khám/đơn thuốc)*:
   - Mobile App, Web Admin và Doctor Web cùng kết nối tới `/ws/alerts`.
   - Ngay khi chấp nhận kết nối, server đọc tới 25 bản ghi từ `await redis_service.get_recent_alerts(25)` và gửi frame `type: "INITIAL_ALERTS", source: "redis_cache"`.
   - Toàn bộ cảnh báo té ngã, SOS, nhắc uống thuốc, lịch khám (`APPOINTMENT_*`), thu hồi phiên... được phát realtime qua danh sách kết nối `alert_clients`.

---

## 6. 🌐 REST API Endpoints liên quan đến Redis

Tài liệu Swagger UI tại **`http://localhost:8000/docs`** (hoặc **`http://localhost:8000/api/docs`**):

| Phương thức | Đường dẫn API | Router / Ghi chú | Chức năng |
| :---: | :--- | :--- | :--- |
| `GET` | `/api/v1/system/redis-status` | `web_admin/infrastructure.py` *(alias `/api/v1/admin/infrastructure/redis-status`)* | Xem trạng thái kết nối, `used_memory_human`, `total_keys`, `connected_clients`, danh sách `online_devices`. |
| `POST` | `/api/v1/system/redis/flush` | `web_admin/infrastructure.py` *(alias `/api/v1/admin/infrastructure/redis/flush`)* | Thực thi `FLUSHDB` xóa toàn bộ bộ nhớ đệm Redis khi bảo trì. |
| `GET` | `/api/v1/system/recent-alerts` | `web_admin/monitoring.py` *(alias `/api/v1/admin/monitoring/recent-alerts`)* | Đọc `1..50` cảnh báo khẩn cấp mới nhất từ `alerts:recent`. |
| `GET` | `/api/v1/system/devices/online` | `web_admin/monitoring.py` *(alias `/api/v1/admin/monitoring/devices/online`)* | Trả về danh sách `device_id` đang online từ `devices:online_set`. |
| `GET` | `/api/v1/doctor/redis-status` | `mobile/doctor.py` | Cung cấp trạng thái Redis realtime (RAM, keys, `online_devices_count`) cho Doctor Web Portal. |

---

## 7. 🖥️ Kết nối kiểm tra bằng GUI ("Redis for VS Code" / Redis Insight)

Thông số kết nối container Docker cục bộ lấy từ biến môi trường trong `.env` (khởi tạo từ `smart-elderly-care-ai/.env.example`):

- **Host:** `127.0.0.1`
- **Port:** `6379`
- **Username:** `default`
- **Password:** Giá trị biến `REDIS_PASSWORD` trong file `.env` cá nhân *(không hardcode mật khẩu thật vào tài liệu hoặc Git)*.
- **TLS:** Tắt trên môi trường local (`REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379/0`).

---

## 8. 🔍 Các lệnh `redis-cli` hữu ích để kiểm tra qua Terminal

```bash
# 1. Truy cập redis-cli trong container (nhập mật khẩu với AUTH sau khi vào shell để tránh lộ trên shell history)
docker exec -it elderly_care_redis redis-cli
> AUTH <REDIS_PASSWORD>

# 2. Quét key an toàn bằng SCAN (khuyên dùng thay cho KEYS * trên production)
SCAN 0 MATCH * COUNT 100

# 3. Kiểm tra sinh hiệu cache & TTL heartbeat của thiết bị
GET device:hub-livingroom-01:vitals
GET device:hub-livingroom-01:status
TTL device:hub-livingroom-01:status
SMEMBERS devices:online_set

# 4. Kiểm tra máy trạng thái sinh hiệu & cửa sổ trượt 60 phút
HGETALL secai:state:<elder_id>
ZRANGE secai:episodes:<elder_id> 0 -1 WITHSCORES

# 5. Kiểm tra 50 cảnh báo gần nhất & danh sách cache API
LRANGE alerts:recent 0 9
SCAN 0 MATCH cache:* COUNT 50

# 6. Kiểm tra nhắc thuốc trong ngày & dung lượng RAM Redis
GET reminders:<patient_or_user_id>:2026-11-28
INFO memory
```

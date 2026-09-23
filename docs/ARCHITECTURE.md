# 🏛️ Kiến Trúc Phần Mềm – Smart Elderly Care AI

> **Capstone Project C1SE34**  
> Phiên bản tài liệu: 1.0 | Cập nhật: 2026-09-23

---

## 1. Tổng quan hệ thống

**Smart Elderly Care AI** là hệ thống chăm sóc người cao tuổi thông minh sử dụng AI Edge Computing, giúp phát hiện té ngã, giám sát sinh hiệu 24/7 và gửi cảnh báo khẩn cấp theo thời gian thực tới người giám hộ.

### Các mục tiêu kiến trúc chính

| Mục tiêu | Mô tả |
|---|---|
| **Độ trễ thấp** | Phát hiện sự cố < 500ms tại Edge, không phụ thuộc kết nối cloud |
| **Khả năng chịu lỗi** | Edge hoạt động độc lập khi mất kết nối internet |
| **Bảo mật** | JWT RS256, TLS/MQTT, mã hóa dữ liệu nhạy cảm |
| **Khả năng mở rộng** | Hỗ trợ nhiều thiết bị Edge gắn với một người dùng |
| **Thời gian thực** | WebSocket + FCM cho dashboard và cảnh báo tức thì |

---

## 2. Kiến trúc tổng thể (C4 Level 1 – System Context)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           NGƯỜI GIÁM HỘ                                  │
│                    (Mobile App / Web Browser)                            │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │  HTTPS / WebSocket / FCM Push
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│                         CLOUD BACKEND                                    │
│            FastAPI · TimescaleDB · Redis · EMQX · MinIO                  │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │  MQTT over TLS (port 8883)
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│                     EDGE HUB (Orange Pi 5)                               │
│        YOLOv8-Pose · YAMNet · BLE Band · AMG8833 · Sensor Fusion        │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │  RTSP / USB / BLE / I²C
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│                        PHẦN CỨNG CẢM BIẾN                                │
│     Camera IP · Loa · Vòng đeo BLE · Cảm biến nhiệt AMG8833             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Kiến trúc Container (C4 Level 2 – Container Diagram)

```
┌─────────────────────────────────────── CLOUD ──────────────────────────────────────────┐
│                                                                                         │
│  ┌───────────────┐   REST/WS    ┌────────────────┐  asyncpg  ┌──────────────────────┐  │
│  │  Mobile App   │◄────────────►│  FastAPI        │◄─────────►│   TimescaleDB        │  │
│  │ React Native  │              │  Backend        │           │  (PostgreSQL 16 +    │  │
│  │  (Expo)       │              │  :8000          │           │   Timescale ext.)    │  │
│  └───────────────┘              └────────┬────────┘           └──────────────────────┘  │
│         │                               │                                               │
│         │ FCM Push                      │ redis-py                                      │
│         │                       ┌───────▼────────┐                                      │
│  ┌──────▼──────────┐            │     Redis       │                                     │
│  │  Firebase FCM   │            │  :6379          │                                     │
│  │  (Google Cloud) │            │  Cache + PubSub │                                     │
│  └─────────────────┘            └───────┬─────────┘                                     │
│                                         │                                               │
│                                 ┌───────▼────────┐     ┌────────────────────────────┐  │
│                                 │   EMQX Broker   │     │       MinIO                │  │
│                                 │  :1883 / :8883  │     │  Object Storage            │  │
│                                 │  (MQTT 3.1.1)   │     │  :9000 (video clips)       │  │
│                                 └───────▲─────────┘     └────────────────────────────┘  │
│                                         │ MQTT TLS                                      │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────── EDGE ──────────────────────────────────────────┐
│                                         │                                              │
│                              ┌──────────▼──────────────────────────────────────────┐  │
│                              │         Edge Hub (Orange Pi 5 / RK3588)             │  │
│                              │                                                      │  │
│  ┌────────────┐   RTSP       │  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │  │
│  │ Camera IP  │─────────────►│  │YOLOv8-Pose │  │  YAMNet    │  │  Sensor      │   │  │
│  └────────────┘              │  │(RKNN/ONNX) │  │ (TFLite)   │  │  Fusion      │   │  │
│                              │  │Fall Detect │  │Sound Class.│  │  Decision    │   │  │
│  ┌────────────┐   USB Audio  │  └─────┬──────┘  └─────┬──────┘  │  Matrix      │   │  │
│  │ Microphone │─────────────►│        │                │         └──────┬───────┘   │  │
│  └────────────┘              │        └────────┬────────┘                │           │  │
│                              │                 ▼                         │           │  │
│  ┌────────────┐   BLE        │         ┌───────────────┐                 │           │  │
│  │  BLE Band  │─────────────►│         │  Ring Buffer  │◄────────────────┘           │  │
│  │ HR + SpO2  │              │         │  (5s video)   │                             │  │
│  └────────────┘              │         └───────┬───────┘                             │  │
│                              │                 │                                     │  │
│  ┌────────────┐   I2C        │         ┌───────▼───────┐                             │  │
│  │  AMG8833   │─────────────►│         │ MQTT Publisher│──── MQTT to Cloud ─────►   │  │
│  │ Skin Temp  │              │         │ Alert Payload │                             │  │
│  └────────────┘              │         └───────────────┘                             │  │
│                              └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Kiến trúc nội bộ từng layer

### 4.1. Edge Hub – `edge/`

Kiến trúc **Event-Driven Async** dựa trên `asyncio`, xử lý song song nhiều luồng cảm biến.

```
edge/
├── config/
│   └── config.yaml              # Ngưỡng cảnh báo, địa chỉ MQTT, BLE MAC
└── src/
    ├── main.py                  # Entry point – asyncio event loop
    ├── ai/
    │   ├── vision/              # YOLOv8-Pose: phát hiện tư thế, té ngã
    │   │   └── models/          # yolov8n-pose.rknn / .onnx
    │   └── audio/               # YAMNet: phân loại âm thanh khẩn cấp
    │       └── models/          # yamnet.tflite
    ├── drivers/                 # Giao tiếp phần cứng
    │   ├── camera.py            # RTSP stream → OpenCV frames
    │   ├── ble_band.py          # Bleak BLE → HR, SpO2
    │   └── amg8833.py           # I2C → nhiệt độ da 8x8 grid
    ├── fusion/                  # Quyết định đa nguồn
    │   ├── decision_matrix.py   # Tổng hợp score từ tất cả sensor
    │   └── ring_buffer.py       # Vòng đệm 5 giây video trước sự cố
    └── services/
        ├── mqtt_publisher.py    # Publish alert JSON lên cloud
        ├── speaker.py           # Phát cảnh báo âm thanh tại chỗ
        └── rtsp_server.py       # Live stream đến mobile
```

**Luồng xử lý tại Edge:**

```
Camera Frame  ──► PoseDetector (YOLOv8)    ──┐
Audio Chunk   ──► SoundClassifier (YAMNet)  ──┼──► Decision Matrix ──► Alert?
BLE Band      ──► HR/SpO2 Parser            ──┤         │
AMG8833       ──► Thermal Grid Parser       ──┘    YES  │  NO
                                                    ┌───┴───┐
                                                    │       │
                                             MQTT Publish  Ignore
                                             Ring Buffer → MinIO
                                             Local Speaker Alert
```

---

### 4.2. Cloud Backend – `backend/`

Kiến trúc **Layered / Clean Architecture** với FastAPI.

```
backend/
├── Dockerfile
├── alembic.ini
├── migrations/                  # Alembic DB migrations
├── requirements.txt
└── app/
    ├── main.py                  # FastAPI app factory, middleware, router
    ├── api/
    │   ├── deps.py              # Dependency injection (DB session, auth)
    │   ├── v1/
    │   │   ├── api.py           # Router aggregation
    │   │   └── endpoints/
    │   │       ├── auth.py      # POST /auth/login, /auth/refresh
    │   │       ├── users.py     # GET/PUT /users/me
    │   │       ├── devices.py   # CRUD /devices (Edge Hub)
    │   │       ├── vitals.py    # GET /vitals (time-series query)
    │   │       ├── incidents.py # GET/PUT /incidents (alert history)
    │   │       └── reports.py   # GET /reports (analytics)
    │   └── websockets/          # WebSocket /ws/alerts, /ws/vitals
    ├── core/
    │   ├── config.py            # Pydantic Settings (env vars)
    │   ├── security.py          # JWT RS256, bcrypt, token utils
    │   └── database.py          # AsyncEngine, session factory
    ├── models/                  # SQLAlchemy ORM (TimescaleDB)
    │   ├── user.py
    │   ├── device.py
    │   ├── vital.py             # Hypertable (time-series)
    │   └── incident.py
    ├── schemas/                 # Pydantic DTOs (request/response)
    │   ├── user.py
    │   ├── device.py
    │   ├── vital.py
    │   └── incident.py
    ├── crud/                    # Repository pattern (async DB ops)
    │   ├── crud_user.py
    │   ├── crud_device.py
    │   ├── crud_vital.py
    │   └── crud_incident.py
    └── services/
        ├── mqtt/                # MQTT subscriber (nhận alert từ Edge)
        ├── notification/        # Firebase Cloud Messaging (FCM)
        ├── storage/             # MinIO client (video upload/presign)
        └── reports/             # Báo cáo sức khỏe định kỳ
```

**Luồng dữ liệu Backend:**

```
Edge Hub
   │ MQTT Publish
   ▼
EMQX Broker  ──────► MQTT Subscriber (FastAPI service)
                              │
                    ┌─────────▼──────────┐
                    │  Validate Payload   │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       TimescaleDB        Redis PubSub     FCM Push
      (persist alert)   (broadcast WS)  (notify mobile)
              │               │
              │               ▼
              │         WebSocket clients
              │         (Dashboard live)
              ▼
           MinIO
      (store video clip)
```

---

### 4.3. Mobile App – `apps/mobile/`

Kiến trúc **Feature-Sliced** với React Native (Expo) và Zustand state management.

```
apps/mobile/
├── App.tsx                      # Root component, navigation setup
└── src/
    ├── features/
    │   ├── auth/                # Login, token storage
    │   ├── dashboard/           # Tổng quan sức khỏe realtime
    │   ├── alerts/              # Danh sách & chi tiết cảnh báo
    │   ├── livestream/          # Xem camera trực tiếp (RTSP/WebRTC)
    │   └── history/             # Lịch sử sinh hiệu, sự cố
    ├── services/
    │   ├── api.ts               # Axios instance (REST API)
    │   ├── websocket.ts         # WebSocket client (alerts/vitals)
    │   └── fcm.ts               # Firebase push notification handler
    ├── store/
    │   ├── authStore.ts         # Zustand: user session, JWT token
    │   ├── alertStore.ts        # Zustand: danh sách cảnh báo
    │   └── vitalStore.ts        # Zustand: dữ liệu sinh hiệu realtime
    ├── components/              # Shared UI components
    ├── navigation/              # React Navigation stack/tab
    ├── theme/                   # Design tokens, colors, typography
    ├── types/                   # TypeScript global types
    └── utils/                   # Helper functions
```

---

## 5. Luồng dữ liệu tổng thể (End-to-End)

```
LUỒNG PHÁT HIỆN TE NGA

[1] Camera ghi hình → RTSP stream → OpenCV decode frame
[2] YOLOv8-Pose phân tích tư thế → tính toán Fall Score
[3] YAMNet nghe âm thanh → phân loại Emergency Sound
[4] BLE Band → đọc HR + SpO2 bất thường
[5] AMG8833 → đọc nhiệt độ da giảm đột ngột
[6] Decision Matrix tổng hợp score từ [2][3][4][5]
[7] Nếu score > ngưỡng:
    ├─ Ring Buffer trích xuất 5s video trước sự cố
    ├─ Local Speaker phát cảnh báo âm thanh
    └─ MQTT Publish → EMQX Broker (topic: elderly/alerts)
[8] FastAPI MQTT Subscriber nhận message:
    ├─ Lưu Incident vào TimescaleDB
    ├─ Upload video clip → MinIO
    ├─ Redis PubSub broadcast → WebSocket clients
    └─ FCM Push → Mobile App của người giám hộ
[9] Mobile App:
    ├─ Hiển thị popup cảnh báo khẩn cấp
    ├─ Phát âm thanh cảnh báo (FCM critical alert)
    └─ Mở màn hình xem camera trực tiếp
```

---

## 6. Thiết kế cơ sở dữ liệu (Database Schema)

TimescaleDB (PostgreSQL 16 với Timescale extension):

```sql
-- Bảng người dùng (người giám hộ)
users      (id, email, hashed_password, full_name, role, created_at)

-- Thiết bị Edge Hub
devices    (id, owner_id → users, device_name, mac_address, location, status)

-- Sinh hiệu (Hypertable – time-series)
vitals     (time, device_id → devices, heart_rate, spo2, skin_temp)

-- Sự cố / Cảnh báo
incidents  (id, device_id → devices, type, severity, video_url, resolved_at, created_at)
```

**Hypertable** cho `vitals`:
- Tự động phân vùng theo thời gian (chunk interval: 1 ngày)
- Tối ưu truy vấn time-range, aggregate theo phút/giờ/ngày

---

## 7. Thiết kế giao tiếp (Communication Design)

### 7.1. MQTT Topics

| Topic | Publisher | Subscriber | QoS | Mô tả |
|---|---|---|---|---|
| `elderly/{device_id}/alerts` | Edge Hub | Backend | 1 | Cảnh báo khẩn cấp |
| `elderly/{device_id}/vitals` | Edge Hub | Backend | 0 | Sinh hiệu định kỳ |
| `elderly/{device_id}/status` | Edge Hub | Backend | 1 | Trạng thái thiết bị |
| `cloud/{device_id}/config` | Backend | Edge Hub | 1 | Cập nhật cấu hình |

### 7.2. REST API Endpoints

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Đăng nhập, lấy JWT | ❌ |
| POST | `/api/v1/auth/refresh` | Làm mới access token | ✅ |
| GET | `/api/v1/users/me` | Thông tin tài khoản | ✅ |
| GET/POST | `/api/v1/devices` | Quản lý thiết bị Edge | ✅ |
| GET | `/api/v1/vitals` | Lịch sử sinh hiệu | ✅ |
| GET/PUT | `/api/v1/incidents` | Lịch sử sự cố | ✅ |
| GET | `/api/v1/reports` | Báo cáo sức khỏe | ✅ |

### 7.3. WebSocket Events

| Event | Direction | Payload | Mô tả |
|---|---|---|---|
| `alert` | Server → Client | `{type, severity, device_id, timestamp}` | Cảnh báo mới |
| `vital_update` | Server → Client | `{hr, spo2, temp, time}` | Sinh hiệu realtime |
| `device_status` | Server → Client | `{device_id, online, battery}` | Trạng thái Edge |

---

## 8. Thiết kế bảo mật (Security Design)

```
┌─────────────────── SECURITY LAYERS ──────────────────────┐
│                                                           │
│  Transport    │  TLS 1.3 (HTTPS, MQTT port 8883)         │
│  Auth API     │  JWT RS256 (access 15m / refresh 7d)     │
│  Auth MQTT    │  Username + Password (EMQX ACL rules)    │
│  Password     │  bcrypt (cost factor 12)                 │
│  Storage      │  MinIO Presigned URLs (expire 1h)        │
│  Push Notify  │  FCM critical alerts (bypass silent)     │
│  Secret Mgmt  │  Environment variables (.env)            │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 9. Chiến lược triển khai (Deployment)

### Cloud (Docker Compose)

```yaml
Services:
  backend     → FastAPI :8000  (Dockerfile)
  timescaledb → PostgreSQL+Timescale :5433
  redis       → Redis 7.2 :6379
  emqx        → EMQX 5.6 :1883/:8883/:18083
  minio       → MinIO :9000/:9001

Networks:  elderly_care_net (bridge)
Volumes:   timescale_data, redis_data, emqx_data, minio_data
```

### Edge (Bare Metal / Docker)

```bash
# Bare Metal
python -m src.main

# Docker
docker build -f Dockerfile.edge -t edge-hub .
docker run --privileged --network host edge-hub
```

### Mobile (Expo)

```bash
npx expo start          # Development
npx expo build:android  # Production APK
npx expo build:ios      # Production IPA
```

---

## 10. Các quyết định kiến trúc quan trọng (ADR)

### ADR-001: Edge-first AI Processing

- **Quyết định**: Chạy AI inference (YOLOv8, YAMNet) trực tiếp tại Edge
- **Lý do**: Giảm độ trễ < 500ms, hoạt động khi mất mạng, bảo vệ quyền riêng tư
- **Đánh đổi**: Yêu cầu phần cứng mạnh (Orange Pi 5 / RK3588 NPU)

### ADR-002: TimescaleDB cho Time-Series

- **Quyết định**: Dùng TimescaleDB thay vì InfluxDB
- **Lý do**: Tương thích PostgreSQL, hỗ trợ JOIN với bảng quan hệ, SQL quen thuộc
- **Đánh đổi**: Cần cài extension, không tối ưu thuần time-series như InfluxDB

### ADR-003: MQTT thay vì gRPC/REST cho Edge→Cloud

- **Quyết định**: Dùng EMQX MQTT Broker
- **Lý do**: Giao thức nhẹ, hỗ trợ QoS, pub/sub phù hợp IoT nhiều thiết bị
- **Đánh đổi**: Cần quản lý MQTT broker thêm

### ADR-004: Sensor Fusion Decision Matrix

- **Quyết định**: Tổng hợp kết quả từ nhiều sensor trước khi cảnh báo
- **Lý do**: Giảm false positive (cảnh báo nhầm gây phiền nhiễu người giám hộ)
- **Đánh đổi**: Logic phức tạp hơn, cần tinh chỉnh ngưỡng

### ADR-005: Zustand cho Mobile State Management

- **Quyết định**: Dùng Zustand thay vì Redux
- **Lý do**: API đơn giản, ít boilerplate, phù hợp với app có state vừa
- **Đánh đổi**: Ecosystem nhỏ hơn Redux, ít công cụ devtools

---

## 11. Sơ đồ tuần tự – Cảnh báo khẩn cấp (Sequence Diagram)

```
EdgeHub         EMQX           Backend         Redis          Mobile App
   │               │               │               │               │
   │ detect fall   │               │               │               │
   │──────────────►│               │               │               │
   │ MQTT publish  │               │               │               │
   │               │ forward msg   │               │               │
   │               │──────────────►│               │               │
   │               │               │ save incident │               │
   │               │               │──────────────►│               │
   │               │               │ DB persist    │               │
   │               │               │               │               │
   │               │               │ pubsub notify │               │
   │               │               │──────────────►│               │
   │               │               │               │ WS broadcast  │
   │               │               │               │──────────────►│
   │               │               │               │               │ show alert
   │               │               │ FCM push      │               │
   │               │               │───────────────────────────────►│
   │               │               │               │               │ notification
```

---

## 12. Công nghệ sử dụng (Technology Stack)

| Layer | Công nghệ | Phiên bản | Lý do chọn |
|---|---|---|---|
| **Edge AI – Vision** | YOLOv8-Pose | ultralytics 8.x | RKNN NPU acceleration |
| **Edge AI – Audio** | YAMNet | TFLite | Nhẹ, chạy realtime |
| **Edge Runtime** | Python asyncio | 3.11 | Concurrent I/O cho sensor |
| **Edge BLE** | Bleak | 0.21 | Async BLE cross-platform |
| **Edge MQTT** | paho-mqtt | 1.6 | Chuẩn MQTT Python |
| **Backend Framework** | FastAPI | 0.110 | Async, auto OpenAPI docs |
| **Backend ORM** | SQLAlchemy async | 2.0 | Async DB session |
| **Database** | TimescaleDB | PG16 | Time-series hypertable |
| **Cache / PubSub** | Redis | 7.2 | WS broadcast, session |
| **MQTT Broker** | EMQX | 5.6 | Enterprise IoT broker |
| **Object Storage** | MinIO | latest | S3-compatible, self-hosted |
| **Auth** | JWT RS256 | python-jose | Bảo mật, stateless |
| **Push Notification** | Firebase FCM | v1 | Cross-platform push |
| **Mobile Framework** | React Native (Expo) | SDK 51 | Cross iOS/Android |
| **Mobile State** | Zustand | 4.x | Lightweight store |
| **Mobile Charts** | Victory Native | 40.x | Time-series charts |
| **Deployment** | Docker Compose | 3.9 | Single-host cloud deploy |
| **DB Migration** | Alembic | 1.13 | Version-controlled schema |

---

*Tài liệu được tạo bởi team C1SE34 – Capstone Project 2026*

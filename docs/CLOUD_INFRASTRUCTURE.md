# ☁️ Kiến Trúc Hạ Tầng Đám Mây — Smart Elderly Care AI (SECA)

> **Mã đồ án:** C1SE.34  
> **Cập nhật:** 28/11/2026  
> **Mô hình triển khai:** Multi-Cloud kết hợp **Amazon Web Services (AWS EC2, AWS RDS PostgreSQL 18.3, AWS S3)** và **Google Firebase (Hosting cho Web Admin & Doctor Web, FCM Push Notifications)**

---

## 📌 1. Tổng Quan Kiến Trúc Đám Mây

Hệ thống **Smart Elderly Care AI** phân tách rõ 4 lớp hạ tầng nhằm tối ưu chi phí vận hành trên máy chủ nhẹ nhưng vẫn bảo đảm an toàn dữ liệu và phản hồi cảnh báo thời gian thực:

1. **AWS EC2 (Compute & Real-Time Engine):** Vận hành Docker Compose gồm **FastAPI Backend**, **Redis 7.2 Cache/State Lock** và **EMQX 5.6.0 MQTT Broker** trên máy chủ IP `16.178.128.42`.
2. **AWS RDS (Managed PostgreSQL 18.3):** Cơ sở dữ liệu quan hệ & chuỗi thời gian tập trung (**22 bảng, 284 cột**), kết nối bắt buộc qua TLS (`ssl=require`), độc lập hoàn toàn với vòng đời container EC2.
3. **AWS S3 Private Storage (`elderly-care-incidents-c1se34`):** Lưu trữ riêng tư phân đoạn video HLS 2 giây (`cameras/`), clip & ảnh bằng chứng sự cố (`incidents/`) và ảnh/clip lưu thủ công (`manual/`). Mọi lượt xem/tải đi qua xác thực quyền ở Backend để sinh **Presigned URL** có thời hạn.
4. **Google Firebase (Hosting CDN & FCM) + External APIs (Gemini/OpenAI, eSMS/Twilio):**
   - **Firebase Hosting:** Phân phối 2 ứng dụng Web độc lập qua CDN toàn cầu: **Web Admin Portal** (`smart-elderly-care-ai-cap1.web.app`) và **Doctor Web Portal** (`smart-elderly-care-doctor.web.app`).
   - **Firebase Cloud Messaging (FCM):** Đẩy thông báo khẩn cấp (té ngã, SOS) và nhắc lịch khám/uống thuốc tới thiết bị di động.

```
                         ┌──────────────────────────────────────────────┐
                         │            NGƯỜI DÙNG & CLIENT               │
                         └──┬──────────────────┬─────────────────────┬──┘
                            │                  │                     │
              HTTPS / CDN   │                  │ HTTPS / CDN         │ FCM High-Priority
           (Web Admin Portal)                  │ (Doctor Web Portal) │ Push Notifications
                            ▼                  ▼                     ▲
               ┌────────────────────────┐ ┌────────────────────────┐ │
               │    FIREBASE HOSTING    │ │    FIREBASE HOSTING    │ │ ┌──────────────────┐
               │ smart-elderly-care-ai- │ │ smart-elderly-care-    │ │ │   FIREBASE FCM   │
               │ cap1.web.app (:3000)   │ │ doctor.web.app (:3001) │ │ │ (Firebase Admin) │
               └────────────┬───────────┘ └────────────┬───────────┘ │ └────────▲─────────┘
                            │                          │             │          │
                            └──────────┬───────────────┘             │          │
                                       │ REST (/api/v1) & WS (/ws)   │          │ Push SDK
                                       ▼                             │          │
┌────────────────────────────────────────────────────────────────────┴──────────┴──────────┐
│                              AMAZON WEB SERVICES (AWS)                                   │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ AWS EC2 (t3.micro, Ubuntu — IP: 16.178.128.42) — Docker Network: elderly_care_net  │  │
│  │                                                                                    │  │
│  │  ┌───────────────────────────┐   ┌─────────────────┐   ┌────────────────────────┐ │  │
│  │  │  elderly_care_backend     │◄─►│ elderly_care_   │   │  elderly_care_emqx     │ │  │
│  │  │  FastAPI (Python 3.11)    │   │ redis (7.2)     │   │  EMQX 5.6.0 (:1883)    │ │  │
│  │  │  Port 8000                │◄──┼─────────────────┼───│  Nhận Telemetry/Alert  │ │  │
│  │  └──────┬────────────┬───────┘   └─────────────────┘   └───────────▲────────────┘ │  │
│  └─────────┼────────────┼─────────────────────────────────────────────┼──────────────┘  │
│            │            │                                             │                  │
│   asyncpg  │            │ Boto3 HEAD + Presigned GET (300s)           │ MQTT             │
│   SSL :5432│            ▼                                             │                  │
│            │   ┌───────────────────────────────────────────────┐      │                  │
│            │   │ AWS S3 (ap-southeast-2 Sydney) — Private      │      │                  │
│            │   │ Bucket: elderly-care-incidents-c1se34         │      │                  │
│            │   │ • cameras/<dev>/<id>.mp4|.ts  (HLS segments)  │      │                  │
│            │   │ • incidents/<dev>/<id>.mp4|.jpg (Bằng chứng)  │      │                  │
│            │   │ • manual/<dev>/<id>.mp4|.jpg    (Lưu tay)     │      │                  │
│            │   └──────────────────────▲────────────────────────┘      │                  │
│            │                          │ PutObject (AES256)            │                  │
│            ▼                          │                               │                  │
│  ┌─────────────────────────┐          │                               │                  │
│  │ AWS RDS PostgreSQL 18.3 │          └──────────────┬────────────────┘                  │
│  │ seca.cdeea4mcuj3h...    │                         │                                   │
│  │ (22 bảng, 284 cột)      │          ┌──────────────┴────────────────┐                  │
│  └─────────────────────────┘          │ EDGE GATEWAY / TAPO CAPTURE   │                  │
│                                       │ Orange Pi 5 + go2rtc + Tunnel │                  │
│                                       └───────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 2. Trụ Cột AWS — Compute, Database & Private Media Storage

### 2.1. AWS EC2 (Elastic Compute Cloud)
- **Máy chủ:** AWS EC2 `t3.micro` (1 vCPU, 1GB RAM vật lý kết hợp swap file nhằm giữ ổn định bộ nhớ), hệ điều hành Ubuntu Server, IP Public `16.178.128.42`.
- **Docker Compose (`smart-elderly-care-ai/docker-compose.yml`):** Mạng nội bộ `elderly_care_net` điều phối các dịch vụ cloud chính (trên EC2 không chạy DB/MinIO nặng nhờ dùng AWS RDS & S3, đồng thời file compose vẫn giữ định nghĩa `timescaledb` port `5433:5432` phục vụ chạy dev local độc lập):

| Container | Image / Runtime | Cổng ánh xạ | Vai trò chính |
| :--- | :--- | :--- | :--- |
| **`elderly_care_backend`** | `python:3.11-slim-bookworm` + FFmpeg + FastAPI/Uvicorn | `8000:8000` | Cung cấp REST API (`/api/v1`) và WebSocket (`/ws/alerts`, `/ws/vitals/{id}`); chạy `MQTTSubscriber`, `AppointmentSchedulerService`, `VoiceReminderSchedulerService`; ký S3 Presigned URLs; tích hợp Gemini AI & eSMS/FCM. |
| **`elderly_care_redis`** | `redis:7.2-alpine` | `6379:6379` | Cache sinh hiệu & heartbeat thiết bị (`TTL 60s`), khóa phân tán `VitalStateMachine`, hàng đợi 50 cảnh báo, quản lý OTP/session và lịch nhắc uống thuốc theo ngày. |
| **`elderly_care_emqx`** | `emqx/emqx:5.6.0` | `1883`, `8883`, `18083` | Broker MQTT tiếp nhận telemetry (`care/+/telemetry`) và cảnh báo khẩn cấp (`care/+/alert`) từ Edge Gateway. |

- **Kết nối Camera từ LAN tại nhà lên EC2 (`docker-compose.camera.yml`):**
  - Tại nhà người cao tuổi chạy `tapo-camera` (HTTP `:8090` — MJPEG live, PTZ, Privacy, Motion, ghi MP4) và `tapo-audio` (`alexxit/go2rtc:1.9.14` — `:1984`, WebRTC `:8555/tcp,udp`).
  - Container `camera-tunnel` thiết lập **SSH Reverse Tunnel** giữ kết nối tới `ubuntu@16.178.128.42` (`:8090` và `:1984`) để Backend trên EC2 gọi lệnh điều khiển/loa/stream camera trong LAN mà không cần mở port modem gia đình ra Public Internet.

### 2.2. AWS S3 Private Media Storage (`elderly-care-incidents-c1se34`)
- **Bucket:** `elderly-care-incidents-c1se34` — Region: `ap-southeast-2` (Sydney).
- **Bảo mật dữ liệu video gia đình:**
  - Áp dụng **Block Public Access** và **SSE-S3 (`ServerSideEncryption="AES256"`)**, không gắn public-read ACL khi upload.
  - Tiến trình capture trên Edge (`edge/src/services/video_archive.py`) upload từng đoạn HLS 2 giây (`cameras/{device_id}/{id}.ts|.mp4`) và bằng chứng sự cố (`incidents/{device_id}/{id}.mp4|.jpg`) bằng Boto3, sau đó gửi metadata có xác thực `VIDEO_INGEST_TOKEN` lên `POST /api/v1/camera/archive`.
  - Backend (`backend/app/api/v1/endpoints/mobile/camera_archive.py` & `services/storage/video_storage.py`) xác nhận object tồn tại & khớp `ContentLength`/`ContentType` qua S3 `HEAD` trước khi lưu `camera_recordings`.
  - Khi người nhà/bác sĩ xem lại video hoặc ảnh bằng chứng qua `GET /api/v1/camera/archive/{recording_id}/playback`, Backend kiểm tra JWT + quyền `can_view_camera` trong hộ gia đình rồi mới trả về **Presigned GET URL** có hạn **`300 giây`** (`3600 giây` cho ảnh đính kèm FCM).
  - *Ghi chú tương thích:* Lớp `object_storage.py` (MinIO SDK) vẫn được giữ làm phương án phụ cho lưu trữ local/MinIO khi cần.

### 2.3. AWS RDS PostgreSQL 18.3 (Managed Relational Database)
- **Endpoint:** `seca.cdeea4mcuj3h.ap-southeast-2.rds.amazonaws.com` (cổng `5432`).
- **Engine thực tế:** **PostgreSQL 18.3** (`aarch64-unknown-linux-gnu`), extensions kích hoạt: `plpgsql`, `uuid-ossp`, `pgcrypto`.
- **Bảo mật kết nối:** Module `app/core/database.py` tự động chuyển URL chuẩn sang driver `postgresql+asyncpg` và ép bật SSL (`ssl=require`) với mọi host `*.rds.amazonaws.com`.
- **Cơ chế schema:** Gồm **22 bảng, 284 cột** (chi tiết xem [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)); hỗ trợ cả Alembic migration lẫn các câu lệnh nâng cấp idempotent tại `init_db()`.

### 2.4. AWS Security Group (Tường lửa EC2)
- `TCP 22`: SSH quản trị máy chủ & SSH Reverse Tunnel cho `camera-tunnel`.
- `TCP 8000`: REST API (`/api/v1`) và WebSocket (`/ws`).
- `TCP 1883 / 8883`: Giao tiếp MQTT/MQTTS cho Edge Gateway.
- `TCP 18083`: EMQX Management Dashboard (yêu cầu mật khẩu quản trị).
- `TCP 6379`: Redis chỉ chạy trong mạng nội bộ Docker (`elderly_care_net`) kèm xác thực `REDIS_PASSWORD`.

---

## 🔥 3. Trụ Cột Google Firebase & Dịch Vụ Ngoài

### 3.1. Firebase Hosting (2 Cổng Web Độc Lập)
Cả 2 cổng React 18 / Vite đều triển khai trên project Firebase `smart-elderly-care-ai-cap1` và tự động build/deploy qua GitHub Actions ([deploy.yml](../.github/workflows/deploy.yml)) mỗi khi push lên nhánh `main`:

1. **Web Admin Portal (`apps/web`):** `https://smart-elderly-care-ai-cap1.web.app` — Giám sát hạ tầng, người dùng, RBAC, bảo mật & thông báo toàn hệ thống.
2. **Doctor Web Portal (`apps/doctor-web`):** `https://smart-elderly-care-doctor.web.app` *(site `smart-elderly-care-doctor`)* — Theo dõi bệnh nhân, sinh hiệu dài ngày, kê đơn thuốc và quản lý lịch khám hai chiều.

Cả hai sử dụng rewrite SPA (`** -> /index.html`) và được khai báo trong whitelist CORS của `backend/app/main.py` cùng biến build `VITE_API_URL=http://16.178.128.42:8000/api/v1`.

### 3.2. Firebase Cloud Messaging (FCM)
- Tệp khóa quản trị `firebase-service-account.json` trên Backend và `google-services.json` trên Mobile (`com.c1se34.smartelderlycare`) được loại trừ khỏi Git qua `.gitignore`.
- Dùng để đẩy cảnh báo té ngã (`priority: high`, kèm presigned thumbnail URL nếu có), cảnh báo SOS, nhắc lịch khám (24h/2h) và nhắc uống thuốc/uống nước tới ứng dụng di động.

### 3.3. AI LLM (Gemini / OpenAI) & SMS OTP (eSMS / Twilio)
- **Trợ lý AI Y khoa (`backend/app/services/chatbot/llm_client.py`):** Gọi API OpenAI-compatible của Google Gemini (`LLM_MODEL` mặc định `gemini-3.1-flash-lite`, fallback `gemini-2.5-flash`), có cơ chế tự chuyển sang OpenAI `gpt-4o-mini` hoặc Pure RAG nội bộ nếu hết quota.
- **Xác thực SMS OTP (`backend/app/services/notification/otp_service.py`):** Hỗ trợ chế độ `esms` (eSMS Brandname), `twilio` (Twilio Verify) và `mock` (dev/test), kết hợp rate-limit trên Redis.

---

## 📊 4. Bảng Phân Chia Trách Nhiệm (Responsibility Matrix)

| Thành phần / Tính năng | AWS EC2 | AWS S3 | AWS RDS PG 18.3 | Firebase Hosting / FCM |
| :--- | :---: | :---: | :---: | :---: |
| **Web Admin & Doctor Web SPA** | ❌ | ❌ | ❌ | ✅ *(Hosting CDN)* |
| **REST API, WebSocket & Schedulers** | ✅ *(FastAPI)* | ❌ | ❌ | ❌ |
| **MQTT Telemetry & Alert Ingest** | ✅ *(EMQX)* | ❌ | ❌ | ❌ |
| **Cache, Liveness, Lock, OTP, Reminders** | ✅ *(Redis 7.2)* | ❌ | ❌ | ❌ |
| **Users, Houses, Patients, Vitals, Incidents, Appointments** | ❌ | ❌ | ✅ *(PostgreSQL)* | ❌ |
| **Video HLS 2s & Bằng chứng té ngã** | 🔄 *(HEAD + Sign URL)* | ✅ *(Private AES256)* | 🔄 *(Metadata URL)* | ❌ |
| **Push Notification SOS & Lịch khám** | 🔄 *(Trigger)* | ❌ | ❌ | ✅ *(FCM Delivery)* |
| **Chatbot RAG & Gemini/OpenAI** | ✅ *(Backend API)* | ❌ | 🔄 *(Chat history)* | ❌ |

---

## 🔄 5. Luồng Xử Lý Sự Cố Té Ngã Toàn Trình (End-to-End Incident Flow)

1. **Phát hiện tại Edge (`Orange Pi / Tapo Capture`):**
   - Mô hình YOLOv8-Pose + Sensor Fusion phát hiện ngã, trích xuất snapshot & video bằng chứng từ Ring Buffer.
   - Đẩy bản tin khẩn cấp tới **EMQX (`care/{house}/alert`)**; đồng thời worker `VideoArchive` mã hóa & upload ảnh/video lên **AWS S3 (`AES256`)**.
2. **Tiếp nhận & Điều phối tại Cloud Backend (`AWS EC2`):**
   - `MQTTSubscriber` tạo bản ghi `Incident` trong **AWS RDS PostgreSQL 18.3**, xóa cache `cache:incidents:*` và đẩy vào hàng đợi `alerts:recent` trên **Redis 7.2**.
   - Phát đồng thời qua **WebSocket `/ws/alerts`** & `/ws/vitals/{device_id}` tới Mobile App, Web Admin và Doctor Web.
   - Khi `VideoArchive` gọi `POST /api/v1/camera/archive`, Backend xác nhận file trên S3, liên kết `/api/v1/camera/archive/{id}/playback` vào `incident.video_clip_url` / `thumbnail_url` và phát event `ALERT_MEDIA_UPDATED`.
   - Gửi **Firebase FCM High-Priority** kèm presigned thumbnail URL (hạn 3600s) về điện thoại người thân. Nếu sau 45s chưa có phản hồi xác nhận, `EscalationService` kích hoạt quy trình nâng cấp cảnh báo.
3. **Xem lại bằng chứng trên App:**
   - Người dùng bấm xem video: Backend kiểm tra quyền `can_view_camera` rồi cấp **S3 Presigned GET URL** (hạn 300s) để phát trực tiếp an toàn.

---

## 🔐 6. Quản Lý Bảo Mật & Khóa Bí Mật

- **Loại trừ khỏi Git (`.gitignore`):** `.env`, `.env.*` (trừ `.env.example` / `.env.camera.example`), `firebase-service-account*.json`, `google-services*.json`, chứng chỉ TLS local (`.local/video-tls/`), khóa model & file binaries nhị phân.
- **CORS (`app/main.py`):** Chấp nhận các origin tường minh (`localhost`, `127.0.0.1`, `smart-elderly-care-doctor.web.app`, `smart-elderly-care-ai-cap1.web.app`, `ALLOWED_ORIGINS`) cùng regex `^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+|.*\.web\.app|.*\.firebaseapp\.com)(:\d+)?$`.
- **Nguyên tắc tối thiểu quyền AWS IAM:** Tiến trình capture trên Edge chỉ cần `s3:PutObject`, `s3:AbortMultipartUpload` trong prefix `cameras/<CAMERA_DEVICE_ID>/*` (và prefix evidence tương ứng); Backend chỉ cần `s3:GetObject` / `PutObject` theo bucket cấu hình `elderly-care-incidents-c1se34`. *(Lưu ý: tuyệt đối không commit secret thật vào script hoặc file tài liệu).*

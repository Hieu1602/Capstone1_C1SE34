# 🏥 Smart Elderly Care AI (SECA) — Hệ Thống Chăm Sóc Người Cao Tuổi Thông Minh
### Đồ Án Capstone 1 — Nhóm C1SE.34 | Đại Học Duy Tân (2026)

> **Hệ thống giám sát, phát hiện té ngã, theo dõi sinh hiệu 24/7, quản lý bệnh án/đơn thuốc/lịch khám lâm sàng và cảnh báo khẩn cấp thời gian thực cho người cao tuổi, kết hợp Edge AI Computing với AWS Cloud & Google Firebase.**

---

<p align="center">
  <img src="https://img.shields.io/badge/Repository-Capstone1__C1SE34-1E88E5?style=for-the-badge&logo=github&logoColor=white" alt="Repo" />
  <img src="https://img.shields.io/badge/Architecture-AWS%20%2B%20Firebase-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="Multi-Cloud" />
  <img src="https://img.shields.io/badge/Database-AWS%20RDS%20PG18-527FFF?style=for-the-badge&logo=postgresql&logoColor=white" alt="AWS RDS PG18" />
  <img src="https://img.shields.io/badge/Cache-Redis%207.2-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%26%20Python%203.11-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Web%20Portals-React%2018%20%2B%20Vite-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Web & Doctor Portals" />
  <img src="https://img.shields.io/badge/Mobile-React%20Native%20Expo%20~58-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/Edge%20AI-YOLOv8%20%2B%20Sensor%20Fusion-FF6F00?style=for-the-badge&logo=python&logoColor=white" alt="Edge AI" />
</p>

---

## 📌 Mục Lục
1. [Tính Năng Cốt Lõi](#-tính-năng-cốt-lõi)
2. [Kiến Trúc Hạ Tầng Đám Mây](#-kiến-trúc-hạ-tầng-đám-mây)
3. [Cấu Trúc Thư Mục Dự Án](#-cấu-trúc-thư-mục-dự-án)
4. [Tài Liệu Kỹ Thuật](#-tài-liệu-kỹ-thuật)
5. [Hướng Dẫn Cài Đặt & Khởi Chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
6. [Quy Trình CI/CD](#-quy-trình-cicd)
7. [Thành Viên Dự Án](#-thành-viên-dự-án-nhóm-c1se34)

---

## 🌟 Tính Năng Cốt Lõi

- **👁️ Phát Hiện Té Ngã & Ghi Hình Riêng Tư (Edge Vision + VideoArchive):**
  - YOLOv8-Pose + phân tích động học cột sống & hợp nhất đa cảm biến (Camera RTSP, vòng đeo tay BLE, cảm biến nhiệt AMG8833, âm thanh YAMNet) giúp phát hiện té ngã sớm và giảm báo động giả.
  - Ghi phân đoạn HLS 2 giây & clip bằng chứng sự cố trực tiếp lên **AWS S3 Private Bucket** (`AES256`), phát lại qua **Presigned GET URL** có kiểm tra quyền `can_view_camera` và hỗ trợ đàm thoại 2 chiều WebRTC qua `go2rtc`.
- **💓 Giám Sát Sinh Hiệu & Phát Hiện Loạn Nhịp (Vital State Machine):**
  - Pipeline 4 tầng trên Redis (`secai:lock/state/episodes/cooldown`) kết hợp lưu chuỗi thời gian `vital_signs` giúp phát hiện cơn nhịp tim bất thường tái diễn và cá nhân hóa ngưỡng theo từng người cao tuổi.
- **🩺 Quản Lý Y Tế 2 Chiều (Bác Sĩ – Gia Đình):**
  - Hỗ trợ luồng **Lịch khám 2 chiều** (tạo, xác nhận lẫn nhau, dời lịch/hủy kèm lý do, lặp định kỳ), **Đơn thuốc điện tử**, **Phát giọng nói tiếng Việt qua loa camera** nhắc uống thuốc/uống nước/lịch khám và hồ sơ bệnh án phân quyền RBAC.
- **🚨 Cảnh Báo Khẩn Cấp Thời Gian Thực:**
  - Kênh **WebSocket (`/ws/alerts`, `/ws/vitals/{device_id}`)** kết hợp **Firebase Cloud Messaging (FCM)** mức ưu tiên cao & tự động nâng cấp sự cố (`EscalationService` sau 45s chưa xử lý).
- **🤖 Trợ Lý Y Tế AI (RAG + LLM):**
  - Kết hợp tài liệu y khoa nội bộ (RAG) và Google Gemini (`gemini-3.1-flash-lite` / `gemini-2.5-flash`, fallback OpenAI `gpt-4o-mini`) kèm cảnh báo miễn trừ trách nhiệm y khoa.
- **🖥️ 3 Ứng Dụng Client Đồng Bộ:**
  - **Mobile App (`apps/mobile`):** React Native / Expo (~58) cho Gia đình, Người cao tuổi và Bác sĩ.
  - **Web Admin Portal (`apps/web`):** Quản trị người dùng, RBAC, chính sách bảo mật, audit logs, hạ tầng & thông báo toàn hệ thống (`https://smart-elderly-care-ai-cap1.web.app`).
  - **Doctor Web Portal (`apps/doctor-web`):** Cổng làm việc chuyên biệt cho bác sĩ gia đình (`https://smart-elderly-care-doctor.web.app`).

---

## ☁️ Kiến Trúc Hạ Tầng Đám Mây

```
                         ┌──────────────────────────────────────────────┐
                         │            NGƯỜI DÙNG & CLIENT               │
                         └──┬──────────────────┬─────────────────────┬──┘
                            │                  │                     │
              HTTPS / CDN   │                  │ HTTPS / CDN         │ FCM Push
           (Web Admin Portal)                  │ (Doctor Web Portal) │ Notifications
                            ▼                  ▼                     ▲
               ┌────────────────────────┐ ┌────────────────────────┐ │
               │    FIREBASE HOSTING    │ │    FIREBASE HOSTING    │ │ ┌──────────────────┐
               │ smart-elderly-care-ai- │ │ smart-elderly-care-    │ │ │   FIREBASE FCM   │
               │ cap1.web.app           │ │ doctor.web.app         │ │ │ (Firebase Admin) │
               └────────────┬───────────┘ └────────────┬───────────┘ │ └────────▲─────────┘
                            │                          │             │          │
                            └──────────┬───────────────┘             │          │
                                       │ REST (/api/v1) & WS (/ws)   │          │
                                       ▼                             │          │
┌────────────────────────────────────────────────────────────────────┴──────────┴──────────┐
│                              AMAZON WEB SERVICES (AWS)                                   │
│   ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│   │ AWS EC2 (16.178.128.42) — Docker Compose                                          │  │
│   │ • FastAPI Backend (:8000)   • Redis 7.2 (:6379)   • EMQX 5.6.0 (:1883/:8883)      │  │
│   └───────────┬──────────────────────────┬──────────────────────────────────▲─────────┘  │
│               │ asyncpg (SSL :5432)      │ Boto3 HEAD & Presigned (300s)    │ MQTT       │
│               ▼                          ▼                                  │            │
│   ┌───────────────────────┐  ┌─────────────────────────────────────┐        │            │
│   │ AWS RDS PG 18.3       │  │ AWS S3 Private Bucket               │        │            │
│   │ seca.cdeea4mcuj3h...  │  │ elderly-care-incidents-c1se34       │        │            │
│   │ (22 bảng, 284 cột)    │  │ (HLS 2s, Evidence Clip, Snapshot)   │        │            │
│   └───────────────────────┘  └──────────────────▲──────────────────┘        │            │
└─────────────────────────────────────────────────┼───────────────────────────┼────────────┘
                                                  │ PutObject (AES256)        │
                                    ┌─────────────┴───────────────────────────┴───────────┐
                                    │   EDGE GATEWAY & TAPO CAPTURE (Orange Pi / LAN)     │
                                    └─────────────────────────────────────────────────────┘
```

| Dịch vụ Cloud | Thành phần đảm nhiệm | Trách nhiệm chính |
| :--- | :--- | :--- |
| **AWS EC2** | `FastAPI`, `Redis`, `EMQX` | Máy chủ trung tâm xử lý REST API, WebSocket, MQTT Broker, cache & scheduler nền. |
| **AWS RDS** | `Managed PostgreSQL 18.3` | Nguồn dữ liệu quan hệ duy nhất (22 bảng, 284 cột) kết nối bắt buộc SSL (`ssl=require`). |
| **AWS S3** | `elderly-care-incidents-c1se34` | Bucket riêng tư (`AES256`, Block Public Access) lưu video HLS 2s & bằng chứng sự cố, phát qua Presigned URL. |
| **Firebase** | `Hosting` & `FCM` | Phân phối **Web Admin** và **Doctor Web** qua CDN toàn cầu; đẩy cảnh báo khẩn cấp SOS/té ngã & nhắc lịch tới Mobile. |

---

## 📂 Cấu Trúc Thư Mục Dự Án

```
Capstone1_C1SE34/
├── .github/workflows/deploy.yml   # CI/CD GitHub Actions (Web Admin, Doctor Web, EC2 Backend)
├── docs/                          # Tài liệu kỹ thuật hệ thống
│   ├── ARCHITECTURE.md            # Kiến trúc phần mềm & Allocation View (SEI / ISO 42010)
│   ├── CLOUD_INFRASTRUCTURE.md    # Kiến trúc hạ tầng AWS (EC2/RDS/S3) & Firebase
│   ├── DATABASE_SCHEMA.md         # Đặc tả đầy đủ 22 bảng & 284 cột PostgreSQL
│   └── REDIS_ARCHITECTURE.md      # Thiết kế Redis Keyspace, State Machine & API/WS
├── smart-elderly-care-ai/
│   ├── apps/
│   │   ├── mobile/                # Mobile App (React Native / Expo ~58, FSD + Zustand)
│   │   ├── web/                   # Web Admin Portal (React 18, Vite :3000, TailwindCSS)
│   │   └── doctor-web/            # Doctor Web Portal (React 18, Vite :3001, TailwindCSS)
│   ├── backend/                   # Cloud API (FastAPI, Python 3.11)
│   │   ├── app/api/v1/endpoints/  # 20 REST modules (15 mobile/ + 5 web_admin/)
│   │   ├── app/api/websockets/    # /ws/vitals/{device_id} & /ws/alerts
│   │   ├── app/core/              # config, database, security, audit, i18n, seed_data
│   │   ├── app/crud/              # Repository layer (Data Access)
│   │   ├── app/models/            # SQLAlchemy ORM models
│   │   ├── app/schemas/           # Pydantic schemas
│   │   ├── app/services/          # Chatbot RAG, MQTT, Redis, S3, FCM/OTP, Schedulers, Vitals SM
│   │   └── tests/                 # Pytest unit/E2E & Node client contract tests
│   ├── edge/                      # Edge AI Gateway & Tapo Camera HTTP / VideoArchive
│   ├── docker-compose.yml         # Backend, Redis, EMQX (+ TimescaleDB PG16 cho local Dev)
│   ├── docker-compose.camera.yml  # Tapo Camera, go2rtc WebRTC & SSH camera-tunnel
│   └── .env.example               # Mẫu biến môi trường hệ thống
├── start.bat                      # Menu khởi động trên Windows
├── start.ps1                      # Script PowerShell (-Target all|docker|backend|web|doctor|mobile|edge|test|stop)
├── start.sh                       # Script Bash trên macOS / Linux
└── README.md
```

---

## 📑 Tài Liệu Kỹ Thuật

- 📘 [Kiến Trúc Phần Mềm & Allocation View (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- ☁️ [Kiến Trúc Hạ Tầng Đám Mây (docs/CLOUD_INFRASTRUCTURE.md)](docs/CLOUD_INFRASTRUCTURE.md)
- 🗄️ [Cấu Trúc Cơ Sở Dữ Liệu PostgreSQL (docs/DATABASE_SCHEMA.md)](docs/DATABASE_SCHEMA.md)
- ⚡ [Kiến Trúc & Keyspace Redis (docs/REDIS_ARCHITECTURE.md)](docs/REDIS_ARCHITECTURE.md)

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu Cầu Môi Trường
- **Node.js:** `20.x` trở lên & `npm`
- **Python:** `3.11+`
- **Docker:** Docker Engine & Docker Compose V2

### 2. Thiết Lập Biến Môi Trường (`.env`)
```bash
cd smart-elderly-care-ai
cp .env.example .env
```
*(Điền `DATABASE_URL` / `DOCKER_DATABASE_URL`, `REDIS_PASSWORD`, `SECRET_KEY`, `AWS_*`, `LLM_API_KEY`, và đặt `firebase-service-account.json` / `google-services.json` theo đường dẫn cấu hình; không commit lên Git).*

### 3. Khởi Động Nhanh (Windows / Linux / macOS)

#### Windows (PowerShell hoặc `start.bat`):
```powershell
# Khởi động đầy đủ Docker (TimescaleDB/Redis/EMQX), Backend (:8000), Web Admin (:3000), Doctor Web (:3001) & Mobile Web (:8081)
.\start.ps1 -Target all

# Hoặc chạy từng thành phần / dừng toàn bộ:
.\start.ps1 -Target backend
.\start.ps1 -Target web
.\start.ps1 -Target doctor
.\start.ps1 -Target mobile
.\start.ps1 -Target stop
```

#### macOS / Linux:
```bash
chmod +x start.sh
./start.sh
```

### 4. Khởi Chạy Thủ Công Từng Thành Phần

- **Hạ tầng Docker & Backend:**
  ```bash
  cd smart-elderly-care-ai
  docker compose up -d backend redis emqx
  # Hoặc chạy local DB offline: docker compose up -d timescaledb redis emqx
  ```
  - Swagger UI: `http://localhost:8000/docs` *(hoặc `/api/docs`)*
  - EMQX Dashboard: `http://localhost:18083`

- **Web Admin Portal (`apps/web`, port `3000`):**
  ```bash
  cd smart-elderly-care-ai/apps/web
  npm install && npm run dev
  ```

- **Doctor Web Portal (`apps/doctor-web`, port `3001`):**
  ```bash
  cd smart-elderly-care-ai/apps/doctor-web
  npm install && npm run dev
  ```

- **Mobile App (`apps/mobile`, Expo `:8081`):**
  ```bash
  cd smart-elderly-care-ai/apps/mobile
  npm install && npx expo start
  ```

- **Edge AI Gateway (`edge/`):**
  ```bash
  cd smart-elderly-care-ai/edge
  python -m venv .venv
  source .venv/bin/activate   # Windows: .venv\Scripts\activate
  pip install -r requirements.txt
  python src/main.py
  ```

---

## 🔄 Quy Trình CI/CD

Workflow GitHub Actions ([deploy.yml](.github/workflows/deploy.yml)) tự động chạy khi push lên nhánh `main` (hoặc kích hoạt thủ công qua `workflow_dispatch`) với **3 job song song**:

1. **Deploy Web Admin (`apps/web`):** Node 20 -> `npm ci && npm run build` (`VITE_API_URL=http://16.178.128.42:8000/api/v1`) -> Firebase Hosting (`smart-elderly-care-ai-cap1.web.app`).
2. **Deploy Doctor Web (`apps/doctor-web`):** Node 20 -> `npm ci && npm run build` (`VITE_API_URL`, `VITE_WS_URL`) -> Firebase Hosting (`smart-elderly-care-doctor.web.app`).
3. **Deploy Backend (`AWS EC2 16.178.128.42`):** SSH đồng bộ nhánh `main`, chạy `sync_ec2_env.py`, và khởi động lại container `backend` qua `docker compose up -d --build backend`.

---

## 👥 Thành Viên Dự Án (Nhóm C1SE.34)

| STT | Họ và Tên | Vai trò chính |
| :---: | :--- | :--- |
| 1 | **Dương Văn Hiếu** | **Trưởng nhóm (Team Leader)** — Kiến trúc hệ thống, Backend Cloud & AI Integration |
| 2 | **Nguyễn Hữu Nghĩa** | Phát triển Hạ tầng Đám mây (AWS EC2/RDS/S3, Firebase) & Backend Service |
| 3 | **Trần Văn Duy** | Phát triển Ứng dụng Di động Mobile App (React Native Expo) & Giao diện người dùng |
| 4 | **Ngô Lê Vĩnh** | Phát triển Module Biên Edge Computing (YOLOv8-Pose, Sensor Fusion, Hardware) |
| 5 | **Phan Nguyễn Giang My** | Phát triển Cổng Quản trị Web Admin Portal, Tài liệu y khoa & Báo cáo đề tài |

---
<p align="center">
  <i>Đồ án Capstone 1 (C1SE.34) — Khoa Đào Tạo Quốc Tế / Công Nghệ Thông Tin — Đại Học Duy Tân (2026)</i>
</p>

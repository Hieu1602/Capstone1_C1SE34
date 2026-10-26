# 🏥 Smart Elderly Care AI — Hệ Thống Chăm Sóc Người Cao Tuổi Thông Minh
### Đồ Án Capstone 1 — Nhóm C1SE.34 | Nghiên Cứu Khoa Học (NCKH 2026)

> **Hệ thống giám sát, phát hiện té ngã, theo dõi sinh hiệu 24/7 và cảnh báo khẩn cấp thời gian thực cho người cao tuổi ứng dụng AI Edge Computing kết hợp Hạ tầng Đám mây Đa nền tảng (Multi-Cloud: AWS, Supabase, Firebase).**

---

<p align="center">
  <img src="https://img.shields.io/badge/Repository-Capstone1__C1SE34-1E88E5?style=for-the-badge&logo=github&logoColor=white" alt="Repo" />
  <img src="https://img.shields.io/badge/Architecture-Multi--Cloud-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="Multi-Cloud" />
  <img src="https://img.shields.io/badge/Database-Supabase%20PG17-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Frontend-Firebase%20Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%26%20Python%203.11-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Mobile-React%20Native%20Expo-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/Edge%20AI-YOLOv8%20%2B%20Sensor%20Fusion-FF6F00?style=for-the-badge&logo=python&logoColor=white" alt="Edge AI" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI/CD" />
</p>

---

## 📌 Mục Lục
1. [Tính Năng Cốt Lõi (Core Features)](#-tính-năng-cốt-lõi-core-features)
2. [Kiến Trúc Hạ Tầng Đám Mây (Multi-Cloud Architecture)](#-kiến-trúc-hạ-tầng-đám-mây-multi-cloud-architecture)
3. [Cấu Trúc Thư Mục Dự Án (Project Structure)](#-cấu-trúc-thư-mục-dự-án-project-structure)
4. [Tài Liệu Kỹ Thuật (Technical Documentation)](#-tài-liệu-kỹ-thuật-technical-documentation)
5. [Hướng Dẫn Cài Đặt & Khởi Chạy (Getting Started)](#-hướng-dẫn-cài-đặt--khởi-chạy-getting-started)
6. [Quy Trình Tự Động Hóa CI/CD (DevOps & Deployment)](#-quy-trình-tự-động-hóa-cicd-devops--deployment)
7. [Thành Viên Dự Án (Team Members)](#-thành-viên-dự-án-nhóm-c1se34)

---

## 🌟 Tính Năng Cốt Lõi (Core Features)

* **👁️ Thị Giác Máy Tính & Phát Hiện Té Ngã Tức Thời (Edge Vision):**
  * Sử dụng mô hình **YOLOv8-Pose** và thuật toán phân tích động học cột sống & vận tốc rơi hông (`drop_velocity`) để phát hiện ngã ngay trong giai đoạn đang rơi (**0.2s – 0.6s**).
  * Bộ đệm vòng RAM (**Video Ring Buffer**) tự động trích xuất đoạn **video 5 giây trước sự cố** và 3 ảnh bằng chứng (-3s, -1.5s, 0s) tải trực tiếp lên AWS S3.
* **⌚ Đa Cảm Biến Hợp Nhất (Sensor Fusion Decision Matrix):**
  * Thu thập dữ liệu từ Camera AI, Vòng đeo tay BLE (Nhịp tim, SpO₂), Cảm biến nhiệt AMG8833 và Âm thanh khẩn cấp (YAMNet) nhằm loại trừ triệt để báo động giả.
* **🚨 Cảnh Báo Khẩn Cấp Sinh Tử (Critical Alert Push Notifications):**
  * Tích hợp **Firebase Cloud Messaging (FCM)** gửi còi hú SOS đến điện thoại người nhà chỉ trong **1-2 giây**, ghi đè chế độ Im Lặng / Không Làm Phiền của thiết bị di động.
* **🤖 Trợ Lý Y Tế Ảo Google Gemini AI:**
  * Hỏi đáp y tế thông minh, tóm tắt diễn biến sức khỏe hàng tuần và đưa ra khuyến nghị phòng ngừa rủi ro cho bác sĩ và người thân.
* **📊 Quản Trị Hệ Thống Tập Trung (Web Admin Portal & Mobile App):**
  * **Web Admin:** Phân phối toàn cầu qua Firebase Hosting, giám sát sức khỏe, quản lý thiết bị IoT, phân quyền hộ gia đình (`owner`, `caregiver`, `doctor`, `admin`).
  * **Mobile App:** Ứng dụng di động React Native đa nền tảng (Android/iOS) xem video sự cố, đồ thị sinh hiệu thời gian thực và nhận thông báo SOS.

---

## ☁️ Kiến Trúc Hạ Tầng Đám Mây (Multi-Cloud Architecture)

Hệ thống áp dụng mô hình điện toán đám mây đa nền tảng tối ưu hóa tài nguyên giữa **AWS**, **Supabase Cloud** và **Google Firebase**:

```
                         ┌──────────────────────────────────────────────┐
                         │            NGƯỜI DÙNG & GIAO DIỆN             │
                         └───────┬──────────────────────────────┬───────┘
                                 │                              │
                HTTPS / CDN      │                              │ Push Notifications (FCM)
             (Tải Web Dashboard) │                              │ (Còi hú SOS, Báo động ngã)
                                 ▼                              ▼
                   ┌───────────────────────────┐  ┌───────────────────────────┐
                   │      GOOGLE FIREBASE      │  │      GOOGLE FIREBASE      │
                   │      Firebase Hosting     │  │ Firebase Cloud Messaging  │
                   │  (https://smart-elderly-  │  │          (FCM)            │
                   │   care-ai-cap1.web.app)   │  │                           │
                   └─────────────┬─────────────┘  └─────────────▲─────────────┘
                                 │                              │
                                 │ REST API                     │ Gửi thông báo
                                 │ (http://16.178.128.42:8000)  │ qua Firebase Admin SDK
                                 ▼                              │
┌───────────────────────────────────────────────────────────────┴────────────────────────────────┐
│                                 AMAZON WEB SERVICES (AWS)                                      │
│                                                                                                │
│   ┌────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │  AWS EC2 Cloud Server (Ubuntu — IP: 16.178.128.42)                                     │   │
│   │  - FastAPI Backend (:8000)                                                             │   │
│   │  - Redis In-Memory Cache & Pub/Sub (:6379)                                             │   │
│   │  - EMQX MQTT Broker (:1883 / :8883 / :18083)                                           │   │
│   └────────────────────────────┬──────────────────────────────┬────────────────────────────┘   │
│                                │                              │                                │
│                                │                              ▼                                │
│                                │             ┌───────────────────────────────────┐             │
│                                │             │  AWS S3 (Simple Storage Service)  │             │
│                                │             │  Region: ap-southeast-2 Sydney    │             │
│                                │             │  Bucket: elderly-care-incidents...│             │
│                                │             │  (Video sự cố 5s, Thumbnails)     │             │
│                                │             └───────────────────────────────────┘             │
└────────────────────────────────┼──────────────────────────────▲────────────────────────────────┘
                                 │                              │
                                 │ MQTT Telemetry & Alerts      │ Upload Video Clip 5s
                                 │ (Port 1883)                  │ (S3 SDK)
                   ┌─────────────┴──────────────────────────────┴──────┐
                   │        EDGE GATEWAY (Orange Pi / AI Camera)       │
                   └─────────────────────────────┬─────────────────────┘
                                                 │
                                                 │ Kết nối cơ sở dữ liệu quan hệ
                                                 ▼
                   ┌───────────────────────────────────────────────────┐
                   │                  SUPABASE CLOUD                   │
                   │              Managed PostgreSQL 17                │
                   │       (db.lwvoaznmrciezcwktmlg.supabase.co)       │
                   │       - Users, Houses, Patients, Devices          │
                   │       - Vitals Time-series & Incident Logs        │
                   └───────────────────────────────────────────────────┘
```

| Dịch vụ Cloud | Thành phần đảm nhiệm | Trách nhiệm chính trong hệ thống |
| :--- | :--- | :--- |
| **AWS EC2** | `FastAPI`, `Redis`, `EMQX` | Máy chủ tính toán trung tâm, xử lý API nghiệp vụ, điều phối dữ liệu thời gian thực và trạm thu phát MQTT. |
| **AWS S3** | `elderly-care-incidents-c1se34` | Lưu trữ video clip 5 giây trước khi ngã, ảnh trích xuất hiện trường và file âm thanh bằng chứng. |
| **Supabase Cloud**| `Managed PostgreSQL 17` | Nguồn dữ liệu duy nhất (Single Source of Truth), tự động sao lưu, lưu trữ toàn vẹn hồ sơ bệnh nhân và sinh hiệu. |
| **Firebase** | `Hosting` & `FCM` | Phân phối Web Admin Portal toàn cầu qua CDN tốc độ cao và chuyển phát thông báo còi hú khẩn cấp đến Mobile App. |

---

## 📂 Cấu Trúc Thư Mục Dự Án (Project Structure)

```
Capstone1_C1SE34/
├── .github/workflows/          # Kịch bản CI/CD GitHub Actions (deploy.yml)
├── docs/                       # Tài liệu kiến trúc chuyên sâu của đồ án
│   ├── ARCHITECTURE.md         # Kiến trúc phần mềm (Clean Arch, Layered Arch, FSD)
│   ├── CLOUD_INFRASTRUCTURE.md # Kiến trúc hạ tầng đám mây Multi-Cloud chi tiết
│   └── REDIS_ARCHITECTURE.md   # Thiết kế bộ nhớ đệm Cache & Pub/Sub
├── smart-elderly-care-ai/
│   ├── apps/
│   │   ├── mobile/             # Ứng dụng di động React Native (Expo SDK 57)
│   │   │   ├── src/features/   # Feature-Sliced Design (auth, dashboard, alerts, doctor...)
│   │   │   └── src/store/      # Quản lý State tập trung với Zustand
│   │   └── web/                # Cổng Quản trị Web Admin (React 18, Vite, TailwindCSS)
│   │       ├── src/pages/      # Các trang Dashboard, Users, Devices, Incidents, Reports...
│   │       └── src/services/   # Kết nối Axios REST API Backend
│   ├── backend/                # Máy chủ Backend API (FastAPI, Python 3.11)
│   │   ├── app/api/v1/         # 13 REST API endpoints chuẩn hóa
│   │   ├── app/core/           # Cấu hình config, database, security, JWT
│   │   ├── app/models/         # SQLAlchemy ORM Models (Supabase PostgreSQL 17)
│   │   ├── app/services/       # Business logic (chatbot Gemini, storage S3, mqtt, redis...)
│   │   ├── Dockerfile          # Containerization cho máy chủ EC2
│   │   └── requirements.txt    # Danh mục thư viện Python Backend
│   ├── edge/                   # Module biên IoT Hub (Orange Pi / AI Camera)
│   │   ├── src/ai/             # YOLOv8-Pose Detector, YAMNet Sound, Face Re-ID
│   │   ├── src/drivers/        # Adapters cho Camera RTSP, Vòng tay BLE, Cảm biến AMG8833
│   │   ├── src/fusion/         # Ma trận quyết định chống báo giả & Video Ring Buffer
│   │   └── requirements.txt    # Thư viện Edge Computing
│   ├── docker-compose.yml      # Cấu hình Docker Compose cho AWS EC2 (Backend, Redis, EMQX)
│   └── .env.example            # Bản mẫu cấu hình biến môi trường
├── start.bat                   # Menu khởi động 1-Click tự động trên Windows
├── start.ps1                   # PowerShell Automation Script quản trị hệ thống
├── start.sh                    # Bash Script khởi động trên Linux / macOS
└── README.md                   # Tài liệu giới thiệu dự án
```

---

## 📑 Tài Liệu Kỹ Thuật (Technical Documentation)

Các tài liệu thiết kế hệ thống chi tiết được lưu trữ tại thư mục [`docs/`](docs/):

* 📘 [Kiến Trúc Hạ Tầng Đám Mây Đa Nền Tảng (CLOUD_INFRASTRUCTURE.md)](docs/CLOUD_INFRASTRUCTURE.md): Chi tiết cấu hình AWS EC2, AWS S3, Supabase Cloud, Firebase Hosting và Firebase Cloud Messaging.
* 📗 [Kiến Trúc Phần Mềm Toàn Hệ Thống (ARCHITECTURE.md)](docs/ARCHITECTURE.md): Phân tích nguyên tắc Clean Architecture (Edge), Layered Architecture (Backend) và Feature-Sliced Design (Mobile).
* 📙 [Kiến Trúc Bộ Nhớ Đệm & Pub/Sub (REDIS_ARCHITECTURE.md)](docs/REDIS_ARCHITECTURE.md): Chiến lược lưu cache, kiểm soát rate limit và trung chuyển gói tin WebSocket thời gian thực.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy (Getting Started)

### 1. Yêu Cầu Môi Trường (Prerequisites)
* **Node.js:** Phiên bản `20.x` trở lên & `npm`
* **Python:** Phiên bản `3.11.x`
* **Docker:** Docker Engine & Docker Compose V2

### 2. Thiết Lập Biến Môi Trường (.env)
Sao chép file cấu hình mẫu và cập nhật các thông số bảo mật:
```bash
cd smart-elderly-care-ai
cp .env.example .env
```
*(Cập nhật chuỗi kết nối Supabase `DATABASE_URL`, AWS S3 Credentials, Firebase Service Account và Gemini API Key)*.

---

### ⚡ Cách 1: Khởi Động Nhanh 1-Click (Khuyên Dùng)

#### Trên Windows:
Nhấp đúp chuột vào file [`start.bat`](start.bat) hoặc thực thi lệnh sau trong PowerShell:
```powershell
.\start.ps1 -Target all
```
*Script sẽ tự động kiểm tra dependencies, khởi động Docker (Redis, EMQX), chạy Backend FastAPI và bật Web Admin trên trình duyệt.*

#### Trên Linux / macOS:
```bash
chmod +x start.sh
./start.sh
```

---

### 🛠️ Cách 2: Khởi Chạy Thủ Công Từng Dịch Vụ

#### A. Hạ tầng Docker (Trên Cloud EC2 hoặc Local Dev)
```bash
cd smart-elderly-care-ai
docker compose up -d backend redis emqx
```
* **FastAPI Docs:** `http://localhost:8000/docs`
* **EMQX Dashboard:** `http://localhost:18083` *(admin / public)*
* **Redis Server:** `localhost:6379`

#### B. Cổng Quản Trị Web Admin (React Vite)
```bash
cd smart-elderly-care-ai/apps/web
npm install
npm run dev
```
Truy cập giao diện Web Admin tại: `http://localhost:3000` *(Bản trực tuyến: `https://smart-elderly-care-ai-cap1.web.app`)*.

#### C. Ứng Dụng Di Động Mobile App (React Native Expo)
```bash
cd smart-elderly-care-ai/apps/mobile
npm install
npx expo start
```
*Quét mã QR bằng ứng dụng **Expo Go** trên điện thoại Android/iOS.*

#### D. Edge AI Computing (Orange Pi / AI Camera)
```bash
cd smart-elderly-care-ai/edge
python -m venv .venv
source .venv/bin/activate  # Trên Windows: .venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

---

## 🔄 Quy Trình Tự Động Hóa CI/CD (DevOps & Deployment)

Dự án áp dụng quy trình tích hợp và triển khai liên tục (**CI/CD Pipeline**) thông qua GitHub Actions ([deploy.yml](.github/workflows/deploy.yml)):

* **Mỗi khi mã nguồn được merge vào nhánh `main`:**
  1. 🌐 **Tự động Deploy Web Admin:** GitHub Actions cài đặt dependencies, biên dịch mã nguồn (`npm run build`) và tải bản phát hành mới nhất lên **Firebase Hosting**.
  2. ☁️ **Tự động Deploy Backend:** Tự động kết nối SSH vào máy chủ **AWS EC2** (`16.178.128.42`), kéo code mới nhất từ Git và thực thi lệnh cập nhật:
     ```bash
     docker compose up -d --build backend
     ```
  3. 📦 **Dữ liệu & Tệp Đa Phương Tiện:** Tự động liên kết liên tục đến **Supabase Cloud Database** và **AWS S3 Bucket** mà không gây gián đoạn dịch vụ.

---

## 👥 Thành Viên Dự Án (Nhóm C1SE.34)

| STT | Họ và Tên | Vai trò chính |
| :---: | :--- | :--- |
| 1 | **Dương Văn Hiếu** | **Trưởng nhóm (Team Leader)** — Kiến trúc hệ thống, Backend Cloud & AI Integration |
| 2 | **Nguyễn Hữu Nghĩa** | Phát triển Hạ tầng Đám mây (AWS, Supabase, Firebase) & Backend Service |
| 3 | **Trần Văn Duy** | Phát triển Ứng dụng Di động Mobile App (React Native Expo) & Giao diện người dùng |
| 4 | **Ngô Lê Vĩnh** | Phát triển Module Biên Edge Computing (YOLOv8-Pose, Sensor Fusion, Hardware) |
| 5 | **Phan Nguyễn Giang My** | Phát triển Cổng Quản trị Web Admin Portal, Tài liệu y khoa & Báo cáo đề tài |

---
<p align="center">
  <i>Đồ án Capstone 1 (C1SE.34) — Khoa Đào Tạo Quốc Tế / Công Nghệ Thông Tin — Đại Học Duy Tân (2026)</i>
</p>

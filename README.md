# 🏥 Capstone 1 - Smart Elderly Care AI (Nhóm C1SE.34)

> **Hệ thống chăm sóc người cao tuổi thông minh với AI Edge Computing, phát hiện té ngã, giám sát sinh hiệu 24/7 và cảnh báo khẩn cấp thời gian thực.**

[![GitHub](https://img.shields.io/badge/Repository-Capstone1__C1SE34-blue?logo=github)](https://github.com/Hieu1602/Capstone1_C1SE34.git)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](smart-elderly-care-ai/backend)
[![React Native](https://img.shields.io/badge/Mobile-React%20Native%20%28Expo%29-61DAFB?logo=react)](smart-elderly-care-ai/apps/mobile)
[![Edge AI](https://img.shields.io/badge/Edge%20AI-YOLOv8%20%2B%20YAMNet-FF6F00?logo=python)](smart-elderly-care-ai/edge)

---

## 📁 Thư mục tài liệu dự án (`docs/`)

Toàn bộ tài liệu văn bản đề cương, đăng ký đề tài và danh mục thư viện được lưu trữ tại mục [`docs/`](docs/):

* 📑 **Bản thuyết minh đề tài (Proposal)**: [`C1SE.34-Proposal_Smart Elderly Care AI_version-1 (2).docx`](docs/C1SE.34-Proposal_Smart%20Elderly%20Care%20AI_version-1%20(2).docx) | [`Bản PDF`](docs/C1SE.34-Proposal_Smart%20Elderly%20Care%20AI_version-1.pdf)
* 📑 **Đề cương Nghiên cứu Khoa học (NCKH 2026)**: [`C1SE.34_NCKH_2026.doc`](docs/C1SE.34_NCKH_2026.doc)
* 📑 **Phiếu đăng ký đề tài Capstone Project**: [`CAPSTONE PROJECT REGISTRATION FORM (1).docx`](docs/CAPSTONE%20PROJECT%20REGISTRATION%20FORM%20(1).docx) | [`Bản PDF`](docs/CAPSTONE%20PROJECT%20REGISTRATION%20.pdf)
* 📑 **Báo cáo minh bạch sử dụng AI (CMU Format)**: [`2- AI USAGE DISCLOSURE STATEMENT (CMU).docx`](docs/2-%20AI%20USAGE%20DISCLOSURE%20STATEMENT%20(CMU).docx) | [`Bản PDF`](docs/2-%20AI%20USAGE%20DISCLOSURE%20STATEMENT%20(CMU).pdf)
* 📦 **Hướng dẫn chi tiết toàn bộ thư viện cần tải**: [`THU_VIEN_VA_TAI_LIEU.md`](docs/THU_VIEN_VA_TAI_LIEU.md)

---

## 🏗️ Kiến trúc tổng thể hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUD BACKEND                            │
│  FastAPI ──── TimescaleDB ──── Redis ──── MinIO                 │
│      │              │                                           │
│  WebSocket      MQTT Sub                  FCM                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ MQTT (TLS)
┌──────────────────────▼──────────────────────────────────────────┐
│               EDGE HUB (Orange Pi 5)                            │
│  YOLOv8-Pose ── YAMNet ── BLE Band ── AMG8833 ── Sensor Fusion │
│  RTSP Stream ── Local Speaker ── Ring Buffer ── MQTT Publisher  │
└──────────────────────────────────────────────────────────────────┘
                       │ RTSP / WebRTC
┌──────────────────────▼──────────────────────────────────────────┐
│               MOBILE APP (React Native)                         │
│  Dashboard ── Alerts ── LiveStream ── History                   │
│  WebSocket ── FCM Push ── Axios API ── Zustand Store            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 Danh sách thư viện cần cài đặt (Dependencies)

> *Lưu ý: Thư mục chứa thư viện thực tế (`node_modules/`, `.venv/`) không được đẩy lên Git theo tiêu chuẩn. Người dùng cần cài đặt theo hướng dẫn dưới đây.*

### 1. 📱 Mobile App (`smart-elderly-care-ai/apps/mobile`)
```bash
cd smart-elderly-care-ai/apps/mobile
npm install
```
* **Các thư viện chính**: `expo` (~51.0), `react-native` (0.74.3), `@react-navigation/*`, `zustand`, `axios`, `@react-native-firebase/messaging` (FCM), `victory-native`, `@shopify/react-native-skia`, `react-native-video`.

### 2. 🖥️ Cloud Backend (`smart-elderly-care-ai/backend`)
```bash
cd smart-elderly-care-ai/backend
python -m venv .venv
# Kích hoạt venv (Windows: .venv\Scripts\activate | Linux: source .venv/bin/activate)
pip install -r requirements.txt
```
* **Các thư viện chính**: `fastapi`, `uvicorn`, `sqlalchemy[asyncio]`, `asyncpg` (TimescaleDB), `alembic`, `redis[asyncio]`, `pydantic`, `python-jose`, `passlib[bcrypt]`, `paho-mqtt`, `firebase-admin`, `minio`, `reportlab`, `openpyxl`.

### 3. 🧠 Edge Hub AI (`smart-elderly-care-ai/edge`)
```bash
cd smart-elderly-care-ai/edge
python -m venv .venv
pip install -r requirements.txt
```
* **Các thư viện chính**: `opencv-python-headless`, `numpy`, `onnxruntime`, `tflite-runtime`, `sounddevice`, `gtts`, `pygame`, `bleak` (BLE Band), `smbus2` (I2C Thermal AMG8833), `paho-mqtt`, `aiortc` (WebRTC).

---

## 🚀 Hướng dẫn khởi chạy nhanh

### 1. Khởi động hạ tầng Docker
```bash
cd smart-elderly-care-ai
docker-compose up -d
```
* TimescaleDB: `localhost:5432`
* EMQX MQTT Broker Dashboard: `http://localhost:18083` (admin / public)
* MinIO Console: `http://localhost:9001`
* Redis: `localhost:6379`

### 2. Chạy Backend
```bash
cd smart-elderly-care-ai/backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```
Swagger UI tài liệu API: `http://localhost:8000/api/docs`

### 3. Chạy Mobile App
```bash
cd smart-elderly-care-ai/apps/mobile
npx expo start
```

---

## 👥 Nhóm tác giả (C1SE.34)

* **Dương Văn Hiếu** (Leader)
* **Nguyễn Hữu Nghĩa**
* **Trần Văn Duy**
* **Ngô Lê Vĩnh**
* **Phan Nguyễn Giang My**

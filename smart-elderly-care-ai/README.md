# 🏥 Smart Elderly Care AI

> Hệ thống chăm sóc người cao tuổi thông minh với AI Edge Computing, phát hiện té ngã, giám sát sinh hiệu 24/7 và cảnh báo khẩn cấp thời gian thực.

---

## 🏗️ Kiến trúc hệ thống

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
                       │
              RTSP / WebRTC
┌──────────────────────▼──────────────────────────────────────────┐
│               MOBILE APP (React Native)                         │
│  Dashboard ── Alerts ── LiveStream ── History                   │
│  WebSocket ── FCM Push ── Axios API ── Zustand Store            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📁 Cấu trúc dự án

```
smart-elderly-care-ai/
├── docs/                           # Tài liệu SRS, API docs, thiết kế
├── edge/                           # Mã nguồn Edge Hub (Orange Pi 5)
│   ├── config/config.yaml          # Cấu hình thiết bị & ngưỡng cảnh báo
│   ├── src/
│   │   ├── ai/vision/              # YOLOv8-Pose Fall Detection (RKNN/ONNX)
│   │   ├── ai/audio/               # YAMNet Sound Classifier (TFLite)
│   │   ├── drivers/                # Camera, AMG8833, BLE Band
│   │   ├── fusion/                 # Decision Matrix + Ring Buffer
│   │   ├── services/               # MQTT, Speaker, RTSP/WebRTC
│   │   └── main.py                 # Entry point
│   └── Dockerfile.edge
├── backend/                        # FastAPI Cloud Backend
│   ├── app/
│   │   ├── api/v1/                 # REST endpoints
│   │   ├── api/websockets/         # Real-time WebSocket
│   │   ├── core/                   # Config, Security, Database
│   │   ├── crud/                   # Repository pattern
│   │   ├── models/                 # SQLAlchemy ORM
│   │   ├── schemas/                # Pydantic DTOs
│   │   └── services/               # MQTT, FCM, MinIO
│   ├── migrations/                 # Alembic
│   └── Dockerfile
├── apps/mobile/                    # React Native App
│   ├── src/features/               # Dashboard, Alerts, LiveStream, History
│   ├── src/services/               # API, WebSocket, FCM
│   ├── src/store/                  # Zustand state management
│   └── App.tsx
└── docker-compose.yml              # Cloud deployment
```

---

## 🚀 Khởi động nhanh

### 1. Cloud Backend

```bash
# Tạo file .env
cp .env.example .env
# Chỉnh sửa các giá trị SECRET_KEY, POSTGRES_PASSWORD, v.v.

# Khởi động tất cả services
docker-compose up -d

# Chạy database migrations
docker-compose exec backend alembic upgrade head

# API docs: http://localhost:8000/api/docs
# EMQX Dashboard: http://localhost:18083 (admin/public)
# MinIO Console: http://localhost:9001
```

### 2. Edge Hub (Orange Pi 5)

```bash
cd edge
pip install -r requirements.txt

# Đặt model files vào:
# src/ai/vision/models/yolov8n-pose.rknn  (hoặc .onnx)
# src/ai/audio/models/yamnet.tflite

# Cấu hình
nano config/config.yaml  # Điền MQTT broker, BLE MAC, v.v.

# Chạy
python -m src.main

# Hoặc Docker
docker build -f Dockerfile.edge -t edge-hub .
docker run --privileged --network host edge-hub
```

### 3. Mobile App

```bash
cd apps/mobile
npm install
npx expo start

# Android: a
# iOS: i
```

---

## 🧩 Công nghệ sử dụng

| Layer          | Công nghệ                                    |
|----------------|----------------------------------------------|
| Edge AI        | YOLOv8-Pose (RKNN/ONNX), YAMNet (TFLite)    |
| Edge Hardware  | Orange Pi 5 (RK3588 NPU), AMG8833, BLE Band |
| Edge Runtime   | Python asyncio, OpenCV, Bleak, paho-mqtt     |
| Backend        | FastAPI, SQLAlchemy async, TimescaleDB       |
| Messaging      | EMQX MQTT Broker (QoS 0/1/2)               |
| Storage        | MinIO S3-compatible, Redis                   |
| Push Notify    | Firebase Cloud Messaging (FCM)               |
| Mobile         | React Native (Expo), Zustand, Victory Native |
| Deployment     | Docker Compose, Alembic migrations           |

---

## ⚙️ Biến môi trường

Xem [`.env.example`](.env.example) để biết danh sách đầy đủ.

| Biến                | Mô tả                          |
|---------------------|--------------------------------|
| `SECRET_KEY`        | JWT signing key (256-bit)      |
| `POSTGRES_PASSWORD` | PostgreSQL password            |
| `REDIS_PASSWORD`    | Redis password                 |
| `MQTT_PASSWORD`     | EMQX auth password             |
| `MINIO_ACCESS_KEY`  | MinIO access key               |
| `MINIO_SECRET_KEY`  | MinIO secret key               |

---

## 🔒 Bảo mật

- JWT RS256 cho API authentication
- TLS cho MQTT (cổng 8883)
- bcrypt cho password hashing
- MinIO presigned URLs (expire 1h)
- FCM critical alerts (ghi đè silent mode)

---

## 📊 Luồng dữ liệu

```
Camera Frame → PoseDetector → Fall Event?
Audio Chunk  → SoundClassifier → Emergency Sound?
BLE Band     → HR + SpO2 readings
AMG8833      → Skin Temperature Grid
                    ↓
              Decision Matrix
              (Multi-source fusion)
                    ↓
           Alert Confirmed? → MQTT Publish → Cloud Backend
                                              → Save to TimescaleDB
                                              → Send FCM to Mobile
                                              → Broadcast via WebSocket
                    ↓
           Ring Buffer → Save 5s video clip → MinIO Upload
```

---

## 👥 Team

Capstone Project – C1SE34

---

## 📄 License

MIT License

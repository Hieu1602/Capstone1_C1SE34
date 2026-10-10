# 🏗️ Kiến Trúc Phần Mềm — Smart Elderly Care AI

> Tài liệu này mô tả cấu trúc thư mục chuẩn sau khi tái cấu trúc.
> Cập nhật lần cuối: 10/10/2026

---

## Sơ đồ tổng quan

```
┌──────────────────────────────────────────────────────────────┐
│  Mobile App (React Native / Expo)                            │
│  Feature-Sliced Design + Domain Stores                       │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST / WebSocket
┌──────────────────────▼───────────────────────────────────────┐
│  Cloud Backend (FastAPI)                                     │
│  Layered Architecture (API → Service → CRUD → Model)        │
└──────────────────────┬───────────────────────────────────────┘
                       │ MQTT (EMQX)
┌──────────────────────▼───────────────────────────────────────┐
│  Edge Gateway (Python / Orange Pi 5)                         │
│  Clean Architecture + Port & Adapter                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Edge Module — Clean Architecture + Port & Adapter

```
edge/src/
├── main.py              # Entry point mỏng (~70 dòng): load config + run
├── app.py               # EdgeApp – Orchestrator trung tâm (DI container)
├── ai/
│   ├── base.py          # BaseAIModel (abstract – Strategy pattern)
│   ├── audio/sound_classifier.py
│   └── vision/ (pose_detector, face_reid, kinematics, tracker, utils)
├── drivers/
│   ├── base.py          # BaseDriver (Port interface – abstract)
│   ├── camera.py        # CameraDriver (RTSP/USB Adapter)
│   ├── ble_band.py      # BLEBandDriver (Bleak Adapter)
│   └── thermal_amg8833.py
├── fusion/
│   ├── decision_matrix.py
│   └── ring_buffer.py
└── services/
    ├── alert_dispatcher.py  # Fan-out alert: MQTT + Speaker (DI)
    ├── mqtt_client.py
    ├── local_speaker.py
    └── local_stream.py
```

**Dependency Rule:** `main.py → app.py → {drivers, ai, fusion, services}`

---

## 2. Backend — Layered Architecture

```
backend/app/
├── api/v1/endpoints/    # 13 REST endpoints
├── core/                # config, database, security, seed
├── crud/                # Repository pattern (Data Access Layer)
├── models/              # SQLAlchemy ORM
├── schemas/             # Pydantic request/response
├── services/            # Business Logic (chatbot, mqtt, redis…)
└── exceptions/          # Custom exception hierarchy (AppError, NotFoundError…)
```

---

## 3. Mobile — Feature-Sliced Design + Domain Stores

```
mobile/src/
├── store/
│   ├── index.ts             # Barrel export
│   ├── useHealthStore.ts    # Vitals, connection, algoSettings
│   ├── useAlertStore.ts     # Incidents, alarmSnooze, siren
│   ├── useDeviceStore.ts    # IoT devices, camera, house (persisted)
│   ├── usePatientStore.ts   # PatientRecord, reminders
│   ├── useAuthStore.ts      # Auth tokens
│   ├── useThemeStore.ts     # Dark mode
│   └── useVitalStore.ts     # ⚠️ DEPRECATED shim (backward compat)
└── features/
    ├── auth/, dashboard/, alerts/, doctor/, history/, livestream/
```

**Import khuyến nghị:**
```typescript
import { useHealthStore, useAlertStore, useDeviceStore } from '../store';
```

---

## 4. Nguyên tắc áp dụng

| Nguyên tắc | Áp dụng tại |
|-----------|------------|
| Single Responsibility | Mỗi store 1 domain; mỗi service 1 trách nhiệm |
| Dependency Inversion | `BaseDriver`, `BaseAIModel` abstract interfaces |
| Dependency Injection | `AlertDispatcher` nhận deps qua constructor |
| Port & Adapter | Drivers = Adapters; `BaseDriver` = Port |
| Open/Closed | Thêm driver mới không sửa `EdgeApp` |
| Layered Architecture | Backend: API → Service → CRUD → Model |
| Feature-Sliced Design | Mobile: features tự-contained |

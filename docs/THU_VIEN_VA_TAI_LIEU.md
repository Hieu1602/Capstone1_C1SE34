# 📚 DANH SÁCH TÀI LIỆU VÀ CÁC THƯ VIỆN CẦN CÀI ĐẶT
## Dự án: Smart Elderly Care AI (Capstone 1 - Nhóm C1SE.34)

---

## 📁 1. Danh sách file Word và tài liệu trong mục `docs/`

Tất cả các tài liệu đề cương, đăng ký đề tài và báo cáo của nhóm đã được đưa vào thư mục `docs/`:

| STT | Tên tập tin | Định dạng | Mô tả nội dung |
|:---:|:---|:---:|:---|
| 1 | `C1SE.34-Proposal_Smart Elderly Care AI_version-1 (2).docx` | `.docx` / `.pdf` | **Bản thuyết minh đề tài Capstone 1 (Proposal)**: Trình bày chi tiết bài toán, kiến trúc hệ thống, các yêu cầu chức năng (FR01 - FR13), phi chức năng (NFR01 - NFR07), giải pháp kết hợp AI Edge & Cloud. |
| 2 | `C1SE.34_NCKH_2026.doc` | `.doc` | **Thuyết minh đề tài Nghiên cứu Khoa học (NCKH 2026)**: Đề xuất nghiên cứu giải pháp AI chăm sóc người cao tuổi, thuật toán Sensor Fusion và Edge Computing. |
| 3 | `CAPSTONE PROJECT REGISTRATION FORM (1).docx` | `.docx` / `.pdf` | **Đơn đăng ký đề tài Capstone Project**: Thông tin giảng viên hướng dẫn, danh sách thành viên nhóm C1SE.34, mục tiêu và phạm vi đề tài. |
| 4 | `2- AI USAGE DISCLOSURE STATEMENT (CMU).docx` | `.docx` / `.pdf` | **Báo cáo minh bạch sử dụng AI (AI Usage Disclosure Statement)**: Bản kê khai sử dụng các công cụ Generative AI hỗ trợ lập trình và nghiên cứu theo chuẩn CMU. |
| 5 | `proposal_extracted.txt` | `.txt` | Văn bản trích xuất toàn bộ nội dung text từ bản thuyết minh đề tài để tiện tìm kiếm nhanh. |

---

## 📦 2. Danh sách các thư viện cần tải theo từng phân hệ

Dự án bao gồm 3 phân hệ chính: **Mobile App**, **Cloud Backend**, và **Edge Hub (AI Box)**. Các thư mục thư viện đã được cấu hình `.gitignore` loại trừ (không đẩy các thư mục nặng như `node_modules/`, `.venv/` lên Git).

Dưới đây là danh sách toàn bộ thư viện cần cài đặt khi thiết lập môi trường:

---

### 📱 Phân hệ 1: Mobile App (`smart-elderly-care-ai/apps/mobile`)
- **Môi trường yêu cầu**: Node.js v18+ hoặc v20+, npm hoặc yarn, Expo CLI.
- **Lệnh cài đặt**:
  ```bash
  cd smart-elderly-care-ai/apps/mobile
  npm install
  ```

#### Bảng chi tiết thư viện:
| Thư viện | Phiên bản | Mục đích & Chức năng |
|:---|:---:|:---|
| `expo` | `~51.0.0` | Nền tảng framework Expo SDK cho ứng dụng React Native |
| `react` | `18.2.0` | Thư viện cốt lõi React |
| `react-native` | `0.74.3` | Framework lập trình ứng dụng di động đa nền tảng (iOS / Android) |
| `@react-navigation/native` | `^6.1.17` | Hệ thống điều hướng màn hình cốt lõi (Navigation Core) |
| `@react-navigation/bottom-tabs` | `^6.5.20` | Thanh điều hướng tab phía dưới (Home, Live, Alerts, History, Profile) |
| `@react-navigation/native-stack` | `^6.9.26` | Điều hướng dạng ngăn xếp (Stack Navigation: Detail, Camera, Settings) |
| `zustand` | `^4.5.2` | Thư viện quản lý state toàn cục siêu nhẹ (nhịp tim, cảnh báo, thông tin phòng) |
| `axios` | `^1.7.2` | HTTP Client gọi REST API tới Cloud Backend |
| `@react-native-firebase/app` | `^20.3.0` | Firebase SDK nền tảng |
| `@react-native-firebase/messaging` | `^20.3.0` | Nhận thông báo đẩy khẩn cấp FCM (Push Notification với âm lượng còi báo) |
| `@shopify/react-native-skia` | `^1.5.0` | Đồ họa Skia 2D hiệu năng cao cho biểu đồ và animation |
| `victory-native` | `36.9.2` | Vẽ biểu đồ thời gian thực: điện tâm đồ/nhịp tim (BPM), nồng độ oxy (SpO2) |
| `react-native-video` | `^6.3.1` | Phát video trực tiếp từ Edge RTSP và xem lại clip bằng chứng té ngã |
| `react-native-webview` | `13.8.6` | Hiển thị nội dung web và các widget nhúng |
| `react-native-svg` | `^15.2.0` | Hỗ trợ render vector icon SVG |
| `@expo/vector-icons` | `^14.0.2` | Bộ icon Feather, MaterialIcons, Ionicons giao diện người dùng |
| `@react-native-async-storage/async-storage` | `1.23.1` | Lưu trữ dữ liệu offline (JWT token, tùy chọn người dùng) |
| `react-native-gesture-handler` | `~2.16.1` | Xử lý cảm ứng và cử chỉ vuốt mượt mà |
| `react-native-safe-area-context` | `4.10.1` | Xử lý tai thỏ, viền bo màn hình an toàn trên thiết bị hiện đại |
| `react-native-screens` | `~3.31.1` | Tối ưu hóa bộ nhớ màn hình native |
| `expo-status-bar` | `~1.12.1` | Quản lý thanh trạng thái pin, đồng hồ hệ điều hành |

---

### 🖥️ Phân hệ 2: Cloud Backend (`smart-elderly-care-ai/backend`)
- **Môi trường yêu cầu**: Python 3.11+, pip, Docker & Docker Compose (cho TimescaleDB, Redis, EMQX, MinIO).
- **Lệnh cài đặt**:
  ```bash
  cd smart-elderly-care-ai/backend
  python -m venv .venv
  # Kích hoạt venv:
  # Windows: .venv\Scripts\activate
  # Linux/macOS: source .venv/bin/activate
  pip install -r requirements.txt
  ```

#### Bảng chi tiết thư viện:
| Thư viện | Phiên bản | Mục đích & Chức năng |
|:---|:---:|:---|
| `fastapi` | `0.111.0` | Framework web REST API bất đồng bộ (async/await) hiệu năng cao |
| `uvicorn[standard]` | `0.29.0` | ASGI Server chạy ứng dụng FastAPI |
| `sqlalchemy[asyncio]` | `>=2.0.30` | ORM ánh xạ cơ sở dữ liệu với chế độ bất đồng bộ |
| `asyncpg` | `>=0.29.0` | Driver kết nối PostgreSQL / TimescaleDB async tốc độ tối đa |
| `alembic` | `>=1.13.1` | Quản lý phiên bản và migration cơ sở dữ liệu |
| `redis[asyncio]` | `>=5.0.4` | Thư viện kết nối Redis cache và phân tán tác vụ |
| `pydantic` & `pydantic-settings` | `>=2.7.1` | Kiểm định schema dữ liệu đầu vào/ra và quản lý file `.env` |
| `email-validator` | `>=2.0.0` | Xác thực định dạng email người dùng đăng ký |
| `python-jose[cryptography]` | `3.3.0` | Tạo và giải mã JWT Access Token xác thực tài khoản |
| `passlib[bcrypt]` | `1.7.4` | Băm mật khẩu an toàn bằng thuật toán bcrypt |
| `paho-mqtt` | `1.6.1` | Kết nối EMQX Broker nhận dữ liệu telemetry và sự kiện từ Edge |
| `firebase-admin` | `6.5.0` | Gửi cảnh báo sự cố khẩn cấp (Push Notification) tới app di động |
| `minio` | `7.2.7` | Tương tác Object Storage S3: upload & tạo link xem video sự cố 5s |
| `reportlab` | `4.2.0` | Tạo file báo cáo sức khỏe định kỳ định dạng PDF cho bác sĩ/người thân |
| `openpyxl` | `3.1.2` | Xuất dữ liệu thống kê sinh hiệu ra file Excel (.xlsx) |
| `httpx` | `0.27.0` | Thư viện HTTP Client async gọi các dịch vụ bên thứ ba |
| `loguru` | `0.7.2` | Ghi log hệ thống xoay vòng, màu sắc trực quan |
| `python-multipart` | `0.0.9` | Hỗ trợ parse multipart form data khi upload file |

---

### 🧠 Phân hệ 3: Edge Hub AI (`smart-elderly-care-ai/edge`)
- **Môi trường yêu cầu**: Python 3.10+ (chạy trên máy trạm test hoặc Orange Pi 5 / RK3588 NPU).
- **Lệnh cài đặt**:
  ```bash
  cd smart-elderly-care-ai/edge
  python -m venv .venv
  # Kích hoạt venv
  pip install -r requirements.txt
  ```

#### Bảng chi tiết thư viện:
| Thư viện | Phiên bản | Mục đích & Chức năng |
|:---|:---:|:---|
| `opencv-python-headless` | `4.9.0.80` | Đọc luồng video RTSP/Webcam, tiền xử lý ảnh cho mô hình thị giác |
| `numpy` | `1.26.4` | Tính toán ma trận tọa độ khung xương (17 keypoints pose) |
| `onnxruntime` | `1.17.3` | Suy luận mô hình YOLOv8n-Pose định dạng ONNX trên CPU/GPU |
| `tflite-runtime` | `2.14.0` | Chạy mô hình YAMNet nhận diện âm thanh khẩn cấp (tiếng la, ngã, va đập) |
| `rknnlite2` | *SDK ngoài* | Thư viện chạy trực tiếp trên 3 lõi NPU (6 TOPS) của chip Rockchip RK3588 |
| `sounddevice` | `0.4.6` | Thu âm thanh trực tiếp thời gian thực từ Microphone mảng |
| `gtts` & `pygame` | `2.5.1` / `2.5.2` | Chuyển văn bản thành giọng nói (TTS) và phát loa thông báo tại phòng |
| `bleak` | `0.21.1` | Quét và kết nối Bluetooth Low Energy (BLE) với vòng đeo tay sức khỏe |
| `smbus2` | `0.4.3` | Giao tiếp I2C đọc ma trận nhiệt 8x8 từ cảm biến hồng ngoại Panasonic AMG8833 |
| `paho-mqtt` & `asyncio-mqtt` | `1.6.1` / `0.16.2` | Publish dữ liệu nhịp tim, SpO2, nhiệt độ và sự kiện té ngã lên Cloud |
| `aiortc` & `aiohttp` | `1.6.0` / `3.9.3` | Truyền luồng video trực tiếp độ trễ cực thấp (WebRTC) tới ứng dụng |
| `PyYAML` | `6.0.1` | Đọc file cấu hình phần cứng và ngưỡng cảm biến (`config/config.yaml`) |
| `python-dotenv` | `1.0.1` | Nạp cấu hình biến môi trường cục bộ |

---

### 🐳 Phân hệ 4: Hạ tầng Cloud Container (`docker-compose.yml`)
Khởi chạy toàn bộ hạ tầng bằng Docker Compose:
```bash
cd smart-elderly-care-ai
docker-compose up -d
```
Gồm các dịch vụ container:
1. **TimescaleDB (`postgres:16-alpine` + timescaledb)**: Lưu trữ dữ liệu chuỗi thời gian (nhịp tim, SpO2, thân nhiệt theo từng giây).
2. **EMQX MQTT Broker (`emqx:5.6.0`)**: Broker tin nhắn IoT tốc độ cao, hỗ trợ MQTT over TLS (8883) và WebSocket (8083).
3. **Redis (`redis:7.2-alpine`)**: Bộ nhớ đệm cache và quản lý phiên làm việc.
4. **MinIO (`minio/minio:RELEASE.2024-04-18T19-09-19Z`)**: Lưu trữ video clip bằng chứng sự cố té ngã.
5. **FastAPI Backend**: Đóng gói backend service.

---

## 🚀 3. Thứ tự khởi chạy hệ thống

```
1. Khởi động Hạ tầng: docker-compose up -d (tại thư mục smart-elderly-care-ai)
2. Chạy Database Migrations: cd backend && alembic upgrade head
3. Chạy Cloud Backend: cd backend && uvicorn app.main:app --reload --port 8000
4. Chạy Edge AI Hub: cd edge && python -m src.main
5. Chạy Mobile App: cd apps/mobile && npx expo start
```

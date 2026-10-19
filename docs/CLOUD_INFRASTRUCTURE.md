# ☁️ Kiến Trúc Hạ Tầng Đám Mây: AWS & Firebase
## Smart Elderly Care AI — Hệ Thống Chăm Sóc Người Cao Tuổi Thông Minh
> **Mã đồ án:** C1SE.34  
> **Cập nhật:** 10/2026  
> **Mô hình triển khai:** Hybrid Cloud Architecture (Điện toán đám mây kết hợp giữa **AWS** và **Firebase**)

---

## 📌 1. Tổng Quan Kiến Trúc Đám Mây (Cloud Overview)

Hệ thống **Smart Elderly Care AI** áp dụng mô hình phân tách trách nhiệm tối ưu giữa **Amazon Web Services (AWS)** và **Google Firebase**, tận dụng thế mạnh riêng biệt của từng nền tảng:

* **AWS (Amazon Web Services):** Đóng vai trò là **"Bộ não trung tâm" (Core Compute & Data Processing Engine)** — Chịu trách nhiệm lưu trữ cơ sở dữ liệu chuỗi thời gian, xử lý luồng sự kiện MQTT từ thiết bị IoT Edge, chạy API nghiệp vụ backend và phân tích trí tuệ nhân tạo.
* **Firebase (Google Cloud):** Đóng vai trò là **"Cầu nối người dùng" (Global CDN & Real-time Delivery)** — Chịu trách nhiệm phân phối cổng Web Quản trị (Web Admin Portal) tốc độ cao trên mạng lưới CDN toàn cầu và chuyển phát thông báo khẩn cấp (FCM Push Notifications) lập tức đến điện thoại di động của người thân/bác sĩ.

```
                  ┌──────────────────────────────────────────────┐
                  │          NGƯỜI DÙNG & GIAO DIỆN               │
                  └───────┬──────────────────────────────┬───────┘
                          │                              │
         HTTPS / CDN      │                              │ Push Notifications
      (Tải Web Dashboard) │                              │ (Còi hú SOS, Báo động)
                          ▼                              ▼
            ┌───────────────────────────┐  ┌───────────────────────────┐
            │     GOOGLE FIREBASE       │  │      GOOGLE FIREBASE      │
            │     Firebase Hosting      │  │ Firebase Cloud Messaging  │
            │    (Web Admin Portal)     │  │          (FCM)            │
            └─────────────┬─────────────┘  └─────────────▲─────────────┘
                          │                              │
                          │ REST API                     │ Gửi thông báo
                          │ (http://16.178.128.42:8000)  │ qua Firebase Admin SDK
                          ▼                              │
            ┌────────────────────────────────────────────┴─────────────┐
            │                     AMAZON WEB SERVICES (AWS)             │
            │                     EC2 Ubuntu Cloud Server              │
            │                                                          │
            │  ┌────────────────────────────────────────────────────┐  │
            │  │  FastAPI Backend (elderly_care_backend)            │  │
            │  │  - Xác thực JWT, Quản lý tài khoản, Hồ sơ người già│  │
            │  │  - Xử lý nghiệp vụ cảnh báo, Logic SOS             │  │
            │  │  - Tích hợp Google Gemini AI LLM Assistant         │  │
            │  └───────┬───────────────────┬───────────────────┬────┘  │
            │          │                   │                   │       │
            │          ▼                   ▼                   ▼       │
            │  ┌───────────────┐   ┌───────────────┐   ┌────────────┐  │
            │  │ TimescaleDB   │   │  Redis Cache  │   │ Mosquitto  │  │
            │  │ (PostgreSQL16)│   │  (Cache &     │   │ MQTT Broker│  │
            │  │ Dữ liệu sinh  │   │   Pub/Sub)    │   │ (Nhận tin  │  │
            │  │ hiệu, sự cố   │   │               │   │ từ Edge)   │  │
            │  └───────────────┘   └───────────────┘   └────────────┘  │
            └──────────────────────────────────────────────────────────┘
                                         ▲
                                         │ MQTT Telemetry / Alerts
                                         │ (Nhịp tim, SpO2, Té ngã)
            ┌────────────────────────────┴─────────────────────────────┐
            │                  EDGE GATEWAY (Orange Pi / AI Camera)    │
            └──────────────────────────────────────────────────────────┘
```

---

## 🛠️ 2. Vai Trò & Trách Nhiệm Chi Tiết Của AWS

AWS chịu trách nhiệm toàn bộ phần **Backend Services, Lưu trữ dữ liệu, Xử lý giao thức IoT và Tính toán nghiệp vụ**.

### 2.1. AWS EC2 (Elastic Compute Cloud)
* **Thông số cấu hình:** Ubuntu Server 24.04 LTS (x86_64), IP Public `16.178.128.42`.
* **Môi trường hoạt động:** Docker Engine & Docker Compose cô lập an toàn giữa các dịch vụ trong mạng nội bộ `elderly_care_net`.
* **Các thành phần chạy trên EC2:**

| Dịch vụ / Container | Cổng (Port) | Vai trò & Trách nhiệm chính |
| :--- | :--- | :--- |
| **`elderly_care_backend`**<br>*(FastAPI Python 3.11)* | `8000:8000` | • Cung cấp toàn bộ hệ thống REST API (`/api/v1`) và WebSocket cho Mobile & Web.<br>• Xác thực người dùng (JWT Bearer Token), phân quyền thành viên trong hộ gia đình (`owner`, `caregiver`, `doctor`, `admin`).<br>• Xử lý cảnh báo khẩn cấp: tự động kích hoạt cuộc gọi/FCM khi nhận diện sự cố.<br>• Tích hợp Trí tuệ nhân tạo Gemini AI (qua API key) để phân tích hỏi đáp trợ lý ảo y tế.<br>• Cung cấp giao diện tài liệu Swagger UI chuẩn tại `/docs`. |
| **`elderly_care_timescaledb`**<br>*(PostgreSQL 16 + TimescaleDB)* | `5433:5432` | • Lưu trữ toàn bộ dữ liệu quan hệ (Tài khoản người dùng, căn nhà, thiết bị, hồ sơ sức khỏe người cao tuổi, lịch sử sự cố).<br>• **TimescaleDB Hypertables:** Chuyên dụng cho dữ liệu chuỗi thời gian sinh hiệu (Nhịp tim bpm, Nồng độ oxy trong máu SpO₂, Gia tốc kế va đập) với hiệu năng truy vấn siêu tốc và tiết kiệm dung lượng. |
| **`elderly_care_redis`**<br>*(Redis 7.2 Alpine)* | `6379:6379` | • Lưu cache trạng thái kết nối trực tuyến của các thiết bị (Online/Offline heartbeat).<br>• Lưu phiên làm việc, chống brute-force đăng nhập.<br>• Message Broker trung chuyển dữ liệu tức thời qua cơ chế Pub/Sub cho WebSocket. |
| **`elderly_care_emqx`**<br>*(Eclipse Mosquitto MQTT)* | `1883:1883`<br>`8883:8883` | • Trạm thu phát tin nhắn MQTT tiêu chuẩn công nghiệp IoT.<br>• Nhận trực tiếp các gói tin Telemetry cảm biến và Alert sự cố (phát hiện té ngã từ Camera AI tại nhà người cao tuổi) đẩy lên với độ trễ dưới 50ms. |

### 2.2. AWS Security Group (Tường lửa mạng)
* `TCP 22`: Quản trị máy chủ an toàn qua SSH bằng Private Key (`.pem`).
* `TCP 8000`: Mở cổng cho Frontend Web Admin & Mobile App gọi REST API / WebSocket.
* `TCP 1883`: Mở cổng cho Edge Gateway kết nối MQTT đẩy dữ liệu sinh hiệu.
* `TCP 5433 / 6379`: Được bảo vệ hoặc chỉ cho phép kết nối quản trị nội bộ.

---

## 🔥 3. Vai Trò & Trách Nhiệm Chi Tiết Của Firebase

Firebase chịu trách nhiệm về **Phân phối giao diện người dùng Web** và **Hạ tầng thông báo đẩy di động Native**.

### 3.1. Firebase Hosting (Cổng Quản Trị Hệ Thống - Web Admin Portal)
* **Địa chỉ truy cập:** 🔗 `https://smart-elderly-care-ai-cap1.web.app`
* **Công nghệ:** React 18, TypeScript, Vite, TailwindCSS.
* **Vai trò & Ưu điểm:**
  1. **Tốc độ cao qua Global CDN:** Toàn bộ mã nguồn giao diện (HTML, CSS, JS, Assets) được nén và cache trên các máy chủ Edge của Google khắp thế giới, giúp người quản trị tải trang gần như tức thì.
  2. **Bảo mật HTTPS/SSL tự động:** Được cấp chứng chỉ SSL miễn phí từ Google, mã hóa toàn bộ dữ liệu truyền tải giữa trình duyệt và CDN.
  3. **Zero-downtime Deploy:** Triển khai phiên bản mới chỉ với 1 câu lệnh (`firebase deploy`), hỗ trợ rollback tức thì về phiên bản cũ nếu gặp lỗi.
  4. **SPA URL Rewrites:** Tự động điều hướng tất cả các route URL (`/login`, `/dashboard`, `/users`, `/devices`) về `index.html` của Single Page Application mà không bị lỗi 404 khi tải lại trang.

### 3.2. Firebase Cloud Messaging - FCM (Thông Báo Khẩn Cấp Mobile)
* **Ứng dụng tích hợp:** Mobile App React Native (`com.c1se34.smartelderlycare`) & Backend FastAPI.
* **Vai trò & Cơ chế hoạt động:**
  1. **Độ trễ thấp nhất cho sự cố sinh tử:** Khi cụ bà/cụ ông bị ngã hoặc bấm nút SOS, thời gian là tính mạng. FCM đảm bảo thông báo được gửi đến điện thoại người nhà chỉ trong **1-2 giây**.
  2. **Critical Alert (Ghi đè chế độ Im Lặng/Không Làm Phiền):** Cấu hình kênh thông báo `priority: high` với channel âm thanh còi hú riêng biệt (`emergency_alerts`), đảm bảo điện thoại vẫn phát chuông báo động lớn ngay cả khi người nhà đang để máy ở chế độ im lặng vào ban đêm.
  3. **Giao tiếp Backend qua Firebase Admin SDK:** Backend EC2 sử dụng khóa bảo mật [`firebase-service-account.json`](file:///d:/Capstone1_C1SE34/smart-elderly-care-ai/backend/config/firebase-service-account.json) để xác thực trực tiếp với máy chủ Google mà không cần thông qua bước đăng nhập thủ công nào.
  4. **Tích hợp Mobile an toàn:** Điện thoại Android/iOS sử dụng file [`google-services.json`](file:///d:/Capstone1_C1SE34/smart-elderly-care-ai/apps/mobile/google-services.json) để tự động đăng ký FCM Token định danh thiết bị lên Firebase server.

---

## 📊 4. Bảng Ma Trận Phân Chia Trách Nhiệm (Responsibility Matrix)

| Hạng mục / Tính năng | AWS (EC2 / EBS) | Firebase (Hosting / FCM) | Ghi chú kiến trúc |
| :--- | :---: | :---: | :--- |
| **Web Admin Portal (Dashboard)** | ❌ | ✅ *(Hosting)* | Chạy hoàn toàn trên CDN Firebase, tiết kiệm CPU/RAM cho máy chủ AWS. |
| **Xử lý REST API & WebSockets** | ✅ *(FastAPI)* | ❌ | AWS EC2 tiếp nhận và phản hồi toàn bộ dữ liệu nghiệp vụ. |
| **Cơ sở dữ liệu người dùng & Thiết bị** | ✅ *(PostgreSQL)* | ❌ | Dữ liệu quan hệ lưu an toàn trên ổ đĩa AWS EBS. |
| **Cơ sở dữ liệu chuỗi thời gian (Sinh hiệu)**| ✅ *(TimescaleDB)* | ❌ | Hypertables chuyên dụng xử lý hàng triệu bản ghi nhịp tim/SpO2. |
| **Bộ đệm & Pub/Sub thời gian thực** | ✅ *(Redis)* | ❌ | Đảm bảo tốc độ truy xuất mili-giây cho hệ thống. |
| **Trạm nhận tin IoT MQTT từ Camera/Hub** | ✅ *(Mosquitto)* | ❌ | Xử lý giao thức MQTT nhẹ và ổn định trên port 1883. |
| **Gửi Push Notification SOS đến Mobile** | 🔄 *(Kích hoạt gửi)* | ✅ *(Vận chuyển tin)* | Backend AWS phát lệnh ➡️ Firebase FCM gửi đến máy người dùng. |
| **Tích hợp AI LLM Bác sĩ ảo** | ✅ *(FastAPI)* | ❌ | Backend gọi Google Gemini API qua kết nối HTTPS bảo mật. |

---

## 🔄 5. Luồng Dữ Liệu Tiêu Biểu Trong Thực Tế

### 🚨 Kịch bản: Camera AI phát hiện Người Cao Tuổi Té Ngã
1. **Phát hiện tại chỗ (Edge):** Camera AI tại nhà phân tích thị giác máy tính và phát hiện cụ ông bị ngã.
2. **Báo cáo về AWS (MQTT):** Edge Gateway gửi gói tin khẩn cấp lên **AWS EC2** qua cổng MQTT `1883` với chủ đề `care/house_01/alert`.
3. **Xử lý tại AWS (Backend):** 
   * Service backend ghi nhận sự cố vào **TimescaleDB**.
   * Đọc danh sách số điện thoại người nhà và Bác sĩ phụ trách.
   * Gọi hàm `fcm_service.send_alert(...)` chuyển tiếp tiêu đề và tọa độ sự cố sang **Firebase FCM API**.
4. **Phát chuông báo động (Firebase ➡️ Mobile):** **Firebase FCM** lập tức đẩy thông báo còi hú SOS đến điện thoại của người nhà, mở khóa màn hình và hiển thị vị trí té ngã.
5. **Giám sát trên Web (Firebase Hosting):** Bác sĩ mở **Web Admin Portal** trên Firebase Hosting, trình duyệt tự động gọi API AWS EC2 để xem video ghi nhận sự việc và cập nhật bệnh án.

---

## 🔐 6. Quản Lý Bảo Mật & Khóa Bí Mật

* **File bí mật không lưu trên Git:**
  * `firebase-service-account.json` *(Khóa Admin Firebase)* và `google-services.json` *(Khóa Client Mobile)* được chặn hoàn toàn bởi file [`.gitignore`](file:///d:/Capstone1_C1SE34/.gitignore).
* **Cấu hình CORS (Cross-Origin Resource Sharing):**
  * Backend FastAPI trên AWS được cấu hình mở rộng Regex (`allow_origin_regex=r"^https?://.*$"`) để chấp nhận yêu cầu an toàn từ miền Firebase Hosting (`https://smart-elderly-care-ai-cap1.web.app`) mà không bị chặn bởi chính sách cùng nguồn gốc của trình duyệt.

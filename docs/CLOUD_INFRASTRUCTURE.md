# ☁️ Kiến Trúc Hạ Tầng Đám Mây Đa Nền Tảng (Multi-Cloud Infrastructure)
## Smart Elderly Care AI — Hệ Thống Chăm Sóc Người Cao Tuổi Thông Minh
> **Mã đồ án:** C1SE.34  
> **Cập nhật:** 10/2026  
> **Mô hình triển khai:** Multi-Cloud Architecture kết hợp giữa **AWS (EC2 & S3)**, **Supabase Cloud (PostgreSQL 17)** và **Google Firebase (Hosting & FCM)**

---

## 📌 1. Tổng Quan Kiến Trúc Đám Mây (Cloud Architecture Overview)

Hệ thống **Smart Elderly Care AI** áp dụng mô hình điện toán đám mây đa nền tảng (Multi-Cloud / Hybrid Cloud) nhằm phân tách triệt để các tầng nghiệp vụ: **Compute (Tính toán)**, **Object Storage (Lưu trữ tệp đa phương tiện)**, **Managed Database (Cơ sở dữ liệu đám mây)** và **Client Delivery (Phân phối ứng dụng & thông báo)**.

Kiến trúc gồm 4 trụ cột chính:
* **AWS EC2 (Elastic Compute Cloud):** Đóng vai trò là **"Bộ não điều phối & xử lý thời gian thực" (Core Compute & Real-time Engine)** — Chạy các container dịch vụ cốt lõi gồm Backend FastAPI, Redis Cache/PubSub và EMQX MQTT Broker tiếp nhận dữ liệu từ các thiết bị IoT tại nhà.
* **AWS S3 (Simple Storage Service):** Đóng vai trò là **"Kho lưu trữ tệp đa phương tiện độ tin cậy cao" (Cloud Object Storage)** — Chuyên dụng lưu trữ các video clip ghi nhận sự cố (5s trước và sau té ngã), hình ảnh trích xuất (thumbnails), tệp ghi âm SOS và dữ liệu backup.
* **Supabase Cloud (Managed PostgreSQL 17):** Đóng vai trò là **"Cơ sở dữ liệu tập trung an toàn" (Managed Cloud Relational Database)** — Lưu trữ toàn bộ dữ liệu quan hệ và lịch sử vận hành (người dùng, hồ sơ người cao tuổi, thiết bị, sinh hiệu, nhật ký sự cố). Giúp giảm tải hoàn toàn tài nguyên RAM/CPU cho máy chủ EC2 và đảm bảo dữ liệu toàn vẹn, độc lập.
* **Google Firebase (Hosting & FCM):** Đóng vai trò là **"Cầu nối người dùng & cảnh báo khẩn cấp" (Global CDN & Real-time Alert Delivery)** — Firebase Hosting phân phối Web Admin Portal qua mạng lưới CDN toàn cầu; Firebase Cloud Messaging (FCM) chuyển phát tức thời (1-2s) thông báo còi hú SOS đến điện thoại của người thân và bác sĩ.

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
                     │     (Web Admin Portal)    │  │          (FCM)            │
                     └─────────────┬─────────────┘  └─────────────▲─────────────┘
                                   │                              │
                                   │ REST API                     │ Gửi thông báo
                                   │ (http://16.178.128.42:8000)  │ qua Firebase Admin SDK
                                   ▼                              │
┌─────────────────────────────────────────────────────────────────┴────────────────────────────────┐
│                                   AMAZON WEB SERVICES (AWS)                                      │
│                                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │  AWS EC2 Cloud Server (Ubuntu 24.04/26.04 LTS — IP: 16.178.128.42)                       │   │
│   │                                                                                          │   │
│   │  ┌────────────────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │  FastAPI Backend (elderly_care_backend :8000)                                      │  │   │
│   │  │  - Xác thực JWT, Quản lý tài khoản, Hồ sơ người cao tuổi, Phân quyền gia đình      │  │   │
│   │  │  - Điều phối cảnh báo khẩn cấp, Logic xử lý sự cố té ngã                           │  │   │
│   │  │  - Tích hợp Trợ lý Trí tuệ Nhân tạo Google Gemini AI                               │  │   │
│   │  └────────┬──────────────────────────────┬──────────────────────────────┬─────────────┘  │   │
│   │           │                              │                              │                │   │
│   │           ▼                              ▼                              ▼                │   │
│   │  ┌─────────────────┐            ┌─────────────────┐            ┌──────────────────────┐  │   │
│   │  │   Redis 7.2     │            │   EMQX 5.6.0    │            │ S3 Storage Client    │  │   │
│   │  │   (Cache &      │            │   (MQTT Broker) │            │ (Boto3 / S3 SDK)     │  │   │
│   │  │    Pub/Sub)     │            │  (Nhận tin Edge)│            │                      │  │   │
│   │  └─────────────────┘            └────────▲────────┘            └──────────┬───────────┘  │   │
│   └──────────────────────────────────────────┼────────────────────────────────┼──────────────┘   │
│                                              │                                │                  │
│   ┌──────────────────────────────────────────┼────────────────────────────────▼──────────────┐   │
│   │  AWS S3 (Simple Storage Service — Region: ap-southeast-2 Sydney)                         │   │
│   │  Bucket: elderly-care-incidents-c1se34                                                   │   │
│   │  - Video bằng chứng sự cố 5 giây (incidents/*.mp4)                                       │   │
│   │  - Ảnh chụp hiện trường / Thumbnails (thumbnails/*.jpg)                                  │   │
│   │  - URL Virtual-hosted: https://elderly-care-incidents-c1se34.s3.ap-southeast-2...        │   │
│   └──────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────▲───────────────────────────────────────────────────┘
                                               │ MQTT Telemetry / Video Upload
                                               │ (Nhịp tim, SpO2, Gia tốc, Video té ngã)
                         ┌─────────────────────┴───────────────────────┐
                         │    EDGE GATEWAY (Orange Pi / AI Camera)     │
                         └─────────────────────────────────────────────┘
                                               │
                                               │ Truy vấn / Lưu trữ dữ liệu quan hệ
                                               ▼
                         ┌─────────────────────────────────────────────┐
                         │               SUPABASE CLOUD                │
                         │          Managed PostgreSQL 17              │
                         │  (db.lwvoaznmrciezcwktmlg.supabase.co)      │
                         │  - Users, Houses, Patients, Devices         │
                         │  - Vitals Time-series & Incident Logs       │
                         └─────────────────────────────────────────────┘
```

---

## 🛠️ 2. Trụ Cột AWS (Amazon Web Services) — Compute & Media Storage

AWS đảm nhiệm hai tầng trọng yếu nhất: tầng tính toán máy chủ xử lý dữ liệu (EC2) và tầng lưu trữ tệp đa phương tiện an toàn (S3).

### 2.1. AWS EC2 (Elastic Compute Cloud)
* **Thông số máy chủ:** AWS EC2 `t3.micro` (1 vCPU, 1GB RAM vật lý kết hợp tệp **3GB Swap File** trên ổ đĩa SSD NVMe/gp3 nhằm chống tràn bộ nhớ), hệ điều hành Ubuntu Server (x86_64), IP Public `16.178.128.42`.
* **Môi trường vận hành:** Docker Engine & Docker Compose V2 chạy mạng nội bộ cầu nối cô lập `elderly_care_net`.
* **Các container dịch vụ vận hành trên EC2:**

| Dịch vụ / Container | Cổng ánh xạ (Port) | Vai trò & Trách nhiệm chính |
| :--- | :--- | :--- |
| **`elderly_care_backend`**<br>*(FastAPI Python 3.11)* | `8000:8000` | • Cung cấp toàn bộ hệ thống REST API (`/api/v1`) và WebSocket kết nối Mobile & Web.<br>• Quản lý xác thực JWT Bearer, phân quyền (`owner`, `caregiver`, `doctor`, `admin`).<br>• Tiếp nhận gói tin cảnh báo té ngã từ Edge Gateway, kích hoạt FCM thông báo đến điện thoại.<br>• Tích hợp Google Gemini AI LLM Assistant trả lời y tế và tóm tắt sức khỏe.<br>• Tạo và ký URL đối tượng S3 hoặc trả về URL trực tiếp cho ứng dụng xem video sự cố. |
| **`elderly_care_redis`**<br>*(Redis 7.2 Alpine)* | `6379:6379` | • Lưu trữ bộ nhớ đệm (Cache) trạng thái thiết bị trực tuyến (Heartbeat Online/Offline).<br>• Lưu trữ Session token và kiểm soát tần suất gửi tin (Rate Limiting).<br>• Đóng vai trò In-memory Message Broker cơ chế Pub/Sub cho kênh WebSocket thời gian thực. |
| **`elderly_care_emqx`**<br>*(EMQX 5.6.0 MQTT Broker)* | `1883:1883`<br>`8883:8883`<br>`18083:18083` | • Trạm thu phát tin nhắn MQTT hiệu năng cao chuẩn công nghiệp IoT.<br>• Nhận trực tiếp các gói tin Telemetry sinh hiệu (nhịp tim, SpO2) và sự kiện khẩn cấp té ngã từ camera/vòng tay BLE tại phòng người cao tuổi với độ trễ < 50ms.<br>• Cổng `18083` phục vụ bảng điều khiển quản trị kết nối EMQX Dashboard. |

> **Ghi chú kiến trúc:** Khác với mô hình chạy cơ sở dữ liệu nặng trên máy chủ nhỏ, container `elderly_care_timescaledb` và `minio` nội bộ được gỡ bỏ khỏi tiến trình chạy mặc định của EC2 để nhường toàn bộ RAM cho FastAPI và EMQX, tránh triệt để nguy cơ treo máy do thiếu bộ nhớ (Out-of-Memory).

### 2.2. AWS S3 (Simple Storage Service — Incident Media Storage)
* **Tên Bucket:** `elderly-care-incidents-c1se34`
* **Vùng triển khai (Region):** `ap-southeast-2` (Châu Á Thái Bình Dương - Sydney)
* **Endpoint kết nối:** `s3.ap-southeast-2.amazonaws.com`
* **Cơ chế & Định dạng URL:**
  * Backend sử dụng S3 Client tương thích SDK chuẩn (boto3 / minio SDK) để tự động khởi tạo bucket và đẩy video clip 5 giây khi phát hiện té ngã.
  * Đường dẫn lưu trữ phân cấp rõ ràng: `incidents/{incident_id}.mp4` và `thumbnails/{incident_id}.jpg`.
  * Hỗ trợ Virtual-hosted-style URL tiêu chuẩn toàn cầu:  
    `https://elderly-care-incidents-c1se34.s3.ap-southeast-2.amazonaws.com/incidents/...`
* **Chính sách bảo mật (Bucket Policy):**
  * Thiết lập quyền đọc công khai có giới hạn (Public Read Policy) cho các tài nguyên trong bucket để ứng dụng Mobile và Web Admin có thể phát video trực tiếp mượt mà mà không gặp rào cản xác thực token hết hạn.
  * Quyền ghi (Upload / Delete) được khóa chặt thông qua AWS IAM Credentials (`MINIO_ACCESS_KEY` & `MINIO_SECRET_KEY`) cấu hình an toàn trên Backend.

### 2.3. AWS Security Group (Cấu hình Tường Lửa)
* `TCP 22`: Quản trị máy chủ từ xa an toàn qua SSH / EC2 Instance Connect.
* `TCP 8000`: Mở cổng kết nối REST API và WebSocket cho Mobile App & Web Admin.
* `TCP 1883 / 8883`: Mở cổng giao tiếp MQTT cho Edge Gateway (Orange Pi, Camera AI).
* `TCP 18083`: Bảng điều khiển quản trị EMQX Dashboard (bảo vệ bằng mật khẩu quản trị).
* `TCP 6379`: Đặt trong chế độ nội bộ mạng Docker, yêu cầu mật khẩu Redis (`REDIS_PASSWORD`).

---

## 🗄️ 3. Trụ Cột Supabase Cloud — Managed Database & High Availability

Thay vì lưu cơ sở dữ liệu trên ổ cứng cục bộ của EC2, hệ thống sử dụng dịch vụ cơ sở dữ liệu đám mây **Supabase Cloud**:

* **Máy chủ cơ sở dữ liệu:** `db.lwvoaznmrciezcwktmlg.supabase.co` (PostgreSQL 17.x kèm giao thức mã hóa SSL `sslmode=require`).
* **Vai trò trong hệ thống:**
  1. **Nguồn dữ liệu chân lý duy nhất (Single Source of Truth):** Toàn bộ dữ liệu quan hệ gồm tài khoản người dùng, hộ gia đình, hồ sơ sức khỏe người cao tuổi, danh mục thiết bị IoT và lịch sử sự cố được quản lý tập trung.
  2. **Đồng bộ tuyệt đối giữa Local & Cloud:** Cả môi trường phát triển cục bộ của lập trình viên và máy chủ AWS EC2 trên môi trường thực tế đều trỏ chung về cơ sở dữ liệu Supabase thông qua biến môi trường `DATABASE_URL`.
  3. **Không lo mất mát dữ liệu (Data Persistence & Zero-loss):** Việc khởi động lại máy chủ EC2, cập nhật mã nguồn hoặc thay đổi phiên bản Docker không làm ảnh hưởng đến cơ sở dữ liệu. Supabase cung cấp cơ chế sao lưu tự động định kỳ (Point-in-Time Recovery).
  4. **Tối ưu tài nguyên máy chủ EC2:** Giảm bớt 400MB - 600MB dung lượng RAM mà một container PostgreSQL/TimescaleDB cục bộ thông thường chiếm dụng.

---

## 🔥 4. Trụ Cột Google Firebase — Web Admin Delivery & Mobile Push Notifications

Firebase đảm nhận toàn bộ các dịch vụ tương tác đầu cuối (Client-facing services) với tốc độ cao và độ trễ thấp nhất.

### 4.1. Firebase Hosting (Cổng Quản Trị Hệ Thống - Web Admin Portal)
* **Địa chỉ truy cập chính thức:** 🔗 `https://smart-elderly-care-ai-cap1.web.app`
* **Công nghệ phát triển:** React 18, TypeScript, Vite, TailwindCSS.
* **Vai trò & Ưu thế:**
  1. **Phân phối qua Global Edge CDN:** Toàn bộ mã nguồn giao diện (HTML, CSS, Javascript bundle) được nén và lưu trên các máy chủ biên của Google khắp toàn cầu. Tốc độ tải trang đạt dưới 500ms.
  2. **Chứng chỉ SSL tự động:** Tự động bảo mật bằng HTTPS/TLS do Google cấp và duy trì.
  3. **Triển khai tức thì (Zero-downtime):** Triển khai phiên bản giao diện mới chỉ bằng lệnh `firebase deploy --only hosting`, hỗ trợ tính năng Instant Rollback về bản cũ nếu có lỗi.
  4. **Cấu hình SPA Rewrite:** Tự động định tuyến toàn bộ các đường dẫn (`/login`, `/dashboard`, `/users`, `/devices`, `/incidents`) về `index.html` của ứng dụng Single Page Application.

### 4.2. Firebase Cloud Messaging - FCM (Thông Báo Khẩn Cấp Di Động)
* **Ứng dụng tích hợp:** Ứng dụng di động React Native (`com.c1se34.smartelderlycare`) & Backend FastAPI.
* **Cơ chế thông báo sinh tử (Life-Critical Alert Mechanism):**
  1. **Tốc độ truyền tin 1-2 giây:** Khi phát hiện cụ ông/cụ bà bị ngã hoặc kích hoạt nút SOS khẩn cấp, Backend gửi lệnh ngay lập tức qua Firebase Admin SDK để phát chuông điện thoại người thân.
  2. **Critical Alert (Ghi đè chế độ Im Lặng/Không Làm Phiền):** Sử dụng kênh thông báo ưu tiên cao (`priority: high`) với sound channel còi hú riêng (`emergency_alerts`), kích hoạt chuông cảnh báo âm lượng lớn ngay cả khi người nhà đang để điện thoại ở chế độ im lặng ban đêm.
  3. **Xác thực an toàn:** Backend sử dụng tệp khóa dịch vụ [`firebase-service-account.json`](file:///d:/Capstone1_C1SE34/smart-elderly-care-ai/backend/config/firebase-service-account.json) xác thực trực tiếp với Google Cloud; ứng dụng Mobile Android/iOS sử dụng [`google-services.json`](file:///d:/Capstone1_C1SE34/smart-elderly-care-ai/apps/mobile/google-services.json) để tự động đăng ký FCM Device Token.

---

## 📊 5. Bảng Ma Trận Phân Chia Trách Nhiệm (Responsibility Matrix)

| Hạng mục / Tính năng | AWS EC2 (Compute) | AWS S3 (Storage) | Supabase (Database) | Firebase (Hosting / FCM) | Ghi chú kiến trúc |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Giao diện Web Admin (Dashboard)** | ❌ | ❌ | ❌ | ✅ *(Hosting)* | Chạy trên CDN Firebase, tiết kiệm 100% CPU/RAM cho máy chủ EC2. |
| **Xử lý REST API & WebSockets** | ✅ *(FastAPI)* | ❌ | ❌ | ❌ | EC2 tiếp nhận và phản hồi toàn bộ logic nghiệp vụ, tính toán cảnh báo. |
| **Trạm thu phát IoT MQTT** | ✅ *(EMQX)* | ❌ | ❌ | ❌ | Tiếp nhận dữ liệu cảm biến & camera với độ trễ cực thấp trên port 1883. |
| **Bộ đệm & Pub/Sub thời gian thực** | ✅ *(Redis)* | ❌ | ❌ | ❌ | Lưu cache trạng thái online, kiểm soát rate limit và phiên người dùng. |
| **Cơ sở dữ liệu người dùng & Bệnh nhân** | ❌ | ❌ | ✅ *(PostgreSQL)* | ❌ | Dữ liệu quan hệ lưu an toàn, tự động backup trên Supabase Cloud. |
| **Lưu lịch sử sinh hiệu & Nhật ký sự cố** | ❌ | ❌ | ✅ *(PostgreSQL)* | ❌ | Lưu vết toàn bộ chỉ số nhịp tim, SpO2, gia tốc kế và log sự cố. |
| **Lưu trữ Video Clip 5s & Ảnh sự cố** | ❌ | ✅ *(S3 Bucket)* | ❌ | ❌ | Bucket `elderly-care-incidents-c1se34` lưu trữ video bằng chứng té ngã. |
| **Gửi Push Notification SOS đến Mobile** | 🔄 *(Kích hoạt)* | ❌ | ❌ | ✅ *(Vận chuyển)* | Backend EC2 phát lệnh ➡️ Firebase FCM gửi thông báo còi hú đến máy người nhà. |
| **Trí tuệ nhân tạo Gemini AI Assistant** | ✅ *(FastAPI)* | ❌ | ❌ | ❌ | Backend gọi Google Gemini API qua kết nối HTTPS bảo mật. |

---

## 🔄 6. Luồng Xử Lý Sự Cố Toàn Trình (End-to-End Incident Flow)

### 🚨 Kịch bản: Camera AI phát hiện Người Cao Tuổi Té Ngã Trong Phòng Khách

```
[1. Phát hiện tại Edge] Camera AI / Orange Pi nhận diện tư thế ngã
           │
           ├──────────────────────────────┬──────────────────────────────┐
           │ (A) Gửi tin khẩn cấp (MQTT)  │ (B) Tải video clip 5s        │
           ▼                              ▼                              │
┌───────────────────────────┐  ┌───────────────────────────────────┐    │
│  AWS EC2 — EMQX Broker    │  │  AWS S3 Bucket                    │    │
│  (Port 1883)              │  │  (elderly-care-incidents-c1se34)  │    │
└─────────────┬─────────────┘  └─────────────────▲─────────────────┘    │
              │ Forward gói tin nội bộ           │                      │
              ▼                                  │ Ghi nhận URL video   │
┌───────────────────────────┐                    │                      │
│  AWS EC2 — FastAPI Backend│────────────────────┴──────────────────────┘
└──────┬──────────────┬─────┘
       │              │
       │ (1) Ghi DB   │ (2) Gửi lệnh Push FCM
       ▼              ▼
┌──────────────┐ ┌───────────────────────────┐
│SUPABASE CLOUD│ │     GOOGLE FIREBASE       │
│ PostgreSQL 17│ │Firebase Cloud Messaging   │
└──────────────┘ └─────────────┬─────────────┘
                               │
                               │ Gửi còi hú SOS (< 2s)
                               ▼
                 ┌───────────────────────────┐
                 │    MOBILE APP (Người nhà) │
                 │ - Rung & hú còi báo động  │
                 │ - Xem trực tiếp video S3  │
                 └───────────────────────────┘
```

1. **Phát hiện tại chỗ (Edge Detection):** Camera AI tại phòng khách xử lý hình ảnh thị giác máy tính, nhận diện người cao tuổi mất thăng bằng và ngã xuống sàn.
2. **Gửi dữ liệu kép lên AWS:**
   * **(A) Kênh tín hiệu tức thời (MQTT):** Edge Gateway gửi gói tin cảnh báo khẩn cấp đến **AWS EC2 EMQX Broker** trên cổng `1883` với chủ đề `care/house_01/alert`.
   * **(B) Kênh đa phương tiện (S3 Upload):** Edge Gateway trích xuất đoạn video 5 giây (trước và sau khi ngã) tải trực tiếp lên **AWS S3 Bucket** `elderly-care-incidents-c1se34`.
3. **Xử lý nghiệp vụ tại AWS Backend:**
   * Backend FastAPI tiếp nhận sự kiện, liên kết bản ghi sự cố với đường dẫn video trên S3.
   * Ghi nhận tức thời sự cố vào cơ sở dữ liệu **Supabase Cloud**.
   * Tra cứu danh sách người thân và bác sĩ quản lý của hộ gia đình.
   * Gọi `fcm_service.send_alert(...)` chuyển tiếp thông tin cảnh báo đến **Google Firebase FCM API**.
4. **Báo động khẩn cấp tới Điện thoại (Firebase FCM ➡️ Mobile App):**
   * **Firebase FCM** lập tức chuyển phát gói tin High-Priority đến ứng dụng di động của người nhà.
   * Điện thoại tự động kích hoạt còi hú báo động khẩn cấp, mở khóa màn hình hiển thị vị trí té ngã và cho phép nhấn xem ngay video bằng chứng 5 giây phát từ **AWS S3**.
5. **Giám sát & Quản lý tập trung (Web Admin Portal):**
   * Bác sĩ hoặc nhân viên y tế mở **Web Admin Portal** trên **Firebase Hosting**, tự động tải danh sách sự cố từ API AWS EC2 và theo dõi tình trạng sức khỏe bệnh nhân.

---

## 🔐 7. Quản Lý Bảo Mật & Khóa Bí Mật

* **Kiểm soát mã nguồn với Git (.gitignore):**
  * Tuyệt đối không lưu trữ các file khóa bí mật trên Git repository:
    * `firebase-service-account.json` (Khóa quản trị Firebase Admin SDK)
    * `google-services.json` (Khóa cấu hình Mobile App)
    * `.env` chứa `DATABASE_URL` (Supabase connection string), `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` (AWS IAM credentials), `GEMINI_API_KEY`.
* **Cấu hình CORS (Cross-Origin Resource Sharing):**
  * Backend FastAPI trên AWS EC2 cho phép các yêu cầu an toàn từ domain Firebase Hosting (`https://smart-elderly-care-ai-cap1.web.app`) và môi trường di động qua cấu hình regex `allow_origin_regex=r"^https?://.*$"`.
* **Quyền hạn IAM AWS tối thiểu (Least Privilege):**
  * Khóa truy cập IAM trên AWS chỉ cấp quyền trên tài nguyên S3 tương ứng (`s3:PutObject`, `s3:GetObject`, `s3:ListBucket`) đối với bucket `elderly-care-incidents-c1se34`, ngăn chặn việc truy cập trái phép vào các dịch vụ AWS khác.

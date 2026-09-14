# 🌐 Hướng Dẫn Trải Nghiệm Ứng Dụng Mobile Qua Trình Duyệt Web (React Native Web)

> **Mục đích:** Tài liệu này hướng dẫn cách chạy, xem và chia sẻ ứng dụng **Smart Elderly Care AI (Mobile)** trực tiếp trên trình duyệt web (Chrome, Safari, Edge) cho thành viên nhóm, giáo viên hướng dẫn hoặc hội đồng đánh giá mà **không cần cài đặt app Expo Go** hay bị vướng xác thực tài khoản.

---

## 📋 Mục lục
1. [Khởi động chế độ Web trên máy tính](#1-khởi-động-chế-độ-web-trên-máy-tính)
2. [Cách xem và test trên máy tính (Giao diện iPhone)](#2-cách-xem-và-test-trên-máy-tính-giao-diện-iphone)
3. [Chia sẻ cho người khác xem qua mạng Wi-Fi / Hotspot](#3-chia-sẻ-cho-người-khác-xem-qua-mạng-wi-fi--hotspot)
4. [Mẹo cài đặt Web thành App trên màn hình điện thoại (PWA)](#4-mẹo-cài-đặt-web-thành-app-trên-màn-hình-điện-thoại-pwa)
5. [Đóng gói (Build & Deploy) Web lên Internet vĩnh viễn](#5-đóng-gói-build--deploy-web-lên-internet-vĩnh-viễn)
6. [Xử lý sự cố thường gặp](#6-xử-lý-sự-cố-thường-gặp)

---

## 1. Khởi động chế độ Web trên máy tính

Tại thư mục `smart-elderly-care-ai/apps/mobile`, mở Terminal và chạy lệnh:

```bash
# Di chuyển vào thư mục mobile
cd apps/mobile

# Khởi động chế độ Web
npm run web
# Hoặc:
npx expo start --web
```

- Metro Bundler sẽ tự động biên dịch mã nguồn React Native sang HTML5/JavaScript chuẩn.
- Địa chỉ truy cập mặc định: **`http://localhost:8081`**.

---

## 2. Cách xem và test trên máy tính (Giao diện iPhone)

Để trải nghiệm giao diện chuẩn kích thước điện thoại y như trên iPhone thật:

1. Mở trình duyệt **Google Chrome** hoặc **Microsoft Edge** trên máy tính.
2. Truy cập vào: **`http://localhost:8081`**.
3. Nhấn phím **`F12`** (hoặc click chuột phải chọn **Kiểm tra / Inspect**).
4. Nhấn tổ hợp phím **`Ctrl + Shift + M`** (hoặc bấm vào icon điện thoại/máy tính bảng **📱 Toggle device toolbar** ở góc trên cửa sổ kiểm tra).
5. Tại thanh công cụ phía trên màn hình giả lập:
   - Chọn thiết bị: **iPhone 14 Pro Max**, **iPhone 15**, hoặc **Samsung Galaxy S20**.
   - Tỷ lệ zoom: Chọn **100%** hoặc **Fit to window**.
6. Bây giờ bạn có thể cuộn, vuốt chạm, chuyển tab và thao tác hoàn toàn như trên điện thoại thật!

---

## 3. Chia sẻ cho người khác xem qua mạng Wi-Fi / Hotspot

Nếu bạn muốn thầy cô hoặc bạn bè ngồi cùng phòng mở trực tiếp trên điện thoại của họ:

### Bước 1: Cho họ kết nối chung mạng
- Cho điện thoại của người xem kết nối vào cùng mạng Wi-Fi với laptop của bạn (hoặc kết nối vào **Điểm phát sóng cá nhân - Hotspot** do điện thoại bạn phát).

### Bước 2: Khởi chạy server cho phép mạng nội bộ
Chạy lệnh khởi động với cờ `--host lan`:

```bash
npx expo start --host lan
```

### Bước 3: Người xem mở trình duyệt trên điện thoại
- Xác định IP mạng của máy tính bạn (ví dụ: `172.20.10.13` hoặc `192.168.1.x`).
- Bảo người xem mở trình duyệt điện thoại (Safari trên iPhone hoặc Chrome trên Android) và gõ thẳng địa chỉ:
  ```text
  http://<ĐỊA_CHỈ_IP_CỦA_BẠN>:8081
  ```
  *Ví dụ:* **`http://172.20.10.13:8081`** *(Lưu ý dùng `http://`, không dùng `exp://`)*.
- Trang web ứng dụng sẽ tải ngay lập tức mà **không yêu cầu đăng nhập tài khoản Expo**.

---

## 4. Mẹo cài đặt Web thành App trên màn hình điện thoại (PWA)

Người xem có thể đưa ứng dụng ra ngoài màn hình chính để dùng tràn viền, ẩn thanh địa chỉ URL:

### Trên iPhone (Safari):
1. Mở link web ứng dụng trên Safari.
2. Bấm vào biểu tượng **Chia sẻ (Share)** (hình ô vuông có mũi tên trỏ lên ở giữa thanh dưới cùng).
3. Cuộn xuống chọn **Thêm vào Màn hình chính (Add to Home Screen)**.
4. Đặt tên app (mặc định: *Smart Elderly Care*) -> Bấm **Thêm (Add)**.
5. Ngoài màn hình chính iPhone sẽ xuất hiện icon ứng dụng, bấm vào sẽ mở full màn hình như app thật!

### Trên Android (Chrome):
1. Mở link web ứng dụng trên Google Chrome.
2. Bấm vào biểu tượng menu **3 dấu chấm** ở góc trên bên phải.
3. Chọn **Thêm vào Màn hình chính (Add to Home screen)** hoặc **Cài đặt ứng dụng (Install app)**.

---

## 5. Đóng gói (Build & Deploy) Web lên Internet vĩnh viễn

Nếu bạn muốn có một đường link công khai (ví dụ `https://smart-elderly-care.vercel.app`) để gửi qua Zalo/Email cho bất kỳ ai xem mà **không cần máy tính của bạn phải bật server**:

### Bước 1: Xuất bản build Web
```bash
cd apps/mobile
npx expo export -p web
```
Thư mục **`dist/`** sẽ được tạo ra chứa toàn bộ mã nguồn tĩnh (HTML, CSS, JS, Assets).

### Bước 2: Triển khai lên Vercel (Miễn phí 100%)
1. Cài đặt Vercel CLI (nếu chưa có):
   ```bash
   npm i -g vercel
   ```
2. Chạy lệnh deploy:
   ```bash
   vercel ./dist
   ```
3. Nhận đường link công khai gửi cho thầy cô và nhóm!

*(Hoặc kéo thả thư mục `dist` vào trang web [app.netlify.com/drop](https://app.netlify.com/drop) là có ngay link web chỉ sau 30 giây).*

---

## 6. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Không mở được link IP từ điện thoại khác** | Tường lửa Windows (Windows Firewall) chặn cổng `8081`. | Mở PowerShell với quyền Administrator và chạy lệnh: `New-NetFirewallRule -DisplayName "Expo Web" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow` |
| **Báo lỗi kết nối API Backend** | Web trên điện thoại không kết nối được `localhost:8000`. | Cập nhật file `.env` trong thư mục `mobile`: sửa `EXPO_PUBLIC_API_URL` từ `http://localhost:8000` thành `http://<IP_MÁY_TÍNH>:8000`. |
| **Trang web hiển thị trống trơn hoặc lỗi font icon** | Trình duyệt cũ hoặc cache cũ của Metro. | Khởi động lại Metro với cờ xóa cache: `npx expo start -c --web`. |

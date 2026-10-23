# Camera Tapo trên mobile

## Chạy

1. Trong file `.env.camera` ở gốc dự án, giữ nguyên tài khoản Tapo đang chạy được.
   Thêm `CAMERA_DEVICE_ID` là UUID duy nhất (hoặc UUID camera đã có trong database),
   `CAMERA_PAIRING_CODE` là chuỗi ngẫu nhiên ít nhất 16 ký tự và
   `CAMERA_SERVICE_URL=http://tapo-camera:8090`.
2. Tại gốc dự án chạy:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.camera.yml up -d --build backend tapo-camera
   ```

3. Trong `.env` của mobile, đặt `EXPO_PUBLIC_API_URL=http://IP_WIFI_MAY_TINH:8000/api/v1`.
   Điện thoại phải truy cập được backend qua Wi-Fi; không dùng IP camera hay localhost.
4. Tại `apps/mobile`, chạy `npm start -- --clear`, mở app bằng Expo Go/development build.
5. Đăng nhập tài khoản chủ nhà → Trang chủ → thẻ Camera. Nếu chưa liên kết, nhập giá trị
   `CAMERA_PAIRING_CODE` từ file cấu hình server. Camera sẽ thuộc nhà của tài khoản này.
   Không dùng tài khoản/token demo. Sau khi đã liên kết, không thể đổi chủ bằng mã này.

Không cần nhập mật khẩu Tapo vào app. Các file môi trường chứa credential không được commit.
Backend và dịch vụ camera cùng Docker network `elderly_care_net`; chỉ backend cần truy cập từ điện thoại.
Nếu backend chạy ngoài Docker, cần truyền các biến cấu hình camera vào process và đặt
`CAMERA_SERVICE_URL=http://127.0.0.1:8090`.

## Chức năng đã nối

- Giữ nguyên thẻ camera Trang chủ và bố cục CameraDetailScreen hiện có.
- Khung video trong CameraDetailScreen phát MJPEG thật qua WebView (native) hoặc img (web).
- Xoay trái/phải/lên/xuống; chặn bấm liên tục trong lúc lệnh trước chưa hoàn tất.
- Chụp ảnh mở JPEG trong trình duyệt để xem/lưu.
- Ghi 30 giây MP4 tại server, báo đang ghi/lỗi và mở liên kết tải bản ghi hoàn tất.
- Nút riêng tư hiện có đọc/bật/tắt privacy thật. API motion vẫn sẵn có; chưa gắn vào nút AI Protect vì phát hiện chuyển động của Tapo khác với AI YOLO.
- Tắt live khi chuyển màn hình hoặc đưa app xuống nền; làm mới ticket khi trở lại.
- Nút Playback mở danh sách bản ghi thực để xem/tải; chưa hỗ trợ tua timeline trên server.
- Preset/Home chưa cấu hình sẽ báo chưa hỗ trợ. Không mô phỏng thành công lệnh PTZ.
- Các phần âm thanh, đàm thoại hai chiều và AI của giao diện cũ chưa được nối vào Tapo.

## Quyền và media

Backend kiểm tra camera được cấu hình, căn nhà và `can_view_camera` cho mỗi request.
Điều khiển/ghi hình yêu cầu thêm `can_manage_devices`. Chủ nhà/admin theo quy tắc quyền hiện có.
Media dùng ticket ký riêng, giới hạn đúng file/luồng, hết hạn sau 5 phút; ticket không dùng đăng nhập được.
Khi mở media, backend kiểm tra lại quyền. Live đang mở kết thúc khi ticket hết hạn;
mobile tự lấy ticket mới trước thời điểm đó. Video đã bắt đầu tải có thể hoàn tất sau khi ticket hết hạn.
Không đưa JWT đăng nhập hoặc Camera Account vào URL media. Khi triển khai ngoài LAN dùng backend HTTPS.

Route CameraDetail vẫn dùng CameraDetailScreen gốc; các lối vào từ Trang chủ, Thiết bị và MultiView không đổi.
Hỗ trợ một camera Tapo được cấu hình. Chọn ID camera khác sẽ báo chưa được kết nối.

## Kiểm tra

```powershell
# Từ gốc dự án
docker exec elderly_care_backend python -m unittest discover -s tests -p test_camera_proxy.py -v
# Từ apps/mobile
npm run type-check
```

Trên điện thoại: xem live → thử xoay từng hướng → chụp ảnh → ghi 30 giây → mở MP4 →
bật/tắt riêng tư → đưa app xuống nền rồi mở lại. Nếu không vào được backend, kiểm tra IP Wi-Fi
và quyền truy cập cổng 8000 qua Windows Firewall. Bản build production cần HTTPS phù hợp cấu hình OS.

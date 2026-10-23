# Tapo C200C — Docker camera service

## Cấu hình trước khi chạy

1. Thêm camera vào app Tapo, cập nhật firmware; máy Docker phải truy cập được IP LAN của camera (không dùng Wi-Fi guest/client isolation).
2. Trong app, bật **Me → Third-Party Services → Third-Party Compatibility** nếu firmware/app có mục này; tên/vị trí menu có thể khác theo phiên bản.
3. **Camera → Settings → Advanced Settings → Camera Account**: tạo username/password riêng cho RTSP. Tắt Privacy Mode khi cần xem.
4. Đặt DHCP reservation cho camera; điền IP và Camera Account vào file môi trường bên dưới.

## Chạy từ thư mục gốc dự án (PowerShell)

```powershell
Copy-Item .env.camera.example .env.camera
# Sửa .env.camera: TAPO_HOST, TAPO_USERNAME, TAPO_PASSWORD,
# CAMERA_HTTP_USERNAME và CAMERA_HTTP_PASSWORD.
docker compose -f docker-compose.camera.yml up -d --build
docker compose -f docker-compose.camera.yml logs -f tapo-camera
```

Mở **http://localhost:8090**, đăng nhập bằng `CAMERA_HTTP_*`. Trang có live video,
snapshot, nút pan/tilt, bật/tắt phát hiện chuyển động và ghi 30 giây MP4.
Video hoàn tất xuất hiện dưới dạng liên kết tải xuống. Bấm xem lại/tải lại trang
nếu trình duyệt dừng MJPEG sau khi camera mất mạng.

File [.env.camera.example](../.env.camera.example) là mẫu; `.env.camera` được gitignore.
Dùng dấu nháy đơn quanh mật khẩu chứa `$` để Compose không nội suy biến.
Mật khẩu trong env là giá trị gốc, không tự URL-encode.

## RTSP và tích hợp AI edge

```text
rtsp://CAMERA_USERNAME:CAMERA_PASSWORD@CAMERA_IP:554/stream1
rtsp://CAMERA_USERNAME:CAMERA_PASSWORD@CAMERA_IP:554/stream2
```

`stream1` là luồng chính, `stream2` là luồng phụ nhẹ hơn. Code tự encode username/password,
dùng RTSP TCP và timeout đọc/mở 5 giây, tự reconnect. Độ phân giải thực tế do camera quyết định.
Docker Desktop dùng bridge mặc định; không cần `network_mode: host` hay publish cổng 554.

[CameraDriver](src/drivers/camera.py) được cả [EdgeApp](src/app.py) và dịch vụ camera sử dụng.
Khi chạy AI edge, truyền cùng `TAPO_HOST`, `TAPO_USERNAME`, `TAPO_PASSWORD`, `TAPO_STREAM`
vào môi trường của container/process; chúng ghi đè `camera.source` trong YAML.
Không có `TAPO_HOST` thì driver vẫn đọc nguồn USB/RTSP đã cấu hình.

Ví dụ đọc frame trực tiếp (chạy trong thư mục `edge` sau khi đã cung cấp env và dependencies):

```python
import time
from src.drivers.camera import CameraDriver

camera = CameraDriver({})  # URL lấy từ TAPO_*; không hardcode credential
camera.start()
try:
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        frame = camera.get_latest_frame()  # numpy BGR, đưa vào model AI
        if frame is not None:
            print(frame.shape)
            break
        time.sleep(0.1)
    else:
        raise RuntimeError("Không nhận được frame trong 15 giây")
finally:
    camera.stop()
```

## HTTP API

Mọi endpoint trừ `/healthz` đều cần HTTP Basic Auth. POST yêu cầu JSON.

| Method/path | Chức năng / JSON |
|---|---|
| GET `/status` | `connected`: có frame mới trong 5 giây |
| GET `/live.mjpg` | MJPEG cho trình duyệt, tối đa 10 FPS, không âm thanh |
| GET `/snapshot.jpg` | JPEG từ frame mới nhất; 503 nếu mất camera |
| GET `/info` | Thông tin camera qua pytapo |
| POST `/ptz` | `{"x":10,"y":0}`; mỗi trục -30..30, bước xoay tương đối |
| GET/POST `/motion` | Đọc/cấu hình; `{"enabled":true,"sensitivity":"normal"}`; low/normal/high |
| GET/POST `/privacy` | Đọc/cấu hình; `{"enabled":false}` |
| POST `/recordings` | `{"seconds":30}`; 1..3600, trả 202; chỉ một bản ghi mỗi lần |
| GET `/recordings` | Danh sách MP4 hoàn tất, bản ghi đang chạy, lỗi gần nhất |
| GET `/recordings/{name}` | Tải MP4 đã hoàn tất |

Ví dụ PowerShell, dùng username HTTP đã đặt; curl hỏi mật khẩu:

```powershell
curl.exe -u viewer http://localhost:8090/snapshot.jpg -o snapshot.jpg
'{"x":10,"y":0}' | curl.exe -u viewer -H 'Content-Type: application/json' --data-binary '@-' http://localhost:8090/ptz
'{"seconds":30}' | curl.exe -u viewer -H 'Content-Type: application/json' --data-binary '@-' http://localhost:8090/recordings
```

## Phạm vi và vận hành

- `pytapo` điều khiển pan/tilt, motion detection và privacy. C200C không có zoom quang học.
  Firmware có thể từ chối từng lệnh: API trả 502, không báo thành công giả.
- Camera Account là lựa chọn đầu tiên cho pytapo. Nếu bị từ chối, tùy firmware dùng
  `TAPO_CONTROL_USERNAME=admin`, `TAPO_CONTROL_PASSWORD` là mật khẩu TP-Link ID.
  Firmware dùng SPAKE2+ có thể cần thêm `TAPO_CLOUD_PASSWORD` (mật khẩu TP-Link ID).
  Các biến này chỉ phục vụ điều khiển; RTSP luôn dùng Camera Account.
- `/motion` cấu hình bộ phát hiện trên camera, **không phải API nhận sự kiện chuyển động**.
  Chưa nối sự kiện ONVIF/MQTT và chưa tự động ghi khi có chuyển động.
- Snapshot/ghi hình dùng OpenCV/FFmpeg trên RTSP; không gọi hàm snapshot giả định của pytapo.
  MP4 lưu video, không âm thanh, không cần thẻ SD; không tải bản ghi cũ từ SD.
- `/recordings` dùng Docker volume, giữ dữ liệu khi recreate container. Bản ghi đang chạy
  khi dừng dịch vụ bị hủy; file tạm bị xóa. Chưa có chính sách tự xóa video cũ: theo dõi dung lượng.
  Xóa volume bằng `down -v` sẽ xóa video, nên chỉ dùng `down` khi dừng bình thường.
- Xem trực tiếp chiếm một RTSP connection; ghi hình thêm một. Đóng VLC/app khác nếu camera
  đạt giới hạn session; chạy AI edge riêng cũng tiêu thụ thêm kết nối.
- Mặc định chỉ publish trên localhost. Khi tích hợp truy cập từ xa, đặt sau reverse proxy HTTPS
  có xác thực; Basic Auth qua HTTP phù hợp cho thử nghiệm local.
- Chưa nối trang này vào giao diện React/mobile hoặc hệ thống tài khoản backend hiện tại.

## Kiểm thử không cần phần cứng

```powershell
docker compose -f docker-compose.camera.yml run --rm --no-deps -v "${PWD}/edge/tests:/tests:ro" tapo-camera python -m unittest discover -s /tests -v
```

Test dùng frame giả để kiểm tra API, xác thực, JPEG/MJPEG, validation, frame hết hạn và
FFmpeg thất bại. Kiểm tra camera thật: `/status` phải trả `connected: true`, mở live,
tải JPEG, ghi MP4 rồi xem file, và thử mỗi nút xoay với bước nhỏ.

Tham khảo: [TP-Link RTSP/ONVIF](https://www.tapo.com/en/faq/34/),
[pytapo API và authentication](https://github.com/JurajNyiri/pytapo).

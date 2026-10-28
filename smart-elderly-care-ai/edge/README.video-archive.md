# Ghi hình liên tục và xem lại S3

Driver camera dùng chung đưa frame vào queue RAM giới hạn 4 giây, không chờ mạng.
Worker encode ghi MP4 H.264 từng đoạn 2 giây; worker riêng upload bằng boto3 rồi
POST metadata lên FastAPI. PostgreSQL lưu khóa object, camera, thời gian UTC,
thời lượng, dung lượng, loại media và UUID sự kiện. React Native mở Playback,
chọn ngày/giờ địa phương, phân trang timeline và phát các đoạn kế tiếp trong app.
Snapshot và clip sự kiện xuất hiện cùng timeline. API cũng lọc được .`incident_id`.

## Cấu hình

1. Cài requirements cho backend và edge/camera; máy capture cần `ffmpeg` có
   `libx264` trên PATH. Image camera hiện có FFmpeg. Native mobile cần development
   build có `react-native-video` (dependency đã có); không dùng Expo Go để kiểm chứng.
2. Bucket riêng tư: `elderly-care-incidents-c1se34`, region `ap-southeast-2`.
   Bật Block Public Access, Bucket owner enforced, mã hóa mặc định SSE-S3,
   chỉ cho phép TLS. Code upload yêu cầu `AES256`; không đặt public ACL.
3. Cấp role/profile của capture quyền `s3:PutObject`, `s3:AbortMultipartUpload`
   chỉ trên `arn:aws:s3:::elderly-care-incidents-c1se34/cameras/<CAMERA_DEVICE_ID>/*`.
   Backend cần `s3:GetObject` trên các camera do backend phục vụ (HEAD và ký GET).
   Không cần quyền tạo bucket hoặc liệt kê toàn bộ bucket. Nếu tổ chức dùng KMS,
   cần đổi cấu hình mã hóa upload và quyền KMS tương ứng trước khi bật ghi hình.
4. Dùng IAM role với credentials tự làm mới trên AWS. Local dùng `AWS_PROFILE`
   và profile AWS hợp lệ; container phải mount thư mục AWS read-only đúng home
   của user `camera` (`/home/camera/.aws`). Hoặc inject credentials tạm thời bằng
   secret manager: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`.
   Không đưa chúng vào source, mobile hoặc URL. Không ghi đè credentials bằng
   MINIO_ACCESS_KEY/MINIO_SECRET_KEY; kho MinIO cũ vẫn độc lập.
5. Sao chép các biến `VIDEO_*` từ [mẫu cấu hình](../.env.camera.example).
    - Capture: `VIDEO_ARCHIVE_ENABLED=true`, `CAMERA_DEVICE_ID` là UUID của thiết bị
      CAMERA đã gắn nhà, `VIDEO_METADATA_URL` là HTTPS backend + `/api/v1/camera/archive`.
    - Capture: `VIDEO_INGEST_TOKEN` ngẫu nhiên tối thiểu 32 ký tự.
    - Backend: `VIDEO_INGEST_TOKENS={"<camera UUID>":"<cùng token>"}`; mỗi camera token riêng.
      Dùng cùng bucket/region; backend vẫn cần CAMERA_DEVICE_ID/CAMERA_EXTRA_SOURCES
      hiện có để phân quyền xem. Token ingest không cấp quyền xem video.
    - Tapo container: `VIDEO_SPOOL_DIR=/recordings/spool` nằm trên volume hiện có.
      AI Edge chạy trực tiếp: đặt đường dẫn spool trên ổ đĩa bền vững và nạp biến
      môi trường vào tiến trình trước khi khởi động. Không trông chờ main tự đọc `.env.camera`.
    - Chỉ bật archive ở **một tiến trình capture cho mỗi camera**. Muốn lưu bằng chứng
      AI, bật ở Edge Gateway chạy detector; Tapo HTTP service có thể tiếp tục phục vụ live
      với archive tắt. Tapo-only không tự có detector té ngã.
6. Áp dụng migration `008_camera_recordings` trước khi chạy backend production.
   Repo hiện có nhánh Alembic riêng `007_doctor_cchn_fields`; kiểm tra revision đang
   dùng, không chạy downgrade hoặc stamp để bỏ qua lịch sử. Với nhánh ứng dụng đã ở
   `503241ecffea`, chạy `alembic upgrade 008_camera_recordings` từ backend.
   Dev init_db tự tạo model mới; không sửa bảng hoặc kết nối database hiện có.

Thông tin AWS chính thức: [credential chain boto3](https://docs.aws.amazon.com/boto3/latest/guide/credentials.html),
[bảo mật S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html).
Nên bật access logging, CloudTrail data events và CloudWatch metrics; mã hóa
đích log (SSE-S3 cho bucket log, KMS cho CloudTrail/CloudWatch). Những cấu hình
hạ tầng này chưa được tự áp dụng bởi thay đổi mã nguồn.

## API và tính bền vững

### Backend local trên Windows/Docker

Sau khi tạo AWS profile `elderly-care`, đặt `AWS_PROFILE=elderly-care` trong
`.env.camera`. Chạy `.venv/Scripts/python.exe edge/scripts/create_local_video_tls.py`
từ thư mục dự án để tạo chứng chỉ local (cần môi trường Python có cryptography).
Script kiểm tra TLS thật và không ghi đè khóa cũ. Chứng chỉ có hạn 365 ngày;
khóa nằm trong `.local/video-tls/`, bị loại khỏi Git và chỉ mount vào proxy.

Đặt `VIDEO_METADATA_URL=https://video-metadata/api/v1/camera/archive`.
Khi chạy Docker Compose, dùng cả ba file: `docker-compose.yml`,
`docker-compose.camera.yml`, `docker-compose.aws-local.yml`. File thứ ba mount
AWS profile read-only vào backend/camera và thêm proxy Nginx nội bộ. Camera
chỉ nhận chứng chỉ công khai qua `SSL_CERT_FILE`; không tắt xác minh TLS.
Proxy không publish cổng lên Windows/Internet, chỉ chuyển POST metadata đến
`backend:8000` trong mạng Docker. HTTP local và URL mobile hiện tại không đổi.
Đây là cấu hình phát triển local; production dùng chứng chỉ/endpoint triển khai thực tế.

Tham khảo [HTTPS Nginx](https://nginx.org/en/docs/http/configuring_https_servers.html).

- `POST /api/v1/camera/archive`: bearer token riêng của camera; xác minh key,
  loại file, kích thước qua HEAD S3 rồi commit metadata. Gửi lại cùng UUID và dữ
  liệu được chấp nhận; thay metadata của UUID cũ bị từ chối.
- `GET /api/v1/camera/archive?camera_id=...&start=<UTC>&end=<UTC>`: JWT và quyền
  `can_view_camera`, tối đa 24 giờ/request, 100 item mặc định, cursor
  `after_time` + `after_id`. Có thể thêm `incident_id`.
- `GET /api/v1/camera/archive/<UUID>/playback?camera_id=...`: kiểm tra lại quyền,
  trả URL GET có hạn 300 giây. App xin URL mới mỗi lần chọn/phát lại; không lưu
  URL có chữ ký trong database. URL đã cấp có hiệu lực tới hết hạn, kể cả khi
  quyền bị thu hồi sau đó.
- Outbox gồm file media và manifest JSON được thay thế nguyên tử. SDK retry
  lỗi tạm thời; worker retry với exponential backoff + jitter tối đa khoảng
  5 phút. S3 đã upload nhưng backend offline thì chỉ retry metadata, không
  upload lại. Chỉ xóa file sau HTTP 200 từ backend.
- Mất điện giữa lúc encode có thể để lại `.part` hoặc file chưa có manifest;
  chúng không được công bố là video hoàn tất. Giữ chúng để kiểm tra/phục hồi,
  không tự xóa bằng chứng. Các manifest hoàn tất được đọc lại sau restart.
- Spool mặc định 5 GiB. Hết dung lượng hoặc encoder không theo kịp sẽ ghi lỗi,
  bỏ frame mới và tạo khoảng trống timeline; không xóa outbox chưa đồng bộ.
  Theo dõi log và dung lượng. RAM queue, đoạn đang encode và buffer sự kiện
  cùng tiêu tốn bộ nhớ; đo trên Orange Pi với độ phân giải thực tế trước triển khai.
- Đoạn cuối khi dừng/mất nguồn có thể ngắn hơn 2 giây. Clip bằng chứng sử dụng
  buffer trước sự kiện hiện có, snapshot là frame cuối buffer; không có hậu kỳ
  sau té ngã. Thời lượng buffer AI dựa trên FPS cấu hình, cần hiệu chỉnh theo
  tốc độ inference thực tế. Ghi liên tục dùng timestamp monotonic để resample.
- Playback là các MP4 độc lập; có thể ngắt ngắn khi chuyển đoạn. Chưa có HLS
  hoặc âm thanh ghi lại. Video lưu là frame camera gốc, chứa hình ảnh nhận diện;
  chỉ cấp quyền camera cho người được phép và bảo vệ volume đệm bằng mã hóa đĩa.

Mỗi camera ghi 24/7 tạo khoảng 43.200 đoạn/ngày, phát sinh PUT, HEAD, lưu trữ và
GET/transfer khi xem lại. Chọn thời gian lưu phù hợp, cấu hình lifecycle và dọn
metadata tương ứng khi áp dụng xóa object; hiện không tự xóa dữ liệu S3.
Xem [các thành phần tính phí S3](https://aws.amazon.com/s3/pricing/), không chỉ GB lưu trữ.

## Kiểm chứng triển khai

Đã có test offline cho segmentation/resampling, MP4 H.264 2 giây bằng FFmpeg,
queue đầy, spool đầy, mất mạng S3/backend, resume outbox, backoff, token theo
camera, key và duration không hợp lệ, idempotency, phân trang và quyền playback.
Test encoder thật dùng `imageio-ffmpeg` chỉ trong môi trường test (không thêm vào
runtime requirements). Cần kiểm tra thêm trên thiết bị: mất RTSP, privacy mode,
khởi động lại container, revoke quyền, AWS role/token hết hạn, tốc độ upload,
CPU/RAM và phát trên Android/iOS. Không bật DEBUG của botocore hoặc log URL đã ký.

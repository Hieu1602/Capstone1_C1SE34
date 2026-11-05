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
Backend và dịch vụ camera cùng Docker network `elderly_care_net`; video MJPEG đi qua backend.
Đàm thoại cần thêm đường WebRTC TCP/UDP 8555 tới go2rtc như hướng dẫn bên dưới.
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
- Nút Playback mở timeline theo ngày, bắt đầu từ tối đa 30 giây cuối của khoảng ghi hình gần nhất; kéo timeline hoặc bấm ±10 giây để chọn đoạn video.
- Playback dùng HLS, tải đệm nhiều segment trong cùng player; web dùng `hls.js`, native dùng `react-native-video`. Backend cần FFmpeg để remux MP4 cũ và chuẩn hóa timestamp TS; xem [hướng dẫn triển khai HLS](../../edge/README.video-archive.md#triển-khai-bản-hls).
- Bản ghi MP4 có nút phát trong ứng dụng và nút tải riêng. Timeline tải từng segment đang chọn, không ghép thành clip dài. Web tải qua liên kết attachment; Android/iOS mở trình duyệt hệ thống để tải/lưu.
- Preset/Home chưa cấu hình sẽ báo chưa hỗ trợ. Không mô phỏng thành công lệnh PTZ.
- Audio dùng WebRTC/go2rtc: nghe camera, giữ để nói, Voice Call liên tục và tắt mic/loa.
- AI chạy qua luồng cảnh báo hiện có; phát hiện chuyển động Tapo không thay thế AI YOLO.

## Quyền và media

Backend kiểm tra camera được cấu hình, căn nhà và `can_view_camera` cho mỗi request.
Điều khiển/ghi hình yêu cầu thêm `can_manage_devices`. Chủ nhà/admin theo quy tắc quyền hiện có.
Media dùng ticket ký riêng, giới hạn đúng file/luồng, hết hạn sau 5 phút; ticket không dùng đăng nhập được.
Khi mở media, backend kiểm tra lại quyền. Live đang mở kết thúc khi ticket hết hạn;
mobile tự lấy ticket mới trước thời điểm đó. Video đã bắt đầu tải có thể hoàn tất sau khi ticket hết hạn.
Không đưa JWT đăng nhập hoặc Camera Account vào URL media. Khi triển khai ngoài LAN dùng backend HTTPS.

Route CameraDetail vẫn dùng CameraDetailScreen gốc; các lối vào từ Trang chủ, Thiết bị và MultiView không đổi.
Hỗ trợ một camera Tapo được cấu hình. Chọn ID camera khác sẽ báo chưa được kết nối.

## Đàm thoại WebRTC (LAN)

1. Thêm các biến sau vào `.env.camera` ở gốc dự án, theo `.env.camera.example`:

   ```dotenv
   TAPO_TALK_URL=tapo://URL_ENCODED_CLOUD_PASSWORD@IP_CAMERA
   CAMERA_WEBRTC_HOST=IP_LAN_MAY_CHAY_DOCKER
   CAMERA_INTERCOM_URL=http://tapo-audio:1984
   ```

   `TAPO_TALK_URL` dùng **mật khẩu TP-Link cloud**, khác với mật khẩu Camera Account/RTSP.
   Percent-encode ký tự đặc biệt trong mật khẩu. Có thể dùng
   `tapo://admin:UPPERCASE_MD5_OR_SHA256_HASH@IP_CAMERA`; firmware mới có thể cần SHA256.
   Không commit URL chứa mật khẩu hoặc hash. Cấu hình và giao thức theo
   [tài liệu Tapo của go2rtc](https://github.com/AlexxIT/go2rtc/blob/v1.9.14/internal/tapo/README.md).

2. Từ gốc dự án:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.camera.yml up -d --build backend tapo-camera tapo-audio
   ```

   Điện thoại phải kết nối được TCP/UDP **8555** trên máy chạy Docker.
   API quản trị go2rtc cổng 1984 chỉ nằm trong Docker network, không mở ra điện thoại.
   Backend chạy ngoài Docker cần trỏ `CAMERA_INTERCOM_URL` tới go2rtc trong mạng riêng phù hợp.
   Cấu hình kèm theo dành cho cùng LAN/VPN; mạng ngoài LAN cần cấu hình thêm ICE/TURN.

3. Web: dùng HTTPS hoặc `localhost` để trình duyệt cho phép microphone.
   Điện thoại: cần **development/native build**, Expo Go không có module WebRTC:

   ```powershell
   # Từ apps/mobile, máy đã có Android SDK
   npx expo run:android
   # Hoặc trên macOS có Xcode
   npx expo run:ios
   ```

   Plugin đã được thêm vào `app.json`; cần build lại app sau khi thêm module native.
   Xem [hướng dẫn plugin WebRTC](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc).

4. Trong màn hình camera:
   - Nút loa mở/đóng phiên nghe, không xin quyền microphone.
   - Talk: giữ để kết nối và truyền giọng nói, nhả để dừng và giải phóng mic.
     Lần đầu có hộp thoại quyền microphone, cấp quyền rồi giữ nút lại nếu phiên đã bị hủy.
     Loa phía điện thoại mặc định tắt trong Talk để tránh phản hồi âm.
   - Voice Call: chạm để gọi/kết thúc; Mic và Speaker bật/tắt độc lập.
   - Đóng/đổi panel, mở cài đặt/bản ghi, bật riêng tư, rời màn hình hoặc xuống nền đều dừng audio.
     Mỗi phiên giới hạn 5 phút trên client; kết nối lỗi không tự bật lại mic.

SDP đi qua `POST /camera/intercom/offer`, có JWT và kiểm tra đúng camera/căn nhà.
Nghe cần quyền xem; truyền microphone cần `can_manage_devices`. Không đưa credential Tapo vào app.
Âm thanh đi trực tiếp bằng WebRTC giữa app và go2rtc, không qua luồng MJPEG.
Khả năng phát/thu đồng thời phụ thuộc firmware camera; cần thử trực tiếp trên C200C.

## Thanh điều khiển video và nhiều camera

Trong Camera Detail, thanh trên video gồm xem một/bốn ô, Video Quality, Video Mode
và toàn màn hình. Khi mở lưới, chạm dấu `+` để chọn nguồn đã cấp quyền; chạm một ô
để chuyển đích chụp ảnh, ghi hình, PTZ, chế độ ngày/đêm và intercom sang ô viền cam.
Mỗi nguồn chỉ xuất hiện một lần, tối đa bốn nguồn; thu lưới sẽ dừng luồng phụ.

Chất lượng `1080P`/`720P` giới hạn chiều cao ảnh MJPEG thực tế trên edge, giữ tỉ lệ,
không phóng giả nguồn có độ phân giải thấp hơn. `Auto` đổi giữa 720 và 480, giảm
chất lượng JPEG khi gửi chậm và phục hồi sau 30 frame ổn định. Đây là chất lượng
luồng xem MJPEG, không đổi cấu hình RTSP hoặc chất lượng tệp MP4 ghi trên server.

Video Mode đọc/ghi trực tiếp bằng `getDayNightMode`/`setDayNightMode` của pytapo:
Day tương ứng `off`, Night tương ứng `on`, Auto tương ứng `auto`. Đổi chế độ cần
quyền quản lý; UI chỉ chọn sau khi camera phản hồi. Firmware không hỗ trợ sẽ trả lỗi.
Tham khảo [API và test của pytapo](https://github.com/JurajNyiri/pytapo/blob/main/test_pytapo.py).

Toàn màn hình có nút trở lại, zoom 2x và thanh chụp/ghi/Pan-Tilt/Talk/Call.
Native khóa ngang rồi khôi phục hướng cũ khi thoát; web dùng Fullscreen API,
hoặc modal phủ viewport nếu trình duyệt từ chối. Module `expo-screen-orientation`
và cấu hình iOS đã được thêm, **cần build lại ứng dụng native** sau khi cập nhật.
Xem [tài liệu ScreenOrientation](https://docs.expo.dev/versions/v57.0.0/sdk/screen-orientation/).

Camera mặc định tiếp tục dùng các biến `CAMERA_*` hiện có. Để thêm camera thật:

1. Tạo thiết bị `CAMERA` và gắn vào căn nhà được phép xem; lấy UUID trong DB.
2. Chạy một instance dịch vụ edge Tapo cho camera đó, với Camera Account, host và
   thư mục recordings riêng. Backend phải truy cập được instance trong mạng nội bộ.
3. Đặt biến sau trong môi trường backend (thay UUID và credential bằng cấu hình thật):

   ```dotenv
   CAMERA_EXTRA_SOURCES='{"00000000-0000-0000-0000-000000000002":{"url":"http://tapo-camera-2:8090","username":"viewer","password":"replace-me"}}'
   ```

4. Tạo lại container backend để nhận biến môi trường mới. Nguồn chỉ xuất hiện trong
   danh sách `GET /camera/sources` nếu người dùng có quyền xem camera trong căn nhà.
   Nếu cần đàm thoại cho nguồn bổ sung, thêm `intercom_url` trỏ tới instance go2rtc
   riêng có stream `tapo_intercom` của camera đó; thiếu cấu hình sẽ báo chưa có audio.

App chỉ gửi `camera_id`; backend chọn URL từ cấu hình server, kiểm tra quyền từng
thiết bị, rồi cấp ticket gắn với camera, tài nguyên và chất lượng. Không nhập RTSP
hoặc mật khẩu trực tiếp vào ô thêm luồng trên điện thoại.

## Kiểm tra

```powershell
# Từ gốc dự án
docker exec elderly_care_backend python -m unittest discover -s tests -p test_camera_proxy.py -v
# Từ apps/mobile
npm run type-check
node --test src/features/livestream/__tests__/*.test.cjs
```

Trên điện thoại: xem live → thử xoay từng hướng → chụp ảnh → ghi 30 giây → mở MP4 →
bật/tắt riêng tư → đưa app xuống nền rồi mở lại. Nếu không vào được backend, kiểm tra IP Wi-Fi
và quyền truy cập cổng 8000 qua Windows Firewall. Bản build production cần HTTPS phù hợp cấu hình OS.

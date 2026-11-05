"""HTTP camera service: MJPEG/JPEG, MP4 và pytapo; chạy bằng python -m."""
import asyncio
from collections import deque
import hmac
import logging
import os
from pathlib import Path
import re
import subprocess
import uuid
import time

from aiohttp import BasicAuth, web
import cv2

from src.drivers.camera import CameraDriver
from src.drivers.tapo import TapoControl, rtsp_url

LOG = logging.getLogger(__name__)
PAGE = """<!doctype html><html lang="vi"><meta charset="utf-8">
<title>Tapo C200C</title><style>body{font:18px system-ui;max-width:960px;margin:24px auto;background:#152331;color:#fff}img{width:100%}button,a{margin:8px;padding:10px}a{color:#8de}</style>
<h1>Tapo C200C</h1><img src="/live.mjpg" onerror="setTimeout(()=>this.src='/live.mjpg?t='+Date.now(),3000)" alt="Camera đang kết nối">
<p><a href="/snapshot.jpg" target="_blank">Chụp ảnh JPEG</a></p>
<div style="margin:12px 0;padding:10px;background:#243447;border-radius:6px">
<span id="fall-badge" style="font-weight:bold;color:#4caf50">Nhận diện té ngã: ĐANG BẬT</span>
<button onclick="toggleFall()" id="btn-fall">Bật/Tắt AI té ngã</button>
<label style="margin-left:12px;cursor:pointer"><input type="checkbox" id="chk-overlay" onchange="toggleOverlay(this.checked)"> Hiển thị khung xương AI</label>
<span id="fall-alert" style="color:#ff5252;margin-left:12px;display:none;font-weight:bold">⚠️ CẢNH BÁO TÉ NGÃ VỪA XẢY RA!</span>
</div>
<button onclick='post("/ptz",{x:-10,y:0})'>Trái</button>
<button onclick='post("/ptz",{x:10,y:0})'>Phải</button>
<button onclick='post("/ptz",{x:0,y:10})'>Lên</button>
<button onclick='post("/ptz",{x:0,y:-10})'>Xuống</button>
<button onclick='post("/motion",{enabled:true,sensitivity:"normal"})'>Bật phát hiện chuyển động</button>
<button onclick='post("/motion",{enabled:false})'>Tắt phát hiện chuyển động</button>
<button onclick='record()'>Ghi 30 giây MP4</button>
<p id="status"></p><div id="files"></div>
<script>
async function post(path,body){let r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});let d=await r.json();document.getElementById("status").textContent=JSON.stringify(d);return d;}
async function record(){await post("/recordings",{seconds:30});}
async function refresh(){try{let r=await fetch("/recordings");if(!r.ok)return;let d=await r.json();document.getElementById("files").replaceChildren(...d.files.map(f=>{let a=document.createElement("a");a.href="/recordings/"+f;a.textContent=f;return a;}));}catch(e){}}
async function toggleFall(){let s=await (await fetch("/fall-detection")).json();await post("/fall-detection",{enabled:!s.enabled});checkFall();}
function toggleOverlay(c){let img=document.querySelector("img");let u=new URL(img.src,window.location.origin);if(c){u.searchParams.set("overlay","1");}else{u.searchParams.delete("overlay");}u.searchParams.set("t",Date.now());img.src=u.pathname+u.search;}
async function checkFall(){try{let s=await (await fetch("/fall-detection")).json();document.getElementById("fall-badge").textContent="Nhận diện té ngã: "+(s.enabled?"ĐANG BẬT":"ĐÃ TẮT");document.getElementById("fall-badge").style.color=s.enabled?"#4caf50":"#888";document.getElementById("fall-alert").style.display=s.detected?"inline":"none";}catch(e){}}
setInterval(checkFall,3000);checkFall();setInterval(refresh,3000);refresh();
</script></html>"""


class Recorder:
    """FFmpeg sao chép video RTSP sang MP4, không encode lại, không cần GPU."""
    def __init__(self, url: str, directory: Path):
        """Chuẩn bị bộ ghi RTSP và thư mục lưu MP4.

        Args:
            url: URL RTSP riêng tư của camera.
            directory: Thư mục lưu MP4.

        Returns:
            Không có. Tác động: tạo thư mục nếu chưa tồn tại.
        """
        self.url, self.directory = url, directory
        directory.mkdir(parents=True, exist_ok=True)
        # Giữ tác vụ để chặn ghi chồng và hủy khi dịch vụ dừng.
        self.task = None
        self.error = None
        # Tên bản ghi đang xử lý; chỉ tệp hoàn tất mới được liệt kê.
        self.active = None

    def start(self, seconds: int, url: str | None = None) -> str:
        """Bắt đầu ghi nếu không có bản ghi khác đang chạy.

        Args:
            seconds: Thời lượng ghi theo giây.
            url: URL RTSP tùy chọn (nếu có nguồn động).

        Returns:
            Tên MP4. Tác động: tạo asyncio task; báo 409 nếu đang ghi.
        """
        if self.task and not self.task.done():
            raise web.HTTPConflict(text="Một bản ghi đang chạy")
        name = f"{uuid.uuid4().hex}.mp4"
        self.error = None
        self.active = name
        target_url = url or self.url
        self.task = asyncio.create_task(self._record(name, seconds, target_url))
        return name

    async def _record(self, name: str, seconds: int, url: str | None = None):
        # File tạm không được liệt kê/tải xuống cho tới khi MP4 hoàn tất.
        """Chạy FFmpeg sao chép video, chỉ công bố MP4 khi hoàn tất.

        Args:
            name: Tên MP4 được tạo cho tác vụ.
            seconds: Thời lượng ghi theo giây.
            url: URL RTSP của luồng camera.

        Returns:
            Không có. Tác động: tạo tiến trình/tệp; dọn tiến trình và tệp tạm cả khi hủy.
        """
        target_url = url or self.url
        if not target_url:
            self.error = "Chưa có nguồn URL camera để ghi hình"
            return
        temporary = self.directory / (name + ".part")
        process = None
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
                "-rtsp_transport", "tcp", "-timeout", "5000000", "-i", target_url,
                "-t", str(seconds), "-map", "0:v:0", "-an", "-c:v", "copy",
                "-movflags", "+faststart", "-f", "mp4", "-y", str(temporary),
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            code = await asyncio.wait_for(process.wait(), seconds + 20)
            if code or not temporary.exists() or temporary.stat().st_size == 0:
                raise RuntimeError("record failed")
            temporary.replace(self.directory / name)
        except asyncio.CancelledError:
            raise
        except Exception:
            # Không trả stderr vì FFmpeg có thể ghi URL/credential vào đó.
            self.error = "Ghi hình thất bại; kiểm tra RTSP, kết nối và dung lượng ổ đĩa"
            LOG.warning(self.error)
        finally:
            if process and process.returncode is None:
                process.kill()
                await process.wait()
            temporary.unlink(missing_ok=True)
            self.active = None

    async def close(self):
        """Hủy và chờ tác vụ ghi hiện tại khi đóng dịch vụ.

        Returns:
            Không có. Tác động: dọn task và tài nguyên FFmpeg.
        """
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)


def get_mqtt_client():
    """Khởi tạo MQTT Client kết nối đến EMQX để gửi cảnh báo té ngã."""
    try:
        from src.services.mqtt_client import MQTTClient
        host = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
        port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
        device_id = os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main"))
        client = MQTTClient({
            "broker_host": host,
            "broker_port": port,
            "username": os.getenv("MQTT_USERNAME", "backend"),
            "password": os.getenv("MQTT_PASSWORD", "mqtt_secure_pass_123"),
            "client_id": f"camera-ai-{uuid.uuid4().hex[:6]}",
            "topics": {
                "telemetry": f"care/{device_id}/telemetry",
                "alert": f"care/{device_id}/alert",
            },
        })
        client.connect()
        return client
    except Exception:
        return None


class CameraFallDetector:
    """Giám sát và nhận diện té ngã AI trực tiếp trên luồng camera."""
    def __init__(self, camera_driver, recorder, detector=None, mqtt=None):
        self.camera = camera_driver
        self.recorder = recorder
        self.detector = detector
        self.mqtt = mqtt
        self.enabled = os.getenv("FALL_DETECTION_ENABLED", "true").lower() in ("1", "true", "yes")
        self.last_fall_time = 0.0
        self.fall_count = 0
        self.latest_clip = None
        self.latest_result = None
        self.get_active_driver_fn = None
        self.frame_buffer = deque(maxlen=75)  # Lưu 5 giây video ở 15 FPS
        self.task = None

    def start(self):
        if self.task and not self.task.done():
            return
        if self.detector is None:
            try:
                from src.ai.vision.pose_detector import PoseDetector
                root = Path(__file__).resolve().parent.parent
                onnx_p = str(root / "ai" / "vision" / "models" / "yolov8n-pose.onnx")
                rknn_p = str(root / "ai" / "vision" / "models" / "yolov8n-pose.rknn")
                self.detector = PoseDetector({
                    "model_path": rknn_p,
                    "fallback_model": onnx_p,
                    "confidence_threshold": float(os.getenv("POSE_CONF_THRESHOLD", "0.35")),
                    "face_blurring": False,
                    "fall_detection": {
                        "horizontal_ratio_threshold": 0.5,
                        "consecutive_frames": 3,
                        "drop_velocity_threshold": float(os.getenv("FALL_DROP_VELOCITY", "0.55")),
                        "fallen_angle_threshold": float(os.getenv("FALL_ANGLE_THRESHOLD", "55.0")),
                        "aspect_ratio_threshold": float(os.getenv("FALL_ASPECT_RATIO", "1.25")),
                        "min_fallen_duration": float(os.getenv("FALL_MIN_DURATION", "0.40")),
                    },
                })
                self.detector.load_model()
            except Exception as e:
                LOG.warning("PoseDetector chưa sẵn sàng (%s); camera tiếp tục hoạt động.", e)
        if self.mqtt is None and os.getenv("MQTT_BROKER_HOST"):
            self.mqtt = get_mqtt_client()
        self.task = asyncio.create_task(self._loop())

    async def _loop(self):
        last_frame_id = -1
        while True:
            try:
                await asyncio.sleep(0.03)
                active_cam = self.get_active_driver_fn() if self.get_active_driver_fn else self.camera
                if not active_cam:
                    continue
                if hasattr(active_cam, "get_latest_frame_with_id"):
                    frame, frame_id = active_cam.get_latest_frame_with_id()
                    if frame is None or frame_id == last_frame_id:
                        continue
                    last_frame_id = frame_id
                else:
                    frame = active_cam.get_latest_frame()
                    if frame is None:
                        continue
                self.frame_buffer.append(frame.copy())
                if self.detector is None:
                    continue
                res = await asyncio.to_thread(self.detector.detect, frame)
                self.latest_result = res
                if self.enabled and res and res.is_fall_detected:
                    await self._on_fall(res, frame)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                LOG.error("Lỗi trong vòng lặp nhận diện té ngã: %s", exc)

    async def _on_fall(self, res, current_frame):
        now = time.time()
        if now - self.last_fall_time < 10.0:
            return
        self.last_fall_time = now
        self.fall_count += 1
        event_id = uuid.uuid4().hex
        LOG.warning(">>> [CAMERA AI] Phát hiện té ngã! ID: %s <<<", event_id)

        frames = list(self.frame_buffer)
        clip_name = f"{event_id}.mp4"
        clip_path = self.recorder.directory / clip_name
        self.latest_clip = clip_name
        await asyncio.to_thread(self._save_clip, frames, clip_path)

        # Đẩy sự cố sang cloud video archive nếu có cấu hình
        archive = getattr(self.camera, "archive", None)
        if archive:
            try:
                archive.incident(event_id, frames)
            except Exception as e:
                LOG.warning("Lỗi đẩy incident sang video archive: %s", e)

        if self.mqtt:
            self._send_alert(event_id, getattr(res, "confidence", 0.9), now, clip_name, clip_path)

    def _save_clip(self, frames, path: Path):
        if not frames:
            return
        try:
            h, w = frames[0].shape[:2]
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}",
                "-r", "15", "-i", "pipe:0", "-an", "-c:v", "libx264",
                "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-f", "mp4", str(path)
            ], input=b"".join(f.tobytes() for f in frames), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=True)
        except Exception:
            try:
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer = cv2.VideoWriter(str(path), fourcc, 15.0, (w, h))
                for f in frames:
                    writer.write(f)
                writer.release()
            except Exception as e:
                LOG.error("Không thể ghi file video ngã: %s", e)

    def _send_alert(self, event_id, confidence, timestamp, clip_name, clip_path):
        if not self.mqtt:
            return
        try:
            payload = {
                "id": event_id,
                "device_id": os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main")),
                "alert_type": "FALL_DETECTED",
                "alert_level": "CRITICAL",
                "confidence": float(confidence),
                "timestamp": timestamp,
                "message": "Phát hiện té ngã (Camera AI)!",
                "video_clip_url": f"/recordings/{clip_name}",
                "clip_path": str(clip_path),
                "sources": ["camera"],
            }
            self.mqtt.publish_alert(payload)
            LOG.info("Đã gửi cảnh báo té ngã MQTT kèm video: %s", clip_name)
        except Exception as e:
            LOG.error("Lỗi gửi MQTT cảnh báo té ngã: %s", e)

    async def close(self):
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
        if self.mqtt:
            try:
                self.mqtt.disconnect()
            except Exception:
                pass


def create_app(camera=None, control=None, recorder=None, fall_detector=None) -> web.Application:
    """Lắp middleware, endpoint và vòng đời dịch vụ camera.

    Args:
        camera: Driver được tiêm vào; None để dùng driver mặc định.
        control: Bộ điều khiển Tapo; None để tạo mặc định.
        recorder: Bộ ghi MP4; None để tạo mặc định.

    Returns:
        Ứng dụng aiohttp; nguồn camera bắt đầu khi chạy lifecycle.
    """
    username = os.environ["CAMERA_HTTP_USERNAME"]
    password = os.environ["CAMERA_HTTP_PASSWORD"]
    if not username or not password:
        raise ValueError("Phải cấu hình HTTP username/password")
    camera = camera or CameraDriver({})
    camera_pool: dict[str, CameraDriver] = {}

    def get_camera_driver(src: str | None = None) -> CameraDriver:
        if not src:
            for active_driver in list(camera_pool.values()):
                if active_driver.is_connected():
                    return active_driver
            return camera
        if src not in camera_pool:
            driver = CameraDriver({"source": src})
            driver.start()
            camera_pool[src] = driver
        return camera_pool[src]

    def get_active_driver() -> CameraDriver:
        for d in list(camera_pool.values()):
            if d.is_connected():
                return d
        return camera

    control = control or TapoControl()
    control_pool: dict[str, TapoControl] = {}

    def get_tapo_control(src: str | None = None) -> TapoControl:
        if not src:
            return control
        from urllib.parse import urlparse, unquote
        try:
            u = urlparse(src)
            host = u.hostname
            if not host:
                return control
            user = unquote(u.username) if u.username else None
            password = unquote(u.password) if u.password else None
            key = f"{host}:{user}"
            if key not in control_pool:
                control_pool[key] = TapoControl(host=host, user=user, password=password)
            return control_pool[key]
        except Exception:
            return control

    try:
        rec_url = rtsp_url()
    except Exception:
        rec_url = os.getenv("CAMERA_SOURCE", "")
    recorder = recorder or Recorder(rec_url, Path("/recordings"))
    fall_detector = fall_detector or CameraFallDetector(camera, recorder)
    fall_detector.get_active_driver_fn = get_active_driver

    @web.middleware
    async def authentication(request, handler):
        """Kiểm tra Basic Auth, kiểu JSON và chuẩn hóa lỗi API.

        Args:
            request: HTTP request hiện tại.
            handler: Handler tiếp theo của middleware.

        Returns:
            HTTP response; healthz được phép gọi không cần đăng nhập.
        """
        if request.path == "/healthz":
            return await handler(request)
        try:
            auth = BasicAuth.decode(request.headers.get("Authorization", ""))
            valid = hmac.compare_digest(auth.login.encode(), username.encode())
            valid &= hmac.compare_digest(auth.password.encode(), password.encode())
        except ValueError:
            valid = False
        if not valid:
            return web.json_response({"error": "Cần đăng nhập"}, status=401,
                                     headers={"WWW-Authenticate": 'Basic realm="Camera"'})
        # Các lệnh thay đổi trạng thái yêu cầu JSON (ngăn form POST từ site khác).
        if request.method == "POST" and request.content_type != "application/json":
            return web.json_response({"error": "Cần Content-Type application/json"}, status=415)
        try:
            response = await handler(request)
            response.headers["Cache-Control"] = "no-store"
            return response
        except web.HTTPException as exc:
            return web.json_response({"error": exc.text}, status=exc.status)
        except (ValueError, TypeError, KeyError):
            return web.json_response({"error": "JSON/tham số không hợp lệ"}, status=400)
        except Exception:
            return web.json_response({"error": "Camera từ chối/không hỗ trợ lệnh hoặc lỗi xác thực; kiểm tra firmware và tài khoản điều khiển"}, status=502)

    async def body(request):
        """Đọc JSON và yêu cầu dữ liệu là object.

        Args:
            request: HTTP request hiện tại.

        Returns:
            Dictionary request; báo lỗi HTTP nếu dữ liệu không hợp lệ.
        """
        data = await request.json()
        if not isinstance(data, dict):
            raise ValueError("expected object")
        return data

    def jpeg(cam_driver=None, height=None, quality=80, overlay=False):
        """Mã hóa frame hiện tại thành JPEG.

        Returns:
            Byte JPEG; báo 503 khi chưa có frame.
        """
        target_cam = cam_driver or get_active_driver()
        frame = target_cam.get_latest_frame()
        if frame is None:
            raise web.HTTPServiceUnavailable(text="Camera chưa có frame hoặc đã mất kết nối")
        if overlay and fall_detector:
            try:
                r = getattr(fall_detector, "latest_result", None)
                if r:
                    from src.ai.vision.utils import draw_pose
                    frame = draw_pose(
                        frame=frame.copy(),
                        keypoints=r.keypoints,
                        bboxes=r.bounding_boxes,
                        is_fall=r.is_fall_detected,
                        tracks=getattr(r, "tracks", None),
                    )
            except Exception as exc:
                LOG.error("Lỗi vẽ skeleton: %s", exc)
        # Giữ tỉ lệ và không phóng giả ảnh nguồn có độ phân giải thấp hơn lựa chọn.
        if height and frame.shape[0] > height:
            width = max(1, round(frame.shape[1] * height / frame.shape[0]))
            frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            raise RuntimeError("JPEG encoding failed")
        return encoded.tobytes()

    async def health(request):
        # Liveness riêng; /status cho biết camera thực sự có frame mới hay không.
        """Báo dịch vụ HTTP đang hoạt động.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON liveness; không khẳng định camera đang kết nối.
        """
        return web.json_response({"service": "ok"})

    async def index(request):
        """Phục vụ trang kiểm tra camera nội bộ.

        Args:
            request: HTTP request hiện tại.

        Returns:
            HTTP response HTML.
        """
        return web.Response(text=PAGE, content_type="text/html")

    async def status(request):
        """Đọc tình trạng nguồn ảnh của driver.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON trạng thái kết nối camera.
        """
        cam = get_camera_driver(request.query.get("src"))
        # Chờ tối đa 2.5s nếu driver vừa khởi động để trả về connected ngay lần poll đầu
        if not cam.is_connected():
            for _ in range(25):
                await asyncio.sleep(0.1)
                if cam.is_connected():
                    break
        return web.json_response({"connected": cam.is_connected()})

    async def snapshot(request):
        """Chụp JPEG từ frame hiện tại ngoài event loop.

        Args:
            request: HTTP request hiện tại.

        Returns:
            HTTP response ảnh JPEG.
        """
        cam = get_camera_driver(request.query.get("src"))
        overlay = request.query.get("overlay", "0").lower() in ("1", "true", "yes")
        return web.Response(body=await asyncio.to_thread(jpeg, cam, None, 80, overlay), content_type="image/jpeg")

    async def live(request):
        """Phát MJPEG từ frame mới nhất cho tới khi mất kết nối.

        Args:
            request: HTTP request hiện tại.

        Returns:
            StreamResponse. Tác động: ghi ảnh định kỳ, dừng khi client/nguồn ảnh ngắt.
        """
        cam = get_camera_driver(request.query.get("src"))
        overlay = request.query.get("overlay", "0").lower() in ("1", "true", "yes")
        preset = request.query.get("quality", "auto")
        if preset not in ("1080p", "720p", "auto"):
            raise ValueError("invalid video quality")
        height = 1080 if preset == "1080p" else 720
        encoding_quality = 85 if preset == "1080p" else 75
        frame = await asyncio.to_thread(jpeg, cam, height, encoding_quality, overlay)
        stable_frames = 0
        response = web.StreamResponse(headers={
            "Content-Type": "multipart/x-mixed-replace; boundary=frame", "Cache-Control": "no-store"})
        await response.prepare(request)
        try:
            while True:
                started = time.monotonic()
                await asyncio.wait_for(response.write(
                    b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " +
                    str(len(frame)).encode() + b"\r\n\r\n" + frame + b"\r\n"), 5)
                # Auto hạ tải khi client nhận chậm; chỉ tăng lại sau 30 frame ổn định.
                if preset == "auto":
                    slow = time.monotonic() - started > 0.15
                    stable_frames = 0 if slow else stable_frames + 1
                    if slow:
                        height, encoding_quality = 480, 60
                    elif stable_frames >= 30:
                        height, encoding_quality = 720, 75
                await asyncio.sleep(0.1)  # giới hạn MJPEG 10 FPS cho trình duyệt
                frame = await asyncio.to_thread(jpeg, cam, height, encoding_quality, overlay)
        except (ConnectionError, asyncio.TimeoutError, web.HTTPServiceUnavailable):
            return response

    async def command(request, method, *args):
        # Không chặn event loop bằng I/O đồng bộ của pytapo.
        """Chạy lệnh pytapo đồng bộ ngoài event loop; fallback an toàn khi chỉ có Camera Account RTSP."""
        target_ctrl = get_tapo_control(request.query.get("src") if hasattr(request, "query") else None)
        try:
            result = await asyncio.to_thread(target_ctrl.call, method, *args)
        except Exception:
            if method == "getPrivacyMode":
                return web.json_response({"result": {"enabled": "off"}})
            if method == "getMotionDetection":
                return web.json_response({"result": {"enabled": "off", "sensitivity": "normal"}})
            raise web.HTTPBadGateway(text="Camera cần tài khoản TP-Link ID (email/mật khẩu App Tapo) để điều khiển PTZ/cài đặt trên firmware mới.") from None
        return web.json_response({"result": result})

    async def info(request):
        """Đọc thông tin cơ bản của camera Tapo."""
        return await command(request, "getBasicInfo")

    async def ptz(request):
        """Kiểm tra bước quay trong giới hạn trước khi gửi lệnh."""
        data = await body(request)
        x, y = data.get("x", 0), data.get("y", 0)
        if any(type(v) is not int or not -30 <= v <= 30 for v in (x, y)):
            raise ValueError("PTZ step must be -30..30")
        return await command(request, "moveMotor", x, y)

    async def motion(request):
        """Đọc hoặc cập nhật phát hiện chuyển động tùy HTTP method."""
        if request.method == "GET":
            return await command(request, "getMotionDetection")
        data = await body(request)
        sensitivity = data.get("sensitivity", "normal")
        if type(data.get("enabled")) is not bool or sensitivity not in ("low", "normal", "high"):
            raise ValueError("invalid motion settings")
        return await command(request, "setMotionDetection", data["enabled"], sensitivity)

    async def privacy(request):
        """Đọc hoặc cập nhật chế độ riêng tư tùy HTTP method."""
        if request.method == "GET":
            return await command(request, "getPrivacyMode")
        data = await body(request)
        if type(data.get("enabled")) is not bool:
            raise ValueError("enabled must be boolean")
        return await command(request, "setPrivacyMode", data["enabled"])

    async def video_mode(request):
        """Đọc/ghi Day/Night bằng pytapo; off là ngày, on là hồng ngoại ban đêm."""
        mapping = {"day": "off", "night": "on", "auto": "auto"}
        try:
            target_ctrl = get_tapo_control(request.query.get("src") if hasattr(request, "query") else None)
            if request.method == "POST":
                mode = (await body(request)).get("mode")
                if not isinstance(mode, str) or mode not in mapping:
                    raise ValueError("invalid video mode")
                await asyncio.to_thread(target_ctrl.call, "setDayNightMode", mapping[mode])
            result = await asyncio.to_thread(target_ctrl.call, "getDayNightMode")
            current = {value: key for key, value in mapping.items()}.get(result) if isinstance(result, str) else "auto"
            return web.json_response({"mode": current or "auto"})
        except ValueError:
            raise
        except Exception:
            return web.json_response({"mode": "auto"})

    async def recordings(request):
        """Liệt kê MP4 hoàn tất hoặc bắt đầu bản ghi mới.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON thư viện/trạng thái ghi. Tác động: POST tạo tác vụ ghi hình.
        """
        if request.method == "POST":
            seconds = (await body(request)).get("seconds", 30)
            if type(seconds) is not int or not 1 <= seconds <= 3600:
                raise ValueError("seconds must be 1..3600")
            src = request.query.get("src")
            return web.json_response({"file": recorder.start(seconds, src), "status": "recording"}, status=202)
        return web.json_response({"active": recorder.active, "error": recorder.error,
                                  "files": sorted(p.name for p in recorder.directory.glob("*.mp4"))})

    async def download(request):
        """Chỉ phục vụ tên MP4 đúng định dạng trong thư mục bản ghi.

        Args:
            request: HTTP request hiện tại.

        Returns:
            FileResponse dạng tải xuống hoặc lỗi nếu tệp không tồn tại.
        """
        name = request.match_info["name"]
        if not re.fullmatch(r"[0-9a-f]{32}\.mp4", name):
            raise web.HTTPNotFound()
        path = recorder.directory / name
        if not path.is_file():
            raise web.HTTPNotFound()
        return web.FileResponse(path, headers={"Content-Disposition": f'attachment; filename="{name}"'})

    async def get_fall(request):
        """Đọc tình trạng nhận diện té ngã AI."""
        return web.json_response({
            "enabled": fall_detector.enabled,
            "detected": time.time() - fall_detector.last_fall_time < 15.0 if fall_detector.last_fall_time else False,
            "last_fall": fall_detector.last_fall_time if fall_detector.last_fall_time else None,
            "fall_count": fall_detector.fall_count,
            "latest_clip": fall_detector.latest_clip,
        })

    async def set_fall(request):
        """Bật hoặc tắt tính năng nhận diện té ngã AI."""
        data = await body(request)
        if "enabled" not in data or not isinstance(data["enabled"], bool):
            raise ValueError("enabled must be boolean")
        fall_detector.enabled = data["enabled"]
        return web.json_response({"enabled": fall_detector.enabled})

    async def lifecycle(app):
        """Gắn vòng đời driver, recorder và AI fall detector với ứng dụng.

        Args:
            app: Ứng dụng đang bắt đầu hoặc kết thúc lifecycle.

        Returns:
            Async generator. Tác động: mở camera khi chạy, đóng recorder/driver khi dừng.
        """
        if camera.source != 0 or os.getenv("CAMERA_SOURCE") or os.getenv("TAPO_HOST"):
            camera.start()
        fall_detector.start()
        try:
            yield
        finally:
            await fall_detector.close()
            await recorder.close()
            for d in list(camera_pool.values()):
                await asyncio.to_thread(d.stop)
            await asyncio.to_thread(camera.stop)

    app = web.Application(middlewares=[authentication], client_max_size=4096)
    app.cleanup_ctx.append(lifecycle)
    app.add_routes([
        web.get("/", index), web.get("/healthz", health), web.get("/status", status),
        web.get("/snapshot.jpg", snapshot), web.get("/live.mjpg", live),
        web.get("/info", info), web.post("/ptz", ptz),
        web.get("/motion", motion), web.post("/motion", motion),
        web.get("/privacy", privacy), web.post("/privacy", privacy),
        web.get("/video-mode", video_mode), web.post("/video-mode", video_mode),
        web.get("/recordings", recordings), web.post("/recordings", recordings),
        web.get("/recordings/{name}", download),
        web.get("/fall-detection", get_fall), web.post("/fall-detection", set_fall),
    ])
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    web.run_app(create_app(), host="0.0.0.0", port=8090, access_log=None, shutdown_timeout=5)

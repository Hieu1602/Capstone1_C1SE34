"""HTTP camera service: MJPEG/JPEG, MP4 và pytapo; chạy bằng python -m."""
import asyncio
import hmac
import logging
import os
from pathlib import Path
import re
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
setInterval(refresh,3000);refresh();
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

    def start(self, seconds: int) -> str:
        """Bắt đầu ghi nếu không có bản ghi khác đang chạy.

        Args:
            seconds: Thời lượng ghi theo giây.

        Returns:
            Tên MP4. Tác động: tạo asyncio task; báo 409 nếu đang ghi.
        """
        if self.task and not self.task.done():
            raise web.HTTPConflict(text="Một bản ghi đang chạy")
        name = f"{uuid.uuid4().hex}.mp4"
        self.error = None
        self.active = name
        self.task = asyncio.create_task(self._record(name, seconds))
        return name

    async def _record(self, name: str, seconds: int):
        # File tạm không được liệt kê/tải xuống cho tới khi MP4 hoàn tất.
        """Chạy FFmpeg sao chép video, chỉ công bố MP4 khi hoàn tất.

        Args:
            name: Tên MP4 được tạo cho tác vụ.
            seconds: Thời lượng ghi theo giây.

        Returns:
            Không có. Tác động: tạo tiến trình/tệp; dọn tiến trình và tệp tạm cả khi hủy.
        """
        temporary = self.directory / (name + ".part")
        process = None
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
                "-rtsp_transport", "tcp", "-timeout", "5000000", "-i", self.url,
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


def create_app(camera=None, control=None, recorder=None) -> web.Application:
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
    control = control or TapoControl()
    recorder = recorder or Recorder(rtsp_url(), Path("/recordings"))

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

    def jpeg(height=None, quality=80):
        """Mã hóa frame hiện tại thành JPEG.

        Returns:
            Byte JPEG; báo 503 khi chưa có frame.
        """
        frame = camera.get_latest_frame()
        if frame is None:
            raise web.HTTPServiceUnavailable(text="Camera chưa có frame hoặc đã mất kết nối")
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
        return web.json_response({"connected": camera.is_connected()})

    async def snapshot(request):
        """Chụp JPEG từ frame hiện tại ngoài event loop.

        Args:
            request: HTTP request hiện tại.

        Returns:
            HTTP response ảnh JPEG.
        """
        return web.Response(body=await asyncio.to_thread(jpeg), content_type="image/jpeg")

    async def live(request):
        """Phát MJPEG từ frame mới nhất cho tới khi mất kết nối.

        Args:
            request: HTTP request hiện tại.

        Returns:
            StreamResponse. Tác động: ghi ảnh định kỳ, dừng khi client/nguồn ảnh ngắt.
        """
        preset = request.query.get("quality", "auto")
        if preset not in ("1080p", "720p", "auto"):
            raise ValueError("invalid video quality")
        height = 1080 if preset == "1080p" else 720
        encoding_quality = 85 if preset == "1080p" else 75
        frame = await asyncio.to_thread(jpeg, height, encoding_quality)
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
                frame = await asyncio.to_thread(jpeg, height, encoding_quality)
        except (ConnectionError, asyncio.TimeoutError, web.HTTPServiceUnavailable):
            return response

    async def command(method, *args):
        # Không chặn event loop bằng I/O đồng bộ của pytapo.
        """Chạy lệnh pytapo đồng bộ ngoài event loop.

        Args:
            method: Tên phương thức pytapo cần gọi.
            args: Đối số truyền tiếp cho phương thức pytapo.

        Returns:
            Kết quả lệnh. Tác động: gọi camera; chuẩn hóa lỗi để không lộ credential.
        """
        try:
            result = await asyncio.to_thread(control.call, method, *args)
        except Exception:
            raise web.HTTPBadGateway(text="Lệnh chưa được xác nhận: kiểm tra firmware, mạng và tài khoản điều khiển") from None
        return web.json_response({"result": result})

    async def info(request):
        """Đọc thông tin cơ bản của camera Tapo.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON thông tin thiết bị.
        """
        return await command("getBasicInfo")

    async def ptz(request):
        """Kiểm tra bước quay trong giới hạn trước khi gửi lệnh.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON kết quả. Tác động: thay đổi hướng camera.
        """
        data = await body(request)
        x, y = data.get("x", 0), data.get("y", 0)
        if any(type(v) is not int or not -30 <= v <= 30 for v in (x, y)):
            raise ValueError("PTZ step must be -30..30")
        return await command("moveMotor", x, y)

    async def motion(request):
        """Đọc hoặc cập nhật phát hiện chuyển động tùy HTTP method.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON kết quả. Tác động: POST thay đổi cài đặt Tapo.
        """
        if request.method == "GET":
            return await command("getMotionDetection")
        data = await body(request)
        sensitivity = data.get("sensitivity", "normal")
        if type(data.get("enabled")) is not bool or sensitivity not in ("low", "normal", "high"):
            raise ValueError("invalid motion settings")
        return await command("setMotionDetection", data["enabled"], sensitivity)

    async def privacy(request):
        """Đọc hoặc cập nhật chế độ riêng tư tùy HTTP method.

        Args:
            request: HTTP request hiện tại.

        Returns:
            JSON kết quả. Tác động: POST bật/tắt hình ảnh camera.
        """
        if request.method == "GET":
            return await command("getPrivacyMode")
        data = await body(request)
        if type(data.get("enabled")) is not bool:
            raise ValueError("enabled must be boolean")
        return await command("setPrivacyMode", data["enabled"])

    async def video_mode(request):
        """Đọc/ghi Day/Night bằng pytapo; off là ngày, on là hồng ngoại ban đêm.

        Args:
            request: GET để đọc, POST với mode day/night/auto để đổi chế độ.
        Returns:
            JSON chế độ đã được camera xác nhận; POST tác động đến cảm biến Tapo.
        """
        mapping = {"day": "off", "night": "on", "auto": "auto"}
        try:
            if request.method == "POST":
                mode = (await body(request)).get("mode")
                if not isinstance(mode, str) or mode not in mapping:
                    raise ValueError("invalid video mode")
                await asyncio.to_thread(control.call, "setDayNightMode", mapping[mode])
            result = await asyncio.to_thread(control.call, "getDayNightMode")
            current = {value: key for key, value in mapping.items()}.get(result) if isinstance(result, str) else None
            if current is None:
                raise RuntimeError("invalid video mode response")
            return web.json_response({"mode": current})
        except ValueError:
            raise
        except Exception:
            raise web.HTTPBadGateway(text="Không đọc/đổi được chế độ ngày đêm của camera") from None

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
            return web.json_response({"file": recorder.start(seconds), "status": "recording"}, status=202)
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

    async def lifecycle(app):
        """Gắn vòng đời driver và recorder với ứng dụng.

        Args:
            app: Ứng dụng đang bắt đầu hoặc kết thúc lifecycle.

        Returns:
            Async generator. Tác động: mở camera khi chạy, đóng recorder/driver khi dừng.
        """
        camera.start()
        try:
            yield
        finally:
            await recorder.close()
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
    ])
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    web.run_app(create_app(), host="0.0.0.0", port=8090, access_log=None, shutdown_timeout=5)

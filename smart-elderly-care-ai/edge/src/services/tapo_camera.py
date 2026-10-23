"""HTTP camera service: MJPEG/JPEG, MP4 và pytapo; chạy bằng python -m."""
import asyncio
import hmac
import logging
import os
from pathlib import Path
import re
import uuid

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
        self.url, self.directory = url, directory
        directory.mkdir(parents=True, exist_ok=True)
        self.task = None
        self.error = None
        self.active = None

    def start(self, seconds: int) -> str:
        if self.task and not self.task.done():
            raise web.HTTPConflict(text="Một bản ghi đang chạy")
        name = f"{uuid.uuid4().hex}.mp4"
        self.error = None
        self.active = name
        self.task = asyncio.create_task(self._record(name, seconds))
        return name

    async def _record(self, name: str, seconds: int):
        # File tạm không được liệt kê/tải xuống cho tới khi MP4 hoàn tất.
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
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)


def create_app(camera=None, control=None, recorder=None) -> web.Application:
    username = os.environ["CAMERA_HTTP_USERNAME"]
    password = os.environ["CAMERA_HTTP_PASSWORD"]
    if not username or not password:
        raise ValueError("Phải cấu hình HTTP username/password")
    camera = camera or CameraDriver({})
    control = control or TapoControl()
    recorder = recorder or Recorder(rtsp_url(), Path("/recordings"))

    @web.middleware
    async def authentication(request, handler):
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
        data = await request.json()
        if not isinstance(data, dict):
            raise ValueError("expected object")
        return data

    def jpeg():
        frame = camera.get_latest_frame()
        if frame is None:
            raise web.HTTPServiceUnavailable(text="Camera chưa có frame hoặc đã mất kết nối")
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ok:
            raise RuntimeError("JPEG encoding failed")
        return encoded.tobytes()

    async def health(request):
        # Liveness riêng; /status cho biết camera thực sự có frame mới hay không.
        return web.json_response({"service": "ok"})

    async def index(request):
        return web.Response(text=PAGE, content_type="text/html")

    async def status(request):
        return web.json_response({"connected": camera.is_connected()})

    async def snapshot(request):
        return web.Response(body=await asyncio.to_thread(jpeg), content_type="image/jpeg")

    async def live(request):
        frame = await asyncio.to_thread(jpeg)
        response = web.StreamResponse(headers={
            "Content-Type": "multipart/x-mixed-replace; boundary=frame", "Cache-Control": "no-store"})
        await response.prepare(request)
        try:
            while True:
                await asyncio.wait_for(response.write(
                    b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " +
                    str(len(frame)).encode() + b"\r\n\r\n" + frame + b"\r\n"), 5)
                await asyncio.sleep(0.1)  # giới hạn MJPEG 10 FPS cho trình duyệt
                frame = await asyncio.to_thread(jpeg)
        except (ConnectionError, asyncio.TimeoutError, web.HTTPServiceUnavailable):
            return response

    async def command(method, *args):
        # Không chặn event loop bằng I/O đồng bộ của pytapo.
        try:
            result = await asyncio.to_thread(control.call, method, *args)
        except Exception:
            raise web.HTTPBadGateway(text="Lệnh chưa được xác nhận: kiểm tra firmware, mạng và tài khoản điều khiển") from None
        return web.json_response({"result": result})

    async def info(request):
        return await command("getBasicInfo")

    async def ptz(request):
        data = await body(request)
        x, y = data.get("x", 0), data.get("y", 0)
        if any(type(v) is not int or not -30 <= v <= 30 for v in (x, y)):
            raise ValueError("PTZ step must be -30..30")
        return await command("moveMotor", x, y)

    async def motion(request):
        if request.method == "GET":
            return await command("getMotionDetection")
        data = await body(request)
        sensitivity = data.get("sensitivity", "normal")
        if type(data.get("enabled")) is not bool or sensitivity not in ("low", "normal", "high"):
            raise ValueError("invalid motion settings")
        return await command("setMotionDetection", data["enabled"], sensitivity)

    async def privacy(request):
        if request.method == "GET":
            return await command("getPrivacyMode")
        data = await body(request)
        if type(data.get("enabled")) is not bool:
            raise ValueError("enabled must be boolean")
        return await command("setPrivacyMode", data["enabled"])

    async def recordings(request):
        if request.method == "POST":
            seconds = (await body(request)).get("seconds", 30)
            if type(seconds) is not int or not 1 <= seconds <= 3600:
                raise ValueError("seconds must be 1..3600")
            return web.json_response({"file": recorder.start(seconds), "status": "recording"}, status=202)
        return web.json_response({"active": recorder.active, "error": recorder.error,
                                  "files": sorted(p.name for p in recorder.directory.glob("*.mp4"))})

    async def download(request):
        name = request.match_info["name"]
        if not re.fullmatch(r"[0-9a-f]{32}\.mp4", name):
            raise web.HTTPNotFound()
        path = recorder.directory / name
        if not path.is_file():
            raise web.HTTPNotFound()
        return web.FileResponse(path, headers={"Content-Disposition": f'attachment; filename="{name}"'})

    async def lifecycle(app):
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
        web.get("/recordings", recordings), web.post("/recordings", recordings),
        web.get("/recordings/{name}", download),
    ])
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    web.run_app(create_app(), host="0.0.0.0", port=8090, access_log=None, shutdown_timeout=5)

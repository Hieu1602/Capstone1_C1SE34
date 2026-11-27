"""HTTP camera service: MJPEG/JPEG, MP4 và pytapo; chạy bằng python -m."""
import asyncio
from collections import deque
from datetime import datetime, timezone
import hmac
import logging
import os
from pathlib import Path
import re
import subprocess
import uuid
import time
from urllib.parse import urlparse

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
        self.cleanup_task = None

    def cleanup_old_recordings(self, retention_hours: float | None = None, max_bytes: int | None = None) -> int:
        """Xóa các bản ghi MP4 cũ hơn retention_hours hoặc khi tổng dung lượng vượt max_bytes.

        Args:
            retention_hours: Giờ lưu tối đa trước khi xóa (mặc định CAMERA_RETENTION_HOURS hoặc 48h).
            max_bytes: Giới hạn dung lượng byte (mặc định MAX_RECORDING_STORAGE_GB hoặc 5GB).

        Returns:
            Số file đã xóa.
        """
        if retention_hours is None:
            retention_hours = float(os.getenv("CAMERA_RETENTION_HOURS", "48"))
        if max_bytes is None:
            max_bytes = int(os.getenv("MAX_RECORDING_STORAGE_GB", "5")) * 1024 * 1024 * 1024

        deleted_count = 0
        cutoff = time.time() - (retention_hours * 3600)
        try:
            mp4_files = [p for p in self.directory.glob("*.mp4") if p.is_file() and p.name != self.active]
            mp4_files.sort(key=lambda p: p.stat().st_mtime)

            remaining = []
            for path in mp4_files:
                try:
                    if path.stat().st_mtime < cutoff:
                        path.unlink(missing_ok=True)
                        deleted_count += 1
                        LOG.info("Dọn dẹp bản ghi camera hết hạn: %s", path.name)
                    else:
                        remaining.append(path)
                except OSError:
                    continue

            total_size = sum(p.stat().st_size for p in remaining if p.is_file())
            for path in remaining:
                if total_size <= max_bytes:
                    break
                try:
                    size = path.stat().st_size
                    path.unlink(missing_ok=True)
                    total_size -= size
                    deleted_count += 1
                    LOG.info("Dọn dẹp bản ghi cũ do dung lượng vượt ngưỡng: %s", path.name)
                except OSError:
                    continue
        except Exception as exc:
            LOG.error("Lỗi dọn dẹp bản ghi camera: %s", exc)
        return deleted_count

    async def _cleanup_loop(self, interval_seconds: float = 1800):
        while True:
            try:
                await asyncio.to_thread(self.cleanup_old_recordings)
            except asyncio.CancelledError:
                break
            except Exception as e:
                LOG.error("Lỗi trong vòng lặp dọn dẹp bản ghi: %s", e)
            try:
                await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                break

    def start_cleanup(self, interval_seconds: float = 1800):
        if self.cleanup_task and not self.cleanup_task.done():
            return
        self.cleanup_task = asyncio.create_task(self._cleanup_loop(interval_seconds))

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
        """Hủy và chờ tác vụ ghi và dọn dẹp hiện tại khi đóng dịch vụ.

        Returns:
            Không có. Tác động: dọn task và tài nguyên FFmpeg.
        """
        if self.cleanup_task and not self.cleanup_task.done():
            self.cleanup_task.cancel()
            await asyncio.gather(self.cleanup_task, return_exceptions=True)
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
    """Giám sát và nhận diện té ngã AI trực tiếp trên luồng camera kết hợp Face Re-ID hồ sơ bệnh án."""
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
        self.frame_buffer = deque(maxlen=125)  # Lưu 5 giây video ở 25 FPS
        self.inference_fps = max(1.0, float(os.getenv("AI_INFERENCE_FPS", "25.0")))
        self.inference_interval = 1.0 / self.inference_fps
        self._last_infer_time = 0.0
        self.task = None
        self.sync_task = None

        # Khởi tạo Face Re-ID Manager kết nối hồ sơ bệnh án
        cache_file = os.getenv("FACE_CACHE_FILE")
        if not cache_file:
            candidates = [
                Path(__file__).resolve().parent.parent.parent / "config" / "enrolled_faces.json",
                Path("/app/config/enrolled_faces.json"),
                Path("config/enrolled_faces.json"),
            ]
            for p in candidates:
                if p.exists():
                    cache_file = str(p)
                    break
            if not cache_file:
                cache_file = str(candidates[0])

        try:
            from src.ai.vision.face_reid import FaceReIDManager
            self.face_manager = FaceReIDManager(cache_file=cache_file)
        except Exception as e:
            LOG.warning("[FaceReID] Không thể nạp FaceReIDManager: %s", e)
            self.face_manager = None

        self.backend_url = os.getenv("BACKEND_URL", "http://backend:8000")

    async def sync_enrolled_faces(self):
        """Đồng bộ khuôn mặt từ hồ sơ bệnh án qua Backend API."""
        if not self.face_manager:
            return
        try:
            import urllib.request
            urls = [
                f"{self.backend_url}/api/v1/patients/enrolled-faces",
                "http://127.0.0.1:8000/api/v1/patients/enrolled-faces",
                "http://backend:8000/api/v1/patients/enrolled-faces",
            ]
            for url in urls:
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "TapoCameraFaceReID/1.0"})
                    with urllib.request.urlopen(req, timeout=3) as response:
                        if response.status == 200:
                            data = json.loads(response.read().decode("utf-8"))
                            base_url = url.rsplit("/api/v1/", 1)[0]
                            active_ids = {str(item.get("elderly_id")) for item in data if item.get("elderly_id")} if isinstance(data, list) else set()
                            if isinstance(data, list):
                                stale_ids = [k for k in list(self.face_manager.enrolled_elderly.keys()) if k not in active_ids]
                                for sk in stale_ids:
                                    self.face_manager.enrolled_elderly.pop(sk, None)
                                if stale_ids:
                                    self.face_manager.save_cache()
                                    LOG.info("[FaceReID] Đã xóa %d khuôn mặt cũ không còn trong DB.", len(stale_ids))
                            count = 0
                            for item in data:
                                eid = item.get("elderly_id")
                                name = item.get("full_name")
                                emb = item.get("face_embedding")
                                avatar = item.get("avatar_url")
                                if not (eid and name):
                                    continue
                                enrolled_from_img = False
                                if avatar:
                                    try:
                                        import base64
                                        import numpy as np
                                        img_bytes = None
                                        if avatar.startswith("data:image") and "," in avatar:
                                            img_bytes = base64.b64decode(avatar.split(",", 1)[1])
                                        else:
                                            img_url = avatar if avatar.startswith("http") else f"{base_url}{avatar if avatar.startswith('/') else '/' + avatar}"
                                            img_req = urllib.request.Request(img_url, headers={"User-Agent": "TapoCameraFaceReID/1.0"})
                                            with urllib.request.urlopen(img_req, timeout=4) as img_resp:
                                                if img_resp.status == 200:
                                                    img_bytes = img_resp.read()
                                        if img_bytes:
                                            arr = np.frombuffer(img_bytes, dtype=np.uint8)
                                            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                                            if img is not None:
                                                enrolled_from_img = self.face_manager.enroll_from_image(eid, name, img, avatar)
                                    except Exception:
                                        pass
                                if not enrolled_from_img and emb:
                                    self.face_manager.enroll_elderly(eid, name, emb, avatar)
                                    enrolled_from_img = True
                                if enrolled_from_img:
                                    count += 1
                            if count > 0:
                                LOG.info("[FaceReID] Đã đồng bộ %d khuôn mặt từ hồ sơ bệnh án (%s).", count, url)
                            return
                except Exception:
                    continue
        except Exception as e:
            LOG.debug("[FaceReID] Không thể đồng bộ từ Backend: %s", e)

    def start(self):
        if self.task and not self.task.done():
            return
        if self.detector is None:
            try:
                from src.ai.vision.pose_detector import PoseDetector
                root = Path(__file__).resolve().parent.parent
                onnx_p = str(root / "ai" / "vision" / "models" / "yolov8n-pose.onnx")
                rknn_p = str(root / "ai" / "vision" / "models" / "yolov8n-pose.rknn")
                cache_file_str = str(self.face_manager.cache_file) if self.face_manager else None
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
                        "face_cache_file": cache_file_str,
                    },
                })
                self.detector.load_model()
            except Exception as e:
                LOG.warning("PoseDetector chưa sẵn sàng (%s); camera tiếp tục hoạt động.", e)
        if self.mqtt is None and os.getenv("MQTT_BROKER_HOST"):
            self.mqtt = get_mqtt_client()
        self.task = asyncio.create_task(self._loop())
        # Đồng bộ danh sách khuôn mặt bệnh nhân định kỳ (mỗi 60s)
        self.sync_task = asyncio.create_task(self._sync_loop())

    async def _sync_loop(self):
        while True:
            try:
                await asyncio.to_thread(lambda: None)
                await self.sync_enrolled_faces()
                await asyncio.sleep(60.0)
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(15.0)

    async def _loop(self):
        last_frame_id = -1
        while True:
            try:
                await asyncio.sleep(0.01)
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
                now = time.monotonic()
                if (now - self._last_infer_time) < self.inference_interval:
                    continue
                self._last_infer_time = now
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

        # 1. Định danh đối tượng té ngã qua Face Re-ID hồ sơ bệnh án
        fallen_track = None
        if hasattr(res, "tracks") and res.tracks:
            for t in res.tracks:
                state_val = getattr(getattr(t, "posture_state", None), "value", str(getattr(t, "posture_state", "")))
                if state_val in ("FALLEN", "FALLING") or getattr(t, "is_fall_alerted", False):
                    fallen_track = t
                    break
            if not fallen_track and res.tracks:
                fallen_track = res.tracks[0]

        patient_id = getattr(fallen_track, "elderly_id", None) if fallen_track else None
        patient_name = getattr(fallen_track, "person_name", None) if fallen_track else None
        face_sim = getattr(fallen_track, "face_similarity", 0.0) if fallen_track else 0.0
        is_elderly = getattr(fallen_track, "is_elderly", False) if fallen_track else False

        # Thử nhận diện khuôn mặt trực tiếp từ frame hiện tại nếu track chưa nhận diện được
        if not is_elderly and self.face_manager and current_frame is not None and hasattr(res, "keypoints") and res.keypoints:
            try:
                from src.ai.vision.face_reid import extract_face_roi
                for kps in res.keypoints:
                    kps_tuples = [
                        (float(p.x), float(p.y), float(p.confidence)) if hasattr(p, "confidence")
                        else (float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else 1.0)
                        for p in kps
                    ]
                    face_roi = extract_face_roi(current_frame, kps_tuples)
                    if face_roi is not None:
                        e_id, name, score = self.face_manager.identify_face(face_roi)
                        if e_id and score >= self.face_manager.similarity_threshold:
                            patient_id = e_id
                            patient_name = name
                            face_sim = score
                            is_elderly = True
                            break
            except Exception as e:
                LOG.debug("[FaceReID] Lỗi trích xuất khuôn mặt trực tiếp: %s", e)

        # Định dạng thông báo cảnh báo rõ ràng
        if is_elderly and patient_name:
            sim_pct = int(face_sim * 100) if face_sim > 0 else 92
            fall_msg = f"🚨 CẢNH BÁO TÉ NGÃ: Phát hiện {patient_name} té ngã (Khớp khuôn mặt hồ sơ: {sim_pct}%)!"
        elif patient_name and patient_name not in ("Person", "Khách / Người nhà"):
            fall_msg = f"🚨 CẢNH BÁO TÉ NGÃ: Phát hiện {patient_name} té ngã tại camera!"
        else:
            fall_msg = "🚨 CẢNH BÁO TÉ NGÃ: Phát hiện người té ngã tại camera an ninh (Chưa khớp khuôn mặt hồ sơ)!"

        # 2. Lưu ảnh chụp hiện trường tại khoảnh khắc ngã
        thumb_name = f"{event_id}.jpg"
        thumb_path = self.recorder.directory / thumb_name
        try:
            cv2.imwrite(str(thumb_path), current_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        except Exception as e:
            LOG.warning("Không thể lưu ảnh snapshot ngã: %s", e)

        # 3. Cắt và lưu video clip 5s từ bộ đệm RAM
        frames = list(self.frame_buffer)
        clip_name = f"{event_id}.mp4"
        clip_path = self.recorder.directory / clip_name
        self.latest_clip = clip_name
        await asyncio.to_thread(self._save_clip, frames, clip_path)

        # 4. Đám mây video archive (AWS S3)
        cloud_thumb = None
        cloud_video = None

        archive = getattr(self.camera, "archive", None)
        if archive:
            try:
                archive.incident(event_id, frames)
            except Exception as e:
                LOG.warning("Lỗi đẩy incident sang video archive: %s", e)

        if self.mqtt:
            self._send_alert(
                event_id=event_id,
                confidence=getattr(res, "confidence", 0.9),
                timestamp=now,
                clip_name=clip_name,
                clip_path=clip_path,
                thumb_name=thumb_name,
                thumb_path=thumb_path,
                cloud_video=cloud_video,
                cloud_thumb=cloud_thumb,
                message=fall_msg,
                patient_id=patient_id,
                patient_name=patient_name,
                face_sim=face_sim,
                is_patient_matched=is_elderly,
            )

    def _save_clip(self, frames, path: Path):
        if not frames:
            return
        h, w = frames[0].shape[:2]
        try:
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}",
                "-r", "25", "-i", "pipe:0", "-an", "-c:v", "libx264",
                "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-f", "mp4", str(path)
            ], input=b"".join(f.tobytes() for f in frames), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=True)
        except Exception:
            try:
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # type: ignore[attr-defined]
                writer = cv2.VideoWriter(str(path), fourcc, 25.0, (w, h))
                for f in frames:
                    writer.write(f)
                writer.release()
            except Exception as e:
                LOG.error("Không thể ghi file video ngã: %s", e)

    def _send_alert(
        self,
        event_id,
        confidence,
        timestamp,
        clip_name,
        clip_path,
        thumb_name=None,
        thumb_path=None,
        cloud_video=None,
        cloud_thumb=None,
        message=None,
        patient_id=None,
        patient_name=None,
        face_sim=None,
        is_patient_matched=False,
    ):
        if not self.mqtt:
            return
        try:
            notes_dict = {
                "patient_id": patient_id,
                "patient_name": patient_name,
                "face_similarity": round(float(face_sim), 2) if face_sim else None,
                "is_patient_matched": bool(is_patient_matched),
            }
            payload = {
                "id": event_id,
                "device_id": os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main")),
                "alert_type": "FALL_DETECTED",
                "alert_level": "CRITICAL",
                "confidence": float(confidence),
                "timestamp": timestamp,
                "message": message or "Phát hiện té ngã (Camera AI)!",
                "thumbnail_url": cloud_thumb or (f"/recordings/{thumb_name}" if thumb_name else None),
                "thumbnail_path": str(thumb_path) if thumb_path else None,
                "video_clip_url": cloud_video or f"/recordings/{clip_name}",
                "clip_path": str(clip_path),
                "sources": ["camera", "face_reid"],
                "notes": json.dumps(notes_dict, ensure_ascii=False),
            }
            if patient_id:
                payload["patient_id"] = patient_id
            if patient_name:
                payload["patient_name"] = patient_name
            self.mqtt.publish_alert(payload)
            LOG.info("Đã gửi cảnh báo té ngã MQTT kèm video & Face Re-ID: %s (Người: %s)", clip_name, patient_name or "Chưa rõ")
        except Exception as e:
            LOG.error("Lỗi gửi MQTT cảnh báo té ngã: %s", e)

    async def close(self):
        for t in (self.task, self.sync_task):
            if t and not t.done():
                t.cancel()
                await asyncio.gather(t, return_exceptions=True)
        if self.mqtt:
            try:
                self.mqtt.disconnect()
            except Exception:
                pass


class CameraAudioDetector:
    """Phân tích âm thanh RTSP camera theo thời gian thực bằng YAMNet (Va đập & Kêu cứu)."""

    def __init__(self, camera_driver, fall_detector=None):
        self.camera = camera_driver
        self.fall_detector = fall_detector
        self.enabled = os.getenv("AUDIO_DETECTION_ENABLED", "true").lower() in ("1", "true", "yes")
        self.last_event_time = 0.0
        self.event_count = 0
        self.last_class: str | None = None
        self.last_category: str | None = None
        self.last_confidence: float | None = None
        self.task = None
        self._proc = None
        self.classifier = None
        try:
            from src.ai.audio.sound_classifier import SoundClassifier
            thresh = float(os.getenv("YAMNET_CONFIDENCE_THRESHOLD", "0.25"))
            self.classifier = SoundClassifier({"alert_confidence_threshold": thresh})
            self.classifier.load_model()
        except Exception as e:
            LOG.warning("[YAMNet] Không thể nạp SoundClassifier: %s", e)
            self.classifier = None

    def start(self):
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._loop())

    async def _loop(self):
        import numpy as np
        from src.ai.audio.sound_classifier import CLASS_VI_LABELS

        while True:
            try:
                if not self.enabled or not self.classifier:
                    await asyncio.sleep(1.0)
                    continue

                pop_fn = getattr(self.camera, "pop_audio_chunk", None)
                raw = pop_fn() if pop_fn else None
                if not raw:
                    await asyncio.sleep(0.15)
                    continue

                waveform = np.frombuffer(raw, dtype=np.float32)
                rms = float(np.sqrt(np.mean(waveform ** 2)))
                if rms > 0.002:
                    results = await asyncio.to_thread(self.classifier.classify, waveform)
                    LOG.info("[YAMNet] rms=%.4f top2=%s", rms, [(n, round(s, 2)) for n, s in results[:2]])
                event = await asyncio.to_thread(self.classifier.classify_emergency, waveform)
                if event is not None:
                    await self._handle_audio_event(event, CLASS_VI_LABELS)
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(1.0)

    async def _terminate_proc(self):
        if self._proc and self._proc.returncode is None:
            try:
                self._proc.terminate()
                await asyncio.wait_for(self._proc.wait(), timeout=2.0)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
        self._proc = None

    async def _handle_audio_event(self, event, vi_labels: dict):
        now = time.time()
        if now - self.last_event_time < 20.0:
            return
        self.last_event_time = now
        self.event_count += 1
        self.last_class = event.class_name
        self.last_category = event.category
        self.last_confidence = round(float(event.confidence), 3)

        vi_desc = vi_labels.get(event.class_name, event.class_name)
        cat_label = "Va đập" if event.category == "IMPACT" else "Kêu cứu"
        msg = f"Cảnh báo âm thanh ({cat_label}): {vi_desc} ({int(event.confidence * 100)}%)"
        LOG.warning("[YAMNet] %s", msg)

        event_id = str(uuid.uuid4())
        clip_name = None
        clip_path = None
        thumb_name = None
        thumb_path = None
        if self.fall_detector is not None:
            frames = list(self.fall_detector.frame_buffer)
            if frames:
                clip_name = f"{event_id}.mp4"
                clip_path = self.fall_detector.recorder.directory / clip_name
                await asyncio.to_thread(self.fall_detector._save_clip, frames, clip_path)
                thumb_name = f"{event_id}.jpg"
                thumb_path = self.fall_detector.recorder.directory / thumb_name
                try:
                    cv2.imwrite(str(thumb_path), frames[-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
                except Exception:
                    thumb_path = None

        mqtt = getattr(self.fall_detector, "mqtt", None)
        if mqtt:
            payload = {
                "id": event_id,
                "device_id": os.getenv("CAMERA_DEVICE_ID", os.getenv("DEVICE_ID", "camera-main")),
                "alert_type": "ACOUSTIC_DISTRESS",
                "alert_level": "HIGH",
                "confidence": float(event.confidence),
                "timestamp": now,
                "message": msg,
                "sources": ["yamnet_audio"],
                "notes": json.dumps({
                    "category": event.category,
                    "class_name": event.class_name,
                    "vi_label": vi_desc,
                }, ensure_ascii=False),
            }
            if clip_name and clip_path:
                payload["video_clip_url"] = f"/recordings/{clip_name}"
                payload["clip_path"] = str(clip_path)
            if thumb_name and thumb_path:
                payload["thumbnail_url"] = f"/recordings/{thumb_name}"
                payload["thumbnail_path"] = str(thumb_path)
            try:
                mqtt.publish_alert(payload)
            except Exception as e:
                LOG.error("[YAMNet] Lỗi gửi MQTT alert: %s", e)

    async def close(self):
        if self.task and not self.task.done():
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
        await self._terminate_proc()


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
            if not host or host in ("192.168.1.100", "127.0.0.1", "localhost"):
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
    audio_detector = CameraAudioDetector(camera, fall_detector)

    @web.middleware
    async def authentication(request, handler):
        """Kiểm tra Basic Auth, kiểu JSON và chuẩn hóa lỗi API.

        Args:
            request: HTTP request hiện tại.
            handler: Handler tiếp theo của middleware.

        Returns:
            HTTP response; healthz được phép gọi không cần đăng nhập.
        """
        if request.path == "/healthz" or request.path.startswith("/speaker/clip/"):
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
        if request.method == "POST" and not request.path.startswith("/api/") and request.content_type != "application/json":
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
        live_host = None
        src_val = getattr(cam, "source", None)
        if isinstance(src_val, str) and "://" in src_val:
            live_host = urlparse(src_val).hostname
        return web.json_response({"connected": cam.is_connected(), **({"host": live_host} if live_host else {})})

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
        encoding_quality = 85 if preset == "1080p" else (75 if preset == "720p" else 65)
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
                    slow = time.monotonic() - started > 0.12
                    stable_frames = 0 if slow else stable_frames + 1
                    if slow:
                        height, encoding_quality = 480, 55
                    elif stable_frames >= 30:
                        height, encoding_quality = 720, 65
                frame = await asyncio.to_thread(jpeg, cam, height, encoding_quality, overlay)
                elapsed = time.monotonic() - started
                if elapsed < 0.04:
                    await asyncio.sleep(0.04 - elapsed)
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

    async def sync_sd_recordings(client=None):
        """Tự động đồng bộ các đoạn video từ thẻ nhớ SD của camera về thư mục /recordings/."""
        if not client:
            return
        try:
            await asyncio.to_thread(client.getUserID)
            time_corr = await asyncio.to_thread(client.getTimeCorrection)
            recs_list = await asyncio.to_thread(client.getRecordingsList)
            if not recs_list:
                return
            today = list(recs_list[-1].values())[0]["date"]
            day_recs = await asyncio.to_thread(client.getRecordings, today)
            for r in day_recs:
                val = list(r.values())[0]
                st, et = int(val["startTime"]), int(val["endTime"])
                dur = et - st
                if dur <= 0:
                    continue
                dt_str = time.strftime("%Y-%m-%d_%H-%M-%S", time.localtime(st))
                fn = f"SD_{dt_str}_{dur}s.mp4"
                fp = recorder.directory / fn
                if fp.is_file() and fp.stat().st_size > 1024:
                    continue
                if time.time() - et < 30:
                    continue
                from pytapo.media_stream.downloader import Downloader
                dl = Downloader(client, st, et, time_corr, outputDirectory=str(recorder.directory) + "/", fileName=fn, output="mp4")
                async for _ in dl.download():
                    pass
        except Exception as err:
            LOG.debug("SD sync notice: %s", err)

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

        ctrl = get_tapo_control(request.query.get("src"))
        try:
            cl = ctrl.get_client()
            if cl and not getattr(recorder, "_sd_syncing", False):
                recorder._sd_syncing = True
                async def _bg():
                    try:
                        await sync_sd_recordings(cl)
                    finally:
                        recorder._sd_syncing = False
                asyncio.create_task(_bg())
        except Exception:
            pass

        files = sorted(
            [p.name for p in recorder.directory.glob("*.mp4") if not p.name.startswith(".")],
            reverse=True,
        )
        return web.json_response({"active": recorder.active, "error": recorder.error, "files": files})

    async def download(request):
        """Chỉ phục vụ tên MP4 đúng định dạng trong thư mục bản ghi.

        Args:
            request: HTTP request hiện tại.

        Returns:
            FileResponse dạng tải xuống hoặc lỗi nếu tệp không tồn tại.
        """
        name = request.match_info["name"]
        if not re.fullmatch(r"[a-zA-Z0-9_\-\. ]+\.(mp4|jpg)", name) or ".." in name:
            raise web.HTTPNotFound()
        path = recorder.directory / name
        if not path.is_file():
            raise web.HTTPNotFound()
        headers = {"Content-Disposition": f'inline; filename="{name}"', "Accept-Ranges": "bytes"}
        return web.FileResponse(path, headers=headers)

    def get_sd_client():
        pwd = os.environ.get("TAPO_CONTROL_PASSWORD") or os.environ.get("TAPO_PASSWORD", "")
        user = os.environ.get("TAPO_CONTROL_USERNAME") or os.environ.get("TAPO_USERNAME", "")
        host = os.environ.get("TAPO_HOST", "")
        from pytapo import Tapo
        return Tapo(host, user, pwd, cloudPassword=pwd)

    async def get_coverage(request):
        """Trả về danh sách dải thời gian ghi hình từ thẻ nhớ SD của camera."""
        start_str = request.query.get("start")
        end_str = request.query.get("end")
        start_ts = 0
        end_ts = 2147483647
        if start_str:
            try:
                start_ts = int(datetime.fromisoformat(start_str.replace("Z", "+00:00")).timestamp())
            except Exception:
                pass
        if end_str:
            try:
                end_ts = int(datetime.fromisoformat(end_str.replace("Z", "+00:00")).timestamp())
            except Exception:
                pass

        def _fetch():
            try:
                cl = get_sd_client()
                rl = cl.getRecordingsList()
                available_dates = [list(x.values())[0]["date"] for x in rl] if rl else []
                items = []
                for d in available_dates:
                    try:
                        recs = cl.getRecordings(d)
                        for r in recs:
                            val = list(r.values())[0]
                            st, et = int(val["startTime"]), int(val["endTime"])
                            if et <= st:
                                continue
                            if et > start_ts and st < end_ts:
                                st_iso = datetime.fromtimestamp(st, tz=timezone.utc).isoformat()
                                et_iso = datetime.fromtimestamp(et, tz=timezone.utc).isoformat()
                                items.append({"start": st_iso, "end": et_iso})
                    except Exception:
                        continue
                return items
            except Exception as exc:
                LOG.warning("Lỗi đọc thẻ nhớ SD trong worker: %s", exc)
                return []

        items = await asyncio.to_thread(_fetch)
        return web.json_response({"items": items})

    def find_local_recording(target_ts):
        """Tìm file MP4 đã tải sẵn trên đĩa bao phủ target_ts để phát ngay không cần tải lại."""
        candidates = []
        for p in recorder.directory.glob("*.mp4"):
            name = p.name
            m1 = re.match(r"^SD_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_(\d+)s\.mp4$", name)
            if m1:
                try:
                    st = int(datetime.strptime(m1.group(1), "%Y-%m-%d_%H-%M-%S").replace(tzinfo=timezone.utc).timestamp())
                    dur = int(m1.group(2))
                    if st <= target_ts <= st + dur and p.stat().st_size > 1024:
                        candidates.append((dur, st, dur, name))
                except Exception:
                    pass
            m2 = re.match(r"^SD_c_(\d+)_(\d+)s\.mp4$", name)
            if m2:
                try:
                    st = int(m2.group(1))
                    dur = int(m2.group(2))
                    if st <= target_ts <= st + dur and p.stat().st_size > 1024:
                        candidates.append((dur, st, dur, name))
                except Exception:
                    pass
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            _, st, dur, name = candidates[0]
            return st, dur, name
        return None

    async def get_archive_session(request):
        """Tìm và chuẩn bị đoạn video từ thẻ nhớ SD cho dải thời gian yêu cầu."""
        start_str = request.query.get("start")
        if not start_str:
            raise web.HTTPBadRequest(text="Thiếu tham số start")
        try:
            target_ts = int(datetime.fromisoformat(start_str.replace("Z", "+00:00")).timestamp())
        except Exception:
            raise web.HTTPBadRequest(text="Định dạng start không hợp lệ")

        # 1. Ưu tiên kiểm tra các file MP4 đã có sẵn trên đĩa bao phủ target_ts để phát ngay lập tức (0ms độ trễ)
        local_match = find_local_recording(target_ts)
        if local_match:
            loc_st, loc_dur, loc_name = local_match
            return web.json_response({
                "file": loc_name,
                "started_at": datetime.fromtimestamp(loc_st, tz=timezone.utc).isoformat(),
                "duration": loc_dur,
            })

        def _prepare_session():
            cl = get_sd_client()
            rl = cl.getRecordingsList()
            available_dates = [list(x.values())[0]["date"] for x in rl] if rl else []
            matched = None
            closest = None
            for d in reversed(available_dates):
                try:
                    recs = cl.getRecordings(d)
                    for r in recs:
                        val = list(r.values())[0]
                        st, et = int(val["startTime"]), int(val["endTime"])
                        if st <= target_ts <= et:
                            matched = (st, et)
                            break
                        if closest is None or abs(st - target_ts) < abs(closest[0] - target_ts):
                            closest = (st, et)
                    if matched:
                        break
                except Exception:
                    continue
            return cl, (matched or closest)

        cl, matched = await asyncio.to_thread(_prepare_session)
        if not matched:
            raise web.HTTPNotFound(text="Không có bản ghi tại thời điểm này")

        st, et = matched
        # Cắt thành chunk 300s (5 phút) để xem liên tục, tua nhanh không cần tải lại từng phút
        chunk_size = 300
        chunk_st = max(st, (target_ts // chunk_size) * chunk_size)
        chunk_et = min(et, chunk_st + chunk_size)
        if chunk_et <= chunk_st:
            chunk_st = max(st, et - chunk_size)
            chunk_et = et
        dur = chunk_et - chunk_st
        file_name = f"SD_c_{chunk_st}_{dur}s.mp4"
        file_path = recorder.directory / file_name

        if not file_path.is_file() or file_path.stat().st_size < 1024:
            def _download_chunk():
                tc = cl.getTimeCorrection()
                from pytapo.media_stream.downloader import Downloader
                dl = Downloader(cl, chunk_st, chunk_et, tc, outputDirectory=str(recorder.directory) + "/", fileName=file_name, output="mp4")
                async def _run():
                    async for _ in dl.download():
                        pass
                asyncio.run(_run())
                tmp_fast = recorder.directory / f"fast_{file_name}"
                if file_path.is_file() and file_path.stat().st_size >= 1024:
                    rc = os.system(f'ffmpeg -y -i "{file_path}" -c copy -movflags +faststart "{tmp_fast}" >{os.devnull} 2>&1')
                    if rc == 0 and tmp_fast.is_file() and tmp_fast.stat().st_size >= 1024:
                        tmp_fast.replace(file_path)
                    elif tmp_fast.is_file():
                        tmp_fast.unlink()
            await asyncio.to_thread(_download_chunk)

        st_iso = datetime.fromtimestamp(chunk_st, tz=timezone.utc).isoformat()
        return web.json_response({
            "file": file_name,
            "started_at": st_iso,
            "duration": dur,
        })

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

    async def get_audio(request):
        """Đọc tình trạng phân tích âm thanh AI (YAMNet)."""
        return web.json_response({
            "enabled": audio_detector.enabled,
            "model_loaded": audio_detector.classifier is not None,
            "detected": time.time() - audio_detector.last_event_time < 15.0 if audio_detector.last_event_time else False,
            "last_event": audio_detector.last_event_time if audio_detector.last_event_time else None,
            "event_count": audio_detector.event_count,
            "last_class": audio_detector.last_class,
            "last_category": audio_detector.last_category,
            "last_confidence": audio_detector.last_confidence,
        })

    async def set_audio(request):
        """Bật hoặc tắt tính năng phân tích âm thanh AI (YAMNet)."""
        data = await body(request)
        if "enabled" not in data or not isinstance(data["enabled"], bool):
            raise ValueError("enabled must be boolean")
        audio_detector.enabled = data["enabled"]
        return web.json_response({"enabled": audio_detector.enabled})

    async def discover(request):
        """Dò quét camera RTSP trong mạng nội bộ của Edge."""
        from src.drivers.tapo import discover_tapo_host
        loop = asyncio.get_running_loop()
        found_ip = await loop.run_in_executor(None, discover_tapo_host)
        cams = []
        if found_ip:
            cams.append({
                "ip": found_ip,
                "port": 554,
                "name": f"Camera TP-Link Tapo ({found_ip})",
                "brand": "TP-Link Tapo",
                "status": "Sẵn sàng: cổng RTSP đang mở.",
                "rtsp_url": f"rtsp://{found_ip}:554/stream1",
            })
        return web.json_response({"found": cams})

    async def probe(request):
        """Kiểm tra kết nối RTSP và tài khoản từ phía Edge nội bộ."""
        import base64
        from urllib.parse import urlparse
        data = await body(request)
        url = data.get("stream_url", "").strip()
        match = re.search(r"@?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(?::([0-9]{1,5}))?", url)
        if not match:
            match = re.search(r"://(?:[^@]+@)?([^:/]+)(?::([0-9]{1,5}))?", url)
        if not match:
            return web.json_response({"success": False, "reachable": False, "message": "Địa chỉ URL không hợp lệ"})
        host = match.group(1)
        port = int(match.group(2)) if match.group(2) else 554
        parsed = urlparse(url)
        username = parsed.username or ""
        password = parsed.password or ""
        path = parsed.path or "/stream1"
        if not path.startswith("/"):
            path = "/" + path
        try:
            reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=2.0)
            auth_header = ""
            if username or password:
                token = base64.b64encode(f"{username}:{password}".encode()).decode()
                auth_header = f"Authorization: Basic {token}\r\n"
            req = f"DESCRIBE rtsp://{host}:{port}{path} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SmartElderlyCare\r\n{auth_header}\r\n"
            writer.write(req.encode())
            await writer.drain()
            raw = await asyncio.wait_for(reader.read(1024), timeout=1.5)
            writer.close()
            await writer.wait_closed()
            resp_str = raw.decode("utf-8", errors="ignore").lower()
            brand = "TP-Link Tapo" if "tp-link" in resp_str or "tapo" in resp_str else "Camera IP"
            if "200 ok" in resp_str:
                return web.json_response({"success": True, "reachable": True, "message": f"Kết nối và xác thực thành công ({brand})!", "brand": brand})
            elif "401 unauthorized" in resp_str:
                msg = "Sai tài khoản hoặc mật khẩu camera (HTTP 401 Unauthorized)." if (username or password) else f"Cổng RTSP đang mở ({brand}). Vui lòng nhập tài khoản/mật khẩu."
                return web.json_response({"success": not (username or password), "reachable": True, "message": msg, "brand": brand})
            return web.json_response({"success": True, "reachable": True, "message": f"Cổng RTSP {port} trên {host} đang mở ({brand}).", "brand": brand})
        except Exception as e:
            return web.json_response({"success": False, "reachable": False, "message": f"Không thể kết nối đến {host}:{port}: {e}"})

    speaker_clips: dict[str, tuple[float, bytes]] = {}

    async def speaker_clip(request):
        """Phục vụ file audio tạm thời cho go2rtc (tapo-audio) kéo về phát ra loa camera."""
        clip_id = request.match_info.get("clip_id", "")
        now = time.monotonic()
        for k in [k for k, (exp, _) in speaker_clips.items() if exp < now]:
            speaker_clips.pop(k, None)
        entry = speaker_clips.get(clip_id)
        if not entry or entry[0] < now:
            raise web.HTTPNotFound(text="Audio clip không tồn tại hoặc đã hết hạn")
        return web.Response(body=entry[1], content_type="audio/mpeg")

    async def speaker_play(request):
        """Nhận audio base64 (MP3) và phát qua loa camera thông qua go2rtc (tapo-audio)."""
        import base64
        import uuid
        import aiohttp

        payload = await request.json()
        audio_b64 = payload.get("audio_b64")
        if not isinstance(audio_b64, str) or not audio_b64:
            raise web.HTTPBadRequest(text="Thiếu audio_b64")
        try:
            audio_bytes = base64.b64decode(audio_b64, validate=True)
        except Exception:
            raise web.HTTPBadRequest(text="audio_b64 không hợp lệ") from None
        if len(audio_bytes) > 5 * 1024 * 1024:
            raise web.HTTPBadRequest(text="Audio quá lớn (tối đa 5MB)")

        dst = str(payload.get("dst") or "tapo_intercom").strip()
        tapo_src = payload.get("tapo_src")
        try:
            volume = max(0, min(100, int(payload.get("volume", 100))))
        except (TypeError, ValueError):
            volume = 100
        if volume == 0:
            return web.json_response({"ok": True, "skipped": True, "dst": dst, "volume": 0})

        if volume != 100:
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-f", "mp3", "-i", "pipe:0",
                    "-af", f"volume={volume / 100:.2f}",
                    "-f", "mp3", "pipe:1",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                scaled_bytes, err_bytes = await asyncio.wait_for(proc.communicate(audio_bytes), timeout=10)
                if proc.returncode == 0 and scaled_bytes:
                    audio_bytes = scaled_bytes
                else:
                    LOG.warning("[Speaker] ffmpeg chỉnh âm lượng thất bại: %s", err_bytes.decode(errors="ignore")[:120])
            except Exception as vol_err:
                LOG.warning("[Speaker] Lỗi chỉnh âm lượng: %s", vol_err)

        now = time.monotonic()
        for k in [k for k, (exp, _) in speaker_clips.items() if exp < now]:
            speaker_clips.pop(k, None)
        clip_id = uuid.uuid4().hex
        speaker_clips[clip_id] = (now + 60.0, audio_bytes)

        clip_url = f"http://tapo-camera:8090/speaker/clip/{clip_id}.mp3"
        src_expr = f"ffmpeg:{clip_url}#audio=pcma#input=file"

        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            if isinstance(tapo_src, str) and tapo_src.startswith("tapo://"):
                await session.put("http://tapo-audio:1984/api/streams", params={"name": dst, "src": tapo_src})

            async def _post_go2rtc(target_dst: str):
                async with session.post(
                    "http://tapo-audio:1984/api/streams",
                    params={"dst": target_dst, "src": src_expr},
                ) as resp:
                    if resp.status >= 400:
                        err = await resp.text()
                        raise web.HTTPBadGateway(text=f"go2rtc lỗi {resp.status}: {err[:200]}")

            try:
                await _post_go2rtc(dst)
            except Exception as first_err:
                LOG.warning("[Speaker] %s lỗi (%s); tự động đồng bộ IP camera mới...", dst, first_err)
                # Lấy IP đang sống từ camera driver hoặc quét LAN tự động
                live_host = None
                try:
                    src_val = getattr(camera, "source", None)
                    if isinstance(src_val, str) and "://" in src_val:
                        live_host = urlparse(src_val).hostname
                except Exception:
                    pass
                if not live_host:
                    try:
                        from src.drivers.tapo import discover_tapo_host
                        live_host = await asyncio.to_thread(discover_tapo_host)
                    except Exception:
                        live_host = None

                if live_host:
                    new_src = None
                    if isinstance(tapo_src, str) and "@" in tapo_src:
                        new_src = f"{tapo_src.rsplit('@', 1)[0]}@{live_host}"
                    else:
                        cpwd = os.getenv("TAPO_CONTROL_PASSWORD") or os.getenv("TAPO_CLOUD_PASSWORD") or os.getenv("TAPO_PASSWORD", "")
                        if cpwd:
                            import hashlib
                            ph = hashlib.sha256(cpwd.encode("utf-8")).hexdigest().upper()
                            new_src = f"tapo://admin:{ph}@{live_host}"
                    if new_src:
                        await session.put("http://tapo-audio:1984/api/streams", params={"name": dst, "src": new_src})
                        await session.put("http://tapo-audio:1984/api/streams", params={"name": "tapo_intercom", "src": new_src})
                        await _post_go2rtc(dst)
                        return web.json_response({"ok": True, "dst": dst, "clip_id": clip_id, "bytes": len(audio_bytes), "volume": volume, "host": live_host})

                if dst != "tapo_intercom":
                    dst = "tapo_intercom"
                    await _post_go2rtc(dst)
                else:
                    raise

        return web.json_response({"ok": True, "dst": dst, "clip_id": clip_id, "bytes": len(audio_bytes)})

    async def proxy_audio(request):
        """Chuyển tiếp yêu cầu signaling WebRTC/streams tới dịch vụ go2rtc (tapo-audio:1984)."""
        target_url = f"http://tapo-audio:1984{request.rel_url}"
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                data = await request.read() if request.can_read_body else None
                req_headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "authorization")}
                async with session.request(
                    request.method,
                    target_url,
                    headers=req_headers,
                    data=data,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    resp_body = await resp.read()
                    return web.Response(
                        body=resp_body,
                        status=resp.status,
                        content_type=resp.content_type,
                    )
        except Exception as e:
            LOG.warning("Lỗi chuyển tiếp tới tapo-audio: %s (%s)", type(e).__name__, e)
            raise web.HTTPServiceUnavailable(text="Dịch vụ âm thanh go2rtc chưa sẵn sàng") from None

    async def lifecycle(app):
        """Gắn vòng đời driver, recorder và AI fall detector với ứng dụng.

        Args:
            app: Ứng dụng đang bắt đầu hoặc kết thúc lifecycle.

        Returns:
            Async generator. Tác động: mở camera khi chạy, đóng recorder/driver khi dừng.
        """
        if camera.source != 0 or os.getenv("CAMERA_SOURCE") or os.getenv("TAPO_HOST") or os.getenv("TAPO_USERNAME"):
            camera.start()
        fall_detector.start()
        audio_detector.start()
        recorder.start_cleanup()
        try:
            yield
        finally:
            await audio_detector.close()
            await fall_detector.close()
            await recorder.close()
            for d in list(camera_pool.values()):
                await asyncio.to_thread(d.stop)
            await asyncio.to_thread(camera.stop)

    app = web.Application(middlewares=[authentication], client_max_size=1048576)
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
        web.get("/coverage", get_coverage),
        web.get("/archive/session", get_archive_session),
        web.get("/fall-detection", get_fall), web.post("/fall-detection", set_fall),
        web.get("/audio-detection", get_audio), web.post("/audio-detection", set_audio),
        web.get("/discover", discover), web.post("/probe", probe),
        web.post("/speaker/play", speaker_play),
        web.get("/speaker/clip/{clip_id}.mp3", speaker_clip),
        web.route("*", "/api/webrtc", proxy_audio),
        web.route("*", "/api/streams", proxy_audio),
    ])
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    web.run_app(create_app(), host="0.0.0.0", port=8090, access_log=None, shutdown_timeout=5)

"""Bounded frame queue, durable disk outbox, and independent S3 upload worker."""
import json
import logging
import os
from pathlib import Path
import queue
import random
import shutil
import subprocess
import threading
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from uuid import UUID, uuid4

LOG = logging.getLogger(__name__)


class VideoArchive:
    def __init__(self, fps=15):
        self.fps = fps
        self.device_id = str(UUID(os.environ["CAMERA_DEVICE_ID"]))
        self.endpoint = os.environ["VIDEO_METADATA_URL"]
        if not self.endpoint.startswith("https://"):
            raise ValueError("VIDEO_METADATA_URL must use HTTPS")
        self.token = os.environ["VIDEO_INGEST_TOKEN"]
        if len(self.token) < 32:
            raise ValueError("VIDEO_INGEST_TOKEN must contain at least 32 characters")
        self.directory = Path(os.getenv("VIDEO_SPOOL_DIR", "./data/video-spool"))
        self.directory.mkdir(parents=True, exist_ok=True)
        self.max_bytes = int(os.getenv("VIDEO_SPOOL_MAX_BYTES", str(5 * 1024**3)))
        self.bucket = os.getenv("VIDEO_S3_BUCKET", "elderly-care-incidents-c1se34")
        self.region = os.getenv("VIDEO_S3_REGION", "ap-southeast-2")
        self.frames = queue.Queue(maxsize=fps * 4)
        self.events = queue.Queue(maxsize=4)
        self.stopping = threading.Event()
        self.upload_stop = threading.Event()
        self.last_frame = 0.0
        self.dropped_frames = 0
        self._client = None
        self.threads = []

    def start(self):
        if self.threads:
            return
        if not shutil.which("ffmpeg"):
            raise RuntimeError("Video archive requires FFmpeg with libx264")
        self.threads = [threading.Thread(target=self._record, daemon=True),
                        threading.Thread(target=self._upload, daemon=True)]
        for thread in self.threads:
            thread.start()

    def submit(self, frame):
        now = time.monotonic()
        if self.stopping.is_set() or now - self.last_frame < 1 / self.fps:
            return
        self.last_frame = now
        try:
            self.frames.put_nowait((now, time.time(), frame))
        except queue.Full:
            self.dropped_frames += 1
            if self.dropped_frames % self.fps == 1:
                LOG.error("Video encoder overloaded; recording frames dropped: %d", self.dropped_frames)

    def incident(self, incident_id, frames):
        if not frames:
            return False
        try:
            self.events.put_nowait((str(UUID(str(incident_id))), time.time(), frames))
            return True
        except queue.Full:
            LOG.error("Incident evidence queue full; local evidence must be retained")
            return False

    def close(self):
        self.stopping.set()
        if self.threads:
            self.threads[0].join(timeout=35)
        self.upload_stop.set()
        if self.threads:
            self.threads[1].join(timeout=5)

    def _record(self):
        frames = []
        start = wall = 0.0
        while not self.stopping.is_set() or not self.frames.empty() or not self.events.empty():
            try:
                stamp, captured, frame = self.frames.get(timeout=0.2)
                if frames and (stamp - start >= 2 or frame.shape != frames[0][1].shape):
                    continuous = 2 <= stamp - start < 2.5 and frame.shape == frames[0][1].shape
                    self._save_segment(frames, wall, 2 if continuous else min(2, frames[-1][0] + 1 / self.fps))
                    frames = []
                    if continuous:
                        start, wall = start + 2, wall + 2
                        frames.append((stamp - start, frame))
                        continue
                if not frames:
                    start, wall = stamp, captured
                frames.append((stamp - start, frame))
            except queue.Empty:
                if frames and time.monotonic() - start >= 2:
                    self._save_segment(frames, wall, min(2, frames[-1][0] + 1 / self.fps))
                    frames = []
            try:
                incident_id, captured, evidence = self.events.get_nowait()
            except queue.Empty:
                continue
            duration = len(evidence) / self.fps
            for frames_to_save, started, seconds, kind in (
                ([evidence[-1]], captured, 0, "snapshot"),
                (evidence, captured - duration, duration, "incident"),
            ):
                try:
                    self._save(frames_to_save, started, seconds, kind, incident_id)
                except Exception:
                    LOG.exception("Cannot persist %s evidence; check spool and encoder", kind)
        if frames:
            self._save_segment(frames, wall, min(2, frames[-1][0] + 1 / self.fps))

    def _save_segment(self, samples, started, duration):
        # Resample timestamps so variable capture FPS does not speed up playback.
        count = max(1, round(duration * self.fps))
        index, frames = 0, []
        for n in range(count):
            while index + 1 < len(samples) and samples[index + 1][0] <= n / self.fps:
                index += 1
            frames.append(samples[index][1])
        try:
            self._save(frames, started, count / self.fps, "segment", None)
        except Exception:
            LOG.exception("Cannot persist video segment; camera capture continues")

    def _save(self, frames, started, duration, kind, incident_id):
        used = 0
        for entry in self.directory.iterdir():
            try:
                if entry.is_file():
                    used += entry.stat().st_size
            except FileNotFoundError:
                pass  # The uploader may finish while the encoder checks capacity.
        # Reserve raw-frame size (larger than the encoded clip) before starting FFmpeg.
        reserve = sum(f.nbytes for f in frames)
        if used + reserve > self.max_bytes or shutil.disk_usage(self.directory).free < reserve + 64 * 1024**2:
            raise OSError("Video spool full; pending uploads are preserved")
        recording_id = str(uuid4())
        suffix = ".jpg" if kind == "snapshot" else ".ts" if kind == "segment" else ".mp4"
        path = self.directory / (recording_id + suffix)
        temporary = path.with_suffix(suffix + ".part")
        try:
            if kind == "snapshot":
                import cv2
                ok, data = cv2.imencode(".jpg", frames[0])
                if not ok:
                    raise RuntimeError("Snapshot encoding failed")
                temporary.write_bytes(data.tobytes())
            else:
                height, width = frames[0].shape[:2]
                subprocess.run([
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                    "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}",
                    "-r", str(self.fps), "-i", "pipe:0", "-an", "-c:v", "libx264",
                    "-preset", "ultrafast", "-threads", "1", "-pix_fmt", "yuv420p",
                    "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-g", str(self.fps * 2),
                    "-keyint_min", str(self.fps * 2), "-sc_threshold", "0", "-bf", "0",
                    *(["-f", "mpegts"] if kind == "segment" else ["-movflags", "+faststart", "-f", "mp4"]), str(temporary),
                ], input=b"".join(f.tobytes() for f in frames), stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL, check=True, timeout=30)
            temporary.replace(path)
            data = {"id": recording_id, "device_id": self.device_id, "kind": kind,
                    "started_at": datetime.fromtimestamp(started, timezone.utc).isoformat(),
                    "duration": duration, "size_bytes": path.stat().st_size,
                    "incident_id": incident_id,
                    "object_key": f"cameras/{self.device_id}/{recording_id}{suffix}"}
            self._manifest(path.with_suffix(".json"), {"metadata": data, "attempt": 0, "next_retry": 0})
        finally:
            temporary.unlink(missing_ok=True)

    @staticmethod
    def _manifest(path, data):
        temporary = path.with_suffix(".json.tmp")
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump(data, stream)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)

    def _deliver(self, manifest):
        import boto3
        from botocore.config import Config
        from boto3.s3.transfer import TransferConfig
        data = manifest["metadata"]
        path = self.directory / (data["id"] + Path(data["object_key"]).suffix)
        if self._client is None:
            self._client = boto3.client("s3", region_name=self.region, config=Config(
                signature_version="s3v4", connect_timeout=5, read_timeout=10,
                retries={"mode": "standard", "total_max_attempts": 3}))
        if not manifest.get("uploaded"):
            self._client.upload_file(str(path), self.bucket, data["object_key"],
                ExtraArgs={"ContentType": "image/jpeg" if data["kind"] == "snapshot" else "video/mp2t" if path.suffix == ".ts" else "video/mp4",
                           "ServerSideEncryption": "AES256"},
                Config=TransferConfig(use_threads=False))
            manifest["uploaded"] = True
            self._manifest(path.with_suffix(".json"), manifest)
        request = Request(self.endpoint, data=json.dumps(data).encode(), method="POST",
                          headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
        # Metadata acknowledgement is required before deleting the durable outbox entry.
        with urlopen(request, timeout=15) as response:
            if response.status != 200:
                raise RuntimeError("Metadata acknowledgement failed")
        path.with_suffix(".json").unlink()
        path.unlink(missing_ok=True)

    def _upload(self):
        while not self.upload_stop.is_set():
            for path in sorted(self.directory.glob("*.json")):
                if self.upload_stop.is_set():
                    return
                manifest = None
                try:
                    manifest = json.loads(path.read_text(encoding="utf-8"))
                    if manifest["next_retry"] > time.time():
                        continue
                    self._deliver(manifest)
                except Exception:
                    # Do not log HTTP errors/URLs or SDK messages that may contain credentials.
                    LOG.warning("Video upload/metadata failed; retaining %s for retry", path.name)
                    if manifest:
                        manifest["attempt"] += 1
                        manifest["next_retry"] = time.time() + min(300, 2 ** min(manifest["attempt"], 8)) + random.random()
                        try:
                            self._manifest(path, manifest)
                        except OSError:
                            LOG.error("Cannot persist upload retry state")
            self.upload_stop.wait(1)

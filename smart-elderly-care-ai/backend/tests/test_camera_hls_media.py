"""Decode the real API playlist across legacy MP4/TS boundaries and seek over HTTP."""
import asyncio
import functools
import io
import subprocess
import tempfile
import threading
import time
import unittest
from datetime import datetime, timezone, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.api.v1.endpoints.mobile import camera_hls as hls


class MediaIntegrationTests(unittest.TestCase):
    def test_mixed_archive_plays_eight_seconds_and_seeks_without_bad_timestamps(self):
        import imageio_ffmpeg
        executable = imageio_ffmpeg.get_ffmpeg_exe()
        run = subprocess.run
        rows = []
        start = datetime(2026, 10, 28, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory(prefix="hls-check-") as directory:
            root = Path(directory)
            for index, color in enumerate(("red", "green", "blue", "yellow")):
                source = root / f"source-{index}.mp4"
                run([executable, "-v", "error", "-f", "lavfi", "-i", f"color=c={color}:s=64x64:r=15",
                     "-t", "2", "-c:v", "libx264", "-bf", "0", "-g", "30", "-pix_fmt", "yuv420p", str(source)], check=True, timeout=20)
                payload = source.read_bytes()
                client = MagicMock()
                client.get_object.return_value = {"Body": io.BytesIO(payload), "ContentLength": len(payload)}
                with patch.object(hls.video_storage, "client", return_value=client), patch.object(
                    hls.subprocess, "run", side_effect=lambda command, **kwargs: run([executable, *command[1:]], **kwargs)
                ):
                    converted = hls.transport_stream("camera/old.mp4", len(payload), index * 2)
                if index % 2:
                    client.get_object.return_value = {"Body": io.BytesIO(converted), "ContentLength": len(converted)}
                    with patch.object(hls.video_storage, "client", return_value=client), patch.object(
                        hls.subprocess, "run", side_effect=lambda command, **kwargs: run([executable, *command[1:]], **kwargs)
                    ):
                        converted = hls.transport_stream("camera/new.ts", len(converted), index * 2)
                row = SimpleNamespace(id=uuid4(), duration=2, started_at=start + timedelta(seconds=index * 2))
                rows.append(row)
                (root / f"{row.id}.ts").write_bytes(converted)
            db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(scalars=lambda: rows)))
            response = asyncio.run(hls.manifest("test", ({"fingerprint": hls.fingerprint(rows)}, uuid4(), start, start + timedelta(minutes=30)), db))
            (root / "manifest.m3u8").write_bytes(response.body)

            class Handler(SimpleHTTPRequestHandler):
                def log_message(self, *args):
                    pass

                def do_GET(self):
                    time.sleep(0.05)
                    super().do_GET()

            server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=directory))
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                url = f"http://127.0.0.1:{server.server_port}/manifest.m3u8"
                result = run([executable, "-v", "error", "-i", url, "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], capture_output=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr.decode())
                self.assertEqual(len(result.stdout) // (64 * 64 * 3), 120)
                for position, expected in ((5, (0, 0, 255)), (1, (255, 0, 0))):
                    result = run([executable, "-v", "error", "-ss", str(position), "-i", url, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], capture_output=True, timeout=30)
                    self.assertEqual(result.returncode, 0, result.stderr.decode())
                    self.assertEqual(len(result.stdout), 64 * 64 * 3)
                    for actual, wanted in zip(result.stdout[:3], expected):
                        self.assertLess(abs(actual - wanted), 10)
            finally:
                server.shutdown()
                server.server_close()
                worker.join(timeout=5)

"""Archive tests run without AWS credentials, camera hardware or external network."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import numpy as np

from src.services.video_archive import VideoArchive
from src.services.alert_dispatcher import AlertDispatcher


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        env = {"CAMERA_DEVICE_ID": str(uuid4()), "VIDEO_METADATA_URL": "https://backend.example/api/v1/camera/archive",
               "VIDEO_INGEST_TOKEN": "x" * 32, "VIDEO_SPOOL_DIR": self.temp.name}
        self.env = patch.dict(os.environ, env)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.archive = VideoArchive(fps=2)

    def test_frame_queue_never_waits_for_upload(self):
        frame = np.zeros((8, 8, 3), dtype=np.uint8)
        with patch("src.services.video_archive.time.monotonic", side_effect=range(1, 30)):
            for _ in range(20):
                self.archive.submit(frame)
        self.assertEqual(self.archive.frames.qsize(), 8)
        self.assertEqual(self.archive.dropped_frames, 12)

    def test_resampling_preserves_two_seconds(self):
        a, b = object(), object()
        with patch.object(self.archive, "_save") as save:
            self.archive._save_segment([(0, a), (1.5, b)], 100, 2)
        self.assertEqual(save.call_args.args, ([a, a, a, b], 100, 2, "segment", None))

    def test_recording_rotates_on_timestamp_and_flushes_partial_on_stop(self):
        frame = np.zeros((8, 8, 3), dtype=np.uint8)
        for offset in (0, 0.5, 1, 1.5, 2, 2.5):
            self.archive.frames.put((10 + offset, 100 + offset, frame))
        self.archive.stopping.set()
        with patch.object(self.archive, "_save") as save:
            self.archive._record()
        self.assertEqual([call.args[2] for call in save.call_args_list], [2, 1])
        self.assertEqual([call.args[1] for call in save.call_args_list], [100, 102])

    def test_worker_persists_backoff_after_failed_upload(self):
        self.archive._save([np.zeros((8, 8, 3), dtype=np.uint8)], time.time(), 0, "snapshot", str(uuid4()))
        path = next(Path(self.temp.name).glob("*.json"))
        def fail(manifest):
            self.archive.upload_stop.set()
            raise OSError("offline")
        with patch.object(self.archive, "_deliver", side_effect=fail):
            self.archive._upload()
        manifest = json.loads(path.read_text())
        self.assertEqual(manifest["attempt"], 1)
        self.assertGreater(manifest["next_retry"], time.time())

    def test_evidence_types_are_persisted_independently(self):
        self.archive.incident(str(uuid4()), [np.zeros((8, 8, 3), dtype=np.uint8)])
        self.archive.stopping.set()
        with patch.object(self.archive, "_save", side_effect=[OSError("snapshot failed"), None]) as save:
            self.archive._record()
        self.assertEqual([call.args[3] for call in save.call_args_list], ["snapshot", "incident"])

    def test_disk_full_does_not_delete_pending_evidence(self):
        marker = Path(self.temp.name) / "pending.mp4"
        marker.write_bytes(b"pending")
        self.archive.max_bytes = 1
        with self.assertRaises(OSError):
            self.archive._save([np.zeros((8, 8, 3), dtype=np.uint8)], time.time(), 0, "snapshot", str(uuid4()))
        self.assertEqual(marker.read_bytes(), b"pending")

    def test_uploaded_file_survives_metadata_failure_and_restart(self):
        self.archive._save([np.zeros((8, 8, 3), dtype=np.uint8)], time.time(), 0, "snapshot", str(uuid4()))
        manifest_path = next(Path(self.temp.name).glob("*.json"))
        manifest = json.loads(manifest_path.read_text())
        client = MagicMock()
        self.archive._client = client
        with patch("src.services.video_archive.urlopen", side_effect=OSError("offline")):
            with self.assertRaises(OSError):
                self.archive._deliver(manifest)
        self.assertTrue(manifest_path.exists())
        self.assertEqual(len(list(Path(self.temp.name).glob("*.jpg"))), 1)
        self.assertTrue(json.loads(manifest_path.read_text())["uploaded"])
        restored = VideoArchive(fps=2)
        restored._client = client
        response = MagicMock()
        response.__enter__.return_value.status = 200
        with patch("src.services.video_archive.urlopen", return_value=response):
            restored._deliver(json.loads(manifest_path.read_text()))
        client.upload_file.assert_called_once()
        self.assertEqual(list(Path(self.temp.name).iterdir()), [])

    def test_s3_failure_keeps_file_for_retry(self):
        self.archive._save([np.zeros((8, 8, 3), dtype=np.uint8)], time.time(), 0, "snapshot", str(uuid4()))
        path = next(Path(self.temp.name).glob("*.json"))
        self.archive._client = MagicMock()
        self.archive._client.upload_file.side_effect = OSError("offline")
        with patch("src.services.video_archive.urlopen") as post:
            with self.assertRaises(OSError):
                self.archive._deliver(json.loads(path.read_text()))
            post.assert_not_called()
        self.assertFalse(json.loads(path.read_text()).get("uploaded", False))
        self.assertTrue(list(Path(self.temp.name).glob("*.jpg")))

    def test_encoder_produces_playable_two_second_h264(self):
        try:
            import imageio_ffmpeg
        except ImportError:
            self.skipTest("Install imageio-ffmpeg to run real encoder validation")
        executable = imageio_ffmpeg.get_ffmpeg_exe()
        run = subprocess.run
        def encode(command, **kwargs):
            return run([executable, *command[1:]], **kwargs)
        frame = np.zeros((32, 32, 3), dtype=np.uint8)
        with patch("src.services.video_archive.subprocess.run", side_effect=encode):
            self.archive._save([frame] * 4, time.time(), 2, "segment", None)
        path = next(Path(self.temp.name).glob("*.ts"))
        result = run([executable, "-i", str(path), "-f", "null", "-"], capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn(b"Video: h264", result.stderr)
        self.assertIn(b"Duration: 00:00:02.00", result.stderr)


class IncidentTests(unittest.IsolatedAsyncioTestCase):
    async def test_fall_evidence_and_mqtt_share_identity_without_waiting_for_s3(self):
        camera = MagicMock()
        camera.archive.device_id = str(uuid4())
        mqtt, ring = MagicMock(), MagicMock()
        speaker = MagicMock(speak=AsyncMock(), play_alert_sound=AsyncMock())
        decision = MagicMock()
        decision.alert_type.value = "FALL_DETECTED"
        decision.alert_level.value = "HIGH"
        dispatcher = AlertDispatcher(mqtt, speaker, ring, camera)
        await dispatcher.dispatch(decision)
        payload = mqtt.publish_alert.call_args.args[0]
        self.assertEqual(payload["device_id"], camera.archive.device_id)
        self.assertEqual(camera.archive.incident.call_args.args[0], payload["id"])
        ring.save_clip.assert_called_once()
        ring.save_incident_snapshots.assert_called_once()


if __name__ == "__main__":
    unittest.main()

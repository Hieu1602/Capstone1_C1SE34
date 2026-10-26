"""Integration opt-in: TAPO_TEST_RTSP_URL trỏ tới RTSP test server, không camera thật."""
import asyncio
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import cv2

from src.drivers.camera import CameraDriver
from src.services.tapo_camera import Recorder


@unittest.skipUnless(os.getenv("TAPO_TEST_RTSP_URL"), "Cần RTSP test server")
class RTSPIntegration(unittest.IsolatedAsyncioTestCase):
    async def test_read_and_record(self):
        url = os.environ["TAPO_TEST_RTSP_URL"]
        with patch.dict(os.environ, {"TAPO_HOST": ""}):
            camera = CameraDriver({"source": url})
        camera.start()
        try:
            for _ in range(100):
                if camera.is_connected():
                    break
                await asyncio.sleep(0.1)
            self.assertTrue(camera.is_connected())
            self.assertEqual(camera.get_latest_frame().shape, (240, 320, 3))
            with tempfile.TemporaryDirectory() as directory:
                recorder = Recorder(url, Path(directory))
                name = recorder.start(2)
                await asyncio.wait_for(recorder.task, 25)
                self.assertIsNone(recorder.error)
                capture = cv2.VideoCapture(str(Path(directory) / name))
                try:
                    ok, frame = capture.read()
                    self.assertTrue(ok)
                    self.assertEqual(frame.shape, (240, 320, 3))
                    self.assertGreater(capture.get(cv2.CAP_PROP_FRAME_COUNT), 10)
                finally:
                    capture.release()
        finally:
            await asyncio.to_thread(camera.stop)

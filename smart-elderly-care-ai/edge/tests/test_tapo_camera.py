"""Kiểm thử không cần camera thật: auth, API, stale frames và ghi lỗi."""
import asyncio
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

from aiohttp import BasicAuth
from aiohttp.test_utils import TestClient, TestServer
import numpy as np

from src.drivers.camera import CameraDriver
from src.drivers.tapo import rtsp_url
from src.services.tapo_camera import Recorder, create_app


class ConfigurationTests(unittest.TestCase):
    def test_credential_encoding(self):
        with patch.dict(os.environ, {"TAPO_HOST": "192.168.1.4", "TAPO_USERNAME": "a@b",
                                     "TAPO_PASSWORD": "p:/?#%", "TAPO_STREAM": "stream2"}):
            self.assertEqual(rtsp_url(), "rtsp://a%40b:p%3A%2F%3F%23%25@192.168.1.4:554/stream2")

    def test_stale_frame_is_not_returned(self):
        with patch.dict(os.environ, {}, clear=True):
            camera = CameraDriver({})
        camera._frame = np.zeros((8, 8, 3), dtype=np.uint8)
        camera._updated = time.monotonic() - 6
        self.assertIsNone(camera.get_latest_frame())
        self.assertFalse(camera.is_connected())
        camera._updated = time.monotonic()
        frame = camera.get_latest_frame()
        frame[:] = 255
        self.assertFalse(camera._frame.any())


class APITests(unittest.IsolatedAsyncioTestCase):
    async def test_day_night_mapping_and_validation(self):
        for requested, tapo_value in (("day", "off"), ("night", "on"), ("auto", "auto")):
            self.control.call.reset_mock()
            self.control.call.side_effect = lambda method, *args, result=tapo_value: result if method == "getDayNightMode" else {"error_code": 0}
            response = await self.client.post('/video-mode', json={'mode': requested}, auth=self.auth)
            self.assertEqual(response.status, 200)
            self.assertEqual(await response.json(), {'mode': requested})
            self.assertEqual(self.control.call.call_args_list[0].args, ('setDayNightMode', tapo_value))
        self.control.call.reset_mock()
        self.assertEqual((await self.client.post('/video-mode', json={'mode': 'invalid'}, auth=self.auth)).status, 400)
        self.control.call.assert_not_called()

    async def test_quality_resizes_real_jpeg_without_upscaling(self):
        self.camera.get_latest_frame.return_value = np.zeros((1080, 1920, 3), dtype=np.uint8)
        for preset, expected_height in (("1080p", 1080), ("720p", 720), ("auto", 720)):
            response = await self.client.get('/live.mjpg', params={'quality': preset}, auth=self.auth)
            headers = await response.content.readuntil(b'\r\n\r\n')
            length = int(headers.split(b'Content-Length: ')[1].split(b'\r\n')[0])
            frame = await response.content.readexactly(length)
            response.close()
            import cv2
            decoded = cv2.imdecode(np.frombuffer(frame, dtype=np.uint8), cv2.IMREAD_COLOR)
            self.assertEqual(decoded.shape[:2], (expected_height, round(expected_height * 16 / 9)))
        self.camera.get_latest_frame.return_value = np.zeros((32, 32, 3), dtype=np.uint8)
        response = await self.client.get('/live.mjpg', params={'quality': '1080p'}, auth=self.auth)
        headers = await response.content.readuntil(b'\r\n\r\n')
        length = int(headers.split(b'Content-Length: ')[1].split(b'\r\n')[0])
        decoded = cv2.imdecode(np.frombuffer(await response.content.readexactly(length), dtype=np.uint8), cv2.IMREAD_COLOR)
        response.close()
        self.assertEqual(decoded.shape[:2], (32, 32))
        self.assertEqual((await self.client.get('/live.mjpg', params={'quality': 'invalid'}, auth=self.auth)).status, 400)

    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.camera = Mock()
        self.camera.is_connected.return_value = True
        self.camera.get_latest_frame.return_value = np.zeros((32, 32, 3), dtype=np.uint8)
        self.control = Mock()
        self.control.call.return_value = {"ok": True}
        self.recorder = Recorder("rtsp://127.0.0.1:1/stream1", Path(self.temp.name))
        with patch.dict(os.environ, {"CAMERA_HTTP_USERNAME": "viewer", "CAMERA_HTTP_PASSWORD": "secret"}):
            app = create_app(self.camera, self.control, self.recorder)
        self.client = TestClient(TestServer(app))
        await self.client.start_server()
        self.auth = BasicAuth("viewer", "secret")

    async def asyncTearDown(self):
        await self.client.close()
        self.temp.cleanup()

    async def test_authentication(self):
        self.assertEqual((await self.client.get("/healthz")).status, 200)
        for path in ("/", "/snapshot.jpg", "/live.mjpg", "/recordings", "/info"):
            self.assertEqual((await self.client.get(path)).status, 401)
        self.assertEqual((await self.client.get("/status", auth=self.auth)).status, 200)

    async def test_snapshot_and_unavailable(self):
        response = await self.client.get("/snapshot.jpg", auth=self.auth)
        self.assertEqual(response.status, 200)
        self.assertTrue((await response.read()).startswith(b"\xff\xd8"))
        self.camera.get_latest_frame.return_value = None
        self.assertEqual((await self.client.get("/snapshot.jpg", auth=self.auth)).status, 503)

    async def test_mjpeg(self):
        response = await self.client.get("/live.mjpg", auth=self.auth)
        self.assertEqual(response.status, 200)
        self.assertIn(b"--frame", await response.content.read(128))
        response.close()

    async def test_control_validation(self):
        response = await self.client.post("/ptz", json={"x": 10, "y": -10}, auth=self.auth)
        self.assertEqual(response.status, 200)
        self.control.call.assert_called_with("moveMotor", 10, -10)
        for data in ({"x": 31}, {"x": True}, {"x": "10"}):
            self.assertEqual((await self.client.post("/ptz", json=data, auth=self.auth)).status, 400)
        self.assertEqual((await self.client.post("/motion", json={"enabled": "false"}, auth=self.auth)).status, 400)
        self.assertEqual((await self.client.post("/privacy", json={"enabled": True}, auth=self.auth)).status, 200)
        self.control.call.assert_called_with("setPrivacyMode", True)
        self.control.call.side_effect = RuntimeError("secret-password")
        response = await self.client.get("/info", auth=self.auth)
        self.assertEqual(response.status, 502)
        self.assertNotIn("secret-password", await response.text())

    async def test_recording_failure_and_validation(self):
        self.assertEqual((await self.client.post("/recordings", json={"seconds": 0}, auth=self.auth)).status, 400)
        response = await self.client.post("/recordings", json={"seconds": 1}, auth=self.auth)
        self.assertEqual(response.status, 202)
        self.assertEqual((await self.client.post("/recordings", json={"seconds": 1}, auth=self.auth)).status, 409)
        await asyncio.wait_for(self.recorder.task, 10)
        self.assertIsNotNone(self.recorder.error)
        self.assertEqual(list(Path(self.temp.name).iterdir()), [])
        self.assertEqual((await self.client.get("/recordings/not-a-recording.mp4", auth=self.auth)).status, 404)


if __name__ == "__main__":
    unittest.main()

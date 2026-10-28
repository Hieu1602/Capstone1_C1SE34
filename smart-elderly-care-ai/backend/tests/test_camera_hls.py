import io
import time
import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
from fastapi import FastAPI

from app.api.v1.endpoints.mobile import camera_hls as hls


class HlsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.device = SimpleNamespace(id=uuid4())
        self.user = SimpleNamespace(id=uuid4())
        self.start = datetime.now(timezone.utc) - timedelta(minutes=5)
        self.rows = [SimpleNamespace(id=uuid4(), device_id=self.device.id, kind="segment",
                                    started_at=self.start + timedelta(seconds=i * 2), duration=2,
                                    object_key=f"test/{i}.ts", size_bytes=188) for i in range(3)]
        self.db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(scalars=lambda: self.rows)),
                                  get=AsyncMock(return_value=self.rows[0]))
        app = FastAPI()
        app.include_router(hls.router, prefix="/camera/archive/hls")
        app.dependency_overrides[hls.get_db] = lambda: self.db
        app.dependency_overrides[hls.viewer] = lambda: (self.user, (self.device, {}))
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.user_patch = patch.object(hls.crud_user, "get", AsyncMock(return_value=self.user))
        self.access_patch = patch.object(hls, "access", AsyncMock(return_value=(self.device, {})))
        self.user_patch.start()
        self.access_patch.start()

    async def asyncTearDown(self):
        await self.client.aclose()
        self.user_patch.stop()
        self.access_patch.stop()

    async def session(self):
        response = await self.client.get("/camera/archive/hls", params={
            "start": self.start.isoformat(), "end": (self.start + timedelta(minutes=30)).isoformat()})
        self.assertEqual(response.status_code, 200)
        return response.json()

    async def test_manifest_contains_all_segments_and_discontinuities(self):
        session = await self.session()
        response = await self.client.get(session["path"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text.count("#EXTINF:2.000000"), 3)
        self.assertEqual(response.text.count("#EXT-X-DISCONTINUITY"), 2)
        self.assertIn("#EXT-X-ENDLIST", response.text)
        self.assertIn("no-store", response.headers["cache-control"])
        self.assertEqual(len(session["items"]), 3)
        self.assertGreater(session["expires_at"], time.time() + 3500)

    async def test_session_ends_at_latest_segment_to_allow_live_archive_growth(self):
        session = await self.session()
        ticket = session["path"].split("ticket=", 1)[1]
        claims = hls.jwt.decode(ticket, hls.settings.SECRET_KEY, algorithms=[hls.settings.ALGORITHM])
        expected_end = self.rows[-1].started_at + timedelta(seconds=self.rows[-1].duration)
        self.assertEqual(datetime.fromisoformat(claims["end"]), expected_end)

    async def test_media_rechecks_permissions_and_rejects_foreign_or_outside_window(self):
        session = await self.session()
        query = session["path"].split("?", 1)[1]
        with patch.object(hls, "transport_stream", return_value=b"x" * 188) as read:
            response = await self.client.get(f"/camera/archive/hls/{self.rows[0].id}.ts?{query}")
            self.assertEqual(response.status_code, 200)
            read.assert_called_once()
            hls.access.assert_awaited()
            read.reset_mock()
            for field, value in (("device_id", uuid4()), ("started_at", self.start - timedelta(seconds=1)), ("kind", "incident")):
                original = getattr(self.rows[0], field)
                setattr(self.rows[0], field, value)
                response = await self.client.get(f"/camera/archive/hls/{self.rows[0].id}.ts?{query}")
                self.assertEqual(response.status_code, 404)
                setattr(self.rows[0], field, original)
            read.assert_not_called()

    async def test_invalid_expired_ticket_and_revoked_user_cannot_read(self):
        session = await self.session()
        ticket = session["path"].split("ticket=", 1)[1]
        claims = hls.jwt.decode(ticket, hls.settings.SECRET_KEY, algorithms=[hls.settings.ALGORITHM])
        claims["exp"] = int(time.time()) - 10
        expired = hls.jwt.encode(claims, hls.settings.SECRET_KEY, algorithm=hls.settings.ALGORITHM)
        for token in ("invalid", expired):
            response = await self.client.get("/camera/archive/hls/manifest.m3u8", params={"ticket": token})
            self.assertEqual(response.status_code, 401)
        hls.crud_user.get.return_value = None
        self.assertEqual((await self.client.get(session["path"])).status_code, 401)

    async def test_changed_archive_is_not_silently_mapped_to_wrong_timestamps(self):
        session = await self.session()
        self.rows.pop()
        self.assertEqual((await self.client.get(session["path"])).status_code, 409)

    async def test_missing_s3_segment_returns_not_found(self):
        session = await self.session()
        ticket = session["path"].split("?", 1)[1]
        missing = hls.ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "missing"},
             "ResponseMetadata": {"HTTPStatusCode": 404}},
            "GetObject",
        )
        with patch.object(hls, "transport_stream", side_effect=missing):
            response = await self.client.get(f"/camera/archive/hls/{self.rows[0].id}.ts?{ticket}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Recording no longer exists in storage")

    async def test_time_window_and_device_query_are_bounded(self):
        response = await self.client.get("/camera/archive/hls", params={
            "start": self.start.isoformat(), "end": (self.start + timedelta(hours=2)).isoformat()})
        self.assertEqual(response.status_code, 400)
        self.db.execute.assert_not_called()
        await self.session()
        query = self.db.execute.call_args.args[0].compile()
        self.assertIn(self.device.id, query.params.values())


class MediaTests(unittest.TestCase):
    def test_ts_timestamps_are_normalized_and_body_is_closed(self):
        body = io.BytesIO(b"x" * 188)
        client = MagicMock()
        client.get_object.return_value = {"Body": body, "ContentLength": 188}
        with patch.object(hls.video_storage, "client", return_value=client), patch.object(hls.subprocess, "run", return_value=SimpleNamespace(stdout=b"normalized")) as remux:
            self.assertEqual(hls.transport_stream("camera/clip.ts", 188, 4), b"normalized")
            command = remux.call_args.args[0]
            self.assertEqual(command[command.index("-output_ts_offset") + 1], "4")
        self.assertTrue(body.closed)

    def test_bad_size_is_rejected_and_body_is_closed(self):
        body = io.BytesIO(b"x")
        client = MagicMock()
        client.get_object.return_value = {"Body": body, "ContentLength": 1}
        with patch.object(hls.video_storage, "client", return_value=client):
            with self.assertRaises(ValueError):
                hls.transport_stream("camera/clip.ts", 188)
        self.assertTrue(body.closed)

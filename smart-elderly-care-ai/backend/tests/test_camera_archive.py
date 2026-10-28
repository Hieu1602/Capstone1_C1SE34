import json
import os
import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
from fastapi import FastAPI

from app.api.v1.endpoints.mobile import camera_archive as archive
from app.crud.crud_incident import CRUDIncident
from app.models.camera_recording import CameraRecording


class ArchiveTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.device = SimpleNamespace(id=uuid4(), device_type="CAMERA", house_id=uuid4())
        self.db = SimpleNamespace(get=AsyncMock(return_value=self.device), execute=AsyncMock(), commit=AsyncMock())
        app = FastAPI()
        app.include_router(archive.router, prefix="/archive")
        app.dependency_overrides[archive.viewer] = lambda: (None, (self.device, {}))
        app.dependency_overrides[archive.get_db] = lambda: self.db
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.body = {"id": str(uuid4()), "device_id": str(self.device.id), "kind": "segment",
                     "started_at": datetime.now(timezone.utc).isoformat(), "duration": 2,
                     "size_bytes": 123, "incident_id": None}
        self.body["object_key"] = f"cameras/{self.device.id}/{self.body['id']}.mp4"
        self.token = "x" * 32
        self.env = patch.dict(os.environ, {"VIDEO_INGEST_TOKENS": json.dumps({str(self.device.id): self.token})})
        self.env.start()
        self.headers = {"Authorization": f"Bearer {self.token}"}

    async def asyncTearDown(self):
        self.env.stop()
        await self.http.aclose()

    async def test_ingest_requires_camera_scoped_credential(self):
        response = await self.http.post("/archive", json=self.body)
        self.assertEqual(response.status_code, 401)
        self.db.get.assert_not_called()
        with patch.dict(os.environ, {"VIDEO_INGEST_TOKENS": json.dumps({str(uuid4()): self.token})}):
            self.assertEqual((await self.http.post("/archive", json=self.body, headers=self.headers)).status_code, 401)

    async def test_ingest_rejects_foreign_keys_and_invalid_duration(self):
        for changes in ({"object_key": "other-camera/private.mp4"}, {"duration": 3}, {"duration": 0}, {"started_at": "2026-10-27T10:00:00"}):
            response = await self.http.post("/archive", json={**self.body, **changes}, headers=self.headers)
            self.assertEqual(response.status_code, 422)

    async def test_ingest_verifies_object_and_acknowledges_commit(self):
        self.db.get.side_effect = [self.device, None]
        self.db.execute.return_value = SimpleNamespace(scalar_one_or_none=lambda: self.body["id"])
        client = MagicMock()
        client.head_object.return_value = {"ContentLength": 123, "ContentType": "video/mp4"}
        with patch.object(archive.video_storage, "client", return_value=client):
            response = await self.http.post("/archive", json=self.body, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.db.commit.assert_awaited_once()

    async def test_duplicate_metadata_is_idempotent_but_cannot_be_changed(self):
        recording = SimpleNamespace(**archive.RecordingMetadata(**self.body).model_dump())
        self.db.get.side_effect = [self.device, recording, self.device, recording]
        with patch.object(archive.video_storage, "client") as client:
            self.assertEqual((await self.http.post("/archive", json=self.body, headers=self.headers)).status_code, 200)
            self.assertEqual((await self.http.post("/archive", json={**self.body, "size_bytes": 100}, headers=self.headers)).status_code, 409)
            client.assert_not_called()
        self.db.commit.assert_not_awaited()

    async def test_playback_rejects_other_camera_before_signing(self):
        self.db.get.return_value = SimpleNamespace(device_id=uuid4())
        with patch.object(archive.video_storage, "client") as client:
            response = await self.http.get(f"/archive/{uuid4()}/playback")
            self.assertEqual(response.status_code, 404)
            client.assert_not_called()

    async def test_playback_uses_saved_key_and_short_lived_url(self):
        self.db.get.return_value = SimpleNamespace(device_id=self.device.id, object_key=self.body["object_key"])
        client = MagicMock()
        client.generate_presigned_url.return_value = "https://s3.example/private"
        with patch.object(archive.video_storage, "client", return_value=client):
            response = await self.http.get(f"/archive/{self.body['id']}/playback")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(client.generate_presigned_url.call_args.kwargs["ExpiresIn"], 300)

    async def test_timeline_keyset_and_camera_scope(self):
        row = CameraRecording(**archive.RecordingMetadata(**self.body).model_dump())
        self.db.execute.return_value = SimpleNamespace(scalars=lambda: [row, row])
        start = datetime.now(timezone.utc) - timedelta(hours=1)
        params = {"start": start.isoformat(), "end": (start + timedelta(hours=1)).isoformat(), "limit": 1}
        response = await self.http.get("/archive", params=params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["next"]["after_id"], self.body["id"])
        query = self.db.execute.call_args.args[0].compile()
        self.assertIn(self.device.id, query.params.values())
        self.assertEqual((await self.http.get("/archive", params={**params, "after_id": str(uuid4())})).status_code, 400)

    async def test_coverage_merges_nearby_segments_and_keeps_gaps(self):
        start = datetime.now(timezone.utc).replace(microsecond=0)
        rows = [(start, 2), (start + timedelta(seconds=4), 2), (start + timedelta(seconds=20), 2)]
        self.db.execute.return_value = SimpleNamespace(all=lambda: rows)
        response = await self.http.get("/archive/coverage", params={
            "start": start.isoformat(), "end": (start + timedelta(hours=1)).isoformat(),
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["items"]), 2)
        self.assertEqual(datetime.fromisoformat(response.json()["items"][0]["end"]), start + timedelta(seconds=6))

    async def test_edge_incident_strips_transport_fields_and_preserves_identity(self):
        crud = CRUDIncident()
        crud.get = AsyncMock(return_value=None)
        crud.create = AsyncMock()
        event_id = str(uuid4())
        await crud.create_from_edge(self.db, {"id": event_id, "device_id": self.device.id,
            "alert_type": "FALL_DETECTED", "alert_level": "HIGH", "message": "Fall",
            "sources": ["camera"], "timestamp": 123, "clip_path": "/tmp/clip.mp4", "snapshots": []})
        payload = crud.create.call_args.args[1]
        self.assertEqual(str(payload["id"]), event_id)
        self.assertEqual(json.loads(payload["sources"]), ["camera"])
        self.assertNotIn("clip_path", payload)

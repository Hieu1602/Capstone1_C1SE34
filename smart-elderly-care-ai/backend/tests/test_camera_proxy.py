"""Camera authorization/proxy tests without a real camera or database."""
import time
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from jose import jwt

from app.api.v1.endpoints.mobile import camera
from app.core.config import settings


class CameraProxyTests(unittest.IsolatedAsyncioTestCase):
    async def test_quality_is_scoped_in_media_ticket(self):
        response = await self.http.post('/camera/ticket', json={'resource': 'live.mjpg', 'quality': '720p'})
        self.assertEqual(response.status_code, 200)
        path = response.json()['path']
        self.assertIn('&quality=720p', path)
        self.assertEqual((await self.http.get(path.replace('quality=720p', 'quality=1080p'))).status_code, 401)
        self.assertEqual((await self.http.post('/camera/ticket', json={'resource': 'live.mjpg', 'quality': '4k'})).status_code, 422)

    async def test_video_mode_requires_manage_and_valid_mode(self):
        self.assertEqual((await self.http.post('/camera/video-mode', json={'mode': 'night'})).status_code, 403)
        self.permissions['can_manage_devices'] = True
        with patch.object(camera, 'forward', new=AsyncMock(return_value={'mode': 'night'})) as forward:
            response = await self.http.post('/camera/video-mode', json={'mode': 'night'})
            self.assertEqual(response.json(), {'mode': 'night'})
            forward.assert_awaited_once_with('/video-mode', {'mode': 'night'})
            self.assertEqual((await self.http.post('/camera/video-mode', json={'mode': 'invalid'})).status_code, 422)

    async def test_extra_source_uses_its_own_upstream(self):
        source_id = str(self.device.id)
        config = {source_id: {'url': 'http://second-camera:8090', 'username': 'viewer', 'password': 'private'}}
        with patch.dict('os.environ', {'CAMERA_EXTRA_SOURCES': json.dumps(config)}):
            with patch.object(camera, 'forward', new=AsyncMock(return_value={'mode': 'day'})) as forward:
                response = await self.http.get('/camera/video-mode', params={'camera_id': source_id})
                self.assertEqual(response.json(), {'mode': 'day'})
                forward.assert_awaited_once_with('/video-mode', None, camera_id=source_id)
            upstream = camera.client(source_id)
            self.assertEqual(str(upstream.base_url), 'http://second-camera:8090')
            await upstream.aclose()
            with self.assertRaises(HTTPException):
                camera.intercom_client(source_id)

    async def test_sources_hide_cameras_without_house_permission(self):
        self.app.dependency_overrides[camera.authenticated] = lambda: self.user
        allowed, denied = str(uuid4()), str(uuid4())
        config = {denied: {'url': 'http://second-camera:8090', 'username': 'viewer', 'password': 'private'}}
        async def access(user, db, camera_id=None):
            if camera_id == denied:
                raise HTTPException(403, 'denied')
            return self.device, self.permissions
        with patch.dict('os.environ', {'CAMERA_DEVICE_ID': allowed, 'CAMERA_EXTRA_SOURCES': json.dumps(config)}), patch.object(camera, 'access', side_effect=access):
            result = await self.http.get('/camera/sources')
            self.assertEqual(result.json(), [{'id': str(self.device.id), 'name': self.device.name}])
            self.assertNotIn('private', result.text)

    async def test_extra_media_ticket_uses_selected_house_and_upstream(self):
        source_id = str(self.device.id)
        config = {source_id: {'url': 'http://second-camera:8090', 'username': 'viewer', 'password': 'private'}}
        def upstream(request):
            self.assertEqual(request.url.host, 'second-camera')
            self.assertEqual(request.url.params['quality'], '720p')
            return httpx.Response(200, content=b'frame', headers={'content-type': 'image/jpeg'})
        def client(camera_id):
            self.assertEqual(camera_id, source_id)
            return httpx.AsyncClient(transport=httpx.MockTransport(upstream), base_url='http://second-camera:8090')
        with patch.dict('os.environ', {'CAMERA_EXTRA_SOURCES': json.dumps(config)}):
            ticket = await self.http.post('/camera/ticket', json={'resource': 'live.mjpg', 'quality': '720p'})
            with patch.object(camera.crud_user, 'get', new=AsyncMock(return_value=self.user)), patch.object(camera, 'access', new=AsyncMock(return_value=(self.device, self.permissions))) as access, patch.object(camera, 'client', side_effect=client):
                response = await self.http.get(ticket.json()['path'])
                self.assertEqual(response.content, b'frame')
                access.assert_awaited_once_with(self.user, None, camera_id=source_id)

    async def test_unknown_source_cannot_fall_back_to_default(self):
        db = SimpleNamespace(get=AsyncMock())
        with patch.dict('os.environ', {'CAMERA_EXTRA_SOURCES': '{}', 'CAMERA_DEVICE_ID': str(uuid4())}):
            with self.assertRaises(HTTPException) as caught:
                await camera.access(self.user, db, camera_id=str(uuid4()))
            self.assertEqual(caught.exception.status_code, 404)
            db.get.assert_not_awaited()

    async def asyncSetUp(self):
        self.app = FastAPI()
        self.app.include_router(camera.router, prefix="/camera")
        self.user = SimpleNamespace(id=uuid4(), is_active=True)
        self.device = SimpleNamespace(id=uuid4(), device_id="TAPO_SERIAL", house_id=uuid4(), name="C200C", device_type="CAMERA", is_online=True)
        self.permissions = {"can_view_camera": True, "can_manage_devices": False}
        self.app.dependency_overrides[camera.viewer] = lambda: (self.user, (self.device, self.permissions))
        self.app.dependency_overrides[camera.get_db] = lambda: None
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.http.aclose()

    async def test_viewer_cannot_control(self):
        for path, body in (("ptz", {"x": 10}), ("privacy", {"enabled": True}), ("recordings", {"seconds": 30})):
            response = await self.http.post('/camera/' + path, json=body)
            self.assertEqual(response.status_code, 403)

    async def test_metadata_contains_both_device_identifiers(self):
        with patch.object(camera, 'forward', new=AsyncMock(return_value={'connected': True})):
            response = await self.http.get('/camera')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['device_id'], 'TAPO_SERIAL')
            self.assertEqual(response.json()['id'], str(self.device.id))

    async def test_control_and_validation(self):
        self.permissions['can_manage_devices'] = True
        with patch.object(camera, 'forward', new=AsyncMock(return_value={"result": {"ok": True}})) as forward:
            response = await self.http.post('/camera/ptz', json={"x": 10, "y": -10})
            self.assertEqual(response.status_code, 200)
            forward.assert_awaited_once_with('/ptz', {"x": 10, "y": -10})
            for value in (31, True, "10"):
                self.assertEqual((await self.http.post('/camera/ptz', json={"x": value})).status_code, 422)

    async def test_ticket_scope_and_expiry(self):
        response = await self.http.post('/camera/ticket', json={"resource": "snapshot.jpg"})
        path = response.json()['path']
        token = path.split('ticket=')[1]
        self.assertEqual((await self.http.get('/camera/media/live.mjpg', params={'ticket': token})).status_code, 401)
        expired = jwt.encode({'sub': str(self.user.id), 'resource': 'snapshot.jpg', 'type': 'camera_media', 'exp': int(time.time())-10}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        self.assertEqual((await self.http.get('/camera/media/snapshot.jpg', params={'ticket': expired})).status_code, 401)
        self.assertEqual((await self.http.post('/camera/ticket', json={'resource': 'http://internal/secret'})).status_code, 400)

    async def test_cross_house_denied(self):
        db = SimpleNamespace(get=AsyncMock(side_effect=[self.device, SimpleNamespace(id=self.device.house_id)]))
        with patch.dict('os.environ', {'CAMERA_DEVICE_ID': str(self.device.id)}), patch.object(camera.crud_house, 'get_user_permissions', new=AsyncMock(return_value={'can_view_camera': False})):
            with self.assertRaises(HTTPException) as caught:
                await camera.access(self.user, db)
            self.assertEqual(caught.exception.status_code, 403)

    async def test_media_rechecks_permissions(self):
        response = await self.http.post('/camera/ticket', json={'resource': 'snapshot.jpg'})
        with patch.object(camera.crud_user, 'get', new=AsyncMock(return_value=self.user)), patch.object(camera, 'access', new=AsyncMock(side_effect=HTTPException(403, 'revoked'))):
            self.assertEqual((await self.http.get(response.json()['path'])).status_code, 403)

    async def test_snapshot_proxy(self):
        response = await self.http.post('/camera/ticket', json={'resource': 'snapshot.jpg'})
        def upstream(request):
            self.assertEqual(request.url.path, '/snapshot.jpg')
            return httpx.Response(200, content=b'jpeg-test', headers={'content-type': 'image/jpeg'})
        with patch.object(camera.crud_user, 'get', new=AsyncMock(return_value=self.user)), patch.object(camera, 'access', new=AsyncMock(return_value=(self.device, self.permissions))), patch.object(camera, 'client', side_effect=lambda: httpx.AsyncClient(transport=httpx.MockTransport(upstream), base_url='http://camera')):
            result = await self.http.get(response.json()['path'])
            self.assertEqual(result.content, b'jpeg-test')
            self.assertEqual(result.headers['cache-control'], 'no-store')

    async def test_pairing_code_and_existing_owner(self):
        self.app.dependency_overrides[camera.authenticated] = lambda: self.user
        db = SimpleNamespace(get=AsyncMock(return_value=self.device))
        self.app.dependency_overrides[camera.get_db] = lambda: db
        with patch.dict('os.environ', {'CAMERA_PAIRING_CODE': 'a' * 32, 'CAMERA_DEVICE_ID': str(self.device.id)}):
            self.assertEqual((await self.http.post('/camera/pair', json={'code': 'b' * 32})).status_code, 403)
            self.assertEqual((await self.http.post('/camera/pair', json={'code': 'a' * 32})).status_code, 409)

    async def test_pairing_creates_device_in_owner_house(self):
        self.app.dependency_overrides[camera.authenticated] = lambda: self.user
        from unittest.mock import Mock
        db = SimpleNamespace(get=AsyncMock(return_value=None), add=Mock(), commit=AsyncMock())
        self.app.dependency_overrides[camera.get_db] = lambda: db
        house = SimpleNamespace(id=uuid4(), owner_id=self.user.id)
        with patch.dict('os.environ', {'CAMERA_PAIRING_CODE': 'a' * 32, 'CAMERA_DEVICE_ID': str(self.device.id)}), patch.object(camera.crud_house, 'get_or_create_default_house', new=AsyncMock(return_value=house)):
            response = await self.http.post('/camera/pair', json={'code': 'a' * 32})
            self.assertEqual(response.status_code, 201)
            self.assertEqual(db.add.call_args.args[0].owner_id, self.user.id)
            self.assertEqual(db.add.call_args.args[0].house_id, house.id)

    async def test_demo_token_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            await camera.authenticated('fake-jwt-token-demo', self.user)
        self.assertEqual(caught.exception.status_code, 401)

    def audio_offer(self, mode="talk", direction="sendonly"):
        return {"camera_id": str(self.device.id), "mode": mode,
                "sdp": f"v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 8\r\na={direction}\r\n"}

    async def test_intercom_viewer_can_listen_but_cannot_talk(self):
        self.assertEqual((await self.http.post('/camera/intercom/offer', json=self.audio_offer())).status_code, 403)
        offer = self.audio_offer("listen", "recvonly")
        def upstream(request):
            self.assertEqual(request.url.path, '/api/webrtc')
            self.assertEqual(request.url.params['src'], 'tapo_intercom')
            return httpx.Response(200, json={"type": "answer", "sdp": "v=0\r\nm=audio 9 RTP/SAVPF 8\r\na=sendonly\r\n", "secret": "not-returned"})
        with patch.object(camera, 'forward', new=AsyncMock(return_value={"result": {"enabled": "off"}})), patch.object(camera, 'intercom_client', side_effect=lambda: httpx.AsyncClient(transport=httpx.MockTransport(upstream), base_url='http://audio')):
            response = await self.http.post('/camera/intercom/offer', json=offer)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.json()), {"type", "sdp"})

    async def test_intercom_owner_can_talk(self):
        self.permissions['can_manage_devices'] = True
        with patch.object(camera, 'forward', new=AsyncMock(return_value={"result": {"enabled": "off"}})), patch.object(camera, 'intercom_client', side_effect=lambda: httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"type": "answer", "sdp": "v=0\r\nm=audio 9 RTP/SAVPF 8\r\na=recvonly\r\n"})), base_url='http://audio')):
            self.assertEqual((await self.http.post('/camera/intercom/offer', json=self.audio_offer())).status_code, 200)

    async def test_intercom_privacy_and_wrong_camera(self):
        self.permissions['can_manage_devices'] = True
        offer = self.audio_offer()
        with patch.object(camera, 'forward', new=AsyncMock(return_value={"result": {"enabled": "on"}})), patch.object(camera, 'intercom_client') as upstream:
            self.assertEqual((await self.http.post('/camera/intercom/offer', json=offer)).status_code, 409)
            offer['camera_id'] = str(uuid4())
            self.assertEqual((await self.http.post('/camera/intercom/offer', json=offer)).status_code, 404)
            upstream.assert_not_called()

    async def test_intercom_rejects_video_and_microphone_in_listen_mode(self):
        for direction in ('sendonly', 'sendrecv'):
            offer = self.audio_offer('listen', direction)
            self.assertEqual((await self.http.post('/camera/intercom/offer', json=offer)).status_code, 403)
        offer = self.audio_offer('listen', 'recvonly')
        offer['sdp'] += 'a=sendrecv\r\n'
        self.assertEqual((await self.http.post('/camera/intercom/offer', json=offer)).status_code, 403)
        offer['sdp'] = offer['sdp'].replace('m=audio', 'm=video')
        self.assertEqual((await self.http.post('/camera/intercom/offer', json=offer)).status_code, 400)

    async def test_intercom_upstream_errors_do_not_expose_credentials(self):
        offer = self.audio_offer('listen', 'recvonly')
        with patch.object(camera, 'forward', new=AsyncMock(return_value={"result": {"enabled": "off"}})), patch.object(camera, 'intercom_client', side_effect=lambda: httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(500, text='tapo://secret@camera')), base_url='http://audio')):
            response = await self.http.post('/camera/intercom/offer', json=offer)
            self.assertEqual(response.status_code, 502)
            self.assertNotIn('secret', response.text)


if __name__ == '__main__':
    unittest.main()

"""Unit tests cho logic nhắc nhở giọng nói tiếng Việt qua loa camera."""

from datetime import datetime, timedelta, timezone
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
from fastapi import FastAPI

from app.api.v1.endpoints.mobile import camera
from app.services import camera_speaker
from app.services.scheduler.voice_reminder_scheduler import (
    VoiceReminderSchedulerService,
    _is_quiet_hours,
    _minutes_since,
)


class SmartPhrasingTests(unittest.TestCase):
    def test_split_tts_chunks_respects_max_len(self):
        long_text = "Chào buổi sáng cụ Nguyễn Văn A. " * 10
        chunks = camera_speaker._split_tts_chunks(long_text, max_len=120)
        self.assertTrue(len(chunks) >= 2)
        self.assertTrue(all(len(c) <= 120 for c in chunks))

    def test_build_medication_reminder_groups_meds_naturally(self):
        text = camera_speaker.build_medication_reminder_text(
            medications=[
                {"name": "Amlodipine 5mg", "dose": "1 viên", "instructions": "Sau khi ăn"},
                {"name": "Metformin 500mg", "dose": "1 viên", "instructions": ""},
            ],
            time_hhmm="08:00",
            patient_name="Nguyễn Văn An",
            gender="MALE",
            is_repeat=False,
            hour=8,
        )
        self.assertIn("Chào buổi sáng cụ ông Nguyễn Văn An", text)
        self.assertIn("8 giờ", text)
        self.assertIn("Amlodipine 5mg, liều 1 viên, sau khi ăn", text)
        self.assertIn("Metformin 500mg, liều 1 viên", text)

    def test_build_medication_repeat_message(self):
        text = camera_speaker.build_medication_reminder_text(
            medications=[{"name": "Panadol", "dose": "1 viên", "instructions": ""}],
            time_hhmm="12:30",
            patient_name="Trần Thị Bình",
            gender="FEMALE",
            is_repeat=True,
        )
        self.assertIn("Nhắc lại nhẹ cho cụ bà Trần Thị Bình", text)
        self.assertIn("12 giờ 30 phút", text)

    def test_build_hydration_and_appointment_messages(self):
        hyd = camera_speaker.build_hydration_reminder_text(
            "10:30", amount="250ml", note="nước ấm", patient_name="Lan", gender="FEMALE"
        )
        self.assertIn("10 giờ 30 phút", hyd)
        self.assertIn("cụ bà Lan", hyd)
        self.assertIn("250ml", hyd)

        apt = camera_speaker.build_appointment_reminder_text(
            patient_name="Minh",
            doctor_name="Bác sĩ Hùng",
            scheduled_str="09:00 ngày 26/11/2026",
            location="Phòng khám 1",
            reminder_type="BEFORE_2H",
            gender="MALE",
        )
        self.assertIn("2 giờ nữa", apt)
        self.assertIn("cụ ông Minh", apt)
        self.assertIn("Bác sĩ Hùng", apt)

    def test_quiet_hours_and_minutes_since(self):
        vn_tz = timezone(timedelta(hours=7))
        self.assertTrue(_is_quiet_hours(datetime(2026, 11, 25, 22, 30, tzinfo=vn_tz)))
        self.assertTrue(_is_quiet_hours(datetime(2026, 11, 25, 5, 59, tzinfo=vn_tz)))
        self.assertFalse(_is_quiet_hours(datetime(2026, 11, 25, 6, 0, tzinfo=vn_tz)))
        self.assertEqual(_minutes_since(datetime(2026, 11, 25, 8, 16, tzinfo=vn_tz), "08:00"), 16)


class CameraSpeakerPlaybackTests(unittest.IsolatedAsyncioTestCase):
    async def test_speak_to_camera_skips_when_two_way_audio_disabled(self):
        dev = SimpleNamespace(
            id=uuid4(),
            config=SimpleNamespace(has_two_way_audio=False, is_sleep=False, stream_url=None, extra_settings=None),
        )
        res = await camera_speaker.speak_to_camera(dev, "Xin chào")
        self.assertTrue(res["skipped"])

    async def test_speak_to_camera_skips_when_privacy_sleep(self):
        dev = SimpleNamespace(
            id=uuid4(),
            config=SimpleNamespace(has_two_way_audio=True, is_sleep=True, stream_url=None, extra_settings=None),
        )
        res = await camera_speaker.speak_to_camera(dev, "Xin chào", force=False)
        self.assertTrue(res["skipped"])

    async def test_speak_to_camera_posts_audio_to_tapo_camera(self):
        dev = SimpleNamespace(
            id=uuid4(),
            config=SimpleNamespace(
                has_two_way_audio=True,
                is_sleep=False,
                stream_url="rtsp://admin:secret@192.168.1.4:554/stream1",
                extra_settings={"cloud_password": "cloud-pass"},
            ),
        )
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = SimpleNamespace(status_code=200, json=lambda: {"result": {"enabled": "off"}})
        mock_client.post.return_value = SimpleNamespace(
            status_code=200,
            raise_for_status=lambda: None,
            json=lambda: {"ok": True, "dst": f"tapo_{dev.id.hex}"},
        )

        with patch.object(camera_speaker, "synthesize_vietnamese_tts", new=AsyncMock(return_value=b"FAKE_MP3")), \
             patch("app.services.camera_speaker.httpx.AsyncClient", return_value=mock_client):
            res = await camera_speaker.speak_to_camera(dev, "Đã đến giờ uống thuốc")

        self.assertTrue(res["ok"])
        self.assertEqual(res["dst"], f"tapo_{dev.id.hex}")
        mock_client.post.assert_awaited_once()
        call_kwargs = mock_client.post.call_args.kwargs
        self.assertEqual(call_kwargs["json"]["dst"], f"tapo_{dev.id.hex}")
        self.assertTrue(call_kwargs["json"]["tapo_src"].startswith("tapo://admin:"))


class VoiceReminderSchedulerTests(unittest.IsolatedAsyncioTestCase):
    async def test_scheduler_skips_quiet_hours(self):
        svc = VoiceReminderSchedulerService()
        vn_tz = timezone(timedelta(hours=7))
        count = await svc.process_due_voice_reminders(now_vn=datetime(2026, 11, 25, 23, 0, tzinfo=vn_tz))
        self.assertEqual(count, 0)

    async def test_scheduler_speaks_grouped_meds_and_repeats_after_15m(self):
        svc = VoiceReminderSchedulerService()
        vn_tz = timezone(timedelta(hours=7))
        patient_id = uuid4()
        rx1 = SimpleNamespace(
            id=uuid4(),
            patient_id=patient_id,
            medication_name="Thuốc A",
            dosage="1 viên",
            instructions="Sau ăn",
            schedule_times=["08:00"],
        )
        rx2 = SimpleNamespace(
            id=uuid4(),
            patient_id=patient_id,
            medication_name="Thuốc B",
            dosage="2 viên",
            instructions="",
            schedule_times=["08:00"],
        )
        profile = SimpleNamespace(id=patient_id, full_name="Nguyễn Văn A", gender="MALE", house_id=uuid4())
        cam = SimpleNamespace(id=uuid4(), config=SimpleNamespace(has_two_way_audio=True, is_sleep=False))

        # In-memory fake Redis
        redis_store: dict[str, str] = {}
        fake_redis = SimpleNamespace(
            get=AsyncMock(side_effect=lambda k: redis_store.get(k)),
            set=AsyncMock(side_effect=lambda k, v, ex=None: redis_store.__setitem__(k, v)),
            keys=AsyncMock(return_value=[]),
        )

        # Fake DB session returning active prescriptions then profile
        fake_db = AsyncMock()
        fake_db.execute.side_effect = [
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [rx1, rx2])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [profile])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [rx1, rx2])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [profile])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [rx1, rx2])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [profile])),
        ]
        session_cm = AsyncMock()
        session_cm.__aenter__.return_value = fake_db

        spoken_texts: list[str] = []

        async def fake_speak(_dev, text, force=False):
            spoken_texts.append(text)
            return {"ok": True}

        with patch("app.services.scheduler.voice_reminder_scheduler.AsyncSessionFactory", return_value=session_cm), \
             patch.object(svc, "_get_redis_safe", new=AsyncMock(return_value=fake_redis)), \
             patch("app.services.scheduler.voice_reminder_scheduler.find_camera_for_patient", new=AsyncMock(return_value=cam)), \
             patch("app.services.scheduler.voice_reminder_scheduler.speak_to_camera", side_effect=fake_speak):
            # 08:01 -> phát lần đầu (gom 2 thuốc vào 1 câu)
            c1 = await svc.process_due_voice_reminders(now_vn=datetime(2026, 11, 25, 8, 1, tzinfo=vn_tz))
            self.assertEqual(c1, 1)
            self.assertEqual(len(spoken_texts), 1)
            self.assertIn("Thuốc A", spoken_texts[0])
            self.assertIn("Thuốc B", spoken_texts[0])

            # 08:02 -> không lặp lại trong cùng cửa sổ
            c2 = await svc.process_due_voice_reminders(now_vn=datetime(2026, 11, 25, 8, 2, tzinfo=vn_tz))
            self.assertEqual(c2, 0)

            # 08:16 -> nhắc lại nhẹ 1 lần vì chưa uống
            c3 = await svc.process_due_voice_reminders(now_vn=datetime(2026, 11, 25, 8, 16, tzinfo=vn_tz))
            self.assertEqual(c3, 1)
            self.assertIn("Nhắc lại nhẹ", spoken_texts[1])

    async def test_scheduler_skips_already_taken_dose(self):
        svc = VoiceReminderSchedulerService()
        vn_tz = timezone(timedelta(hours=7))
        patient_id = uuid4()
        rx = SimpleNamespace(
            id=uuid4(),
            patient_id=patient_id,
            medication_name="Thuốc A",
            dosage="1 viên",
            instructions="",
            schedule_times=["08:00"],
        )
        profile = SimpleNamespace(id=patient_id, full_name="Bà Lan", gender="FEMALE", house_id=uuid4())
        cam = SimpleNamespace(id=uuid4(), config=SimpleNamespace(has_two_way_audio=True, is_sleep=False))

        dose_id = f"rx-med-{rx.id}-0800"
        redis_store = {
            f"reminders:{patient_id}:2026-11-25": json.dumps({
                "medications": [{"id": dose_id, "taken": True}],
                "hydrations": [],
            })
        }
        fake_redis = SimpleNamespace(
            get=AsyncMock(side_effect=lambda k: redis_store.get(k)),
            set=AsyncMock(side_effect=lambda k, v, ex=None: redis_store.__setitem__(k, v)),
            keys=AsyncMock(return_value=[]),
        )
        fake_db = AsyncMock()
        fake_db.execute.side_effect = [
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [rx])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [profile])),
        ]
        session_cm = AsyncMock()
        session_cm.__aenter__.return_value = fake_db

        with patch("app.services.scheduler.voice_reminder_scheduler.AsyncSessionFactory", return_value=session_cm), \
             patch.object(svc, "_get_redis_safe", new=AsyncMock(return_value=fake_redis)), \
             patch("app.services.scheduler.voice_reminder_scheduler.find_camera_for_patient", new=AsyncMock(return_value=cam)), \
             patch("app.services.scheduler.voice_reminder_scheduler.speak_to_camera", new=AsyncMock(return_value={"ok": True})) as spk:
            count = await svc.process_due_voice_reminders(now_vn=datetime(2026, 11, 25, 8, 0, tzinfo=vn_tz))
            self.assertEqual(count, 0)
            spk.assert_not_awaited()

    async def test_scheduler_speaks_redis_only_manual_and_hydration(self):
        svc = VoiceReminderSchedulerService()
        vn_tz = timezone(timedelta(hours=7))
        patient_id = uuid4()
        cam = SimpleNamespace(id=uuid4(), config=SimpleNamespace(has_two_way_audio=True, is_sleep=False))
        redis_key = f"reminders:{patient_id}:2026-11-25"
        redis_store = {
            redis_key: json.dumps({
                "medications": [{"id": "rem-1", "name": "Vitamin C", "dose": "1 viên", "time": "09:00", "taken": False}],
                "hydrations": [{"id": "hyd-1", "time": "09:00", "amount": "200ml", "note": "nước ấm", "done": False}],
            })
        }
        fake_redis = SimpleNamespace(
            get=AsyncMock(side_effect=lambda k: redis_store.get(k)),
            set=AsyncMock(side_effect=lambda k, v, ex=None: redis_store.__setitem__(k, v)),
            keys=AsyncMock(return_value=[redis_key]),
        )
        fake_db = AsyncMock()
        fake_db.execute.side_effect = [
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        ]
        session_cm = AsyncMock()
        session_cm.__aenter__.return_value = fake_db

        with patch("app.services.scheduler.voice_reminder_scheduler.AsyncSessionFactory", return_value=session_cm), \
             patch.object(svc, "_get_redis_safe", new=AsyncMock(return_value=fake_redis)), \
             patch("app.services.scheduler.voice_reminder_scheduler.find_camera_for_patient", new=AsyncMock(return_value=cam)), \
             patch("app.services.scheduler.voice_reminder_scheduler.speak_to_camera", new=AsyncMock(return_value={"ok": True})) as spk:
            count = await svc.process_due_voice_reminders(now_vn=datetime(2026, 11, 25, 9, 0, tzinfo=vn_tz))
            self.assertEqual(count, 2)
            self.assertEqual(spk.await_count, 2)


class SpeakEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.app = FastAPI()
        self.app.include_router(camera.router, prefix="/camera")
        self.device = SimpleNamespace(id=uuid4(), device_id="cam-1", name="Phòng khách")
        self.permissions = {"can_view_camera": True, "can_manage_devices": False}
        self.user = SimpleNamespace(id=uuid4(), is_active=True)
        self.app.dependency_overrides[camera.viewer] = lambda: (self.user, (self.device, self.permissions))
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.http.aclose()

    async def test_speak_requires_manage_permission(self):
        res = await self.http.post("/camera/speaker/speak", json={"text": "Cụ ơi uống thuốc"})
        self.assertEqual(res.status_code, 403)

    async def test_speak_succeeds_with_manage_permission(self):
        self.permissions["can_manage_devices"] = True
        with patch("app.services.camera_speaker.speak_to_camera", new=AsyncMock(return_value={"ok": True, "dst": "tapo_intercom"})) as spk:
            res = await self.http.post("/camera/speaker/speak", json={"text": "Cụ ơi uống thuốc", "volume": 65})
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.json()["ok"])
            self.assertEqual(spk.call_args.kwargs["volume"], 65)

    async def test_speaker_volume_get_and_put(self):
        self.device.config = SimpleNamespace(extra_settings={"speaker_volume": 70})
        get_res = await self.http.get("/camera/speaker/volume")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["volume"], 70)

        put_denied = await self.http.put("/camera/speaker/volume", json={"volume": 50})
        self.assertEqual(put_denied.status_code, 403)

        self.permissions["can_manage_devices"] = True
        put_ok = await self.http.put("/camera/speaker/volume", json={"volume": 50})
        self.assertEqual(put_ok.status_code, 200)
        self.assertEqual(put_ok.json()["volume"], 50)
        self.assertEqual(self.device.config.extra_settings["speaker_volume"], 50)

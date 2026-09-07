"""
local_speaker.py
Phát âm thanh nhắc nhở tiếng Việt qua loa cục bộ.

Sử dụng gTTS (Google Text-to-Speech) để tổng hợp giọng nói
hoặc pygame / playsound để phát file audio.
"""

import asyncio
import logging
import os
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)


class LocalSpeaker:
    """
    Text-to-Speech speaker cho nhắc nhở và cảnh báo tiếng Việt.

    Usage:
        speaker = LocalSpeaker(config)
        await speaker.speak("Đã đến giờ uống thuốc.")
        await speaker.play_alert_sound()
    """

    ALERT_SOUND_PATH = "src/assets/alert.wav"  # Còi SOS khẩn cấp

    def __init__(self, config: dict):
        self.enabled: bool = config.get("enabled", True)
        self.language: str = config.get("language", "vi")
        self.volume: float = config.get("volume", 0.85)
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Text-to-Speech
    # ------------------------------------------------------------------

    async def speak(self, text: str) -> None:
        """
        Tổng hợp và phát giọng nói tiếng Việt.

        Args:
            text: Văn bản tiếng Việt cần phát
        """
        if not self.enabled:
            logger.debug("[Speaker] Disabled. Skip: %s", text[:50])
            return

        async with self._lock:
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._speak_blocking, text
                )
            except Exception as exc:  # noqa: BLE001
                logger.error("[Speaker] Lỗi phát âm thanh: %s", exc)

    def _speak_blocking(self, text: str) -> None:
        """Blocking TTS synthesis và playback."""
        try:
            from gtts import gTTS  # type: ignore
        except ImportError:
            logger.warning("[Speaker] gTTS chưa cài. Dùng fallback espeak.")
            self._espeak_fallback(text)
            return

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name

        try:
            tts = gTTS(text=text, lang=self.language, slow=False)
            tts.save(tmp_path)
            self._play_file(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    # ------------------------------------------------------------------
    # Alert Sound
    # ------------------------------------------------------------------

    async def play_alert_sound(self, repeat: int = 3) -> None:
        """
        Phát âm thanh còi SOS khẩn cấp.

        Args:
            repeat: Số lần lặp lại
        """
        if not self.enabled:
            return

        async with self._lock:
            for _ in range(repeat):
                await asyncio.get_event_loop().run_in_executor(
                    None, self._play_file, self.ALERT_SOUND_PATH
                )
                await asyncio.sleep(0.5)

    # ------------------------------------------------------------------
    # Audio Playback
    # ------------------------------------------------------------------

    def _play_file(self, path: str) -> None:
        """Phát file audio (MP3/WAV). Ưu tiên pygame, fallback playsound."""
        if not os.path.exists(path):
            logger.warning("[Speaker] File không tồn tại: %s", path)
            return

        # Thử pygame
        try:
            import pygame  # type: ignore
            pygame.mixer.init()
            sound = pygame.mixer.Sound(path)
            sound.set_volume(self.volume)
            sound.play()
            import time
            while pygame.mixer.get_busy():
                time.sleep(0.05)
            return
        except ImportError:
            pass
        except Exception as exc:  # noqa: BLE001
            logger.debug("[Speaker] pygame error: %s", exc)

        # Fallback: playsound
        try:
            from playsound import playsound  # type: ignore
            playsound(path)
            return
        except ImportError:
            pass
        except Exception as exc:  # noqa: BLE001
            logger.debug("[Speaker] playsound error: %s", exc)

        # Fallback: aplay (Linux)
        try:
            import subprocess
            subprocess.run(["aplay", path], check=False, capture_output=True)
        except Exception as exc:  # noqa: BLE001
            logger.error("[Speaker] Không thể phát âm thanh: %s", exc)

    def _espeak_fallback(self, text: str) -> None:
        """Fallback dùng espeak-ng nếu gTTS không khả dụng."""
        try:
            import subprocess
            subprocess.run(
                ["espeak-ng", "-v", "vi", "-a", str(int(self.volume * 200)), text],
                check=False,
                capture_output=True,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("[Speaker] espeak fallback failed: %s", exc)

    # ------------------------------------------------------------------
    # Scheduled Reminders
    # ------------------------------------------------------------------

    async def run_scheduled_reminders(self, schedule: list) -> None:
        """
        Chạy vòng lặp kiểm tra và phát nhắc nhở theo lịch.

        Args:
            schedule: List of {"time": "HH:MM", "message": "..."}
        """
        import datetime
        logger.info("[Speaker] Bắt đầu theo dõi lịch nhắc nhở.")
        notified_today: set = set()

        while True:
            now = datetime.datetime.now()
            current_hhmm = now.strftime("%H:%M")

            for item in schedule:
                sched_time = item.get("time", "")
                message    = item.get("message", "")
                key        = f"{sched_time}_{now.date()}"

                if current_hhmm == sched_time and key not in notified_today:
                    notified_today.add(key)
                    logger.info("[Speaker] Phát nhắc nhở: %s", message)
                    await self.speak(message)

            # Xóa cache ngày hôm qua
            yesterday_keys = {k for k in notified_today if str(now.date()) not in k}
            notified_today -= yesterday_keys

            await asyncio.sleep(30)  # Kiểm tra mỗi 30 giây

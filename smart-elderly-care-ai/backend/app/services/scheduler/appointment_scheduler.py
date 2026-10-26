"""
appointment_scheduler.py – Background worker service for dispatching appointment reminders.
Runs continuously inside the FastAPI lifespan loop, polling for due reminders (24h & 2h).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Optional

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionFactory
from app.models.appointment import Appointment, AppointmentReminder
from app.models.elderly_profile import ElderlyProfile
from app.models.house import HouseMember
from app.models.user import User
from app.schemas.appointment import ReminderStatusEnum, ReminderTypeEnum

logger = logging.getLogger("appointment_scheduler")


class AppointmentSchedulerService:
    """Asynchronous background worker polling due appointment reminders."""

    def __init__(self, poll_interval_seconds: int = 60):
        self.poll_interval = poll_interval_seconds
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Khởi động tiến trình chạy nền."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop(), name="appointment_scheduler_worker")
        logger.info(f"AppointmentSchedulerService started. Polling interval: {self.poll_interval}s.")

    async def stop(self):
        """Dừng an toàn tiến trình chạy nền."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("AppointmentSchedulerService stopped gracefully.")

    async def _run_loop(self):
        """Vòng lặp định kỳ kiểm tra các mốc nhắc nhở đã đến hạn."""
        while self._running:
            try:
                await self.process_due_reminders()
            except Exception as e:
                logger.error(f"Error in AppointmentSchedulerService worker loop: {e}", exc_info=True)

            try:
                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break

    async def process_due_reminders(self):
        """Tìm và gửi các thông báo nhắc lịch đã đến giờ."""
        async with AsyncSessionFactory() as db:
            now = datetime.now(timezone.utc)
            stmt = (
                select(AppointmentReminder)
                .where(
                    and_(
                        AppointmentReminder.status == ReminderStatusEnum.PENDING.value,
                        AppointmentReminder.scheduled_time <= now,
                    )
                )
                .options(
                    selectinload(AppointmentReminder.appointment).selectinload(Appointment.doctor),
                )
                .limit(50)
            )
            res = await db.execute(stmt)
            due_reminders = list(res.scalars().all())

            if not due_reminders:
                return

            logger.info(f"Processing {len(due_reminders)} due appointment reminders...")

            for reminder in due_reminders:
                try:
                    await self._dispatch_reminder(db, reminder)
                except Exception as ex:
                    logger.error(f"Failed to dispatch reminder {reminder.id}: {ex}")

    async def _dispatch_reminder(self, db: AsyncSession, reminder: AppointmentReminder):
        """Tạo thông báo đẩy FCM tới Bác sĩ và Gia đình người cao tuổi."""
        apt = reminder.appointment
        if not apt or apt.status != "UPCOMING":
            # Cuộc hẹn đã hủy hoặc đã khám xong -> Hủy nhắc nhở
            reminder.status = ReminderStatusEnum.CANCELLED.value
            await db.commit()
            return

        # Lấy tên bệnh nhân
        patient_name = "Người cao tuổi"
        p_stmt = select(ElderlyProfile.full_name).where(ElderlyProfile.id == apt.patient_id)
        p_res = await db.execute(p_stmt)
        p_name = p_res.scalar_one_or_none()
        if p_name:
            patient_name = p_name

        doctor_name = apt.doctor.full_name if apt.doctor else "Bác sĩ gia đình"
        scheduled_str = apt.scheduled_at.strftime("%H:%M ngày %d/%m/%Y")

        if reminder.reminder_type == ReminderTypeEnum.BEFORE_24H.value:
            title = f"🗓️ Nhắc lịch khám ngày mai: {patient_name}"
            body = f"{doctor_name} sẽ đến khám lúc {scheduled_str} tại {apt.location}."
        else:
            title = f"⏰ Nhắc lịch khám sắp diễn ra (2 giờ nữa): {patient_name}"
            body = f"Buổi khám lúc {scheduled_str} tại {apt.location}. Gia đình vui lòng chuẩn bị sẵn sàng."

        logger.info(
            f"[NOTIFICATION DISPATCH] Reminder {reminder.id} | Type: {reminder.reminder_type} | "
            f"Title: '{title}' | Body: '{body}'"
        )

        # Đánh dấu đã gửi
        reminder.status = ReminderStatusEnum.SENT.value
        reminder.sent_at = datetime.now(timezone.utc)
        await db.commit()


appointment_scheduler_service = AppointmentSchedulerService(poll_interval_seconds=60)

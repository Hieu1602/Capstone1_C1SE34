"""
crud_appointment.py – Asynchronous CRUD operations for Appointments and Reminders.
Implements conflict verification, recurrence series generation, and reminder management.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
import uuid

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment, AppointmentReminder
from app.models.elderly_profile import ElderlyProfile
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentStatusEnum,
    AppointmentUpdate,
    RecurrencePatternEnum,
    ReminderStatusEnum,
    ReminderTypeEnum,
)


class CRUDAppointment:
    """Async database operations for the Appointment lifecycle."""

    async def check_conflict(
        self,
        db: AsyncSession,
        start_time: datetime,
        duration_minutes: int,
        patient_id: uuid.UUID,
        doctor_id: Optional[uuid.UUID] = None,
        exclude_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Kiểm tra xem khoảng thời gian [start_time, end_time) có bị trùng với
        bất kỳ lịch khám UPCOMING nào khác của cùng Bác sĩ hoặc cùng Bệnh nhân hay không.
        Trả về True nếu bị trùng lịch (Conflict), ngược lại False.
        """
        end_time = start_time + timedelta(minutes=duration_minutes)

        # Điều kiện overlap khoảng thời gian: A_start < B_end AND A_end > B_start
        conflict_conditions = [
            Appointment.status == AppointmentStatusEnum.UPCOMING.value,
            Appointment.scheduled_at < end_time,
            (Appointment.scheduled_at + timedelta(minutes=30)) > start_time,
        ]

        if exclude_id:
            conflict_conditions.append(Appointment.id != exclude_id)

        target_party = [Appointment.patient_id == patient_id]
        if doctor_id:
            target_party.append(Appointment.doctor_id == doctor_id)

        conflict_conditions.append(or_(*target_party))

        stmt = select(Appointment.id).where(and_(*conflict_conditions)).limit(1)
        res = await db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def _create_reminders_for_appointment(
        self,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        scheduled_at: datetime,
    ) -> int:
        """Tạo các mốc nhắc nhở tự động trước 24h và trước 2h cho lịch khám."""
        now = datetime.now(timezone.utc)
        reminders_created = 0

        # Mốc 1: Trước 24h
        time_24h = scheduled_at - timedelta(hours=24)
        if time_24h > now:
            reminder_24h = AppointmentReminder(
                appointment_id=appointment_id,
                reminder_type=ReminderTypeEnum.BEFORE_24H.value,
                scheduled_time=time_24h,
                status=ReminderStatusEnum.PENDING.value,
            )
            db.add(reminder_24h)
            reminders_created += 1

        # Mốc 2: Trước 2h
        time_2h = scheduled_at - timedelta(hours=2)
        if time_2h > now:
            reminder_2h = AppointmentReminder(
                appointment_id=appointment_id,
                reminder_type=ReminderTypeEnum.BEFORE_2H.value,
                scheduled_time=time_2h,
                status=ReminderStatusEnum.PENDING.value,
            )
            db.add(reminder_2h)
            reminders_created += 1

        return reminders_created

    async def get_by_id(
        self, db: AsyncSession, appointment_id: uuid.UUID
    ) -> Optional[Appointment]:
        """Lấy chi tiết một lịch hẹn theo ID."""
        stmt = (
            select(Appointment)
            .where(Appointment.id == appointment_id)
            .options(
                selectinload(Appointment.doctor),
                selectinload(Appointment.reminders),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_appointments(
        self,
        db: AsyncSession,
        doctor_id: Optional[uuid.UUID] = None,
        patient_id: Optional[uuid.UUID] = None,
        house_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
    ) -> List[Appointment]:
        """Lấy danh sách các cuộc hẹn theo bộ lọc."""
        filters = []
        if doctor_id:
            filters.append(Appointment.doctor_id == doctor_id)
        if patient_id:
            filters.append(Appointment.patient_id == patient_id)
        if house_id:
            filters.append(Appointment.house_id == house_id)
        if status:
            filters.append(Appointment.status == status)

        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.doctor),
                selectinload(Appointment.reminders),
            )
            .order_by(Appointment.scheduled_at.asc())
        )
        if filters:
            stmt = stmt.where(and_(*filters))

        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def create_appointment_series(
        self,
        db: AsyncSession,
        obj_in: AppointmentCreate,
        doctor_id: Optional[uuid.UUID] = None,
        created_by: Optional[uuid.UUID] = None,
    ) -> Tuple[Appointment, int, int]:
        """
        Tạo lịch hẹn mới (hỗ trợ chu kỳ tái khám định kỳ tự động WEEKLY, MONTHLY, QUARTERLY).
        Kiểm tra thời gian tương lai và chống trùng lịch.
        """
        # Đảm bảo scheduled_at có timezone UTC
        scheduled_at = obj_in.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

        # 1. Chuyển đổi và tìm kiếm thông tin bệnh nhân
        patient_uuid = None
        house_id = None
        try:
            patient_uuid = uuid.UUID(obj_in.patient_id)
        except ValueError:
            pass

        # Tìm hồ sơ người cao tuổi
        if patient_uuid:
            p_stmt = select(ElderlyProfile).where(ElderlyProfile.id == patient_uuid)
            p_res = await db.execute(p_stmt)
            elderly = p_res.scalar_one_or_none()
            if elderly:
                house_id = elderly.house_id
        else:
            # Fallback lấy hồ sơ người cao tuổi đầu tiên
            f_stmt = select(ElderlyProfile).limit(1)
            f_res = await db.execute(f_stmt)
            elderly = f_res.scalar_one_or_none()
            if elderly:
                patient_uuid = elderly.id
                house_id = elderly.house_id
            else:
                patient_uuid = uuid.uuid4()

        # 2. Kiểm tra trùng lịch cho cuộc hẹn gốc
        is_conflict = await self.check_conflict(
            db=db,
            start_time=scheduled_at,
            duration_minutes=obj_in.duration_minutes,
            patient_id=patient_uuid,
            doctor_id=doctor_id,
        )
        if is_conflict:
            raise ValueError("Thời gian hẹn bị trùng với lịch khám khác của Bác sĩ hoặc Bệnh nhân.")

        # 3. Tạo cuộc hẹn chính (Root Appointment)
        root_apt = Appointment(
            doctor_id=doctor_id,
            patient_id=patient_uuid,
            house_id=house_id,
            created_by=created_by,
            visit_type=obj_in.visit_type,
            scheduled_at=scheduled_at,
            duration_minutes=obj_in.duration_minutes,
            location=obj_in.location,
            clinical_notes=obj_in.clinical_notes,
            status=AppointmentStatusEnum.UPCOMING.value,
            recurrence_pattern=obj_in.recurrence_pattern,
            enable_speaker_reminder=obj_in.enable_speaker_reminder,
        )
        db.add(root_apt)
        await db.flush()

        total_reminders = await self._create_reminders_for_appointment(
            db=db, appointment_id=root_apt.id, scheduled_at=scheduled_at
        )
        total_created = 1

        # 4. Sinh các lịch hẹn lặp định kỳ (nếu có)
        occurrences = obj_in.recurrence_occurrences or 1
        pattern = obj_in.recurrence_pattern.upper()
        if pattern != RecurrencePatternEnum.NONE.value and occurrences > 1:
            for i in range(1, min(occurrences, 12)):
                if pattern == RecurrencePatternEnum.WEEKLY.value:
                    next_time = scheduled_at + timedelta(weeks=i)
                elif pattern == RecurrencePatternEnum.MONTHLY.value:
                    next_time = scheduled_at + timedelta(days=30 * i)
                elif pattern == RecurrencePatternEnum.QUARTERLY.value:
                    next_time = scheduled_at + timedelta(days=90 * i)
                else:
                    break

                # Kiểm tra trùng lịch cho từng lần lặp
                c_conflict = await self.check_conflict(
                    db=db,
                    start_time=next_time,
                    duration_minutes=obj_in.duration_minutes,
                    patient_id=patient_uuid,
                    doctor_id=doctor_id,
                )
                if not c_conflict:
                    child_apt = Appointment(
                        doctor_id=doctor_id,
                        patient_id=patient_uuid,
                        house_id=house_id,
                        created_by=created_by,
                        visit_type=obj_in.visit_type,
                        scheduled_at=next_time,
                        duration_minutes=obj_in.duration_minutes,
                        location=obj_in.location,
                        clinical_notes=obj_in.clinical_notes,
                        status=AppointmentStatusEnum.UPCOMING.value,
                        recurrence_pattern=pattern,
                        parent_recurring_id=root_apt.id,
                        enable_speaker_reminder=obj_in.enable_speaker_reminder,
                    )
                    db.add(child_apt)
                    await db.flush()
                    r_count = await self._create_reminders_for_appointment(
                        db=db, appointment_id=child_apt.id, scheduled_at=next_time
                    )
                    total_reminders += r_count
                    total_created += 1

        await db.commit()
        await db.refresh(root_apt)
        return root_apt, total_created, total_reminders

    async def update_appointment(
        self,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        obj_in: AppointmentUpdate,
    ) -> Optional[Appointment]:
        """Dời lịch hẹn hoặc cập nhật ghi chú y khoa."""
        apt = await self.get_by_id(db, appointment_id)
        if not apt or apt.status != AppointmentStatusEnum.UPCOMING.value:
            return None

        # Nếu thay đổi thời gian hoặc thời lượng
        new_time = obj_in.scheduled_at or apt.scheduled_at
        if new_time.tzinfo is None:
            new_time = new_time.replace(tzinfo=timezone.utc)
        new_duration = obj_in.duration_minutes or apt.duration_minutes

        if obj_in.scheduled_at or obj_in.duration_minutes:
            is_conflict = await self.check_conflict(
                db=db,
                start_time=new_time,
                duration_minutes=new_duration,
                patient_id=apt.patient_id,
                doctor_id=apt.doctor_id,
                exclude_id=apt.id,
            )
            if is_conflict:
                raise ValueError("Thời gian dời lịch bị trùng với cuộc hẹn khác.")

            apt.scheduled_at = new_time
            apt.duration_minutes = new_duration

            # Hủy các mốc nhắc nhở cũ đang chờ và thiết lập lại theo giờ mới
            await db.execute(
                update(AppointmentReminder)
                .where(
                    and_(
                        AppointmentReminder.appointment_id == apt.id,
                        AppointmentReminder.status == ReminderStatusEnum.PENDING.value,
                    )
                )
                .values(status=ReminderStatusEnum.CANCELLED.value)
            )
            await self._create_reminders_for_appointment(db, apt.id, new_time)

        if obj_in.visit_type is not None:
            apt.visit_type = obj_in.visit_type
        if obj_in.location is not None:
            apt.location = obj_in.location
        if obj_in.clinical_notes is not None:
            apt.clinical_notes = obj_in.clinical_notes
        if obj_in.enable_speaker_reminder is not None:
            apt.enable_speaker_reminder = obj_in.enable_speaker_reminder

        await db.commit()
        await db.refresh(apt)
        return apt

    async def mark_completed(
        self, db: AsyncSession, appointment_id: uuid.UUID
    ) -> Optional[Appointment]:
        """Xác nhận đã khám xong (COMPLETED). Hủy các mốc nhắc nhở còn lại."""
        apt = await self.get_by_id(db, appointment_id)
        if not apt or apt.status != AppointmentStatusEnum.UPCOMING.value:
            return None

        apt.status = AppointmentStatusEnum.COMPLETED.value

        # Hủy các nhắc nhở chưa gửi
        await db.execute(
            update(AppointmentReminder)
            .where(
                and_(
                    AppointmentReminder.appointment_id == apt.id,
                    AppointmentReminder.status == ReminderStatusEnum.PENDING.value,
                )
            )
            .values(status=ReminderStatusEnum.CANCELLED.value)
        )

        await db.commit()
        return await self.get_by_id(db, appointment_id)

    async def cancel_appointment(
        self,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        cancellation_reason: str,
    ) -> Optional[Appointment]:
        """Hủy lịch hẹn kèm theo lý do bắt buộc (idempotent, hỗ trợ re-load quan hệ an toàn)."""
        apt = await self.get_by_id(db, appointment_id)
        if not apt:
            return None

        # Nếu đã hủy trước đó: Cập nhật lại lý do hủy nếu có thay đổi và trả về bản ghi hiện tại
        if apt.status == AppointmentStatusEnum.CANCELLED.value:
            if cancellation_reason and apt.cancellation_reason != cancellation_reason:
                apt.cancellation_reason = cancellation_reason
                await db.commit()
            return await self.get_by_id(db, appointment_id)

        # Nếu đã hoàn tất buổi khám thì không cho phép hủy
        if apt.status == AppointmentStatusEnum.COMPLETED.value:
            raise ValueError("Lịch khám này đã hoàn tất, không thể hủy bỏ.")

        apt.status = AppointmentStatusEnum.CANCELLED.value
        apt.cancellation_reason = cancellation_reason

        # Hủy các nhắc nhở chưa gửi
        await db.execute(
            update(AppointmentReminder)
            .where(
                and_(
                    AppointmentReminder.appointment_id == apt.id,
                    AppointmentReminder.status == ReminderStatusEnum.PENDING.value,
                )
            )
            .values(status=ReminderStatusEnum.CANCELLED.value)
        )

        await db.commit()
        # Trả về bản ghi tươi mới với selectinload quan hệ để tránh DetachedInstanceError trong Async SQLAlchemy
        return await self.get_by_id(db, appointment_id)

    async def delete_appointment(
        self, db: AsyncSession, appointment_id: uuid.UUID
    ) -> bool:
        """Xóa vĩnh viễn một bản ghi lịch hẹn."""
        apt = await self.get_by_id(db, appointment_id)
        if not apt:
            return False
        await db.delete(apt)
        await db.commit()
        return True


crud_appointment = CRUDAppointment()

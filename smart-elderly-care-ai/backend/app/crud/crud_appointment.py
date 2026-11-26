"""
crud_appointment.py – Asynchronous CRUD operations for Appointments and Reminders.
Implements conflict verification, recurrence series generation, and reminder management.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple
import uuid

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment, AppointmentReminder
from app.models.elderly_profile import ElderlyProfile
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusEnum,
    AppointmentUpdate,
    RecurrencePatternEnum,
    ReminderStatusEnum,
    ReminderTypeEnum,
)


def _to_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


async def get_patient_names_map(
    db: AsyncSession, patient_ids: Iterable[uuid.UUID]
) -> Dict[uuid.UUID, str]:
    ids = list({pid for pid in patient_ids if pid})
    if not ids:
        return {}
    res = await db.execute(
        select(ElderlyProfile.id, ElderlyProfile.full_name).where(ElderlyProfile.id.in_(ids))
    )
    return {pid: name for pid, name in res.all() if name}


def build_appointment_response(
    apt: Appointment,
    patient_name: Optional[str] = None,
    doctor_name: Optional[str] = None,
    created_appointments: Optional[List[AppointmentResponse]] = None,
) -> AppointmentResponse:
    resolved_doctor = doctor_name or (apt.doctor.full_name if apt.doctor else "Bác sĩ")
    return AppointmentResponse(
        id=str(apt.id),
        doctor_id=str(apt.doctor_id) if apt.doctor_id else None,
        doctor_name=resolved_doctor,
        patient_id=str(apt.patient_id),
        patient_name=patient_name or "Bệnh nhân người cao tuổi",
        house_id=str(apt.house_id) if apt.house_id else None,
        created_by=getattr(apt, "created_by", None),
        visit_type=apt.visit_type,
        scheduled_at=apt.scheduled_at,
        duration_minutes=apt.duration_minutes,
        location=apt.location,
        exam_type=getattr(apt, "exam_type", None),
        instructions=getattr(apt, "instructions", None),
        clinical_notes=apt.clinical_notes,
        status=apt.status,
        cancellation_reason=apt.cancellation_reason,
        recurrence_pattern=apt.recurrence_pattern,
        parent_recurring_id=str(apt.parent_recurring_id) if apt.parent_recurring_id else None,
        enable_speaker_reminder=apt.enable_speaker_reminder,
        created_at=apt.created_at,
        updated_at=apt.updated_at,
        created_appointments=created_appointments,
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
        visit_type: Optional[str] = None,
    ) -> bool:
        """
        Kiểm tra xem khoảng thời gian [start_time, end_time) có bị trùng với
        bất kỳ lịch khám nào (trạng thái khác CANCELLED) của cùng Bác sĩ hoặc Bệnh nhân.
        Với lịch khám tại nhà (HOME_VISIT), áp dụng khoảng đệm ±60 phút cho thời gian di chuyển.
        Trả về True nếu bị trùng lịch (Conflict), ngược lại False.
        """
        norm_start = _to_utc(start_time)
        dur = duration_minutes if (duration_minutes and duration_minutes > 0) else 30
        norm_end = norm_start + timedelta(minutes=dur)
        is_new_home = (visit_type or "").upper() == "HOME_VISIT"

        conflict_conditions = [
            Appointment.status != AppointmentStatusEnum.CANCELLED.value,
            Appointment.scheduled_at < norm_end + timedelta(minutes=60),
            Appointment.scheduled_at >= norm_start - timedelta(days=1),
        ]

        if exclude_id:
            conflict_conditions.append(Appointment.id != exclude_id)

        target_party = [Appointment.patient_id == patient_id]
        if doctor_id:
            target_party.append(Appointment.doctor_id == doctor_id)

        conflict_conditions.append(or_(*target_party))

        stmt = select(
            Appointment.id,
            Appointment.scheduled_at,
            Appointment.duration_minutes,
            Appointment.visit_type,
        ).where(and_(*conflict_conditions))
        res = await db.execute(stmt)
        for _, ex_start, ex_dur, ex_visit_type in res.all():
            ex_start_utc = _to_utc(ex_start)
            ex_dur_mins = ex_dur if (ex_dur and ex_dur > 0) else 30
            ex_end_utc = ex_start_utc + timedelta(minutes=ex_dur_mins)
            is_home_pair = is_new_home or ((ex_visit_type or "").upper() == "HOME_VISIT")
            if is_home_pair:
                if abs((ex_start_utc - norm_start).total_seconds()) < 60 * 60:
                    return True
            if ex_start_utc < norm_end and ex_end_utc > norm_start:
                return True
        return False

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
        if status and status.strip() and status.strip().upper() != "ALL":
            filters.append(Appointment.status == status.strip().upper())

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
        scheduled_at = _to_utc(obj_in.scheduled_at)
        if scheduled_at <= datetime.now(timezone.utc):
            raise ValueError("Thời gian hẹn phải ở tương lai")

        # 1. Chuyển đổi và tìm kiếm thông tin bệnh nhân
        try:
            patient_uuid = uuid.UUID(obj_in.patient_id)
        except (ValueError, TypeError):
            raise ValueError("ID bệnh nhân không hợp lệ.")

        p_stmt = select(ElderlyProfile).where(ElderlyProfile.id == patient_uuid)
        p_res = await db.execute(p_stmt)
        elderly = p_res.scalar_one_or_none()
        if not elderly:
            raise ValueError("Không tìm thấy hồ sơ người cao tuổi.")
        house_id = elderly.house_id

        # 2. Kiểm tra trùng lịch cho cuộc hẹn gốc
        is_conflict = await self.check_conflict(
            db=db,
            start_time=scheduled_at,
            duration_minutes=obj_in.duration_minutes,
            patient_id=patient_uuid,
            doctor_id=doctor_id,
            visit_type=obj_in.visit_type,
        )
        if is_conflict:
            raise ValueError("Khung giờ này đã có lịch khám khác. Vui lòng chọn giờ khác.")

        # 3. Tạo cuộc hẹn chính (Root Appointment)
        pattern = (obj_in.recurrence_pattern or RecurrencePatternEnum.NONE.value).strip().upper()
        exam_type_val = obj_in.exam_type.strip() if obj_in.exam_type and obj_in.exam_type.strip() else None
        instructions_val = obj_in.instructions.strip() if obj_in.instructions and obj_in.instructions.strip() else None
        root_apt = Appointment(
            doctor_id=doctor_id,
            patient_id=patient_uuid,
            house_id=house_id,
            created_by=created_by,
            visit_type=obj_in.visit_type,
            scheduled_at=scheduled_at,
            duration_minutes=obj_in.duration_minutes,
            location=obj_in.location,
            exam_type=exam_type_val,
            instructions=instructions_val,
            clinical_notes=obj_in.clinical_notes,
            status=AppointmentStatusEnum.UPCOMING.value,
            recurrence_pattern=pattern,
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
                    visit_type=obj_in.visit_type,
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
                        exam_type=exam_type_val,
                        instructions=instructions_val,
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
        loaded = await self.get_by_id(db, root_apt.id)
        return (loaded or root_apt), total_created, total_reminders

    async def update_appointment(
        self,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        obj_in: AppointmentUpdate,
    ) -> Optional[Appointment]:
        """Dời lịch hẹn hoặc cập nhật ghi chú y khoa."""
        apt = await self.get_by_id(db, appointment_id)
        if not apt:
            return None
        if apt.status not in (AppointmentStatusEnum.UPCOMING.value, "CONFIRMED"):
            raise ValueError("Chỉ có thể cập nhật lịch khám ở trạng thái sắp tới (UPCOMING).")

        # Nếu thay đổi thời gian hoặc thời lượng
        new_time = _to_utc(obj_in.scheduled_at) if obj_in.scheduled_at is not None else _to_utc(apt.scheduled_at)
        if obj_in.scheduled_at is not None and new_time <= datetime.now(timezone.utc):
            raise ValueError("Thời gian hẹn phải ở tương lai")
        new_duration = obj_in.duration_minutes if obj_in.duration_minutes is not None else apt.duration_minutes

        if obj_in.scheduled_at is not None or obj_in.duration_minutes is not None or obj_in.visit_type is not None:
            is_conflict = await self.check_conflict(
                db=db,
                start_time=new_time,
                duration_minutes=new_duration,
                patient_id=apt.patient_id,
                doctor_id=apt.doctor_id,
                exclude_id=apt.id,
                visit_type=obj_in.visit_type or apt.visit_type,
            )
            if is_conflict:
                raise ValueError("Khung giờ này đã có lịch khám khác. Vui lòng chọn giờ khác.")

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
        if obj_in.exam_type is not None:
            apt.exam_type = obj_in.exam_type.strip() or None
        if obj_in.instructions is not None:
            apt.instructions = obj_in.instructions.strip() or None
        if obj_in.clinical_notes is not None:
            apt.clinical_notes = obj_in.clinical_notes
        if obj_in.enable_speaker_reminder is not None:
            apt.enable_speaker_reminder = obj_in.enable_speaker_reminder

        await db.commit()
        return await self.get_by_id(db, appointment_id)

    async def mark_completed(
        self,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        clinical_notes: Optional[str] = None,
    ) -> Optional[Appointment]:
        """Xác nhận đã khám xong (COMPLETED). Hủy các mốc nhắc nhở còn lại."""
        apt = await self.get_by_id(db, appointment_id)
        if not apt:
            return None
        if apt.status not in (AppointmentStatusEnum.UPCOMING.value, AppointmentStatusEnum.CONFIRMED.value):
            raise ValueError("Lịch khám đã hoàn tất hoặc đã bị hủy trước đó.")

        apt.status = AppointmentStatusEnum.COMPLETED.value
        if clinical_notes is not None and clinical_notes.strip():
            apt.clinical_notes = clinical_notes.strip()

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

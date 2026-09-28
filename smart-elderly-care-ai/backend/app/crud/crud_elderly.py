"""
crud_elderly.py – CRUD / Repository cho Hồ sơ Người cao tuổi (Elderly Profile & Medical Record).
Vị trí: backend/app/crud/crud_elderly.py
"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.elderly_profile import ElderlyProfile
from app.models.house import House
from app.schemas.patient import (
    MedicalCondition,
    PatientMedicalRecordOut,
    PatientMedicalRecordUpdate,
)


DEFAULT_CONDITIONS = [
    MedicalCondition(
        id="c1",
        name="Cao huyết áp (Độ 2)",
        severity="danger",
        note="Huyết áp nền 145/90 mmHg, uống Amlodipine 5mg hàng ngày",
    ),
    MedicalCondition(
        id="c2",
        name="Tim mạch (Thiếu máu cơ tim nhẹ)",
        severity="warning",
        note="Tái khám định kỳ, tránh gắng sức thể lực quá mức",
    ),
    MedicalCondition(
        id="c3",
        name="Đái tháo đường Type 2",
        severity="warning",
        note="Duy trì HbA1c < 7.0%, kiểm tra đường huyết đói mỗi sáng",
    ),
    MedicalCondition(
        id="c4",
        name="Thoái hóa khớp gối hai bên",
        severity="info",
        note="Nguy cơ té ngã khi đứng lên ngồi xuống, cần gậy hỗ trợ",
    ),
]


class CRUDElderly:

    async def get_or_create_default(
        self, db: AsyncSession, house_id: UUID
    ) -> ElderlyProfile:
        result = await db.execute(
            select(ElderlyProfile)
            .options(selectinload(ElderlyProfile.devices))
            .where(ElderlyProfile.house_id == house_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = ElderlyProfile(
                house_id=house_id,
                full_name="Nguyễn Văn An",
                birth_year=1948,
                gender="MALE",
                medical_history="Cao huyết áp (Độ 2), Đái tháo đường Type 2, Thoái hóa khớp gối",
                emergency_contact_phone="+84905123456",
            )
            db.add(profile)
            await db.flush()
            await db.refresh(profile)
        return profile

    async def get_medical_record(
        self, db: AsyncSession, patient_id_or_serial: str, house_id: Optional[UUID] = None
    ) -> PatientMedicalRecordOut:
        """
        Lấy hồ sơ y tế định dạng chi tiết cho màn hình PatientMedicalRecordScreen.
        Nếu truyền số nguyên (1) hoặc UUID không tìm thấy, tự động trả về hồ sơ cụ trong căn nhà.
        """
        profile: Optional[ElderlyProfile] = None

        try:
            val_uuid = UUID(patient_id_or_serial)
            res = await db.execute(
                select(ElderlyProfile).where(ElderlyProfile.id == val_uuid)
            )
            profile = res.scalar_one_or_none()
        except (ValueError, TypeError):
            pass

        if not profile and house_id:
            profile = await self.get_or_create_default(db, house_id)

        if not profile:
            # Fallback nếu không có house_id
            return PatientMedicalRecordOut(
                id=str(patient_id_or_serial),
                name="Nguyễn Văn An",
                birth_year="1948",
                age=78,
                gender="Nam",
                blood_type="O+",
                height_cm=165,
                weight_kg=62,
                conditions=DEFAULT_CONDITIONS,
            )

        current_year = datetime.now().year
        birth_year = profile.birth_year or 1948
        age = current_year - birth_year

        return PatientMedicalRecordOut(
            id=str(profile.id),
            name=profile.full_name,
            birth_year=str(birth_year),
            age=age,
            gender="Nam" if (profile.gender or "").upper() == "MALE" else "Nữ",
            blood_type="O+",
            height_cm=165,
            weight_kg=62,
            conditions=DEFAULT_CONDITIONS,
            drug_allergies="Penicillin (dị ứng nổi mề đay)",
            food_allergies="Hải sản có vỏ (tôm, cua)",
            dietary_notes="Ăn nhạt, giảm muối < 3g/ngày, hạn chế đường và tinh bột",
            doctor_name="BS. CKII. Trần Tuấn Minh",
            doctor_phone="0912 345 678",
            doctor_specialty="Chuyên khoa Tim mạch & Lão khoa",
            hospital="Bệnh viện Đa khoa Đà Nẵng",
            next_appointment="15/10/2026 - 08:30",
        )

    async def update_medical_record(
        self,
        db: AsyncSession,
        patient_id_or_serial: str,
        update_in: PatientMedicalRecordUpdate,
        house_id: Optional[UUID] = None,
    ) -> PatientMedicalRecordOut:
        """Cập nhật thông tin hồ sơ y tế."""
        profile: Optional[ElderlyProfile] = None
        try:
            val_uuid = UUID(patient_id_or_serial)
            res = await db.execute(
                select(ElderlyProfile).where(ElderlyProfile.id == val_uuid)
            )
            profile = res.scalar_one_or_none()
        except (ValueError, TypeError):
            pass

        if not profile and house_id:
            profile = await self.get_or_create_default(db, house_id)

        if profile:
            if update_in.name is not None:
                profile.full_name = update_in.name
            if update_in.birth_year is not None:
                try:
                    profile.birth_year = int(update_in.birth_year)
                except ValueError:
                    pass
            if update_in.gender is not None:
                profile.gender = "MALE" if update_in.gender in ["Nam", "MALE"] else "FEMALE"
            await db.flush()
            await db.refresh(profile)

        return await self.get_medical_record(db, patient_id_or_serial, house_id=house_id)


crud_elderly = CRUDElderly()

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
                full_name="",
                birth_year=None,
                gender=None,
                medical_history="",
                emergency_contact_phone="",
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
        Trả về dữ liệu thực tế từ DB (rỗng nếu chưa cập nhật), không dùng dữ liệu mẫu.
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
        elif not profile:
            res = await db.execute(select(ElderlyProfile).limit(1))
            profile = res.scalar_one_or_none()

        if not profile:
            return PatientMedicalRecordOut(id=patient_id_or_serial)

        current_year = datetime.now().year
        birth_year = profile.birth_year
        age = (current_year - birth_year) if birth_year else 0

        import json
        parsed_conditions: list[MedicalCondition] = []
        if profile.conditions_json:
            try:
                raw_conds = json.loads(profile.conditions_json)
                if isinstance(raw_conds, list):
                    parsed_conditions = [MedicalCondition(**c) for c in raw_conds]
            except Exception:
                pass

        gender_str = ""
        if profile.gender:
            gender_str = "Nam" if profile.gender.upper() == "MALE" else "Nữ"

        return PatientMedicalRecordOut(
            id=str(profile.id),
            name=profile.full_name or "",
            birth_year=str(birth_year) if birth_year else "",
            age=age,
            gender=gender_str,
            blood_type=profile.blood_type or "",
            height_cm=profile.height_cm or 0,
            weight_kg=profile.weight_kg or 0,
            conditions=parsed_conditions,
            drug_allergies=profile.drug_allergies or "",
            food_allergies=profile.food_allergies or "",
            dietary_notes=profile.dietary_notes or "",
            doctor_name="",
            doctor_phone="",
            doctor_specialty="",
            hospital="",
            next_appointment="",
            avatar_url=profile.avatar_url,
            has_face_enrolled=bool(profile.face_embedding),
        )

    async def update_medical_record(
        self,
        db: AsyncSession,
        patient_id_or_serial: str,
        update_in: PatientMedicalRecordUpdate,
        house_id: Optional[UUID] = None,
    ) -> PatientMedicalRecordOut:
        """Cập nhật thông tin hồ sơ y tế."""
        import json
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
        elif not profile:
            res = await db.execute(select(ElderlyProfile).limit(1))
            profile = res.scalar_one_or_none()

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
            if update_in.blood_type is not None:
                profile.blood_type = update_in.blood_type
            if update_in.height_cm is not None:
                profile.height_cm = update_in.height_cm
            if update_in.weight_kg is not None:
                profile.weight_kg = update_in.weight_kg
            if update_in.drug_allergies is not None:
                profile.drug_allergies = update_in.drug_allergies
            if update_in.food_allergies is not None:
                profile.food_allergies = update_in.food_allergies
            if update_in.dietary_notes is not None:
                profile.dietary_notes = update_in.dietary_notes
            if update_in.conditions is not None:
                profile.conditions_json = json.dumps([c.model_dump() for c in update_in.conditions], ensure_ascii=False)
                profile.medical_history = ", ".join(c.name for c in update_in.conditions)
            await db.commit()
            await db.refresh(profile)

        return await self.get_medical_record(db, patient_id_or_serial, house_id=house_id)

    async def enroll_face(
        self,
        db: AsyncSession,
        patient_id_or_serial: str,
        image_bytes: bytes,
        house_id: Optional[UUID] = None,
    ):
        """Đăng ký / cập nhật khuôn mặt người cao tuổi trực tiếp qua hồ sơ bệnh án."""
        import io
        import json
        from pathlib import Path
        from PIL import Image
        from app.schemas.patient import FaceEnrollResponse
        from app.services.vision.face_embedding import compute_face_embedding

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
        elif not profile:
            res = await db.execute(select(ElderlyProfile).limit(1))
            profile = res.scalar_one_or_none()

        if not profile:
            raise ValueError("Không tìm thấy hồ sơ người cao tuổi để đăng ký khuôn mặt.")

        # Decode ảnh từ buffer qua PIL (hỗ trợ JPG, PNG, WebP)
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception:
            raise ValueError("Không thể giải mã dữ liệu ảnh. Vui lòng chọn ảnh định dạng JPG hoặc PNG hợp lệ.")

        # Lưu ảnh vào thư mục static/faces
        static_dir = Path("static/faces")
        static_dir.mkdir(parents=True, exist_ok=True)
        img_filename = f"{profile.id}.jpg"
        img_path = static_dir / img_filename
        image.save(img_path, format="JPEG", quality=90)

        # Trích xuất 128-D vector đặc trưng khuôn mặt
        embedding = compute_face_embedding(image)
        emb_list = list(embedding)

        avatar_url = f"/static/faces/{img_filename}"
        profile.avatar_url = avatar_url
        profile.face_embedding = json.dumps(emb_list)

        await db.commit()
        await db.refresh(profile)

        # Đồng bộ cache sang Edge Hub để camera nhận diện ngay lập tức
        try:
            edge_cache = Path(__file__).parent.parent.parent.parent / "edge" / "config" / "enrolled_faces.json"
            edge_cache.parent.mkdir(parents=True, exist_ok=True)
            cache_data = {}
            if edge_cache.exists():
                with open(edge_cache, "r", encoding="utf-8") as f:
                    cache_data = json.load(f)
            cache_data[str(profile.id)] = {
                "name": profile.full_name,
                "avatar_url": avatar_url,
                "embedding": emb_list,
            }
            with open(edge_cache, "w", encoding="utf-8") as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        return FaceEnrollResponse(
            success=True,
            message=f"Đã đăng ký nhận diện khuôn mặt thành công cho {profile.full_name}.",
            elderly_id=str(profile.id),
            full_name=profile.full_name,
            avatar_url=avatar_url,
            has_face_enrolled=True,
        )


crud_elderly = CRUDElderly()

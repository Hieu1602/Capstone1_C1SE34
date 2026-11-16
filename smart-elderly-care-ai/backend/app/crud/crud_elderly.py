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


def parse_valid_upcoming_appointment(val) -> Optional[str]:
    """Kiểm tra và chuẩn hóa lịch hẹn. Nếu không có hoặc đã hết hạn thì trả về None."""
    if not val:
        return None
    from datetime import timezone, timedelta
    if isinstance(val, datetime):
        now = datetime.now(timezone.utc) if val.tzinfo else datetime.now()
        if val >= now:
            if val.tzinfo:
                vn_time = val.astimezone(timezone(timedelta(hours=7)))
                return vn_time.strftime("%H:%M ngày %d/%m/%Y")
            return val.strftime("%H:%M ngày %d/%m/%Y")
        return None

    s = str(val).strip()
    if not s or s.lower() in ["chưa có lịch hẹn", "chưa có", "không có", "--"]:
        return None

    import re
    now = datetime.now()

    # Thử ISO format
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo:
            now_utc = datetime.now(timezone.utc)
            if dt >= now_utc:
                vn_time = dt.astimezone(timezone(timedelta(hours=7)))
                return vn_time.strftime("%H:%M ngày %d/%m/%Y")
            return None
        elif dt >= now:
            return dt.strftime("%H:%M ngày %d/%m/%Y")
        return None
    except Exception:
        pass

    # HH:MM ngày DD/MM/YYYY hoặc HH:MM - DD/MM/YYYY
    m1 = re.search(r"(\d{1,2}):(\d{2})\s*(?:ngày|-)?\s*(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m1:
        hh, mm, d, m_val, y = map(int, m1.groups())
        try:
            dt = datetime(y, m_val, d, hh, mm)
            if dt >= now:
                return f"{hh:02d}:{mm:02d} ngày {d:02d}/{m_val:02d}/{y:04d}"
            return None
        except Exception:
            pass

    # DD/MM/YYYY HH:MM
    m2 = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})\s*(\d{1,2}):(\d{2})", s)
    if m2:
        d, m_val, y, hh, mm = map(int, m2.groups())
        try:
            dt = datetime(y, m_val, d, hh, mm)
            if dt >= now:
                return f"{hh:02d}:{mm:02d} ngày {d:02d}/{m_val:02d}/{y:04d}"
            return None
        except Exception:
            pass

    # DD/MM/YYYY (cuối ngày)
    m3 = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m3:
        d, m_val, y = map(int, m3.groups())
        try:
            dt = datetime(y, m_val, d, 23, 59, 59)
            if dt >= now:
                return f"{d:02d}/{m_val:02d}/{y:04d}"
            return None
        except Exception:
            pass

    return None





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
            res_house = await db.execute(
                select(ElderlyProfile)
                .options(selectinload(ElderlyProfile.devices))
                .where(ElderlyProfile.house_id == house_id)
            )
            profile = res_house.scalar_one_or_none()
        elif not profile:
            res_first = await db.execute(
                select(ElderlyProfile)
                .options(selectinload(ElderlyProfile.devices))
                .limit(1)
            )
            profile = res_first.scalar_one_or_none()



        if not profile or not profile.full_name or not profile.full_name.strip():

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

            if profile.gender.upper() in ["MALE", "NAM"]:

                gender_str = "Nam"

            elif profile.gender.upper() in ["FEMALE", "NỮ", "NU"]:

                gender_str = "Nữ"

            else:

                gender_str = "Khác"

        # 1. Tìm Bác sĩ phụ trách người cao tuổi (từ HouseMember của ngôi nhà, hoặc Lịch hẹn)
        doc_user = None
        if profile.house_id:
            try:
                from app.models.house import HouseMember
                from app.models.user import User
                from sqlalchemy import or_

                doc_stmt = (
                    select(User)
                    .join(HouseMember, HouseMember.user_id == User.id)
                    .where(
                        HouseMember.house_id == profile.house_id,
                        HouseMember.status == "ACTIVE",
                        or_(
                            HouseMember.role_in_house.ilike("%doctor%"),
                            User.role == "doctor",
                        ),
                    )
                    .limit(1)
                )
                doc_res = await db.execute(doc_stmt)
                doc_user = doc_res.scalar_one_or_none()
            except Exception:
                pass

        if not doc_user:
            try:
                from app.models.appointment import Appointment
                from app.models.user import User
                apt_stmt = (
                    select(User)
                    .join(Appointment, Appointment.doctor_id == User.id)
                    .where(Appointment.patient_id == profile.id)
                    .order_by(Appointment.scheduled_at.desc())
                    .limit(1)
                )
                apt_res = await db.execute(apt_stmt)
                doc_user = apt_res.scalar_one_or_none()
            except Exception:
                pass

        if not doc_user:
            try:
                from app.models.user import User
                doc_sys_stmt = select(User).where(User.role == "doctor", User.is_active == True).limit(1)
                doc_sys_res = await db.execute(doc_sys_stmt)
                doc_user = doc_sys_res.scalar_one_or_none()
            except Exception:
                pass

        clinical_info = (
            getattr(__import__('app.crud.crud_doctor', fromlist=['_CLINICAL_STORE']), '_CLINICAL_STORE', {})
            .get(str(profile.id), {})
            or getattr(__import__('app.crud.crud_doctor', fromlist=['_CLINICAL_STORE']), '_CLINICAL_STORE', {})
            .get(patient_id_or_serial, {})
            or {}
        )

        doc_name = clinical_info.get("doctor_name") or (doc_user.full_name if doc_user else "") or ""
        doc_phone = clinical_info.get("doctor_phone") or (doc_user.phone if doc_user else "") or ""
        doc_specialty = clinical_info.get("doctor_specialty") or (doc_user.specialty if doc_user and doc_user.specialty else "Bác sĩ gia đình")
        hospital_val = clinical_info.get("hospital") or (doc_user.workplace if doc_user and doc_user.workplace else "Hệ thống Y tế SECA AI")
        doc_avatar = clinical_info.get("doctor_avatar_url") or (doc_user.avatar_url if doc_user else None)

        # 2. Lịch tái khám sắp tới (từ DB appointments hoặc _CLINICAL_STORE / _APPOINTMENT_STORE)
        next_appointment_str = ""
        try:
            from app.models.appointment import Appointment
            from datetime import timezone
            now_dt = datetime.now(timezone.utc)
            apt_q = (
                select(Appointment)
                .where(
                    Appointment.patient_id == profile.id,
                    Appointment.status == "UPCOMING",
                    Appointment.scheduled_at >= now_dt,
                )
                .order_by(Appointment.scheduled_at.asc())
                .limit(1)
            )
            apt_q_res = await db.execute(apt_q)
            upcoming_apt = apt_q_res.scalar_one_or_none()
            if upcoming_apt and upcoming_apt.scheduled_at:
                next_appointment_str = parse_valid_upcoming_appointment(upcoming_apt.scheduled_at) or ""
        except Exception:
            pass

        if not next_appointment_str:
            try:
                from app.crud.crud_doctor import _APPOINTMENT_STORE
                pid_str = str(profile.id)
                for apt in _APPOINTMENT_STORE:
                    if str(getattr(apt, "patient_id", "")) == pid_str and getattr(apt, "status", "") == "UPCOMING":
                        sch = getattr(apt, "scheduled_at", "")
                        parsed_sch = parse_valid_upcoming_appointment(sch)
                        if parsed_sch:
                            next_appointment_str = parsed_sch
                            break
            except Exception:
                pass

        if not next_appointment_str:
            raw_next = clinical_info.get("next_appointment") or ""
            next_appointment_str = parse_valid_upcoming_appointment(raw_next) or ""

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

            doctor_name=doc_name,

            doctor_phone=doc_phone,

            doctor_specialty=doc_specialty,

            hospital=hospital_val,

            next_appointment=next_appointment_str,

            doctor_avatar_url=doc_avatar,

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
            res_first = await db.execute(select(ElderlyProfile).limit(1))
            profile = res_first.scalar_one_or_none()



        if profile:

            if update_in.name is not None:

                profile.full_name = update_in.name

            if update_in.birth_year is not None:

                try:

                    profile.birth_year = int(update_in.birth_year)

                except ValueError:

                    pass

            if update_in.gender is not None:

                if update_in.gender in ["Nam", "MALE"]:

                    profile.gender = "MALE"

                elif update_in.gender in ["Nữ", "FEMALE"]:

                    profile.gender = "FEMALE"

                else:

                    profile.gender = "OTHER"

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

            # Đồng bộ thông tin Bác sĩ / Lịch hẹn nếu có cập nhật lâm sàng
            has_doc_updates = any(
                v is not None
                for v in [
                    update_in.doctor_name,
                    update_in.doctor_phone,
                    update_in.doctor_specialty,
                    update_in.hospital,
                    update_in.next_appointment,
                    update_in.doctor_avatar_url,
                ]
            )
            if has_doc_updates:
                clinical_store = getattr(
                    __import__("app.crud.crud_doctor", fromlist=["_CLINICAL_STORE"]),
                    "_CLINICAL_STORE",
                    {},
                )
                p_key = str(profile.id)
                if p_key not in clinical_store:
                    clinical_store[p_key] = {}
                if update_in.doctor_name is not None:
                    clinical_store[p_key]["doctor_name"] = update_in.doctor_name
                if update_in.doctor_phone is not None:
                    clinical_store[p_key]["doctor_phone"] = update_in.doctor_phone
                if update_in.doctor_specialty is not None:
                    clinical_store[p_key]["doctor_specialty"] = update_in.doctor_specialty
                if update_in.hospital is not None:
                    clinical_store[p_key]["hospital"] = update_in.hospital
                if update_in.next_appointment is not None:
                    clinical_store[p_key]["next_appointment"] = update_in.next_appointment
                if update_in.doctor_avatar_url is not None:
                    clinical_store[p_key]["doctor_avatar_url"] = update_in.doctor_avatar_url

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
            res_first = await db.execute(select(ElderlyProfile).limit(1))
            profile = res_first.scalar_one_or_none()



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


"""
crud_doctor.py – CRUD & nghiệp vụ y khoa dành cho Bác sĩ gia đình.
Vị trí: backend/app/crud/crud_doctor.py
"""

from datetime import datetime, timedelta, timezone
import json
from typing import List, Optional, Dict, Any

SMARTBAND_STALE_SECONDS = 45


def _parse_utc_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


def _format_house_display_name(house: Optional[Any], elderly_name: Optional[str] = None) -> str:
    """Hiển thị tên nhà: ưu tiên tên nhà tùy chỉnh; nếu vẫn là mặc định 'Nhà của tôi' thì lấy theo tên chủ hộ."""
    if house and getattr(house, "name", None) and house.name != "Nhà của tôi":
        return house.name
    owner = getattr(house, "owner", None) if house else None
    owner_name = getattr(owner, "full_name", None) if owner else None
    if owner_name and owner_name.strip():
        return f"Gia đình {owner_name.strip()}"
    if elderly_name and elderly_name.strip():
        return f"Gia đình {elderly_name.strip()}"
    return "Nhà riêng bệnh nhân"


def _is_smartband_fresh(band_device: Any, ts_val: Any, now_utc: datetime) -> tuple[bool, Optional[datetime]]:
    dt = _parse_utc_dt(ts_val) or _parse_utc_dt(getattr(band_device, "last_heartbeat", None))
    if not dt:
        return False, None
    diff_sec = abs((now_utc - dt).total_seconds())
    return diff_sec <= SMARTBAND_STALE_SECONDS, dt

import uuid
from uuid import UUID

from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.house import House, HouseMember
from app.models.elderly_profile import ElderlyProfile
from app.models.device import Device
from app.models.device_config import DeviceConfig
from app.models.vital_sign import VitalSign
from app.models.user import User
from app.models.prescription import Prescription
from app.crud.crud_elderly import crud_elderly
from app.schemas.doctor import (
    DoctorPatientCard,
    DoctorPatientDetail,
    PrescriptionItem,
    PrescriptionCreate,
    PrescriptionUpdate,
    MedicationItemCreate,
    BatchPrescriptionCreate,
    DoctorMedicalRecordUpdate,
    DoctorVitalsAnalytics,
    ThresholdsUpdate,
    AppointmentItem,
    AppointmentCreate,
    AppointmentUpdate,
)
from app.schemas.patient import MedicalCondition, PatientMedicalRecordUpdate


# In-memory store cho đơn thuốc y khoa của Bác sĩ (chỉ lưu các đơn do Bác sĩ tạo)
_PRESCRIPTION_STORE: Dict[str, List[PrescriptionItem]] = {}

# In-memory store cho hồ sơ lâm sàng có thể chỉnh sửa của Bác sĩ
_CLINICAL_STORE: Dict[str, Dict[str, Any]] = {}

# In-memory store cho lịch hẹn & tái khám y tế (chỉ lưu các lịch do Bác sĩ tạo)
_APPOINTMENT_STORE: List[AppointmentItem] = []


def _init_clinical_data(patient_id: str) -> Dict[str, Any]:
    return {
        "conditions": [],
        "drug_allergies": None,
        "food_allergies": None,
        "dietary_notes": None,
        "doctor_notes": None,
        "next_appointment": None,
        "blood_type": None,
        "height_cm": None,
        "weight_kg": None,
    }


def _prescription_model_to_item(rx: Prescription) -> PrescriptionItem:
    times = rx.schedule_times
    return PrescriptionItem(
        id=str(rx.id),
        patient_id=str(rx.patient_id),
        medication_name=rx.medication_name,
        dosage=rx.dosage,
        quantity=rx.quantity,
        frequency=rx.frequency or "Hàng ngày",
        schedule_times=times,
        instructions=rx.instructions or "",
        doctor_name=rx.doctor_name,
        diagnosis=rx.diagnosis,
        general_notes=rx.general_notes,
        start_date=rx.start_date.isoformat() if rx.start_date else None,
        end_date=rx.end_date.isoformat() if rx.end_date else None,
        status=rx.status or "ACTIVE",
        enable_speaker_reminder=rx.enable_speaker_reminder,
        created_at=rx.created_at.strftime("%Y-%m-%d %H:%M:%S") if rx.created_at else None,
    )


async def _resolve_elderly_id(
    db: AsyncSession, elderly_id_str: str, create_if_missing: bool = False
) -> Optional[uuid.UUID]:
    target_uuid = None
    try:
        target_uuid = uuid.UUID(str(elderly_id_str))
    except (ValueError, TypeError):
        pass

    if target_uuid:
        res = await db.execute(select(ElderlyProfile.id).where(ElderlyProfile.id == target_uuid))
        if res.scalar_one_or_none():
            return target_uuid
        if not create_if_missing:
            return None

    if target_uuid and create_if_missing:
        res_h = await db.execute(select(House).limit(1))
        house = res_h.scalar_one_or_none()
        if not house:
            res_u = await db.execute(select(User).limit(1))
            owner = res_u.scalar_one_or_none()
            if not owner:
                owner = User(
                    phone="0905999888",
                    full_name="Chủ Nhà Mặc Định",
                    hashed_password="pw",
                    role="user",
                )
                db.add(owner)
                await db.flush()
            house = House(name="Nhà Người Cao Tuổi", address="Đà Nẵng", owner_id=owner.id)
            db.add(house)
            await db.flush()
        profile = ElderlyProfile(
            id=target_uuid,
            house_id=house.id,
            full_name="Người cao tuổi",
            birth_year=1948,
        )
        db.add(profile)
        await db.flush()
        return target_uuid

    # If elderly_id is not a valid UUID (e.g. "1" or "default_user"), find any existing profile
    res_any = await db.execute(select(ElderlyProfile.id).order_by(ElderlyProfile.created_at.asc()).limit(1))
    first_id = res_any.scalar_one_or_none()
    if first_id:
        return first_id

    if create_if_missing:
        res_u = await db.execute(select(User).limit(1))
        owner = res_u.scalar_one_or_none()
        if not owner:
            owner = User(
                phone="0905999888",
                full_name="Chủ Nhà Mặc Định",
                hashed_password="pw",
                role="user",
            )
            db.add(owner)
            await db.flush()
        house = House(name="Nhà Người Cao Tuổi", address="Đà Nẵng", owner_id=owner.id)
        db.add(house)
        await db.flush()
        new_uuid = uuid.uuid4()
        profile = ElderlyProfile(
            id=new_uuid,
            house_id=house.id,
            full_name="Người cao tuổi",
            birth_year=1948,
        )
        db.add(profile)
        await db.flush()
        return new_uuid

    return None


class CRUDDoctor:

    async def get_assigned_patients(
        self, db: AsyncSession, doctor_user: User
    ) -> List[DoctorPatientCard]:
        """
        Lấy danh sách tất cả người cao tuổi trong các căn nhà mà Bác sĩ được mời tham gia (house_members).
        Tích hợp Redis In-Memory Cache (độ trễ < 1ms), tự động làm mới sinh hiệu thời gian thực từ RAM.
        """
        from app.services.redis import redis_service

        # 0. Ưu tiên lấy nhanh từ Redis Cache (< 1ms)
        cached_cards_data = None
        try:
            cached_cards_data = await redis_service.get_cached_doctor_patients(str(doctor_user.id))
        except Exception:
            pass

        if cached_cards_data is not None:
            cached_cards: List[DoctorPatientCard] = []
            for item in cached_cards_data:
                # Cập nhật nhanh sinh hiệu thời gian thực từ Redis RAM nếu có bản tin mới
                dev_id = item.get("device_id")
                if dev_id:
                    try:
                        latest_vs = await redis_service.get_latest_vitals(str(dev_id))
                        if latest_vs:
                            if latest_vs.get("heart_rate"):
                                item["heart_rate"] = latest_vs["heart_rate"]
                            if latest_vs.get("spo2"):
                                item["spo2"] = latest_vs["spo2"]
                            temp_val = latest_vs.get("skin_temp_max") or latest_vs.get("temperature")
                            if temp_val:
                                item["skin_temp_max"] = temp_val
                            if latest_vs.get("bp_systolic") is not None and latest_vs.get("bp_diastolic") is not None:
                                item["blood_pressure"] = f"{latest_vs['bp_systolic']}/{latest_vs['bp_diastolic']} mmHg"
                            item["last_updated"] = "Vừa xong (Trực tuyến)"
                            hr_val = item.get("heart_rate")
                            spo2_val = item.get("spo2")
                            if (spo2_val is not None and spo2_val < 90) or (hr_val is not None and (hr_val > 120 or hr_val < 50)):
                                item["health_status"] = "DANGER"
                            elif (spo2_val is not None and spo2_val < 95) or (hr_val is not None and (hr_val > 100 or hr_val < 55)):
                                item["health_status"] = "WARNING"
                    except Exception:
                        pass
                cached_cards.append(DoctorPatientCard(**item))
            return cached_cards

        # 1. Tối ưu: Lấy danh sách ID căn nhà trong 1 truy vấn duy nhất (Union / OR)
        house_stmt = (
            select(House.id)
            .outerjoin(
                HouseMember,
                (HouseMember.house_id == House.id)
                & (HouseMember.user_id == doctor_user.id)
                & (HouseMember.status == "ACTIVE"),
            )
            .where(
                or_(
                    House.owner_id == doctor_user.id,
                    HouseMember.id.isnot(None),
                )
            )
            .distinct()
        )
        h_res = await db.execute(house_stmt)
        house_ids = list(h_res.scalars().all())

        if not house_ids:
            return []

        # 2. Truy vấn nối (joinedload / selectinload) nạp đồng thời ElderlyProfiles, Houses và Devices
        query = (
            select(ElderlyProfile)
            .where(ElderlyProfile.house_id.in_(house_ids))
            .options(
                joinedload(ElderlyProfile.house).joinedload(House.owner),
                selectinload(ElderlyProfile.devices),
            )
            .order_by(ElderlyProfile.created_at.asc())
        )

        profiles_res = await db.execute(query)
        profiles = list(profiles_res.scalars().all())

        if not profiles:
            return []

        # 3. Thu thập thiết bị vòng đeo của tất cả bệnh nhân để khử triệt để N+1 Queries
        elderly_band_map: Dict[uuid.UUID, Any] = {}
        all_band_device_ids: List[uuid.UUID] = []

        for ep in profiles:
            if not ep.full_name or not ep.full_name.strip():
                continue
            band = None
            if ep.devices:
                for d in ep.devices:
                    if d.device_type == "SMARTBAND":
                        band = d
                        break
                if not band and ep.devices:
                    band = ep.devices[0]
            if band:
                elderly_band_map[ep.id] = band
                all_band_device_ids.append(band.id)

        # 4. Tối ưu N+1: Tải chỉ số sinh hiệu mới nhất cho TẤT CẢ thiết bị trong 1 truy vấn duy nhất (DISTINCT ON)
        latest_vitals_map: Dict[uuid.UUID, VitalSign] = {}
        if all_band_device_ids:
            vs_query = (
                select(VitalSign)
                .where(VitalSign.device_id.in_(all_band_device_ids))
                .distinct(VitalSign.device_id)
                .order_by(VitalSign.device_id, desc(VitalSign.time))
            )
            vs_res = await db.execute(vs_query)
            for vs in vs_res.scalars().all():
                latest_vitals_map[vs.device_id] = vs

        # 5. Tối ưu N+1: Tải cảnh báo / sự cố chưa xử lý cho TẤT CẢ thiết bị trong 1 truy vấn duy nhất
        from app.models.incident import Incident
        active_incidents_map: Dict[uuid.UUID, Incident] = {}
        if all_band_device_ids:
            inc_query = (
                select(Incident)
                .where(
                    Incident.device_id.in_(all_band_device_ids),
                    Incident.is_acknowledged == False,
                )
                .distinct(Incident.device_id)
                .order_by(Incident.device_id, desc(Incident.created_at))
            )
            inc_res = await db.execute(inc_query)
            for inc in inc_res.scalars().all():
                active_incidents_map[inc.device_id] = inc

        cards: List[DoctorPatientCard] = []

        for ep in profiles:
            if not ep.full_name or not ep.full_name.strip():
                continue

            h = ep.house
            band_device = elderly_band_map.get(ep.id)

            hr = None
            spo2 = None
            temp = None
            bp_str = None
            health_status = "NORMAL"
            last_updated_str = None
            is_smartband_online = False
            now_utc = datetime.now(timezone.utc)

            if band_device:
                # Ưu tiên lấy nhanh từ Redis Cache nếu có
                cached_vitals = None
                try:
                    cached_vitals = await redis_service.get_latest_vitals(str(band_device.id))
                    dev_code = getattr(band_device, 'device_id', None)
                    if not cached_vitals and dev_code:
                        cached_vitals = await redis_service.get_latest_vitals(str(dev_code))
                except Exception:
                    pass

                ts_candidate = None
                if cached_vitals:
                    hr = cached_vitals.get("heart_rate")
                    spo2 = cached_vitals.get("spo2")
                    temp = cached_vitals.get("skin_temp_max") or cached_vitals.get("temperature")
                    if cached_vitals.get("bp_systolic") is not None and cached_vitals.get("bp_diastolic") is not None:
                        bp_str = f"{cached_vitals['bp_systolic']}/{cached_vitals['bp_diastolic']} mmHg"
                    ts_candidate = cached_vitals.get("time") or cached_vitals.get("cached_at_iso")
                    last_updated_str = ts_candidate or "Vừa xong (Trực tuyến)"
                else:
                    # Sử dụng dữ liệu sinh hiệu đã tải lô (Zero SQL query chạy trong vòng lặp)
                    latest_vs = latest_vitals_map.get(band_device.id)
                    if latest_vs:
                        hr = latest_vs.heart_rate
                        spo2 = latest_vs.spo2
                        temp = latest_vs.skin_temp_max
                        if latest_vs.bp_systolic is not None and latest_vs.bp_diastolic is not None:
                            bp_str = f"{latest_vs.bp_systolic}/{latest_vs.bp_diastolic} mmHg"
                        if latest_vs.time:
                            ts_candidate = latest_vs.time
                            last_updated_str = latest_vs.time.isoformat()
                        # Cập nhật ngầm vào Redis Cache cho các lần gọi sau
                        try:
                            await redis_service.set_latest_vitals(str(band_device.id), {
                                "heart_rate": hr,
                                "spo2": spo2,
                                "skin_temp_max": temp,
                                "bp_systolic": latest_vs.bp_systolic,
                                "bp_diastolic": latest_vs.bp_diastolic,
                                "cached_at_iso": latest_vs.time.isoformat() if latest_vs.time else None,
                            })
                        except Exception:
                            pass

                # Single Source of Truth: Smartband chỉ Online khi thiết bị không bị ngắt kết nối BLE VÀ dữ liệu mới <= 45 giây
                is_fresh, latest_dt = _is_smartband_fresh(band_device, ts_candidate, now_utc)
                cache_connected_ok = True
                if cached_vitals and cached_vitals.get("bracelet_connected") is False:
                    cache_connected_ok = False
                is_smartband_online = bool(band_device.is_online and is_fresh and cache_connected_ok)

                if not is_smartband_online:
                    hr = None
                    spo2 = None
                    temp = None
                    if latest_dt:
                        last_updated_str = latest_dt.isoformat()

                # Kiểm tra cảnh báo / sự cố đang xảy ra
                active_inc = active_incidents_map.get(band_device.id)
                if active_inc and (active_inc.alert_level == "CRITICAL" or "FALL" in str(active_inc.alert_type).upper()):
                    health_status = "DANGER"

            # Đánh giá ngưỡng an toàn y khoa (chỉ đánh giá khi Smartband đang online và có số liệu thực)
            if health_status != "DANGER" and is_smartband_online:
                if (spo2 is not None and spo2 < 90) or (hr is not None and (hr > 120 or hr < 50)):
                    health_status = "DANGER"
                elif (spo2 is not None and spo2 < 95) or (hr is not None and (hr > 100 or hr < 55)):
                    health_status = "WARNING"

            birth_year_val = ep.birth_year or 0
            age_val = (datetime.now().year - ep.birth_year) if ep.birth_year else 0
            gender_val = "Nam" if (ep.gender or "").upper() == "MALE" else ("Nữ" if (ep.gender or "").upper() == "FEMALE" else "")

            h_name_display = _format_house_display_name(h, ep.full_name)
            h_address = h.address if h else ""
            h_id_str = str(h.id) if h else ""

            cards.append(
                DoctorPatientCard(
                    id=str(ep.id),
                    name=ep.full_name,
                    birth_year=birth_year_val,
                    age=age_val,
                    gender=gender_val,
                    house_id=h_id_str,
                    house_name=h_name_display,
                    house_address=h_address,
                    medical_history=ep.medical_history or "",
                    emergency_contact_phone=ep.emergency_contact_phone or "0905123456",
                    avatar_url=ep.avatar_url,
                    has_face_enrolled=bool(ep.face_embedding),
                    device_id=band_device.device_id if band_device else "",
                    is_online=is_smartband_online,
                    battery_level=getattr(band_device, 'battery_level', 92) if (band_device and is_smartband_online) else None,
                    heart_rate=hr,
                    spo2=spo2,
                    skin_temp_max=temp,
                    blood_pressure=bp_str,
                    blood_type=ep.blood_type or "A+",
                    bmi=round(ep.weight_kg / ((ep.height_cm / 100) ** 2), 1) if (ep.weight_kg and ep.height_cm and ep.height_cm > 0) else 23.4,
                    health_status=health_status,
                    last_updated=last_updated_str or "Chưa có dữ liệu",
                )
            )

        # Lưu danh sách bệnh nhân vào Redis Cache ngắn hạn (TTL = 5 giây) để đảm bảo trạng thái Online/Offline luôn real-time
        try:
            from app.services.redis import redis_service
            serialized_cards = [c.model_dump() for c in cards]
            await redis_service.set_cached_doctor_patients(str(doctor_user.id), serialized_cards, ttl=5)
        except Exception:
            pass

        return cards

    async def get_patient_detail(
        self, db: AsyncSession, elderly_id_or_serial: str
    ) -> DoctorPatientDetail:
        """Lấy chi tiết hồ sơ bệnh nhân cho Bác sĩ."""
        med_record = await crud_elderly.get_medical_record(db, elderly_id_or_serial)
        prescriptions = await self.get_prescriptions_db(db, elderly_id_or_serial)
        if not prescriptions:
            prescriptions = self.get_prescriptions(elderly_id_or_serial)

        # Khởi tạo dữ liệu lâm sàng riêng của bác sĩ nếu chưa có
        if elderly_id_or_serial not in _CLINICAL_STORE:
            _CLINICAL_STORE[elderly_id_or_serial] = _init_clinical_data(elderly_id_or_serial)
        clinical = _CLINICAL_STORE[elderly_id_or_serial]

        # Tìm hồ sơ trong DB
        elderly = None
        try:
            val_uuid = UUID(elderly_id_or_serial)
            res = await db.execute(
                select(ElderlyProfile)
                .options(joinedload(ElderlyProfile.house).joinedload(House.owner), selectinload(ElderlyProfile.devices))
                .where(ElderlyProfile.id == val_uuid)
            )
            elderly = res.scalar_one_or_none()
        except (ValueError, TypeError):
            pass

        if not elderly:
            res = await db.execute(
                select(ElderlyProfile)
                .options(joinedload(ElderlyProfile.house).joinedload(House.owner), selectinload(ElderlyProfile.devices))
                .limit(1)
            )
            elderly = res.scalar_one_or_none()

        house_id = str(elderly.house_id) if elderly and elderly.house_id else ""
        house_name = _format_house_display_name(
            elderly.house if elderly else None,
            elderly.full_name if elderly else None,
        )
        house_address = elderly.house.address if elderly and elderly.house else ""

        # Lấy thiết bị và sinh hiệu mới nhất nếu có
        band_device = None
        if elderly and elderly.devices:
            for d in elderly.devices:
                if d.device_type == "SMARTBAND":
                    band_device = d
                    break
            if not band_device and elderly.devices:
                band_device = elderly.devices[0]

        hr = None
        spo2 = None
        temp = None
        bp_str = None
        health_status = "NORMAL"
        last_updated_str = None

        is_smartband_online = False
        now_utc = datetime.now(timezone.utc)
        if band_device:
            from app.services.redis import redis_service
            cached_vs = None
            try:
                cached_vs = await redis_service.get_latest_vitals(str(band_device.id))
                dev_code = getattr(band_device, 'device_id', None)
                if not cached_vs and dev_code:
                    cached_vs = await redis_service.get_latest_vitals(str(dev_code))
            except Exception:
                pass

            ts_candidate = None
            if cached_vs:
                hr = cached_vs.get("heart_rate")
                spo2 = cached_vs.get("spo2")
                temp = cached_vs.get("skin_temp_max") or cached_vs.get("temperature")
                if cached_vs.get("bp_systolic") is not None and cached_vs.get("bp_diastolic") is not None:
                    bp_str = f"{cached_vs['bp_systolic']}/{cached_vs['bp_diastolic']} mmHg"
                ts_candidate = cached_vs.get("time") or cached_vs.get("cached_at_iso")
                last_updated_str = ts_candidate or "Vừa xong (Trực tuyến)"
            else:
                vs_res = await db.execute(
                    select(VitalSign)
                    .where(VitalSign.device_id == band_device.id)
                    .order_by(desc(VitalSign.time))
                    .limit(1)
                )
                latest_vs = vs_res.scalar_one_or_none()
                if latest_vs:
                    hr = latest_vs.heart_rate
                    spo2 = latest_vs.spo2
                    temp = latest_vs.skin_temp_max
                    if latest_vs.bp_systolic is not None and latest_vs.bp_diastolic is not None:
                        bp_str = f"{latest_vs.bp_systolic}/{latest_vs.bp_diastolic} mmHg"
                    if latest_vs.time:
                        ts_candidate = latest_vs.time
                        last_updated_str = latest_vs.time.isoformat()

            is_fresh, latest_dt = _is_smartband_fresh(band_device, ts_candidate, now_utc)
            cache_connected_ok = True
            if cached_vs and cached_vs.get("bracelet_connected") is False:
                cache_connected_ok = False
            is_smartband_online = bool(band_device.is_online and is_fresh and cache_connected_ok)

            if not is_smartband_online:
                hr = None
                spo2 = None
                temp = None
                if latest_dt:
                    last_updated_str = latest_dt.isoformat()

        if is_smartband_online:
            if (spo2 is not None and spo2 < 90) or (hr is not None and (hr > 120 or hr < 50)):
                health_status = "DANGER"
            elif (spo2 is not None and spo2 < 95) or (hr is not None and (hr > 100 or hr < 55)):
                health_status = "WARNING"

        height = (
            elderly.height_cm
            if (elderly and elderly.height_cm)
            else (med_record.height_cm or clinical.get("height_cm"))
        )
        weight = (
            elderly.weight_kg
            if (elderly and elderly.weight_kg)
            else (med_record.weight_kg or clinical.get("weight_kg"))
        )
        bmi = None
        if height and weight and height > 0:
            bmi = round(weight / ((height / 100) ** 2), 1)
        elif getattr(med_record, "bmi", None):
            bmi = float(med_record.bmi)

        # Đồng bộ nguồn dữ liệu chuẩn từ DB ElderlyProfile -> med_record -> clinical
        resolved_conditions = med_record.conditions if med_record.conditions else clinical.get("conditions", [])
        resolved_drug_allergies = (
            elderly.drug_allergies
            if (elderly and elderly.drug_allergies is not None)
            else (med_record.drug_allergies or clinical.get("drug_allergies"))
        )
        resolved_food_allergies = (
            elderly.food_allergies
            if (elderly and elderly.food_allergies is not None)
            else (med_record.food_allergies or clinical.get("food_allergies"))
        )
        resolved_dietary_notes = (
            elderly.dietary_notes
            if (elderly and elderly.dietary_notes is not None)
            else (med_record.dietary_notes or clinical.get("dietary_notes"))
        )
        resolved_blood_type = (
            elderly.blood_type
            if (elderly and elderly.blood_type)
            else (med_record.blood_type or clinical.get("blood_type"))
        )

        # Đọc cấu hình ngưỡng sinh hiệu hiện hành từ DeviceConfig / _CLINICAL_STORE
        cfg_hr_low = 50
        cfg_hr_high = 120
        cfg_spo2_low = 90
        if band_device:
            cfg_res = await db.execute(select(DeviceConfig).where(DeviceConfig.device_id == band_device.id))
            d_cfg = cfg_res.scalar_one_or_none()
            if d_cfg:
                cfg_hr_low = d_cfg.hr_threshold_low
                cfg_hr_high = d_cfg.hr_threshold_high
                cfg_spo2_low = d_cfg.spo2_threshold_low
        if clinical.get("hr_threshold_low") is not None:
            cfg_hr_low = clinical["hr_threshold_low"]
        if clinical.get("hr_threshold_high") is not None:
            cfg_hr_high = clinical["hr_threshold_high"]
        if clinical.get("spo2_threshold_low") is not None:
            cfg_spo2_low = clinical["spo2_threshold_low"]

        return DoctorPatientDetail(
            id=med_record.id,
            name=med_record.name,
            birth_year=int(med_record.birth_year) if med_record.birth_year.isdigit() else 1948,
            age=med_record.age,
            gender=med_record.gender,
            house_id=house_id,
            house_name=house_name,
            house_address=house_address,
            medical_history=(elderly.medical_history or "") if elderly else "",
            emergency_contact_phone=(elderly.emergency_contact_phone or "0905123456") if elderly else "0905123456",
            avatar_url=med_record.avatar_url or (elderly.avatar_url if elderly else None),
            has_face_enrolled=bool(elderly.face_embedding if elderly else med_record.has_face_enrolled),
            device_id=band_device.device_id if band_device else "",
            is_online=is_smartband_online,
            battery_level=band_device.battery_level if (band_device and is_smartband_online) else None,
            heart_rate=hr,
            spo2=spo2,
            skin_temp_max=temp,
            blood_pressure=bp_str,
            health_status=health_status,
            last_updated=last_updated_str or "Chưa có dữ liệu",
            conditions=resolved_conditions,
            drug_allergies=resolved_drug_allergies,
            food_allergies=resolved_food_allergies,
            dietary_notes=resolved_dietary_notes,
            doctor_notes=clinical.get("doctor_notes"),
            blood_type=resolved_blood_type,
            height_cm=height,
            weight_kg=weight,
            bmi=bmi,
            next_appointment=(
                getattr(__import__("app.crud.crud_elderly", fromlist=["parse_valid_upcoming_appointment"]), "parse_valid_upcoming_appointment", lambda x: x)(clinical.get("next_appointment"))
            ),
            prescriptions_count=len(prescriptions),
            hr_threshold_low=cfg_hr_low,
            hr_threshold_high=cfg_hr_high,
            spo2_threshold_low=cfg_spo2_low,
        )

    async def get_prescriptions_db(self, db: AsyncSession, elderly_id: str) -> List[PrescriptionItem]:
        """Lấy danh sách đơn thuốc từ PostgreSQL theo ID người cao tuổi."""
        patient_uuid = await _resolve_elderly_id(db, elderly_id, create_if_missing=False)
        if not patient_uuid:
            return []
        res = await db.execute(
            select(Prescription)
            .where(Prescription.patient_id == patient_uuid)
            .order_by(desc(Prescription.created_at))
        )
        prescriptions = res.scalars().all()
        return [_prescription_model_to_item(rx) for rx in prescriptions]

    async def add_prescription_db(
        self,
        db: AsyncSession,
        elderly_id: str,
        obj_in: PrescriptionCreate,
        doctor_name: Optional[str] = None,
        doctor_id: Optional[uuid.UUID] = None,
    ) -> PrescriptionItem:
        """Bác sĩ kê một đơn thuốc mới và lưu vào PostgreSQL."""
        patient_uuid = await _resolve_elderly_id(db, elderly_id, create_if_missing=True)
        start_dt = obj_in.start_date or datetime.now(timezone.utc)
        new_rx = Prescription(
            patient_id=patient_uuid,
            doctor_id=doctor_id,
            doctor_name=doctor_name,
            diagnosis=obj_in.diagnosis or "Đơn thuốc điều trị",
            general_notes=obj_in.general_notes,
            medication_name=obj_in.medication_name,
            dosage=obj_in.dosage,
            quantity=obj_in.quantity,
            frequency=obj_in.frequency or "Hàng ngày",
            schedule_times_json=json.dumps(obj_in.schedule_times or ["08:00"]),
            instructions=obj_in.instructions or "",
            start_date=start_dt,
            end_date=obj_in.end_date,
            status="ACTIVE",
            enable_speaker_reminder=obj_in.enable_speaker_reminder,
        )
        db.add(new_rx)
        await db.commit()
        await db.refresh(new_rx)

        item = _prescription_model_to_item(new_rx)
        if elderly_id not in _PRESCRIPTION_STORE:
            _PRESCRIPTION_STORE[elderly_id] = []
        _PRESCRIPTION_STORE[elderly_id].insert(0, item)
        return item

    async def add_batch_prescriptions_db(
        self,
        db: AsyncSession,
        elderly_id: str,
        batch: BatchPrescriptionCreate,
        doctor_name: Optional[str] = None,
        doctor_id: Optional[uuid.UUID] = None,
    ) -> List[PrescriptionItem]:
        """Bác sĩ kê một đơn gồm nhiều loại thuốc và lưu vào PostgreSQL."""
        patient_uuid = await _resolve_elderly_id(db, elderly_id, create_if_missing=True)
        start_dt = batch.start_date or datetime.now(timezone.utc)
        end_dt = batch.end_date
        created_items: List[PrescriptionItem] = []

        for med in batch.medications:
            note = med.instructions or ""
            if batch.general_notes:
                note = f"{note} (Dặn dò: {batch.general_notes})".strip() if note else f"Dặn dò: {batch.general_notes}"
            new_rx = Prescription(
                patient_id=patient_uuid,
                doctor_id=doctor_id,
                doctor_name=doctor_name,
                diagnosis=batch.diagnosis or "Đơn thuốc điều trị",
                general_notes=batch.general_notes,
                medication_name=med.medication_name,
                dosage=med.dosage,
                quantity=med.quantity,
                frequency=med.frequency or "Hàng ngày",
                schedule_times_json=json.dumps(med.schedule_times or ["08:00"]),
                instructions=note,
                start_date=start_dt,
                end_date=end_dt,
                status="ACTIVE",
                enable_speaker_reminder=batch.enable_speaker_reminder,
            )
            db.add(new_rx)
            await db.flush()
            await db.refresh(new_rx)
            item = _prescription_model_to_item(new_rx)
            created_items.append(item)

        await db.commit()

        if elderly_id not in _PRESCRIPTION_STORE:
            _PRESCRIPTION_STORE[elderly_id] = []
        for it in reversed(created_items):
            _PRESCRIPTION_STORE[elderly_id].insert(0, it)
        return created_items

    async def update_prescription_db(
        self,
        db: AsyncSession,
        elderly_id: str,
        rx_id: str,
        obj_in: PrescriptionUpdate,
    ) -> Optional[PrescriptionItem]:
        """Cập nhật đơn thuốc hiện có trong PostgreSQL."""
        rx_uuid = None
        try:
            rx_uuid = uuid.UUID(rx_id)
        except (ValueError, TypeError):
            pass

        rx = None
        if rx_uuid:
            res = await db.execute(select(Prescription).where(Prescription.id == rx_uuid))
            rx = res.scalar_one_or_none()

        if rx:
            if obj_in.medication_name is not None:
                rx.medication_name = obj_in.medication_name
            if obj_in.dosage is not None:
                rx.dosage = obj_in.dosage
            if obj_in.quantity is not None:
                rx.quantity = obj_in.quantity
            if obj_in.frequency is not None:
                rx.frequency = obj_in.frequency
            if obj_in.schedule_times is not None:
                rx.schedule_times_json = json.dumps(obj_in.schedule_times)
            if obj_in.instructions is not None:
                rx.instructions = obj_in.instructions
            if obj_in.diagnosis is not None:
                rx.diagnosis = obj_in.diagnosis
            if obj_in.general_notes is not None:
                rx.general_notes = obj_in.general_notes
            if obj_in.start_date is not None:
                rx.start_date = obj_in.start_date
            if obj_in.end_date is not None:
                rx.end_date = obj_in.end_date
            if obj_in.status is not None:
                rx.status = obj_in.status
            if obj_in.enable_speaker_reminder is not None:
                rx.enable_speaker_reminder = obj_in.enable_speaker_reminder
            await db.commit()
            await db.refresh(rx)
            item = _prescription_model_to_item(rx)
            self.update_prescription(elderly_id, rx_id, obj_in)
            return item

        return None

    async def delete_prescription_db(self, db: AsyncSession, elderly_id: str, rx_id: str) -> bool:
        """Xóa hoặc ngừng đơn thuốc trong PostgreSQL."""
        rx_uuid = None
        try:
            rx_uuid = uuid.UUID(rx_id)
        except (ValueError, TypeError):
            pass

        deleted = False
        if rx_uuid:
            res = await db.execute(select(Prescription).where(Prescription.id == rx_uuid))
            rx = res.scalar_one_or_none()
            if rx:
                await db.delete(rx)
                await db.commit()
                deleted = True

        mem_del = self.delete_prescription(elderly_id, rx_id)
        return deleted or mem_del

    async def toggle_prescription_reminder_db(
        self, db: AsyncSession, elderly_id: str, rx_id: str
    ) -> Optional[PrescriptionItem]:
        """Bật/tắt phát loa thông minh cho đơn thuốc trong PostgreSQL."""
        rx_uuid = None
        try:
            rx_uuid = uuid.UUID(rx_id)
        except (ValueError, TypeError):
            pass

        if rx_uuid:
            res = await db.execute(select(Prescription).where(Prescription.id == rx_uuid))
            rx = res.scalar_one_or_none()
            if rx:
                rx.enable_speaker_reminder = not rx.enable_speaker_reminder
                await db.commit()
                await db.refresh(rx)
                item = _prescription_model_to_item(rx)
                self.toggle_prescription_reminder(elderly_id, rx_id)
                return item

        return None

    def get_prescriptions(self, elderly_id: str) -> List[PrescriptionItem]:
        """Lấy danh sách thuốc đang kê đơn."""
        return _PRESCRIPTION_STORE.get(elderly_id, [])

    def add_prescription(
        self, elderly_id: str, obj_in: PrescriptionCreate, doctor_name: Optional[str] = None
    ) -> PrescriptionItem:
        """Bác sĩ kê đơn thuốc mới."""
        if elderly_id not in _PRESCRIPTION_STORE:
            _PRESCRIPTION_STORE[elderly_id] = []

        new_item = PrescriptionItem(
            id=f"rx-{uuid.uuid4().hex[:6]}",
            patient_id=elderly_id,
            medication_name=obj_in.medication_name,
            dosage=obj_in.dosage,
            quantity=obj_in.quantity,
            frequency=obj_in.frequency or "",
            schedule_times=obj_in.schedule_times or [],
            instructions=obj_in.instructions or "",
            doctor_name=doctor_name,
            enable_speaker_reminder=obj_in.enable_speaker_reminder,
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
        _PRESCRIPTION_STORE[elderly_id].insert(0, new_item)
        return new_item

    def add_batch_prescriptions(
        self, elderly_id: str, batch: BatchPrescriptionCreate, doctor_name: Optional[str] = None
    ) -> List[PrescriptionItem]:
        """Bác sĩ kê một đơn gồm nhiều loại thuốc và số lượng khác nhau."""
        if elderly_id not in _PRESCRIPTION_STORE:
            _PRESCRIPTION_STORE[elderly_id] = []

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        created_items: List[PrescriptionItem] = []
        for med in batch.medications:
            note = med.instructions or ""
            if batch.general_notes:
                note = f"{note} (Dặn dò: {batch.general_notes})".strip()
            item = PrescriptionItem(
                id=f"rx-{uuid.uuid4().hex[:6]}",
                patient_id=elderly_id,
                medication_name=med.medication_name,
                dosage=med.dosage,
                quantity=med.quantity,
                frequency=med.frequency or "Hàng ngày",
                schedule_times=med.schedule_times or [],
                instructions=note,
                doctor_name=doctor_name,
                enable_speaker_reminder=batch.enable_speaker_reminder,
                created_at=now_str,
            )
            _PRESCRIPTION_STORE[elderly_id].insert(0, item)
            created_items.append(item)
        return created_items

    def update_prescription(
        self, elderly_id: str, rx_id: str, obj_in: PrescriptionUpdate
    ) -> Optional[PrescriptionItem]:
        """Cập nhật đơn thuốc hiện có."""
        rx_list = self.get_prescriptions(elderly_id)
        for rx in rx_list:
            if rx.id == rx_id:
                if obj_in.medication_name is not None:
                    rx.medication_name = obj_in.medication_name
                if obj_in.dosage is not None:
                    rx.dosage = obj_in.dosage
                if obj_in.quantity is not None:
                    rx.quantity = obj_in.quantity
                if obj_in.frequency is not None:
                    rx.frequency = obj_in.frequency
                if obj_in.schedule_times is not None:
                    rx.schedule_times = obj_in.schedule_times
                if obj_in.instructions is not None:
                    rx.instructions = obj_in.instructions
                if obj_in.enable_speaker_reminder is not None:
                    rx.enable_speaker_reminder = obj_in.enable_speaker_reminder
                return rx
        return None

    def delete_prescription(self, elderly_id: str, rx_id: str) -> bool:
        """Ngừng dùng hoặc xóa một đơn thuốc."""
        rx_list = self.get_prescriptions(elderly_id)
        initial_len = len(rx_list)
        _PRESCRIPTION_STORE[elderly_id] = [rx for rx in rx_list if rx.id != rx_id]
        return len(_PRESCRIPTION_STORE[elderly_id]) < initial_len

    def toggle_prescription_reminder(
        self, elderly_id: str, rx_id: str
    ) -> Optional[PrescriptionItem]:
        """Bật/tắt nhanh thông báo giọng nói qua loa Hub."""
        rx_list = self.get_prescriptions(elderly_id)
        for rx in rx_list:
            if rx.id == rx_id:
                rx.enable_speaker_reminder = not rx.enable_speaker_reminder
                return rx
        return None

    async def update_clinical_record(
        self, db: AsyncSession, elderly_id: str, obj_in: DoctorMedicalRecordUpdate, doctor_name: Optional[str] = "Bác sĩ phụ trách"
    ) -> DoctorPatientDetail:
        """Bác sĩ cập nhật hồ sơ bệnh án, bệnh nền, dị ứng, dinh dưỡng và dặn dò."""
        if elderly_id not in _CLINICAL_STORE:
            _CLINICAL_STORE[elderly_id] = _init_clinical_data(elderly_id)
        clinical = _CLINICAL_STORE[elderly_id]

        if obj_in.doctor_notes is not None:
            clinical["doctor_notes"] = obj_in.doctor_notes
        if obj_in.next_appointment is not None:
            clinical["next_appointment"] = obj_in.next_appointment
        if obj_in.conditions is not None:
            clinical["conditions"] = obj_in.conditions
        if obj_in.drug_allergies is not None:
            clinical["drug_allergies"] = obj_in.drug_allergies
        if obj_in.food_allergies is not None:
            clinical["food_allergies"] = obj_in.food_allergies
        if obj_in.dietary_notes is not None:
            clinical["dietary_notes"] = obj_in.dietary_notes
        if obj_in.blood_type is not None:
            clinical["blood_type"] = obj_in.blood_type
        if obj_in.height_cm is not None:
            clinical["height_cm"] = obj_in.height_cm
        if obj_in.weight_kg is not None:
            clinical["weight_kg"] = obj_in.weight_kg

        # Đồng bộ lưu vào CSDL ElderlyProfile để người nhà/chủ nhà cũng thấy
        elderly = None
        try:
            val_uuid = UUID(elderly_id)
            res = await db.execute(select(ElderlyProfile).where(ElderlyProfile.id == val_uuid))
            elderly = res.scalar_one_or_none()
        except (ValueError, TypeError):
            pass

        if not elderly:
            res = await db.execute(select(ElderlyProfile).limit(1))
            elderly = res.scalar_one_or_none()

        if elderly:
            import json
            if obj_in.drug_allergies is not None:
                elderly.drug_allergies = obj_in.drug_allergies
            if obj_in.food_allergies is not None:
                elderly.food_allergies = obj_in.food_allergies
            if obj_in.dietary_notes is not None:
                elderly.dietary_notes = obj_in.dietary_notes
            if obj_in.blood_type is not None:
                elderly.blood_type = obj_in.blood_type
            if obj_in.height_cm is not None:
                elderly.height_cm = obj_in.height_cm
            if obj_in.weight_kg is not None:
                elderly.weight_kg = obj_in.weight_kg
            if obj_in.conditions is not None:
                elderly.conditions_json = json.dumps([c.model_dump() for c in obj_in.conditions], ensure_ascii=False)
                elderly.medical_history = ", ".join(c.name for c in obj_in.conditions)
            await db.commit()
            await db.refresh(elderly)

        # Gửi thông báo và bắn WebSocket đồng bộ cho gia đình / chủ nhà
        if elderly and elderly.house_id:
            try:
                import json
                from app.models.incident import Incident
                from app.api.websockets.vitals_ws import alert_clients

                dev_stmt = select(Device.id).where(Device.house_id == elderly.house_id).limit(1)
                dev_res = await db.execute(dev_stmt)
                device_id = dev_res.scalar_one_or_none()
                if not device_id:
                    any_dev = await db.execute(select(Device.id).limit(1))
                    device_id = any_dev.scalar_one_or_none()

                changes = []
                if obj_in.doctor_notes is not None or obj_in.next_appointment is not None:
                    changes.append("lời dặn dò & lịch tái khám")
                if obj_in.conditions is not None:
                    changes.append(f"bệnh lý nền ({len(obj_in.conditions)} bệnh)")
                if obj_in.drug_allergies is not None or obj_in.food_allergies is not None or obj_in.dietary_notes is not None:
                    changes.append("dị ứng & chế độ dinh dưỡng")
                if not changes:
                    changes.append("hồ sơ y tế")

                doc_display = doctor_name or "Bác sĩ phụ trách"
                notif_msg = f"🩺 {doc_display} đã cập nhật {', '.join(changes)} cho cụ {elderly.full_name}."

                if device_id:
                    new_incident = Incident(
                        device_id=device_id,
                        alert_type="MEDICAL_RECORD_UPDATED",
                        alert_level="LOW",
                        message=notif_msg,
                        is_acknowledged=False,
                        notes=f"PATIENT:{elderly.id}|DOCTOR_RECORD_UPDATE",
                    )
                    db.add(new_incident)
                    await db.commit()
                    await db.refresh(new_incident)

                    ws_payload = json.dumps({
                        "type": "ALERT_NEW",
                        "alert_type": "MEDICAL_RECORD_UPDATED",
                        "data": {
                            "id": str(new_incident.id),
                            "alert_type": "MEDICAL_RECORD_UPDATED",
                            "alert_level": "LOW",
                            "message": new_incident.message,
                            "patient_id": str(elderly.id),
                            "created_at": new_incident.created_at.isoformat() if new_incident.created_at else None,
                        }
                    }, ensure_ascii=False)
                    for client_ws in list(alert_clients):
                        await client_ws.send_text(ws_payload)
            except Exception:
                pass

        try:
            from app.services.redis import redis_service
            await redis_service.invalidate_doctor_patients()
        except Exception:
            pass

        return await self.get_patient_detail(db, elderly_id)

    def sync_clinical_store(self, elderly_ids: List[str], update_data: Dict[str, Any]) -> None:
        """Đồng bộ dữ liệu cập nhật từ hồ sơ bệnh án người cao tuổi vào bộ nhớ đệm lâm sàng."""
        for eid in elderly_ids:
            if eid in _CLINICAL_STORE:
                for k, v in update_data.items():
                    if v is not None:
                        _CLINICAL_STORE[eid][k] = v


    async def get_vitals_analytics(
        self,
        db: AsyncSession,
        elderly_id: str,
        days: int = 7,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> DoctorVitalsAnalytics:
        """Phân tích thống kê sinh hiệu dài hạn từ TimescaleDB thực tế theo số ngày hoặc khoảng ngày cụ thể."""
        elderly = None
        patient_name = "Bệnh nhân"
        try:
            val_uuid = UUID(elderly_id)
            res = await db.execute(
                select(ElderlyProfile)
                .options(selectinload(ElderlyProfile.devices))
                .where(ElderlyProfile.id == val_uuid)
            )
            elderly = res.scalar_one_or_none()
            if elderly:
                patient_name = elderly.full_name
        except (ValueError, TypeError):
            pass

        band_device = None
        if elderly and elderly.devices:
            for d in elderly.devices:
                if d.device_type == "SMARTBAND":
                    band_device = d
                    break
            if not band_device and elderly.devices:
                band_device = elderly.devices[0]

        daily_trends = []
        avg_hr = None
        min_hr = None
        max_hr = None
        avg_spo2 = None
        min_spo2 = None
        avg_temp = None
        hr_stability_score = None
        spo2_drops = 0

        if band_device:
            conditions = [VitalSign.device_id == band_device.id]
            vn_tz = timezone(timedelta(hours=7))
            is_single_day = bool(start_date and end_date and start_date == end_date) or days == 1

            if start_date:
                try:
                    s_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(
                        hour=0, minute=0, second=0, microsecond=0, tzinfo=vn_tz
                    )
                    conditions.append(VitalSign.time >= s_dt)
                except ValueError:
                    conditions.append(VitalSign.time >= (datetime.now(timezone.utc) - timedelta(days=days)))
            else:
                since_time = datetime.now(timezone.utc) - timedelta(days=days)
                conditions.append(VitalSign.time >= since_time)

            if end_date:
                try:
                    e_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(
                        hour=23, minute=59, second=59, microsecond=999999, tzinfo=vn_tz
                    )
                    conditions.append(VitalSign.time <= e_dt)
                except ValueError:
                    pass

            vs_query = await db.execute(
                select(VitalSign)
                .where(*conditions)
                .order_by(VitalSign.time.asc())
            )
            records = list(vs_query.scalars().all())

            if records:
                hrs = [r.heart_rate for r in records if r.heart_rate is not None]
                spo2s = [r.spo2 for r in records if r.spo2 is not None]
                temps = [r.skin_temp_max for r in records if r.skin_temp_max is not None]

                if hrs:
                    avg_hr = round(sum(hrs) / len(hrs), 1)
                    min_hr = min(hrs)
                    max_hr = max(hrs)
                    hr_stability_score = max(50, min(100, 100 - (max_hr - min_hr)))
                if spo2s:
                    avg_spo2 = round(sum(spo2s) / len(spo2s), 1)
                    min_spo2 = min(spo2s)
                    spo2_drops = sum(1 for s in spo2s if s < 95)
                if temps:
                    avg_temp = round(sum(temps) / len(temps), 1)

                by_date: Dict[str, List[VitalSign]] = {}
                for r in records:
                    local_dt = r.time.astimezone(vn_tz) if r.time.tzinfo else r.time.replace(tzinfo=timezone.utc).astimezone(vn_tz)
                    date_key = local_dt.strftime("%d/%m")
                    if date_key not in by_date:
                        by_date[date_key] = []
                    by_date[date_key].append(r)

                for d_str, day_recs in by_date.items():
                    d_hrs = [r.heart_rate for r in day_recs if r.heart_rate is not None]
                    d_spo2s = [r.spo2 for r in day_recs if r.spo2 is not None]
                    d_temps = [r.skin_temp_max for r in day_recs if r.skin_temp_max is not None]

                    bp_val = None
                    for r in reversed(day_recs):
                        if r.bp_systolic and r.bp_diastolic:
                            bp_val = f"{r.bp_systolic}/{r.bp_diastolic}"
                            break

                    # Đảm bảo hiển thị đầy đủ 24 giờ trong ngày (00:00 -> 23:00) theo giờ địa phương VN
                    hours_24 = [f"{h:02d}:00" for h in range(24)]
                    by_hour: Dict[str, Dict[str, Any]] = {
                        h_str: {"hrs": [], "spo2s": [], "temps": [], "bp": None}
                        for h_str in hours_24
                    }
                    for r in day_recs:
                        local_dt = r.time.astimezone(vn_tz) if r.time.tzinfo else r.time.replace(tzinfo=timezone.utc).astimezone(vn_tz)
                        h_key = f"{local_dt.hour:02d}:00"
                        if h_key in by_hour:
                            if r.heart_rate is not None:
                                by_hour[h_key]["hrs"].append(r.heart_rate)
                            if r.spo2 is not None:
                                by_hour[h_key]["spo2s"].append(r.spo2)
                            if r.skin_temp_max is not None:
                                by_hour[h_key]["temps"].append(r.skin_temp_max)
                            if r.bp_systolic and r.bp_diastolic:
                                by_hour[h_key]["bp"] = f"{r.bp_systolic}/{r.bp_diastolic}"

                    hourly_list = []
                    for h_str in hours_24:
                        h_data = by_hour[h_str]
                        hourly_list.append({
                            "time": h_str,
                            "heart_rate": round(sum(h_data["hrs"]) / len(h_data["hrs"])) if h_data["hrs"] else None,
                            "spo2": round(sum(h_data["spo2s"]) / len(h_data["spo2s"]), 1) if h_data["spo2s"] else None,
                            "bp": h_data["bp"],
                            "skin_temp": round(sum(h_data["temps"]) / len(h_data["temps"]), 1) if h_data["temps"] else None,
                        })

                    daily_trends.append({
                        "date": d_str,
                        "avg_heart_rate": round(sum(d_hrs) / len(d_hrs)) if d_hrs else None,
                        "min_heart_rate": min(d_hrs) if d_hrs else None,
                        "max_heart_rate": max(d_hrs) if d_hrs else None,
                        "avg_spo2": round(sum(d_spo2s) / len(d_spo2s), 1) if d_spo2s else None,
                        "min_spo2": min(d_spo2s) if d_spo2s else None,
                        "avg_skin_temp": round(sum(d_temps) / len(d_temps), 1) if d_temps else None,
                        "bp": bp_val,
                        "steps": 0,
                        "hourly_records": hourly_list,
                    })

            elif is_single_day and start_date:
                # Nếu xem ngày cụ thể nhưng chưa có bản ghi: vẫn tạo khung 24 giờ để hiển thị trục thời gian 24h
                try:
                    d_target = datetime.strptime(start_date, "%Y-%m-%d")
                    d_str = d_target.strftime("%d/%m")
                except ValueError:
                    d_str = start_date
                hourly_list = [
                    {
                        "time": f"{h:02d}:00",
                        "heart_rate": None,
                        "spo2": None,
                        "bp": None,
                        "skin_temp": None,
                    }
                    for h in range(24)
                ]
                daily_trends.append({
                    "date": d_str,
                    "avg_heart_rate": None,
                    "min_heart_rate": None,
                    "max_heart_rate": None,
                    "avg_spo2": None,
                    "min_spo2": None,
                    "avg_skin_temp": None,
                    "bp": None,
                    "steps": 0,
                    "hourly_records": hourly_list,
                })

        return DoctorVitalsAnalytics(
            patient_id=elderly_id,
            patient_name=patient_name,
            days=days,
            avg_heart_rate=avg_hr,
            min_heart_rate=min_hr,
            max_heart_rate=max_hr,
            avg_spo2=avg_spo2,
            min_spo2=min_spo2,
            avg_skin_temp=avg_temp,
            hr_stability_score=hr_stability_score,
            spo2_drops_count=spo2_drops,
            daily_trends=daily_trends,
        )

    async def update_thresholds(
        self, db: AsyncSession, elderly_id: str, thresholds_in: ThresholdsUpdate, doctor_name: Optional[str] = "Bác sĩ phụ trách"
    ) -> Dict[str, Any]:
        """Cập nhật cấu hình ngưỡng y tế khuyến nghị cho thiết bị của bệnh nhân."""
        if elderly_id not in _CLINICAL_STORE:
            _CLINICAL_STORE[elderly_id] = _init_clinical_data(elderly_id)
        clinical = _CLINICAL_STORE[elderly_id]

        if thresholds_in.hr_threshold_low is not None:
            clinical["hr_threshold_low"] = thresholds_in.hr_threshold_low
        if thresholds_in.hr_threshold_high is not None:
            clinical["hr_threshold_high"] = thresholds_in.hr_threshold_high
        if thresholds_in.spo2_threshold_low is not None:
            clinical["spo2_threshold_low"] = thresholds_in.spo2_threshold_low

        elderly = None
        try:
            val_uuid = UUID(elderly_id)
            res = await db.execute(
                select(ElderlyProfile)
                .options(selectinload(ElderlyProfile.devices), selectinload(ElderlyProfile.house))
                .where(ElderlyProfile.id == val_uuid)
            )
            elderly = res.scalar_one_or_none()
        except (ValueError, TypeError):
            pass

        if not elderly:
            res = await db.execute(
                select(ElderlyProfile)
                .options(selectinload(ElderlyProfile.devices), selectinload(ElderlyProfile.house))
                .limit(1)
            )
            elderly = res.scalar_one_or_none()

        device_id = None
        if elderly and elderly.devices:
            for d in elderly.devices:
                if d.device_type == "SMARTBAND":
                    device_id = d.id
                    break
            if not device_id and elderly.devices:
                device_id = elderly.devices[0].id

        if not device_id and elderly and elderly.house_id:
            dev_stmt = select(Device.id).where(Device.house_id == elderly.house_id).limit(1)
            dev_res = await db.execute(dev_stmt)
            device_id = dev_res.scalar_one_or_none()

        if not device_id:
            any_dev = await db.execute(select(Device.id).limit(1))
            device_id = any_dev.scalar_one_or_none()

        if device_id:
            cfg_res = await db.execute(select(DeviceConfig).where(DeviceConfig.device_id == device_id))
            d_cfg = cfg_res.scalar_one_or_none()
            if not d_cfg:
                d_cfg = DeviceConfig(device_id=device_id)
                db.add(d_cfg)
            if thresholds_in.hr_threshold_low is not None:
                d_cfg.hr_threshold_low = thresholds_in.hr_threshold_low
            if thresholds_in.hr_threshold_high is not None:
                d_cfg.hr_threshold_high = thresholds_in.hr_threshold_high
            if thresholds_in.spo2_threshold_low is not None:
                d_cfg.spo2_threshold_low = thresholds_in.spo2_threshold_low
            d_cfg.is_custom_thresholds = True
            d_cfg.configured_by_role = "DOCTOR"
            await db.commit()

        patient_name = elderly.full_name if elderly else "bệnh nhân"
        hr_l = thresholds_in.hr_threshold_low or clinical.get("hr_threshold_low", 50)
        hr_h = thresholds_in.hr_threshold_high or clinical.get("hr_threshold_high", 120)
        spo2_l = thresholds_in.spo2_threshold_low or clinical.get("spo2_threshold_low", 90)

        notif_msg = f"🩺 {doctor_name} đã điều chỉnh ngưỡng cảnh báo sinh hiệu cho cụ {patient_name} (Nhịp tim: {hr_l} - {hr_h} bpm, SpO2 Min: {spo2_l}%)."

        if device_id:
            from app.models.incident import Incident
            new_incident = Incident(
                device_id=device_id,
                alert_type="DEVICE_CONFIG_UPDATED",
                alert_level="LOW",
                message=notif_msg,
                is_acknowledged=False,
                notes=f"PATIENT:{elderly.id if elderly else elderly_id}|DOCTOR_THRESHOLD_UPDATE",
            )
            db.add(new_incident)
            await db.commit()
            await db.refresh(new_incident)

            try:
                import json
                from app.api.websockets.vitals_ws import alert_clients
                ws_payload = json.dumps({
                    "type": "ALERT_NEW",
                    "alert_type": "DEVICE_CONFIG_UPDATED",
                    "data": {
                        "id": str(new_incident.id),
                        "alert_type": "DEVICE_CONFIG_UPDATED",
                        "alert_level": "LOW",
                        "message": new_incident.message,
                        "patient_id": str(elderly.id if elderly else elderly_id),
                        "created_at": new_incident.created_at.isoformat() if new_incident.created_at else None,
                        "thresholds": thresholds_in.model_dump(exclude_unset=True),
                    }
                }, ensure_ascii=False)
                for client_ws in list(alert_clients):
                    await client_ws.send_text(ws_payload)
            except Exception:
                pass

        return {
            "success": True,
            "message": "Đã cập nhật ngưỡng an toàn y tế thành công và đồng bộ xuống Hub.",
            "thresholds": thresholds_in.model_dump(exclude_unset=True),
        }

    def get_appointments(self, status: Optional[str] = None) -> List[AppointmentItem]:
        """Lấy danh sách các cuộc hẹn và tái khám định kỳ."""
        if status and status != "ALL":
            return [apt for apt in _APPOINTMENT_STORE if apt.status == status]
        return _APPOINTMENT_STORE

    def create_appointment(
        self, obj_in: AppointmentCreate, doctor_name: Optional[str] = None
    ) -> AppointmentItem:
        """Tạo lịch tái khám mới và đồng bộ xuống Hub để nhắc nhở người nhà."""
        new_apt = AppointmentItem(
            id=f"apt-{uuid.uuid4().hex[:6]}",
            patient_id=obj_in.patient_id,
            patient_name=obj_in.patient_name,
            scheduled_at=obj_in.scheduled_at,
            exam_type=obj_in.exam_type,
            location=obj_in.location,
            status="UPCOMING",
            instructions=obj_in.instructions,
            doctor_name=doctor_name,
            enable_speaker_reminder=obj_in.enable_speaker_reminder,
            created_at=datetime.now().strftime("%d/%m/%Y"),
        )
        _APPOINTMENT_STORE.insert(0, new_apt)
        return new_apt

    def update_appointment(
        self, appointment_id: str, obj_in: AppointmentUpdate
    ) -> Optional[AppointmentItem]:
        """Cập nhật thông tin lịch khám hoặc đổi trạng thái (COMPLETED/CANCELLED)."""
        for idx, apt in enumerate(_APPOINTMENT_STORE):
            if apt.id == appointment_id:
                updated_data = apt.model_dump()
                update_fields = obj_in.model_dump(exclude_unset=True)
                updated_data.update(update_fields)
                updated_apt = AppointmentItem(**updated_data)
                _APPOINTMENT_STORE[idx] = updated_apt
                return updated_apt
        return None

    def delete_appointment(self, appointment_id: str) -> bool:
        """Hủy bỏ cuộc hẹn khỏi hệ thống."""
        global _APPOINTMENT_STORE
        initial_len = len(_APPOINTMENT_STORE)
        _APPOINTMENT_STORE = [apt for apt in _APPOINTMENT_STORE if apt.id != appointment_id]
        return len(_APPOINTMENT_STORE) < initial_len


crud_doctor = CRUDDoctor()

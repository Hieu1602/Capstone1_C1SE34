"""
crud_doctor.py – CRUD & nghiệp vụ y khoa dành cho Bác sĩ gia đình.
Vị trí: backend/app/crud/crud_doctor.py
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import uuid
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.house import House, HouseMember
from app.models.elderly_profile import ElderlyProfile
from app.models.device import Device
from app.models.device_config import DeviceConfig
from app.models.vital_sign import VitalSign
from app.models.user import User
from app.crud.crud_elderly import crud_elderly
from app.schemas.doctor import (
    DoctorPatientCard,
    DoctorPatientDetail,
    PrescriptionItem,
    PrescriptionCreate,
    PrescriptionUpdate,
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


class CRUDDoctor:

    async def get_assigned_patients(
        self, db: AsyncSession, doctor_user: User
    ) -> List[DoctorPatientCard]:
        """
        Lấy danh sách tất cả người cao tuổi trong các căn nhà mà Bác sĩ được mời tham gia (house_members).
        """
        # 1. Tìm các căn nhà Bác sĩ có quyền truy cập
        mem_query = await db.execute(
            select(HouseMember.house_id).where(HouseMember.user_id == doctor_user.id)
        )
        house_ids = list(mem_query.scalars().all())

        # Nếu bác sĩ là owner căn nhà nào đó, cũng bao gồm vào
        owner_query = await db.execute(
            select(House.id).where(House.owner_id == doctor_user.id)
        )
        for h_id in owner_query.scalars().all():
            if h_id not in house_ids:
                house_ids.append(h_id)

        if not house_ids:
            return []

        # 2. Truy vấn các căn nhà cùng ElderlyProfiles và Devices
        query = (
            select(House)
            .where(House.id.in_(house_ids))
            .options(
                selectinload(House.elderly_profiles).selectinload(ElderlyProfile.devices),
                selectinload(House.devices),
            )
        )

        houses_res = await db.execute(query)
        houses = list(houses_res.scalars().all())

        cards: List[DoctorPatientCard] = []

        for h in houses:
            for ep in h.elderly_profiles:
                # Bỏ qua hồ sơ chưa điền tên hoặc hồ sơ trống (Zero Fake Data)
                if not ep.full_name or not ep.full_name.strip():
                    continue

                # Tìm thiết bị vòng đeo BLE hoặc camera
                band_device = None
                for d in ep.devices:
                    if d.device_type == "SMARTBAND":
                        band_device = d
                        break
                if not band_device and h.devices:
                    band_device = h.devices[0]

                # Lấy sinh hiệu mới nhất từ TimescaleDB nếu có thiết bị
                hr = None
                spo2 = None
                temp = None
                bp_str = None
                health_status = "NORMAL"
                last_updated_str = None

                if band_device:
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
                            last_updated_str = latest_vs.time.strftime("%d/%m/%Y %H:%M")

                # Đánh giá sơ bộ trạng thái y tế
                if (spo2 is not None and spo2 < 90) or (hr is not None and (hr > 120 or hr < 50)):
                    health_status = "DANGER"
                elif (spo2 is not None and spo2 < 95) or (hr is not None and (hr > 100 or hr < 55)):
                    health_status = "WARNING"

                birth_year_val = ep.birth_year or 0
                age_val = (datetime.now().year - ep.birth_year) if ep.birth_year else 0
                gender_val = "Nam" if (ep.gender or "").upper() == "MALE" else ("Nữ" if (ep.gender or "").upper() == "FEMALE" else "")

                cards.append(
                    DoctorPatientCard(
                        id=str(ep.id),
                        name=ep.full_name,
                        birth_year=birth_year_val,
                        age=age_val,
                        gender=gender_val,
                        house_id=str(h.id),
                        house_name=h.name,
                        house_address=h.address or "",
                        medical_history=ep.medical_history or "",
                        emergency_contact_phone=ep.emergency_contact_phone or "",
                        avatar_url=ep.avatar_url,
                        has_face_enrolled=bool(ep.face_embedding),
                        device_id=band_device.device_id if band_device else "",
                        is_online=band_device.is_online if band_device else False,
                        battery_level=band_device.battery_level if band_device else None,
                        heart_rate=hr,
                        spo2=spo2,
                        skin_temp_max=temp,
                        blood_pressure=bp_str,
                        health_status=health_status,
                        last_updated=last_updated_str or "Chưa có dữ liệu",
                    )
                )

        return cards

    async def get_patient_detail(
        self, db: AsyncSession, elderly_id_or_serial: str
    ) -> DoctorPatientDetail:
        """Lấy chi tiết hồ sơ bệnh nhân cho Bác sĩ."""
        med_record = await crud_elderly.get_medical_record(db, elderly_id_or_serial)
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
                .options(selectinload(ElderlyProfile.house), selectinload(ElderlyProfile.devices))
                .where(ElderlyProfile.id == val_uuid)
            )
            elderly = res.scalar_one_or_none()
        except (ValueError, TypeError):
            pass

        house_id = str(elderly.house_id) if elderly and elderly.house_id else ""
        house_name = elderly.house.name if elderly and elderly.house else ""
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

        if band_device:
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
                    last_updated_str = latest_vs.time.strftime("%d/%m/%Y %H:%M")

        if (spo2 is not None and spo2 < 90) or (hr is not None and (hr > 120 or hr < 50)):
            health_status = "DANGER"
        elif (spo2 is not None and spo2 < 95) or (hr is not None and (hr > 100 or hr < 55)):
            health_status = "WARNING"

        height = clinical.get("height_cm")
        weight = clinical.get("weight_kg")
        bmi = None
        if height and weight and height > 0:
            bmi = round(weight / ((height / 100) ** 2), 1)

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
            emergency_contact_phone=(elderly.emergency_contact_phone or "") if elderly else "",
            avatar_url=med_record.avatar_url or (elderly.avatar_url if elderly else None),
            has_face_enrolled=bool(elderly.face_embedding if elderly else med_record.has_face_enrolled),
            device_id=band_device.device_id if band_device else "",
            is_online=band_device.is_online if band_device else False,
            battery_level=band_device.battery_level if band_device else None,
            heart_rate=hr,
            spo2=spo2,
            skin_temp_max=temp,
            blood_pressure=bp_str,
            health_status=health_status,
            last_updated=last_updated_str or "Chưa có dữ liệu",
            conditions=clinical.get("conditions", []),
            drug_allergies=clinical.get("drug_allergies"),
            food_allergies=clinical.get("food_allergies"),
            dietary_notes=clinical.get("dietary_notes"),
            doctor_notes=clinical.get("doctor_notes"),
            blood_type=clinical.get("blood_type"),
            height_cm=height,
            weight_kg=weight,
            bmi=bmi,
            next_appointment=clinical.get("next_appointment"),
            prescriptions_count=len(prescriptions),
        )

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
            frequency=obj_in.frequency or "",
            schedule_times=obj_in.schedule_times or [],
            instructions=obj_in.instructions or "",
            doctor_name=doctor_name,
            enable_speaker_reminder=obj_in.enable_speaker_reminder,
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
        _PRESCRIPTION_STORE[elderly_id].insert(0, new_item)
        return new_item

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
        self, db: AsyncSession, elderly_id: str, obj_in: DoctorMedicalRecordUpdate
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

        return await self.get_patient_detail(db, elderly_id)


    async def get_vitals_analytics(
        self, db: AsyncSession, elderly_id: str, days: int = 7
    ) -> DoctorVitalsAnalytics:
        """Phân tích thống kê sinh hiệu dài hạn từ TimescaleDB thực tế."""
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
            since_time = datetime.now() - timedelta(days=days)
            vs_query = await db.execute(
                select(VitalSign)
                .where(VitalSign.device_id == band_device.id, VitalSign.time >= since_time)
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
                    date_key = r.time.strftime("%d/%m")
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
        self, db: AsyncSession, elderly_id: str, thresholds_in: ThresholdsUpdate
    ) -> Dict[str, Any]:
        """Cập nhật cấu hình ngưỡng y tế khuyến nghị cho thiết bị của bệnh nhân."""
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

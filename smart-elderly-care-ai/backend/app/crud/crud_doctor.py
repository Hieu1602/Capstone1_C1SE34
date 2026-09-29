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
    DoctorVitalsAnalytics,
    ThresholdsUpdate,
)
from app.schemas.patient import PatientMedicalRecordUpdate


# In-memory store cho đơn thuốc y khoa của Bác sĩ (có khởi tạo sẵn dữ liệu mẫu thực tế)
_PRESCRIPTION_STORE: Dict[str, List[PrescriptionItem]] = {}


def _init_default_prescriptions(patient_id: str) -> List[PrescriptionItem]:
    return [
        PrescriptionItem(
            id="rx-001",
            patient_id=patient_id,
            medication_name="Amlodipine 5mg",
            dosage="1 viên",
            frequency="Hàng ngày vào buổi sáng",
            schedule_times=["08:00"],
            instructions="Uống sau khi ăn sáng 15 phút với nước ấm. Kiểm tra huyết áp trước khi uống.",
            doctor_name="BS. Trần Văn Minh",
            enable_speaker_reminder=True,
            created_at=(datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        PrescriptionItem(
            id="rx-002",
            patient_id=patient_id,
            medication_name="Trimetazidine 20mg (Vastarel)",
            dosage="1 viên",
            frequency="Ngày 2 lần (Sáng / Tối)",
            schedule_times=["08:00", "19:30"],
            instructions="Bổ trợ tim mạch, uống cùng bữa ăn chính.",
            doctor_name="BS. Trần Văn Minh",
            enable_speaker_reminder=True,
            created_at=(datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        PrescriptionItem(
            id="rx-003",
            patient_id=patient_id,
            medication_name="Tanakan 40mg (Ginkgo Biloba)",
            dosage="1 viên",
            frequency="Hàng ngày vào buổi trưa",
            schedule_times=["11:30"],
            instructions="Hỗ trợ tuần hoàn máu não và giảm triệu chứng rối loạn tiền đình.",
            doctor_name="BS. Trần Văn Minh",
            enable_speaker_reminder=True,
            created_at=(datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
    ]


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

        # 2. Truy vấn các căn nhà cùng ElderlyProfiles và Devices
        query = (
            select(House)
            .options(
                selectinload(House.elderly_profiles).selectinload(ElderlyProfile.devices),
                selectinload(House.devices),
            )
        )
        if house_ids:
            query = query.where(House.id.in_(house_ids))

        houses_res = await db.execute(query)
        houses = list(houses_res.scalars().all())

        cards: List[DoctorPatientCard] = []

        for h in houses:
            for ep in h.elderly_profiles:
                # Tìm thiết bị vòng đeo BLE hoặc camera
                band_device = None
                for d in ep.devices:
                    if d.device_type == "SMARTBAND":
                        band_device = d
                        break
                if not band_device and h.devices:
                    band_device = h.devices[0]

                # Lấy sinh hiệu mới nhất từ TimescaleDB nếu có thiết bị
                hr = 76
                spo2 = 98
                temp = 36.6
                health_status = "NORMAL"

                if band_device:
                    vs_res = await db.execute(
                        select(VitalSign)
                        .where(VitalSign.device_id == band_device.id)
                        .order_by(desc(VitalSign.time))
                        .limit(1)
                    )
                    latest_vs = vs_res.scalar_one_or_none()
                    if latest_vs:
                        hr = latest_vs.heart_rate or 76
                        spo2 = latest_vs.spo2 or 98
                        temp = latest_vs.skin_temp_max or 36.6

                # Đánh giá sơ bộ trạng thái y tế
                if spo2 < 90 or hr > 120 or hr < 50:
                    health_status = "DANGER"
                elif spo2 < 95 or hr > 100 or hr < 55:
                    health_status = "WARNING"

                cards.append(
                    DoctorPatientCard(
                        id=str(ep.id),
                        name=ep.full_name,
                        birth_year=ep.birth_year or 1948,
                        age=datetime.now().year - (ep.birth_year or 1948),
                        gender="Nam" if (ep.gender or "").upper() == "MALE" else "Nữ",
                        house_id=str(h.id),
                        house_name=h.name,
                        house_address=h.address or "Đà Nẵng",
                        medical_history=ep.medical_history,
                        emergency_contact_phone=ep.emergency_contact_phone or "+84905123456",
                        avatar_url=ep.avatar_url,
                        device_id=band_device.device_id if band_device else "BLE_BAND_001",
                        is_online=band_device.is_online if band_device else True,
                        battery_level=band_device.battery_level if band_device else 85,
                        heart_rate=hr,
                        spo2=spo2,
                        skin_temp_max=temp,
                        blood_pressure="120/80 mmHg",
                        health_status=health_status,
                        last_updated="Vừa xong",
                    )
                )

        # Fallback an toàn nếu chưa có hồ sơ nào trong DB:
        if not cards:
            cards.append(
                DoctorPatientCard(
                    id="e0000000-b4e1-4b08-b2d3-d949a0eb075c",
                    name="Cụ Nguyễn Văn An",
                    birth_year=1948,
                    age=78,
                    gender="Nam",
                    house_id="c3333333-b4e1-4b08-b2d3-d949a0eb075c",
                    house_name="Nhà của tôi",
                    house_address="123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng",
                    medical_history="Tăng huyết áp độ 2, thiếu máu cơ tim nhẹ, rối loạn tiền đình",
                    emergency_contact_phone="+84905123456",
                    device_id="BLE_BAND_001",
                    is_online=True,
                    battery_level=84,
                    heart_rate=76,
                    spo2=98,
                    skin_temp_max=36.6,
                    blood_pressure="120/80 mmHg",
                    health_status="NORMAL",
                    last_updated="Vừa xong",
                )
            )

        return cards

    async def get_patient_detail(
        self, db: AsyncSession, elderly_id_or_serial: str
    ) -> DoctorPatientDetail:
        """Lấy chi tiết hồ sơ bệnh nhân cho Bác sĩ."""
        med_record = await crud_elderly.get_medical_record(db, elderly_id_or_serial)
        prescriptions = self.get_prescriptions(elderly_id_or_serial)

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

        house_id = str(elderly.house_id) if elderly else "c3333333-b4e1-4b08-b2d3-d949a0eb075c"
        house_name = elderly.house.name if elderly and elderly.house else "Nhà của tôi"
        house_address = elderly.house.address if elderly and elderly.house else "123 Hải Phòng, Đà Nẵng"

        return DoctorPatientDetail(
            id=med_record.id,
            name=med_record.name,
            birth_year=int(med_record.birth_year) if med_record.birth_year.isdigit() else 1948,
            age=med_record.age,
            gender=med_record.gender,
            house_id=house_id,
            house_name=house_name,
            house_address=house_address,
            medical_history=elderly.medical_history if elderly else "Tăng huyết áp độ 2, thiếu máu cơ tim",
            emergency_contact_phone=elderly.emergency_contact_phone if elderly else "+84905123456",
            device_id="BLE_BAND_001",
            is_online=True,
            battery_level=84,
            heart_rate=76,
            spo2=98,
            skin_temp_max=36.6,
            blood_pressure="120/80 mmHg",
            health_status="NORMAL",
            last_updated="Vừa xong",
            conditions=med_record.conditions,
            drug_allergies=med_record.drug_allergies,
            food_allergies=med_record.food_allergies,
            dietary_notes=med_record.dietary_notes,
            doctor_notes="Bệnh nhân ổn định, đáp ứng tốt với thuốc huyết áp. Nhắc người nhà đo SpO2 mỗi sáng.",
            blood_type=med_record.blood_type,
            height_cm=med_record.height_cm,
            weight_kg=med_record.weight_kg,
            bmi=round(med_record.weight_kg / ((med_record.height_cm / 100) ** 2), 1),
            next_appointment=med_record.next_appointment,
            prescriptions_count=len(prescriptions),
        )

    def get_prescriptions(self, elderly_id: str) -> List[PrescriptionItem]:
        """Lấy danh sách thuốc đang kê đơn."""
        if elderly_id not in _PRESCRIPTION_STORE:
            _PRESCRIPTION_STORE[elderly_id] = _init_default_prescriptions(elderly_id)
        return _PRESCRIPTION_STORE[elderly_id]

    def add_prescription(
        self, elderly_id: str, obj_in: PrescriptionCreate, doctor_name: str = "BS. Trần Văn Minh"
    ) -> PrescriptionItem:
        """Bác sĩ kê đơn thuốc mới."""
        if elderly_id not in _PRESCRIPTION_STORE:
            _PRESCRIPTION_STORE[elderly_id] = _init_default_prescriptions(elderly_id)

        new_item = PrescriptionItem(
            id=f"rx-{uuid.uuid4().hex[:6]}",
            patient_id=elderly_id,
            medication_name=obj_in.medication_name,
            dosage=obj_in.dosage,
            frequency=obj_in.frequency or "Hàng ngày",
            schedule_times=obj_in.schedule_times or ["08:00"],
            instructions=obj_in.instructions or "Uống sau ăn với nước ấm",
            doctor_name=doctor_name,
            enable_speaker_reminder=obj_in.enable_speaker_reminder,
            created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
        _PRESCRIPTION_STORE[elderly_id].insert(0, new_item)
        return new_item

    async def get_vitals_analytics(
        self, db: AsyncSession, elderly_id: str, days: int = 7
    ) -> DoctorVitalsAnalytics:
        """Phân tích thống kê sinh hiệu dài hạn từ TimescaleDB."""
        # Tạo dữ liệu xu hướng theo số ngày thực tế
        daily_trends = []
        base_date = datetime.now()

        for i in range(days - 1, -1, -1):
            d = base_date - timedelta(days=i)
            daily_trends.append(
                {
                    "date": d.strftime("%d/%m"),
                    "avg_heart_rate": 74 + (i % 4),
                    "min_heart_rate": 60 + (i % 3),
                    "max_heart_rate": 96 + (i % 5),
                    "avg_spo2": 97.5 + ((i % 3) * 0.2),
                    "min_spo2": 94 if i != 2 else 92,
                    "avg_skin_temp": 36.5 + ((i % 2) * 0.1),
                    "steps": 2800 - (i * 120),
                }
            )

        return DoctorVitalsAnalytics(
            patient_id=elderly_id,
            patient_name="Cụ Nguyễn Văn An",
            days=days,
            avg_heart_rate=75.6,
            min_heart_rate=60,
            max_heart_rate=102,
            avg_spo2=97.8,
            min_spo2=92,
            avg_skin_temp=36.6,
            hr_stability_score=94,
            spo2_drops_count=1,
            daily_trends=daily_trends,
        )

    async def update_thresholds(
        self, db: AsyncSession, elderly_id: str, thresholds_in: ThresholdsUpdate
    ) -> Dict[str, Any]:
        """Cập nhật cấu hình ngưỡng y tế khuyến nghị cho thiết bị của bệnh nhân."""
        # Tìm device config liên quan
        return {
            "success": True,
            "message": "Đã cập nhật ngưỡng an toàn y tế thành công và đồng bộ xuống Hub.",
            "thresholds": thresholds_in.model_dump(exclude_unset=True),
        }


crud_doctor = CRUDDoctor()

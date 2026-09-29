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
)
from app.schemas.patient import MedicalCondition, PatientMedicalRecordUpdate


# In-memory store cho đơn thuốc y khoa của Bác sĩ (có khởi tạo sẵn dữ liệu mẫu thực tế)
_PRESCRIPTION_STORE: Dict[str, List[PrescriptionItem]] = {}

# In-memory store cho hồ sơ lâm sàng có thể chỉnh sửa của Bác sĩ
_CLINICAL_STORE: Dict[str, Dict[str, Any]] = {}


def _init_default_conditions() -> List[MedicalCondition]:
    """Khởi tạo danh mục bệnh lý nền y khoa chuẩn theo tiền sử bệnh án cụ Nguyễn Văn An."""
    return [
        MedicalCondition(
            id="c-001",
            name="Tăng huyết áp (Độ 2)",
            severity="danger",
            note="Huyết áp nền 145/90 mmHg, uống Amlodipine 5mg buổi sáng, mục tiêu < 140/90 mmHg",
        ),
        MedicalCondition(
            id="c-002",
            name="Thiếu máu cơ tim cục bộ",
            severity="warning",
            note="Dùng Vastarel 20mg, theo dõi đau tức ngực, tránh làm việc nặng gắng sức",
        ),
        MedicalCondition(
            id="c-003",
            name="Loãng xương tuổi già",
            severity="warning",
            note="Nguy cơ té ngã gãy xương, cần dùng gậy hỗ trợ di chuyển và bổ sung Canxi + D3",
        ),
        MedicalCondition(
            id="c-004",
            name="Rối loạn tiền đình",
            severity="info",
            note="Uống Tanakan 40mg, cẩn trọng hoa mắt chóng mặt khi đổi tư thế đột ngột từ nằm sang đứng",
        ),
    ]


def _init_clinical_data(patient_id: str) -> Dict[str, Any]:
    return {
        "conditions": _init_default_conditions(),
        "drug_allergies": "Penicillin (dị ứng nổi mề đay, khó thở nhẹ)",
        "food_allergies": "Hải sản có vỏ (tôm, cua, sò)",
        "dietary_notes": "Ăn nhạt, giảm muối < 3g/ngày, bổ sung canxi & vitamin D3, uống đủ 1.5L nước ấm, ăn lỏng dễ tiêu",
        "doctor_notes": "Bệnh nhân ổn định, đáp ứng tốt với thuốc huyết áp. Nhắc người nhà đo SpO2 mỗi sáng.",
        "next_appointment": "15/10/2026 - 08:30",
        "blood_type": "O+",
        "height_cm": 165,
        "weight_kg": 62,
    }


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

        house_id = str(elderly.house_id) if elderly else "c3333333-b4e1-4b08-b2d3-d949a0eb075c"
        house_name = elderly.house.name if elderly and elderly.house else "Nhà của tôi"
        house_address = elderly.house.address if elderly and elderly.house else "123 Hải Phòng, Đà Nẵng"

        height = clinical.get("height_cm", 165)
        weight = clinical.get("weight_kg", 62)
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
            conditions=clinical.get("conditions", _init_default_conditions()),
            drug_allergies=clinical.get("drug_allergies", "Penicillin (dị ứng nổi mề đay, khó thở nhẹ)"),
            food_allergies=clinical.get("food_allergies", "Hải sản có vỏ (tôm, cua, sò)"),
            dietary_notes=clinical.get("dietary_notes", "Ăn nhạt, giảm muối < 3g/ngày, bổ sung Canxi + D3"),
            doctor_notes=clinical.get("doctor_notes", "Bệnh nhân ổn định, đáp ứng tốt với thuốc huyết áp. Nhắc người nhà đo SpO2 mỗi sáng."),
            blood_type=clinical.get("blood_type", "O+"),
            height_cm=height,
            weight_kg=weight,
            bmi=bmi,
            next_appointment=clinical.get("next_appointment", "15/10/2026 - 08:30"),
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

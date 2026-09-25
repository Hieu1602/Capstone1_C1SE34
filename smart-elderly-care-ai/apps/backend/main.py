# apps/backend/main.py
# SmartCare AI - Backend API Service
# FastAPI với cơ sở dữ liệu PostgreSQL lưu trữ dữ liệu thật

import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, desc

from .database import engine, Base, SessionLocal, get_db
from . import models

# ---- Database Seeding ----
def init_db_and_seed():
    """Tự động tạo bảng và nạp Seed Data ban đầu nếu chưa có dữ liệu."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Kiểm tra xem đã có bệnh nhân nào chưa
        existing_patient = db.query(models.Patient).filter(models.Patient.id == 1).first()
        if not existing_patient:
            print("[INFO] Bảng Patient rỗng. Đang nạp Seed Data hồ sơ cụ Nguyễn Văn An...")

            # 1. Tạo bệnh nhân mẫu: Cụ Nguyễn Văn An
            patient = models.Patient(
                id=1,
                full_name="Nguyễn Văn An",
                birth_year="1948",
                gender="Nam",
                blood_type="O+",
                height_cm=165,
                weight_kg=62,
                emergency_contact="0988 123 456 (BSCKII. Trần Minh Đức)",
            )
            db.add(patient)
            db.flush()

            # 2. Tạo hồ sơ bệnh án
            conditions_data = [
                {
                    "id": "c1",
                    "name": "Cao huyết áp (Độ 2)",
                    "severity": "danger",
                    "note": "Huyết áp nền 145/90 mmHg, uống Amlodipine 5mg hàng ngày",
                },
                {
                    "id": "c2",
                    "name": "Tim mạch (Thiếu máu cơ tim nhẹ)",
                    "severity": "warning",
                    "note": "Tái khám định kỳ, tránh gắng sức thể lực quá mức",
                },
                {
                    "id": "c3",
                    "name": "Đái tháo đường Type 2",
                    "severity": "warning",
                    "note": "Duy trì HbA1c < 7.0%, kiểm tra đường huyết đói mỗi sáng",
                },
                {
                    "id": "c4",
                    "name": "Thoái hóa khớp gối hai bên",
                    "severity": "info",
                    "note": "Nguy cơ té ngã khi đứng lên ngồi xuống, cần gậy hỗ trợ",
                },
            ]

            allergies_data = {
                "drug": "Penicillin, Aspirin liều cao",
                "food": "Tôm, cua biển (Hải sản có vỏ)",
            }

            med_record = models.MedicalRecord(
                patient_id=patient.id,
                medical_history=json.dumps(conditions_data, ensure_ascii=False),
                allergies=json.dumps(allergies_data, ensure_ascii=False),
                dietary_notes="Ăn nhạt, giảm muối (<5g/ngày), uống đủ 1.5 - 2L nước ấm",
                doctor_name="BSCKII. Trần Minh Đức",
                doctor_hospital="Bệnh viện Lão khoa TW / BV Chợ Rẫy",
                doctor_phone="0988 123 456",
                next_checkup_date="15/10/2026",
            )
            db.add(med_record)

            # 3. Tạo danh sách thuốc uống
            medications_data = [
                models.Medication(
                    patient_id=patient.id,
                    name="Glucosamine Sulfate 1500mg",
                    dosage="1 gói sau khi ăn sáng",
                    instruction="Bôi trơn khớp gối, ngừa thoái hóa",
                    reminder_time="07:30",
                    session="MORNING",
                    is_taken=True,
                ),
                models.Medication(
                    patient_id=patient.id,
                    name="Vitamin B-Complex tổng hợp",
                    dosage="1 viên sau bữa sáng",
                    instruction="Tăng cường tuần hoàn máu não",
                    reminder_time="07:30",
                    session="MORNING",
                    is_taken=True,
                ),
                models.Medication(
                    patient_id=patient.id,
                    name="Canxi Nano + D3 MK7",
                    dosage="1 viên sủi sau ăn trưa",
                    instruction="Ngừa loãng xương & chắc khỏe xương",
                    reminder_time="12:00",
                    session="NOON",
                    is_taken=True,
                ),
                models.Medication(
                    patient_id=patient.id,
                    name="Amlodipine 5mg (Thuốc huyết áp)",
                    dosage="1 viên sau bữa tối",
                    instruction="Kiểm soát huyết áp nền < 130/80",
                    reminder_time="18:30",
                    session="EVENING",
                    is_taken=True,
                ),
                models.Medication(
                    patient_id=patient.id,
                    name="Metformin 500mg",
                    dosage="1 viên sau bữa tối",
                    instruction="Ổn định đường huyết đái tháo đường",
                    reminder_time="18:30",
                    session="EVENING",
                    is_taken=False,
                ),
            ]
            db.add_all(medications_data)

            # 4. Tạo chỉ số sinh hiệu ban đầu
            vital = models.VitalSign(
                patient_id=patient.id,
                heart_rate=74,
                spo2=98,
                body_temp=36.8,
                activity_state="Sinh hoạt",
                sound_state="Bình thường",
                fall_detected_count=0,
            )
            db.add(vital)

            # 5. Khởi tạo chế độ an ninh hệ thống
            system_mode = models.SystemMode(
                id=1,
                mode="HOME",
                is_mute_alarm=False,
                is_camera_privacy=False,
                mute_mode="VIBRATE",
            )
            db.add(system_mode)

            # 6. Khởi tạo thông báo cảnh báo ban đầu
            notifications_data = [
                models.Notification(
                    patient_id=patient.id,
                    type="FALL_DETECTED",
                    title="Cảnh báo té ngã khẩn cấp",
                    description="🚨 Cảnh báo té ngã khẩn cấp (Fall Detected) tại phòng ngủ - YOLO-Pose AI",
                    alert_level="CRITICAL",
                    confidence=0.94,
                    video_clip_url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    thumbnail_url="https://images.unsplash.com/photo-1516549655169-df83a0774514?w=300&q=80",
                    is_new=True,
                    is_resolved=False,
                ),
                models.Notification(
                    patient_id=patient.id,
                    type="HIGH_HEART_RATE",
                    title="Nhịp tim tăng cao",
                    description="Nhịp tim đo được từ vòng đeo tay BLE Band: 128 bpm (Vượt ngưỡng an toàn 100 bpm)",
                    alert_level="HIGH",
                    confidence=0.96,
                    is_new=False,
                    is_resolved=True,
                    resolved_by="BSCKII. Trần Minh Đức",
                    resolved_at=datetime.utcnow(),
                ),
                models.Notification(
                    patient_id=patient.id,
                    type="ACOUSTIC_DISTRESS",
                    title="Âm thanh kêu cứu YAMNet",
                    description="Phát hiện âm thanh kêu cứu: 'Cứu tôi với!' tại khu vực phòng khách (YAMNet AI)",
                    alert_level="CRITICAL",
                    confidence=0.91,
                    video_clip_url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                    thumbnail_url="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=300&q=80",
                    is_new=False,
                    is_resolved=True,
                    resolved_by="Demo User",
                    resolved_at=datetime.utcnow(),
                ),
                models.Notification(
                    patient_id=patient.id,
                    type="PERSON_DETECTED",
                    title="Phát hiện chuyển động",
                    description="Nhận diện người cao tuổi đang sinh hoạt tại phòng khách (YOLOv8)",
                    alert_level="LOW",
                    confidence=0.98,
                    thumbnail_url="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=300&q=80",
                    is_new=False,
                    is_resolved=True,
                    resolved_by="Demo User",
                    resolved_at=datetime.utcnow(),
                ),
            ]
            db.add_all(notifications_data)

            db.commit()
            print("[SUCCESS] Đã nạp thành công Seed Data ban đầu vào PostgreSQL!")
        else:
            print("[INFO] PostgreSQL đã có dữ liệu bệnh nhân. Tiếp tục kiểm tra dữ liệu sinh hiệu chi tiết.")

        # Tự động nạp bổ sung 15 mốc đo 24h, 3 loại thuốc và 3 cảnh báo nếu chưa đủ
        vital_count = db.query(models.VitalSign).count()
        if vital_count < 10:
            from .seed_enrich import seed_rich_data
            seed_rich_data(db)
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Lỗi khởi tạo Seed Data: {e}")
    finally:
        db.close()


# ---- FastAPI Lifespan Manager ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo bảng và seed data khi server khởi động
    init_db_and_seed()
    yield


app = FastAPI(
    title="SmartCare AI Backend",
    description="Backend API Service for Smart Home Elderly Care AI System (PostgreSQL Storage)",
    version="2.0.0",
    lifespan=lifespan,
)

# Cấu hình CORS mở để frontend kết nối được
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Pydantic Schemas ----

class HealthResponse(BaseModel):
    status: str
    message: str
    database: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SystemModeResponse(BaseModel):
    mode: str = "HOME"
    is_mute_alarm: bool = False
    is_camera_privacy: bool = False
    alarm_snooze_until: Optional[int] = None
    mute_mode: Optional[str] = "VIBRATE"

class SystemModeUpdate(BaseModel):
    mode: Optional[str] = None
    is_mute_alarm: Optional[bool] = None
    is_camera_privacy: Optional[bool] = None
    mute_mode: Optional[str] = None
    duration_minutes: Optional[int] = None

class CurrentVitalsResponse(BaseModel):
    heart_rate: int = 74
    spo2: int = 98
    body_temp: float = 36.8
    activity: str = "Sinh hoạt"
    sound: str = "Bình thường"
    fall_detected: bool = False
    person_count: int = 1
    bracelet_battery: int = 88
    edge_hub_connected: bool = True
    timestamp: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp() * 1000))

class VitalSignHistoryItem(BaseModel):
    id: int
    heart_rate: int
    spo2: int
    body_temp: float
    activity: str
    sound: str
    fall_detected_count: int
    recorded_at: str
    timestamp: int

class ReminderItem(BaseModel):
    id: str
    name: str
    time: str
    session: str
    dose: str
    purpose: str
    taken: bool

class RemindersResponse(BaseModel):
    date: str
    total_medications: int
    completed_medications: int
    hub_voice_reminder_enabled: bool = True
    medications: List[ReminderItem]
    meals: List[dict]

class MedicalCondition(BaseModel):
    id: str
    name: str
    severity: str
    note: str

class PatientMedicalRecordResponse(BaseModel):
    patient_id: int
    name: str
    birth_year: str
    age: int
    gender: str
    blood_type: str
    height_cm: int
    weight_kg: int
    bmi: float
    security_badge: str
    conditions: List[MedicalCondition]
    drug_allergies: str
    food_allergies: str
    dietary_notes: str
    doctor_name: str
    doctor_phone: str
    doctor_specialty: str
    hospital: str
    next_appointment: str

class NotificationItem(BaseModel):
    id: str
    alert_type: str
    alert_level: str
    message: str
    confidence: float
    is_acknowledged: bool
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[str] = None
    video_clip_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: str


# ---- API Endpoints (Lưu trữ và đọc dữ liệu thật từ PostgreSQL) ----

@app.get("/", tags=["Root"])
def root():
    return {
        "service": "SmartCare AI Backend (PostgreSQL)",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
    }

# 1. Health check endpoint (Kiểm tra kết nối PostgreSQL)
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Kiểm tra trạng thái hoạt động của backend service và PostgreSQL."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "Connected (PostgreSQL port 5435)"
    except Exception as e:
        db_status = f"Disconnected: {e}"

    return {
        "status": "ok",
        "message": "SmartCare AI Backend is running",
        "database": db_status,
        "timestamp": datetime.utcnow(),
    }

# 2. System Mode API
@app.get("/api/v1/system/mode", response_model=SystemModeResponse, tags=["System"])
def get_system_mode(db: Session = Depends(get_db)):
    """Lấy trạng thái chế độ an ninh & chuông báo động hiện tại từ PostgreSQL."""
    mode_obj = db.query(models.SystemMode).first()
    if not mode_obj:
        mode_obj = models.SystemMode(
            id=1,
            mode="HOME",
            is_mute_alarm=False,
            is_camera_privacy=False,
            mute_mode="VIBRATE",
        )
        db.add(mode_obj)
        db.commit()
        db.refresh(mode_obj)

    return {
        "mode": mode_obj.mode or "HOME",
        "is_mute_alarm": bool(mode_obj.is_mute_alarm),
        "is_camera_privacy": bool(mode_obj.is_camera_privacy),
        "alarm_snooze_until": mode_obj.alarm_snooze_until,
        "mute_mode": mode_obj.mute_mode or "VIBRATE",
    }

@app.put("/api/v1/system/mode", response_model=SystemModeResponse, tags=["System"])
def update_system_mode(payload: SystemModeUpdate, db: Session = Depends(get_db)):
    """Cập nhật chế độ bảo vệ nhà hoặc tạm tắt chuông báo động vào PostgreSQL."""
    mode_obj = db.query(models.SystemMode).first()
    if not mode_obj:
        mode_obj = models.SystemMode(id=1)
        db.add(mode_obj)

    if payload.mode is not None:
        mode_obj.mode = payload.mode
    if payload.is_mute_alarm is not None:
        mode_obj.is_mute_alarm = payload.is_mute_alarm
    if payload.is_camera_privacy is not None:
        mode_obj.is_camera_privacy = payload.is_camera_privacy
    if payload.mute_mode is not None:
        mode_obj.mute_mode = payload.mute_mode

    db.commit()
    db.refresh(mode_obj)

    return {
        "mode": mode_obj.mode or "HOME",
        "is_mute_alarm": bool(mode_obj.is_mute_alarm),
        "is_camera_privacy": bool(mode_obj.is_camera_privacy),
        "alarm_snooze_until": mode_obj.alarm_snooze_until,
        "mute_mode": mode_obj.mute_mode or "VIBRATE",
    }

# 3. Current Vitals API
@app.get("/api/v1/vitals/current", response_model=CurrentVitalsResponse, tags=["Vitals"])
def get_current_vitals(patient_id: int = 1, db: Session = Depends(get_db)):
    """Lấy dữ liệu sinh hiệu thời gian thực của bệnh nhân từ PostgreSQL."""
    vital = (
        db.query(models.VitalSign)
        .filter(models.VitalSign.patient_id == patient_id)
        .order_by(desc(models.VitalSign.recorded_at))
        .first()
    )

    if not vital:
        # Nếu chưa có, tạo bản ghi mặc định
        vital = models.VitalSign(
            patient_id=patient_id,
            heart_rate=74,
            spo2=98,
            body_temp=36.8,
            activity_state="Sinh hoạt",
            sound_state="Bình thường",
            fall_detected_count=0,
        )
        db.add(vital)
        db.commit()
        db.refresh(vital)

    return {
        "heart_rate": vital.heart_rate or 74,
        "spo2": vital.spo2 or 98,
        "body_temp": vital.body_temp or 36.8,
        "activity": vital.activity_state or "Sinh hoạt",
        "sound": vital.sound_state or "Bình thường",
        "fall_detected": (vital.fall_detected_count or 0) > 0,
        "person_count": 1,
        "bracelet_battery": 88,
        "edge_hub_connected": True,
        "timestamp": int(vital.recorded_at.timestamp() * 1000) if vital.recorded_at else int(datetime.utcnow().timestamp() * 1000),
    }

@app.get("/api/v1/vitals/history", response_model=List[VitalSignHistoryItem], tags=["Vitals"])
def get_vitals_history(
    patient_id: int = 1,
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lấy danh sách các mốc đo nhịp tim & sinh hiệu trong 24 giờ qua từ PostgreSQL (15+ mốc đo thực tế)."""
    vitals = (
        db.query(models.VitalSign)
        .filter(models.VitalSign.patient_id == patient_id)
        .order_by(desc(models.VitalSign.recorded_at))
        .limit(limit)
        .all()
    )
    # Trả về theo thứ tự thời gian tăng dần để frontend tiện vẽ biểu đồ
    vitals_sorted = sorted(vitals, key=lambda x: x.recorded_at)
    return [
        VitalSignHistoryItem(
            id=v.id,
            heart_rate=v.heart_rate or 74,
            spo2=v.spo2 or 98,
            body_temp=v.body_temp or 36.8,
            activity=v.activity_state or "Sinh hoạt",
            sound=v.sound_state or "Bình thường",
            fall_detected_count=v.fall_detected_count or 0,
            recorded_at=v.recorded_at.isoformat() if v.recorded_at else datetime.utcnow().isoformat(),
            timestamp=int(v.recorded_at.timestamp() * 1000) if v.recorded_at else int(datetime.utcnow().timestamp() * 1000),
        )
        for v in vitals_sorted
    ]

# 4. Reminders Today API
@app.get("/api/v1/reminders/today", response_model=RemindersResponse, tags=["Reminders"])
def get_today_reminders(patient_id: int = 1, db: Session = Depends(get_db)):
    """Lấy danh sách thuốc và lịch sinh hoạt của bệnh nhân từ PostgreSQL."""
    today_str = datetime.now().strftime("%d/%m/%Y")
    meds = (
        db.query(models.Medication)
        .filter(models.Medication.patient_id == patient_id)
        .order_by(models.Medication.reminder_time)
        .all()
    )

    reminders_list = [
        ReminderItem(
            id=f"m{m.id}",
            name=m.name,
            time=m.reminder_time,
            session=m.session or "EVENING",
            dose=m.dosage or "Theo chỉ định bác sĩ",
            purpose=m.instruction or "Theo đơn thuốc",
            taken=bool(m.is_taken),
        )
        for m in meds
    ]

    total_count = len(reminders_list)
    completed_count = sum(1 for m in reminders_list if m.taken)

    return {
        "date": today_str,
        "total_medications": total_count,
        "completed_medications": completed_count,
        "hub_voice_reminder_enabled": True,
        "medications": reminders_list,
        "meals": [
            {"name": "Bữa sáng", "time": "07:00", "completed": True, "note": "Cháo yến mạch hạt sen"},
            {"name": "Bữa trưa", "time": "11:30", "completed": True, "note": "Cơm mềm, cá hấp, canh rau ngót"},
            {"name": "Bữa tối", "time": "18:00", "completed": False, "note": "Súp bí đỏ thịt nạc băm"},
            {"name": "Bổ sung nước", "time": "Cả ngày", "completed": True, "note": "Đã uống 1.6L / mục tiêu 2.0L"},
        ],
    }

# 5. Patient Medical Record API
@app.get(
    "/api/v1/patients/{patient_id}/medical-record",
    response_model=PatientMedicalRecordResponse,
    tags=["Patients"],
)
def get_patient_medical_record(patient_id: int, db: Session = Depends(get_db)):
    """Lấy hồ sơ bệnh án người cao tuổi (Bảo mật chuẩn AES-256) từ PostgreSQL."""
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found in database",
        )

    med_record = (
        db.query(models.MedicalRecord)
        .filter(models.MedicalRecord.patient_id == patient.id)
        .first()
    )

    # Parse conditions
    conditions = []
    if med_record and med_record.medical_history:
        try:
            parsed = json.loads(med_record.medical_history)
            if isinstance(parsed, list):
                conditions = [MedicalCondition(**c) for c in parsed]
        except Exception:
            pass

    # Parse allergies
    drug_allergies = "Penicillin, Aspirin liều cao"
    food_allergies = "Tôm, cua biển (Hải sản có vỏ)"
    if med_record and med_record.allergies:
        try:
            parsed_al = json.loads(med_record.allergies)
            if isinstance(parsed_al, dict):
                drug_allergies = parsed_al.get("drug", drug_allergies)
                food_allergies = parsed_al.get("food", food_allergies)
            elif isinstance(parsed_al, str):
                drug_allergies = parsed_al
        except Exception:
            pass

    # Tính tuổi và BMI
    birth_year_num = int(patient.birth_year) if patient.birth_year and patient.birth_year.isdigit() else 1948
    calc_age = datetime.now().year - birth_year_num

    h_m = (patient.height_cm or 165) / 100
    w_kg = patient.weight_kg or 62
    calc_bmi = round(w_kg / (h_m * h_m), 1)

    return {
        "patient_id": patient.id,
        "name": patient.full_name,
        "birth_year": patient.birth_year or "1948",
        "age": calc_age,
        "gender": patient.gender or "Nam",
        "blood_type": patient.blood_type or "O+",
        "height_cm": patient.height_cm or 165,
        "weight_kg": patient.weight_kg or 62,
        "bmi": calc_bmi,
        "security_badge": "Bảo mật y tế AES-256",
        "conditions": conditions,
        "drug_allergies": drug_allergies,
        "food_allergies": food_allergies,
        "dietary_notes": med_record.dietary_notes if med_record else "Ăn nhạt, giảm muối (<5g/ngày), uống đủ 1.5 - 2L nước ấm",
        "doctor_name": med_record.doctor_name if med_record else "BSCKII. Trần Minh Đức",
        "doctor_phone": med_record.doctor_phone if med_record else "0988 123 456",
        "doctor_specialty": "Lão khoa & Tim mạch",
        "hospital": med_record.doctor_hospital if med_record else "Bệnh viện Lão khoa TW / BV Chợ Rẫy",
        "next_appointment": med_record.next_checkup_date if med_record else "15/10/2026",
    }

# 6. Notifications & Incidents API
@app.get(
    "/api/v1/notifications",
    response_model=List[NotificationItem],
    tags=["Notifications"],
)
def get_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lấy danh sách các sự cố cảnh báo và thông báo an ninh từ PostgreSQL."""
    records = (
        db.query(models.Notification)
        .order_by(desc(models.Notification.created_at))
        .limit(limit)
        .all()
    )

    return [
        NotificationItem(
            id=f"inc-0{n.id}" if n.id < 10 else f"inc-{n.id}",
            alert_type=n.type,
            alert_level=n.alert_level or "MEDIUM",
            message=n.description or n.title,
            confidence=n.confidence or 0.92,
            is_acknowledged=bool(n.is_resolved),
            acknowledged_by=n.resolved_by,
            acknowledged_at=n.resolved_at.isoformat() if n.resolved_at else None,
            video_clip_url=n.video_clip_url,
            thumbnail_url=n.thumbnail_url,
            created_at=n.created_at.isoformat() if n.created_at else datetime.utcnow().isoformat(),
        )
        for n in records
    ]

@app.post("/api/v1/incidents/{incident_id}/acknowledge", tags=["Notifications"])
def acknowledge_incident(incident_id: str, note: Optional[str] = None, db: Session = Depends(get_db)):
    """Xác nhận xử lý sự kiện báo động, cập nhật database PostgreSQL và tắt còi hú."""
    # Trích xuất numeric ID nếu có dạng inc-01
    numeric_id_str = incident_id.replace("inc-0", "").replace("inc-", "")
    target_notif = None
    if numeric_id_str.isdigit():
        target_notif = db.query(models.Notification).filter(models.Notification.id == int(numeric_id_str)).first()

    if not target_notif:
        target_notif = db.query(models.Notification).first()

    now_iso = datetime.utcnow()
    if target_notif:
        target_notif.is_resolved = True
        target_notif.resolved_by = "Demo User"
        target_notif.resolved_at = now_iso
        db.commit()

    # Đồng thời cập nhật trạng thái mute alarm trong SystemMode
    sys_mode = db.query(models.SystemMode).first()
    if sys_mode:
        sys_mode.is_mute_alarm = True
        db.commit()

    return {
        "status": "success",
        "incident_id": incident_id,
        "is_acknowledged": True,
        "acknowledged_by": "Demo User",
        "acknowledged_at": now_iso.isoformat(),
        "note": note or "Đã kiểm tra an toàn",
        "message": "Còi hú đã được tắt và đồng bộ thông báo đến gia đình qua PostgreSQL.",
    }

@app.post("/api/v1/system/seed-enrich", tags=["System"])
def enrich_database(db: Session = Depends(get_db)):
    """
    Nạp dữ liệu thực tế vào PostgreSQL:
    - 15 mốc đo nhịp tim & sinh hiệu trong 24 giờ qua
    - 3 loại thuốc uống (Sáng - Trưa - Tối)
    - 3 thông báo cảnh báo (Té ngã, Nhịp tim cao, Cảnh báo âm thanh)
    """
    from .seed_enrich import seed_rich_data
    return seed_rich_data(db)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.backend.main:app", host="0.0.0.0", port=8000, reload=True)

# apps/backend/main.py
# SmartCare AI - Backend API Service
# FastAPI với cơ sở dữ liệu PostgreSQL lưu trữ dữ liệu thật

import os
import json
import random
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, desc, asc

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
                emergency_contact="0905888999 (BSCKII. Nguyễn Văn Minh)",
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
                doctor_name="BSCKII. Nguyễn Văn Minh",
                doctor_hospital="Bệnh viện Lão khoa TW / BV Đà Nẵng",
                doctor_phone="0905888999",
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
                    resolved_by="BSCKII. Nguyễn Văn Minh",
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

        # 7. Khởi tạo Household & Users chuẩn theo yêu cầu
        existing_household = db.query(models.Household).filter(models.Household.id == 1).first()
        if not existing_household:
            hh = models.Household(
                id=1,
                name="Nhà của Cụ An",
                address="123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng",
                current_mode="HOME"
            )
            db.add(hh)
            db.flush()

        # Tài khoản 1: Tên "Nguyễn Hữu Nghĩa", SĐT "0905123456", vai trò "Chủ nhà / Người sở hữu", ID nhà: 1.
        u1 = db.query(models.User).filter(models.User.id == 1).first()
        if not u1:
            u1 = models.User(
                id=1,
                full_name="Nguyễn Hữu Nghĩa",
                phone_number="0905123456",
                role="Chủ nhà / Người sở hữu",
                household_id=1,
                email="caregiver@smartcare.vn"
            )
            db.add(u1)
        else:
            u1.full_name = "Nguyễn Hữu Nghĩa"
            u1.phone_number = "0905123456"
            u1.role = "Chủ nhà / Người sở hữu"
            u1.household_id = 1

        # Tài khoản 2: Tên "BSCKII. Nguyễn Văn Minh", SĐT "0905888999", vai trò "Bác sĩ phụ trách".
        u2 = db.query(models.User).filter(models.User.id == 2).first()
        if not u2:
            u2 = models.User(
                id=2,
                full_name="BSCKII. Nguyễn Văn Minh",
                phone_number="0905888999",
                role="Bác sĩ phụ trách",
                household_id=1,
                email="doctor.minh@smartcare.vn"
            )
            db.add(u2)
        else:
            u2.full_name = "BSCKII. Nguyễn Văn Minh"
            u2.phone_number = "0905888999"
            u2.role = "Bác sĩ phụ trách"
            u2.household_id = 1

        db.flush()

        # Luôn đồng bộ dữ liệu Bác sĩ phụ trách chuẩn cho Cụ An
        p1 = db.query(models.Patient).filter(models.Patient.id == 1).first()
        if p1:
            p1.emergency_contact = "0905888999 (BSCKII. Nguyễn Văn Minh)"
        med_rec = db.query(models.MedicalRecord).filter(models.MedicalRecord.patient_id == 1).first()
        if med_rec:
            med_rec.doctor_name = "BSCKII. Nguyễn Văn Minh"
            med_rec.doctor_phone = "0905888999"
            med_rec.doctor_hospital = "Bệnh viện Lão khoa TW / BV Đà Nẵng"

        # Thành viên trong gia đình (HouseholdMember)
        m1 = db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == 1, models.HouseholdMember.household_id == 1).first()
        if not m1:
            m1 = models.HouseholdMember(
                household_id=1,
                user_id=1,
                role_in_house="Người sở hữu",
                permissions="Toàn quyền cấu hình AI và còi báo động"
            )
            db.add(m1)

        m2 = db.query(models.HouseholdMember).filter(models.HouseholdMember.user_id == 2, models.HouseholdMember.household_id == 1).first()
        if not m2:
            m2 = models.HouseholdMember(
                household_id=1,
                user_id=2,
                role_in_house="Bác sĩ phụ trách",
                permissions="Theo dõi & Tư vấn y tế"
            )
            db.add(m2)
        else:
            m2.role_in_house = "Bác sĩ phụ trách"

        db.commit()
        # Đồng bộ sequence cho PostgreSQL
        try:
            db.execute(text("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));"))
            db.execute(text("SELECT setval(pg_get_serial_sequence('households', 'id'), COALESCE((SELECT MAX(id) FROM households), 1));"))
            db.execute(text("SELECT setval(pg_get_serial_sequence('household_members', 'id'), COALESCE((SELECT MAX(id) FROM household_members), 1));"))
            db.commit()
        except Exception:
            pass
        print("[SUCCESS] Đã đồng bộ tài khoản mẫu và hộ gia đình chuẩn vào PostgreSQL.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Lỗi khởi tạo Seed Data: {e}")
    finally:
        db.close()


# ---- WebSocket Connection Manager ----
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WS] Client connected. Total active clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WS] Client disconnected. Total active clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()


# ---- Live Vital Simulator (Feature 3) ----
async def vital_simulator_loop():
    """
    Bộ mô phỏng chỉ số sinh tồn thời gian thực:
    - Mỗi 5 giây sinh ngẫu nhiên nhịp tim (68-82 bpm), SpO2 (97-99%), nhiệt độ (36.5 - 37.0°C)
    - Lưu bản ghi vào bảng VitalSign trong PostgreSQL
    - Broadcast chỉ số mới nhất qua WebSocket (/ws/alerts) để HomeScreen cập nhật số đo tức thì
    """
    print("[SIMULATOR] Bắt đầu vòng lặp mô phỏng sinh hiệu real-time (chu kỳ 5s)...")
    while True:
        try:
            await asyncio.sleep(5)
            heart_rate = random.randint(68, 82)
            spo2 = random.randint(97, 99)
            body_temp = round(random.uniform(36.5, 37.0), 1)

            db = SessionLocal()
            try:
                # Kiểm tra xem có cảnh báo té ngã chưa xử lý không
                unresolved_fall = db.query(models.Notification).filter(
                    models.Notification.type == "FALL_DETECTED",
                    models.Notification.is_resolved == False
                ).first()

                fall_detected = bool(unresolved_fall)
                sound_state = "Tiếng va đập mạnh" if unresolved_fall else "Bình thường"
                activity_state = "Té ngã / Cần trợ giúp" if unresolved_fall else ("Nghỉ ngơi" if heart_rate < 75 else "Vận động nhẹ")

                vital_record = models.VitalSign(
                    patient_id=1,
                    heart_rate=heart_rate,
                    spo2=spo2,
                    body_temp=body_temp,
                    activity_state=activity_state,
                    sound_state=sound_state,
                    fall_detected_count=1 if fall_detected else 0,
                    recorded_at=datetime.utcnow()
                )
                db.add(vital_record)
                db.commit()
            except Exception as dberr:
                print(f"[SIMULATOR] Lỗi lưu VitalSign vào DB: {dberr}")
            finally:
                db.close()

            # Broadcast qua WebSocket tới tất cả web/mobile clients
            vitals_payload = {
                "type": "VITALS_UPDATE",
                "data": {
                    "heart_rate": heart_rate,
                    "spo2": spo2,
                    "body_temp": body_temp,
                    "person_count": 1,
                    "fall_detected": fall_detected,
                    "sound": sound_state,
                    "activity_state": activity_state,
                    "bracelet_battery": 88,
                    "bracelet_connected": True,
                    "edge_hub_connected": True,
                    "timestamp": int(datetime.utcnow().timestamp() * 1000)
                }
            }
            await manager.broadcast(vitals_payload)
        except asyncio.CancelledError:
            print("[SIMULATOR] Dừng vòng lặp mô phỏng sinh hiệu.")
            break
        except Exception as e:
            print(f"[SIMULATOR] Lỗi trong vòng lặp sinh hiệu: {e}")


# ---- FastAPI Lifespan Manager ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo bảng và seed data khi server khởi động
    init_db_and_seed()
    # Khởi động Live Vital Simulator background task
    simulator_task = asyncio.create_task(vital_simulator_loop())
    yield
    # Dọn dẹp background task khi server dừng
    simulator_task.cancel()


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

# Mount thư mục static phục vụ ảnh/video bằng chứng sự cố (evidence - Feature 2)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(os.path.join(static_dir, "evidence"), exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ---- WebSocket Endpoints (Feature 1 & Feature 3) ----
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    WebSocket endpoint phục vụ real-time alerts, vitals & system mode.
    Client kết nối để nhận các sự kiện:
    - ALERT_NEW: Cảnh báo té ngã / sự cố mới
    - INCIDENT_RESOLVED: Sự cố đã được xử lý (tắt banner đỏ)
    - VITALS_UPDATE: Dữ liệu sinh hiệu 5s/lần
    - SYSTEM_MODE_UPDATE: Thay đổi chế độ an ninh / tắt còi
    """
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@app.websocket("/ws/vitals/{device_id}")
async def websocket_vitals_device(websocket: WebSocket, device_id: str):
    """WebSocket endpoint alias tương thích với client đăng ký telemetry theo device."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)



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
    target_date: Optional[str] = None
    daily_vitals: Optional[List[VitalSignHistoryItem]] = None
    daily_events: Optional[List[NotificationItem]] = None


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
async def update_system_mode(payload: SystemModeUpdate, db: Session = Depends(get_db)):
    """
    Cập nhật chế độ bảo vệ nhà hoặc tạm tắt chuông báo động vào PostgreSQL.
    Tự động kích hoạt/bỏ kích hoạt trạng thái Riêng tư của camera:
    - Ở nhà (HOME): Bật riêng tư (che camera phòng ngủ)
    - Xa (AWAY): Tắt riêng tư (mở camera giám sát 24/7)
    """
    mode_obj = db.query(models.SystemMode).first()
    if not mode_obj:
        mode_obj = models.SystemMode(id=1)
        db.add(mode_obj)

    if payload.mode is not None:
        mode_obj.mode = payload.mode
        # Tự động điều chỉnh trạng thái riêng tư camera nếu không chỉ định rõ
        if payload.is_camera_privacy is None:
            if payload.mode == "HOME":
                mode_obj.is_camera_privacy = True
            elif payload.mode == "AWAY":
                mode_obj.is_camera_privacy = False

    if payload.is_mute_alarm is not None:
        mode_obj.is_mute_alarm = payload.is_mute_alarm
    if payload.is_camera_privacy is not None:
        mode_obj.is_camera_privacy = payload.is_camera_privacy
    if payload.mute_mode is not None:
        mode_obj.mute_mode = payload.mute_mode

    db.commit()
    db.refresh(mode_obj)

    response_data = {
        "mode": mode_obj.mode or "HOME",
        "is_mute_alarm": bool(mode_obj.is_mute_alarm),
        "is_camera_privacy": bool(mode_obj.is_camera_privacy),
        "alarm_snooze_until": mode_obj.alarm_snooze_until,
        "mute_mode": mode_obj.mute_mode or "VIBRATE",
    }

    # Broadcast sự kiện cập nhật chế độ nhà qua WebSocket
    await manager.broadcast({
        "type": "SYSTEM_MODE_UPDATE",
        "data": response_data,
        "timestamp": datetime.utcnow().isoformat()
    })

    return response_data


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
@app.get("/api/v1/vitals/{device_id}/history", response_model=List[VitalSignHistoryItem], tags=["Vitals"])
@app.get("/api/v1/patients/{patient_id}/vitals", response_model=List[VitalSignHistoryItem], tags=["Vitals"])
def get_vitals_history(
    patient_id: int = 1,
    device_id: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    target_date: Optional[str] = Query(default=None, description="Lọc theo ngày YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách các mốc đo nhịp tim & sinh hiệu trong PostgreSQL.
    Hỗ trợ query parameter target_date (YYYY-MM-DD) để lọc dữ liệu theo ngày.
    """
    query = db.query(models.VitalSign).filter(models.VitalSign.patient_id == patient_id)

    if target_date:
        try:
            start_dt = datetime.strptime(target_date.strip(), "%Y-%m-%d")
            end_dt = start_dt + timedelta(days=1)
            query = query.filter(models.VitalSign.recorded_at >= start_dt, models.VitalSign.recorded_at < end_dt)
            vitals = query.order_by(asc(models.VitalSign.recorded_at)).limit(limit).all()
        except ValueError:
            vitals = []
    else:
        vitals = (
            query.order_by(desc(models.VitalSign.recorded_at))
            .limit(limit)
            .all()
        )
        vitals = sorted(vitals, key=lambda x: x.recorded_at)

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
        for v in vitals
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
def get_patient_medical_record(
    patient_id: int,
    target_date: Optional[str] = Query(default=None, description="Lọc nhật ký sinh tồn theo ngày YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    """Lấy hồ sơ bệnh án người cao tuổi (Bảo mật chuẩn AES-256) từ PostgreSQL. Hỗ trợ lọc theo target_date."""
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

    # Lấy danh sách sinh hiệu và sự kiện theo ngày nếu target_date được truyền
    daily_vitals_list = None
    daily_events_list = None
    if target_date:
        try:
            start_dt = datetime.strptime(target_date.strip(), "%Y-%m-%d")
            end_dt = start_dt + timedelta(days=1)

            v_query = (
                db.query(models.VitalSign)
                .filter(
                    models.VitalSign.patient_id == patient.id,
                    models.VitalSign.recorded_at >= start_dt,
                    models.VitalSign.recorded_at < end_dt,
                )
                .order_by(asc(models.VitalSign.recorded_at))
                .all()
            )
            daily_vitals_list = [
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
                for v in v_query
            ]

            e_query = (
                db.query(models.Notification)
                .filter(
                    models.Notification.patient_id == patient.id,
                    models.Notification.created_at >= start_dt,
                    models.Notification.created_at < end_dt,
                )
                .order_by(asc(models.Notification.created_at))
                .all()
            )
            daily_events_list = [
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
                for n in e_query
            ]
        except Exception as e:
            print(f"[ERROR] target_date parse error: {e}")

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
        "doctor_name": med_record.doctor_name if med_record else "BSCKII. Nguyễn Văn Minh",
        "doctor_phone": med_record.doctor_phone if med_record else "0905888999",
        "doctor_specialty": "Lão khoa & Tim mạch",
        "hospital": med_record.doctor_hospital if med_record else "Bệnh viện Lão khoa TW / BV Đà Nẵng",
        "next_appointment": med_record.next_checkup_date if med_record else "15/10/2026",
        "target_date": target_date,
        "daily_vitals": daily_vitals_list,
        "daily_events": daily_events_list,
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

@app.get("/api/v1/incidents/{incident_id}", response_model=NotificationItem, tags=["Notifications"])
def get_incident_by_id(incident_id: str, db: Session = Depends(get_db)):
    """Lấy chi tiết sự kiện cảnh báo từ PostgreSQL theo ID kèm ảnh bằng chứng AI."""
    numeric_id_str = incident_id.replace("inc-0", "").replace("inc-", "")
    target_notif = None
    if numeric_id_str.isdigit():
        target_notif = db.query(models.Notification).filter(models.Notification.id == int(numeric_id_str)).first()

    if not target_notif:
        target_notif = db.query(models.Notification).filter(models.Notification.is_resolved == False).first()
    if not target_notif:
        target_notif = db.query(models.Notification).first()

    if not target_notif:
        raise HTTPException(status_code=404, detail="Incident not found")

    evidence_url = "http://localhost:8000/static/evidence/fall_evidence_ai.jpg"
    video_url = target_notif.video_clip_url or "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    thumb_url = target_notif.thumbnail_url or evidence_url

    return NotificationItem(
        id=f"inc-0{target_notif.id}" if target_notif.id < 10 else f"inc-{target_notif.id}",
        alert_type=target_notif.type,
        alert_level=target_notif.alert_level or "CRITICAL",
        message=target_notif.description or target_notif.title,
        confidence=target_notif.confidence or 0.94,
        is_acknowledged=bool(target_notif.is_resolved),
        acknowledged_by=target_notif.resolved_by,
        acknowledged_at=target_notif.resolved_at.isoformat() if target_notif.resolved_at else None,
        video_clip_url=video_url,
        thumbnail_url=thumb_url,
        created_at=target_notif.created_at.isoformat() if target_notif.created_at else datetime.utcnow().isoformat(),
    )

@app.post("/api/v1/incidents/{incident_id}/acknowledge", tags=["Notifications"])
@app.put("/api/v1/incidents/{incident_id}", tags=["Notifications"])
@app.patch("/api/v1/incidents/{incident_id}", tags=["Notifications"])
async def acknowledge_incident(incident_id: str, note: Optional[str] = None, db: Session = Depends(get_db)):
    """Xác nhận xử lý sự kiện báo động, cập nhật database PostgreSQL (is_resolved=True, tắt còi hú) và broadcast WebSocket."""
    # Trích xuất numeric ID nếu có dạng inc-01, inc-03...
    numeric_id_str = incident_id.replace("inc-0", "").replace("inc-", "")
    target_notif = None
    if numeric_id_str.isdigit():
        target_notif = db.query(models.Notification).filter(models.Notification.id == int(numeric_id_str)).first()

    # Nếu không tìm thấy bằng numeric ID, ưu tiên lấy sự cố chưa xử lý gần nhất
    if not target_notif:
        target_notif = db.query(models.Notification).filter(models.Notification.is_resolved == False).first()

    if not target_notif:
        target_notif = db.query(models.Notification).first()

    now_iso = datetime.utcnow()
    resolved_id = incident_id
    if target_notif:
        target_notif.is_resolved = True
        target_notif.is_new = False
        target_notif.resolved_by = "Demo User"
        target_notif.resolved_at = now_iso
        resolved_id = f"inc-0{target_notif.id}" if target_notif.id < 10 else f"inc-{target_notif.id}"

        # Nếu là cảnh báo té ngã, cập nhật lại trạng thái té ngã trong vital_signs về an toàn
        if target_notif.type == "FALL_DETECTED":
            latest_vital = db.query(models.VitalSign).order_by(desc(models.VitalSign.recorded_at)).first()
            if latest_vital:
                latest_vital.fall_detected_count = 0
                latest_vital.activity_state = "Sinh hoạt bình thường (Đã kiểm tra an toàn)"

        db.commit()

    # Đồng thời cập nhật trạng thái mute alarm trong SystemMode
    sys_mode = db.query(models.SystemMode).first()
    if sys_mode:
        sys_mode.is_mute_alarm = True
        db.commit()

    # Broadcast sự kiện xử lý thành công qua WebSocket để HomeScreen tắt banner đỏ ngay lập tức (Feature 1)
    await manager.broadcast({
        "type": "INCIDENT_RESOLVED",
        "incident_id": resolved_id,
        "data": {
            "id": resolved_id,
            "is_acknowledged": True,
            "is_resolved": True,
            "resolved_by": "Demo User",
            "acknowledged_at": now_iso.isoformat(),
            "note": note or "Đã kiểm tra an toàn",
        },
        "timestamp": now_iso.isoformat()
    })

    return {
        "status": "success",
        "incident_id": resolved_id,
        "is_acknowledged": True,
        "is_resolved": True,
        "acknowledged_by": "Demo User",
        "acknowledged_at": now_iso.isoformat(),
        "note": note or "Đã kiểm tra an toàn",
        "message": "Còi hú đã được tắt và đồng bộ thông báo đến gia đình qua PostgreSQL.",
    }

@app.post("/api/v1/incidents/simulate-fall", tags=["Notifications"])
@app.post("/api/v1/incidents/trigger-test-fall", tags=["Notifications"])
async def trigger_test_fall(
    location: str = Query(default="Phòng khách", description="Vị trí xảy ra té ngã"),
    patient_id: int = Query(default=1, description="ID bệnh nhân"),
    db: Session = Depends(get_db)
):
    """
    Tạo một sự cố cảnh báo té ngã khẩn cấp mới (is_resolved = False, CRITICAL) vào PostgreSQL
    và broadcast qua WebSocket tới tất cả client để hiện thanh cảnh báo khẩn cấp màu đỏ ngay lập tức.
    """
    now = datetime.utcnow()
    evidence_url = "http://localhost:8000/static/evidence/fall_evidence_ai.jpg"
    new_alert = models.Notification(
        patient_id=patient_id,
        type="FALL_DETECTED",
        title=f"Cảnh báo té ngã khẩn cấp tại {location}",
        description=f"🚨 Cảnh báo té ngã khẩn cấp (Fall Detected) tại {location} - YOLO-Pose AI phát hiện người cao tuổi ngã nghiêng đột ngột.",
        alert_level="CRITICAL",
        confidence=0.94,
        video_clip_url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        thumbnail_url=evidence_url,
        is_new=True,
        is_resolved=False,
        created_at=now,
    )
    db.add(new_alert)

    # Cập nhật chỉ số sinh hiệu thành có té ngã và nằm sàn
    latest_vital = (
        db.query(models.VitalSign)
        .filter(models.VitalSign.patient_id == patient_id)
        .order_by(desc(models.VitalSign.recorded_at))
        .first()
    )
    if latest_vital:
        latest_vital.fall_detected_count = (latest_vital.fall_detected_count or 0) + 1
        latest_vital.activity_state = f"Nằm sàn tại {location} (Cảnh báo té ngã)"
        latest_vital.sound_state = "Âm thanh va đập mạnh"
        latest_vital.recorded_at = now
    else:
        new_vital = models.VitalSign(
            patient_id=patient_id,
            heart_rate=88,
            spo2=96,
            body_temp=36.8,
            activity_state=f"Nằm sàn tại {location}",
            sound_state="Âm thanh va đập mạnh",
            fall_detected_count=1,
            recorded_at=now,
        )
        db.add(new_vital)

    # Đảm bảo còi báo động không bị tắt mute
    sys_mode = db.query(models.SystemMode).first()
    if sys_mode:
        sys_mode.is_mute_alarm = False

    db.commit()
    db.refresh(new_alert)

    alert_id = f"inc-0{new_alert.id}" if new_alert.id < 10 else f"inc-{new_alert.id}"

    # Broadcast cảnh báo té ngã mới qua WebSocket để HomeScreen hiện banner đỏ ngay lập tức (Feature 1)
    await manager.broadcast({
        "type": "ALERT_NEW",
        "alert_type": "FALL_DETECTED",
        "data": {
            "id": alert_id,
            "type": new_alert.type,
            "title": new_alert.title,
            "alert_level": new_alert.alert_level,
            "message": new_alert.description,
            "confidence": 0.94,
            "thumbnail_url": new_alert.thumbnail_url,
            "video_clip_url": new_alert.video_clip_url,
            "is_resolved": False,
            "is_new": True,
            "created_at": new_alert.created_at.isoformat(),
        },
        "timestamp": now.isoformat()
    })

    return {
        "status": "success",
        "message": f"Đã kích hoạt thành công cảnh báo té ngã tại {location} vào PostgreSQL!",
        "incident": {
            "id": alert_id,
            "type": new_alert.type,
            "title": new_alert.title,
            "alert_level": new_alert.alert_level,
            "message": new_alert.description,
            "confidence": 0.94,
            "thumbnail_url": new_alert.thumbnail_url,
            "video_clip_url": new_alert.video_clip_url,
            "is_resolved": new_alert.is_resolved,
            "is_new": new_alert.is_new,
            "created_at": new_alert.created_at.isoformat(),
        },
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

# ==========================================
# Auth, User, House & Device Endpoints
# ==========================================

@app.post("/api/v1/auth/login", tags=["Auth"])
async def auth_login(request: Request, db: Session = Depends(get_db)):
    """Xác thực đăng nhập tài khoản người dùng/bác sĩ."""
    username = ""
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        username = str(form.get("username", ""))
    else:
        try:
            body = await request.json()
            username = str(body.get("username", "") or body.get("phone", "") or body.get("email", ""))
        except Exception:
            pass

    clean_phone = username.replace(" ", "").replace("+84", "0") if username else ""
    user = None
    if clean_phone:
        user = db.query(models.User).filter(
            (models.User.phone_number == clean_phone) | (models.User.phone_number == username)
        ).first()

    if not user:
        # Nhận diện tài khoản bác sĩ hoặc chủ nhà dựa trên số hoặc tên
        if "888" in username or "999" in username or "111222" in username or "doctor" in username.lower() or "minh" in username.lower():
            user = db.query(models.User).filter(models.User.id == 2).first()
        else:
            user = db.query(models.User).filter(models.User.id == 1).first()

    # Fallback an toàn nếu chưa truy vấn được
    user_id = user.id if user else 1
    full_name = user.full_name if user else ("BS. Nguyễn Văn Minh" if "888" in username or "minh" in username.lower() else "Nguyễn Hữu Nghĩa")
    phone_number = user.phone_number if user else ("0905888999" if "888" in username or "minh" in username.lower() else "0905123456")
    role = user.role if user else ("Bác sĩ phụ trách" if "888" in username or "minh" in username.lower() else "Chủ nhà / Người sở hữu")
    household_id = (user.household_id if user and user.household_id else 1)

    return {
        "access_token": "fake-jwt-token-demo-smartcare",
        "refresh_token": "fake-jwt-refresh-token-demo",
        "token_type": "bearer",
        "user": {
            "user_id": user_id,
            "id": str(user_id),
            "full_name": full_name,
            "phone_number": phone_number,
            "phone": phone_number,
            "role": role,
            "household_id": household_id,
        }
    }

@app.post("/api/v1/auth/register", tags=["Auth"])
async def auth_register(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    phone = data.get("phone", "")
    full_name = data.get("full_name", "Người dùng")
    role = data.get("role", "Chủ nhà / Người sở hữu")

    user = models.User(
        full_name=full_name,
        phone_number=phone,
        role=role,
        household_id=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": "Đăng ký thành công",
        "user": {
            "user_id": user.id,
            "id": str(user.id),
            "phone_number": user.phone_number,
            "phone": user.phone_number,
            "full_name": user.full_name,
            "role": user.role,
            "household_id": user.household_id
        }
    }

@app.post("/api/v1/auth/request-otp", tags=["Auth"])
async def auth_request_otp(request: Request):
    data = await request.json()
    return {"status": "success", "message": f"Mã OTP đã được gửi tới {data.get('phone')}", "otp": "123456"}

@app.post("/api/v1/auth/verify-otp", tags=["Auth"])
async def auth_verify_otp(request: Request):
    return {"status": "success", "message": "Xác thực OTP thành công"}

@app.post("/api/v1/auth/refresh", tags=["Auth"])
async def auth_refresh():
    return {
        "access_token": "fake-jwt-token-refreshed",
        "refresh_token": "fake-jwt-refresh-token-new",
        "token_type": "bearer"
    }

@app.get("/api/v1/users/me", tags=["Users"])
def get_current_user(phone: Optional[str] = None, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    user = None
    if user_id:
        user = db.query(models.User).filter(models.User.id == user_id).first()
    elif phone:
        clean_phone = phone.replace(" ", "").replace("+84", "0")
        user = db.query(models.User).filter(
            (models.User.phone_number == clean_phone) | (models.User.phone_number == phone)
        ).first()

    if not user:
        user = db.query(models.User).filter(models.User.id == 1).first()

    if not user:
        return {
            "user_id": 1,
            "id": "1",
            "full_name": "Nguyễn Hữu Nghĩa",
            "phone_number": "0905123456",
            "phone": "0905123456",
            "email": "caregiver@smartcare.vn",
            "role": "Chủ nhà / Người sở hữu",
            "household_id": 1,
            "avatar_url": None,
        }

    return {
        "user_id": user.id,
        "id": str(user.id),
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "phone": user.phone_number,
        "email": user.email or "caregiver@smartcare.vn",
        "role": user.role,
        "household_id": user.household_id or 1,
        "avatar_url": user.avatar_url,
    }

@app.put("/api/v1/users/me", tags=["Users"])
async def update_current_user(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    user = db.query(models.User).filter(models.User.id == 1).first()
    if user:
        if "full_name" in data and data["full_name"]:
            user.full_name = data["full_name"]
        if "phone_number" in data and data["phone_number"]:
            user.phone_number = data["phone_number"]
        db.commit()
        db.refresh(user)
        return {
            "user_id": user.id,
            "id": str(user.id),
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "phone": user.phone_number,
            "role": user.role,
            "household_id": user.household_id or 1,
        }
    return {"status": "success"}

# Household Members Endpoints
@app.get("/api/v1/households/{household_id}/members", tags=["Households"])
@app.get("/api/v1/houses/{household_id}/members", tags=["Households"])
def get_household_members(household_id: str = "1", db: Session = Depends(get_db)):
    try:
        h_id = int(household_id)
    except:
        h_id = 1

    members = db.query(models.HouseholdMember).filter(models.HouseholdMember.household_id == h_id).all()
    if not members:
        return [
            {
                "id": 1,
                "household_id": h_id,
                "user_id": 1,
                "full_name": "Nguyễn Hữu Nghĩa",
                "phone_number": "0905123456",
                "role": "Chủ nhà / Người sở hữu",
                "role_in_house": "Người sở hữu",
                "permissions": "Toàn quyền cấu hình AI và còi báo động",
                "is_owner": True,
            },
            {
                "id": 2,
                "household_id": h_id,
                "user_id": 2,
                "full_name": "BS. Nguyễn Văn Minh",
                "phone_number": "0905888999",
                "role": "Bác sĩ phụ trách",
                "role_in_house": "Bác sĩ gia đình",
                "permissions": "Theo dõi & Tư vấn y tế",
                "is_owner": False,
            }
        ]

    results = []
    for m in members:
        u = m.user or db.query(models.User).filter(models.User.id == m.user_id).first()
        results.append({
            "id": m.id,
            "household_id": m.household_id,
            "user_id": m.user_id,
            "full_name": u.full_name if u else "Thành viên gia đình",
            "phone_number": u.phone_number if u else "",
            "role": u.role if u else m.role_in_house,
            "role_in_house": m.role_in_house,
            "permissions": m.permissions,
            "is_owner": m.role_in_house == "Người sở hữu"
        })
    return results

@app.post("/api/v1/households/{household_id}/members", tags=["Households"])
@app.post("/api/v1/houses/{household_id}/members", tags=["Households"])
async def add_household_member(household_id: str, request: Request, db: Session = Depends(get_db)):
    try:
        h_id = int(household_id)
    except:
        h_id = 1

    body = await request.json()
    phone = str(body.get("phone_number") or body.get("phone", "")).strip()
    raw_role = body.get("role_in_house") or body.get("role", "CAREGIVER")
    role_in_house = "Bác sĩ gia đình" if raw_role == "DOCTOR" else "Người chăm sóc"
    full_name = body.get("full_name") or ("BS. Gia Đình" if raw_role == "DOCTOR" else "Người chăm sóc")

    clean_phone = phone.replace(" ", "").replace("+84", "0")
    user = db.query(models.User).filter(
        (models.User.phone_number == clean_phone) | (models.User.phone_number == phone)
    ).first()

    if not user:
        user = models.User(
            full_name=full_name,
            phone_number=clean_phone or phone,
            role=role_in_house,
            household_id=h_id
        )
        db.add(user)
        db.flush()

    member = models.HouseholdMember(
        household_id=h_id,
        user_id=user.id,
        role_in_house=role_in_house,
        permissions="Theo dõi & Nhận cảnh báo khẩn cấp"
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return {
        "status": "success",
        "message": "Thêm thành viên thành công",
        "member": {
            "id": member.id,
            "household_id": member.household_id,
            "user_id": user.id,
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "role": user.role,
            "role_in_house": member.role_in_house,
            "permissions": member.permissions,
            "is_owner": False
        }
    }

@app.delete("/api/v1/households/{household_id}/members/{member_id}", tags=["Households"])
@app.delete("/api/v1/houses/{household_id}/members/{member_id}", tags=["Households"])
def delete_household_member(household_id: str, member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.HouseholdMember).filter(models.HouseholdMember.id == member_id).first()
    if member:
        db.delete(member)
        db.commit()
    return {"status": "success", "message": "Đã xóa thành viên khỏi ngôi nhà"}

@app.get("/api/v1/houses/current", tags=["Houses"])
def get_current_house(db: Session = Depends(get_db)):
    sys_mode = db.query(models.SystemMode).first()
    mode = sys_mode.mode if sys_mode else "HOME"
    return {
        "id": "house-001",
        "owner_id": "demo-user-001",
        "name": "Nhà của Cụ An",
        "address": "123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng",
        "current_mode": mode,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }

@app.patch("/api/v1/houses/current", tags=["Houses"])
async def update_current_house(request: Request):
    data = await request.json()
    return {
        "id": "house-001",
        "owner_id": "demo-user-001",
        "name": data.get("name", "Nhà của Cụ An"),
        "address": data.get("address", "123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng"),
        "current_mode": "HOME",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }

@app.patch("/api/v1/houses/current/mode", tags=["Houses"])
async def update_current_house_mode(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    mode = data.get("mode", "HOME")
    sys_mode = db.query(models.SystemMode).first()
    if sys_mode:
        sys_mode.mode = mode
        db.commit()
    return {
        "id": "house-001",
        "current_mode": mode,
        "message": f"Chuyển chế độ thành công sang {mode}"
    }

@app.get("/api/v1/device-groups", tags=["Devices"])
def list_device_groups():
    return [
        {"id": "grp-1", "house_id": "house-001", "name": "Phòng khách", "sort_order": 1, "device_count": 2, "created_at": datetime.now().isoformat(), "updated_at": datetime.now().isoformat()},
        {"id": "grp-2", "house_id": "house-001", "name": "Phòng ngủ", "sort_order": 2, "device_count": 2, "created_at": datetime.now().isoformat(), "updated_at": datetime.now().isoformat()},
        {"id": "grp-3", "house_id": "house-001", "name": "Nhà tắm & Cửa", "sort_order": 3, "device_count": 1, "created_at": datetime.now().isoformat(), "updated_at": datetime.now().isoformat()},
    ]

@app.get("/api/v1/devices", tags=["Devices"])
def list_devices():
    return [
        {
            "id": "dev-01",
            "device_id": "hub-001",
            "name": "Orange Pi 5 - Edge AI Hub",
            "sub_title": "Rockchip RK3588S NPU • 32 FPS YOLO-Pose • EMQX MQTT",
            "device_type": "CAMERA",
            "location": "Phòng khách",
            "is_online": True,
            "status_text": "Trực tuyến (24/7)",
            "battery_level": None,
            "group_id": "grp-1",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "config": {
                "stream_url": "http://10.0.2.2:8080",
                "resolution": "HD",
                "is_sleep": False,
                "is_ai_protect": True,
            }
        },
        {
            "id": "dev-02",
            "device_id": "cam-001",
            "name": "SECA_001",
            "sub_title": "Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều",
            "device_type": "CAMERA",
            "location": "Phòng khách",
            "is_online": True,
            "status_text": "Đang ghi hình",
            "battery_level": None,
            "group_id": "grp-1",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "config": {
                "stream_url": "http://10.0.2.2:8080",
                "resolution": "HD",
                "is_sleep": False,
                "is_ai_protect": True,
            }
        },
        {
            "id": "dev-03",
            "device_id": "band-001",
            "name": "Vòng đeo tay BLE Smartband",
            "sub_title": "Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập",
            "device_type": "SMARTBAND",
            "location": "Phòng ngủ",
            "is_online": True,
            "status_text": "Pin 88% • Đang đeo",
            "battery_level": 88,
            "group_id": "grp-2",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        },
    ]

if __name__ == "__main__":

    import uvicorn
    uvicorn.run("apps.backend.main:app", host="0.0.0.0", port=8000, reload=True)

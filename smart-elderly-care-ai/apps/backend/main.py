# apps/backend/main.py
# SmartCare AI - Backend API Service
# Fast, lightweight FastAPI server with mock endpoints for Elderly Care AI

from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="SmartCare AI Backend",
    description="Backend API Service for Smart Home Elderly Care AI System",
    version="1.0.0",
)

# ---- 1. Cấu hình CORS mở để frontend React Native kết nối được ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Data Models (Pydantic) ----

class HealthResponse(BaseModel):
    status: str
    message: str
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

# ---- Mock in-memory state ----
system_state = {
    "mode": "HOME",
    "is_mute_alarm": False,
    "is_camera_privacy": False,
    "alarm_snooze_until": None,
    "mute_mode": "VIBRATE",
}

# ---- Endpoints ----

@app.get("/", tags=["Root"])
def root():
    return {
        "service": "SmartCare AI Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }

# 1. Health check endpoint
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Kiểm tra trạng thái hoạt động của backend service."""
    return {
        "status": "ok",
        "message": "SmartCare AI Backend is running",
        "timestamp": datetime.utcnow(),
    }

# 2. System Mode API
@app.get("/api/v1/system/mode", response_model=SystemModeResponse, tags=["System"])
def get_system_mode():
    """Lấy trạng thái chế độ an ninh & chuông báo động hiện tại."""
    return system_state

@app.put("/api/v1/system/mode", response_model=SystemModeResponse, tags=["System"])
def update_system_mode(payload: SystemModeUpdate):
    """Cập nhật chế độ bảo vệ nhà hoặc tạm tắt chuông báo động."""
    if payload.mode is not None:
        system_state["mode"] = payload.mode
    if payload.is_mute_alarm is not None:
        system_state["is_mute_alarm"] = payload.is_mute_alarm
    if payload.is_camera_privacy is not None:
        system_state["is_camera_privacy"] = payload.is_camera_privacy
    if payload.mute_mode is not None:
        system_state["mute_mode"] = payload.mute_mode
    return system_state

# 3. Current Vitals API
@app.get("/api/v1/vitals/current", response_model=CurrentVitalsResponse, tags=["Vitals"])
def get_current_vitals():
    """Lấy dữ liệu sinh hiệu thời gian thực từ Vòng đeo tay BLE & Camera AI Edge Hub."""
    return {
        "heart_rate": 74,
        "spo2": 98,
        "body_temp": 36.8,
        "activity": "Sinh hoạt",
        "sound": "Bình thường",
        "fall_detected": False,
        "person_count": 1,
        "bracelet_battery": 88,
        "edge_hub_connected": True,
        "timestamp": int(datetime.utcnow().timestamp() * 1000),
    }

# 4. Reminders Today API
@app.get("/api/v1/reminders/today", response_model=RemindersResponse, tags=["Reminders"])
def get_today_reminders():
    """Lấy danh sách lịch nhắc uống thuốc & sinh hoạt hôm nay."""
    today_str = datetime.now().strftime("%d/%m/%Y")
    return {
        "date": today_str,
        "total_medications": 5,
        "completed_medications": 3,
        "hub_voice_reminder_enabled": True,
        "medications": [
            {
                "id": "m1",
                "name": "Glucosamine Sulfate 1500mg",
                "time": "07:30",
                "session": "MORNING",
                "dose": "1 gói sau khi ăn sáng",
                "purpose": "Bôi trơn khớp gối, ngừa thoái hóa",
                "taken": True,
            },
            {
                "id": "m2",
                "name": "Vitamin B-Complex tổng hợp",
                "time": "07:30",
                "session": "MORNING",
                "dose": "1 viên sau bữa sáng",
                "purpose": "Tăng cường tuần hoàn máu não",
                "taken": True,
            },
            {
                "id": "m3",
                "name": "Canxi Nano + D3 MK7",
                "time": "12:00",
                "session": "NOON",
                "dose": "1 viên sủi sau ăn trưa",
                "purpose": "Ngừa loãng xương & chắc khỏe xương",
                "taken": True,
            },
            {
                "id": "m4",
                "name": "Amlodipine 5mg (Thuốc huyết áp)",
                "time": "18:30",
                "session": "EVENING",
                "dose": "1 viên sau bữa tối",
                "purpose": "Kiểm soát huyết áp nền < 130/80",
                "taken": True,
            },
            {
                "id": "m5",
                "name": "Metformin 500mg",
                "time": "18:30",
                "session": "EVENING",
                "dose": "1 viên sau bữa tối",
                "purpose": "Ổn định đường huyết đái tháo đường",
                "taken": False,
            },
        ],
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
def get_patient_medical_record(patient_id: int):
    """Lấy chi tiết hồ sơ bệnh án người cao tuổi (Bảo mật chuẩn AES-256)."""
    if patient_id != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID {patient_id} not found",
        )

    return {
        "patient_id": 1,
        "name": "Nguyễn Văn An",
        "birth_year": "1948",
        "age": 78,
        "gender": "Nam",
        "blood_type": "O+",
        "height_cm": 165,
        "weight_kg": 62,
        "bmi": 22.8,
        "security_badge": "Bảo mật y tế AES-256",
        "conditions": [
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
        ],
        "drug_allergies": "Penicillin, Aspirin liều cao",
        "food_allergies": "Tôm, cua biển (Hải sản có vỏ)",
        "dietary_notes": "Ăn nhạt, giảm muối (<5g/ngày), uống đủ 1.5 - 2L nước ấm",
        "doctor_name": "BSCKII. Trần Minh Đức",
        "doctor_phone": "0988 123 456",
        "doctor_specialty": "Lão khoa & Tim mạch",
        "hospital": "Bệnh viện Lão khoa TW / BV Chợ Rẫy",
        "next_appointment": "15/10/2026",
    }

# 6. Notifications & Incidents API
@app.get(
    "/api/v1/notifications",
    response_model=List[NotificationItem],
    tags=["Notifications"],
)
def get_notifications(limit: int = Query(default=20, ge=1, le=100)):
    """Lấy danh sách các sự cố cảnh báo và thông báo an ninh hệ thống."""
    return [
        {
            "id": "inc-01",
            "alert_type": "FALL_DETECTED",
            "alert_level": "CRITICAL",
            "message": "🚨 Cảnh báo té ngã khẩn cấp (Fall Detected) tại phòng ngủ - YOLO-Pose AI",
            "confidence": 0.94,
            "is_acknowledged": False,
            "acknowledged_by": None,
            "acknowledged_at": None,
            "video_clip_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "thumbnail_url": "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=300&q=80",
            "created_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "inc-02",
            "alert_type": "HIGH_HEART_RATE",
            "alert_level": "HIGH",
            "message": "Nhịp tim đo được từ vòng đeo tay BLE Band: 128 bpm (Vượt ngưỡng an toàn 100 bpm)",
            "confidence": 0.96,
            "is_acknowledged": True,
            "acknowledged_by": "BSCKII. Trần Minh Đức",
            "acknowledged_at": datetime.utcnow().isoformat(),
            "video_clip_url": None,
            "thumbnail_url": None,
            "created_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "inc-03",
            "alert_type": "ACOUSTIC_DISTRESS",
            "alert_level": "CRITICAL",
            "message": "Phát hiện âm thanh kêu cứu: 'Cứu tôi với!' tại khu vực phòng khách (YAMNet AI)",
            "confidence": 0.91,
            "is_acknowledged": True,
            "acknowledged_by": "Demo User",
            "acknowledged_at": datetime.utcnow().isoformat(),
            "video_clip_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "thumbnail_url": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=300&q=80",
            "created_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "inc-04",
            "alert_type": "PERSON_DETECTED",
            "alert_level": "LOW",
            "message": "Nhận diện người cao tuổi đang sinh hoạt tại phòng khách (YOLOv8)",
            "confidence": 0.98,
            "is_acknowledged": True,
            "acknowledged_by": "Demo User",
            "acknowledged_at": datetime.utcnow().isoformat(),
            "video_clip_url": None,
            "thumbnail_url": "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=300&q=80",
            "created_at": datetime.utcnow().isoformat(),
        },
    ][:limit]

@app.post("/api/v1/incidents/{incident_id}/acknowledge", tags=["Notifications"])
def acknowledge_incident(incident_id: str, note: Optional[str] = None):
    """Xác nhận xử lý sự kiện báo động & tắt còi hú."""
    return {
        "status": "success",
        "incident_id": incident_id,
        "is_acknowledged": True,
        "acknowledged_by": "Demo User",
        "acknowledged_at": datetime.utcnow().isoformat(),
        "note": note or "Đã kiểm tra an toàn",
        "message": "Còi hú đã được tắt và đồng bộ thông báo đến gia đình.",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

"""
report.py – Pydantic Schemas cho API Báo cáo Sức khỏe (PDF, Excel & JSON Summary).
Vị trí: backend/app/schemas/report.py
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class HealthReportSummaryOut(BaseModel):
    """
    Dữ liệu báo cáo sức khỏe tổng quan thực tế từ CSDL TimescaleDB / PostgreSQL.
    Tương thích 100% với MedicalReportScreen trên Mobile App.
    """
    period: str = "WEEK"  # "WEEK" | "MONTH"
    days: int = 7
    label: str = ""  # VD: "08 - 14 Tháng 9, 2026"
    readings: str = "0"  # VD: "1.008"
    total_readings: int = 0

    # 4 thẻ chỉ số chính
    heartRate: str = "--"  # "73"
    heartRateRaw: Optional[float] = None
    heartRateDelta: str = "0 bpm"  # "+2 bpm", "-1 bpm"

    spo2: str = "--"  # "98,2"
    spo2Raw: Optional[float] = None
    spo2Status: str = "Trong ngưỡng an toàn"

    temperature: str = "--"  # "36,7"
    temperatureRaw: Optional[float] = None
    temperatureStatus: str = "Ổn định"

    adherence: str = "0%"  # "94%"
    adherencePct: int = 0

    # Thẻ Hero: Điểm sức khỏe
    healthScore: str = "Ổn định"  # "Ổn định", "Cần theo dõi", "Cảnh báo", "Chưa có dữ liệu"
    healthScoreTrend: str = "Tốt"  # "Tốt", "Ổn định", "Cần chú ý", "Bất thường"
    healthScoreProgress: float = 0.85  # 0.0 -> 1.0

    # Biểu đồ chuỗi thời gian
    heartRateData: List[float] = Field(default_factory=list)
    spo2Data: List[float] = Field(default_factory=list)
    labels: List[str] = Field(default_factory=list)

    # Cảnh báo & sự kiện
    falls: str = "0"
    fallsCount: int = 0
    anomalies: str = "0"
    anomaliesCount: int = 0

    # Thiết bị & trạng thái đồng bộ
    isSynced: bool = True
    deviceId: Optional[str] = None
    deviceName: Optional[str] = None
    patientName: Optional[str] = None
    hasData: bool = False


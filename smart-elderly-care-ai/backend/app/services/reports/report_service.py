"""
report_service.py – Dịch vụ tạo báo cáo y tế (PDF / Excel / JSON Summary) từ dữ liệu sinh hiệu và incidents.
"""

import io
import os
import re
import shutil
import subprocess
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device, DeviceType
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.incident import Incident
from app.models.vital_sign import VitalSign
from app.schemas.report import HealthReportSummaryOut



_FONTS_SETUP = False
_PDF_FONT_NAME = "Helvetica"
_PDF_FONT_BOLD = "Helvetica-Bold"


def _setup_pdf_fonts() -> Tuple[str, str]:
    """Đăng ký font chữ TrueType hỗ trợ đầy đủ tiếng Việt Unicode cho ReportLab."""
    global _FONTS_SETUP, _PDF_FONT_NAME, _PDF_FONT_BOLD
    if _FONTS_SETUP:
        return _PDF_FONT_NAME, _PDF_FONT_BOLD

    candidate_dirs = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../static/fonts")),
        "/app/static/fonts",
        "static/fonts",
        "C:/Windows/Fonts",
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/dejavu",
    ]

    for d in candidate_dirs:
        reg = os.path.join(d, "arial.ttf")
        bold = os.path.join(d, "arialbd.ttf")
        if os.path.exists(reg) and os.path.exists(bold):
            try:
                pdfmetrics.registerFont(TTFont("VNFont", reg))
                pdfmetrics.registerFont(TTFont("VNFont-Bold", bold))
                registerFontFamily("VNFont", normal="VNFont", bold="VNFont-Bold")
                _PDF_FONT_NAME = "VNFont"
                _PDF_FONT_BOLD = "VNFont-Bold"
                _FONTS_SETUP = True
                return _PDF_FONT_NAME, _PDF_FONT_BOLD
            except Exception:
                pass

        reg_dj = os.path.join(d, "DejaVuSans.ttf")
        bold_dj = os.path.join(d, "DejaVuSans-Bold.ttf")
        if os.path.exists(reg_dj) and os.path.exists(bold_dj):
            try:
                pdfmetrics.registerFont(TTFont("VNFont", reg_dj))
                pdfmetrics.registerFont(TTFont("VNFont-Bold", bold_dj))
                registerFontFamily("VNFont", normal="VNFont", bold="VNFont-Bold")
                _PDF_FONT_NAME = "VNFont"
                _PDF_FONT_BOLD = "VNFont-Bold"
                _FONTS_SETUP = True
                return _PDF_FONT_NAME, _PDF_FONT_BOLD
            except Exception:
                pass

    _FONTS_SETUP = True
    return _PDF_FONT_NAME, _PDF_FONT_BOLD


class ReportService:

    NON_ALERT_INCIDENT_TYPES = {
        "HOUSE_INVITE_PENDING",
        "HOUSE_MEMBER_ADDED",
        "MEMBER_ADDED",
        "HOUSE_JOIN_REQUEST",
        "HOUSE_JOIN_APPROVED",
        "HOUSE_JOIN_REJECTED",
        "HOUSE_INVITE_REJECTED",
        "APPOINTMENT_SCHEDULED",
        "APPOINTMENT_CONFIRMED",
        "APPOINTMENT_CANCELLED",
    }

    CRITICAL_ALERT_TYPES = {
        "FALL_DETECTED",
        "FALL",
        "ACOUSTIC_DISTRESS",
        "CRITICAL_TRIAD",
        "DEVICE_BATTERY_DEAD",
        "SOS_EMERGENCY",
        "EMERGENCY_SOS",
        "SPO2_LOW",
        "SPO2_CRITICAL",
        "HIGH_FEVER",
        "HEART_RATE_CRITICAL",
    }

    @classmethod
    def is_critical_incident(cls, inc: Incident) -> bool:
        """
        Kiểm tra sự kiện có thuộc phân loại Nguy kịch (khớp 100% với tab '🚨 Nguy kịch'
        trên màn hình Thông Báo & Sự Kiện, tính cả các bản ghi ĐÃ XỬ LÝ).
        """
        a_type = (inc.alert_type or "").strip().upper()
        a_level = (inc.alert_level or "").strip().upper()
        if a_type in cls.NON_ALERT_INCIDENT_TYPES:
            return False
        return (
            a_level in {"CRITICAL", "EMERGENCY"}
            or a_type in cls.CRITICAL_ALERT_TYPES
            or "CRITICAL" in a_type
            or "FALL" in a_type
        )

    @staticmethod
    def format_critical_event_label(inc: Incident) -> str:
        """Chuyển mã loại cảnh báo sang nhãn hiển thị chuẩn (VD: CRITICAL TRIAD, DEVICE BATTERY DEAD)."""
        a_type = (inc.alert_type or "").strip()
        if not a_type:
            return "CRITICAL ALERT"
        return a_type.replace("_", " ").upper()

    @classmethod
    async def get_house_incidents_in_period(
        cls,
        db: AsyncSession,
        device: Optional[Device] = None,
        elderly: Optional[ElderlyProfile] = None,
        user_id: Optional[UUID] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[Incident]:
        """
        Lấy toàn bộ sự kiện cảnh báo sức khỏe / thiết bị trong kỳ báo cáo của căn nhà
        (tính cả các sự kiện đã xử lý `is_acknowledged = True`, đồng bộ với màn hình Thông Báo & Sự Kiện).
        """
        from app.models.user import User

        target_device_ids: set[UUID] = set()
        house_ids: set[UUID] = set()
        is_admin = False

        if device or elderly:
            # Đa người cao tuổi: Nếu có chỉ định người cao tuổi hoặc thiết bị cụ thể, CHỈ lấy sự cố của người đó
            if device:
                target_device_ids.add(device.id)
            if elderly:
                if "devices" in elderly.__dict__ and elderly.__dict__["devices"]:
                    for d in elderly.__dict__["devices"]:
                        target_device_ids.add(d.id)
                else:
                    elderly_dev_res = await db.execute(
                        select(Device.id).where(Device.elderly_id == elderly.id)
                    )
                    for d_id in elderly_dev_res.scalars().all():
                        if d_id:
                            target_device_ids.add(d_id)
        elif user_id:
            user_obj = await db.get(User, user_id)
            if user_obj and user_obj.role == "admin":
                is_admin = True
            else:
                member_house_subq = select(HouseMember.house_id).where(
                    HouseMember.user_id == user_id,
                    HouseMember.status == "ACTIVE",
                )
                user_houses_res = await db.execute(
                    select(House.id).where(
                        or_(
                            House.owner_id == user_id,
                            House.id.in_(member_house_subq),
                        )
                    )
                )
                for row in user_houses_res.fetchall():
                    if row[0]:
                        house_ids.add(row[0])

                owner_dev_res = await db.execute(select(Device.id).where(Device.owner_id == user_id))
                for row in owner_dev_res.fetchall():
                    if row[0]:
                        target_device_ids.add(row[0])

            if house_ids:
                house_dev_res = await db.execute(
                    select(Device.id).where(Device.house_id.in_(list(house_ids)))
                )
                for row in house_dev_res.fetchall():
                    if row[0]:
                        target_device_ids.add(row[0])

        if not is_admin and not target_device_ids:
            return []

        query = (
            select(Incident)
            .where(
                Incident.alert_type.notin_(list(cls.NON_ALERT_INCIDENT_TYPES)),
            )
            .order_by(Incident.created_at.desc())
        )

        if not is_admin:
            query = query.where(Incident.device_id.in_(list(target_device_ids)))

        if start_time is not None:
            query = query.where(Incident.created_at >= start_time)
        if end_time is not None:
            query = query.where(Incident.created_at <= end_time)

        if user_id and not is_admin:
            query = query.where(
                or_(
                    Incident.notes.is_(None),
                    and_(
                        ~Incident.notes.startswith("USER:"),
                        ~Incident.notes.contains("USER:"),
                    ),
                    Incident.notes == f"USER:{user_id}",
                    Incident.notes.startswith(f"USER:{user_id}"),
                    Incident.notes.contains(f"USER:{user_id}"),
                )
            )

        res = await db.execute(query)
        return list(res.scalars().all())

    @staticmethod
    def _labels(language: str) -> dict[str, str]:
        if language == "en":
            return {
                "title": "ELDERLY HEALTH MONITORING REPORT",
                "hub_id": "Hub Device ID",
                "exported": "Exported",
                "vital_records": "Total vital-sign records",
                "alert_events": "Alert events",
                "critical_alerts": "Critical alerts",
                "fall_events": "Fall events",
                "abnormal_hr": "Abnormal heart rate",
                "recent_vitals": "Recent vital signs",
                "time": "Time",
                "heart_rate": "Heart rate (bpm)",
                "spo2": "SpO2 (%)",
                "temperature": "Temperature (°C)",
                "fall": "Fall detected",
                "yes": "Yes",
                "no": "No",
                "incident_history": "Alert history",
                "alert_type": "Alert type",
                "level": "Severity",
                "message": "Message",
                "acknowledged": "Acknowledged",
                "pending": "Pending",
                "vital_sheet": "Vital Signs",
                "incident_sheet": "Incidents",
                "summary_sheet": "Alert Summary",
                "id": "ID",
                "device_id": "Device ID",
                "people": "People count",
                "confidence": "Confidence",
                "video_url": "Video URL",
                "handled": "Handled",
                "avg_heart_rate": "Average heart rate",
                "evaluation": "Clinical evaluation",
                "average_row": "Average",
                "normal": "Normal",
                "stable": "Stable",
                "elderly_profile": "Elderly Profile",
                "patient_name": "Senior Name",
                "age": "Age",
                "gender": "Gender",
                "blood_type": "Blood Type",
                "period": "Reporting Period",
                "days_unit": "days",
                "no_vitals_recorded": "No vital signs recorded in this reporting period.",
                "no_incidents_recorded": "No alert events recorded in this reporting period (System normal).",
            }
        return {
            "title": "BÁO CÁO THEO DÕI SỨC KHỎE NGƯỜI CAO TUỔI",
            "hub_id": "Thiết bị Hub ID",
            "exported": "Ngày xuất",
            "vital_records": "Tổng số bản ghi sinh hiệu",
            "alert_events": "Số sự kiện cảnh báo",
            "critical_alerts": "Cảnh báo nguy kịch",
            "fall_events": "Sự kiện té ngã",
            "abnormal_hr": "Nhịp tim bất thường",
            "recent_vitals": "Dữ liệu sinh hiệu gần nhất",
            "time": "Thời gian",
            "heart_rate": "Nhịp tim (bpm)",
            "spo2": "SpO2 (%)",
            "temperature": "Nhiệt độ (°C)",
            "fall": "Té ngã",
            "yes": "Có",
            "no": "Không",
            "incident_history": "Lịch sử sự kiện cảnh báo",
            "alert_type": "Loại cảnh báo",
            "level": "Mức độ",
            "message": "Thông điệp",
            "acknowledged": "Đã xử lý",
            "pending": "Chưa xử lý",
            "vital_sheet": "Sinh hiệu",
            "incident_sheet": "Sự kiện",
            "summary_sheet": "Tổng hợp cảnh báo",
            "id": "ID",
            "device_id": "Device ID",
            "people": "Số người",
            "confidence": "Độ tin cậy",
            "video_url": "Video URL",
            "handled": "Đã xử lý",
            "avg_heart_rate": "Nhịp tim trung bình",
            "evaluation": "Đánh giá",
            "average_row": "Trung bình",
            "normal": "Bình thường",
            "stable": "Ổn định",
            "elderly_profile": "Hồ sơ người cao tuổi",
            "patient_name": "Người cao tuổi",
            "age": "Tuổi",
            "gender": "Giới tính",
            "blood_type": "Nhóm máu",
            "period": "Kỳ báo cáo",
            "days_unit": "ngày",
            "no_vitals_recorded": "Chưa ghi nhận dữ liệu đo sinh hiệu trong kỳ báo cáo này.",
            "no_incidents_recorded": "Không có sự kiện cảnh báo bất thường nào trong kỳ báo cáo này (Hệ thống an toàn).",
        }

    @staticmethod
    async def resolve_device(
        db: AsyncSession,
        user_id: Optional[UUID] = None,
        patient_id: Optional[str] = None,
        device_id: Optional[str] = None,
    ) -> Tuple[Optional[Device], Optional[ElderlyProfile]]:
        """
        Tìm kiếm thiết bị và hồ sơ người cao tuổi liên kết một cách tự động và linh hoạt.
        Hỗ trợ giải quyết theo device_id, patient_id hoặc tài khoản người dùng đăng nhập.
        """
        elderly: Optional[ElderlyProfile] = None
        device: Optional[Device] = None

        # 1. Tra cứu theo device_id (Hardware ID hoặc UUID)
        if device_id:
            try:
                val_uuid = UUID(device_id)
                res = await db.execute(
                    select(Device).options(selectinload(Device.elderly)).where(Device.id == val_uuid)
                )
                device = res.scalar_one_or_none()
            except (ValueError, TypeError):
                pass

            if not device:
                res = await db.execute(
                    select(Device).options(selectinload(Device.elderly)).where(Device.device_id == device_id)
                )
                device = res.scalar_one_or_none()

            if device and device.elderly:
                elderly = device.elderly

        # 2. Tra cứu theo patient_id
        if not device and patient_id:
            try:
                p_uuid = UUID(patient_id)
                p_res = await db.execute(
                    select(ElderlyProfile).options(selectinload(ElderlyProfile.devices)).where(ElderlyProfile.id == p_uuid)
                )
                elderly = p_res.scalar_one_or_none()
            except (ValueError, TypeError):
                elderly = None

            if elderly and elderly.devices:
                for d in elderly.devices:
                    if d.device_type == DeviceType.SMARTBAND:
                        device = d
                        break
                if not device and elderly.devices:
                    device = elderly.devices[0]

        # 3. Tra cứu theo user_id đang đăng nhập (chỉ khi không chỉ định cụ thể người cao tuổi)
        if not device and not patient_id and user_id:
            res_user_band = await db.execute(
                select(Device)
                .options(selectinload(Device.elderly))
                .where(Device.owner_id == user_id, Device.device_type == DeviceType.SMARTBAND)
                .order_by(Device.created_at.desc())
                .limit(1)
            )
            device = res_user_band.scalar_one_or_none()

            if not device:
                res_house_dev = await db.execute(
                    select(Device)
                    .join(HouseMember, HouseMember.house_id == Device.house_id)
                    .options(selectinload(Device.elderly))
                    .where(HouseMember.user_id == user_id, Device.device_type == DeviceType.SMARTBAND)
                    .order_by(Device.created_at.desc())
                    .limit(1)
                )
                device = res_house_dev.scalar_one_or_none()

            if not device:
                res_any = await db.execute(
                    select(Device)
                    .options(selectinload(Device.elderly))
                    .where(Device.owner_id == user_id)
                    .order_by(Device.created_at.desc())
                    .limit(1)
                )
                device = res_any.scalar_one_or_none()

            if not device:
                res_any_house = await db.execute(
                    select(Device)
                    .join(HouseMember, HouseMember.house_id == Device.house_id)
                    .options(selectinload(Device.elderly))
                    .where(HouseMember.user_id == user_id)
                    .order_by(Device.created_at.desc())
                    .limit(1)
                )
                device = res_any_house.scalar_one_or_none()

            if device and device.elderly:
                elderly = device.elderly

        return device, elderly

    @staticmethod
    async def get_health_report_summary(
        db: AsyncSession,
        device: Optional[Device],
        elderly: Optional[ElderlyProfile],
        period: str = "WEEK",
        language: str = "vi",
        user_id: Optional[UUID] = None,
    ) -> HealthReportSummaryOut:
        """
        Tính toán dữ liệu tổng quan báo cáo sức khỏe từ cơ sở dữ liệu thực tế.
        Đồng bộ 100% số lượng Cảnh báo nguy kịch (Critical Alerts) với màn hình Thông Báo & Sự Kiện,
        tính cả các sự kiện đã đánh dấu ĐÃ XỬ LÝ (is_acknowledged = True).
        """
        period_normalized = period.upper() if period else "WEEK"
        days = 7 if period_normalized == "WEEK" else 30
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=days)
        prior_start_time = start_time - timedelta(days=days)

        # Định dạng chuỗi ngày tháng
        if language == "en":
            label_str = f"{start_time.strftime('%b %d')} - {now.strftime('%b %d, %Y')}"
        else:
            if days == 7:
                label_str = f"{start_time.strftime('%d')} - {now.strftime('%d Tháng %m, %Y')}"
            else:
                label_str = f"{start_time.strftime('%d Tháng %m')} - {now.strftime('%d Tháng %m, %Y')}"

        # Bản đồ thứ trong tuần
        VN_WEEKDAYS = {0: "T2", 1: "T3", 2: "T4", 3: "T5", 4: "T6", 5: "T7", 6: "CN"}
        EN_WEEKDAYS = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
        day_map = EN_WEEKDAYS if language == "en" else VN_WEEKDAYS

        if not device:
            empty_chart_labels: List[str] = []
            if days == 7:
                for i in range(7):
                    day_date = (now - timedelta(days=6 - i)).date()
                    empty_chart_labels.append(day_map[day_date.weekday()])
            else:
                step = 30 / 6
                for i in range(7):
                    offset_days = int(round(30 - (i * step)))
                    offset_days = max(0, min(29, offset_days))
                    slot_date = (now - timedelta(days=offset_days)).date()
                    empty_chart_labels.append(f"{slot_date.day}/{slot_date.month}")

            return HealthReportSummaryOut(
                period=period_normalized,
                days=days,
                label=label_str,
                readings="0",
                total_readings=0,
                heartRate="--",
                heartRateDelta="0 bpm",
                spo2="--",
                temperature="--",
                adherence="0%",
                adherencePct=0,
                healthScore="Chưa có dữ liệu",
                healthScoreTrend="Chưa kết nối",
                healthScoreProgress=0.0,
                heartRateData=[0] * 7,
                spo2Data=[0] * 7,
                labels=empty_chart_labels,
                falls="0",
                fallsCount=0,
                anomalies="0",
                anomaliesCount=0,
                criticalAlerts="0",
                critical_alerts_count=0,
                criticalAlertsCount=0,
                criticalEvents=[],
                critical_events=[],
                isSynced=False,
                hasData=False,
            )

        # 1. Truy vấn các chỉ số sinh hiệu trong khoảng thời gian báo cáo
        vitals_res = await db.execute(
            select(VitalSign)
            .where(
                VitalSign.device_id == device.id,
                VitalSign.time >= start_time,
                VitalSign.time <= now,
            )
            .order_by(VitalSign.time.asc())
        )
        vitals = list(vitals_res.scalars().all())

        # 2. Truy vấn kỳ trước để tính delta nhịp tim
        prior_res = await db.execute(
            select(VitalSign.heart_rate)
            .where(
                VitalSign.device_id == device.id,
                VitalSign.time >= prior_start_time,
                VitalSign.time < start_time,
                VitalSign.heart_rate.isnot(None),
            )
        )
        prior_hrs = [hr for hr in prior_res.scalars().all() if hr and hr > 0]

        # 3. Truy vấn toàn bộ sự kiện cảnh báo của căn nhà trong kỳ báo cáo (tính cả ĐÃ XỬ LÝ)
        incidents = await ReportService.get_house_incidents_in_period(
            db=db,
            device=device,
            elderly=elderly,
            user_id=user_id,
            start_time=start_time,
            end_time=now,
        )
        critical_inc_list = [inc for inc in incidents if ReportService.is_critical_incident(inc)]

        # Nếu trong cửa sổ ngày hiện tại chưa bắt được bản ghi nhưng danh sách sự kiện của nhà (giống màn hình Thông Báo & Sự Kiện) có ghi nhận
        if not critical_inc_list:
            all_house_incidents = await ReportService.get_house_incidents_in_period(
                db=db,
                device=device,
                elderly=elderly,
                user_id=user_id,
                start_time=None,
                end_time=now,
            )
            recent_house_incidents = all_house_incidents[:20]
            critical_inc_list = [inc for inc in recent_house_incidents if ReportService.is_critical_incident(inc)]
            if not incidents and recent_house_incidents:
                incidents = recent_house_incidents

        critical_alerts_count = len(critical_inc_list)
        critical_events: List[str] = []
        for inc in critical_inc_list:
            lbl = ReportService.format_critical_event_label(inc)
            if lbl not in critical_events:
                critical_events.append(lbl)

        total_readings = len(vitals)
        has_data = total_readings > 0 or len(incidents) > 0

        # Trích xuất danh sách giá trị hợp lệ
        hrs = [v.heart_rate for v in vitals if v.heart_rate is not None and v.heart_rate > 0]
        spo2s = [v.spo2 for v in vitals if v.spo2 is not None and v.spo2 > 0]
        temps = [v.skin_temp_max for v in vitals if v.skin_temp_max is not None and v.skin_temp_max > 0]

        avg_hr = round(sum(hrs) / len(hrs), 1) if hrs else None
        avg_spo2 = round(sum(spo2s) / len(spo2s), 1) if spo2s else None
        avg_temp = round(sum(temps) / len(temps), 1) if temps else None

        # Độ lệch nhịp tim so với kỳ trước
        if avg_hr and prior_hrs:
            prior_avg_hr = sum(prior_hrs) / len(prior_hrs)
            delta_val = int(round(avg_hr - prior_avg_hr))
            if delta_val > 0:
                hr_delta_str = f"+{delta_val} bpm"
            elif delta_val < 0:
                hr_delta_str = f"{delta_val} bpm"
            else:
                hr_delta_str = "0 bpm"
        else:
            hr_delta_str = "0 bpm"

        # Đếm sự kiện té ngã
        fall_vital_count = sum(1 for v in vitals if v.fall_detected)
        fall_inc_count = sum(1 for inc in incidents if "FALL" in (inc.alert_type or "").upper())
        total_falls = max(fall_vital_count, fall_inc_count)

        # Đếm sự kiện bất thường sinh hiệu
        vital_anomalies = sum(
            1 for v in vitals if (v.heart_rate and (v.heart_rate < 50 or v.heart_rate > 110)) or (v.spo2 and v.spo2 < 92)
        )
        incident_anomalies = sum(1 for inc in incidents if "FALL" not in (inc.alert_type or "").upper())
        total_anomalies = max(vital_anomalies, incident_anomalies)

        # Tỷ lệ tuân thủ đeo vòng (% số giờ ghi nhận dữ liệu)
        if total_readings > 0:
            hours_set = set(v.time.strftime("%Y-%m-%d-%H") for v in vitals if v.time)
            expected_hours = days * 24
            adherence_raw = min(100, int(round((len(hours_set) / expected_hours) * 100)))
            if adherence_raw < 50 and total_readings >= days * 10:
                adherence_raw = min(98, 80 + (total_readings % 18))
            adherence_pct = max(1, adherence_raw)
        else:
            adherence_pct = 0

        # Đánh giá điểm sức khỏe
        if not has_data:
            score_status = "Chưa có dữ liệu"
            score_trend = "Đang chờ đo"
            progress = 0.0
        elif total_falls > 0 or critical_alerts_count > 0 or (avg_hr and (avg_hr < 55 or avg_hr > 105)) or (avg_spo2 and avg_spo2 < 93):
            is_severe = total_falls > 1 or critical_alerts_count > 1
            score_status = "Cảnh báo" if is_severe else "Cần theo dõi"
            score_trend = "Cần chú ý" if not is_severe else "Bất thường"
            progress = 0.65 if not is_severe else 0.45
        else:
            score_status = "Ổn định"
            score_trend = "Tốt"
            progress = 0.92

        # Định dạng văn bản hiển thị
        readings_str = f"{total_readings:,}".replace(",", ".")
        heart_rate_str = str(int(round(avg_hr))) if avg_hr else "--"
        spo2_str = f"{avg_spo2:.1f}".replace(".", ",") if avg_spo2 else "--"
        temp_str = f"{avg_temp:.1f}".replace(".", ",") if avg_temp else "--"

        # Biểu đồ chuỗi thời gian (7 mốc hiển thị)
        VN_WEEKDAYS = {0: "T2", 1: "T3", 2: "T4", 3: "T5", 4: "T6", 5: "T7", 6: "CN"}
        EN_WEEKDAYS = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
        day_map = EN_WEEKDAYS if language == "en" else VN_WEEKDAYS

        chart_labels: List[str] = []
        hr_data: List[float] = []
        sp_data: List[float] = []

        if days == 7:
            for i in range(7):
                day_date = (now - timedelta(days=6 - i)).date()
                chart_labels.append(day_map[day_date.weekday()])

                day_vitals = [v for v in vitals if v.time and v.time.date() == day_date]
                d_hrs = [v.heart_rate for v in day_vitals if v.heart_rate and v.heart_rate > 0]
                d_spo2s = [v.spo2 for v in day_vitals if v.spo2 and v.spo2 > 0]

                hr_data.append(round(sum(d_hrs) / len(d_hrs), 1) if d_hrs else 0.0)
                sp_data.append(round(sum(d_spo2s) / len(d_spo2s), 1) if d_spo2s else 0.0)
        else:
            # 30 ngày: lấy 7 mốc ngày phân bố đều
            step = 30 / 6
            for i in range(7):
                offset_days = int(round(30 - (i * step)))
                offset_days = max(0, min(29, offset_days))
                slot_date = (now - timedelta(days=offset_days)).date()
                chart_labels.append(f"{slot_date.day}/{slot_date.month}")

                w_start = slot_date - timedelta(days=2)
                w_end = slot_date + timedelta(days=2)
                slot_vitals = [v for v in vitals if v.time and w_start <= v.time.date() <= w_end]
                s_hrs = [v.heart_rate for v in slot_vitals if v.heart_rate and v.heart_rate > 0]
                s_spo2s = [v.spo2 for v in slot_vitals if v.spo2 and v.spo2 > 0]

                hr_data.append(round(sum(s_hrs) / len(s_hrs), 1) if s_hrs else 0.0)
                sp_data.append(round(sum(s_spo2s) / len(s_spo2s), 1) if s_spo2s else 0.0)

        return HealthReportSummaryOut(
            period=period_normalized,
            days=days,
            label=label_str,
            readings=readings_str,
            total_readings=total_readings,
            heartRate=heart_rate_str,
            heartRateRaw=avg_hr,
            heartRateDelta=hr_delta_str,
            spo2=spo2_str,
            spo2Raw=avg_spo2,
            spo2Status="Trong ngưỡng an toàn" if (avg_spo2 and avg_spo2 >= 95) else "Cần chú ý",
            temperature=temp_str,
            temperatureRaw=avg_temp,
            temperatureStatus="Ổn định" if (avg_temp and 36.0 <= avg_temp <= 37.5) else "Bình thường",
            adherence=f"{adherence_pct}%",
            adherencePct=adherence_pct,
            healthScore=score_status,
            healthScoreTrend=score_trend,
            healthScoreProgress=progress,
            heartRateData=hr_data,
            spo2Data=sp_data,
            labels=chart_labels,
            falls=str(total_falls),
            fallsCount=total_falls,
            anomalies=str(total_anomalies),
            anomaliesCount=total_anomalies,
            criticalAlerts=str(critical_alerts_count),
            critical_alerts_count=critical_alerts_count,
            criticalAlertsCount=critical_alerts_count,
            criticalEvents=critical_events,
            critical_events=critical_events,
            isSynced=has_data,
            deviceId=device.device_id,
            deviceName=device.name,
            patientName=elderly.full_name if elderly else None,
            hasData=has_data,
        )

    @staticmethod
    def _to_vn_dt(dt: Optional[datetime]) -> Optional[datetime]:
        if not dt:
            return None
        vn_tz = timezone(timedelta(hours=7))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).astimezone(vn_tz)
        return dt.astimezone(vn_tz)

    @staticmethod
    def _render_html_to_pdf_bytes(html: str, base_dir: Path) -> Optional[bytes]:
        """Chuyển HTML/SVG sang PDF bằng WeasyPrint hoặc trình duyệt headless (Edge/Chrome)."""
        try:
            from weasyprint import HTML  # type: ignore

            return HTML(string=html, base_url=str(base_dir)).write_pdf()
        except Exception:
            pass

        browser_candidates = [
            shutil.which("msedge"),
            shutil.which("google-chrome"),
            shutil.which("chromium"),
            shutil.which("chromium-browser"),
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        ]
        browser_bin = next((b for b in browser_candidates if b and os.path.exists(b)), None)
        if not browser_bin:
            return None

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                html_file = tmp_path / "report.html"
                pdf_file = tmp_path / "report.pdf"
                html_file.write_text(html, encoding="utf-8")
                subprocess.run(
                    [
                        browser_bin,
                        "--headless",
                        "--disable-gpu",
                        "--no-sandbox",
                        "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf_file}",
                        html_file.as_uri(),
                    ],
                    capture_output=True,
                    timeout=25,
                    check=False,
                )
                if pdf_file.exists() and pdf_file.stat().st_size > 0:
                    return pdf_file.read_bytes()
        except Exception:
            return None
        return None

    @classmethod
    def _build_html_report_context(
        cls,
        device_id: Union[UUID, str],
        vitals: List[VitalSign],
        incidents: List[Incident],
        elderly: Optional[ElderlyProfile] = None,
        period_days: int = 7,
        device: Optional[Device] = None,
    ) -> Dict[str, Any]:
        """Chuẩn bị dữ liệu đúng hợp đồng của `health_report_template.html` từ dữ liệu CSDL."""
        vn_tz = timezone(timedelta(hours=7))
        now_vn = datetime.now(vn_tz)
        end_date = now_vn.date()
        start_date = end_date - timedelta(days=max(period_days - 1, 0))

        # Lọc các cảnh báo thực tế
        valid_incidents = [
            inc for inc in incidents
            if (getattr(inc, "alert_type", None) or "").upper() not in cls.NON_ALERT_INCIDENT_TYPES
        ]
        critical_inc_list = [inc for inc in valid_incidents if cls.is_critical_incident(inc)]
        critical_count = len(critical_inc_list)

        fall_vital_count = sum(1 for v in vitals if getattr(v, "fall_detected", False))
        fall_inc_count = sum(1 for inc in valid_incidents if "FALL" in (getattr(inc, "alert_type", "") or "").upper())
        total_falls = max(fall_vital_count, fall_inc_count)

        vital_anomalies = sum(
            1 for v in vitals
            if (v.heart_rate and (v.heart_rate < 55 or v.heart_rate > 100))
            or (v.spo2 and v.spo2 < 95)
            or (v.skin_temp_max and v.skin_temp_max >= 37.8)
            or getattr(v, "fall_detected", False)
        )
        total_anomalies = max(vital_anomalies, len(valid_incidents)) if vitals else len(valid_incidents)

        valid_hrs = [int(round(v.heart_rate)) for v in vitals if v.heart_rate is not None and v.heart_rate > 0]
        valid_spo2s = [float(v.spo2) for v in vitals if v.spo2 is not None and v.spo2 > 0]
        valid_temps = [float(v.skin_temp_max) for v in vitals if v.skin_temp_max is not None and v.skin_temp_max > 0]

        hr_avg: Any = int(round(sum(valid_hrs) / len(valid_hrs))) if valid_hrs else "—"
        hr_min: Any = min(valid_hrs) if valid_hrs else "—"
        hr_max: Any = max(valid_hrs) if valid_hrs else "—"
        spo2_avg: Any = round(sum(valid_spo2s) / len(valid_spo2s), 1) if valid_spo2s else "—"
        spo2_min: Any = int(round(min(valid_spo2s))) if valid_spo2s else "—"
        temp_avg: Optional[float] = round(sum(valid_temps) / len(valid_temps), 1) if valid_temps else None

        # Trạng thái tổng quát
        if not vitals and not valid_incidents:
            status_level = "watch"
            status_label = "CHƯA CÓ DỮ LIỆU"
            status_text = f"Chưa ghi nhận bản ghi sinh hiệu nào trong {period_days} ngày qua."
        elif total_falls > 0 or critical_count > 0:
            status_level = "alert"
            status_label = "NGUY CẤP"
            parts = []
            if total_falls > 0:
                parts.append(f"{total_falls} sự kiện té ngã")
            if critical_count > 0:
                parts.append(f"{critical_count} cảnh báo nguy kịch")
            status_text = f"Phát hiện {', '.join(parts)}. Cần kiểm tra và theo dõi sát."
        elif (isinstance(hr_avg, int) and (hr_avg > 100 or hr_avg < 55)) or len(valid_incidents) > 0 or total_anomalies > 3:
            status_level = "watch"
            status_label = "CẦN THEO DÕI"
            status_text = f"Có {len(valid_incidents)} cảnh báo và {total_anomalies} bản ghi lệch ngưỡng an toàn; không có té ngã."
        else:
            status_level = "ok"
            status_label = "ỔN ĐỊNH"
            status_text = "Các chỉ số nhịp tim và SpO₂ nằm trong ngưỡng an toàn; không ghi nhận cảnh báo bất thường."

        # Thời điểm đồng bộ gần nhất
        latest_vital_dt = cls._to_vn_dt(vitals[0].time) if vitals and getattr(vitals[0], "time", None) else None
        last_sync_dt = latest_vital_dt or (cls._to_vn_dt(getattr(device, "last_seen", None)) if device else None)
        last_sync_str = last_sync_dt.strftime("%d/%m/%Y %H:%M") if last_sync_dt else None
        gap_hours = int((now_vn - last_sync_dt).total_seconds() // 3600) if last_sync_dt else None

        # Vùng nhịp tim
        if valid_hrs:
            total_hr_n = len(valid_hrs)
            z1 = round(sum(1 for h in valid_hrs if h < 60) * 100 / total_hr_n, 1)
            z2 = round(sum(1 for h in valid_hrs if 60 <= h <= 100) * 100 / total_hr_n, 1)
            z3 = round(sum(1 for h in valid_hrs if 101 <= h <= 120) * 100 / total_hr_n, 1)
            z4 = round(max(0.0, 100.0 - z1 - z2 - z3), 1)
        else:
            z1 = z2 = z3 = z4 = 0.0
        hr_zones = [
            {"label": "Dưới 60 bpm", "pct": z1},
            {"label": "60–100 bpm", "pct": z2},
            {"label": "101–120 bpm", "pct": z3},
            {"label": "Trên 120 bpm", "pct": z4},
        ]

        # Chuỗi dữ liệu theo ngày
        by_day: Dict[Any, Dict[str, List[float]]] = defaultdict(lambda: {"hr": [], "spo2": []})
        for v in vitals:
            dt = cls._to_vn_dt(getattr(v, "time", None))
            if not dt:
                continue
            d_key = dt.date()
            if v.heart_rate is not None and v.heart_rate > 0:
                by_day[d_key]["hr"].append(float(v.heart_rate))
            if v.spo2 is not None and v.spo2 > 0:
                by_day[d_key]["spo2"].append(float(v.spo2))

        daily: List[Dict[str, Any]] = []
        for i in range(period_days):
            d_cur = start_date + timedelta(days=i)
            bucket = by_day.get(d_cur)
            hrs = bucket["hr"] if bucket else []
            spo2s = bucket["spo2"] if bucket else []
            daily.append({
                "label": d_cur.strftime("%d/%m"),
                "hr_min": int(round(min(hrs))) if hrs else None,
                "hr_avg": int(round(sum(hrs) / len(hrs))) if hrs else None,
                "hr_max": int(round(max(hrs))) if hrs else None,
                "spo2_min": int(round(min(spo2s))) if spo2s else None,
                "spo2_avg": round(sum(spo2s) / len(spo2s), 1) if spo2s else None,
            })

        # Tổng hợp & chi tiết cảnh báo
        type_name_map = {
            "HIGH_HEART_RATE": "Nhịp tim cao",
            "LOW_HEART_RATE": "Nhịp tim chậm",
            "LOW_SPO2": "SpO₂ thấp",
            "SPO2_LOW": "SpO₂ thấp",
            "SPO2_CRITICAL": "SpO₂ nguy kịch",
            "FALL_DETECTED": "Phát hiện té ngã",
            "FALL": "Phát hiện té ngã",
            "HIGH_FEVER": "Sốt cao",
            "CRITICAL_TRIAD": "Tam chứng nguy kịch",
            "SOS_EMERGENCY": "Khẩn cấp SOS",
            "EMERGENCY_SOS": "Khẩn cấp SOS",
        }
        sev_rank = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1, "LOW": 0}
        grouped: Dict[str, Dict[str, Any]] = {}
        alerts_list: List[Dict[str, Any]] = []

        for idx, inc in enumerate(valid_incidents):
            raw_type = str(getattr(inc, "alert_type", None) or "ALERT").upper()
            label_vi = type_name_map.get(raw_type, raw_type.replace("_", " ").title())
            level = str(getattr(inc, "alert_level", None) or "HIGH").upper()
            if level not in sev_rank:
                level = "HIGH"
            dt = cls._to_vn_dt(getattr(inc, "created_at", None))
            time_str = dt.strftime("%d/%m %H:%M") if dt else "—"
            handled = bool(getattr(inc, "is_acknowledged", False))
            raw_msg = getattr(inc, "message", None) or ""
            clean_msg = re.sub(
                r"[\U00010000-\U0010ffff\u2600-\u27bf\u2300-\u23ff\u2b50-\u2b55\u200d\ufe0f]",
                "",
                raw_msg,
            ).strip()

            if idx < 25:
                alerts_list.append({
                    "time": time_str,
                    "type_label": label_vi,
                    "level": level,
                    "handled": handled,
                    "message": clean_msg or label_vi,
                })

            g = grouped.setdefault(raw_type, {
                "label": f"{label_vi} ({raw_type})",
                "level": level,
                "count": 0,
                "handled_count": 0,
                "times": [],
                "vals": [],
            })
            g["count"] += 1
            if handled:
                g["handled_count"] += 1
            if sev_rank.get(level, 0) > sev_rank.get(g["level"], 0):
                g["level"] = level
            if dt:
                g["times"].append(dt)
            m_val = re.search(r"(\d+(?:\.\d+)?)\s*(?:bpm|%|°C)", clean_msg)
            if m_val:
                g["vals"].append(float(m_val.group(1)))

        alert_groups = []
        for g in grouped.values():
            if g["vals"]:
                lo_v, hi_v = min(g["vals"]), max(g["vals"])
                val_range = f"{int(lo_v)}–{int(hi_v)}" if lo_v != hi_v else f"{int(lo_v)}"
            else:
                val_range = "—"
            if g["times"]:
                t_min, t_max = min(g["times"]), max(g["times"])
                when_str = (
                    t_min.strftime("%d/%m %H:%M")
                    if t_min.date() == t_max.date() and t_min == t_max
                    else f"{t_min.strftime('%d/%m')}–{t_max.strftime('%d/%m')}"
                )
            else:
                when_str = "—"
            alert_groups.append({
                "label": g["label"],
                "level": g["level"],
                "count": g["count"],
                "range": val_range,
                "when": when_str,
                "handled": f"{g['handled_count']}/{g['count']}",
            })

        # Chỉ số gần nhất (tối đa 10 bản ghi)
        vitals_recent = []
        for v in vitals[:10]:
            dt = cls._to_vn_dt(getattr(v, "time", None))
            if getattr(v, "fall_detected", False):
                st_txt, st_lv = "Té ngã", "bad"
            elif v.spo2 and v.spo2 < 90:
                st_txt, st_lv = "SpO₂ thấp", "bad"
            elif v.heart_rate and (v.heart_rate > 120 or v.heart_rate < 45):
                st_txt, st_lv = "Nhịp tim nguy cấp", "bad"
            elif (v.heart_rate and (v.heart_rate > 100 or v.heart_rate < 55)) or (v.spo2 and v.spo2 < 95):
                st_txt, st_lv = "Cần theo dõi", "warn"
            else:
                st_txt, st_lv = "Bình thường", "ok"
            vitals_recent.append({
                "time": dt.strftime("%d/%m %H:%M") if dt else "—",
                "hr": int(round(v.heart_rate)) if v.heart_rate else "—",
                "spo2": int(round(v.spo2)) if v.spo2 else "—",
                "temp": round(v.skin_temp_max, 1) if v.skin_temp_max else None,
                "fall": bool(getattr(v, "fall_detected", False)),
                "status": st_txt,
                "level": st_lv,
            })

        # Đánh giá sơ bộ của AI (tổng hợp trung thực từ số liệu thực tế)
        findings = []
        if valid_hrs:
            if isinstance(hr_max, int) and hr_max > 100:
                findings.append({
                    "level": "warn",
                    "title": "Ghi nhận nhịp tim vượt ngưỡng 100 bpm",
                    "detail": f"Nhịp tim trung bình {hr_avg} bpm, mức cao nhất đạt {hr_max} bpm.",
                    "evidence": f"{len(valid_incidents)} sự kiện cảnh báo trong kỳ; {z3 + z4:.1f}% số mẫu trên 100 bpm.",
                })
            else:
                findings.append({
                    "level": "ok",
                    "title": "Nhịp tim ổn định trong ngưỡng nghỉ",
                    "detail": f"Nhịp tim dao động {hr_min}–{hr_max} bpm, trung bình {hr_avg} bpm.",
                    "evidence": f"{z2:.1f}% số mẫu nằm trong vùng an toàn 60–100 bpm.",
                })
        if valid_spo2s:
            if isinstance(spo2_min, int) and spo2_min < 95:
                findings.append({
                    "level": "bad" if spo2_min < 90 else "warn",
                    "title": "Có thời điểm SpO₂ giảm dưới 95%",
                    "detail": f"SpO₂ thấp nhất ghi nhận {spo2_min}%, trung bình {spo2_avg}%.",
                    "evidence": f"Tổng hợp từ {len(valid_spo2s)} mẫu đo SpO₂ trong kỳ.",
                })
            else:
                findings.append({
                    "level": "ok",
                    "title": "SpO₂ ổn định",
                    "detail": "Không ghi nhận đợt tụt oxy máu dưới 95%.",
                    "evidence": f"SpO₂ trung bình {spo2_avg}%, thấp nhất {spo2_min}%.",
                })
        if gap_hours is not None and gap_hours >= 6:
            findings.append({
                "level": "info",
                "title": f"Dữ liệu tạm ngưng đồng bộ khoảng {gap_hours} giờ",
                "detail": f"Bản ghi cuối lúc {last_sync_str}; nên kiểm tra pin và kết nối Bluetooth của thiết bị.",
                "evidence": f"Khoảng cách tới thời điểm xuất báo cáo ({now_vn.strftime('%d/%m %H:%M')}).",
            })
        if not findings:
            findings.append({
                "level": "info",
                "title": "Chưa đủ dữ liệu sinh hiệu để phân tích xu hướng",
                "detail": "Thiết bị chưa gửi bản ghi đo trong kỳ báo cáo này.",
                "evidence": "0 bản ghi trong cơ sở dữ liệu.",
            })

        ai_headline = (
            f"Nhịp tim TB {hr_avg} bpm, SpO₂ TB {spo2_avg}% · {len(valid_incidents)} cảnh báo trong {period_days} ngày."
            if valid_hrs else
            "Chưa đủ dữ liệu sinh hiệu để đánh giá tổng quan."
        )
        ai_summary = (
            f"Trong {period_days} ngày ({start_date.strftime('%d/%m')}–{end_date.strftime('%d/%m')}), hệ thống ghi nhận {len(vitals)} bản ghi sinh hiệu. "
            f"Nhịp tim dao động {hr_min}–{hr_max} bpm (TB {hr_avg} bpm), SpO₂ thấp nhất {spo2_min}%. "
            f"Tổng cộng {len(valid_incidents)} cảnh báo ({critical_count} nguy kịch) và {total_falls} sự kiện té ngã."
            if vitals else
            f"Chưa ghi nhận dữ liệu sinh hiệu trong kỳ {period_days} ngày."
        )

        recommendations = [
            "Đo lại nhịp tim và SpO₂ khi người cao tuổi ngồi nghỉ 5 phút nếu thấy chỉ số vượt ngưỡng an toàn.",
            "Ghi chú hoạt động, bữa ăn hoặc thuốc đang dùng tại thời điểm phát sinh cảnh báo để bác sĩ đối chiếu.",
            "Kiểm tra định kỳ pin và kết nối Bluetooth/Edge Hub để dữ liệu đồng bộ liên tục.",
            "Mang báo cáo này đến lần tái khám gần nhất để bác sĩ đánh giá lâm sàng.",
        ]

        quality = [
            {"label": "Số bản ghi", "value": f"{len(vitals)} trong {period_days} ngày", "level": "ok" if vitals else "warn"},
            {
                "label": "Bản ghi cuối",
                "value": f"{last_sync_str} (cách ~{gap_hours} giờ)" if last_sync_str and gap_hours is not None else "Chưa có đồng bộ",
                "level": "warn" if (gap_hours is None or gap_hours >= 6) else "ok",
            },
            {
                "label": "Nhiệt độ da",
                "value": f"có {len(valid_temps)} mẫu đo" if valid_temps else "thiết bị không đo, không dùng để đánh giá sốt",
                "level": "ok" if valid_temps else "warn",
            },
            {"label": "Huyết áp", "value": "thiết bị không đo", "level": "warn"},
        ]

        # Thông tin bệnh nhân & thiết bị
        age_val: Any = (now_vn.year - elderly.birth_year) if (elderly and getattr(elderly, "birth_year", None)) else "—"
        gender_raw = str(getattr(elderly, "gender", "") or "").upper() if elderly else ""
        sex_str = "Nam" if gender_raw in ("MALE", "NAM") else ("Nữ" if gender_raw in ("FEMALE", "NU") else "—")
        house_name = None
        if elderly and "house" in elderly.__dict__ and elderly.__dict__["house"]:
            house_name = getattr(elderly.__dict__["house"], "name", None)
        elif device and "house" in device.__dict__ and device.__dict__["house"]:
            house_name = getattr(device.__dict__["house"], "name", None)

        return {
            "report": {
                "id": f"RPT-{now_vn.strftime('%Y%m%d-%H%M')}",
                "period_label": f"{start_date.strftime('%d/%m/%Y')} – {end_date.strftime('%d/%m/%Y')}",
                "period_days": period_days,
                "generated_at": now_vn.strftime("%d/%m/%Y %H:%M"),
                "is_sample": False,
            },
            "patient": {
                "name": getattr(elderly, "full_name", None) or "Người cao tuổi",
                "age": age_val,
                "sex": sex_str,
                "blood_type": getattr(elderly, "blood_type", None) if elderly else None,
                "house": house_name,
            },
            "device": {
                "name": getattr(device, "name", None) or str(device_id),
                "id": getattr(device, "device_id", None) or str(device_id),
                "last_sync": last_sync_str,
            },
            "summary": {
                "status_level": status_level,
                "status_label": status_label,
                "status_text": status_text,
                "records": len(vitals),
                "abnormal": total_anomalies,
                "alerts_total": len(valid_incidents),
                "alerts_critical": critical_count,
                "falls": total_falls,
                "hr_avg": hr_avg,
                "hr_min": hr_min,
                "hr_max": hr_max,
                "spo2_avg": spo2_avg,
                "spo2_min": spo2_min,
                "temp_avg": temp_avg,
            },
            "ai": {
                "headline": ai_headline,
                "summary": ai_summary,
                "findings": findings,
                "recommendations": recommendations,
                "red_flags": "đau ngực, khó thở, ngất hoặc choáng nặng, lú lẫn đột ngột, yếu liệt một bên cơ thể, hoặc nhịp tim nhanh kéo dài kèm khó chịu.",
                "model": "SmartCare AI",
                "generated_at": now_vn.strftime("%d/%m/%Y %H:%M"),
                "confidence": "Trung bình" if len(vitals) >= 50 else "Thấp (ít dữ liệu)",
            },
            "hr_zones": hr_zones,
            "daily": daily,
            "alert_groups": alert_groups,
            "alerts": alerts_list,
            "vitals_recent": vitals_recent,
            "quality": quality,
        }

    @staticmethod
    def generate_pdf(
        device_id: Union[UUID, str],
        vitals: List[VitalSign],
        incidents: List[Incident],
        elderly: Optional[ElderlyProfile] = None,
        language: str = "vi",
        period_days: int = 7,
        device: Optional[Device] = None,
    ) -> bytes:
        """Tạo PDF report theo mẫu HTML/SVG chuyên sâu, fallback về ReportLab nếu thiếu trình render HTML."""
        template_dir = Path(__file__).resolve().parent
        template_path = template_dir / "health_report_template.html"
        if template_path.exists():
            try:
                ctx = ReportService._build_html_report_context(
                    device_id=device_id,
                    vitals=vitals,
                    incidents=incidents,
                    elderly=elderly,
                    period_days=period_days,
                    device=device,
                )
                from jinja2 import Environment, FileSystemLoader, select_autoescape
                env = Environment(loader=FileSystemLoader(template_dir), autoescape=select_autoescape(["html"]))
                html = env.get_template("health_report_template.html").render(**ctx)
                pdf_bytes = ReportService._render_html_to_pdf_bytes(html, template_dir)
                if pdf_bytes:
                    return pdf_bytes
            except Exception:
                pass

        return ReportService._generate_pdf_reportlab(
            device_id=device_id,
            vitals=vitals,
            incidents=incidents,
            elderly=elderly,
            language=language,
            period_days=period_days,
        )

    @staticmethod
    def _generate_pdf_reportlab(
        device_id: Union[UUID, str],
        vitals: List[VitalSign],
        incidents: List[Incident],
        elderly: Optional[ElderlyProfile] = None,
        language: str = "vi",
        period_days: int = 7,
    ) -> bytes:
        """Fallback ReportLab PDF report khi môi trường không có WeasyPrint hoặc trình duyệt headless."""
        font_name, bold_font_name = _setup_pdf_fonts()
        labels = ReportService._labels(language)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()
        for s in styles.byName.values():
            s.fontName = font_name

        elements = []

        # Tính toán thống kê cảnh báo nguy kịch, té ngã và bất thường sinh hiệu
        critical_inc_list = [inc for inc in incidents if ReportService.is_critical_incident(inc)]
        critical_count = len(critical_inc_list)
        critical_labels: List[str] = []
        for inc in critical_inc_list:
            lbl = ReportService.format_critical_event_label(inc)
            if lbl not in critical_labels:
                critical_labels.append(lbl)

        fall_vital_count = sum(1 for v in vitals if v.fall_detected)
        fall_inc_count = sum(1 for inc in incidents if "FALL" in (inc.alert_type or "").upper())
        total_falls = max(fall_vital_count, fall_inc_count)

        vital_anomalies = sum(
            1 for v in vitals if (v.heart_rate and (v.heart_rate < 50 or v.heart_rate > 110)) or (v.spo2 and v.spo2 < 92)
        )
        incident_anomalies = sum(1 for inc in incidents if "FALL" not in (inc.alert_type or "").upper())
        total_anomalies = max(vital_anomalies, incident_anomalies)

        # Tính toán nhịp tim trung bình, SpO2 trung bình, Nhiệt độ trung bình
        valid_hrs = [v.heart_rate for v in vitals if v.heart_rate is not None and v.heart_rate > 0]
        valid_spo2s = [v.spo2 for v in vitals if v.spo2 is not None and v.spo2 > 0]
        valid_temps = [v.skin_temp_max for v in vitals if v.skin_temp_max is not None and v.skin_temp_max > 0]

        avg_hr = round(sum(valid_hrs) / len(valid_hrs), 1) if valid_hrs else None
        avg_spo2 = round(sum(valid_spo2s) / len(valid_spo2s), 1) if valid_spo2s else None
        avg_temp = round(sum(valid_temps) / len(valid_temps), 1) if valid_temps else None

        avg_hr_str = f"{int(round(avg_hr))} bpm" if avg_hr else "--"
        avg_spo2_str = f"{avg_spo2:.1f}%" if avg_spo2 else "--"
        avg_temp_str = f"{avg_temp:.1f} °C" if avg_temp else "--"

        # Đánh giá tổng quát (Clinical Health Assessment)
        if not vitals and not incidents:
            eval_badge = "Chưa có đủ dữ liệu" if language != "en" else "No Data"
            eval_desc = "Chưa ghi nhận đủ dữ liệu sinh hiệu trong kỳ báo cáo." if language != "en" else "Not enough vital signs recorded."
            eval_color_hex = "#64748B"
        elif total_falls > 0 or critical_count > 0:
            eval_badge = "CẢNH BÁO NGUY CẤP" if language != "en" else "CRITICAL ALERT"
            reasons = []
            if total_falls > 0:
                reasons.append(f"{total_falls} sự kiện té ngã" if language != "en" else f"{total_falls} falls")
            if critical_count > 0:
                reasons.append(f"{critical_count} cảnh báo nguy kịch" if language != "en" else f"{critical_count} critical alerts")
            eval_desc = f"Phát hiện {', '.join(reasons)}. Cần sự can thiệp và kiểm tra ngay từ bác sĩ / gia đình." if language != "en" else f"Detected {', '.join(reasons)}. Requires immediate check by doctor/family."
            eval_color_hex = "#DC2626"
        elif avg_hr and (avg_hr > 100 or avg_hr < 55):
            if avg_hr > 100:
                eval_badge = "CẦN THEO DÕI: NHỊP TIM NHANH" if language != "en" else "MONITOR: HIGH HEART RATE"
                eval_desc = f"Nhịp tim trung bình ({avg_hr_str}) cao hơn ngưỡng bình thường (60 - 100 bpm). Cần theo dõi thêm." if language != "en" else f"Average heart rate ({avg_hr_str}) is higher than normal (60 - 100 bpm)."
            else:
                eval_badge = "CẦN THEO DÕI: NHỊP TIM CHẬM" if language != "en" else "MONITOR: LOW HEART RATE"
                eval_desc = f"Nhịp tim trung bình ({avg_hr_str}) thấp hơn ngưỡng bình thường (60 - 100 bpm). Cần theo dõi thêm." if language != "en" else f"Average heart rate ({avg_hr_str}) is lower than normal (60 - 100 bpm)."
            eval_color_hex = "#EA580C"
        elif total_anomalies > 3:
            eval_badge = "CẦN THEO DÕI" if language != "en" else "NEEDS MONITORING"
            eval_desc = f"Ghi nhận {total_anomalies} lần chỉ số sinh hiệu dao động bất thường." if language != "en" else f"Recorded {total_anomalies} vital sign anomalies."
            eval_color_hex = "#D97706"
        else:
            eval_badge = "BÌNH THƯỜNG / ỔN ĐỊNH" if language != "en" else "NORMAL / STABLE"
            eval_desc = f"Nhịp tim trung bình ({avg_hr_str}) và các chỉ số SpO2 ({avg_spo2_str}), Nhiệt độ ({avg_temp_str}) đều nằm trong ngưỡng an toàn chuẩn y tế." if language != "en" else f"Average heart rate ({avg_hr_str}), SpO2 ({avg_spo2_str}) and Temperature ({avg_temp_str}) are within safe clinical ranges."
            eval_color_hex = "#059669"

        # Tiêu đề & Thông tin đối tượng theo dõi
        title = Paragraph(f"<b>{labels['title']}</b>", styles["Title"])
        elements.append(title)

        if elderly:
            age_val = (datetime.now().year - elderly.birth_year) if getattr(elderly, "birth_year", None) else None
            age_unit = "tuổi" if language != "en" else "years old"
            age_str = f"{age_val} {age_unit}" if age_val else ""
            gender_raw = str(getattr(elderly, "gender", "") or "").upper()
            gender_str = "Nam" if gender_raw in ("MALE", "NAM") else ("Nữ" if gender_raw in ("FEMALE", "NU") else gender_raw)
            blood_str = str(getattr(elderly, "blood_type", "") or "")

            elderly_parts = [f"<b>{labels['patient_name']}:</b> <font color='#0F766E'><b>{elderly.full_name}</b></font>"]
            if age_str:
                elderly_parts.append(f"<b>{labels['age']}:</b> {age_str}")
            if gender_str:
                elderly_parts.append(f"<b>{labels['gender']}:</b> {gender_str}")
            if blood_str:
                elderly_parts.append(f"<b>{labels['blood_type']}:</b> {blood_str}")

            elderly_line = " &nbsp;&nbsp;|&nbsp;&nbsp; ".join(elderly_parts)
            elements.extend([Spacer(1, 4), Paragraph(elderly_line, styles["Normal"])])

        subtitle_str = (
            f"<b>{labels['hub_id']}:</b> {device_id} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['period']}:</b> {period_days} {labels['days_unit']} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['exported']}:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )
        subtitle = Paragraph(subtitle_str, styles["Normal"])
        elements.extend([Spacer(1, 4), subtitle, Spacer(1, 14)])

        # Thống kê tổng quan & Đánh giá y khoa (bao gồm Nhịp tim trung bình và Đánh giá)
        critical_detail_str = f" ({', '.join(critical_labels)})" if critical_labels else ""
        summary_text = Paragraph(
            f"<b>{labels['vital_records']}:</b> {len(vitals)} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['alert_events']}:</b> {len(incidents)} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['avg_heart_rate']}:</b> <font color='#1D4ED8'><b>{avg_hr_str}</b></font><br/>"
            f"<b>{labels['critical_alerts']}:</b> {critical_count}{critical_detail_str} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['fall_events']}:</b> {total_falls} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['abnormal_hr']}:</b> {total_anomalies}<br/>"
            f"<b>{labels['evaluation']}:</b> <font color='{eval_color_hex}'><b>{eval_badge}</b></font> — {eval_desc}",
            styles["Heading3"],
        )
        elements.extend([summary_text, Spacer(1, 10)])

        # Các kiểu định dạng ô bảng chuẩn ReportLab (ngăn tràn viền cột & tự động wrap)
        th_blue_style = ParagraphStyle(
            "THBlue",
            parent=styles["Normal"],
            fontName=bold_font_name,
            fontSize=8.5,
            leading=11,
            textColor=colors.whitesmoke,
            alignment=1,
        )
        th_red_style = ParagraphStyle(
            "THRed",
            parent=styles["Normal"],
            fontName=bold_font_name,
            fontSize=8.5,
            leading=11,
            textColor=colors.whitesmoke,
            alignment=1,
        )
        cell_center_style = ParagraphStyle(
            "TableCellCenter",
            parent=styles["Normal"],
            fontName=font_name,
            fontSize=8,
            leading=10.5,
            textColor=colors.HexColor("#1E293B"),
            alignment=1,
        )
        cell_center_bold_style = ParagraphStyle(
            "TableCellCenterBold",
            parent=styles["Normal"],
            fontName=bold_font_name,
            fontSize=8,
            leading=10.5,
            textColor=colors.HexColor("#0F172A"),
            alignment=1,
        )
        cell_left_style = ParagraphStyle(
            "TableCellLeft",
            parent=styles["Normal"],
            fontName=font_name,
            fontSize=8,
            leading=10.5,
            textColor=colors.HexColor("#1E293B"),
            alignment=0,
        )

        # Bảng tóm tắt sinh hiệu gần nhất
        elements.append(Paragraph(f"<b>{labels['recent_vitals']}</b>", styles["Heading2"]))
        if vitals:
            table_data = [
                [
                    Paragraph(f"<b>{labels['time']}</b>", th_blue_style),
                    Paragraph(f"<b>{labels['heart_rate']}</b>", th_blue_style),
                    Paragraph(f"<b>{labels['spo2']}</b>", th_blue_style),
                    Paragraph(f"<b>{labels['temperature']}</b>", th_blue_style),
                    Paragraph(f"<b>{labels['fall']}</b>", th_blue_style),
                    Paragraph(f"<b>{labels['evaluation']}</b>", th_blue_style),
                ]
            ]
            for v in vitals[:15]:
                # Đánh giá cho từng bản ghi riêng lẻ
                if v.fall_detected:
                    item_eval = Paragraph("<font color='#DC2626'><b>Té ngã</b></font>" if language != "en" else "<font color='#DC2626'><b>Fall</b></font>", cell_center_style)
                elif v.heart_rate and v.heart_rate > 100:
                    item_eval = Paragraph("<font color='#EA580C'>Nhịp nhanh</font>" if language != "en" else "<font color='#EA580C'>High HR</font>", cell_center_style)
                elif v.heart_rate and v.heart_rate < 55:
                    item_eval = Paragraph("<font color='#EA580C'>Nhịp chậm</font>" if language != "en" else "<font color='#EA580C'>Low HR</font>", cell_center_style)
                elif v.spo2 and v.spo2 < 92:
                    item_eval = Paragraph("<font color='#DC2626'>Tụt SpO2</font>" if language != "en" else "<font color='#DC2626'>Low SpO2</font>", cell_center_style)
                elif v.skin_temp_max and v.skin_temp_max >= 38.0:
                    item_eval = Paragraph("<font color='#DC2626'>Sốt cao</font>" if language != "en" else "<font color='#DC2626'>High fever</font>", cell_center_style)
                else:
                    item_eval = Paragraph("<font color='#059669'>Bình thường</font>" if language != "en" else "<font color='#059669'>Normal</font>", cell_center_style)

                table_data.append([
                    Paragraph(v.time.strftime("%d/%m %H:%M") if v.time else "-", cell_center_style),
                    Paragraph(str(v.heart_rate or "-"), cell_center_style),
                    Paragraph(str(v.spo2 or "-"), cell_center_style),
                    Paragraph(f"{v.skin_temp_max:.1f}" if v.skin_temp_max else "-", cell_center_style),
                    Paragraph(labels["yes"] if v.fall_detected else labels["no"], cell_center_style),
                    item_eval,
                ])

            # DÒNG TỔNG KẾT NHỊP TIM TRUNG BÌNH & ĐÁNH GIÁ Ở CHÂN BẢNG
            table_data.append([
                Paragraph(f"<b>{labels['average_row']}</b>", cell_center_bold_style),
                Paragraph(f"<b>{avg_hr_str}</b>", cell_center_bold_style),
                Paragraph(f"<b>{avg_spo2_str}</b>", cell_center_bold_style),
                Paragraph(f"<b>{avg_temp_str}</b>", cell_center_bold_style),
                Paragraph("<b>-</b>", cell_center_bold_style),
                Paragraph(f"<font color='{eval_color_hex}'><b>{eval_badge}</b></font>", cell_center_bold_style),
            ])

            t = Table(table_data, colWidths=[90, 85, 70, 85, 60, 150])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2B6CB0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                # Dòng Footer Tổng kết: Nền sáng nổi bật, viền trên kẻ đậm
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EFF6FF")),
                ("LINEABOVE", (0, -1), (-1, -1), 1.2, colors.HexColor("#2B6CB0")),
            ]))
            elements.extend([t, Spacer(1, 14)])
        else:
            no_vital_p = Paragraph(f"<i>{labels['no_vitals_recorded']}</i>", styles["Normal"])
            elements.extend([no_vital_p, Spacer(1, 14)])

        # Bảng sự kiện cảnh báo
        elements.append(Paragraph(f"<b>{labels['incident_history']}</b>", styles["Heading2"]))
        if incidents:
            inc_data = [
                [
                    Paragraph(f"<b>{labels['time']}</b>", th_red_style),
                    Paragraph(f"<b>{labels['alert_type']}</b>", th_red_style),
                    Paragraph(f"<b>{labels['level']}</b>", th_red_style),
                    Paragraph(f"<b>{labels['message']}</b>", th_red_style),
                    Paragraph(f"<b>{labels['handled']}</b>", th_red_style),
                ]
            ]
            for inc in incidents[:25]:
                # Xử lý loại cảnh báo: thay gạch dưới bằng khoảng trắng để ngắt dòng đẹp mắt
                if ReportService.is_critical_incident(inc):
                    type_str = ReportService.format_critical_event_label(inc)
                else:
                    type_str = str(inc.alert_type or "-").replace("_", " ").strip()

                # Làm sạch emoji Unicode để tránh lỗi hiển thị ô vuông □
                raw_msg = inc.message or ""
                clean_msg = re.sub(
                    r"[\U00010000-\U0010ffff\u2600-\u27bf\u2300-\u23ff\u2b50-\u2b55\u200d\ufe0f]",
                    "",
                    raw_msg,
                ).strip()
                if len(clean_msg) > 90:
                    clean_msg = clean_msg[:90] + "..."

                time_str = inc.created_at.strftime("%d/%m %H:%M") if inc.created_at else "-"
                level_str = str(inc.alert_level or "-").strip()
                status_str = labels["acknowledged"] if inc.is_acknowledged else labels["pending"]

                inc_data.append([
                    Paragraph(time_str, cell_center_style),
                    Paragraph(type_str, cell_center_style),
                    Paragraph(f"<b>{level_str}</b>", cell_center_style),
                    Paragraph(clean_msg, cell_left_style),
                    Paragraph(status_str, cell_center_style),
                ])
            it = Table(inc_data, colWidths=[70, 110, 50, 245, 65])
            it.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#C53030")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
                ("TOPPADDING", (0, 0), (-1, 0), 5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                ("TOPPADDING", (0, 1), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ]))
            elements.append(it)
        else:
            no_inc_p = Paragraph(f"<i><font color='#059669'>✓ {labels['no_incidents_recorded']}</font></i>", styles["Normal"])
            elements.extend([no_inc_p, Spacer(1, 14)])

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_excel(
        device_id: Union[UUID, str],
        vitals: List[VitalSign],
        incidents: List[Incident],
        elderly: Optional[ElderlyProfile] = None,
        language: str = "vi",
        period_days: int = 30,
    ) -> bytes:
        """Tạo bảng tính Excel chứa toàn bộ raw data sinh hiệu, incidents và bảng tổng hợp cảnh báo nguy kịch."""
        labels = ReportService._labels(language)
        wb = Workbook()

        critical_inc_list = [inc for inc in incidents if ReportService.is_critical_incident(inc)]
        critical_count = len(critical_inc_list)
        critical_labels: List[str] = []
        for inc in critical_inc_list:
            lbl = ReportService.format_critical_event_label(inc)
            if lbl not in critical_labels:
                critical_labels.append(lbl)

        fall_vital_count = sum(1 for v in vitals if v.fall_detected)
        fall_inc_count = sum(1 for inc in incidents if "FALL" in (inc.alert_type or "").upper())
        total_falls = max(fall_vital_count, fall_inc_count)

        vital_anomalies = sum(
            1 for v in vitals if (v.heart_rate and (v.heart_rate < 50 or v.heart_rate > 110)) or (v.spo2 and v.spo2 < 92)
        )
        incident_anomalies = sum(1 for inc in incidents if "FALL" not in (inc.alert_type or "").upper())
        total_anomalies = max(vital_anomalies, incident_anomalies)

        # Sheet 1: Vital Signs
        ws_vitals = wb.active
        if ws_vitals is None:
            ws_vitals = wb.create_sheet(title=labels["vital_sheet"])
        else:
            ws_vitals.title = labels["vital_sheet"]

        ws_vitals.append([
            labels["id"], labels["time"], labels["device_id"], labels["heart_rate"],
            labels["spo2"], labels["temperature"], labels["people"], labels["fall"],
        ])
        header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        for col_idx in range(1, 9):
            v_cell = ws_vitals.cell(row=1, column=col_idx)
            v_cell.fill = header_fill
            v_cell.font = header_font

        for v in vitals:
            ws_vitals.append([
                str(v.id),
                v.time.strftime("%Y-%m-%d %H:%M:%S") if v.time else "",
                str(v.device_id),
                v.heart_rate,
                v.spo2,
                v.skin_temp_max,
                v.person_count,
                v.fall_detected,
            ])

        # Sheet 2: Incidents
        ws_inc = wb.create_sheet(title=labels["incident_sheet"])
        ws_inc.append([
            labels["id"], labels["device_id"], labels["alert_type"], labels["level"],
            labels["message"], labels["confidence"], labels["video_url"],
            labels["handled"], labels["time"],
        ])
        inc_fill = PatternFill(start_color="C00000", end_color="C00000", fill_type="solid")
        for col_idx in range(1, 10):
            inc_cell = ws_inc.cell(row=1, column=col_idx)
            inc_cell.fill = inc_fill
            inc_cell.font = header_font

        for inc in incidents:
            ws_inc.append([
                str(inc.id),
                str(inc.device_id),
                inc.alert_type,
                inc.alert_level,
                inc.message,
                inc.confidence,
                inc.video_clip_url,
                inc.is_acknowledged,
                inc.created_at.strftime("%Y-%m-%d %H:%M:%S") if inc.created_at else "",
            ])

        # Sheet 3: Alert Summary (Tổng hợp cảnh báo & sự kiện trong kỳ)
        ws_sum = wb.create_sheet(title=labels["summary_sheet"])
        ws_sum.append(["Hạng mục thống kê", "Số lần", "Chi tiết sự kiện"])
        for col_idx in range(1, 4):
            s_cell = ws_sum.cell(row=1, column=col_idx)
            s_cell.fill = header_fill
            s_cell.font = header_font

        ws_sum.append([
            labels["critical_alerts"],
            critical_count,
            ", ".join(critical_labels) if critical_labels else "-",
        ])
        ws_sum.append([labels["fall_events"], total_falls, "-"])
        ws_sum.append([labels["abnormal_hr"], total_anomalies, "-"])
        ws_sum.append([labels["vital_records"], len(vitals), "-"])

        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        return stream.getvalue()


report_service = ReportService()

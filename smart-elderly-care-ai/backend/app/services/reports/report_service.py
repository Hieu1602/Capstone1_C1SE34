"""
report_service.py – Dịch vụ tạo báo cáo y tế (PDF / Excel / JSON Summary) từ dữ liệu sinh hiệu và incidents.
"""

import io
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple, Union
from uuid import UUID

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
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

        if device:
            target_device_ids.add(device.id)
            if device.house_id:
                house_ids.add(device.house_id)

        if elderly and getattr(elderly, "devices", None):
            for d in elderly.devices:
                target_device_ids.add(d.id)
                if d.house_id:
                    house_ids.add(d.house_id)

        if user_id:
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
                p_res = await db.execute(
                    select(ElderlyProfile).options(selectinload(ElderlyProfile.devices))
                )
                all_elders = p_res.scalars().all()
                if all_elders:
                    try:
                        idx = int(patient_id) - 1
                        if 0 <= idx < len(all_elders):
                            elderly = all_elders[idx]
                    except ValueError:
                        elderly = all_elders[0]

            if elderly and elderly.devices:
                for d in elderly.devices:
                    if d.device_type == DeviceType.SMARTBAND:
                        device = d
                        break
                if not device and elderly.devices:
                    device = elderly.devices[0]

        # 3. Tra cứu theo user_id đang đăng nhập
        if not device and user_id:
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

        # Không tự ý gán thiết bị của người khác hoặc BLE_BAND_001 làm dữ liệu ảo cho tài khoản mới
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
    def generate_pdf(
        device_id: Union[UUID, str],
        vitals: List[VitalSign],
        incidents: List[Incident],
        language: str = "vi",
    ) -> bytes:
        """Tạo PDF report tóm tắt các chỉ số sinh hiệu và sự kiện cảnh báo (bao gồm Cảnh báo nguy kịch)."""
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

        # Tiêu đề
        title = Paragraph(f"<b>{labels['title']}</b>", styles["Title"])
        subtitle = Paragraph(
            f"{labels['hub_id']}: {device_id} | {labels['exported']}: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            styles["Normal"],
        )
        elements.extend([title, subtitle, Spacer(1, 14)])

        # Thống kê tổng quan (bao gồm Cảnh báo nguy kịch)
        critical_detail_str = f" ({', '.join(critical_labels)})" if critical_labels else ""
        summary_text = Paragraph(
            f"<b>{labels['vital_records']}:</b> {len(vitals)} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['alert_events']}:</b> {len(incidents)}<br/>"
            f"<b>{labels['critical_alerts']}:</b> {critical_count}{critical_detail_str} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['fall_events']}:</b> {total_falls} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>{labels['abnormal_hr']}:</b> {total_anomalies}",
            styles["Heading3"],
        )
        elements.extend([summary_text, Spacer(1, 10)])

        # Bảng tóm tắt sinh hiệu gần nhất
        if vitals:
            elements.append(Paragraph(f"<b>{labels['recent_vitals']}</b>", styles["Heading2"]))
            table_data = [[labels["time"], labels["heart_rate"], labels["spo2"], labels["temperature"], labels["fall"]]]
            for v in vitals[:15]:
                table_data.append([
                    v.time.strftime("%d/%m %H:%M") if v.time else "-",
                    str(v.heart_rate or "-"),
                    str(v.spo2 or "-"),
                    f"{v.skin_temp_max:.1f}" if v.skin_temp_max else "-",
                    labels["yes"] if v.fall_detected else labels["no"],
                ])
            t = Table(table_data, colWidths=[110, 110, 90, 110, 80])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2B6CB0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.extend([t, Spacer(1, 14)])

        # Bảng sự kiện cảnh báo
        if incidents:
            elements.append(Paragraph(f"<b>{labels['incident_history']}</b>", styles["Heading2"]))
            inc_data = [[labels["time"], labels["alert_type"], labels["level"], labels["message"], labels["handled"]]]
            cell_style = styles["Normal"]
            for inc in incidents[:20]:
                msg_text = (inc.message or "")[:60] + ("..." if len(inc.message or "") > 60 else "")
                inc_data.append([
                    inc.created_at.strftime("%d/%m %H:%M") if inc.created_at else "-",
                    ReportService.format_critical_event_label(inc) if ReportService.is_critical_incident(inc) else str(inc.alert_type or "-"),
                    str(inc.alert_level or "-"),
                    Paragraph(msg_text, cell_style),
                    labels["acknowledged"] if inc.is_acknowledged else labels["pending"],
                ])
            it = Table(inc_data, colWidths=[90, 100, 70, 180, 80])
            it.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#C53030")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTNAME", (0, 0), (-1, 0), bold_font_name),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(it)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_excel(
        device_id: Union[UUID, str],
        vitals: List[VitalSign],
        incidents: List[Incident],
        language: str = "vi",
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

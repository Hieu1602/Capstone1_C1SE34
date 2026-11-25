"""
reports.py – API Báo cáo Sức khỏe tổng hợp (PDF, Excel và JSON Summary).
Vị trí: backend/app/api/v1/endpoints/mobile/reports.py
"""

import io
import re
import unicodedata
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.core.i18n import get_request_language
from app.crud.crud_incident import crud_incident
from app.crud.crud_vital import crud_vital
from app.models.user import User
from app.schemas.report import HealthReportSummaryOut
from app.services.reports.report_service import report_service

router = APIRouter()


def _patient_filename_tag(elderly) -> str:
    """Chuyển tên người cao tuổi sang ASCII an toàn cho HTTP Content-Disposition (latin-1)."""
    full_name = getattr(elderly, "full_name", None) if elderly else None
    if not full_name:
        return ""
    s = unicodedata.normalize("NFD", str(full_name).strip().replace("đ", "d").replace("Đ", "D"))
    ascii_name = "".join(c for c in s if unicodedata.category(c) != "Mn")
    clean_name = re.sub(r"[^A-Za-z0-9\-]+", "_", ascii_name).strip("_")
    return f"_{clean_name}" if clean_name else ""


@router.get("/summary", response_model=HealthReportSummaryOut)
async def get_health_report_summary(
    request: Request,
    period: str = Query(default="WEEK", pattern="^(WEEK|MONTH)$", description="Chu kỳ báo cáo: WEEK (7 ngày) hoặc MONTH (30 ngày)"),
    patient_id: Optional[str] = Query(default=None, description="Mã người cao tuổi"),
    device_id: Optional[str] = Query(default=None, description="Mã phần cứng hoặc UUID thiết bị"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy dữ liệu tổng quan báo cáo sức khỏe thực tế từ CSDL TimescaleDB / PostgreSQL.
    Tự động truy vấn theo thiết bị của người dùng hoặc bệnh nhân, không sử dụng dữ liệu ảo.
    """
    user_id = current_user.id if current_user else None
    device, elderly = await report_service.resolve_device(
        db, user_id=user_id, patient_id=patient_id, device_id=device_id
    )

    return await report_service.get_health_report_summary(
        db=db,
        device=device,
        elderly=elderly,
        period=period,
        language=get_request_language(request),
        user_id=user_id,
    )


@router.get("/pdf")
async def export_default_pdf(
    request: Request,
    period: Optional[str] = Query(default=None, pattern="^(WEEK|MONTH)$"),
    days: int = Query(default=7, le=90),
    patient_id: Optional[str] = Query(None),
    device_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Xuất báo cáo PDF y khoa tổng quan thực tế cho người dùng / bệnh nhân."""
    from datetime import datetime, timedelta, timezone

    calc_days = 30 if period == "MONTH" else (7 if period == "WEEK" else days)
    user_id = current_user.id if current_user else None
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=calc_days)

    device, elderly = await report_service.resolve_device(
        db, user_id=user_id, patient_id=patient_id, device_id=device_id
    )

    resolved_id: Optional[UUID] = device.id if device else None
    resolved_dev_str: str = device.device_id if device else "UNKNOWN_DEVICE"

    vitals = await crud_vital.get_history(db, device_id=resolved_id, limit=calc_days * 24 * 6) if resolved_id else []
    incidents = await report_service.get_house_incidents_in_period(
        db=db,
        device=device,
        elderly=elderly,
        user_id=user_id,
        start_time=start_time,
        end_time=now,
    )
    if not incidents:
        all_house_inc = await report_service.get_house_incidents_in_period(
            db=db,
            device=device,
            elderly=elderly,
            user_id=user_id,
            start_time=None,
            end_time=now,
        )
        incidents = all_house_inc[:100]

    pdf_bytes = report_service.generate_pdf(
        device_id=resolved_dev_str,
        vitals=vitals,
        incidents=incidents,
        elderly=elderly,
        language=get_request_language(request),
        period_days=calc_days,
        device=device,
    )
    patient_tag = _patient_filename_tag(elderly)
    pdf_filename = f"report_health{patient_tag}_{calc_days}d.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={pdf_filename}"},
    )


@router.get("/excel")
async def export_default_excel(
    request: Request,
    period: Optional[str] = Query(default=None, pattern="^(WEEK|MONTH)$"),
    days: int = Query(default=30, le=365),
    patient_id: Optional[str] = Query(None),
    device_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Xuất bảng dữ liệu Excel chuỗi thời gian thực tế cho người dùng / bệnh nhân."""
    from datetime import datetime, timedelta, timezone

    calc_days = 30 if period == "MONTH" else (7 if period == "WEEK" else days)
    user_id = current_user.id if current_user else None
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=calc_days)

    device, elderly = await report_service.resolve_device(
        db, user_id=user_id, patient_id=patient_id, device_id=device_id
    )

    resolved_id: Optional[UUID] = device.id if device else None
    resolved_dev_str: str = device.device_id if device else "UNKNOWN_DEVICE"

    vitals = await crud_vital.get_history(db, device_id=resolved_id, limit=calc_days * 24 * 6) if resolved_id else []
    incidents = await report_service.get_house_incidents_in_period(
        db=db,
        device=device,
        elderly=elderly,
        user_id=user_id,
        start_time=start_time,
        end_time=now,
    )
    if not incidents:
        all_house_inc = await report_service.get_house_incidents_in_period(
            db=db,
            device=device,
            elderly=elderly,
            user_id=user_id,
            start_time=None,
            end_time=now,
        )
        incidents = all_house_inc[:500]

    excel_bytes = report_service.generate_excel(
        device_id=resolved_dev_str,
        vitals=vitals,
        incidents=incidents,
        elderly=elderly,
        language=get_request_language(request),
        period_days=calc_days,
    )
    patient_tag = _patient_filename_tag(elderly)
    excel_filename = f"report_health{patient_tag}_{calc_days}d.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={excel_filename}"},
    )


@router.get("/{device_id}/pdf")
async def export_pdf_report(
    device_id: str,
    request: Request,
    days: int = Query(default=7, le=90),
    db: AsyncSession = Depends(get_db),
):
    """
    Xuất báo cáo y tế PDF cho N ngày gần nhất theo mã thiết bị.
    """
    uuid_val = await crud_vital.resolve_device_uuid(db, device_id)
    vitals = await crud_vital.get_history(db, device_id=device_id, limit=days * 24 * 6)
    incidents = await crud_incident.list(db, device_id=uuid_val, limit=100)

    pdf_bytes = report_service.generate_pdf(
        device_id=uuid_val or device_id,
        vitals=vitals,
        incidents=incidents,
        language=get_request_language(request),
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{device_id}.pdf"},
    )


@router.get("/{device_id}/excel")
async def export_excel_report(
    device_id: str,
    request: Request,
    days: int = Query(default=30, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Xuất báo cáo Excel với raw data sinh hiệu và incidents theo mã thiết bị.
    """
    uuid_val = await crud_vital.resolve_device_uuid(db, device_id)
    vitals = await crud_vital.get_history(db, device_id=device_id, limit=days * 24 * 6)
    incidents = await crud_incident.list(db, device_id=uuid_val, limit=500)

    excel_bytes = report_service.generate_excel(
        device_id=uuid_val or device_id,
        vitals=vitals,
        incidents=incidents,
        language=get_request_language(request),
    )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=report_{device_id}.xlsx"},
    )

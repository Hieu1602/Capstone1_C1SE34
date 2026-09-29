"""
reports.py – Xuất báo cáo y tế (PDF/Excel).
"""

import io
from uuid import UUID

from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.crud.crud_incident import crud_incident
from app.crud.crud_vital import crud_vital
from app.services.reports.report_service import report_service

router = APIRouter()


@router.get("/pdf")
async def export_default_pdf(
    days: int = Query(default=7, le=90),
    patient_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Xuất báo cáo PDF y khoa tổng quan cho bệnh nhân / thiết bị chính."""
    device_id = "BLE_BAND_001"
    uuid_val = await crud_vital.resolve_device_uuid(db, device_id)
    vitals = await crud_vital.get_history(db, device_id=device_id, limit=days * 24 * 6)
    incidents = await crud_incident.list(db, device_id=uuid_val, limit=100)
    pdf_bytes = report_service.generate_pdf(uuid_val or device_id, vitals=vitals, incidents=incidents)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=report_medical_patient.pdf"},
    )


@router.get("/excel")
async def export_default_excel(
    days: int = Query(default=30, le=365),
    patient_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Xuất bảng dữ liệu Excel chuỗi thời gian cho bệnh nhân / thiết bị chính."""
    device_id = "BLE_BAND_001"
    uuid_val = await crud_vital.resolve_device_uuid(db, device_id)
    vitals = await crud_vital.get_history(db, device_id=device_id, limit=days * 24 * 6)
    incidents = await crud_incident.list(db, device_id=uuid_val, limit=500)
    excel_bytes = report_service.generate_excel(uuid_val or device_id, vitals=vitals, incidents=incidents)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=report_medical_patient.xlsx"},
    )


@router.get("/{device_id}/pdf")
async def export_pdf_report(
    device_id: str,
    days: int = Query(default=7, le=90),
    db: AsyncSession = Depends(get_db),
):
    """
    Xuất báo cáo y tế PDF cho N ngày gần nhất.
    Bao gồm: biểu đồ sinh hiệu, danh sách sự kiện, thống kê.
    """
    uuid_val = await crud_vital.resolve_device_uuid(db, device_id)
    vitals = await crud_vital.get_history(db, device_id=device_id, limit=days * 24 * 6)
    incidents = await crud_incident.list(db, device_id=uuid_val, limit=100)

    pdf_bytes = report_service.generate_pdf(uuid_val or device_id, vitals=vitals, incidents=incidents)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{device_id}.pdf"},
    )


@router.get("/{device_id}/excel")
async def export_excel_report(
    device_id: str,
    days: int = Query(default=30, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Xuất báo cáo Excel với raw data sinh hiệu và incidents.
    """
    uuid_val = await crud_vital.resolve_device_uuid(db, device_id)
    vitals = await crud_vital.get_history(db, device_id=device_id, limit=days * 24 * 6)
    incidents = await crud_incident.list(db, device_id=uuid_val, limit=500)

    excel_bytes = report_service.generate_excel(uuid_val or device_id, vitals=vitals, incidents=incidents)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=report_{device_id}.xlsx"},
    )

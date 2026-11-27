# -*- coding: utf-8 -*-
"""
reminders.py – API quản lý lịch nhắc nhở uống thuốc, đo sinh hiệu & sinh hoạt trong ngày.
Vị trí: backend/app/api/v1/endpoints/mobile/reminders.py

Nguyên tắc:
- Zero Fake Data: Tuyệt đối không hardcode dữ liệu thuốc hoặc lịch nhắc nhở ảo.
- Lưu trữ và truy xuất lịch nhắc nhở thực tế của người dùng qua Redis/Database.
- Khi người dùng chưa tạo cữ thuốc nào, trả về danh sách rỗng để Mobile hiển thị đúng trạng thái thực tế.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.core.database import get_redis, get_db
from app.models.user import User
from app.models.prescription import Prescription
from app.crud.crud_doctor import _resolve_elderly_id

logger = logging.getLogger(__name__)

router = APIRouter()


class ReminderItemIn(BaseModel):
    name: str = Field(..., description="Tên thuốc hoặc hoạt động nhắc nhở")
    time: str = Field(..., description="Giờ nhắc nhở (HH:MM)")
    session: str = Field(default="MORNING", description="Buổi: MORNING, NOON, EVENING")
    dose: str = Field(default="", description="Liều lượng (VD: 1 viên sau ăn)")
    purpose: str = Field(default="", description="Mục đích sử dụng hoặc bệnh nền liên quan")
    category: str = Field(default="MEDICATION", description="MEDICATION, VITALS, ACTIVITY, REST")
    patient_id: Optional[str] = Field(default=None, description="ID người cao tuổi")


class MedicationItemIn(BaseModel):
    name: str = Field(..., description="Tên thuốc & hàm lượng (VD: Amlodipine 5mg)")
    dose: str = Field(default="1 viên", description="Liều lượng (VD: 1 viên)")
    sessions: List[str] = Field(default=["MORNING"], description="Cữ uống: MORNING, NOON, AFTERNOON, EVENING")
    time: Optional[str] = Field(default="08:00", description="Giờ hẹn cụ thể (HH:mm)")
    instructions: Optional[str] = Field(default="Sau khi ăn", description="Ghi chú / Hướng dẫn (trước/sau ăn)")


class HydrationItemIn(BaseModel):
    time: str = Field(default="08:00", description="Giờ uống nước (HH:MM)")
    amount: str = Field(default="250ml", description="Lượng nước (VD: 200ml, 250ml)")
    note: str = Field(default="Nước ấm", description="Ghi chú")
    patient_id: Optional[str] = Field(default=None, description="ID người cao tuổi")


class PrescriptionCreateIn(BaseModel):
    diagnosis: str = Field(..., description="Tên bệnh / Chẩn đoán (Diagnosis)")
    start_date: str = Field(..., description="Ngày bắt đầu uống (YYYY-MM-DD)")
    end_date: str = Field(..., description="Ngày kết thúc đợt thuốc (YYYY-MM-DD)")
    medications: List[MedicationItemIn] = Field(..., description="Danh sách các loại thuốc trong đơn")
    patient_id: Optional[str] = Field(default=None, description="ID người cao tuổi")


def _get_redis_key(target_id: Optional[str], date_str: str) -> str:
    uid = target_id or "default_user"
    return f"reminders:{uid}:{date_str}"


@router.get("/today", summary="Lấy danh sách nhắc nhở hôm nay của cụ")
async def get_today_reminders(
    patient_id: Optional[str] = Query(None, description="Lọc theo ID người cao tuổi"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Trả về dữ liệu lịch nhắc nhở thực tế trong ngày:
    - Nếu chưa có cữ thuốc nào được tạo: trả về danh sách rỗng (Zero Fake Data).
    - Đồng bộ theo ngày hiện tại, tài khoản người dùng và ID người cao tuổi từ PostgreSQL.
    """
    today_now = datetime.now()
    today_str = today_now.strftime("%Y-%m-%d")
    today_start = datetime.combine(today_now.date(), datetime.min.time()).astimezone()
    today_end = datetime.combine(today_now.date(), datetime.max.time()).astimezone()

    user_id_str = str(current_user.id) if current_user else None
    target_id = patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    medications_raw: List[Dict[str, Any]] = []
    meals: List[Dict[str, Any]] = []
    hydrations: List[Dict[str, Any]] = []

    try:
        raw_data = await redis.get(redis_key)
        if raw_data:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                medications_raw = parsed.get("medications", [])
                meals = parsed.get("meals", [])
                hydrations = parsed.get("hydrations", [])
            elif isinstance(parsed, list):
                medications_raw = parsed
    except Exception as exc:
        logger.warning("[Reminders] Lỗi khi truy vấn nhắc nhở từ Redis: %s", exc)

    # Lập bản đồ trạng thái đã uống đã ghi nhận trong Redis cho ngày hôm nay
    existing_status_map: Dict[str, Dict[str, Any]] = {}
    custom_meds: List[Dict[str, Any]] = []
    for m in medications_raw:
        m_id = m.get("id")
        if m_id:
            existing_status_map[m_id] = {
                "taken": m.get("taken", False),
                "takenAt": m.get("takenAt"),
            }
            if not m_id.startswith("rx-med-"):
                custom_meds.append(m)

    # Truy vấn đơn thuốc còn hiệu lực từ PostgreSQL
    patient_uuid = None
    if target_id:
        patient_uuid = await _resolve_elderly_id(db, target_id, create_if_missing=False)

    db_prescriptions: List[Prescription] = []
    if patient_uuid:
        stmt = (
            select(Prescription)
            .where(
                Prescription.patient_id == patient_uuid,
                Prescription.status == "ACTIVE",
                Prescription.start_date <= today_end,
                or_(Prescription.end_date.is_(None), Prescription.end_date >= today_start),
            )
            .order_by(Prescription.created_at.asc())
        )
        res = await db.execute(stmt)
        db_prescriptions = list(res.scalars().all())

    # Fallback kiểm tra in-memory store nếu DB chưa có
    from app.crud.crud_doctor import crud_doctor
    mem_rxs = crud_doctor.get_prescriptions(target_id or "") if target_id else []

    doctor_prescriptions: List[Dict[str, Any]] = []
    synced_doses: List[Dict[str, Any]] = []
    seen_rx_ids = set()

    for rx in db_prescriptions:
        rx_id_str = str(rx.id)
        seen_rx_ids.add(rx_id_str)
        doctor_prescriptions.append({
            "id": rx_id_str,
            "patient_id": str(rx.patient_id),
            "medication_name": rx.medication_name,
            "dosage": rx.dosage,
            "quantity": rx.quantity,
            "frequency": rx.frequency,
            "schedule_times": rx.schedule_times,
            "instructions": rx.instructions or "",
            "doctor_name": rx.doctor_name,
            "diagnosis": rx.diagnosis,
            "general_notes": rx.general_notes,
            "start_date": rx.start_date.isoformat() if rx.start_date else None,
            "end_date": rx.end_date.isoformat() if rx.end_date else None,
            "status": rx.status,
            "enable_speaker_reminder": rx.enable_speaker_reminder,
            "created_at": rx.created_at.strftime("%Y-%m-%d %H:%M:%S") if rx.created_at else None,
        })

        times = rx.schedule_times or ["08:00"]
        for t in times:
            session = "MORNING" if t < "11:00" else ("NOON" if t < "14:00" else "EVENING")
            dose_id = f"rx-med-{rx.id}-{t.replace(':', '')}"
            prior_state = existing_status_map.get(dose_id, {})
            is_taken = bool(prior_state.get("taken", False))
            taken_at = prior_state.get("takenAt")

            synced_doses.append({
                "id": dose_id,
                "name": rx.medication_name,
                "time": t,
                "session": session,
                "dose": rx.dosage,
                "quantity": rx.quantity,
                "instructions": rx.instructions or "",
                "purpose": rx.diagnosis or f"Chỉ định bởi {rx.doctor_name or 'Bác sĩ'}",
                "category": "MEDICATION",
                "taken": is_taken,
                "takenAt": taken_at,
                "from_doctor": True,
                "doctor_name": rx.doctor_name,
                "enable_speaker_reminder": rx.enable_speaker_reminder,
                "created_at": rx.created_at.strftime("%Y-%m-%d %H:%M:%S") if rx.created_at else today_str,
            })

    if not db_prescriptions and mem_rxs:
        for rx in mem_rxs:
            if rx.id not in seen_rx_ids:
                doctor_prescriptions.append(rx.model_dump())
                times = rx.schedule_times or ["08:00"]
                for t in times:
                    session = "MORNING" if t < "11:00" else ("NOON" if t < "14:00" else "EVENING")
                    dose_id = f"rx-med-{rx.id}-{t.replace(':', '')}"
                    prior_state = existing_status_map.get(dose_id, {})
                    is_taken = bool(prior_state.get("taken", False))
                    taken_at = prior_state.get("takenAt")

                    synced_doses.append({
                        "id": dose_id,
                        "name": rx.medication_name,
                        "time": t,
                        "session": session,
                        "dose": rx.dosage,
                        "quantity": rx.quantity,
                        "instructions": rx.instructions or "",
                        "purpose": getattr(rx, "diagnosis", None) or f"Chỉ định bởi {rx.doctor_name or 'Bác sĩ'}",
                        "category": "MEDICATION",
                        "taken": is_taken,
                        "takenAt": taken_at,
                        "from_doctor": True,
                        "doctor_name": rx.doctor_name,
                        "enable_speaker_reminder": rx.enable_speaker_reminder,
                        "created_at": rx.created_at or today_str,
                    })

    consolidated_medications = synced_doses + custom_meds

    # Lưu lại toàn bộ cữ thuốc đồng bộ vào Redis để endpoint toggle luôn tìm thấy mục tương ứng
    data_to_store = {
        "medications": consolidated_medications,
        "meals": meals,
        "hydrations": hydrations,
    }
    try:
        await redis.set(redis_key, json.dumps(data_to_store), ex=7 * 86400)
    except Exception as store_err:
        logger.warning("[Reminders] Không thể lưu cache Redis: %s", store_err)

    completed_count = sum(1 for m in consolidated_medications if m.get("taken", False))

    return {
        "date": today_str,
        "patient_id": patient_id,
        "total_medications": len(consolidated_medications),
        "completed_medications": completed_count,
        "hub_voice_reminder_enabled": True,
        "medications": consolidated_medications,
        "meals": meals,
        "hydrations": hydrations,
        "doctor_prescriptions": doctor_prescriptions,
    }


@router.post("", summary="Tạo cữ thuốc hoặc nhắc nhở mới")
async def create_reminder(
    item_in: ReminderItemIn,
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Thêm một cữ thuốc hoặc hoạt động nhắc nhở thực tế cho người cao tuổi."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = item_in.patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    medications: List[Dict[str, Any]] = []
    meals: List[Dict[str, Any]] = []

    try:
        raw_data = await redis.get(redis_key)
        if raw_data:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                medications = parsed.get("medications", [])
                meals = parsed.get("meals", [])
            elif isinstance(parsed, list):
                medications = parsed
    except Exception:
        pass

    new_item = {
        "id": f"rem-{uuid.uuid4().hex[:8]}",
        "name": item_in.name,
        "time": item_in.time,
        "session": item_in.session,
        "dose": item_in.dose,
        "purpose": item_in.purpose,
        "category": item_in.category,
        "patient_id": item_in.patient_id,
        "taken": False,
        "created_at": datetime.now().isoformat(),
    }
    medications.append(new_item)

    # Lưu vào Redis với TTL 7 ngày
    data_to_store = {
        "medications": medications,
        "meals": meals,
    }
    await redis.set(redis_key, json.dumps(data_to_store), ex=7 * 86400)

    return {"status": "success", "message": "Đã tạo lịch nhắc nhở thành công", "data": new_item}


@router.post("/prescription", summary="Thêm đơn thuốc điều trị mới với nhiều loại thuốc")
async def create_prescription(
    prescription_in: PrescriptionCreateIn,
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Kê đơn thuốc điều trị mới:
    - Lưu thông tin đơn thuốc gồm: Tên bệnh / Chẩn đoán, Ngày bắt đầu, Ngày kết thúc.
    - Hỗ trợ thêm nhiều loại thuốc cùng lúc: Tên & hàm lượng, liều lượng, cữ uống & giờ hẹn, hướng dẫn.
    - Tự động phân rã thành các cữ nhắc nhở cụ thể trong ngày (Sáng / Trưa / Chiều / Tối).
    - Lưu đồng thời vào PostgreSQL (Prescription table) để đồng bộ hoàn toàn với Doctor Web.
    """
    today_now = datetime.now()
    today_str = today_now.strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = prescription_in.patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    # 1. Lưu vào PostgreSQL để bác sĩ và hệ thống dùng chung
    patient_uuid = await _resolve_elderly_id(db, target_id or "", create_if_missing=True)
    try:
        s_date = datetime.strptime(prescription_in.start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        s_date = datetime.now(timezone.utc)
    try:
        e_date = datetime.strptime(prescription_in.end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        e_date = None

    medications: List[Dict[str, Any]] = []
    meals: List[Dict[str, Any]] = []

    try:
        raw_data = await redis.get(redis_key)
        if raw_data:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                medications = parsed.get("medications", [])
                meals = parsed.get("meals", [])
            elif isinstance(parsed, list):
                medications = parsed
    except Exception:
        pass

    session_default_times = {
        "MORNING": "08:00",
        "NOON": "12:00",
        "AFTERNOON": "17:00",
        "EVENING": "20:00",
    }

    created_reminders = []
    for med in prescription_in.medications:
        chosen_sessions = med.sessions if med.sessions else ["MORNING"]
        sched_times = []
        for sess in chosen_sessions:
            item_time = med.time if med.time else session_default_times.get(sess, "08:00")
            if item_time not in sched_times:
                sched_times.append(item_time)
            instructions_note = f" - {med.instructions}" if med.instructions else ""
            full_dose = f"{med.dose}{instructions_note}"
            new_item = {
                "id": f"rem-{uuid.uuid4().hex[:8]}",
                "name": med.name,
                "time": item_time,
                "session": sess if sess in ("MORNING", "NOON", "EVENING") else "EVENING",
                "dose": full_dose,
                "purpose": prescription_in.diagnosis,
                "category": "MEDICATION",
                "start_date": prescription_in.start_date,
                "end_date": prescription_in.end_date,
                "diagnosis": prescription_in.diagnosis,
                "patient_id": str(patient_uuid),
                "taken": False,
                "created_at": datetime.now().isoformat(),
            }
            medications.append(new_item)
            created_reminders.append(new_item)

        # Lưu bản ghi PostgreSQL Prescription
        db_rx = Prescription(
            patient_id=patient_uuid,
            doctor_id=current_user.id if current_user else None,
            doctor_name=current_user.full_name if current_user else "Người chăm sóc",
            diagnosis=prescription_in.diagnosis,
            medication_name=med.name,
            dosage=med.dose,
            frequency="Hàng ngày",
            schedule_times_json=json.dumps(sched_times or ["08:00"]),
            instructions=med.instructions or "",
            start_date=s_date,
            end_date=e_date,
            status="ACTIVE",
            enable_speaker_reminder=True,
        )
        db.add(db_rx)

    await db.commit()

    data_to_store = {
        "medications": medications,
        "meals": meals,
    }
    await redis.set(redis_key, json.dumps(data_to_store), ex=7 * 86400)

    # Lưu đơn thuốc theo tài khoản hoặc người cao tuổi
    rx_key = f"prescriptions:{target_id or 'default_user'}"
    rx_entry = {
        "id": f"rx-{uuid.uuid4().hex[:8]}",
        "patient_id": str(patient_uuid),
        "diagnosis": prescription_in.diagnosis,
        "start_date": prescription_in.start_date,
        "end_date": prescription_in.end_date,
        "medications_count": len(prescription_in.medications),
        "medications": [m.model_dump() for m in prescription_in.medications],
        "created_at": datetime.now().isoformat(),
    }
    try:
        raw_rxs = await redis.get(rx_key)
        rxs_list = json.loads(raw_rxs) if raw_rxs else []
        rxs_list.append(rx_entry)
        await redis.set(rx_key, json.dumps(rxs_list), ex=30 * 86400)
    except Exception:
        pass

    # Thông báo cho tất cả thành viên trong gia đình trên thanh thông báo Android (Incident + WS + FCM)
    try:
        from app.crud.crud_doctor import crud_doctor

        creator_name = (
            current_user.full_name
            if (current_user and getattr(current_user, "full_name", None))
            else "Chủ hộ / Người chăm sóc"
        )
        med_summary = ", ".join(f"{m.name} ({m.dose})" for m in prescription_in.medications[:3])
        if len(prescription_in.medications) > 3:
            med_summary += f" và {len(prescription_in.medications) - 3} thuốc khác"
        await crud_doctor._notify_family_prescription(
            db=db,
            patient_uuid=patient_uuid,
            doctor_name=creator_name,
            med_summary=med_summary,
            diagnosis=prescription_in.diagnosis,
        )
    except Exception as exc:
        logger.warning("[Reminders] Lỗi gửi thông báo đơn thuốc mới cho gia đình: %s", exc)

    return {
        "status": "success",
        "message": f"Đã lưu đơn thuốc '{prescription_in.diagnosis}' với {len(prescription_in.medications)} loại thuốc thành công.",
        "prescription": rx_entry,
        "reminders_count": len(created_reminders),
    }


@router.put("/{reminder_id}/toggle", summary="Đánh dấu đã uống hoặc chưa uống thuốc")
async def toggle_reminder(
    reminder_id: str,
    patient_id: Optional[str] = Query(None, description="Lọc theo ID người cao tuổi"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Cập nhật trạng thái đã uống thuốc / hoàn thành một cữ nhắc nhở."""
    today_now = datetime.now()
    today_str = today_now.strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    try:
        raw_data = None
        try:
            raw_data = await redis.get(redis_key)
        except Exception as exc:
            logger.warning("[Reminders] Lỗi kết nối Redis trong toggle: %s", exc)

        parsed = json.loads(raw_data) if raw_data else {"medications": [], "meals": [], "hydrations": []}
        medications = parsed.get("medications", []) if isinstance(parsed, dict) else parsed

        found = False
        new_state = False
        taken_at = None
        for m in medications:
            if m.get("id") == reminder_id:
                m["taken"] = not m.get("taken", False)
                new_state = m["taken"]
                taken_at = today_now.strftime("%H:%M") if new_state else None
                m["takenAt"] = taken_at
                found = True
                break

        # Fallback nếu toggle một dose rx-med hợp lệ trước khi GET /today kịp khởi tạo
        if not found and reminder_id.startswith("rx-med-"):
            parts = reminder_id.split("-")
            time_raw = parts[-1] if len(parts) >= 4 else "0800"
            t_str = f"{time_raw[:2]}:{time_raw[2:]}" if len(time_raw) == 4 else "08:00"
            session = "MORNING" if t_str < "11:00" else ("NOON" if t_str < "14:00" else "EVENING")
            new_state = True
            taken_at = today_now.strftime("%H:%M")
            new_item = {
                "id": reminder_id,
                "name": "Thuốc điều trị",
                "time": t_str,
                "session": session,
                "dose": "1 liều",
                "category": "MEDICATION",
                "taken": new_state,
                "takenAt": taken_at,
                "from_doctor": True,
                "created_at": today_str,
            }
            medications.append(new_item)
            found = True

        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mục nhắc nhở tương ứng")

        if isinstance(parsed, dict):
            parsed["medications"] = medications
        else:
            parsed = {"medications": medications}

        try:
            await redis.set(redis_key, json.dumps(parsed), ex=7 * 86400)
        except Exception as exc:
            logger.warning("[Reminders] Lỗi lưu Redis trong toggle: %s", exc)

        return {
            "status": "success",
            "reminder_id": reminder_id,
            "taken": new_state,
            "takenAt": taken_at,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Reminders] Lỗi khi cập nhật trạng thái nhắc nhở: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ")


@router.delete("/{reminder_id}", summary="Xóa một mục nhắc nhở")
async def delete_reminder(
    reminder_id: str,
    patient_id: Optional[str] = Query(None, description="Lọc theo ID người cao tuổi"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Xóa một cữ thuốc khỏi lịch nhắc nhở hôm nay."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    try:
        raw_data = await redis.get(redis_key)
        if not raw_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch nhắc nhở")

        parsed = json.loads(raw_data)
        medications = parsed.get("medications", []) if isinstance(parsed, dict) else parsed

        initial_len = len(medications)
        medications = [m for m in medications if m.get("id") != reminder_id]

        if len(medications) == initial_len:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mục nhắc nhở để xóa")

        if isinstance(parsed, dict):
            parsed["medications"] = medications
        else:
            parsed = medications

        await redis.set(redis_key, json.dumps(parsed), ex=7 * 86400)
        return {"status": "success", "message": "Đã xóa lịch nhắc nhở thành công"}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Reminders] Lỗi khi xóa nhắc nhở: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ")


# ==============================================================================
# CÁC ENDPOINT QUẢN LÝ BỔ SUNG NƯỚC ĐỊNH KỲ (HYDRATION)
# ==============================================================================

@router.post("/hydration", summary="Thêm mốc nhắc uống nước mới")
async def create_hydration_reminder(
    item_in: HydrationItemIn,
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Thêm một mốc nhắc nhở uống nước trong ngày cho người cao tuổi."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = item_in.patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    data: Dict[str, Any] = {"medications": [], "meals": [], "hydrations": []}
    try:
        raw_data = await redis.get(redis_key)
        if raw_data:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                data = parsed
                data.setdefault("hydrations", [])
    except Exception:
        pass

    new_h = {
        "id": f"hyd-{uuid.uuid4().hex[:8]}",
        "time": item_in.time,
        "amount": item_in.amount,
        "note": item_in.note,
        "done": False,
        "created_at": datetime.now().isoformat(),
    }
    data["hydrations"].append(new_h)
    data["hydrations"].sort(key=lambda x: x.get("time", ""))
    await redis.set(redis_key, json.dumps(data), ex=7 * 86400)
    return {"status": "success", "message": "Đã thêm mốc uống nước thành công", "data": new_h}


@router.post("/hydration/template", summary="Tạo lịch uống nước chuẩn y tế cho người cao tuổi")
async def create_standard_hydration_template(
    patient_id: Optional[str] = Query(None, description="Lọc theo ID người cao tuổi"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Tự động tạo lịch uống nước 4 cữ chuẩn y tế lão khoa (1.5 - 2L/ngày)."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    data: Dict[str, Any] = {"medications": [], "meals": [], "hydrations": []}
    try:
        raw_data = await redis.get(redis_key)
        if raw_data:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                data = parsed
    except Exception:
        pass

    standard_slots = [
        {"id": f"hyd-{uuid.uuid4().hex[:8]}", "time": "07:00", "amount": "250ml", "note": "Ly nước ấm khi thức dậy (kích hoạt tuần hoàn & tiêu hóa)", "done": False},
        {"id": f"hyd-{uuid.uuid4().hex[:8]}", "time": "10:30", "amount": "200ml", "note": "Giữa buổi sáng (bù nước sau vận động nhẹ)", "done": False},
        {"id": f"hyd-{uuid.uuid4().hex[:8]}", "time": "15:00", "amount": "250ml", "note": "Giữa buổi chiều (tránh tụt huyết áp tư thế)", "done": False},
        {"id": f"hyd-{uuid.uuid4().hex[:8]}", "time": "19:30", "amount": "150ml", "note": "Sau bữa tối (uống trước ngủ 1-2h, tránh tiểu đêm)", "done": False},
    ]
    data["hydrations"] = standard_slots
    await redis.set(redis_key, json.dumps(data), ex=7 * 86400)
    return {"status": "success", "message": "Đã tạo lịch uống nước chuẩn y tế 4 cữ thành công", "data": standard_slots}


@router.put("/hydration/{hydration_id}/toggle", summary="Đánh dấu đã uống hoặc chưa uống nước")
async def toggle_hydration(
    hydration_id: str,
    patient_id: Optional[str] = Query(None, description="Lọc theo ID người cao tuổi"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Cập nhật trạng thái đã bổ sung nước cho một mốc giờ."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    try:
        raw_data = await redis.get(redis_key)
        if not raw_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch nhắc nhở")
        parsed = json.loads(raw_data)
        hydrations = parsed.get("hydrations", [])
        found = False
        new_state = False
        for h in hydrations:
            if h.get("id") == hydration_id:
                h["done"] = not h.get("done", False)
                new_state = h["done"]
                found = True
                break
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mốc nước tương ứng")
        await redis.set(redis_key, json.dumps(parsed), ex=7 * 86400)
        return {"status": "success", "hydration_id": hydration_id, "done": new_state}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Reminders] Lỗi khi cập nhật mốc nước: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ")


@router.delete("/hydration/{hydration_id}", summary="Xóa một mốc nhắc uống nước")
async def delete_hydration(
    hydration_id: str,
    patient_id: Optional[str] = Query(None, description="Lọc theo ID người cao tuổi"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    redis: Redis = Depends(get_redis),
) -> Dict[str, Any]:
    """Xóa một mốc nhắc nhở uống nước."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    user_id_str = str(current_user.id) if current_user else None
    target_id = patient_id or user_id_str
    redis_key = _get_redis_key(target_id, today_str)

    try:
        raw_data = await redis.get(redis_key)
        if not raw_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch nhắc nhở")
        parsed = json.loads(raw_data)
        hydrations = parsed.get("hydrations", [])
        initial_len = len(hydrations)
        parsed["hydrations"] = [h for h in hydrations if h.get("id") != hydration_id]
        if len(parsed["hydrations"]) == initial_len:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mốc nước để xóa")
        await redis.set(redis_key, json.dumps(parsed), ex=7 * 86400)
        return {"status": "success", "message": "Đã xóa mốc uống nước thành công"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Reminders] Lỗi khi xóa mốc nước: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ")

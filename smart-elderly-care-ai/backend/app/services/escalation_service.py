"""
escalation_service.py – Dịch vụ Leo thang Khẩn cấp Tự động (Auto-Escalation SOS v2).

Quy chuẩn vận hành theo Escalation Redesign:
- Bước 1 (0s - 15s): Chờ người nhà hoặc người tại chỗ xác nhận hỗ trợ (WAITING).
- Bước 2 (Sau 15s): Hết thời gian chờ, thực hiện RECHECK lâm sàng dữ liệu sinh hiệu 45s gần nhất:
  + Nếu là TÉ NGÃ: Bắt buộc gọi (Không thể hủy bằng sinh hiệu).
  + Nếu MẤT TÍN HIỆU / RƠI VÒNG: Coi là tình huống bất tỉnh -> Bắt buộc gọi.
  + Nếu ĐÃ TỰ HỒI PHỤC ỔN ĐỊNH: Chuyển sang STOOD_DOWN, hủy tự động gọi, lưu theo dõi 5 phút.
  + Nếu VẪN NGUY HIỂM / VÙNG XÁM: Tự động kích hoạt gọi tới số người nhà: 0898230852.
- Bước 3 (Tái phát trong 5 phút): Nếu sự cố tái phát trong vòng 5 phút sau STOOD_DOWN,
  lập tức leo thang gọi điện ngay (delay = 0s).
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select

from app.core.database import AsyncSessionLocal

logger = logging.getLogger("escalation_service")

# Cấu hình thời gian chờ leo thang (chuẩn lâm sàng 45s, có thể ghi đè qua env ESCALATION_DELAY_SECONDS)
DEFAULT_ESCALATION_DELAY_SECONDS = int(os.environ.get("ESCALATION_DELAY_SECONDS", "45"))
ESCALATION_TARGET_PHONE = "0898230852"
ESCALATION_TAG = "ESCALATED_AUTO_CALL"

# Lưu các task đếm ngược đang chạy theo incident_id để tránh trùng lặp
_active_timers: dict[str, asyncio.Task] = {}

# Lưu vết các thiết bị vừa tự hồi phục STOOD_DOWN: {device_id_str: timestamp_utc}
_stood_down_devices: dict[str, datetime] = {}


def record_stood_down_device(device_id: str | UUID) -> None:
    """Ghi nhận mốc thời gian thiết bị vừa tự hồi phục an toàn."""
    _stood_down_devices[str(device_id)] = datetime.now(timezone.utc)


def check_recent_stood_down(device_id: str | UUID) -> bool:
    """Kiểm tra xem thiết bị có vừa tự hồi phục trong vòng 5 phút (300 giây) trước đó không."""
    dev_str = str(device_id)
    t = _stood_down_devices.get(dev_str)
    if not t:
        return False
    now = datetime.now(timezone.utc)
    if (now - t).total_seconds() <= 300:
        return True
    _stood_down_devices.pop(dev_str, None)
    return False


async def broadcast_ws_event(payload: dict) -> None:
    """Phát sự kiện WebSocket tới toàn bộ client đang kết nối (/ws/alerts)."""
    try:
        from app.api.websockets.vitals_ws import alert_clients
        text = json.dumps(payload, ensure_ascii=False)
        for client_ws in list(alert_clients):
            try:
                await client_ws.send_text(text)
            except Exception:
                if client_ws in alert_clients:
                    alert_clients.remove(client_ws)
    except Exception as exc:
        logger.warning("[Escalation] Lỗi broadcast WS: %s", exc)


async def recheck_vitals_recovery(session, incident) -> tuple[bool, str]:
    """
    Thực hiện RECHECK lâm sàng trước khi quyết định gọi điện:
    - Té ngã: Bắt buộc gọi (Không hủy bằng sinh hiệu).
    - Sinh hiệu: Kiểm tra dữ liệu trong 45s gần nhất.
      + Mất tín hiệu / thiếu dữ liệu: Coi như nguy kịch -> Gọi.
      + Vẫn nguy hiểm / vùng xám: Gọi.
      + Hồi phục ổn định theo đúng vị từ lâm sàng: Hủy gọi -> STOOD_DOWN.
    Trả về: (is_recovered: bool, reason: str)
    """
    if incident.alert_type in ("FALL_DETECTED", "AI_FALL_DETECTED"):
        return False, "Sự cố té ngã: Bắt buộc kích hoạt chuỗi khẩn cấp (Không hủy bằng sinh hiệu)."

    from app.models.vital_sign import VitalSign

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=45)
    stmt = (
        select(VitalSign)
        .where(VitalSign.device_id == incident.device_id, VitalSign.time >= cutoff)
        .order_by(VitalSign.time.desc())
        .limit(10)
    )
    res = await session.execute(stmt)
    vitals = res.scalars().all()

    # 1. Kiểm tra mất tín hiệu
    if not vitals:
        return False, "Mất tín hiệu đo: Không có dữ liệu sinh hiệu trong 45s qua sau cơn nguy cấp."

    valid_samples = [v for v in vitals if (v.heart_rate or 0) > 0]
    if len(valid_samples) < 3:
        return False, "Mất tín hiệu hoặc thiếu mẫu hợp lệ sau cơn nguy cấp (ít hơn 3 mẫu đo)."

    alert_type = incident.alert_type

    # 2. Vị từ hồi phục theo từng loại sự cố
    if alert_type in ("CARDIO_COLLAPSE", "LOW_HEART_RATE"):
        for v in valid_samples[:5]:
            hr = v.heart_rate or 0
            spo2 = v.spo2
            if not (55 <= hr <= 100):
                return False, f"Nhịp tim vẫn nguy hiểm ({hr} bpm, chưa đạt ngưỡng an toàn 55-100 bpm)."
            if spo2 is not None and spo2 < 93:
                return False, f"Oxy máu SpO2 vẫn chưa hồi phục an toàn ({spo2}%, yêu cầu >= 93%)."
        avg_hr = sum(v.heart_rate for v in valid_samples[:5]) // len(valid_samples[:5])
        avg_spo2 = sum(v.spo2 or 98 for v in valid_samples[:5]) // len(valid_samples[:5])
        return True, f"Nhịp tim & SpO2 đã hồi phục an toàn (TB: {avg_hr} bpm, SpO2: {avg_spo2}%)."

    elif alert_type == "HIGH_HEART_RATE":
        for v in valid_samples[:5]:
            hr = v.heart_rate or 0
            if hr > 100:
                return False, f"Nhịp tim vẫn cao ({hr} bpm, vượt ngưỡng hồi phục 100 bpm)."
        avg_hr = sum(v.heart_rate for v in valid_samples[:5]) // len(valid_samples[:5])
        return True, f"Nhịp tim đã hạ về mức an toàn ({avg_hr} bpm <= 100 bpm)."

    elif alert_type == "LOW_SPO2":
        for v in valid_samples[:5]:
            spo2 = v.spo2 or 0
            if spo2 < 93:
                return False, f"SpO2 vẫn thấp ({spo2}%, chưa đạt ngưỡng an toàn 93%)."
        avg_spo2 = sum(v.spo2 or 0 for v in valid_samples[:5]) // len(valid_samples[:5])
        return True, f"SpO2 đã hồi phục ổn định ({avg_spo2}% >= 93%)."

    elif alert_type == "CRITICAL_TRIAD":
        for v in valid_samples[:5]:
            hr = v.heart_rate or 0
            spo2 = v.spo2 or 0
            temp = v.skin_temp_max
            if hr > 100 or (spo2 > 0 and spo2 < 93) or (temp and temp >= 37.5):
                return False, "Tam chứng nguy kịch chưa hồi phục hoàn toàn."
        return True, "Tam chứng nguy kịch đã ổn định."

    return False, f"Sự cố {alert_type}: Duy trì leo thang an toàn."


async def execute_escalation_decision(incident_id: str | UUID, force_escalate: bool = False, custom_reason: Optional[str] = None) -> dict | None:
    """Thực hiện RECHECK và ra quyết định: STOOD_DOWN (hồi phục) hoặc ESCALATED_AUTO_CALL (gọi điện tới 0898230852)."""
    inc_uuid = UUID(str(incident_id))
    async with AsyncSessionLocal() as session:
        from app.models.incident import Incident
        incident = await session.get(Incident, inc_uuid)
        if not incident:
            return None

        if incident.is_acknowledged:
            return {
                "id": str(incident.id),
                "is_acknowledged": True,
                "escalation_status": "RESOLVED",
            }

        # 1. BƯỚC RECHECK LÂM SÀNG
        if force_escalate:
            is_recovered, reason = False, custom_reason or "Kích hoạt leo thang khẩn cấp cưỡng bức / Tái phát trong 5 phút"
        else:
            is_recovered, reason = await recheck_vitals_recovery(session, incident)

        # 2A. NẾU ĐÃ TỰ HỒI PHỤC ỔN ĐỊNH -> CHUYỂN SANG STOOD_DOWN (HỦY GỌI)
        if is_recovered:
            existing_notes = (incident.notes or "").strip()
            tag_line = f"STOOD_DOWN|{reason}"
            incident.notes = f"{existing_notes}\n{tag_line}".strip() if existing_notes else tag_line
            await session.commit()
            await session.refresh(incident)

            record_stood_down_device(incident.device_id)

            ws_payload = {
                "type": "INCIDENT_STOOD_DOWN",
                "incident_id": str(incident.id),
                "data": {
                    "id": str(incident.id),
                    "device_id": str(incident.device_id),
                    "alert_type": incident.alert_type,
                    "escalation_status": "STOOD_DOWN",
                    "reason": reason,
                    "message": f"Chỉ số của cụ đã tự hồi phục an toàn ({reason}). Đã hủy tự động gọi tới {ESCALATION_TARGET_PHONE}.",
                    "target_phone": ESCALATION_TARGET_PHONE,
                    "stood_down_at": datetime.now(timezone.utc).isoformat(),
                },
            }
            await broadcast_ws_event(ws_payload)
            logger.info("[Escalation] Sự cố %s tự hồi phục -> STOOD_DOWN: %s", incident.id, reason)
            return ws_payload["data"]

        # 2B. NẾU VẪN NGUY HIỂM / MẤT TÍN HIỆU / TÉ NGÃ -> TỰ ĐỘNG GỌI 0898230852
        existing_notes = (incident.notes or "").strip()
        if ESCALATION_TAG not in existing_notes:
            tag_line = f"{ESCALATION_TAG}|{reason} - Tự động gọi tới số {ESCALATION_TARGET_PHONE}"
            incident.notes = f"{existing_notes}\n{tag_line}".strip() if existing_notes else tag_line
            await session.commit()
            await session.refresh(incident)

        try:
            from app.services.redis import redis_service
            await redis_service.invalidate_incidents_cache()
        except Exception:
            pass

        # Kích hoạt cuộc gọi qua Tổng đài VoIP Cloud Gateway
        try:
            from app.services.voip_service import place_cloud_emergency_call
            await place_cloud_emergency_call(
                target_phone=ESCALATION_TARGET_PHONE,
                patient_name="Cụ Nguyễn Văn A",
                reason=reason,
                incident_id=str(incident.id),
            )
        except Exception as e_voip:
            logger.warning("[Escalation] Không thể kết nối VoIP Cloud: %s", e_voip)

        # Bắn thông báo đẩy FCM / Web Push khẩn cấp tới điện thoại Người nhà & Web Bác sĩ (chạy nền)
        try:
            from app.models.device import Device
            from app.models.house import House, HouseMember
            from app.models.user import User
            from app.services.notification.fcm_service import FCMService

            fcm_tokens: list[str] = []
            if incident.device_id:
                dev = await session.get(Device, incident.device_id)
                if dev and dev.house_id:
                    # 1. Tìm tất cả thành viên & bác sĩ trong căn nhà qua HouseMember
                    stmt_members = select(HouseMember.user_id).where(HouseMember.house_id == dev.house_id)
                    mem_res = await session.execute(stmt_members)
                    user_ids = set(mem_res.scalars().all())

                    # 2. Bổ sung chủ nhà nếu có
                    house = await session.get(House, dev.house_id)
                    if house and house.owner_id:
                        user_ids.add(house.owner_id)

                    if user_ids:
                        stmt_users = select(User).where(User.id.in_(user_ids), User.is_active.is_(True))
                        u_res = await session.execute(stmt_users)
                        for u in u_res.scalars().all():
                            if u.fcm_token:
                                fcm_tokens.append(u.fcm_token)

            unique_tokens = list(dict.fromkeys(fcm_tokens))
            if unique_tokens:
                fcm = FCMService()
                fcm.send_alert(
                    fcm_tokens=unique_tokens,
                    title="🚨 BÁO ĐỘNG ĐỎ: TỰ ĐỘNG LEO THANG CẤP CỨU!",
                    body=f"Sự cố {incident.alert_type} chưa có người phản hồi sau 45s. Hệ thống đã tự động gọi khẩn cấp tới {ESCALATION_TARGET_PHONE}!",
                    data={
                        "type": "INCIDENT_ESCALATED",
                        "incident_id": str(incident.id),
                        "device_id": str(incident.device_id) if incident.device_id else "",
                        "alert_type": incident.alert_type,
                        "target_phone": ESCALATION_TARGET_PHONE,
                        "url": "/notifications",
                    },
                    priority="high",
                )
                logger.info("[Escalation] Đã bắn FCM push notification leo thang tới %d thiết bị", len(unique_tokens))
        except Exception as e_fcm:
            logger.warning("[Escalation] Lỗi khi gửi FCM Push leo thang khẩn cấp: %s", e_fcm)

        ws_payload = {
            "type": "INCIDENT_ESCALATED",
            "incident_id": str(incident.id),
            "data": {
                "id": str(incident.id),
                "device_id": str(incident.device_id),
                "alert_type": incident.alert_type,
                "escalation_status": ESCALATION_TAG,
                "target_phone": ESCALATION_TARGET_PHONE,
                "escalated_at": datetime.now(timezone.utc).isoformat(),
                "reason": reason,
                "message": f"Đã tự động kích hoạt gọi tới người nhà ({ESCALATION_TARGET_PHONE}) sau khi hết thời gian chờ (Lý do: {reason})",
            },
        }
        await broadcast_ws_event(ws_payload)
        logger.warning("[Escalation] Đã leo thang khẩn cấp sự cố %s -> %s (Gọi: %s, Lý do: %s)", incident.id, ESCALATION_TAG, ESCALATION_TARGET_PHONE, reason)
        return ws_payload["data"]


async def _escalation_countdown_worker(incident_id: str, delay_seconds: int) -> None:
    """Chờ hết delay_seconds, sau đó thực hiện RECHECK lâm sàng và ra quyết định gọi điện."""
    try:
        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)
        await execute_escalation_decision(incident_id)
    except asyncio.CancelledError:
        logger.info("[Escalation] Đã hủy bộ đếm ngược cho sự cố %s", incident_id)
    except Exception as exc:
        logger.error("[Escalation] Lỗi trong worker đếm ngược %s: %s", incident_id, exc)
    finally:
        _active_timers.pop(incident_id, None)


def schedule_auto_escalation(incident_id: str | UUID, delay_seconds: int = DEFAULT_ESCALATION_DELAY_SECONDS) -> None:
    """Lên lịch bộ đếm ngược leo thang tự động cho sự cố té ngã / nguy kịch."""
    inc_str = str(incident_id)
    existing = _active_timers.get(inc_str)
    if existing and not existing.done():
        return
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(_escalation_countdown_worker(inc_str, delay_seconds))
        _active_timers[inc_str] = task
        logger.info("[Escalation] Đã bật bộ đếm ngược %ds cho sự cố %s (Đích gọi: %s)", delay_seconds, inc_str, ESCALATION_TARGET_PHONE)
    except RuntimeError:
        logger.debug("[Escalation] Không có event loop để tạo task đếm ngược cho %s", inc_str)


def cancel_auto_escalation(incident_id: str | UUID) -> None:
    """Hủy bộ đếm ngược khi người nhà hoặc bác sĩ đã xác nhận xử lý."""
    inc_str = str(incident_id)
    task = _active_timers.pop(inc_str, None)
    if task and not task.done():
        task.cancel()

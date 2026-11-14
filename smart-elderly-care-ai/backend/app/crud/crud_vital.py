"""
crud_vital.py – CRUD / Repository cho VitalSign (TimescaleDB).
Hỗ trợ:
- Tự động phân giải device_id linh hoạt (chấp nhận cả UUID và chuỗi Serial như 'BLE_BAND_001').
- Lấy sinh hiệu mới nhất, lịch sử đo theo chuỗi thời gian, và thống kê tổng hợp (Min/Max/Avg/FallCount).
- Ghi nhận sinh hiệu mới, tự động đồng bộ sang Redis Cache và đẩy WebSocket tức thời.
- Lấy sinh hiệu tổng quan hiện tại của người dùng (phục vụ màn hình Dashboard).
Vị trí: backend/app/crud/crud_vital.py
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional, Union
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device, DeviceType
from app.models.vital_sign import VitalSign
from app.schemas.vital import VitalStats

logger = logging.getLogger(__name__)


class CRUDVital:

    async def resolve_device_uuid(
        self, db: AsyncSession, device_identifier: Optional[Union[str, UUID]]
    ) -> Optional[UUID]:
        """
        Phân giải linh hoạt mã định danh thiết bị:
        - Nếu đã là UUID -> Trả về trực tiếp.
        - Nếu là chuỗi UUID chuẩn (VD: 'd0000002-...') -> Parse thành UUID.
        - Nếu là mã phần cứng Serial (VD: 'BLE_BAND_001', 'SECA_001') -> Tìm trong bảng devices để lấy UUID.
        """
        if not device_identifier:
            return None

        if isinstance(device_identifier, UUID):
            return device_identifier

        clean_str = device_identifier.strip()
        try:
            return UUID(clean_str)
        except ValueError:
            pass

        # Tra cứu theo device_id (mã serial) hoặc tên thiết bị
        result = await db.execute(
            select(Device.id).where(
                or_(
                    Device.device_id == clean_str,
                    Device.name == clean_str,
                )
            ).limit(1)
        )
        found_id = result.scalar_one_or_none()
        if found_id:
            return found_id

        # Tự động tạo bản ghi Device để đáp ứng ràng buộc khóa ngoại (Foreign Key)
        try:
            from app.models.house import House
            house_res = await db.execute(select(House.id, House.owner_id).limit(1))
            house_row = house_res.first()
            is_band = any(k in clean_str.lower() for k in ["band", "watch", "ble", "miband", "mi_band"])
            new_dev = Device(
                device_id=clean_str,
                name="Xiaomi Mi Band" if "mi" in clean_str.lower() or "band" in clean_str.lower() else f"Thiết bị {clean_str}",
                device_type=DeviceType.SMARTBAND if is_band else DeviceType.CAMERA,
                sub_title="Kết nối qua App Bridge (Notify for Mi Band / Webhook)",
                status="ONLINE",
                is_online=True,
                house_id=house_row[0] if house_row else None,
                owner_id=house_row[1] if house_row else None,
            )
            db.add(new_dev)
            await db.flush()
            await db.refresh(new_dev)
            logger.info("[CRUDVital] Tự động khởi tạo Device '%s' (UUID: %s)", clean_str, new_dev.id)
            return new_dev.id
        except Exception as err:
            logger.warning("[CRUDVital] Không thể tự động tạo Device '%s': %s", clean_str, err)
            return None

    async def get_latest(
        self, db: AsyncSession, device_id: Union[str, UUID]
    ) -> Optional[VitalSign]:
        """Lấy bản ghi sinh hiệu mới nhất theo thiết bị."""
        uuid_val = await self.resolve_device_uuid(db, device_id)
        if not uuid_val:
            return None

        result = await db.execute(
            select(VitalSign)
            .where(VitalSign.device_id == uuid_val)
            .order_by(VitalSign.time.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_history(
        self,
        db: AsyncSession,
        device_id: Optional[Union[str, UUID]] = None,
        limit: int = 100,
        offset: int = 0,
        target_date: Optional[str] = None,
    ) -> List[VitalSign]:
        """Lấy lịch sử chuỗi thời gian sinh hiệu của thiết bị (phân trang và lọc ngày)."""
        uuid_val = None
        if device_id:
            uuid_val = await self.resolve_device_uuid(db, device_id)

        # Nếu không tìm thấy UUID của device_id truyền vào (vd: 'hub-01' là Hub chứ không phải band),
        # tự động tìm thiết bị Smartband trong hệ thống
        if not uuid_val:
            res_band = await db.execute(
                select(Device.id)
                .where(Device.device_type == DeviceType.SMARTBAND)
                .order_by(Device.created_at.desc())
                .limit(1)
            )
            uuid_val = res_band.scalar_one_or_none()

        query = select(VitalSign)
        if uuid_val:
            query = query.where(VitalSign.device_id == uuid_val)

        if target_date:
            try:
                from datetime import time as dt_time
                dt = datetime.strptime(target_date.strip(), "%Y-%m-%d").date()
                # Bao quát cả múi giờ Việt Nam UTC+7
                start_of_day = datetime.combine(dt, dt_time.min, tzinfo=timezone.utc) - timedelta(hours=7)
                end_of_day = datetime.combine(dt, dt_time.max, tzinfo=timezone.utc)
                query = query.where(VitalSign.time >= start_of_day, VitalSign.time <= end_of_day)
                # Lấy các mốc mới nhất của ngày đó, sau đó đảo ngược để vẽ biểu đồ theo thứ tự thời gian
                query = query.order_by(VitalSign.time.desc())
            except Exception as e:
                logger.warning(f"Lỗi phân tích target_date '{target_date}': {e}")
                query = query.order_by(VitalSign.time.desc())
        else:
            query = query.order_by(VitalSign.time.desc())

        # Nếu lọc theo ngày, lấy tối đa 300 mốc đo để vẽ biểu đồ chi tiết trọn vẹn cả ngày
        fetch_limit = max(limit, 300) if target_date else limit
        query = query.offset(offset).limit(fetch_limit)
        result = await db.execute(query)
        records = list(result.scalars().all())
        if target_date:
            records.reverse()
        return records

    async def create(self, db: AsyncSession, data: dict) -> VitalSign:
        """
        Tạo bản ghi sinh hiệu mới vào TimescaleDB, cập nhật Redis RAM và bắn WebSocket.
        """
        raw_dev = data.get("device_id")
        uuid_val = None
        if raw_dev:
            uuid_val = await self.resolve_device_uuid(db, raw_dev)
            if uuid_val:
                data["device_id"] = uuid_val

        # Tách các trường pin và phụ trợ không thuộc bảng vital_signs
        b1 = data.pop("bracelet_battery", None)
        b2 = data.pop("battery_level", None)
        b3 = data.pop("battery", None)
        battery = b1 if b1 is not None else (b2 if b2 is not None else b3)
        if battery is not None:
            try:
                battery = int(battery)
            except (ValueError, TypeError):
                battery = None

        data.pop("raw_payload", None)
        data.pop("bracelet_connected", None)
        data.pop("edge_hub_connected", None)

        # Lọc chỉ truyền các cột thực tế của bảng vital_signs vào model
        valid_cols = {
            "id", "time", "device_id", "heart_rate", "spo2",
            "bp_systolic", "bp_diastolic", "skin_temp_max",
            "person_count", "fall_detected",
        }
        vital_data = {k: v for k, v in data.items() if k in valid_cols}

        obj = VitalSign(**vital_data)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)

        # Cập nhật mức pin, trạng thái kết nối và phát hiện sự cố sinh hiệu
        if uuid_val:
            try:
                from app.models.device import Device
                from app.models.incident import Incident
                from app.crud.crud_incident import crud_incident
                from app.api.websockets.vitals_ws import alert_clients
                from datetime import timedelta

                dev = await db.get(Device, uuid_val)
                if dev:
                    if battery is not None:
                        dev.battery_level = battery
                        dev.is_online = (battery > 0)
                    else:
                        dev.is_online = True
                    dev.last_heartbeat = datetime.now(timezone.utc)
                    await db.flush()

                dev_name = dev.name if dev else str(raw_dev)
                alerts_to_create = []

                # 1. Cảnh báo pin vòng đeo tay
                is_battery_dead = False
                if battery is not None:
                    if battery <= 0:
                        is_battery_dead = True
                        alerts_to_create.append((
                            "DEVICE_BATTERY_DEAD",
                            "CRITICAL",
                            f"Vòng đeo tay ({dev_name}) đã cạn pin (0%) và ngắt kết nối! Hãy cắm sạc cho cụ.",
                            15  # chống spam lặp lại trong 15 phút
                        ))
                    elif battery <= 20:
                        alerts_to_create.append((
                            "LOW_BATTERY",
                            "HIGH",
                            f"Pin đồng hồ thông minh ({dev_name}) sắp hết (còn {battery}%). Hãy sạc pin cho cụ sớm!",
                            15
                        ))

                # LỌC TẦNG 2: NẾU THIẾT BỊ ĐÃ THÁO RA KHỎI TAY HOẶC CẠN PIN -> BỎ QUA CẢNH BÁO SINH TỒN GIẢ
                is_worn = data.get("is_worn", True)
                if is_battery_dead or is_worn is False:
                    logger.info(f"[CRUDVital] Vòng tay {dev_name} đang tháo ra hoặc hết pin -> Bỏ qua toàn bộ cảnh báo sinh tồn giả.")
                else:
                    hr = obj.heart_rate
                    spo2 = obj.spo2
                    temp = obj.skin_temp_max
                    activity = str(data.get("activity_state") or data.get("activity") or "").lower()
                    is_exercising = any(k in activity for k in ["vận động", "đi lại", "chạy", "tập", "exercise", "walk"])

                    # 2. KIỂM TRA TỔ HỢP ĐA YẾU TỐ (MULTI-VITAL SYNDROMES) - ƯU TIÊN CAO NHẤT
                    # A. Tam chứng nguy kịch: Sốt cao + Tim nhanh + SpO2 tụt
                    if temp and temp >= 38.0 and hr and hr >= 110 and spo2 and 0 < spo2 < 90:
                        alerts_to_create.append((
                            "CRITICAL_TRIAD",
                            "CRITICAL",
                            f"BÁO ĐỘNG ĐỎ: Phát hiện tam chứng nguy kịch ở {dev_name}! Sốt cao ({temp}°C) + Nhịp tim nhanh ({hr} bpm) + Oxy tụt sâu ({spo2}%). Nguy cơ suy hô hấp / nhiễm trùng huyết!",
                            5
                        ))
                    # B. Suy tim / Suy hô hấp gắng sức: Tim nhanh + Oxy tụt
                    elif hr and hr > 100 and spo2 and 0 < spo2 < 92:
                        alerts_to_create.append((
                            "EXERTION_HYPOXIA",
                            "CRITICAL",
                            f"Cảnh báo nguy cấp: Nhịp tim tăng cao ({hr} bpm) nhưng oxy máu SpO₂ tụt sâu ({spo2}%) từ {dev_name}! Nguy cơ quá tải tim phổi / suy hô hấp gắng sức.",
                            5
                        ))
                    # C. Sốt nhiễm khuẩn: Sốt cao + Tim đập nhanh
                    elif temp and temp >= 38.2 and hr and hr >= 100:
                        alerts_to_create.append((
                            "FEVER_TACHYCARDIA",
                            "HIGH",
                            f"Cảnh báo: Thân nhiệt cao ({temp}°C) kèm nhịp tim nhanh ({hr} bpm) từ {dev_name}. Dấu hiệu nhiễm trùng tiến triển.",
                            10
                        ))
                    # D. Trụy tim mạch kiệt sức: Tim chậm + Oxy tụt
                    elif hr and 0 < hr < 50 and spo2 and 0 < spo2 < 90:
                        alerts_to_create.append((
                            "CARDIO_COLLAPSE",
                            "CRITICAL",
                            f"BÁO ĐỘNG SINH TỬ: Nhịp tim tụt nguy kịch ({hr} bpm) kèm thiếu oxy nặng ({spo2}%) từ {dev_name}! Nguy cơ ngưng tim ngưng thở.",
                            3
                        ))
                    else:
                        # 3. KIỂM TRA CHỈ SỐ ĐƠN LẺ VỚI BỘ LỌC NGỮ CẢNH (CONTEXT-AWARE GATING)
                        # A. Nhịp tim bất thường:
                        if hr and hr > 0:
                            if hr >= 140:
                                alerts_to_create.append((
                                    "HIGH_HEART_RATE",
                                    "CRITICAL",
                                    f"Khẩn cấp: Nhịp tim đo được từ {dev_name} tăng vọt nguy hiểm ({hr} bpm)! Nguy cơ nhịp nhanh kịch phát.",
                                    5
                                ))
                            elif hr > 120:
                                # LỌC TẦNG 3: Nếu đang tập thể dục / đi lại và SpO2 tốt >= 95% -> Vận động thể lực bình thường
                                if is_exercising and spo2 and spo2 >= 95 and hr <= 125:
                                    logger.info(f"[CRUDVital] Nhịp tim {hr} bpm trong lúc vận động thể dục sinh lý -> Bỏ qua báo động giả.")
                                else:
                                    alerts_to_create.append((
                                        "HIGH_HEART_RATE",
                                        "HIGH",
                                        f"Cảnh báo: Nhịp tim đo được từ {dev_name} tăng cao ({hr} bpm)! Vượt ngưỡng an toàn 120 bpm.",
                                        5
                                    ))
                            elif hr < 50:
                                alerts_to_create.append((
                                    "LOW_HEART_RATE",
                                    "HIGH",
                                    f"Cảnh báo: Nhịp tim đo được từ {dev_name} quá thấp ({hr} bpm)! Dưới ngưỡng an toàn 50 bpm.",
                                    5
                                ))

                        # B. SpO2 đơn lẻ tụt sâu:
                        if spo2 and 0 < spo2 < 90:
                            alerts_to_create.append((
                                "LOW_SPO2",
                                "CRITICAL",
                                f"Nguy cấp: Nồng độ oxy trong máu (SpO₂) đo được từ {dev_name} tụt xuống {spo2}% (Dưới ngưỡng 90%)! Cần kiểm tra ngay.",
                                5
                            ))

                        # C. Sốt cao đơn lẻ:
                        if temp and temp >= 38.3:
                            alerts_to_create.append((
                                "HIGH_FEVER",
                                "HIGH",
                                f"Cảnh báo: Thân nhiệt của cụ đo được từ {dev_name} tăng cao ({temp}°C)! Dấu hiệu sốt cao ở người lớn tuổi.",
                                15
                            ))

                # 4. Cảnh báo té ngã từ vòng đeo tay
                if obj.fall_detected:
                    alerts_to_create.append((
                        "FALL_DETECTED",
                        "CRITICAL",
                        f"Khẩn cấp: Phát hiện sự cố té ngã từ thiết bị {dev_name}!",
                        2
                    ))

                for alert_type, alert_level, alert_msg, dedup_mins in alerts_to_create:
                    recent_limit = datetime.now(timezone.utc) - timedelta(minutes=dedup_mins)
                    dup_res = await db.execute(
                        select(Incident.id).where(
                            Incident.device_id == uuid_val,
                            Incident.alert_type == alert_type,
                            Incident.is_acknowledged == False,
                            Incident.created_at >= recent_limit,
                        ).limit(1)
                    )
                    if not dup_res.scalar_one_or_none():
                        inc = await crud_incident.create(db, data={
                            "device_id": uuid_val,
                            "alert_type": alert_type,
                            "alert_level": alert_level,
                            "message": alert_msg,
                            "is_acknowledged": False,
                        })
                        await db.flush()

                        alert_payload = json.dumps({
                            "type": "ALERT_NEW",
                            "alert_type": alert_type,
                            "data": {
                                "id": str(inc.id),
                                "device_id": str(uuid_val),
                                "alert_type": alert_type,
                                "alert_level": alert_level,
                                "message": alert_msg,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            }
                        }, ensure_ascii=False)
                        for client_ws in list(alert_clients):
                            try:
                                await client_ws.send_text(alert_payload)
                            except Exception:
                                if client_ws in alert_clients:
                                    alert_clients.remove(client_ws)
            except Exception as e:
                logger.warning("[CRUDVital] Lỗi kiểm tra sự cố & pin thiết bị: %s", e)

        # 1. Cập nhật Redis Cache tức thời (bất đồng bộ, không chặn luồng chính)
        try:
            from app.services.redis import redis_service
            dev_str = str(data.get("device_id", obj.device_id))
            act_state = data.get("activity_state") or data.get("activity") or "Sinh hoạt"
            payload = {
                "heart_rate": obj.heart_rate,
                "spo2": obj.spo2,
                "skin_temp_max": obj.skin_temp_max,
                "fall_detected": obj.fall_detected or False,
                "bracelet_battery": battery,
                "bracelet_connected": (battery > 0) if battery is not None else True,
                "activity_state": act_state,
                "time": obj.time.isoformat() if obj.time else datetime.now(timezone.utc).isoformat(),
            }
            await redis_service.set_latest_vitals(dev_str, payload)
        except Exception as exc:
            logger.warning("[CRUDVital] Không thể cập nhật Redis cache: %s", exc)

        # 2. Bắn thông điệp Real-time qua WebSocket cho các client đang mở màn hình
        try:
            from app.api.websockets.vitals_ws import manager
            dev_str = str(data.get("device_id", obj.device_id))
            act_state = data.get("activity_state") or data.get("activity") or "Sinh hoạt"
            ws_data = {
                "type": "vital_update",
                "device_id": dev_str,
                "heart_rate": obj.heart_rate,
                "spo2": obj.spo2,
                "skin_temp_max": obj.skin_temp_max,
                "fall_detected": obj.fall_detected or False,
                "bracelet_battery": battery,
                "bracelet_connected": (battery > 0) if battery is not None else True,
                "activity_state": act_state,
                "timestamp": int(obj.time.timestamp() * 1000) if obj.time else int(datetime.now().timestamp() * 1000),
            }
            await manager.broadcast_to_device(dev_str, ws_data)
            await manager.broadcast_all(ws_data)
        except Exception as exc:
            logger.warning("[CRUDVital] Lỗi broadcast WebSocket: %s", exc)

        return obj

    async def get_stats(
        self,
        db: AsyncSession,
        device_id: Union[str, UUID],
        hours: int = 24,
    ) -> VitalStats:
        """Thống kê chỉ số sinh hiệu trong N giờ gần nhất."""
        uuid_val = await self.resolve_device_uuid(db, device_id)
        if not uuid_val:
            dummy_uuid = UUID("00000000-0000-0000-0000-000000000000")
            return VitalStats(device_id=dummy_uuid, period_hours=hours, fall_count=0)

        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        result = await db.execute(
            select(
                func.min(VitalSign.heart_rate).label("hr_min"),
                func.max(VitalSign.heart_rate).label("hr_max"),
                func.avg(VitalSign.heart_rate).label("hr_avg"),
                func.min(VitalSign.spo2).label("spo2_min"),
                func.max(VitalSign.spo2).label("spo2_max"),
                func.avg(VitalSign.spo2).label("spo2_avg"),
                func.count().filter(VitalSign.fall_detected.is_(True)).label("fall_count"),
            ).where(
                VitalSign.device_id == uuid_val,
                VitalSign.time >= since,
            )
        )
        row = result.one_or_none()
        if not row:
            return VitalStats(device_id=uuid_val, period_hours=hours, fall_count=0)

        return VitalStats(
            device_id=uuid_val,
            period_hours=hours,
            heart_rate_min=float(row.hr_min) if row.hr_min is not None else None,
            heart_rate_max=float(row.hr_max) if row.hr_max is not None else None,
            heart_rate_avg=float(row.hr_avg) if row.hr_avg is not None else None,
            spo2_min=float(row.spo2_min) if row.spo2_min is not None else None,
            spo2_max=float(row.spo2_max) if row.spo2_max is not None else None,
            spo2_avg=float(row.spo2_avg) if row.spo2_avg is not None else None,
            fall_count=row.fall_count or 0,
        )

    async def get_current_for_user(
        self, db: AsyncSession, user_id: UUID
    ) -> dict:
        """
        Lấy dữ liệu sinh hiệu hiện tại chuẩn hóa cho màn hình Dashboard của Người dùng.
        Tự động tìm kiếm thiết bị Vòng đeo tay BLE trong nhà của người dùng.
        """
        from app.models.house import House, HouseMember

        # 1. Tìm các căn nhà liên kết với user
        house_res = await db.execute(
            select(House.id).where(House.owner_id == user_id)
        )
        house_ids = [r[0] for r in house_res.all()]
        member_res = await db.execute(
            select(HouseMember.house_id).where(
                HouseMember.user_id == user_id,
                HouseMember.status == "ACTIVE",
            )
        )
        for r in member_res.all():
            if r[0] not in house_ids:
                house_ids.append(r[0])

        smartband_cond = [Device.device_type == DeviceType.SMARTBAND]
        if house_ids:
            smartband_cond.append(or_(Device.owner_id == user_id, Device.house_id.in_(house_ids)))
        else:
            smartband_cond.append(Device.owner_id == user_id)

        result = await db.execute(
            select(Device)
            .where(*smartband_cond)
            .order_by(Device.created_at.desc())
            .limit(1)
        )
        smartband_device = result.scalar_one_or_none()

        # Fallback tìm smartband bất kỳ trong hệ thống
        if not smartband_device:
            res_any_band = await db.execute(
                select(Device)
                .where(Device.device_type == DeviceType.SMARTBAND)
                .order_by(Device.created_at.desc())
                .limit(1)
            )
            smartband_device = res_any_band.scalar_one_or_none()

        # Nếu không có smartband, tìm thiết bị bất kỳ
        device = smartband_device
        if not device:
            res_any = await db.execute(
                select(Device).order_by(Device.created_at.desc()).limit(1)
            )
            device = res_any.scalar_one_or_none()

        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        # 2. Lấy chỉ số sinh hiệu mới nhất của thiết bị
        latest_vital = None
        if device:
            latest_vital = await self.get_latest(db, device.id)
        if not latest_vital:
            # Fallback lấy bản ghi VitalSign mới nhất trong cơ sở dữ liệu
            res_latest_any = await db.execute(
                select(VitalSign).order_by(VitalSign.time.desc()).limit(1)
            )
            latest_vital = res_latest_any.scalar_one_or_none()

        if not device and not latest_vital:
            return {
                "heart_rate": None,
                "spo2": None,
                "skin_temp_max": None,
                "body_temp": None,
                "person_count": 0,
                "fall_detected": False,
                "timestamp": now_ms,
                "sound": "Chưa kết nối thiết bị",
                "bracelet_battery": None,
                "bracelet_connected": False,
                "edge_hub_connected": False,
                "device_id": None,
                "time": None,
            }

        # 2. Lấy chỉ số sinh hiệu mới nhất của thiết bị
        if device:
            latest_vital = await self.get_latest(db, device.id)

        # Kiểm tra tính tươi mới của dữ liệu: nếu bản ghi cuối cùng đã quá 90 giây
        # hoặc thiết bị không còn online, xem như thiết bị đã ngắt kết nối (offline)
        now_utc = datetime.now(timezone.utc)
        is_fresh = False
        v_time = latest_vital.time if latest_vital else None
        if latest_vital and v_time:
            # Chuẩn hóa timezone nếu cần
            v_time_tz = v_time if v_time.tzinfo else v_time.replace(tzinfo=timezone.utc)
            diff_seconds = abs((now_utc - v_time_tz).total_seconds())
            if diff_seconds <= 90:
                is_fresh = True

        # Nếu quá 90s không có dữ liệu mới, cập nhật thiết bị sang offline
        if not is_fresh and smartband_device and smartband_device.is_online:
            smartband_device.is_online = False
            await db.commit()

        is_band_connected = bool(smartband_device and smartband_device.is_online and is_fresh)
        band_battery = (
            smartband_device.battery_level
            if (smartband_device and is_band_connected and smartband_device.battery_level is not None)
            else None
        )

        hr = latest_vital.heart_rate if (latest_vital and is_fresh) else None
        sp = latest_vital.spo2 if (latest_vital and is_fresh) else None
        temp = latest_vital.skin_temp_max if (latest_vital and is_fresh) else None
        fall = bool(latest_vital.fall_detected) if (latest_vital and is_fresh) else False

        return {
            "heart_rate": hr,
            "spo2": sp,
            "skin_temp_max": temp,
            "body_temp": temp,
            "person_count": 1 if (device and device.is_online) else 0,
            "fall_detected": fall,
            "timestamp": int(v_time.timestamp() * 1000) if v_time else None,
            "sound": "Bình thường",
            "bracelet_battery": band_battery,
            "bracelet_connected": is_band_connected,
            "edge_hub_connected": True,
            "device_id": device.device_id if device else (str(latest_vital.device_id) if latest_vital else None),
            "time": v_time,
        }


crud_vital = CRUDVital()

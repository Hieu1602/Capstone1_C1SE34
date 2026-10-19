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
        return result.scalar_one_or_none()

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
                start_of_day = datetime.combine(dt, dt_time.min, tzinfo=timezone.utc)
                end_of_day = datetime.combine(dt, dt_time.max, tzinfo=timezone.utc)
                query = query.where(VitalSign.time >= start_of_day, VitalSign.time <= end_of_day)
                query = query.order_by(VitalSign.time.asc())
            except Exception as e:
                logger.warning(f"Lỗi phân tích target_date '{target_date}': {e}")
                query = query.order_by(VitalSign.time.desc())
        else:
            query = query.order_by(VitalSign.time.desc())

        query = query.offset(offset).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, data: dict) -> VitalSign:
        """
        Tạo bản ghi sinh hiệu mới vào TimescaleDB, cập nhật Redis RAM và bắn WebSocket.
        """
        raw_dev = data.get("device_id")
        if raw_dev:
            uuid_val = await self.resolve_device_uuid(db, raw_dev)
            if uuid_val:
                data["device_id"] = uuid_val

        obj = VitalSign(**data)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)

        # 1. Cập nhật Redis Cache tức thời (bất đồng bộ, không chặn luồng chính)
        try:
            from app.services.redis import redis_service
            dev_str = str(data.get("device_id", obj.device_id))
            payload = {
                "heart_rate": obj.heart_rate,
                "spo2": obj.spo2,
                "skin_temp_max": obj.skin_temp_max,
                "fall_detected": obj.fall_detected or False,
                "time": obj.time.isoformat() if obj.time else datetime.now(timezone.utc).isoformat(),
            }
            await redis_service.set_latest_vitals(dev_str, payload)
        except Exception as exc:
            logger.warning("[CRUDVital] Không thể cập nhật Redis cache: %s", exc)

        # 2. Bắn thông điệp Real-time qua WebSocket cho các client đang mở màn hình
        try:
            from app.api.websockets.vitals_ws import manager
            dev_str = str(data.get("device_id", obj.device_id))
            ws_data = {
                "type": "vital_update",
                "device_id": dev_str,
                "heart_rate": obj.heart_rate,
                "spo2": obj.spo2,
                "skin_temp_max": obj.skin_temp_max,
                "fall_detected": obj.fall_detected or False,
                "timestamp": int(obj.time.timestamp() * 1000) if obj.time else int(datetime.now().timestamp() * 1000),
            }
            await manager.broadcast_to_device(dev_str, ws_data)
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
        # 1. Tìm thiết bị Smartband trong các nhà của user
        result = await db.execute(
            select(Device)
            .where(
                Device.owner_id == user_id,
                Device.device_type == DeviceType.SMARTBAND,
            )
            .order_by(Device.created_at.desc())
            .limit(1)
        )
        device = result.scalar_one_or_none()

        # Nếu không có thiết bị đeo của chính user, tìm thiết bị bất kỳ trong nhà
        if not device:
            res_any = await db.execute(
                select(Device)
                .where(Device.owner_id == user_id)
                .order_by(Device.created_at.desc())
                .limit(1)
            )
            device = res_any.scalar_one_or_none()

        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        if not device:
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
        latest_vital = await self.get_latest(db, device.id)
        hr = latest_vital.heart_rate if latest_vital else None
        sp = latest_vital.spo2 if latest_vital else None
        temp = latest_vital.skin_temp_max if latest_vital else None
        fall = bool(latest_vital.fall_detected) if latest_vital else False
        v_time = latest_vital.time if latest_vital else None

        return {
            "heart_rate": hr,
            "spo2": sp,
            "skin_temp_max": temp,
            "body_temp": temp,
            "person_count": 1 if device.is_online else 0,
            "fall_detected": fall,
            "timestamp": int(v_time.timestamp() * 1000) if v_time else None,
            "sound": "Bình thường",
            "bracelet_battery": device.battery_level,
            "bracelet_connected": device.is_online,
            "edge_hub_connected": True,
            "device_id": device.device_id,
            "time": v_time,
        }


crud_vital = CRUDVital()

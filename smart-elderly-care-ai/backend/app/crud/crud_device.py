"""
crud_device.py – CRUD / Repository cho Device và DeviceConfig Master model.
Vị trí: backend/app/crud/crud_device.py
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.device import Device
from app.models.device_config import DeviceConfig
from app.schemas.device import DeviceConfigUpdate, DeviceCreate, DeviceUpdate


class CRUDDevice:

    async def get_by_id(
        self, db: AsyncSession, id: UUID
    ) -> Optional[Device]:
        result = await db.execute(
            select(Device)
            .options(
                selectinload(Device.config),
                selectinload(Device.group),
                selectinload(Device.house),
            )
            .where(Device.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_device_id(
        self, db: AsyncSession, device_id: str
    ) -> Optional[Device]:
        result = await db.execute(
            select(Device)
            .options(
                selectinload(Device.config),
                selectinload(Device.group),
                selectinload(Device.house),
            )
            .where(Device.device_id == device_id)
        )
        return result.scalar_one_or_none()

    async def get_by_owner(
        self,
        db: AsyncSession,
        owner_id: UUID,
        house_id: Optional[UUID] = None,
        device_type: Optional[str] = None,
        group_id: Optional[UUID] = None,
        is_online: Optional[bool] = None,
    ) -> List[Device]:
        """
        Lấy danh sách thiết bị có hỗ trợ lọc linh hoạt theo loại thiết bị, nhóm phòng và trạng thái online.
        """
        query = (
            select(Device)
            .options(
                selectinload(Device.config),
                selectinload(Device.group),
                selectinload(Device.house),
            )
            .where(Device.owner_id == owner_id)
        )

        if house_id is not None:
            query = query.where(Device.house_id == house_id)
        if device_type is not None:
            query = query.where(Device.device_type == device_type.upper())
        if group_id is not None:
            query = query.where(Device.group_id == group_id)
        if is_online is not None:
            query = query.where(Device.is_online == is_online)

        query = query.order_by(Device.created_at.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create(
        self, db: AsyncSession, owner_id: UUID, obj_in: DeviceCreate
    ) -> Device:
        """
        Đăng ký thiết bị mới và tự động tạo cấu hình mặc định (DeviceConfig).
        """
        data = obj_in.model_dump(exclude={"config"})
        device = Device(
            owner_id=owner_id,
            **data,
        )
        db.add(device)
        await db.flush()
        await db.refresh(device)

        # Tạo DeviceConfig
        config_data = obj_in.config.model_dump() if obj_in.config else {}
        config = DeviceConfig(
            device_id=device.id,
            **config_data,
        )
        db.add(config)
        await db.flush()

        return await self.get_by_id(db, device.id)  # type: ignore

    async def update(
        self, db: AsyncSession, device: Device, obj_in: DeviceUpdate
    ) -> Device:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(device, field, value)
        await db.flush()
        await db.refresh(device)
        return device

    async def update_config(
        self, db: AsyncSession, device: Device, config_in: DeviceConfigUpdate
    ) -> DeviceConfig:
        config = device.config
        if not config:
            config = DeviceConfig(device_id=device.id)
            db.add(config)
            await db.flush()

        update_data = config_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(config, field, value)

        await db.flush()
        await db.refresh(config)
        return config

    async def delete(
        self, db: AsyncSession, db_obj: Device
    ) -> None:
        await db.delete(db_obj)
        await db.flush()

    async def update_heartbeat(
        self,
        db: AsyncSession,
        device_id: str,
        battery_level: Optional[int] = None,
        status_text: Optional[str] = None,
    ) -> None:
        device = await self.get_by_device_id(db, device_id)
        if device:
            device.is_online = True
            device.last_heartbeat = datetime.now(timezone.utc)
            if battery_level is not None:
                device.battery_level = battery_level
            if status_text is not None:
                device.status_text = status_text
            await db.flush()


crud_device = CRUDDevice()

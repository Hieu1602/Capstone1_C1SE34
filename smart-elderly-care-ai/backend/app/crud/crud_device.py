"""
crud_device.py – CRUD / Repository cho Device model.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.schemas.device import DeviceCreate


class CRUDDevice:

    async def get_by_id(
        self, db: AsyncSession, id: UUID
    ) -> Optional[Device]:
        result = await db.execute(
            select(Device).where(Device.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_device_id(
        self, db: AsyncSession, device_id: str
    ) -> Optional[Device]:
        result = await db.execute(
            select(Device).where(Device.device_id == device_id)
        )
        return result.scalar_one_or_none()

    async def get_by_owner(
        self, db: AsyncSession, owner_id: UUID
    ) -> List[Device]:
        result = await db.execute(
            select(Device).where(Device.owner_id == owner_id)
        )
        return list(result.scalars().all())

    async def create(
        self, db: AsyncSession, owner_id: UUID, obj_in: DeviceCreate
    ) -> Device:
        device = Device(
            owner_id=owner_id,
            **obj_in.model_dump(),
        )
        db.add(device)
        await db.flush()
        await db.refresh(device)
        return device

    async def delete(
        self, db: AsyncSession, db_obj: Device
    ) -> None:
        await db.delete(db_obj)
        await db.flush()

    async def update_heartbeat(
        self, db: AsyncSession, device_id: str
    ) -> None:
        from datetime import datetime, timezone
        device = await self.get_by_device_id(db, device_id)
        if device:
            device.is_online = True
            device.last_heartbeat = datetime.now(timezone.utc)
            await db.flush()


crud_device = CRUDDevice()

"""
crud_device_group.py – CRUD / Repository cho DeviceGroup (Phân vùng nhóm khu vực phòng).
Hỗ trợ:
- Kiểm tra tính duy nhất của tên nhóm trong cùng căn nhà.
- Gán/hủy gán thiết bị thuộc nhóm.
- Khi xóa nhóm: tự động chuyển thiết bị về 'Chưa nhóm' (group_id = NULL).
Vị trí: backend/app/crud/crud_device_group.py
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.device import Device
from app.models.device_group import DeviceGroup
from app.schemas.device_group import DeviceGroupCreate, DeviceGroupOut, DeviceGroupUpdate


class CRUDDeviceGroup:

    async def get_by_id(self, db: AsyncSession, id: UUID) -> Optional[DeviceGroup]:
        result = await db.execute(
            select(DeviceGroup)
            .options(selectinload(DeviceGroup.devices))
            .where(DeviceGroup.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_house_and_name(
        self, db: AsyncSession, house_id: UUID, name: str
    ) -> Optional[DeviceGroup]:
        """Tìm nhóm theo tên không phân biệt chữ hoa/thường trong căn nhà."""
        result = await db.execute(
            select(DeviceGroup).where(
                DeviceGroup.house_id == house_id,
                func.lower(DeviceGroup.name) == name.strip().lower(),
            )
        )
        return result.scalar_one_or_none()

    async def get_groups_by_house(
        self, db: AsyncSession, house_id: UUID
    ) -> List[DeviceGroupOut]:
        """
        Lấy danh sách tất cả các nhóm của nhà kèm số lượng thiết bị và số thiết bị đang online.
        """
        result = await db.execute(
            select(DeviceGroup)
            .options(selectinload(DeviceGroup.devices))
            .where(DeviceGroup.house_id == house_id)
            .order_by(DeviceGroup.sort_order.asc(), DeviceGroup.created_at.asc())
        )
        groups = result.scalars().all()

        output: List[DeviceGroupOut] = []
        for g in groups:
            devs = g.devices or []
            device_count = len(devs)
            online_count = sum(1 for d in devs if d.is_online)

            item = DeviceGroupOut(
                id=g.id,
                house_id=g.house_id,
                name=g.name,
                description=g.description,
                icon=g.icon,
                color=g.color,
                sort_order=g.sort_order,
                device_count=device_count,
                online_count=online_count,
                created_at=g.created_at,
                updated_at=g.updated_at,
            )
            output.append(item)

        return output

    async def create(
        self, db: AsyncSession, house_id: UUID, obj_in: DeviceGroupCreate
    ) -> DeviceGroup:
        """
        Tạo nhóm mới và gán các thiết bị ban đầu được chọn vào nhóm.
        """
        group = DeviceGroup(
            house_id=house_id,
            name=obj_in.name.strip(),
            description=obj_in.description,
            icon=obj_in.icon,
            color=obj_in.color,
            sort_order=obj_in.sort_order,
        )
        db.add(group)
        await db.flush()
        await db.refresh(group)

        # Gán thiết bị ban đầu (nếu có)
        if obj_in.device_ids:
            await db.execute(
                update(Device)
                .where(Device.id.in_(obj_in.device_ids))
                .values(group_id=group.id, location=group.name)
            )
            await db.flush()

        await db.refresh(group)
        return group

    async def update(
        self, db: AsyncSession, group: DeviceGroup, obj_in: DeviceGroupUpdate
    ) -> DeviceGroup:
        """
        Cập nhật thông tin nhóm và đồng bộ danh sách thiết bị thuộc nhóm.
        """
        old_name = group.name
        update_data = obj_in.model_dump(exclude_unset=True)
        device_ids = update_data.pop("device_ids", None)

        for field, value in update_data.items():
            setattr(group, field, value)

        await db.flush()

        # Nếu đổi tên nhóm, cập nhật trường location trên các thiết bị thuộc nhóm
        if "name" in update_data and update_data["name"] != old_name:
            await db.execute(
                update(Device)
                .where(Device.group_id == group.id)
                .values(location=group.name)
            )
            await db.flush()

        # Nếu truyền device_ids -> Reassign thiết bị:
        # 1. Các thiết bị đang trong nhóm này nhưng không nằm trong device_ids mới -> chuyển về Chưa nhóm
        # 2. Các thiết bị nằm trong device_ids mới -> gán group_id = group.id, location = group.name
        if device_ids is not None:
            # Gỡ các thiết bị không còn được chọn
            await db.execute(
                update(Device)
                .where(Device.group_id == group.id, ~Device.id.in_(device_ids))
                .values(group_id=None, location="Chưa nhóm")
            )
            # Gán các thiết bị mới được chọn
            if device_ids:
                await db.execute(
                    update(Device)
                    .where(Device.id.in_(device_ids))
                    .values(group_id=group.id, location=group.name)
                )
            await db.flush()

        await db.refresh(group)
        return group

    async def delete(self, db: AsyncSession, group: DeviceGroup) -> None:
        """
        Xóa nhóm: Chuyển toàn bộ thiết bị trong nhóm về 'Chưa nhóm' trước khi xóa nhóm.
        """
        await db.execute(
            update(Device)
            .where(Device.group_id == group.id)
            .values(group_id=None, location="Chưa nhóm")
        )
        await db.delete(group)
        await db.flush()

    async def assign_devices(
        self, db: AsyncSession, group: DeviceGroup, device_ids: List[UUID]
    ) -> None:
        """Gán một danh sách thiết bị vào nhóm."""
        if device_ids:
            await db.execute(
                update(Device)
                .where(Device.id.in_(device_ids))
                .values(group_id=group.id, location=group.name)
            )
            await db.flush()


crud_device_group = CRUDDeviceGroup()


"""
crud_house.py – CRUD / Repository cho House model.
Vị trí: backend/app/crud/crud_house.py
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.house import House, HouseMember
from app.schemas.house import HouseCreate, HouseUpdate


class CRUDHouse:

    async def get_by_id(self, db: AsyncSession, id: UUID) -> Optional[House]:
        result = await db.execute(
            select(House)
            .options(
                selectinload(House.device_groups),
                selectinload(House.devices),
            )
            .where(House.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_owner(self, db: AsyncSession, owner_id: UUID) -> list[House]:
        result = await db.execute(
            select(House)
            .options(
                selectinload(House.device_groups),
                selectinload(House.devices),
            )
            .where(House.owner_id == owner_id)
        )
        return list(result.scalars().all())

    async def get_or_create_default_house(self, db: AsyncSession, owner_id: UUID) -> House:
        """
        Lấy căn nhà đầu tiên của người dùng hoặc tự động tạo 'Nhà của tôi' nếu chưa có.
        """
        houses = await self.get_by_owner(db, owner_id)
        if houses:
            return houses[0]

        default_house = House(
            owner_id=owner_id,
            name="Nhà của tôi",
            address="123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng",
            current_mode="HOME",
        )
        db.add(default_house)
        await db.flush()
        await db.refresh(default_house)

        # Thêm owner vào bảng house_members
        membership = HouseMember(
            house_id=default_house.id,
            user_id=owner_id,
            role_in_house="OWNER",
            permissions="ADMIN",
        )
        db.add(membership)
        await db.flush()

        return default_house

    async def create(self, db: AsyncSession, owner_id: UUID, obj_in: HouseCreate) -> House:
        house = House(
            owner_id=owner_id,
            **obj_in.model_dump(),
        )
        db.add(house)
        await db.flush()
        await db.refresh(house)

        membership = HouseMember(
            house_id=house.id,
            user_id=owner_id,
            role_in_house="OWNER",
            permissions="ADMIN",
        )
        db.add(membership)
        await db.flush()

        return house

    async def update_mode(self, db: AsyncSession, house: House, mode: str) -> House:
        house.current_mode = mode
        await db.flush()
        await db.refresh(house)
        return house

    async def update(self, db: AsyncSession, house: House, obj_in: HouseUpdate) -> House:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(house, field, value)
        await db.flush()
        await db.refresh(house)
        return house


crud_house = CRUDHouse()


"""
crud_house.py – CRUD / Repository cho House model và HouseMember (Phân quyền thành viên gia đình).
Vị trí: backend/app/crud/crud_house.py
"""

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.models.house import House, HouseMember
from app.models.user import User
from app.schemas.house import (
    HouseCreate,
    HouseMemberCreate,
    HouseMemberPermissionsUpdate,
    HouseUpdate,
)


class CRUDHouse:

    async def get_by_id(self, db: AsyncSession, id: UUID) -> Optional[House]:
        result = await db.execute(
            select(House)
            .options(
                selectinload(House.device_groups),
                selectinload(House.devices),
                selectinload(House.members).selectinload(HouseMember.user),
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

    async def get_user_houses(self, db: AsyncSession, user_id: UUID) -> list[House]:
        """Lấy tất cả các căn nhà mà người dùng sở hữu HOẶC là thành viên."""
        member_houses_subq = select(HouseMember.house_id).where(HouseMember.user_id == user_id)
        result = await db.execute(
            select(House)
            .where(
                or_(
                    House.owner_id == user_id,
                    House.id.in_(member_houses_subq),
                )
            )
        )
        return list(result.scalars().all())

    async def get_or_create_default_house(self, db: AsyncSession, owner_id: UUID) -> House:
        """
        Lấy căn nhà đầu tiên của người dùng hoặc tự động tạo 'Nhà của tôi' nếu chưa có.
        """
        houses = await self.get_by_owner(db, owner_id)
        if houses:
            return houses[0]

        # Kiểm tra xem user có phải là thành viên nhà nào không
        user_houses = await self.get_user_houses(db, owner_id)
        if user_houses:
            return user_houses[0]

        default_house = House(
            owner_id=owner_id,
            name="Nhà của tôi",
            address="123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng",
            current_mode="HOME",
        )
        db.add(default_house)
        await db.flush()
        await db.refresh(default_house)

        # Thêm owner vào bảng house_members với toàn bộ quyền
        membership = HouseMember(
            house_id=default_house.id,
            user_id=owner_id,
            role_in_house="OWNER",
            permissions="ADMIN",
            can_view_health=True,
            can_view_camera=True,
            can_handle_emergency=True,
            can_manage_devices=True,
            can_manage_records=True,
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
            can_view_health=True,
            can_view_camera=True,
            can_handle_emergency=True,
            can_manage_devices=True,
            can_manage_records=True,
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

    # ==========================================================================
    # QUẢN LÝ THÀNH VIÊN VÀ PHÂN QUYỀN RBAC (HOUSE MEMBERS)
    # ==========================================================================

    async def get_members(self, db: AsyncSession, house_id: UUID) -> list[HouseMember]:
        """Liệt kê toàn bộ thành viên trong căn nhà, load kèm thông tin tài khoản user."""
        result = await db.execute(
            select(HouseMember)
            .options(selectinload(HouseMember.user))
            .where(HouseMember.house_id == house_id)
            .order_by(HouseMember.joined_at.asc())
        )
        return list(result.scalars().all())

    async def get_member_by_id(
        self, db: AsyncSession, house_id: UUID, member_id: UUID
    ) -> Optional[HouseMember]:
        """Tìm thành viên theo member_id hoặc user_id trong căn nhà."""
        result = await db.execute(
            select(HouseMember)
            .options(selectinload(HouseMember.user))
            .where(
                HouseMember.house_id == house_id,
                or_(HouseMember.id == member_id, HouseMember.user_id == member_id),
            )
        )
        return result.scalar_one_or_none()

    async def get_member_by_user(
        self, db: AsyncSession, house_id: UUID, user_id: UUID
    ) -> Optional[HouseMember]:
        """Tìm bản ghi thành viên theo user_id."""
        result = await db.execute(
            select(HouseMember)
            .options(selectinload(HouseMember.user))
            .where(HouseMember.house_id == house_id, HouseMember.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def add_member(
        self,
        db: AsyncSession,
        house: House,
        obj_in: HouseMemberCreate,
    ) -> HouseMember:
        """
        Thêm thành viên mới (hoặc Bác sĩ) vào căn nhà qua Số điện thoại và cấp quyền ban đầu.
        Nếu số điện thoại chưa có tài khoản, tự động tạo tài khoản giữ chỗ để người thân có thể đăng nhập sau.
        """
        from app.crud.crud_user import crud_user

        phone = obj_in.phone_number.strip().replace(" ", "").replace("-", "")
        user = await crud_user.get_by_phone(db, phone=phone)

        if not user:
            # Tạo tài khoản mới cho người thân
            user = User(
                full_name=obj_in.full_name or "Người thân gia đình",
                phone=phone,
                role=obj_in.role or ("doctor" if "bác sĩ" in (obj_in.role_in_house or "").lower() else "user"),
                hashed_password=get_password_hash("Care@123456"),
                is_active=True,
            )
            db.add(user)
            await db.flush()
            await db.refresh(user)

        # Kiểm tra xem đã là thành viên chưa
        existing = await self.get_member_by_user(db, house.id, user.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tài khoản số điện thoại {phone} đã là thành viên của căn nhà này.",
            )

        is_doctor = "bác sĩ" in (obj_in.role_in_house or "").lower() or (obj_in.role or "").lower() == "doctor"
        role_label = "DOCTOR" if is_doctor else (obj_in.role_in_house or "MEMBER")

        new_member = HouseMember(
            house_id=house.id,
            user_id=user.id,
            role_in_house=role_label,
            permissions=obj_in.permissions or "VIEW",
            can_view_health=obj_in.can_view_health,
            can_view_camera=obj_in.can_view_camera,
            can_handle_emergency=obj_in.can_handle_emergency,
            can_manage_devices=obj_in.can_manage_devices,
            can_manage_records=obj_in.can_manage_records or is_doctor,
        )
        db.add(new_member)
        await db.flush()
        await db.refresh(new_member)

        # Load kèm relation user
        return (await self.get_member_by_id(db, house.id, new_member.id)) or new_member

    async def update_member_permissions(
        self,
        db: AsyncSession,
        house: House,
        member_id: UUID,
        obj_in: HouseMemberPermissionsUpdate,
    ) -> HouseMember:
        """
        Chủ nhà (Owner) cập nhật quyền hạn hoặc vai trò cho thành viên.
        Không cho phép tước quyền của Chủ nhà chính.
        """
        member = await self.get_member_by_id(db, house_id=house.id, member_id=member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thành viên này trong căn nhà.",
            )

        # Nếu là chủ nhà (Owner), luôn giữ toàn quyền
        if member.user_id == house.owner_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể giới hạn quyền hạn của Chủ sở hữu căn nhà.",
            )

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(member, field):
                setattr(member, field, value)

        await db.flush()
        await db.refresh(member)
        return (await self.get_member_by_id(db, house.id, member.id)) or member

    async def remove_member(
        self,
        db: AsyncSession,
        house: House,
        member_id: UUID,
    ) -> bool:
        """Xóa thành viên khỏi căn nhà. Không thể xóa Chủ sở hữu."""
        member = await self.get_member_by_id(db, house_id=house.id, member_id=member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thành viên cần xóa.",
            )

        if member.user_id == house.owner_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể xóa Chủ sở hữu khỏi căn nhà.",
            )

        await db.delete(member)
        await db.flush()
        return True

    async def get_user_permissions(
        self,
        db: AsyncSession,
        house: House,
        user: User,
    ) -> dict:
        """
        Kiểm tra quyền hạn thực tế của user trong căn nhà:
        - Admin hoặc Chủ sở hữu: Toàn quyền (True trên mọi hành động)
        - Thành viên: Theo cờ boolean được cấp trong bảng house_members
        """
        if user.role == "admin" or house.owner_id == user.id:
            return {
                "house_id": house.id,
                "user_id": user.id,
                "is_owner": True,
                "role_in_house": "OWNER",
                "can_view_health": True,
                "can_view_camera": True,
                "can_handle_emergency": True,
                "can_manage_devices": True,
                "can_manage_records": True,
            }

        member = await self.get_member_by_user(db, house_id=house.id, user_id=user.id)
        if not member:
            return {
                "house_id": house.id,
                "user_id": user.id,
                "is_owner": False,
                "role_in_house": "NONE",
                "can_view_health": False,
                "can_view_camera": False,
                "can_handle_emergency": False,
                "can_manage_devices": False,
                "can_manage_records": False,
            }

        return {
            "house_id": house.id,
            "user_id": user.id,
            "is_owner": False,
            "role_in_house": member.role_in_house,
            "can_view_health": member.can_view_health,
            "can_view_camera": member.can_view_camera,
            "can_handle_emergency": member.can_handle_emergency,
            "can_manage_devices": member.can_manage_devices,
            "can_manage_records": member.can_manage_records,
        }


crud_house = CRUDHouse()

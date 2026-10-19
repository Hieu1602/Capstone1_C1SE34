"""
crud_user.py – CRUD / Repository cho User model.
"""

from typing import Optional
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate


def normalize_phone(phone: str) -> str:
    value = re.sub(r"[\s().-]", "", phone or "")
    if not value:
        return ""
    if value.startswith("0084"):
        value = "+84" + value[4:]
    elif value.startswith("84"):
        value = "+" + value

    if value.startswith("+84"):
        national_number = value[3:]
        if national_number.startswith("0"):
            national_number = national_number[1:]
        return "+84" + national_number
    if value.startswith("0"):
        return "+84" + value[1:]
    return value


class CRUDUser:

    async def get_by_phone(self, db: AsyncSession, phone: str) -> Optional[User]:
        clean_phone = (phone or "").strip()
        # Hỗ trợ đăng nhập tài khoản quản trị hệ thống bằng username Admin123 hoặc admin
        if clean_phone.lower() in ("admin123", "admin", "root"):
            admin_result = await db.execute(
                select(User)
                .options(noload(User.devices))
                .where(
                    (User.phone == "Admin123")
                    | (User.phone == clean_phone)
                    | (User.role == "admin")
                )
                .order_by(User.created_at.asc())
                .limit(1)
            )
            found_admin = admin_result.scalars().first()
            if found_admin:
                return found_admin

        normalized = normalize_phone(clean_phone)
        result = await db.execute(
            select(User)
            .options(noload(User.devices))
            .where(
                (User.phone == clean_phone)
                | (User.phone == normalized)
            )
            .limit(1)
        )
        return result.scalars().first()

    async def get_all(self, db: AsyncSession) -> list[User]:
        result = await db.execute(
            select(User).options(noload(User.devices)).order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, db: AsyncSession, user_id) -> Optional[User]:
        result = await db.execute(select(User).where(User.id == user_id).limit(1))
        return result.scalars().first()

    async def create(self, db: AsyncSession, obj_in: UserCreate) -> User:
        db_obj = User(
            full_name=obj_in.full_name,
            phone=obj_in.phone,
            role=obj_in.role,
            hashed_password=hash_password(obj_in.password),
        )
        db.add(db_obj)
        await db.flush()
        return db_obj

    async def get(self, db: AsyncSession, user_id) -> Optional[User]:
        return await self.get_by_id(db, user_id)

    async def update(self, db: AsyncSession, db_obj: User, obj_in: dict) -> User:
        if isinstance(obj_in, dict):
            if "language" in obj_in and "preferred_language" not in obj_in:
                obj_in["preferred_language"] = obj_in["language"]
        for field, value in obj_in.items():
            if value is not None and hasattr(db_obj, field):
                setattr(db_obj, field, value)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, user_id) -> bool:
        user = await self.get_by_id(db, user_id)
        if not user:
            return False
        await db.delete(user)
        await db.flush()
        return True


crud_user = CRUDUser()

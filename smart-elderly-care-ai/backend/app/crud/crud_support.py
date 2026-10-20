"""
crud_support.py – CRUD operations cho Phiếu hỗ trợ CSKH 24/7 (SupportTicket).
"""

from typing import List, Optional
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.schemas.support import SupportTicketCreate


class CRUDSupportTicket:
    async def create_ticket(
        self,
        db: AsyncSession,
        user: Optional[User],
        obj_in: SupportTicketCreate,
    ) -> SupportTicket:
        user_name = user.full_name if user else "Khách hàng ẩn danh"
        phone = (
            obj_in.phone
            or (user.phone if user else None)
            or "0898230852"
        )
        user_id = user.id if user else None

        ticket = SupportTicket(
            user_id=user_id,
            user_name=user_name,
            phone=phone,
            topic=obj_in.topic,
            device_type=obj_in.device_type or "all",
            note=obj_in.note,
            status="pending",
        )
        db.add(ticket)
        await db.commit()
        await db.refresh(ticket)
        return ticket

    async def get_by_user(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> List[SupportTicket]:
        result = await db.execute(
            select(SupportTicket)
            .where(SupportTicket.user_id == user_id)
            .order_by(SupportTicket.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_all(
        self, db: AsyncSession, limit: int = 50
    ) -> List[SupportTicket]:
        result = await db.execute(
            select(SupportTicket)
            .order_by(SupportTicket.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())


crud_support_ticket = CRUDSupportTicket()


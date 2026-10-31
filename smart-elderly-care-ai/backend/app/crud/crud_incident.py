"""
crud_incident.py – CRUD / Repository cho Incident model.
"""

from typing import List, Optional
from uuid import UUID
import json

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident


class CRUDIncident:

    async def create_from_edge(self, db: AsyncSession, data: dict) -> Incident:
        event_id = UUID(data["id"]) if data.get("id") else None
        if event_id:
            existing = await self.get(db, event_id)
            if existing:
                return existing
        payload = {key: data[key] for key in ("device_id", "alert_type", "alert_level", "message", "confidence") if key in data}
        if event_id:
            payload["id"] = event_id
        payload["sources"] = json.dumps(data.get("sources", []))
        return await self.create(db, payload)

    async def get(self, db: AsyncSession, incident_id: UUID) -> Optional[Incident]:
        result = await db.execute(
            select(Incident).where(Incident.id == incident_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        device_id: Optional[UUID] = None,
        alert_level: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        current_user_id: Optional[UUID] = None,
    ) -> List[Incident]:
        query = select(Incident).order_by(Incident.created_at.desc())
        if device_id:
            query = query.where(Incident.device_id == device_id)
        if alert_level:
            query = query.where(Incident.alert_level == alert_level)

        if current_user_id:
            from app.models.user import User
            from app.models.house import House, HouseMember
            from app.models.device import Device
            from sqlalchemy import and_

            user = await db.get(User, current_user_id)
            if user and user.role == "admin":
                # Admin cấp hệ thống: có thể giám sát toàn bộ
                pass
            else:
                # Tìm danh sách nhà mà người dùng sở hữu hoặc là thành viên
                member_house_subq = select(HouseMember.house_id).where(HouseMember.user_id == current_user_id)
                user_houses_query = select(House.id).where(
                    or_(
                        House.owner_id == current_user_id,
                        House.id.in_(member_house_subq),
                    )
                )
                user_house_ids_res = await db.execute(user_houses_query)
                user_house_ids = [row[0] for row in user_house_ids_res.fetchall()]

                if not user_house_ids:
                    # Tài khoản mới chưa liên kết nhà: CHỈ nhận thông báo gửi trực tiếp cho mình (vd: HOUSE_MEMBER_ADDED)
                    query = query.where(Incident.notes == f"USER:{current_user_id}")
                else:
                    # Lấy danh sách thiết bị thuộc các nhà của người dùng
                    dev_res = await db.execute(select(Device.id).where(Device.house_id.in_(user_house_ids)))
                    user_device_ids = [row[0] for row in dev_res.fetchall()]

                    conditions = [Incident.notes == f"USER:{current_user_id}"]
                    if user_device_ids:
                        conditions.append(
                            and_(
                                Incident.device_id.in_(user_device_ids),
                                or_(
                                    Incident.notes.is_(None),
                                    ~Incident.notes.startswith("USER:"),
                                    Incident.notes == f"USER:{current_user_id}",
                                ),
                            )
                        )
                    query = query.where(or_(*conditions))
        else:
            # Khách chưa đăng nhập: Không xem dữ liệu nhạy cảm
            query = query.where(Incident.notes.is_(None), ~Incident.notes.startswith("USER:"))

        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, data: dict) -> Incident:
        obj = Incident(**data)
        db.add(obj)
        await db.flush()
        return obj

    async def acknowledge(
        self,
        db: AsyncSession,
        incident_id: UUID,
        notes: Optional[str] = None,
        acknowledged_by: Optional[UUID] = None,
    ) -> Optional[Incident]:
        incident = await self.get(db, incident_id)
        if not incident:
            return None
        from datetime import datetime, timezone
        incident.is_acknowledged = True
        incident.notes = notes
        incident.acknowledged_at = datetime.now(timezone.utc)
        if acknowledged_by:
            incident.acknowledged_by = acknowledged_by
        await db.flush()
        return incident

    async def acknowledge_all(
        self,
        db: AsyncSession,
        current_user_id: Optional[UUID] = None,
    ) -> int:
        from datetime import datetime, timezone
        from sqlalchemy import update
        stmt = (
            update(Incident)
            .where(Incident.is_acknowledged.is_(False))
            .values(
                is_acknowledged=True,
                acknowledged_at=datetime.now(timezone.utc),
                acknowledged_by=current_user_id,
            )
        )
        if current_user_id:
            from app.models.user import User
            from app.models.house import House, HouseMember
            from app.models.device import Device
            from sqlalchemy import and_

            user = await db.get(User, current_user_id)
            if user and user.role == "admin":
                pass
            else:
                member_house_subq = select(HouseMember.house_id).where(HouseMember.user_id == current_user_id)
                user_houses_query = select(House.id).where(
                    or_(
                        House.owner_id == current_user_id,
                        House.id.in_(member_house_subq),
                    )
                )
                user_house_ids_res = await db.execute(user_houses_query)
                user_house_ids = [row[0] for row in user_house_ids_res.fetchall()]

                if not user_house_ids:
                    stmt = stmt.where(Incident.notes == f"USER:{current_user_id}")
                else:
                    dev_res = await db.execute(select(Device.id).where(Device.house_id.in_(user_house_ids)))
                    user_device_ids = [row[0] for row in dev_res.fetchall()]

                    conditions = [Incident.notes == f"USER:{current_user_id}"]
                    if user_device_ids:
                        conditions.append(
                            and_(
                                Incident.device_id.in_(user_device_ids),
                                or_(
                                    Incident.notes.is_(None),
                                    ~Incident.notes.startswith("USER:"),
                                    Incident.notes == f"USER:{current_user_id}",
                                ),
                            )
                        )
                    stmt = stmt.where(or_(*conditions))
        result = await db.execute(stmt)
        await db.flush()
        return result.rowcount or 0


crud_incident = CRUDIncident()

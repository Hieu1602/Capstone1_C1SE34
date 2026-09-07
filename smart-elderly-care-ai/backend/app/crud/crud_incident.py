"""
crud_incident.py – CRUD / Repository cho Incident model.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident


class CRUDIncident:

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
    ) -> List[Incident]:
        query = select(Incident).order_by(Incident.created_at.desc())
        if device_id:
            query = query.where(Incident.device_id == device_id)
        if alert_level:
            query = query.where(Incident.alert_level == alert_level)
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
    ) -> Optional[Incident]:
        incident = await self.get(db, incident_id)
        if not incident:
            return None
        incident.is_acknowledged = True
        incident.notes = notes
        await db.flush()
        return incident


crud_incident = CRUDIncident()

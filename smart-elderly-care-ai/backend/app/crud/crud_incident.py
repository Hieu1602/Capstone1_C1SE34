"""
crud_incident.py – CRUD / Repository cho Incident model.
"""

from typing import List, Optional
from uuid import UUID
import json

from sqlalchemy import select
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


crud_incident = CRUDIncident()

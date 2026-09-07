"""
crud_vital.py – CRUD / Repository cho VitalSign (TimescaleDB).
"""

from typing import List
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vital_sign import VitalSign
from app.schemas.vital import VitalStats


class CRUDVital:

    async def get_latest(self, db: AsyncSession, device_id: UUID) -> VitalSign | None:
        result = await db.execute(
            select(VitalSign)
            .where(VitalSign.device_id == device_id)
            .order_by(VitalSign.time.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_history(
        self,
        db: AsyncSession,
        device_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> List[VitalSign]:
        result = await db.execute(
            select(VitalSign)
            .where(VitalSign.device_id == device_id)
            .order_by(VitalSign.time.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, data: dict) -> VitalSign:
        obj = VitalSign(**data)
        db.add(obj)
        await db.flush()
        return obj

    async def get_stats(
        self,
        db: AsyncSession,
        device_id: UUID,
        hours: int = 24,
    ) -> VitalStats:
        from datetime import datetime, timedelta, timezone
        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        result = await db.execute(
            select(
                func.min(VitalSign.heart_rate).label("hr_min"),
                func.max(VitalSign.heart_rate).label("hr_max"),
                func.avg(VitalSign.heart_rate).label("hr_avg"),
                func.min(VitalSign.spo2).label("spo2_min"),
                func.max(VitalSign.spo2).label("spo2_max"),
                func.avg(VitalSign.spo2).label("spo2_avg"),
                func.count().filter(VitalSign.fall_detected.is_(True)).label("fall_count"),
            ).where(
                VitalSign.device_id == device_id,
                VitalSign.time >= since,
            )
        )
        row = result.one()
        return VitalStats(
            device_id=device_id,
            period_hours=hours,
            heart_rate_min=row.hr_min,
            heart_rate_max=row.hr_max,
            heart_rate_avg=float(row.hr_avg) if row.hr_avg else None,
            spo2_min=row.spo2_min,
            spo2_max=row.spo2_max,
            spo2_avg=float(row.spo2_avg) if row.spo2_avg else None,
            fall_count=row.fall_count or 0,
        )


crud_vital = CRUDVital()

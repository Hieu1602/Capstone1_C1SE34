import asyncio
from uuid import UUID
from app.core.database import AsyncSessionFactory
from app.models.incident import Incident
from sqlalchemy import select

async def main():
    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Incident).where(Incident.id == UUID('13269b69-42b3-4357-a369-fac1a4fc0aa3')))
        inc = res.scalar_one_or_none()
        if inc:
            inc.message = 'Chủ hộ Nguyễn Hữu Nghĩa đã gửi lời mời bạn tham gia căn nhà "Nhà của tôi" với vai trò Thành viên gia đình. Hãy nhấn vào đây để xác nhận vào nhà.'
            await db.commit()
            print('Updated incident message to real text!')

asyncio.run(main())

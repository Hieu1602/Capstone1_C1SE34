"""
seed_data.py – Khởi tạo dữ liệu Master ban đầu đồng bộ hoàn toàn với Mobile App.
Dữ liệu khởi tạo gồm:
- 1 Tài khoản Quản trị / Người chăm sóc: admin@seca.vn / 12345678
- 1 Căn nhà: "Nhà của tôi" (Địa chỉ: 123 Hải Phòng, Đà Nẵng, chế độ: HOME)
- 2 Nhóm phân vùng: "Phòng khách", "Phòng ngủ"
- 2 Thiết bị cốt lõi:
    1. SECA_001: Camera AI an ninh (Phòng khách, 2K Super HD, AI Protect ON)
    2. BLE_BAND_001: Vòng đeo tay BLE Smartband (Phòng ngủ, Đo nhịp tim, SpO2, Pin 84%)
Vị trí: backend/app/core/seed_data.py
"""

import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionFactory
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.house import House, HouseMember
from app.models.device_group import DeviceGroup
from app.models.device import Device, DeviceType
from app.models.device_config import DeviceConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_master_data() -> None:
    async with AsyncSessionFactory() as db:
        try:
            logger.info("[SEED] Bắt đầu nạp dữ liệu Master...")

            # 1. Tìm hoặc tạo User mặc định
            user_res = await db.execute(select(User).where(User.email == "admin@seca.vn"))
            user = user_res.scalar_one_or_none()
            if not user:
                user = User(
                    email="admin@seca.vn",
                    full_name="Nguyễn Văn Quản Trị",
                    phone="+84905123456",
                    hashed_password=hash_password("12345678"),
                    role=UserRole.ADMIN,
                    is_active=True,
                )
                db.add(user)
                await db.flush()
                await db.refresh(user)
                logger.info(f"[SEED] Đã tạo User mặc định: admin@seca.vn (ID: {user.id})")
            else:
                logger.info(f"[SEED] User đã tồn tại: {user.email}")

            # 2. Tìm hoặc tạo House mặc định
            house_res = await db.execute(select(House).where(House.owner_id == user.id))
            house = house_res.scalar_one_or_none()
            if not house:
                house = House(
                    owner_id=user.id,
                    name="Nhà của tôi",
                    address="123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng",
                    current_mode="HOME",
                )
                db.add(house)
                await db.flush()
                await db.refresh(house)

                membership = HouseMember(
                    house_id=house.id,
                    user_id=user.id,
                    role_in_house="OWNER",
                    permissions="ADMIN",
                )
                db.add(membership)
                await db.flush()
                logger.info(f"[SEED] Đã tạo Căn nhà: {house.name} (ID: {house.id})")
            else:
                logger.info(f"[SEED] Căn nhà đã tồn tại: {house.name}")

            # 3. Tạo 2 nhóm khu vực: 'Phòng khách' & 'Phòng ngủ'
            groups_dict: dict[str, DeviceGroup] = {}
            for name, icon, color, order in [
                ("Phòng khách", "folder", "#7C3AED", 1),
                ("Phòng ngủ", "folder", "#7C3AED", 2),
            ]:
                g_res = await db.execute(
                    select(DeviceGroup).where(
                        DeviceGroup.house_id == house.id,
                        DeviceGroup.name == name,
                    )
                )
                group = g_res.scalar_one_or_none()
                if not group:
                    group = DeviceGroup(
                        house_id=house.id,
                        name=name,
                        icon=icon,
                        color=color,
                        sort_order=order,
                    )
                    db.add(group)
                    await db.flush()
                    await db.refresh(group)
                    logger.info(f"[SEED] Đã tạo Nhóm: {name}")
                groups_dict[name] = group

            # 4. Tạo thiết bị 1: SECA_001 (Camera AI)
            cam_res = await db.execute(select(Device).where(Device.device_id == "SECA_001"))
            cam = cam_res.scalar_one_or_none()
            if not cam:
                cam = Device(
                    device_id="SECA_001",
                    name="SECA_001",
                    sub_title="Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều",
                    device_type=DeviceType.CAMERA,
                    location="Phòng khách",
                    is_online=True,
                    status_text="Đang ghi hình",
                    owner_id=user.id,
                    house_id=house.id,
                    group_id=groups_dict["Phòng khách"].id,
                )
                db.add(cam)
                await db.flush()
                await db.refresh(cam)

                cam_config = DeviceConfig(
                    device_id=cam.id,
                    stream_url="http://10.0.2.2:8080",
                    resolution="2K",
                    is_sleep=False,
                    is_ai_protect=True,
                    has_two_way_audio=True,
                )
                db.add(cam_config)
                logger.info("[SEED] Đã tạo Thiết bị Camera SECA_001 và cấu hình")
            else:
                logger.info("[SEED] Camera SECA_001 đã tồn tại")

            # 5. Tạo thiết bị 2: Vòng đeo tay BLE Smartband
            band_res = await db.execute(select(Device).where(Device.device_id == "BLE_BAND_001"))
            band = band_res.scalar_one_or_none()
            if not band:
                band = Device(
                    device_id="BLE_BAND_001",
                    name="Vòng đeo tay BLE Smartband",
                    sub_title="Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập",
                    device_type=DeviceType.SMARTBAND,
                    location="Phòng ngủ",
                    is_online=True,
                    status_text="Pin 84% • Đang đeo",
                    battery_level=84,
                    owner_id=user.id,
                    house_id=house.id,
                    group_id=groups_dict["Phòng ngủ"].id,
                )
                db.add(band)
                await db.flush()
                await db.refresh(band)

                band_config = DeviceConfig(
                    device_id=band.id,
                    hr_threshold_high=120,
                    hr_threshold_low=50,
                    spo2_threshold_low=90,
                    fall_impact_threshold=2.5,
                )
                db.add(band_config)
                logger.info("[SEED] Đã tạo Thiết bị Vòng đeo tay BLE Smartband và cấu hình")
            else:
                logger.info("[SEED] Vòng đeo tay BLE Smartband đã tồn tại")

            await db.commit()
            logger.info("[SEED] Hoàn tất nạp dữ liệu Master thành công 100%!")

        except Exception as e:
            await db.rollback()
            logger.error(f"[SEED] Lỗi khi nạp dữ liệu: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(seed_master_data())


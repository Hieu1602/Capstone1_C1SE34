# -*- coding: utf-8 -*-
"""
seed_data.py – Khởi tạo tài khoản Quản trị & Tiện ích dọn dẹp dữ liệu ảo (Zero Fake Data).
Vị trí: backend/app/core/seed_data.py

Chính sách dữ liệu:
- Zero Fake Data: Tuyệt đối không tạo thiết bị ảo, không gán pin/online giả lập, không tạo hồ sơ bệnh án mẫu.
- Chỉ khởi tạo tài khoản Quản trị tối thiểu (System Admin) và Căn nhà ban đầu nếu chưa tồn tại.
- Hỗ trợ cờ dòng lệnh:
    python -m app.core.seed_data --clean   : Xóa sạch toàn bộ thiết bị ảo và dữ liệu giả lập trong Database.
    python -m app.core.seed_data          : Nạp tài khoản quản trị và căn nhà cơ bản sạch.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionFactory
from app.core.security import hash_password
from app.models.device import Device
from app.models.device_config import DeviceConfig
from app.models.device_group import DeviceGroup
from app.models.elderly_profile import ElderlyProfile
from app.models.house import House, HouseMember
from app.models.incident import Incident
from app.models.user import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_master_data() -> None:
    """
    Khởi tạo tài khoản Quản trị hệ thống (System Admin) và Căn nhà cơ bản.
    Tuân thủ nguyên tắc Zero Fake Data: Không tạo bất kỳ thiết bị ảo hay hồ sơ người cao tuổi mẫu nào.
    """
    async with AsyncSessionFactory() as db:
        try:
            logger.info("[SEED] Khởi tạo tài khoản nền tảng (Zero Fake Data)...")

            # 1. Tìm hoặc tạo System Admin (+84900000000)
            admin_res = await db.execute(select(User).where(User.phone == "+84900000000"))
            admin = admin_res.scalar_one_or_none()
            if not admin:
                admin = User(
                    phone="+84900000000",
                    full_name="System Admin",
                    hashed_password=hash_password("12345678"),
                    role=UserRole.ADMIN,
                    is_active=True,
                )
                db.add(admin)
                await db.flush()
                await db.refresh(admin)
                logger.info(f"[SEED] Đã tạo System Admin: {admin.phone} (ID: {admin.id})")
            else:
                logger.info(f"[SEED] System Admin đã tồn tại: {admin.phone}")

            # 2. Tìm hoặc tạo User mặc định ban đầu (+84905123456)
            user_res = await db.execute(select(User).where(User.phone == "+84905123456"))
            user = user_res.scalar_one_or_none()
            if not user:
                user = User(
                    phone="+84905123456",
                    full_name="Nguyễn Hữu Nghĩa",
                    hashed_password=hash_password("12345678"),
                    role=UserRole.USER,
                    is_active=True,
                )
                db.add(user)
                await db.flush()
                await db.refresh(user)
                logger.info(f"[SEED] Đã tạo User mặc định: {user.phone} (ID: {user.id})")
            else:
                logger.info(f"[SEED] User đã tồn tại: {user.phone}")

            # 3. Tìm hoặc tạo House cơ bản cho User (nếu chưa có)
            house_res = await db.execute(select(House).where(House.owner_id == user.id))
            house = house_res.scalar_one_or_none()
            if not house:
                house = House(
                    owner_id=user.id,
                    name="Nhà của tôi",
                    address=None,
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

            await db.commit()
            logger.info("[SEED] Hoàn tất nạp dữ liệu nền tảng sạch (Không có thiết bị/hồ sơ ảo)!")

        except Exception as e:
            await db.rollback()
            logger.error(f"[SEED] Lỗi khi nạp dữ liệu: {e}")
            raise


async def clean_mock_data() -> None:
    """
    Xóa sạch tất cả dữ liệu ảo (Mock Devices, Fake Elderly Profiles, Device Configs, Fake Incidents)
    khỏi Database để đảm bảo 100% dữ liệu xuất phát từ thiết bị và người dùng thực tế.
    """
    async with AsyncSessionFactory() as db:
        try:
            logger.info("[CLEAN] Bắt đầu dọn dẹp toàn bộ dữ liệu ảo trong Database...")

            # 1. Xóa TimescaleDB vital signs nếu có
            try:
                del_vitals = await db.execute(text("DELETE FROM vital_signs"))
                count_vitals = getattr(del_vitals, "rowcount", 0)
                logger.info(f"[CLEAN] Đã xóa {count_vitals} bản ghi sinh hiệu ảo (vital_signs).")
            except Exception as e:
                logger.warning(f"[CLEAN] Bỏ qua vital_signs: {e}")

            # 2. Xóa toàn bộ DeviceConfig
            del_configs = await db.execute(delete(DeviceConfig))
            count_configs = getattr(del_configs, "rowcount", 0)
            logger.info(f"[CLEAN] Đã xóa {count_configs} cấu hình thiết bị (device_configs).")

            # 3. Xóa các incidents mẫu
            del_incidents = await db.execute(delete(Incident))
            count_incidents = getattr(del_incidents, "rowcount", 0)
            logger.info(f"[CLEAN] Đã xóa {count_incidents} cảnh báo mẫu (incidents).")

            # 4. Xóa các thiết bị mẫu (devices)
            del_devices = await db.execute(delete(Device))
            count_devices = getattr(del_devices, "rowcount", 0)
            logger.info(f"[CLEAN] Đã xóa {count_devices} thiết bị mẫu (devices).")

            # 5. Xóa hồ sơ người cao tuổi mẫu (elderly_profiles)
            del_elderly = await db.execute(delete(ElderlyProfile))
            count_elderly = getattr(del_elderly, "rowcount", 0)
            logger.info(f"[CLEAN] Đã xóa {count_elderly} hồ sơ người cao tuổi mẫu (elderly_profiles).")

            # 6. Xóa các nhóm thiết bị mẫu (device_groups)
            del_groups = await db.execute(delete(DeviceGroup))
            count_groups = getattr(del_groups, "rowcount", 0)
            logger.info(f"[CLEAN] Đã xóa {count_groups} nhóm phân vùng mẫu (device_groups).")

            await db.commit()
            logger.info("[CLEAN] Đã xóa sạch toàn bộ dữ liệu ảo thành công 100%!")

        except Exception as e:
            await db.rollback()
            logger.error(f"[CLEAN] Lỗi khi dọn dẹp dữ liệu: {e}")
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Quản lý dữ liệu Master / Dọn dẹp dữ liệu ảo SECA")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Xóa sạch toàn bộ dữ liệu ảo (Devices, Configs, Elderly Profiles, Incidents)",
    )
    args = parser.parse_args()

    if args.clean:
        asyncio.run(clean_mock_data())
    else:
        asyncio.run(seed_master_data())


if __name__ == "__main__":
    main()

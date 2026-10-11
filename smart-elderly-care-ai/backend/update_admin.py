import asyncio
import os
import sys

# Ensure site-packages and backend root in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
site_packages = os.path.join(backend_dir, ".venv", "Lib", "site-packages")
sys.path.insert(0, site_packages)
sys.path.insert(0, backend_dir)

from sqlalchemy import select, delete
from app.core.database import AsyncSessionFactory
from app.core.security import hash_password
from app.models.user import User, UserRole

async def update_admin_account():
    async with AsyncSessionFactory() as db:
        # Check if user with phone 'Admin123' exists
        res = await db.execute(select(User).where(User.phone == "Admin123"))
        admin_user = res.scalar_one_or_none()
        
        # Check if old admin 0905123456 exists
        old_res = await db.execute(select(User).where(User.phone == "0905123456", User.role == "admin"))
        old_admin = old_res.scalar_one_or_none()

        new_hashed = hash_password("123456")

        if admin_user:
            admin_user.hashed_password = new_hashed
            admin_user.full_name = "Quản Trị Viên Hệ Thống"
            admin_user.role = UserRole.ADMIN
            admin_user.is_active = True
            print("[OK] Cap nhat Admin123 thanh cong!")
        elif old_admin:
            old_admin.phone = "Admin123"
            old_admin.full_name = "Quản Trị Viên Hệ Thống"
            old_admin.hashed_password = new_hashed
            old_admin.role = UserRole.ADMIN
            old_admin.is_active = True
            print("[OK] Chuyen doi tai khoan admin cu sang Admin123 thanh cong!")
        else:
            new_admin = User(
                phone="Admin123",
                full_name="Quản Trị Viên Hệ Thống",
                hashed_password=new_hashed,
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(new_admin)
            print("[OK] Tao moi tai khoan Admin123 thanh cong!")

        await db.commit()

        # In danh sach tai khoan
        all_res = await db.execute(select(User))
        users = all_res.scalars().all()
        print("\n--- DANH SACH TAI KHOAN TRONG DATABASE ---")
        for u in users:
            print(f"ID: {u.id} | Phone/User: {u.phone} | Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(update_admin_account())

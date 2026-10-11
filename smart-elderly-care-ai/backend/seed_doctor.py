import asyncio
import sys
from app.core.seed_data import seed_master_data

if __name__ == '__main__':
    print("Bắt đầu nạp & đồng bộ tài khoản Bác sĩ và Dữ liệu Master...")
    asyncio.run(seed_master_data())
    print("Hoàn tất!")



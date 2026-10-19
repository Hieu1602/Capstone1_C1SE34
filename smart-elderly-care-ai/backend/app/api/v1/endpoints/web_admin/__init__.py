"""
web_admin package – Gom 4 phân hệ chức năng chuyên biệt cho Cổng Quản Trị Hệ Thống (Web Admin Portal).
Theo đúng bảng phân rã chức năng:
1. users.py: Phân hệ 1 - Quản lý người dùng & phân quyền (Chủ sở hữu, Thành viên, Bác sĩ, Người cao tuổi)
2. security.py: Phân hệ 2 - Quản lý bảo mật hệ thống & Nhật ký kiểm toán (Chính sách, Phiên JWT, Audit Logs, Abnormal Access)
3. monitoring.py: Phân hệ 3 - Giám sát hoạt động hệ thống (Sức khỏe 5 vi dịch vụ, CPU/RAM/Disk, Sự cố vận hành)
4. infrastructure.py: Phân hệ 4 - Quản lý hạ tầng (CSDL PostgreSQL 16, TimescaleDB, Sao lưu & Khôi phục, Redis cache flush, Config kỹ thuật)
"""

from app.api.v1.endpoints.web_admin.infrastructure import router as admin_infrastructure_router
from app.api.v1.endpoints.web_admin.monitoring import router as admin_monitoring_router
from app.api.v1.endpoints.web_admin.notifications import router as admin_notifications_router
from app.api.v1.endpoints.web_admin.security import router as admin_security_router
from app.api.v1.endpoints.web_admin.users import router as admin_users_router

__all__ = [
    "admin_users_router",
    "admin_security_router",
    "admin_monitoring_router",
    "admin_infrastructure_router",
    "admin_notifications_router",
]


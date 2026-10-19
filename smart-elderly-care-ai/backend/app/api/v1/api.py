"""
api.py – Điểm kết nối trung tâm định tuyến API V1 của hệ thống Smart Elderly Care AI.
Phân chia cấu trúc rõ ràng:
1. [WEB ADMIN PORTAL]: 4 phân hệ quản trị hệ thống (Người dùng, Bảo mật, Giám sát, Hạ tầng).
2. [MOBILE APP]: Ứng dụng di động (Xác thực, Nhà & Phòng, Thiết bị IoT, Sinh hiệu, Cảnh báo SOS, AI, Bác sĩ).
"""

from fastapi import APIRouter

# ==============================================================================
# NHÓM 1: CỔNG QUẢN TRỊ HỆ THỐNG (WEB ADMIN PORTAL - 4 PHÂN HỆ QUẢN TRỊ)
# Vị trí: backend/app/api/v1/endpoints/web_admin/
# ==============================================================================
from app.api.v1.endpoints.web_admin.users          import router as admin_users_router
from app.api.v1.endpoints.web_admin.security       import router as admin_security_router
from app.api.v1.endpoints.web_admin.monitoring     import router as admin_monitoring_router
from app.api.v1.endpoints.web_admin.infrastructure import router as admin_infrastructure_router
from app.api.v1.endpoints.web_admin.notifications  import router as admin_notifications_router

# ==============================================================================
# NHÓM 2: ỨNG DỤNG DI ĐỘNG (MOBILE APP - NGƯỜI NHÀ, BÁC SĨ & NGƯỜI CAO TUỔI)
# Vị trí: backend/app/api/v1/endpoints/mobile/
# ==============================================================================
from app.api.v1.endpoints.mobile.auth          import router as mobile_auth_router
from app.api.v1.endpoints.mobile.houses        import router as mobile_houses_router
from app.api.v1.endpoints.mobile.device_groups import router as mobile_device_groups_router
from app.api.v1.endpoints.mobile.devices       import router as mobile_devices_router
from app.api.v1.endpoints.mobile.vitals        import router as mobile_vitals_router
from app.api.v1.endpoints.mobile.incidents     import router as mobile_incidents_router
from app.api.v1.endpoints.mobile.reminders     import router as mobile_reminders_router
from app.api.v1.endpoints.mobile.patients      import router as mobile_patients_router
from app.api.v1.endpoints.mobile.doctor        import router as mobile_doctor_router
from app.api.v1.endpoints.mobile.reports       import router as mobile_reports_router
from app.api.v1.endpoints.mobile.chatbot       import router as mobile_chatbot_router
from app.api.v1.endpoints.mobile.emergency     import router as mobile_emergency_router

api_router = APIRouter()

# ------------------------------------------------------------------------------
# 1. ĐĂNG KÝ ROUTERS WEB ADMIN PORTAL
# ------------------------------------------------------------------------------
# Phân hệ 1: Quản lý người dùng
api_router.include_router(admin_users_router,          prefix="/users",                tags=["[WEB ADMIN] 1. Quản lý người dùng"])
api_router.include_router(admin_users_router,          prefix="/admin/users",          tags=["[WEB ADMIN] 1. Quản lý người dùng (Alias)"])

# Phân hệ 2: Quản lý bảo mật hệ thống
api_router.include_router(admin_security_router,       prefix="/security",             tags=["[WEB ADMIN] 2. Quản lý bảo mật hệ thống"])
api_router.include_router(admin_security_router,       prefix="/admin/security",       tags=["[WEB ADMIN] 2. Quản lý bảo mật hệ thống (Alias)"])

# Phân hệ 3: Giám sát hoạt động hệ thống
api_router.include_router(admin_monitoring_router,     prefix="/system",               tags=["[WEB ADMIN] 3. Giám sát hoạt động hệ thống"])
api_router.include_router(admin_monitoring_router,     prefix="/admin/monitoring",     tags=["[WEB ADMIN] 3. Giám sát hoạt động hệ thống (Alias)"])

# Phân hệ 4: Quản lý hạ tầng
api_router.include_router(admin_infrastructure_router, prefix="/system",               tags=["[WEB ADMIN] 4. Quản lý hạ tầng"])
api_router.include_router(admin_infrastructure_router, prefix="/admin/infrastructure", tags=["[WEB ADMIN] 4. Quản lý hạ tầng (Alias)"])

# Phân hệ 5: Quản lý thông báo toàn hệ thống
api_router.include_router(admin_notifications_router,  prefix="/admin/notifications",  tags=["[WEB ADMIN] 5. Quản lý thông báo toàn hệ thống"])
api_router.include_router(admin_notifications_router,  prefix="/system-notifications", tags=["[WEB ADMIN] 5. Quản lý thông báo toàn hệ thống (Alias)"])

# ------------------------------------------------------------------------------
# 2. ĐĂNG KÝ ROUTERS MOBILE APP
# ------------------------------------------------------------------------------
api_router.include_router(mobile_auth_router,          prefix="/auth",          tags=["[MOBILE APP] Xác thực & Tài khoản"])
api_router.include_router(mobile_houses_router,        prefix="/houses",        tags=["[MOBILE APP] Không gian nhà & Gia đình"])
api_router.include_router(mobile_device_groups_router, prefix="/device-groups", tags=["[MOBILE APP] Phân vùng & Phòng"])
api_router.include_router(mobile_devices_router,       prefix="/devices",       tags=["[MOBILE APP] Thiết bị IoT & Camera AI"])
api_router.include_router(mobile_vitals_router,        prefix="/vitals",        tags=["[MOBILE APP] Sinh hiệu thời gian thực"])
api_router.include_router(mobile_incidents_router,     prefix="/incidents",     tags=["[MOBILE APP] Cảnh báo khẩn cấp & Té ngã"])
api_router.include_router(mobile_incidents_router,     prefix="/notifications", tags=["[MOBILE APP] Cảnh báo (Notifications Alias)"])
api_router.include_router(mobile_reminders_router,     prefix="/reminders",     tags=["[MOBILE APP] Nhắc nhở uống thuốc"])
api_router.include_router(mobile_patients_router,      prefix="/patients",      tags=["[MOBILE APP] Hồ sơ bệnh án người cao tuổi"])
api_router.include_router(mobile_doctor_router,        prefix="/doctor",        tags=["[MOBILE APP] Bác sĩ gia đình"])
api_router.include_router(mobile_reports_router,       prefix="/reports",       tags=["[MOBILE APP] Báo cáo sức khỏe tổng hợp"])
api_router.include_router(mobile_chatbot_router,       prefix="/chatbot",       tags=["[MOBILE APP] Trợ lý AI Y khoa (RAG)"])
api_router.include_router(mobile_emergency_router,     prefix="/emergency",     tags=["[MOBILE APP] Phát tín hiệu SOS khẩn cấp"])
api_router.include_router(mobile_emergency_router,     prefix="/mobile/emergency", tags=["[MOBILE APP] Phát tín hiệu SOS khẩn cấp (Alias)"])

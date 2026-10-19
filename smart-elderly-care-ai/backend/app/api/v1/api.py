"""
api.py – Điểm kết nối trung tâm định tuyến API V1 của hệ thống Smart Elderly Care AI.
"""

from fastapi import APIRouter

from app.api.v1.endpoints.mobile.auth import router as mobile_auth_router
from app.api.v1.endpoints.mobile.chatbot import router as mobile_chatbot_router
from app.api.v1.endpoints.mobile.devices import router as mobile_devices_router
from app.api.v1.endpoints.mobile.device_groups import router as mobile_device_groups_router
from app.api.v1.endpoints.mobile.doctor import router as mobile_doctor_router
from app.api.v1.endpoints.mobile.emergency import router as mobile_emergency_router
from app.api.v1.endpoints.mobile.houses import router as mobile_houses_router
from app.api.v1.endpoints.mobile.incidents import router as mobile_incidents_router
from app.api.v1.endpoints.mobile.patients import router as mobile_patients_router
from app.api.v1.endpoints.mobile.reports import router as mobile_reports_router
from app.api.v1.endpoints.mobile.reminders import router as mobile_reminders_router
from app.api.v1.endpoints.mobile.vitals import router as mobile_vitals_router
from app.api.v1.endpoints.web_admin.infrastructure import router as admin_infrastructure_router
from app.api.v1.endpoints.web_admin.monitoring import router as admin_monitoring_router
from app.api.v1.endpoints.web_admin.notifications import router as admin_notifications_router
from app.api.v1.endpoints.web_admin.security import router as admin_security_router
from app.api.v1.endpoints.web_admin.users import router as admin_users_router

api_router = APIRouter()

api_router.include_router(admin_users_router, prefix="/users", tags=["[WEB ADMIN] Users"])
api_router.include_router(admin_users_router, prefix="/admin/users", tags=["[WEB ADMIN] Users Alias"])
api_router.include_router(admin_security_router, prefix="/security", tags=["[WEB ADMIN] Security"])
api_router.include_router(admin_security_router, prefix="/admin/security", tags=["[WEB ADMIN] Security Alias"])
api_router.include_router(admin_monitoring_router, prefix="/system", tags=["[WEB ADMIN] Monitoring"])
api_router.include_router(admin_monitoring_router, prefix="/admin/monitoring", tags=["[WEB ADMIN] Monitoring Alias"])
api_router.include_router(admin_infrastructure_router, prefix="/system", tags=["[WEB ADMIN] Infrastructure"])
api_router.include_router(admin_infrastructure_router, prefix="/admin/infrastructure", tags=["[WEB ADMIN] Infrastructure Alias"])
api_router.include_router(admin_notifications_router, prefix="/admin/notifications", tags=["[WEB ADMIN] Notifications"])
api_router.include_router(admin_notifications_router, prefix="/system-notifications", tags=["[WEB ADMIN] Notifications Alias"])

api_router.include_router(mobile_auth_router, prefix="/auth", tags=["[MOBILE APP] Authentication"])
api_router.include_router(mobile_houses_router, prefix="/houses", tags=["[MOBILE APP] Houses"])
api_router.include_router(mobile_device_groups_router, prefix="/device-groups", tags=["[MOBILE APP] Device Groups"])
api_router.include_router(mobile_devices_router, prefix="/devices", tags=["[MOBILE APP] Devices"])
api_router.include_router(mobile_vitals_router, prefix="/vitals", tags=["[MOBILE APP] Vitals"])
api_router.include_router(mobile_incidents_router, prefix="/incidents", tags=["[MOBILE APP] Incidents"])
api_router.include_router(mobile_incidents_router, prefix="/notifications", tags=["[MOBILE APP] Notifications Alias"])
api_router.include_router(mobile_reminders_router, prefix="/reminders", tags=["[MOBILE APP] Reminders"])
api_router.include_router(mobile_patients_router, prefix="/patients", tags=["[MOBILE APP] Patients"])
api_router.include_router(mobile_doctor_router, prefix="/doctor", tags=["[MOBILE APP] Doctor"])
api_router.include_router(mobile_reports_router, prefix="/reports", tags=["[MOBILE APP] Reports"])
api_router.include_router(mobile_chatbot_router, prefix="/chatbot", tags=["[MOBILE APP] Chatbot"])
api_router.include_router(mobile_emergency_router, prefix="/emergency", tags=["[MOBILE APP] Emergency"])
api_router.include_router(mobile_emergency_router, prefix="/mobile/emergency", tags=["[MOBILE APP] Emergency Alias"])

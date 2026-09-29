"""
api.py – Gom tất cả routers v1 vào một APIRouter chính.
Vị trí: backend/app/api/v1/api.py
"""

from fastapi import APIRouter

from app.api.v1.endpoints.auth          import router as auth_router
from app.api.v1.endpoints.device_groups import router as device_groups_router
from app.api.v1.endpoints.devices       import router as devices_router
from app.api.v1.endpoints.doctor        import router as doctor_router
from app.api.v1.endpoints.houses        import router as houses_router
from app.api.v1.endpoints.incidents     import router as incidents_router
from app.api.v1.endpoints.patients      import router as patients_router
from app.api.v1.endpoints.reminders     import router as reminders_router
from app.api.v1.endpoints.reports       import router as reports_router
from app.api.v1.endpoints.system        import router as system_router
from app.api.v1.endpoints.users         import router as users_router
from app.api.v1.endpoints.vitals        import router as vitals_router

api_router = APIRouter()

api_router.include_router(auth_router,          prefix="/auth",          tags=["Authentication"])
api_router.include_router(users_router,         prefix="/users",         tags=["Users"])
api_router.include_router(houses_router,        prefix="/houses",        tags=["Houses"])
api_router.include_router(device_groups_router, prefix="/device-groups", tags=["Device Groups"])
api_router.include_router(devices_router,       prefix="/devices",       tags=["Devices"])
api_router.include_router(vitals_router,        prefix="/vitals",        tags=["Vital Signs"])
api_router.include_router(incidents_router,     prefix="/incidents",     tags=["Incidents"])
api_router.include_router(incidents_router,     prefix="/notifications", tags=["Notifications (Incidents Alias)"])
api_router.include_router(reminders_router,     prefix="/reminders",     tags=["Reminders"])
api_router.include_router(patients_router,      prefix="/patients",      tags=["Patients & Medical Records"])
api_router.include_router(doctor_router,        prefix="/doctor",        tags=["Doctor Subsystem"])
api_router.include_router(reports_router,       prefix="/reports",       tags=["Reports"])
api_router.include_router(system_router,        prefix="/system",        tags=["System & Redis Cache"])

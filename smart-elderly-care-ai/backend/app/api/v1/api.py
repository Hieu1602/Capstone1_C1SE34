"""
api.py – Gom tất cả routers v1 vào một APIRouter chính.
"""

from fastapi import APIRouter

from app.api.v1.endpoints.auth      import router as auth_router
from app.api.v1.endpoints.devices   import router as devices_router
from app.api.v1.endpoints.incidents import router as incidents_router
from app.api.v1.endpoints.reports   import router as reports_router
from app.api.v1.endpoints.users     import router as users_router
from app.api.v1.endpoints.vitals    import router as vitals_router

api_router = APIRouter()

api_router.include_router(auth_router,      prefix="/auth",      tags=["Authentication"])
api_router.include_router(users_router,     prefix="/users",     tags=["Users"])
api_router.include_router(devices_router,   prefix="/devices",   tags=["Devices"])
api_router.include_router(vitals_router,    prefix="/vitals",    tags=["Vital Signs"])
api_router.include_router(incidents_router, prefix="/incidents", tags=["Incidents"])
api_router.include_router(reports_router,   prefix="/reports",   tags=["Reports"])

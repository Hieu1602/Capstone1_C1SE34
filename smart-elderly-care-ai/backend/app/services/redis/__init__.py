"""
Gói dịch vụ Redis Service - Hệ thống Smart Elderly Care AI.
Quản lý bộ nhớ đệm (Cache), Heartbeat thiết bị, và Hàng đợi cảnh báo khẩn cấp.
"""

from app.services.redis.redis_service import redis_service

__all__ = ["redis_service"]

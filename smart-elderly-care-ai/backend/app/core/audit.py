"""
Module hỗ trợ ghi nhật ký kiểm toán hệ thống (Audit Logs)
"""
import logging
from typing import Optional
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def get_client_ip(request: Optional[Request] = None) -> str:
    """Lấy IP của client, ưu tiên x-forwarded-for nếu qua reverse proxy."""
    if not request:
        return "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def get_user_agent(request: Optional[Request] = None) -> str:
    """Lấy user agent của client."""
    if not request:
        return "System"
    return request.headers.get("user-agent", "Unknown")[:50]


async def record_audit_log(
    db: AsyncSession,
    event: str,
    user_name: str,
    details: str,
    severity: str = "low",
    ip_address: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Ghi một bản ghi nhật ký kiểm toán vào bảng audit_logs một cách an toàn.
    """
    ip = ip_address or get_client_ip(request)
    try:
        await db.execute(
            text("""
                INSERT INTO audit_logs (event, user_name, ip_address, severity, details)
                VALUES (:event, :user_name, :ip_address, :severity, :details)
            """),
            {
                "event": event,
                "user_name": user_name,
                "ip_address": ip,
                "severity": severity,
                "details": details,
            },
        )
        await db.commit()
    except Exception as exc:
        logger.warning("[AuditLog] Không thể ghi audit log: %s", exc)
        try:
            await db.rollback()
        except Exception:
            pass


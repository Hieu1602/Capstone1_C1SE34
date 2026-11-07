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
    admin_id: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    commit: bool = True,
) -> None:
    """
    Ghi một bản ghi nhật ký kiểm toán vào bảng audit_logs một cách an toàn.
    Chỉ thêm (append-only), hỗ trợ chạy trong cùng transaction (commit=False).
    """
    ip = ip_address or get_client_ip(request)
    act = action or event
    try:
        await db.execute(
            text("""
                INSERT INTO audit_logs (
                    event, user_name, ip_address, severity, details,
                    admin_id, action, target_type, target_id, reason, old_value, new_value
                )
                VALUES (
                    :event, :user_name, :ip_address, :severity, :details,
                    :admin_id, :action, :target_type, :target_id, :reason, :old_value, :new_value
                )
            """),
            {
                "event": event,
                "user_name": user_name,
                "ip_address": ip,
                "severity": severity,
                "details": details,
                "admin_id": admin_id,
                "action": act,
                "target_type": target_type,
                "target_id": str(target_id) if target_id else None,
                "reason": reason,
                "old_value": old_value,
                "new_value": new_value,
            },
        )
        if commit:
            await db.commit()
    except Exception as exc:
        logger.warning("[AuditLog] Không thể ghi audit log: %s", exc)
        if commit:
            try:
                await db.rollback()
            except Exception:
                pass


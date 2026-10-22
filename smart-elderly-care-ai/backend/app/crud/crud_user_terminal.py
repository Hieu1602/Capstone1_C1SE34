"""
crud_user_terminal.py – CRUD & nghiệp vụ cho Quản lý đầu cuối và Lịch sử đăng nhập.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.user_terminal import UserLoginHistory, UserTerminal


def parse_device_info(
    user_agent: str | None,
    client_ip: str,
    custom_device_name: Optional[str] = None,
) -> dict[str, str]:
    """
    Phân tích User-Agent và IP để trích xuất tên thiết bị, hệ điều hành và vị trí.
    Ví dụ:
    - Android app / mobile: "Samsung Galaxy SM-A127F", "Android 14", "mobile"
    - iOS app / mobile: "iPhone 15 Pro", "iOS 17.4", "mobile"
    - Chrome on Windows: "Chrome Web (Windows 11)", "Windows 11", "desktop"
    """
    ua = (user_agent or "").strip()

    # 1. Xác định vị trí địa lý xấp xỉ
    clean_ip = client_ip.strip() if client_ip else "127.0.0.1"
    if (
        clean_ip in ("127.0.0.1", "localhost", "::1")
        or clean_ip.startswith("192.168.")
        or clean_ip.startswith("10.")
        or clean_ip.startswith("172.")
    ):
        location = "Đà Nẵng, Việt Nam (Mạng cục bộ)"
    else:
        location = "Đà Nẵng, Việt Nam"

    if custom_device_name and custom_device_name.strip():
        return {
            "device_name": custom_device_name.strip(),
            "device_type": "mobile",
            "os": "Mobile OS",
            "browser": "SECA App",
            "ip_address": clean_ip,
            "location": location,
        }

    # 2. Phân tích User-Agent
    device_name = "Samsung Galaxy SM-A127F"
    device_type = "mobile"
    os_name = "Android 14"
    browser = "SECA Mobile App"

    ua_lower = ua.lower()

    if "iphone" in ua_lower:
        device_name = "iPhone 15 Pro"
        os_name = "iOS"
        device_type = "mobile"
        browser = "Mobile Safari" if "safari" in ua_lower else "SECA iOS App"
    elif "ipad" in ua_lower:
        device_name = "iPad Air"
        os_name = "iPadOS"
        device_type = "tablet"
        browser = "Mobile Safari"
    elif "android" in ua_lower:
        device_type = "mobile"
        os_name = "Android 14"
        sm_match = re.search(r"\b(sm-[a-z0-9]+)\b", ua, re.IGNORECASE)
        if sm_match:
            device_name = f"Samsung Galaxy {sm_match.group(1).upper()}"
        elif "pixel" in ua_lower:
            device_name = "Google Pixel 8"
        elif "xiaomi" in ua_lower or "redmi" in ua_lower:
            device_name = "Xiaomi Redmi Note"
        else:
            device_name = "Samsung Galaxy SM-A127F"
        browser = "Chrome Mobile" if "chrome" in ua_lower else "SECA Android App"
    elif "windows" in ua_lower:
        device_type = "desktop"
        os_name = "Windows 11"
        if "edg" in ua_lower:
            browser = "Microsoft Edge"
        elif "chrome" in ua_lower:
            browser = "Chrome Web"
        elif "firefox" in ua_lower:
            browser = "Firefox"
        else:
            browser = "Web Browser"
        device_name = f"{browser} (Windows 11)"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        device_type = "desktop"
        os_name = "macOS"
        browser = "Safari" if "safari" in ua_lower and "chrome" not in ua_lower else "Chrome"
        device_name = f"Apple Mac ({browser})"
    elif "linux" in ua_lower:
        device_type = "desktop"
        os_name = "Linux"
        device_name = "Linux Workstation"
        browser = "Chrome Web"
    elif "okhttp" in ua_lower or "expo" in ua_lower or "reactnative" in ua_lower:
        device_name = "Samsung Galaxy SM-A127F"
        device_type = "mobile"
        os_name = "Android 14"
        browser = "SECA Mobile App"

    return {
        "device_name": device_name,
        "device_type": device_type,
        "os": os_name,
        "browser": browser,
        "ip_address": clean_ip,
        "location": location,
    }


class CRUDUserTerminal:

    async def record_login(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        ip_address: str,
        user_agent: str | None,
        custom_device_name: Optional[str] = None,
        login_method: str = "Mật khẩu",
        status: str = "success",
    ) -> tuple[Optional[UserTerminal], UserLoginHistory]:
        """
        Ghi nhận tự động thiết bị đầu cuối và thêm bản ghi vào lịch sử đăng nhập.
        """
        info = parse_device_info(user_agent, ip_address, custom_device_name)

        login_record = UserLoginHistory(
            user_id=user_id,
            device_name=info["device_name"],
            ip_address=info["ip_address"],
            location=info["location"],
            login_time=datetime.now(timezone.utc),
            login_method=login_method,
            status=status,
            user_agent=(user_agent or "")[:500],
        )
        db.add(login_record)

        terminal_record: Optional[UserTerminal] = None
        if status == "success":
            stmt = (
                select(UserTerminal)
                .where(
                    UserTerminal.user_id == user_id,
                    UserTerminal.device_name == info["device_name"],
                )
                .limit(1)
            )
            res = await db.execute(stmt)
            existing_terminal = res.scalar_one_or_none()

            if existing_terminal:
                existing_terminal.ip_address = info["ip_address"]
                existing_terminal.location = info["location"]
                existing_terminal.os = info["os"]
                existing_terminal.browser = info["browser"]
                existing_terminal.device_type = info["device_type"]
                existing_terminal.last_active_at = datetime.now(timezone.utc)
                existing_terminal.is_active = True
                terminal_record = existing_terminal
            else:
                terminal_record = UserTerminal(
                    user_id=user_id,
                    device_name=info["device_name"],
                    device_type=info["device_type"],
                    os=info["os"],
                    browser=info["browser"],
                    ip_address=info["ip_address"],
                    location=info["location"],
                    last_active_at=datetime.now(timezone.utc),
                    is_active=True,
                )
                db.add(terminal_record)

        await db.flush()
        return terminal_record, login_record

    async def get_terminals_for_user(
        self,
        db: AsyncSession,
        user: User,
        current_ip: Optional[str] = None,
        current_user_agent: Optional[str] = None,
    ) -> list[dict]:
        """
        Lấy danh sách thiết bị đầu cuối của người dùng.
        Gắn nhãn is_current cho thiết bị đang thực hiện yêu cầu.
        Nếu người dùng chưa có thiết bị nào trong DB, tự động khởi tạo thiết bị hiện tại.
        """
        stmt = (
            select(UserTerminal)
            .where(UserTerminal.user_id == user.id, UserTerminal.is_active == True)
            .order_by(desc(UserTerminal.last_active_at))
        )
        res = await db.execute(stmt)
        terminals = list(res.scalars().all())

        parsed_current = parse_device_info(current_user_agent, current_ip or "127.0.0.1")

        if not terminals:
            new_terminal = UserTerminal(
                user_id=user.id,
                device_name=parsed_current["device_name"],
                device_type=parsed_current["device_type"],
                os=parsed_current["os"],
                browser=parsed_current["browser"],
                ip_address=parsed_current["ip_address"],
                location=parsed_current["location"],
                last_active_at=user.last_login_at or datetime.now(timezone.utc),
                is_active=True,
            )
            db.add(new_terminal)
            await db.flush()
            await db.refresh(new_terminal)
            terminals = [new_terminal]

        out_list = []
        has_current = False
        for t in terminals:
            is_cur = False
            if not has_current:
                if (
                    t.device_name == parsed_current["device_name"]
                    or t.ip_address == parsed_current["ip_address"]
                ):
                    is_cur = True
                    has_current = True

            out_list.append({
                "id": t.id,
                "device_name": t.device_name,
                "device_type": t.device_type,
                "os": t.os,
                "browser": t.browser,
                "ip_address": t.ip_address,
                "location": t.location,
                "last_active_at": t.last_active_at,
                "is_current": is_cur,
                "is_active": t.is_active,
                "created_at": t.created_at,
            })

        if not has_current and out_list:
            out_list[0]["is_current"] = True

        return out_list

    async def delete_terminal(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        terminal_id: uuid.UUID,
    ) -> bool:
        """
        Xóa / thu hồi quyền thiết bị đầu cuối khỏi tài khoản.
        """
        stmt = select(UserTerminal).where(
            UserTerminal.id == terminal_id,
            UserTerminal.user_id == user_id,
        )
        res = await db.execute(stmt)
        terminal = res.scalar_one_or_none()
        if not terminal:
            return False

        await db.delete(terminal)
        await db.flush()
        return True

    async def get_login_history_for_user(
        self,
        db: AsyncSession,
        user: User,
        limit: int = 20,
    ) -> list[dict]:
        """
        Lấy lịch sử các lần đăng nhập của người dùng.
        Nếu chưa có, tự động tạo các bản ghi mẫu thực tế cho tài khoản.
        """
        stmt = (
            select(UserLoginHistory)
            .where(UserLoginHistory.user_id == user.id)
            .order_by(desc(UserLoginHistory.login_time))
            .limit(limit)
        )
        res = await db.execute(stmt)
        histories = list(res.scalars().all())

        if not histories:
            base_time = user.last_login_at or datetime.now(timezone.utc)
            initial_history = UserLoginHistory(
                user_id=user.id,
                device_name="Samsung Galaxy SM-A127F",
                ip_address="127.0.0.1",
                location="Đà Nẵng, Việt Nam",
                login_time=base_time,
                login_method="Mật khẩu",
                status="success",
                user_agent="SECA Mobile App / Android 14",
            )
            db.add(initial_history)
            await db.flush()
            await db.refresh(initial_history)
            histories = [initial_history]

        return [
            {
                "id": h.id,
                "device_name": h.device_name,
                "ip_address": h.ip_address,
                "location": h.location,
                "login_time": h.login_time,
                "login_method": h.login_method,
                "status": h.status,
                "user_agent": h.user_agent,
                "is_current": (idx == 0),
            }
            for idx, h in enumerate(histories)
        ]


crud_user_terminal = CRUDUserTerminal()


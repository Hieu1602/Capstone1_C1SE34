"""
test_user_terminals_and_logins.py – Kiểm thử đơn vị cho chức năng Quản lý đầu cuối và Lịch sử đăng nhập.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.crud.crud_user_terminal import crud_user_terminal, parse_device_info
from app.models.user import User
from app.models.user_terminal import UserLoginHistory, UserTerminal
from app.schemas.user import UserLoginHistoryOut, UserTerminalOut


def test_parse_device_info_android():
    ua = "Mozilla/5.0 (Linux; Android 14; SM-A127F Build/UP1A.231005.007; wv) AppleWebKit/537.36"
    info = parse_device_info(ua, "192.168.1.15")
    assert "Samsung Galaxy SM-A127F" in info["device_name"]
    assert info["device_type"] == "mobile"
    assert info["os"] == "Android 14"
    assert "Đà Nẵng" in info["location"]


def test_parse_device_info_iphone():
    ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15"
    info = parse_device_info(ua, "115.79.138.90")
    assert info["device_name"] == "iPhone 15 Pro"
    assert info["device_type"] == "mobile"
    assert info["os"] == "iOS"


def test_parse_device_info_windows_chrome():
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36"
    info = parse_device_info(ua, "127.0.0.1")
    assert info["device_type"] == "desktop"
    assert "Windows 11" in info["device_name"]
    assert info["os"] == "Windows 11"


def test_parse_device_info_custom_name():
    info = parse_device_info(None, "127.0.0.1", custom_device_name="My Tablet SM-T500")
    assert info["device_name"] == "My Tablet SM-T500"


def test_user_terminal_schema_validation():
    t_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    out = UserTerminalOut(
        id=t_id,
        device_name="Samsung Galaxy SM-A127F",
        device_type="mobile",
        os="Android 14",
        browser="SECA Mobile App",
        ip_address="192.168.1.100",
        location="Đà Nẵng, Việt Nam",
        last_active_at=now,
        is_current=True,
        is_active=True,
        created_at=now,
    )
    assert out.device_name == "Samsung Galaxy SM-A127F"
    assert out.is_current is True


def test_user_login_history_schema_validation():
    h_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    out = UserLoginHistoryOut(
        id=h_id,
        device_name="Samsung Galaxy SM-A127F",
        ip_address="192.168.1.100",
        location="Đà Nẵng, Việt Nam",
        login_time=now,
        login_method="Mật khẩu",
        status="success",
        user_agent="SECA Mobile App",
        is_current=True,
    )
    assert out.status == "success"
    assert out.login_method == "Mật khẩu"


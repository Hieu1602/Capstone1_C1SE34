import asyncio
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.web_admin import notifications
from app.models.system_notification import SystemNotification
from app.models.user import User
from app.schemas.system_notification import (
    SystemNotificationCreate,
    SystemNotificationRevoke,
    SystemNotificationSchedule,
    SystemNotificationUpdate,
)


def test_system_notification_schema_validation():
    # Valid creation
    payload = SystemNotificationCreate(
        title="Thông báo bảo trì",
        body="Nội dung bảo trì hệ thống",
        type="system_maintenance",
        target_audience="all",
        status="draft",
    )
    assert payload.title == "Thông báo bảo trì"
    assert payload.type == "system_maintenance"

    # Invalid empty title
    with pytest.raises(ValidationError):
        SystemNotificationCreate(
            title="",
            body="Valid body",
        )


def test_create_and_publish_notification_flow(monkeypatch):
    fake_user = SimpleNamespace(id=uuid4(), phone="+84901234567", role="admin")
    fake_db = SimpleNamespace(
        add=lambda obj: None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [fake_user]))),
    )

    payload = SystemNotificationCreate(
        title="Cảnh báo bão",
        body="Người cao tuổi cần ở trong nhà",
        type="emergency",
        target_audience="caregivers",
        status="published",
    )

    result = asyncio.run(
        notifications.create_notification(
            payload,
            db=cast(AsyncSession, fake_db),
            current_user=cast(User, fake_user),
        )
    )

    assert result.title == "Cảnh báo bão"
    assert result.status == "published"
    assert result.published_at is not None
    assert result.delivered_count >= 1
    fake_db.flush.assert_awaited()


def test_revoke_notification_persists_reason_and_revoked_at(monkeypatch):
    notif_id = uuid4()
    notif = SystemNotification(
        id=notif_id,
        title="Thông báo cũ",
        body="Nội dung cũ",
        type="info",
        target_audience="all",
        status="published",
    )
    fake_db = SimpleNamespace(
        execute=AsyncMock(return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(first=lambda: notif))),
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )
    fake_user = SimpleNamespace(id=uuid4(), phone="+84901234567", role="admin")

    revoke_payload = SystemNotificationRevoke(revoke_reason="Thông tin đã thay đổi theo chỉ thị mới")

    result = asyncio.run(
        notifications.revoke_notification(
            notif_id,
            revoke_payload,
            db=cast(AsyncSession, fake_db),
            current_user=cast(User, fake_user),
        )
    )

    assert result.status == "revoked"
    assert result.revoked_at is not None
    assert result.revoke_reason == "Thông tin đã thay đổi theo chỉ thị mới"


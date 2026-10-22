import asyncio
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.web_admin import users
from app.models.user import User


def test_upload_my_avatar_with_base64_json():
    fake_user = SimpleNamespace(
        id=uuid.uuid4(),
        full_name="Ngô Lê Vĩnh",
        phone="+84382694409",
        role="user",
        avatar_url=None,
    )
    fake_db = SimpleNamespace(
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )

    fake_request = SimpleNamespace(
        headers={"content-type": "application/json"},
        json=AsyncMock(return_value={
            "avatar_url": "https://example.com/avatar.jpg"
        })
    )

    result = asyncio.run(
        users.upload_my_avatar(
            request=cast(Any, fake_request),
            current_user=cast(User, fake_user),
            db=cast(AsyncSession, fake_db),
        )
    )

    assert result.avatar_url == "https://example.com/avatar.jpg"
    fake_db.commit.assert_awaited_once()


def test_delete_my_avatar_resets_url():
    fake_user = SimpleNamespace(
        id=uuid.uuid4(),
        full_name="Ngô Lê Vĩnh",
        phone="+84382694409",
        role="user",
        avatar_url="/static/avatars/user_test.jpg",
    )
    fake_db = SimpleNamespace(
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )

    result = asyncio.run(
        users.delete_my_avatar(
            current_user=cast(User, fake_user),
            db=cast(AsyncSession, fake_db),
        )
    )

    assert result.avatar_url is None
    fake_db.commit.assert_awaited_once()

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.api.v1.endpoints import users
from app.schemas.user import LanguagePreferenceUpdate


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        ({"preferred_language": "en"}, "en"),
        ({"preferred_language": " VI "}, "vi"),
        ({"language": "en"}, "en"),
    ],
)
def test_language_preference_accepts_supported_values_and_legacy_alias(payload, expected):
    update = LanguagePreferenceUpdate.model_validate(payload)

    assert update.preferred_language == expected


@pytest.mark.parametrize("payload", [{}, {"preferred_language": "fr"}, {"preferred_language": 1}])
def test_language_preference_rejects_missing_or_unsupported_values(payload):
    with pytest.raises(ValidationError):
        LanguagePreferenceUpdate.model_validate(payload)


def test_update_language_persists_preference(monkeypatch):
    fake_user = SimpleNamespace()
    fake_db = object()
    fake_crud_user = SimpleNamespace(update=AsyncMock(return_value=fake_user))
    monkeypatch.setattr(users, "crud_user", fake_crud_user)

    result = asyncio.run(
        users.update_language(
            LanguagePreferenceUpdate(preferred_language="en"),
            current_user=fake_user,
            db=fake_db,
        )
    )

    assert result is fake_user
    fake_crud_user.update.assert_awaited_once_with(
        fake_db,
        db_obj=fake_user,
        obj_in={"preferred_language": "en"},
    )

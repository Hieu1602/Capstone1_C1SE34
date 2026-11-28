import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.prescription_policy import ensure_can_edit_prescriptions


@pytest.mark.parametrize("role", ["owner", "member", "caregiver", "admin"])
def test_non_doctors_cannot_edit_prescriptions(role):
    # Bị chặn ngay ở bước kiểm tra vai trò, trước khi chạm database
    with pytest.raises(HTTPException) as exc:
        asyncio.run(ensure_can_edit_prescriptions(None, SimpleNamespace(role=role, id="u1"), "x"))
    assert exc.value.status_code == 403


def test_anonymous_cannot_edit_prescriptions():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(ensure_can_edit_prescriptions(None, None, "x"))
    assert exc.value.status_code == 401

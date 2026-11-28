from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.emergency_policy import ensure_can_trigger_emergency


def test_doctor_cannot_trigger_sos():
    with pytest.raises(HTTPException) as exc:
        ensure_can_trigger_emergency(SimpleNamespace(role="doctor"))
    assert exc.value.status_code == 403


@pytest.mark.parametrize("role", ["owner", "member", "caregiver", "admin"])
def test_family_roles_can_trigger_sos(role):
    ensure_can_trigger_emergency(SimpleNamespace(role=role))

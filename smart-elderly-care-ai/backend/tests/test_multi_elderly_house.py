import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.mobile.patients import create_patient, delete_patient
from app.crud.crud_elderly import crud_elderly
from app.crud.crud_house import crud_house
from app.schemas.patient import ElderlyProfileCreate


def test_create_patient_unauthenticated():
    payload = ElderlyProfileCreate(full_name="Cụ Nguyễn Văn B")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(create_patient(payload, None, AsyncMock()))
    assert exc_info.value.status_code == 401


def test_create_patient_adds_profile_to_user_house():
    user = SimpleNamespace(id=uuid4(), role="member")
    house = SimpleNamespace(id=uuid4(), owner_id=user.id)
    payload = ElderlyProfileCreate(
        full_name="Cụ Nguyễn Văn B",
        birth_year=1945,
        gender="Nam",
        blood_type="O+",
        height_cm=165,
        weight_kg=60,
        emergency_contact_phone="0912345678"
    )
    profile_id = uuid4()
    mock_created = SimpleNamespace(
        id=profile_id,
        house_id=house.id,
        full_name=payload.full_name,
        birth_year=payload.birth_year,
        gender=payload.gender,
        avatar_url=None,
        emergency_contact_phone=payload.emergency_contact_phone,
    )

    with (
        patch.object(crud_house, "get_or_create_default_house", AsyncMock(return_value=house)),
        patch.object(crud_elderly, "create_profile", AsyncMock(return_value=mock_created)) as mock_create,
    ):
        result = asyncio.run(create_patient(payload, user, AsyncMock()))

    assert result["id"] == str(profile_id)
    assert result["full_name"] == "Cụ Nguyễn Văn B"
    assert result["name"] == "Cụ Nguyễn Văn B"
    mock_create.assert_awaited_once()


def test_delete_patient_invalid_uuid():
    user = SimpleNamespace(id=uuid4(), role="member")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(delete_patient("invalid-uuid", user, AsyncMock()))
    assert exc_info.value.status_code == 400


def test_delete_patient_not_found():
    user = SimpleNamespace(id=uuid4(), role="member")
    mock_db = AsyncMock()
    mock_db.get.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(delete_patient(str(uuid4()), user, mock_db))
    assert exc_info.value.status_code == 404


def test_delete_patient_success():
    user = SimpleNamespace(id=uuid4(), role="member")
    house = SimpleNamespace(id=uuid4(), owner_id=user.id)
    elderly_id = uuid4()
    profile = SimpleNamespace(id=elderly_id, house_id=house.id, full_name="Cụ Cần Xóa")
    mock_db = AsyncMock()
    mock_db.get.return_value = profile

    with patch.object(crud_elderly, "delete_profile", AsyncMock(return_value=True)) as mock_delete:
        result = asyncio.run(delete_patient(str(elderly_id), user, mock_db))

    assert result["success"] is True
    assert result["deleted_id"] == str(elderly_id)
    mock_delete.assert_awaited_once_with(mock_db, profile_id=elderly_id)


def test_crud_elderly_delete_profile_logic():
    mock_db = AsyncMock()
    mock_profile = SimpleNamespace(id=uuid4(), house_id=uuid4())
    mock_db.get.return_value = mock_profile

    success = asyncio.run(crud_elderly.delete_profile(mock_db, mock_profile.id))
    assert success is True
    assert mock_db.execute.awaited
    assert mock_db.delete.awaited
    assert mock_db.commit.awaited

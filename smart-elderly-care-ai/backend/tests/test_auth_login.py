from app.crud.crud_user import normalize_phone


def test_normalize_phone_supports_local_and_international_formats():
    assert normalize_phone("0901234567") == "+84901234567"
    assert normalize_phone("+84901234567") == "+84901234567"
    assert normalize_phone("0841234567") == "+841234567"
    assert normalize_phone(" 0901 234 567 ") == "+84901234567"

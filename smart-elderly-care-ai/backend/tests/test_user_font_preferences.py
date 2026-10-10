from app.schemas.user import UserUpdate


def test_user_font_preferences_are_supported():
    payload = UserUpdate.model_validate({
        "font_size_mode": "custom",
        "custom_font_scale": 3,
    })

    assert payload.font_size_mode == "custom"
    assert payload.custom_font_scale == 3

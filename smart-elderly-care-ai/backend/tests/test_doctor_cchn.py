import pytest
from app.services.doctor.verification import (
    normalize_vietnamese_name,
    is_name_matched,
    is_license_active,
    verify_doctor_cchn,
)

def test_normalize_vietnamese_name():
    assert normalize_vietnamese_name("BS. Trần Văn Minh") == "trần văn minh"
    assert normalize_vietnamese_name("Bác sĩ Nguyễn Văn A") == "nguyễn văn a"
    assert normalize_vietnamese_name("ThS. BS. Lê Thị B") == "lê thị b"
    assert normalize_vietnamese_name("Dr. Tran Van C") == "tran van c"

def test_is_license_active():
    assert is_license_active("Đang hoạt động")
    assert is_license_active("Hoạt động")
    assert not is_license_active("Đã đình chỉ hoạt động")
    assert not is_license_active("Bị thu hồi chứng chỉ")

@pytest.mark.anyio
async def test_verify_doctor_cchn_empty_inputs():
    res1 = await verify_doctor_cchn("")
    assert res1["valid"] is False
    assert "trống" in res1["message"]

@pytest.mark.anyio
async def test_verify_doctor_cchn_capstone_flexible_name():
    # Trong môi trường Capstone, không ép buộc trùng tên đăng ký với chủ sở hữu CCHN
    res = await verify_doctor_cchn("000996/HCM-CCHN", "Sinh Viên Báo Cáo Capstone")
    assert res["valid"] is True
    assert res["cchn"] == "000996/HCM-CCHN"
    assert res["status"] == "Hoạt động"
    assert "Sở Y tế" in res["source"]

@pytest.mark.anyio
async def test_verify_doctor_cchn_non_existent():
    # CCHN không tồn tại trên hệ thống
    res = await verify_doctor_cchn("999999/KHONG-TON-TAI", "Test User")
    assert res["valid"] is False
    assert "không tìm thấy" in res["message"]

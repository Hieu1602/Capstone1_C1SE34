"""
house.py – Pydantic v2 Schemas cho Căn nhà (House) và Phân quyền Thành viên (HouseMember RBAC).
Vị trí: backend/app/schemas/house.py
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ==============================================================================
# SCHEMAS CĂN NHÀ (HOUSE)
# ==============================================================================

class HouseBase(BaseModel):
    name: str = Field(default="Nhà của tôi", max_length=150, description="Tên định danh căn nhà")
    address: Optional[str] = Field(default=None, max_length=300, description="Địa chỉ lắp đặt")
    current_mode: str = Field(default="HOME", description="Chế độ an ninh: HOME, AWAY, DISARM, ALARM, PRIVACY")


class HouseCreate(HouseBase):
    pass


class HouseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    address: Optional[str] = Field(default=None, max_length=300)
    current_mode: Optional[str] = None


class HouseModeUpdate(BaseModel):
    mode: str = Field(..., description="Chế độ nhà cần chuyển: HOME, AWAY, DISARM, ALARM, PRIVACY")


class HouseOut(HouseBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==============================================================================
# SCHEMAS PHÂN QUYỀN THÀNH VIÊN GIA ĐÌNH & BÁC SĨ (HOUSE MEMBER RBAC)
# ==============================================================================

class HouseMemberBase(BaseModel):
    role_in_house: str = Field(default="MEMBER", description="Vai trò: OWNER, MEMBER, CAREGIVER, DOCTOR, RELATIVE")
    permissions: str = Field(default="VIEW", description="Nhóm quyền: ADMIN, EDIT, VIEW, OPERATOR")
    
    # Phân quyền chi tiết theo sơ đồ hệ thống:
    can_view_health: bool = Field(default=True, description="Theo dõi sức khỏe (Ủy quyền)")
    can_view_camera: bool = Field(default=True, description="Giám sát camera (Được cấp quyền)")
    can_handle_emergency: bool = Field(default=True, description="Xử lý khẩn cấp (Nhận SOS, còi báo)")
    can_manage_devices: bool = Field(default=False, description="Cấu hình thiết bị & Ngưỡng (Chủ sở hữu)")
    can_manage_records: bool = Field(default=False, description="Quản lý hồ sơ bệnh án")


class HouseMemberCreate(BaseModel):
    phone_number: str = Field(..., description="Số điện thoại của thành viên muốn mời/gán quyền")
    full_name: Optional[str] = Field(default=None, description="Họ và tên nếu chưa đăng ký")
    role_in_house: Optional[str] = Field(default="MEMBER", description="Vai trò trong gia đình")
    role: Optional[str] = Field(default=None, description="Vai trò tài khoản nếu đăng ký mới: user / caregiver / doctor")
    permissions: Optional[str] = Field(default="VIEW")
    
    can_view_health: bool = Field(default=True, description="Quyền xem chỉ số sức khoẻ")
    can_view_camera: bool = Field(default=True, description="Quyền xem camera giám sát")
    can_handle_emergency: bool = Field(default=True, description="Quyền xử lý tình huống khẩn cấp")
    can_manage_devices: bool = Field(default=False, description="Quyền cấu hình thiết bị & ngưỡng")
    can_manage_records: bool = Field(default=False, description="Quyền chỉnh sửa hồ sơ y tế")


class HouseMemberPermissionsUpdate(BaseModel):
    """Cập nhật quyền hạn cho thành viên trong gia đình do Người sở hữu thực hiện."""
    role_in_house: Optional[str] = None
    permissions: Optional[str] = None
    can_view_health: Optional[bool] = None
    can_view_camera: Optional[bool] = None
    can_handle_emergency: Optional[bool] = None
    can_manage_devices: Optional[bool] = None
    can_manage_records: Optional[bool] = None


class HouseMemberOut(BaseModel):
    id: UUID
    house_id: UUID
    user_id: UUID
    full_name: str
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    user_role: str = "user"
    role: Optional[str] = None
    role_in_house: str = "MEMBER"
    permissions: str = "VIEW"
    
    can_view_health: bool = True
    can_view_camera: bool = True
    can_handle_emergency: bool = True
    can_manage_devices: bool = False
    can_manage_records: bool = False
    
    is_owner: bool = False
    joined_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserHousePermissionsOut(BaseModel):
    """Quyền hạn thực tế của người dùng hiện tại đối với căn nhà."""
    house_id: UUID
    user_id: UUID
    is_owner: bool
    role_in_house: str
    can_view_health: bool
    can_view_camera: bool
    can_handle_emergency: bool
    can_manage_devices: bool
    can_manage_records: bool

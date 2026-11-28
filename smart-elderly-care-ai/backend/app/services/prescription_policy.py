"""
prescription_policy.py – Chỉ BÁC SĨ đang phụ trách bệnh nhân mới được thêm / sửa / xóa đơn thuốc.
Chủ nhà, người nhà, người chăm sóc chỉ được xem (đơn thuốc là chỉ định y khoa).
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.elderly_profile import ElderlyProfile
from app.models.house import HouseMember

FAMILY_VIEW_ONLY_DETAIL = "Chỉ bác sĩ phụ trách mới được thêm, sửa hoặc xóa đơn thuốc. Người nhà chỉ được xem."
NOT_ASSIGNED_DETAIL = "Bạn không phải bác sĩ phụ trách bệnh nhân này nên không thể thay đổi đơn thuốc."


def is_prescriber_role(role) -> bool:
    return str(role or "").lower() == "doctor"


async def ensure_can_edit_prescriptions(db: AsyncSession, user, elderly_id: str) -> uuid.UUID:
    """Trả về UUID bệnh nhân nếu người dùng là bác sĩ thuộc nhà của bệnh nhân; ngược lại 403/404."""
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chưa xác thực.")
    if not is_prescriber_role(getattr(user, "role", None)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=FAMILY_VIEW_ONLY_DETAIL)
    try:
        patient_uuid = uuid.UUID(str(elderly_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID bệnh nhân không hợp lệ.")
    profile = await db.get(ElderlyProfile, patient_uuid)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người cao tuổi.")
    member = (
        await db.execute(
            select(HouseMember.id).where(
                HouseMember.house_id == profile.house_id,
                HouseMember.user_id == user.id,
                HouseMember.status == "ACTIVE",
            )
        )
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=NOT_ASSIGNED_DETAIL)
    return patient_uuid


async def family_added_map(db: AsyncSession, prescriptions) -> dict:
    """
    {rx_id: True} cho các đơn được tạo bởi tài khoản KHÔNG phải bác sĩ (dữ liệu cũ, trước khi khóa quyền).
    Đơn không có doctor_id (dữ liệu demo) coi như của bác sĩ.
    """
    from app.models.user import User

    creator_ids = {rx.doctor_id for rx in prescriptions if getattr(rx, "doctor_id", None)}
    if not creator_ids:
        return {}
    rows = (await db.execute(select(User.id, User.role).where(User.id.in_(list(creator_ids))))).all()
    roles = {uid: role for uid, role in rows}
    return {
        str(rx.id): True
        for rx in prescriptions
        if getattr(rx, "doctor_id", None) in roles and not is_prescriber_role(roles[rx.doctor_id])
    }

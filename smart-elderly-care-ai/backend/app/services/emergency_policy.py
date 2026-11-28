"""
emergency_policy.py – Quy định ai được kích hoạt SOS / gọi cấp cứu.
Bác sĩ quản lý rất nhiều bệnh nhân nên KHÔNG được gọi SOS hay leo thang gọi cấp cứu thay gia đình;
việc gọi cấp cứu thuộc về người nhà / người chăm sóc tại chỗ (và luồng tự động phía server).
"""

from fastapi import HTTPException, status

DOCTOR_SOS_FORBIDDEN_DETAIL = (
    "Tài khoản bác sĩ không được kích hoạt SOS hay gọi cấp cứu. "
    "Việc gọi cấp cứu do người nhà/người chăm sóc tại chỗ thực hiện."
)


def is_doctor(user) -> bool:
    return bool(user) and str(getattr(user, "role", "") or "").lower() == "doctor"


def ensure_can_trigger_emergency(user) -> None:
    if is_doctor(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=DOCTOR_SOS_FORBIDDEN_DETAIL)

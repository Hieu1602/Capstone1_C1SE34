"""
doctor package
Tập hợp các dịch vụ và nghiệp vụ liên quan đến Bác sĩ (Doctor domain).
"""

from app.services.doctor.verification import (
    is_license_active,
    is_name_matched,
    normalize_vietnamese_name,
    verify_doctor_cchn,
)

__all__ = [
    "verify_doctor_cchn",
    "normalize_vietnamese_name",
    "is_name_matched",
    "is_license_active",
]

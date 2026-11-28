"""
vital_thresholds.py – Tiện ích dùng chung cho ngưỡng cảnh báo sinh hiệu (Nhịp tim, SpO2).
Hệ thống chỉ theo dõi Nhịp tim, SpO2, Bước chân, Tư thế/Âm thanh – không dùng Huyết áp / Nhiệt độ.

Nguồn dữ liệu duy nhất (source of truth) là bản ghi DeviceConfig trong PostgreSQL. Mọi nội dung thông báo
và payload WebSocket gửi cho Bác sĩ / Người nhà phải được dựng từ `serialize_thresholds(cfg)` SAU KHI đã
`commit()` + `refresh()`, để tránh dùng giá trị cũ hoặc gán nhầm cặp min/max.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

# (low_field, high_field, tên hiển thị) – dùng để kiểm tra min < max
THRESHOLD_PAIRS = (
    ("hr_threshold_low", "hr_threshold_high", "Nhịp tim"),
)

THRESHOLD_FIELDS = (
    "hr_threshold_low",
    "hr_threshold_high",
    "spo2_threshold_low",
)

DEFAULT_THRESHOLDS: Dict[str, Any] = {
    "hr_threshold_low": 50,
    "hr_threshold_high": 120,
    "spo2_threshold_low": 90,
}


def serialize_thresholds(cfg: Any) -> Dict[str, Any]:
    """Đọc toàn bộ ngưỡng hiện hành từ DeviceConfig (đã refresh) thành dict phẳng."""
    out: Dict[str, Any] = {}
    for field in THRESHOLD_FIELDS:
        value = getattr(cfg, field, None) if cfg is not None else None
        out[field] = value if value is not None else DEFAULT_THRESHOLDS[field]
    return out


def apply_thresholds(cfg: Any, updates: Dict[str, Any]) -> None:
    """Ghi các ngưỡng có trong `updates` (bỏ qua None) vào DeviceConfig."""
    for field in THRESHOLD_FIELDS:
        value = updates.get(field)
        if value is not None:
            setattr(cfg, field, value)


def validate_threshold_pairs(values: Dict[str, Any]) -> Optional[str]:
    """Trả về thông báo lỗi nếu có cặp ngưỡng min >= max, ngược lại trả về None."""
    for low_f, high_f, label in THRESHOLD_PAIRS:
        low, high = values.get(low_f), values.get(high_f)
        if low is not None and high is not None and low >= high:
            return f"Ngưỡng {label} không hợp lệ: giá trị thấp ({low}) phải nhỏ hơn giá trị cao ({high})."
    return None


def format_thresholds_summary(t: Dict[str, Any]) -> str:
    """Chuỗi mô tả đầy đủ các ngưỡng, map đúng từng cặp min - max."""
    return f"Nhịp tim: {t['hr_threshold_low']} - {t['hr_threshold_high']} bpm; SpO2 tối thiểu: {t['spo2_threshold_low']}%"

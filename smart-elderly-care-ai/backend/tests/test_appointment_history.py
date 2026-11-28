from datetime import datetime, timezone
from types import SimpleNamespace

from app.services import appointment_history as h


def _apt(**kw):
    base = dict(
        scheduled_at=datetime(2026, 12, 1, 2, 0, tzinfo=timezone.utc),
        duration_minutes=30, visit_type="CLINIC", location="PK", exam_type=None, instructions=None, status="UPCOMING",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_reschedule_detected_with_old_and_new_time():
    before = h.snapshot(_apt())
    changes = h.diff(before, h.snapshot(_apt(scheduled_at=datetime(2026, 12, 2, 3, 0, tzinfo=timezone.utc))))
    assert list(changes) == ["scheduled_at"]
    assert changes["scheduled_at"][0].startswith("2026-12-01")
    assert h.resolve_update_action(changes) == "RESCHEDULED"


def test_non_time_edit_is_plain_update():
    changes = h.diff(h.snapshot(_apt()), h.snapshot(_apt(location="Tại nhà")))
    assert changes == {"location": ["PK", "Tại nhà"]}
    assert h.resolve_update_action(changes) == "UPDATED"


def test_busy_slot_kind_pending_only_for_unconfirmed_family_requests():
    from app.crud.crud_appointment import classify_busy_slot

    doctor, family = "doc-1", "user-9"
    assert classify_busy_slot("UPCOMING", family, doctor) == "PENDING"  # gia đình yêu cầu, chờ BS
    assert classify_busy_slot("CONFIRMED", family, doctor) == "BUSY"  # BS đã xác nhận
    assert classify_busy_slot("UPCOMING", doctor, doctor) == "BUSY"  # BS tự tạo / dời lịch
    assert classify_busy_slot("UPCOMING", None, doctor) == "BUSY"

"""
vitals package – Xử lý luồng sinh hiệu, máy trạng thái phát hiện loạn nhịp & cửa sổ trượt.
"""

from app.services.vitals.vital_state_machine import VitalStateMachine, vital_state_machine

__all__ = ["VitalStateMachine", "vital_state_machine"]

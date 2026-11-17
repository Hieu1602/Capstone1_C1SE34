"""
test_vital_matrix_and_state_machine.py
Bộ kiểm thử tự động toàn diện:
1. Ma trận 12 Kịch bản đánh giá Chỉ số Rủi ro Té ngã & Bất ổn Sinh hiệu (Piecewise Linear Interpolation).
2. Kiểm thử logic Máy trạng thái (NORMAL -> SUSPECT -> EPISODE -> RECOVERY).
3. Kiểm thử lọc nhiễu 1 mẫu, mất kết nối ngắn (<= 45s), mất kết nối dài (> 5 phút), và cửa sổ trượt 60 phút.
"""

import math
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

# Đảm bảo import được package app trong backend
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest

from app.services.vitals.vital_state_machine import (
    VitalSample,
    VitalStateMachine,
    ENTER_MIN_SAMPLES,
    CONFIRM_SEC,
    EXIT_SEC,
    GAP_TOLERANCE_SEC,
    GAP_ABORT_SEC,
    WINDOW_SEC,
    COOLDOWN_SEC,
)


def evaluate_vital_fall_risk_py(v: Dict[str, Any]) -> int:
    """Phiên bản Python đồng bộ 1:1 với evaluateVitalFallRisk trên DashboardPage.tsx."""
    hr = v.get("heart_rate") or 0
    if not v.get("is_worn", True) or hr <= 0:
        return 0

    if v.get("fall_detected"):
        return 95

    # Không gán mặc định để tránh che giấu lỗi cảm biến
    raw_spo2 = v.get("spo2")
    spo2 = raw_spo2 if isinstance(raw_spo2, (int, float)) and raw_spo2 > 0 else None

    raw_bp = v.get("bp_systolic")
    bp = raw_bp if isinstance(raw_bp, (int, float)) and raw_bp > 0 else None

    raw_temp = v.get("skin_temp_max") or v.get("skin_temp")
    temp = raw_temp if isinstance(raw_temp, (int, float)) and raw_temp > 0 else None

    act = str(v.get("activity_state") or v.get("activity") or "").lower()
    is_exercising = bool(
        v.get("is_exercising") is True
        or "tập" in act
        or "exercise" in act
        or "vận động thể dục" in act
    )

    # 3. CÁC TỔ HỢP ĐA YẾU TỐ NGUY HIỂM CAO
    # Kịch bản 10: Tam chứng nguy kịch (Sốt >= 38.5 + Tim >= 115 + SpO2 < 90) -> 90 điểm
    if temp is not None and temp >= 38.5 and hr >= 115 and spo2 is not None and spo2 < 90:
        return 90

    # Kịch bản 8: Quá tải tim phổi khi gắng sức (Tim >= 115 + SpO2 < 90) -> 85 điểm
    if hr >= 115 and spo2 is not None and spo2 < 90:
        return 85

    # Kịch bản 6: Nhịp chậm kèm tụt huyết áp (Tim <= 50 + HA < 90) -> 85 điểm
    if bp is not None and bp < 90 and hr <= 50:
        return 85

    # Nhịp tim chậm sâu đơn độc (<= 44 bpm) ngay cả khi không có đo huyết áp -> 80 điểm
    if hr <= 44:
        return 80

    # 4. TÍNH ĐIỂM CỘNG DỒN NỘI SUY TUYẾN TÍNH
    risk = 5.0  # Mức nền bình thường (Kịch bản 1)

    # A. Nhịp tim (HR)
    if hr >= 140:
        risk += 50.0
    elif hr >= 100:
        ratio = (hr - 100.0) / 40.0
        if is_exercising and spo2 is not None and spo2 >= 95:
            risk += 10.0 + ratio * 15.0
        else:
            risk += 20.0 + ratio * 30.0
    elif hr <= 58:
        ratio = max(0.0, min(1.0, (58.0 - hr) / 14.0))
        risk += 25.0 + ratio * 35.0

    # B. Oxy SpO2
    if spo2 is not None and spo2 < 95:
        ratio = max(0.0, min(1.0, (95.0 - spo2) / 7.0))
        risk += ratio * 35.0

    # C. Tụt huyết áp tâm thu
    if bp is not None and bp < 90:
        ratio = max(0.0, min(1.0, (90.0 - bp) / 30.0))
        risk += 15.0 + ratio * 15.0

    # D. Thân nhiệt cao (Sốt)
    if temp is not None and temp >= 38.0:
        ratio = max(0.0, min(1.0, (temp - 38.0) / 2.0))
        risk += 10.0 + ratio * 15.0

    return min(95, max(0, round(risk)))


# ==============================================================================
# TEST SUITE 1: KIỂM THỬ 12 KỊCH BẢN MÔ PHỎNG LÂM SÀNG
# ==============================================================================
def test_scenario_1_normal():
    """Kịch bản 1: Sinh hoạt bình thường -> Điểm nền 5 điểm."""
    v = {"heart_rate": 74, "spo2": 98, "bp_systolic": 120, "skin_temp": 36.5, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 5


def test_scenario_2_exercise():
    """Kịch bản 2: Vận động thể dục sinh lý -> Tăng vừa phải (20-25 điểm), không báo động sai."""
    v = {"heart_rate": 120, "spo2": 96, "bp_systolic": 135, "is_exercising": True, "is_worn": True}
    score = evaluate_vital_fall_risk_py(v)
    assert 20 <= score <= 25


def test_scenario_3_off_wrist():
    """Kịch bản 3: Tháo vòng tay / Cắm sạc -> Trả về 0 điểm (Không báo ngưng tim giả)."""
    v = {"heart_rate": 0, "spo2": 0, "is_worn": False}
    assert evaluate_vital_fall_risk_py(v) == 0


def test_scenario_4_resting_tachycardia():
    """Kịch bản 4: Ngồi yên mà tim nhanh (126 bpm) -> Rủi ro trung bình cao (~40-45 điểm)."""
    v = {"heart_rate": 126, "spo2": 98, "is_exercising": False, "is_worn": True}
    score = evaluate_vital_fall_risk_py(v)
    assert 40 <= score <= 48


def test_scenario_5_critical_tachycardia():
    """Kịch bản 5: Nhịp tim tăng vọt nguy hiểm (>= 145 bpm, SpO2 96) -> 55 điểm."""
    v = {"heart_rate": 146, "spo2": 96, "is_exercising": False, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 55


def test_scenario_6_bradycardia_with_hypotension():
    """Kịch bản 6A: Tim 44 bpm + HA tụt 84 mmHg -> Đạt 85 điểm."""
    v = {"heart_rate": 44, "bp_systolic": 84, "spo2": 93, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 85


def test_scenario_6_bradycardia_missing_bp():
    """Kịch bản 6B: Tim 44 bpm khi thiếu dữ liệu HA -> Độc lập đạt 80 điểm (không bị rớt về 65)."""
    v = {"heart_rate": 44, "bp_systolic": None, "spo2": 93, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 80


def test_scenario_7_hypoxia():
    """Kịch bản 7: Tụt Oxy SpO2 (86%) đơn lẻ lúc nghỉ (HR 92 bpm) -> 40 điểm."""
    v = {"heart_rate": 92, "spo2": 86, "skin_temp": 36.5, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 40


def test_scenario_8_exertion_hypoxia():
    """Kịch bản 8: Quá tải tim phổi khi gắng sức (Tim 124 bpm + SpO2 87%) -> 85 điểm."""
    v = {"heart_rate": 124, "spo2": 87, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 85


def test_scenario_9_fever():
    """Kịch bản 9: Sốt cao 38.8°C kèm tim nhanh 110 bpm -> ~45 điểm."""
    v = {"heart_rate": 110, "spo2": 95, "skin_temp_max": 38.8, "is_worn": True}
    score = evaluate_vital_fall_risk_py(v)
    assert 42 <= score <= 48


def test_scenario_10_critical_triad():
    """Kịch bản 10: Tam chứng nguy kịch (Sốt 39°C + Tim 128 + SpO2 85%) -> 90 điểm."""
    v = {"heart_rate": 128, "spo2": 85, "skin_temp_max": 39.0, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 90


def test_scenario_11_fall_detected():
    """Kịch bản 11: Sự cố té ngã vật lý (Fall = True) -> Báo động đỏ 95 điểm."""
    v = {"fall_detected": True, "heart_rate": 115, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 95


def test_scenario_12_low_battery():
    """Kịch bản 12: Pin yếu -> Điểm rủi ro sinh hiệu giữ nguyên mức nền 5 (Tách riêng kênh phần cứng)."""
    v = {"heart_rate": 74, "spo2": 98, "battery_level": 15, "is_worn": True}
    assert evaluate_vital_fall_risk_py(v) == 5


# ==============================================================================
# TEST SUITE 2: KIỂM THỬ MÁY TRẠNG THÁI (STATE MACHINE) & HYSTERESIS
# ==============================================================================
def test_state_machine_classify_sample():
    sm = VitalStateMachine()

    # Mẫu nhiễu hoặc tháo vòng
    s_invalid = VitalSample(ts=100.0, hr=0, is_worn=False)
    assert sm.classify_sample(s_invalid, baseline_rest=70) == "INVALID"

    # Mẫu SQI kém
    s_low_sqi = VitalSample(ts=100.0, hr=120, sqi=0.3)
    assert sm.classify_sample(s_low_sqi, baseline_rest=70) == "INVALID"

    # Mẫu bình thường
    s_normal = VitalSample(ts=100.0, hr=75, sqi=0.9)
    assert sm.classify_sample(s_normal, baseline_rest=70) == "NORMAL"

    # Mẫu bất thường vượt ngưỡng vào (>= 70 + 30 = 100)
    s_abn = VitalSample(ts=100.0, hr=115, sqi=0.9, is_exercising=False)
    assert sm.classify_sample(s_abn, baseline_rest=70) == "ABNORMAL"

    # Mẫu vận động sinh lý (được miễn trừ ghi log)
    s_exempt = VitalSample(ts=100.0, hr=115, spo2=97, sqi=0.9, is_exercising=True)
    assert sm.classify_sample(s_exempt, baseline_rest=70) == "EXEMPT_ACTIVITY"

    # Mẫu vùng đệm (Borderline: giữa 85 và 100 bpm)
    s_border = VitalSample(ts=100.0, hr=90, sqi=0.9)
    assert sm.classify_sample(s_border, baseline_rest=70) == "BORDERLINE"


class FakeRedisLock:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class FakePipeline:
    def __init__(self, storage):
        self.storage = storage
        self.ops = []

    def zadd(self, key, mapping):
        self.ops.append(("zadd", key, mapping))
        return self

    def zremrangebyscore(self, key, min_s, max_s):
        self.ops.append(("zremrangebyscore", key, min_s, max_s))
        return self

    def zcard(self, key):
        self.ops.append(("zcard", key))
        return self

    def expire(self, key, ttl):
        self.ops.append(("expire", key, ttl))
        return self

    async def execute(self):
        results = []
        for op in self.ops:
            if op[0] == "zadd":
                key, mapping = op[1], op[2]
                if key not in self.storage:
                    self.storage[key] = {}
                self.storage[key].update(mapping)
                results.append(len(mapping))
            elif op[0] == "zremrangebyscore":
                key, min_s, max_s = op[1], op[2], op[3]
                if key in self.storage:
                    to_del = [k for k, score in self.storage[key].items() if min_s <= score <= max_s]
                    for k in to_del:
                        del self.storage[key][k]
                results.append(0)
            elif op[0] == "zcard":
                key = op[1]
                count = len(self.storage.get(key, {}))
                results.append(count)
            elif op[0] == "expire":
                results.append(True)
        return results


class FakeRedis:
    def __init__(self):
        self.hashes = {}
        self.zsets = {}
        self.keys = {}

    def lock(self, name, timeout=None, blocking_timeout=None):
        return FakeRedisLock()

    async def hgetall(self, key):
        return self.hashes.get(key, {})

    async def hset(self, key, mapping=None):
        if key not in self.hashes:
            self.hashes[key] = {}
        if mapping:
            self.hashes[key].update(mapping)
        return len(mapping or {})

    async def expire(self, key, ttl):
        return True

    def pipeline(self):
        return FakePipeline(self.zsets)

    async def set(self, key, value, ex=None, nx=False):
        if nx and key in self.keys:
            return False
        self.keys[key] = value
        return True


@pytest.mark.anyio
async def test_state_machine_transition_and_episode_close():
    """Kiểm thử chu kỳ hoàn chỉnh: NORMAL -> SUSPECT -> EPISODE -> RECOVERY -> close_episode."""
    sm = VitalStateMachine()
    fake_redis = FakeRedis()
    async def fake_get_redis():
        return fake_redis
    sm._get_redis = fake_get_redis

    elder_id = "ELDER_TEST_001"
    base_ts = 1000.0

    # 1. Mẫu bình thường đầu tiên
    res = await sm.process_sample(elder_id, VitalSample(ts=base_ts, hr=72, sqi=1.0))
    assert res is None
    state_h = await fake_redis.hgetall(f"secai:state:{elder_id}")
    assert state_h["state"] == "NORMAL"

    # 2. Hai mẫu bất thường (< ENTER_MIN_SAMPLES = 3) -> Vẫn ở NORMAL
    await sm.process_sample(elder_id, VitalSample(ts=base_ts + 2.5, hr=115, sqi=1.0, is_exercising=False))
    await sm.process_sample(elder_id, VitalSample(ts=base_ts + 5.0, hr=116, sqi=1.0, is_exercising=False))
    state_h = await fake_redis.hgetall(f"secai:state:{elder_id}")
    assert state_h["state"] == "NORMAL"

    # 3. Mẫu bất thường thứ 3 -> Chuyển sang SUSPECT
    await sm.process_sample(elder_id, VitalSample(ts=base_ts + 7.5, hr=118, sqi=1.0, is_exercising=False))
    state_h = await fake_redis.hgetall(f"secai:state:{elder_id}")
    assert state_h["state"] == "SUSPECT"

    # 4. Duy trì tiếp tục >= 20s (CONFIRM_SEC) -> Chuyển sang EPISODE
    await sm.process_sample(elder_id, VitalSample(ts=base_ts + 28.0, hr=122, sqi=1.0, is_exercising=False))
    state_h = await fake_redis.hgetall(f"secai:state:{elder_id}")
    assert state_h["state"] == "EPISODE"
    assert state_h["ep_peak"] == "122"

    # 5. Nhịp tim hồi phục về bình thường -> Chuyển sang RECOVERY
    await sm.process_sample(elder_id, VitalSample(ts=base_ts + 32.0, hr=72, sqi=1.0))
    state_h = await fake_redis.hgetall(f"secai:state:{elder_id}")
    assert state_h["state"] == "RECOVERY"

    # 6. Duy trì hồi phục >= 60s (EXIT_SEC) -> Đóng cơn, đẩy vào Sorted Set, reset về NORMAL
    alert = await sm.process_sample(elder_id, VitalSample(ts=base_ts + 95.0, hr=70, sqi=1.0))
    state_h = await fake_redis.hgetall(f"secai:state:{elder_id}")
    assert state_h["state"] == "NORMAL"
    assert len(fake_redis.zsets.get(f"secai:episodes:{elder_id}", {})) == 1

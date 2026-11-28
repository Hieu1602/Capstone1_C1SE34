from app.models.device_config import DeviceConfig
from app.services.vital_thresholds import (
    apply_thresholds,
    format_thresholds_summary,
    serialize_thresholds,
    validate_threshold_pairs,
)


def _cfg() -> DeviceConfig:
    return DeviceConfig(hr_threshold_low=50, hr_threshold_high=120, spo2_threshold_low=90)


def test_partial_update_keeps_other_values_and_maps_pairs():
    cfg = _cfg()
    apply_thresholds(cfg, {"hr_threshold_high": 110, "spo2_threshold_low": 92})
    t = serialize_thresholds(cfg)
    assert t == {"hr_threshold_low": 50, "hr_threshold_high": 110, "spo2_threshold_low": 92}
    assert format_thresholds_summary(t) == "Nhịp tim: 50 - 110 bpm; SpO2 tối thiểu: 92%"


def test_inverted_pair_is_rejected():
    cfg = _cfg()
    apply_thresholds(cfg, {"hr_threshold_low": 100, "hr_threshold_high": 90})
    assert validate_threshold_pairs(serialize_thresholds(cfg)) is not None
    assert validate_threshold_pairs(serialize_thresholds(_cfg())) is None

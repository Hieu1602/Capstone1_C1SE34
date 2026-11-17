"""
vital_state_machine.py – Máy trạng thái theo dõi sinh hiệu, phát hiện loạn nhịp & cửa sổ trượt (Redis).
Thiết kế theo kiến trúc 4 tầng chuẩn y khoa:
- Tầng 1: Lọc nhiễu chất lượng tín hiệu (SQI, is_worn, HR > 0).
- Tầng 2: Xác thực thời gian & Hysteresis (SUSPECT >= 20s -> EPISODE; về baseline >= 60s mới đóng cơn).
- Tầng 3: Ngữ cảnh vận động (Thiếu cờ is_exercising = không miễn trừ; nhịp tăng tương xứng vận động).
- Tầng 4: Cửa sổ trượt 60 phút (Redis Sorted Set) gom đếm cơn tái diễn (PAF), nâng cấp cảnh báo có cooldown.
"""

import json
import logging
import time
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

from redis.asyncio import Redis

from app.core.database import get_redis

logger = logging.getLogger(__name__)

# ==============================================================================
# 1. HẰNG SỐ CẤU HÌNH THUẬT TOÁN (CONFIGURABLE HYPERPARAMETERS)
# ==============================================================================
ENTER_MIN_SAMPLES = 3        # >= 3 mẫu liên tiếp bất thường (~8-10s) mới vào SUSPECT
CONFIRM_SEC = 20             # SUSPECT kéo dài >= 20s với SQI tốt -> EPISODE
EXIT_SEC = 60                # Về gần baseline >= 60s mới kết thúc cơn (hysteresis)
GAP_TOLERANCE_SEC = 45       # Mất dữ liệu Bluetooth <= 45s: Giữ nguyên trạng thái cơn
GAP_ABORT_SEC = 300          # Mất dữ liệu > 5 phút: Đóng cơn, gắn cờ data_gap (không tính cơn hoàn chỉnh)
WINDOW_SEC = 3600            # Cửa sổ trượt 60 phút theo dõi cơn tái diễn
COOLDOWN_SEC = 900           # Không lặp lại cùng mức cảnh báo trong 15 phút (tránh spam)
ENTER_DELTA = 30             # Vào cơn: HR >= baseline_rest + 30
EXIT_DELTA = 15              # Thoát cơn: HR <= baseline_rest + 15 (thấp hơn ngưỡng vào = hysteresis)
ABS_HIGH = 140               # Ngưỡng nhịp tim cao tuyệt đối (bpm)
ABS_LOW = 45                 # Ngưỡng nhịp tim chậm nguy hiểm (bpm)
SQI_MIN = 0.5                # Ngưỡng chất lượng tín hiệu tối thiểu (0.0 -> 1.0)
SUSTAINED_EPISODE_SEC = 600  # Cơn đơn lẻ kéo dài >= 10 phút ngồi yên -> Báo động ngay


@dataclass
class VitalSample:
    ts: float                      # Timestamp tính bằng giây (time.time())
    hr: Optional[int]              # Nhịp tim (bpm)
    spo2: Optional[int] = None     # SpO2 (%)
    bp_sys: Optional[int] = None   # Huyết áp tâm thu (mmHg)
    skin_temp: Optional[float] = None # Thân nhiệt (°C)
    is_worn: bool = True           # Có đang đeo trên tay hay không
    sqi: float = 1.0               # Signal Quality Index (1.0 = hoàn hảo, < 0.5 = nhiễu chuyển động)
    is_exercising: Optional[bool] = None # Cờ vận động thể chất từ thiết bị
    activity_state: str = ""       # Chuỗi trạng thái vận động


@dataclass
class EpisodeSummary:
    elder_id: str
    start_ts: float
    end_ts: float
    duration_sec: float
    peak_hr: int
    min_spo2: Optional[int]
    mostly_resting: bool
    multi_vital_abnormal: bool
    close_reason: str              # "recovered" | "data_gap" | "force_abort"


class VitalStateMachine:
    """
    Quản lý máy trạng thái sinh hiệu & cửa sổ trượt phân tích loạn nhịp theo từng cụ già.
    Trạng thái: NORMAL -> SUSPECT -> EPISODE -> RECOVERY
    Mỗi cụ được xử lý tuần tự thông qua Redis Lock để chống race condition.
    """

    def __init__(self):
        self.default_baseline_hr = 72

    async def _get_redis(self) -> Redis:
        return await get_redis()

    # ==========================================================================
    # 2. HÀM PHÂN LOẠI MẪU (TẦNG 1 & TẦNG 3)
    # ==========================================================================
    def classify_sample(self, s: VitalSample, baseline_rest: int) -> str:
        """
        Phân loại mẫu đo:
        - INVALID: Dữ liệu nhiễu (tháo đồng hồ, hr=0, sqi < SQI_MIN) -> Không phá hủy cơn hiện tại.
        - EXEMPT_ACTIVITY: Nhịp tăng tương xứng vận động thể lực -> Ghi log mức 0.
        - ABNORMAL: Nhịp tim bất thường vượt ngưỡng.
        - NORMAL: Nhịp tim đã hồi phục về vùng an toàn.
        - BORDERLINE: Vùng đệm trễ (giữ nguyên trạng thái hiện tại).
        """
        # Tầng 1: Kiểm tra chất lượng tín hiệu
        if not s.is_worn or s.hr in (None, 0) or s.sqi < SQI_MIN:
            return "INVALID"

        hr = s.hr
        # Tầng 3: Ngữ cảnh vận động (Thiếu cờ boolean rõ ràng = KHÔNG miễn trừ)
        exercising = (s.is_exercising is True) or (
            "tập" in s.activity_state.lower() or "exercise" in s.activity_state.lower()
        )

        is_tachy = hr >= (baseline_rest + ENTER_DELTA) or hr >= ABS_HIGH

        if is_tachy:
            # Nếu đang vận động và SpO2 ổn định thì coi là đáp ứng sinh lý
            if exercising and (s.spo2 is None or s.spo2 >= 95):
                return "EXEMPT_ACTIVITY"
            return "ABNORMAL"

        # Ngưỡng thoát cơn (Hysteresis)
        if hr <= (baseline_rest + EXIT_DELTA) and hr >= ABS_LOW:
            return "NORMAL"

        if hr < ABS_LOW:
            # Nhịp tim chậm sâu nguy hiểm
            return "ABNORMAL"

        return "BORDERLINE"

    # ==========================================================================
    # 3. MÁY TRẠNG THÁI TUẦN TỰ (STATE MACHINE)
    # ==========================================================================
    async def process_sample(
        self,
        elder_id: str,
        s: VitalSample,
        baseline_rest: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Xử lý 1 mẫu sinh hiệu tuần tự cho từng cụ qua Redis Distributed Lock.
        Trả về dictionary cảnh báo nếu đạt điều kiện kích hoạt, ngược lại trả về None.
        """
        baseline = baseline_rest or self.default_baseline_hr
        redis = await self._get_redis()
        lock_key = f"secai:lock:vitals:{elder_id}"
        state_key = f"secai:state:{elder_id}"

        # 1. Khóa phân tán ngắn (Distributed lock 3s) đảm bảo xử lý tuần tự từng cụ
        async with redis.lock(lock_key, timeout=3.0, blocking_timeout=1.0):
            raw_state = await redis.hgetall(state_key)
            st = self._decode_state(raw_state, s.ts)

            # Bỏ mẫu cũ hoặc mẫu trùng lặp
            if s.ts <= st["last_ts"]:
                return None

            gap = s.ts - st["last_ts"]

            # Xử lý mất kết nối Bluetooth lâu (> 5 phút)
            if gap > GAP_ABORT_SEC and st["state"] in ("SUSPECT", "EPISODE", "RECOVERY"):
                await self._close_episode(redis, elder_id, st, s, reason="data_gap")
                st = self._init_state(s.ts)

            kind = self.classify_sample(s, baseline)

            # Mất dữ liệu ngắn (<= 45s) hoặc mẫu nhiễu: Cập nhật last_ts và giữ nguyên trạng thái
            if kind == "INVALID" or (gap <= GAP_TOLERANCE_SEC and kind == "INVALID"):
                st["last_ts"] = s.ts
                await self._save_state(redis, state_key, st)
                return None

            alert_result = None

            # --- TRẠNG THÁI: NORMAL ---
            if st["state"] == "NORMAL":
                if kind == "ABNORMAL":
                    st["abn_count"] += 1
                    if st["abn_count"] >= ENTER_MIN_SAMPLES:
                        st["state"] = "SUSPECT"
                        st["since"] = s.ts
                        st["ep_peak"] = s.hr or 0
                        st["min_spo2"] = s.spo2
                        st["mostly_resting"] = not (s.is_exercising is True)
                else:
                    st["abn_count"] = 0

            # --- TRẠNG THÁI: SUSPECT ---
            elif st["state"] == "SUSPECT":
                if kind == "ABNORMAL":
                    st["ep_peak"] = max(st["ep_peak"], s.hr or 0)
                    if s.spo2:
                        st["min_spo2"] = min(st["min_spo2"] or 100, s.spo2)
                    # Xác thực thời gian: Đủ 20s xác nhận EPISODE
                    if (s.ts - st["since"]) >= CONFIRM_SEC:
                        st["state"] = "EPISODE"
                        st["ep_start"] = st["since"]
                elif kind == "NORMAL":
                    # Nhiễu thoáng qua, tự động hủy bỏ không ghi nhận cơn
                    st = self._init_state(s.ts)

            # --- TRẠNG THÁI: EPISODE ---
            elif st["state"] == "EPISODE":
                st["ep_peak"] = max(st["ep_peak"], s.hr or 0)
                if s.spo2:
                    st["min_spo2"] = min(st["min_spo2"] or 100, s.spo2)
                if s.is_exercising is True:
                    st["mostly_resting"] = False

                # Kiểm tra cơn kéo dài đơn lẻ (>= 10 phút ngồi yên)
                alert_result = await self._escalate_if_long_episode(redis, elder_id, st, s)

                if kind == "NORMAL":
                    st["state"] = "RECOVERY"
                    st["since"] = s.ts

            # --- TRẠNG THÁI: RECOVERY ---
            elif st["state"] == "RECOVERY":
                if kind == "ABNORMAL":
                    # Tái phát ngay trong thời gian hồi phục: Vẫn tính là CÙNG 1 CƠN kéo dài
                    st["state"] = "EPISODE"
                    st["ep_peak"] = max(st["ep_peak"], s.hr or 0)
                elif kind == "NORMAL" and (s.ts - st["since"]) >= EXIT_SEC:
                    # Ổn định liên tục >= 60s: Chính thức đóng cơn & chuyển vào Cửa sổ trượt
                    summary = await self._close_episode(redis, elder_id, st, s, reason="recovered")
                    alert_result = await self._on_episode_closed(redis, elder_id, summary)
                    st = self._init_state(s.ts)

            st["last_ts"] = s.ts
            await self._save_state(redis, state_key, st)
            return alert_result

    # ==========================================================================
    # 4. CỬA SỔ TRƯỢT 60 PHÚT VỚI REDIS SORTED SET & COOLDOWN
    # ==========================================================================
    async def _on_episode_closed(
        self, redis: Redis, elder_id: str, ep: EpisodeSummary
    ) -> Optional[Dict[str, Any]]:
        """Đẩy cơn vừa đóng vào Sorted Set, dọn dẹp các cơn quá 60 phút, và phân cấp cảnh báo."""
        key = f"secai:episodes:{elder_id}"
        now = ep.end_ts

        pipe = redis.pipeline()
        pipe.zadd(key, {json.dumps(asdict(ep)): now})
        pipe.zremrangebyscore(key, 0, now - WINDOW_SEC)
        pipe.zcard(key)
        pipe.expire(key, WINDOW_SEC * 2)
        results = await pipe.execute()

        count_in_window = results[2]
        return await self._decide_alert(redis, elder_id, count_in_window, ep)

    async def _decide_alert(
        self, redis: Redis, elder_id: str, count: int, ep: EpisodeSummary
    ) -> Optional[Dict[str, Any]]:
        """Quyết định mức cảnh báo (Level 0, 1, 2) kèm kiểm tra Cooldown."""
        level = 0
        reason = ""

        # Phân cấp theo tần suất tái diễn khi nghỉ ngơi
        if count >= 3 and ep.mostly_resting:
            level = 2
            reason = f"Cảnh báo tái diễn: {count} cơn loạn nhịp trong 60 phút (Khuyến nghị đo ECG khẩn cấp)"
        elif count >= 2 and ep.mostly_resting:
            level = 1
            reason = f"Nghi ngờ loạn nhịp tái diễn: {count} cơn trong 60 phút (Khuyến nghị theo dõi Holter)"

        # Nâng cấp mức 2 nếu đa sinh hiệu cùng bất thường (HR vọt cao + SpO2 tụt)
        if ep.multi_vital_abnormal or (ep.peak_hr >= 120 and ep.min_spo2 and ep.min_spo2 < 90):
            level = max(level, 2)
            reason = f"Bất thường đa sinh hiệu: Tim {ep.peak_hr} bpm kèm Oxy tụt {ep.min_spo2}%"

        if level == 0:
            return None

        # Cooldown: Không gửi lặp lại cùng mức cảnh báo trong COOLDOWN_SEC (15 phút)
        cd_key = f"secai:cooldown:{elder_id}:{level}"
        acquired = await redis.set(cd_key, "1", ex=COOLDOWN_SEC, nx=True)
        if not acquired:
            logger.info("[VitalStateMachine] Đang trong cooldown mức %d cho cụ %s. Bỏ qua spam.", level, elder_id)
            return None

        return {
            "elder_id": elder_id,
            "level": level,
            "reason": reason,
            "window_episodes": count,
            "duration_sec": ep.duration_sec,
            "peak_hr": ep.peak_hr,
            "timestamp": ep.end_ts,
        }

    async def _escalate_if_long_episode(
        self, redis: Redis, elder_id: str, st: Dict[str, Any], s: VitalSample
    ) -> Optional[Dict[str, Any]]:
        """Cơn đầu tiên kéo dài >= 10 phút ngồi yên -> Báo động ngay, không chờ Tầng 4."""
        ep_duration = s.ts - st["ep_start"]
        if ep_duration >= SUSTAINED_EPISODE_SEC and st.get("mostly_resting", True):
            cd_key = f"secai:cooldown:{elder_id}:sustained_high_hr"
            acquired = await redis.set(cd_key, "1", ex=COOLDOWN_SEC, nx=True)
            if acquired:
                return {
                    "elder_id": elder_id,
                    "level": 1,
                    "reason": f"Cơn nhịp tim cao kéo dài liên tục {int(ep_duration / 60)} phút lúc nghỉ ngơi",
                    "window_episodes": 1,
                    "duration_sec": ep_duration,
                    "peak_hr": st["ep_peak"],
                    "timestamp": s.ts,
                }
        return None

    # ==========================================================================
    # 5. TIỆN ÍCH QUẢN LÝ TRẠNG THÁI (STATE ENCODING & HELPERS)
    # ==========================================================================
    def _init_state(self, current_ts: float) -> Dict[str, Any]:
        return {
            "state": "NORMAL",
            "since": current_ts,
            "abn_count": 0,
            "last_ts": 0.0,
            "ep_start": 0.0,
            "ep_peak": 0,
            "min_spo2": None,
            "mostly_resting": True,
        }

    def _decode_state(self, raw: Dict[Any, Any], current_ts: float) -> Dict[str, Any]:
        if not raw:
            return self._init_state(current_ts)
        return {
            "state": raw.get(b"state", b"NORMAL").decode() if isinstance(raw.get(b"state"), bytes) else str(raw.get("state", "NORMAL")),
            "since": float(raw.get(b"since", raw.get("since", current_ts))),
            "abn_count": int(raw.get(b"abn_count", raw.get("abn_count", 0))),
            "last_ts": float(raw.get(b"last_ts", raw.get("last_ts", 0.0))),
            "ep_start": float(raw.get(b"ep_start", raw.get("ep_start", 0.0))),
            "ep_peak": int(raw.get(b"ep_peak", raw.get("ep_peak", 0))),
            "min_spo2": int(raw[b"min_spo2"]) if b"min_spo2" in raw and raw[b"min_spo2"] != b"None" else (
                int(raw["min_spo2"]) if "min_spo2" in raw and raw["min_spo2"] not in (None, "None") else None
            ),
            "mostly_resting": str(raw.get(b"mostly_resting", raw.get("mostly_resting", "True"))).lower() in ("true", "1", "b'true'"),
        }

    async def _save_state(self, redis: Redis, key: str, st: Dict[str, Any]):
        mapping = {
            "state": str(st["state"]),
            "since": str(st["since"]),
            "abn_count": str(st["abn_count"]),
            "last_ts": str(st["last_ts"]),
            "ep_start": str(st["ep_start"]),
            "ep_peak": str(st["ep_peak"]),
            "min_spo2": str(st["min_spo2"]) if st["min_spo2"] is not None else "None",
            "mostly_resting": "1" if st["mostly_resting"] else "0",
        }
        await redis.hset(key, mapping=mapping)
        await redis.expire(key, WINDOW_SEC * 2)

    async def _close_episode(
        self, redis: Redis, elder_id: str, st: Dict[str, Any], s: VitalSample, reason: str
    ) -> EpisodeSummary:
        start_ts = st["ep_start"] if st["ep_start"] > 0 else st["since"]
        duration = max(0.0, s.ts - start_ts)
        multi_abnormal = bool(st["ep_peak"] >= 120 and st["min_spo2"] and st["min_spo2"] < 90)

        summary = EpisodeSummary(
            elder_id=elder_id,
            start_ts=start_ts,
            end_ts=s.ts,
            duration_sec=duration,
            peak_hr=st["ep_peak"],
            min_spo2=st["min_spo2"],
            mostly_resting=st["mostly_resting"],
            multi_vital_abnormal=multi_abnormal,
            close_reason=reason,
        )
        return summary


vital_state_machine = VitalStateMachine()

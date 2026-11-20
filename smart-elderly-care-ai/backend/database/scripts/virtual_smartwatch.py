#!/usr/bin/env python3
"""
virtual_smartwatch.py - Đồng hồ thông minh ảo SECA (bản 2).

Khác bản cũ:
  1. Hồ sơ thiết bị (--profile): "my_watch" = HR + SpO2 + gia tốc kế (đúng đồng hồ thật của nhóm,
     KHÔNG có nhiệt độ/huyết áp), "full" = gửi thêm nhiệt độ + huyết áp như bản cũ.
  2. Cờ chưa biết: is_exercising mặc định "không rõ" (bỏ khỏi payload), không gửi sqi.
  3. Té ngã là SỰ KIỆN MỘT LẦN (1 mẫu fall_detected=True) rồi chuyển sang "nằm yên sau ngã".
  4. Kịch bản có timeline + kết quả kỳ vọng, tự gọi API incident để in PASS/FAIL (--scenario).
  5. Chạy được trên Windows/Linux/macOS (phím tắt đổi chế độ), có --seed, --dry-run.

Ví dụ:
  python virtual_smartwatch.py                              # chế độ tương tác, bấm phím đổi kịch bản
  python virtual_smartwatch.py --mode tachy                 # bắt đầu ở chế độ nhịp nhanh
  python virtual_smartwatch.py --list                       # liệt kê kịch bản kiểm thử
  python virtual_smartwatch.py --scenario single_sample_noise --token <JWT>
  python virtual_smartwatch.py --scenario recurrent_episode --dry-run --speed 200   # xem trước, không gửi

GIẢ ĐỊNH CẦN KIỂM TRA (sửa bằng tham số nếu khác):
  * Endpoint gửi mẫu:  {host}/api/v1/vitals           (giống bản cũ)
  * Endpoint incident: {host}/api/v1/incidents        (--incidents-url), trả về list hoặc {"items": [...]}
    mỗi phần tử có "alert_type" và "created_at". Nếu cần đăng nhập, dùng --token.
  * Endpoint thiết bị: {host}/api/v1/devices         (--devices-url), mỗi phần tử có "id" (UUID) và "device_id" (serial);
    chỉ dùng cho kịch bản two_devices_isolated để ánh xạ serial -> UUID.
  * Backend hiện lọc theo thời gian thực của server (dedup/cooldown dùng datetime.now()).
    --send-ts + --speed chỉ cho kết quả đúng khi backend dùng "time" của mẫu để tính cửa sổ.
  * Khi chạy kịch bản, hãy xóa/ACK incident cũ trước (chống trùng 5-15 phút làm sai kết quả).
"""

import argparse
import json
import math
import os
import random
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from urllib import error, request

# ----------------------------------------------------------------------------
# 1. SINH DỮ LIỆU THEO CHẾ ĐỘ
# ----------------------------------------------------------------------------

# mode: (hr_base, hr_wave, spo2_base, spo2_delta_choices, temp_base, bp_sys, bp_dia, activity, motion)
STEADY = {
    "tachy":            (126, 4, 96, (0, 1),     36.9, 134, 86, "Ngồi nghỉ (Nhịp nhanh lúc nghỉ)", 0.03),
    "tachy_critical":   (146, 4, 94, (-1, 0, 1), 37.3, 162, 98, "Nằm nghỉ (Cơn nhịp nhanh kịch phát)", 0.02),
    "brady":            (44,  2, 93, (0, 1),     36.0, 84,  52, "Nghỉ ngơi (Nhịp tim chậm nguy hiểm)", 0.02),
    "hypoxia":          (102, 3, 87, (-1, 0),    36.5, 132, 84, "Nghỉ ngơi (Tụt SpO2)", 0.03),
    "exertion_hypoxia": (124, 3, 87, (-1, 0, 1), 37.3, 150, 92, "Vận động quá sức (Quá tải tim phổi)", 0.70),
    "fever":            (110, 3, 95, (0, 1),     38.6, 130, 82, "Nằm sốt cao", 0.02),
    "critical_triad":   (128, 3, 85, (-1, 0),    39.0, 144, 88, "Hôn mê / Nguy kịch (Tam chứng)", 0.01),
    "brady_hypoxia":    (44,  2, 87, (-1, 0),    36.0, 84,  52, "Nằm (Nhịp chậm + Tụt SpO2 / Trụy tim)", 0.02),
}

MODES = ["normal", "exercise", *STEADY.keys(), "motion_noise", "fall", "lying",
         "off_wrist", "drain"]


def generate(step: int, mode: str, battery: int) -> dict:
    """Trả về một mẫu 'đầy đủ' (đủ mọi cảm biến). apply_profile() sẽ cắt bớt theo thiết bị."""
    w = math.sin(step * 0.2)
    ri = random.randint
    s = dict(hr=0, spo2=0, temp=None, bp_sys=None, bp_dia=None, fall=False,
             battery=battery, activity="", is_worn=True, motion=0.05, exercising=False)
    slow_bat = max(0, battery - (1 if step % 15 == 0 else 0))

    if mode == "normal":
        s.update(hr=int(74 + w * 2 + ri(-1, 1)), spo2=int(98 + random.choice([0, 1])),
                 temp=round(36.6 + w * 0.08 + random.uniform(-0.03, 0.03), 1),
                 bp_sys=int(120 + w * 2), bp_dia=int(80 + w),
                 activity="Sinh hoạt / Nghỉ ngơi", motion=round(random.uniform(0.02, 0.10), 2),
                 battery=slow_bat)

    elif mode == "exercise":
        s.update(hr=min(122, int(82 + min(step * 3.5, 36.0) + w * 2 + ri(-1, 1))),
                 spo2=max(95, min(99, int(98 - min(step * 0.25, 2.0) + w * 0.5))),
                 temp=round(min(37.4, 36.6 + min(step * 0.08, 0.7) + w * 0.08), 1),
                 bp_sys=min(144, int(120 + min(step * 2.2, 22.0) + w * 2)), bp_dia=int(80 + w * 2),
                 activity="Vận động thể dục (Đi bộ / Dưỡng sinh)",
                 motion=round(random.uniform(0.35, 0.65), 2), exercising=True, battery=slow_bat)

    elif mode in STEADY:
        hb, hw, sb, sd, tb, bs, bd, act, mot = STEADY[mode]
        s.update(hr=int(hb + w * hw + ri(-2, 2)), spo2=int(sb + random.choice(sd)),
                 temp=round(tb + w * 0.08, 1), bp_sys=int(bs + w * 3), bp_dia=int(bd + w * 2),
                 activity=act, motion=mot, battery=max(0, battery - (1 if step % 10 == 0 else 0)))

    elif mode == "motion_noise":
        # Vung tay/gãi: PPG nhiễu, HR và SpO2 nhảy loạn, gia tốc kế cao. Dùng để thử bộ lọc nhiễu.
        s.update(hr=ri(60, 145), spo2=ri(86, 99), temp=36.6, bp_sys=None, bp_dia=None,
                 activity="Vung tay / cử động mạnh", motion=round(random.uniform(0.6, 1.3), 2),
                 battery=slow_bat)

    elif mode == "fall":
        # Cú ngã: một mẫu có cờ fall_detected, gia tốc đỉnh cao.
        s.update(hr=int(115 + ri(-2, 4)), spo2=95, temp=36.5, bp_sys=145, bp_dia=90, fall=True,
                 activity="TÉ NGÃ (fall_detected)", motion=3.2,
                 battery=max(0, battery - (1 if step % 10 == 0 else 0)))

    elif mode == "lying":
        # Sau ngã: nằm yên, gần như không chuyển động.
        s.update(hr=int(105 + w * 2), spo2=95, temp=36.5, bp_sys=140, bp_dia=88,
                 activity="Nằm yên sau ngã", motion=0.01, battery=slow_bat)

    elif mode == "off_wrist":
        s.update(hr=0, spo2=0, temp=26.0, bp_sys=None, bp_dia=None, activity="Tháo vòng tay / Cắm sạc",
                 is_worn=False, motion=0.0, battery=100)

    elif mode == "drain":
        s.update(hr=int(74 + w * 2), spo2=98, temp=36.5, bp_sys=120, bp_dia=80,
                 activity="Sinh hoạt bình thường", motion=0.06, battery=max(0, battery - 3))
    else:
        raise ValueError(f"Chế độ không hợp lệ: {mode}")
    return s


def apply_profile(s: dict, profile: str, exercise_flag: str) -> dict:
    """Cắt bớt cảm biến mà thiết bị không có. Thiếu = None (không phải giá trị mặc định)."""
    s = dict(s)
    if profile == "my_watch":
        s["temp"] = None
        s["bp_sys"] = None
        s["bp_dia"] = None
    if exercise_flag == "unknown":
        s["exercising"] = None   # đồng hồ thật thường không biết -> hệ thống KHÔNG được miễn trừ
    return s


def build_payload(device: str, s: dict, sim_dt, send_ts: bool, nulls: bool) -> dict:
    p = {
        "device_id": device,
        "heart_rate": s["hr"],
        "spo2": s["spo2"],
        "skin_temp_max": s["temp"],
        "bp_systolic": s["bp_sys"],
        "bp_diastolic": s["bp_dia"],
        "fall_detected": s["fall"],
        "bracelet_battery": s["battery"],
        "battery_level": s["battery"],
        "activity_state": s["activity"],
        "is_worn": s["is_worn"],
        "is_exercising": s["exercising"],
        "motion_magnitude": s["motion"],
    }
    if send_ts:
        p["time"] = sim_dt.isoformat()
    if not nulls:  # mặc định bỏ khóa thiếu để không làm hỏng schema; --nulls gửi null tường minh
        p = {k: v for k, v in p.items() if v is not None}
    return p


# ----------------------------------------------------------------------------
# 2. GỬI / ĐỌC API
# ----------------------------------------------------------------------------

def post_json(url: str, payload: dict, token: str = "", timeout: float = 10):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return resp.status in (200, 201), resp.status, ""
    except error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="ignore")[:200]
        except Exception:
            detail = ""
        return False, e.code, detail
    except Exception as e:
        return False, 0, str(e)[:200]


def parse_dt(v):
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def fetch_incidents(url: str, token: str, since: datetime):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with request.urlopen(request.Request(url, headers=headers), timeout=10) as r:
        body = json.loads(r.read().decode("utf-8"))
    if isinstance(body, list):
        items = body
    else:
        items = next((body[k] for k in ("items", "data", "incidents", "results")
                      if isinstance(body.get(k), list)), [])
    out = []
    for it in items:
        ts = parse_dt(it.get("created_at"))
        if ts is None or ts >= since:
            out.append(it)
    return out


# ----------------------------------------------------------------------------
# 3. KỊCH BẢN KIỂM THỬ (timeline: (số giây, chế độ); "silence" = mất kết nối BLE)
# ----------------------------------------------------------------------------

SUSPECT = ["ARRHYTHMIA_SUSPECT", "ARRHYTHMIA_RECURRENT"]
HR_RULES = ["HIGH_HEART_RATE", "SUDDEN_HR_SPIKE", "LOW_HEART_RATE", "SUDDEN_HR_DROP"] + SUSPECT

SCENARIOS = {
    "recurrent_episode": dict(
        desc="Cơn tim nhanh 40s, lặp lại sau ~10 và ~15 phút khi ngồi yên (bài toán gốc). Dài khoảng 42 phút.",
        timeline=[(300, "normal"), (40, "tachy"), (600, "normal"), (40, "tachy"),
                  (900, "normal"), (40, "tachy"), (600, "normal")],
        expect_any=SUSPECT),
    "single_sample_noise": dict(
        desc="Một mẫu nhảy vọt lẻ loi giữa chuỗi bình thường -> không được cảnh báo.",
        timeline=[(120, "normal"), (1, "tachy_critical"), (180, "normal")],
        max_total=0),
    "motion_noise_20s": dict(
        desc="Vung tay 20 giây (HR/SpO2 nhảy loạn, gia tốc cao, không SQI) -> không được cảnh báo.",
        timeline=[(120, "normal"), (20, "motion_noise"), (180, "normal")],
        max_total=0),
    "ble_gap_mid_episode": dict(
        desc="Mất Bluetooth 2 phút giữa cơn -> vẫn là MỘT cơn, không được thành 'tái diễn'.",
        timeline=[(120, "normal"), (40, "tachy"), (120, "silence"), (40, "tachy"), (240, "normal")],
        forbid_any=SUSPECT),
    "exercise_ok": dict(
        desc="Đi bộ/tập 4 phút, cờ vận động BIẾT được (suy từ IMU) -> không được báo giả nhịp tim.",
        timeline=[(120, "normal"), (240, "exercise"), (120, "normal")],
        exercise_flag="known",
        forbid_any=HR_RULES),
    "off_wrist_ok": dict(
        desc="Tháo đồng hồ 2 phút (HR=0, is_worn=False) -> không được báo ngưng tim giả.",
        timeline=[(60, "normal"), (120, "off_wrist"), (60, "normal")],
        max_total=0),
    "fall_oneshot": dict(
        desc="Ngã: 1 mẫu fall_detected rồi nằm yên 90s -> phải có FALL_DETECTED (và chỉ một lần).",
        timeline=[(60, "normal"), (1, "fall"), (90, "lying")],
        expect_any=["FALL_DETECTED"], max_of=("FALL_DETECTED", 1)),
    "low_battery": dict(
        desc="Pin 21% tụt về 0% -> phải có cảnh báo pin yếu và/hoặc cạn pin.",
        timeline=[(25, "drain"), (10, "drain")],
        battery=21, expect_any=["LOW_BATTERY", "DEVICE_BATTERY_DEAD"]),
    "stale_batch": dict(
        desc="Đồng bộ trễ: đồng hồ đẩy hàng loạt 2 phút nhịp nhanh ĐO TỪ 30 PHÚT TRƯỚC -> chỉ ghi lịch sử, "
             "không được báo động thời gian thực. Tự bật --send-ts.",
        needs_ts=True,
        timeline=[(60, "normal"), (120, "tachy", {"age_min": 30, "burst": True}), (90, "normal")],
        max_total=0),
    "two_devices_isolated": dict(
        desc="Hai đồng hồ chạy song song: A có cơn nhịp nhanh, B bình thường -> cảnh báo chỉ thuộc A, "
             "A và B phải là hai thiết bị riêng (--device, --device-b).",
        multi=True,
        timeline=[(60, "normal"), (90, "tachy"), (60, "normal")],
        timeline_b=[(210, "normal")],
        expect_any_a=HR_RULES),
    # --- Kịch bản Leo thang Khẩn cấp (Escalation MVP / v2) ---
    "danger_unacked": dict(
        desc="Brady-hypoxia (HR~44, SpO2~87) kéo dài 90s, không ai xác nhận. "
             "Phải leo thang (v1: ESCALATED_AUTO_CALL, v2: ESCALATED/CALLING/ESCALATED_L2/L3).",
        timeline=[(30, "normal"), (90, "brady_hypoxia"), (30, "normal")],
        settle_override=65,
        expect_escalated=True),
    "recovered_unacked": dict(
        desc="Brady-hypoxia 20s rồi hồi phục bình thường 120s, không ai xác nhận. "
             "Không được leo thang (cụ đã tự hồi phục ổn định > 15s trước khi hết 45s).",
        timeline=[(30, "normal"), (20, "brady_hypoxia"), (120, "normal")],
        settle_override=65,
        expect_escalated=False),
    "fall_vitals_recover_unacked": dict(
        desc="Ngã 1 lần rồi nằm yên sau ngã 120s, không ai xác nhận. "
             "Vẫn PHẢI leo thang (ngã không được hủy bằng sinh hiệu).",
        timeline=[(30, "normal"), (1, "fall"), (120, "lying")],
        settle_override=65,
        expect_escalated=True),
    "signal_loss_unacked": dict(
        desc="Cơn nguy cấp 20s rồi mất tín hiệu hoàn toàn (silence) 60s, không ai xác nhận. "
             "Phải leo thang (mất tín hiệu sau cơn nguy cấp = chưa an toàn).",
        timeline=[(30, "normal"), (20, "brady_hypoxia"), (60, "silence")],
        settle_override=65,
        expect_escalated=True),
    "relapse_after_stood_down": dict(
        desc="Cơn nguy cấp 20s -> hồi phục 60s (vào STOOD_DOWN) -> tái phát nguy cấp trong 5 phút. "
             "Phải leo thang ngay lập tức (không chờ đếm lại 45s).",
        timeline=[(30, "normal"), (20, "brady_hypoxia"), (60, "normal"), (20, "brady_hypoxia")],
        settle_override=15,
        expect_escalated=True),
}


def evaluate(spec: dict, incidents: list) -> list:
    types = [str(i.get("alert_type", "")) for i in incidents]
    res = []
    if "expect_any" in spec:
        ok = any(t in types for t in spec["expect_any"])
        res.append((ok, f"phải có một trong {spec['expect_any']}"))
    if "forbid_any" in spec:
        bad = [t for t in types if t in spec["forbid_any"]]
        res.append((not bad, f"không được có {spec['forbid_any']}" + (f" (thấy: {sorted(set(bad))})" if bad else "")))
    if "max_total" in spec:
        res.append((len(types) <= spec["max_total"],
                    f"tổng cảnh báo <= {spec['max_total']} (thấy {len(types)}: {sorted(set(types))})"))
    if "max_of" in spec:
        t, n = spec["max_of"]
        c = types.count(t)
        res.append((c <= n, f"{t} <= {n} lần (thấy {c})"))
    if "expect_escalated" in spec:
        req = spec["expect_escalated"]
        ESCALATED_STATUSES = {
            "ESCALATED", "ESCALATED_L2", "ESCALATED_L3", "FAILED_UNREACHABLE", "CALLING", "ESCALATED_AUTO_CALL"
        }
        has_escalated = any(
            any(s in str(i.get("notes") or "") for s in ESCALATED_STATUSES) or
            str(i.get("escalation_status")) in ESCALATED_STATUSES
            for i in incidents
        )
        has_field = any(i.get("notes") is not None or i.get("escalation_status") is not None for i in incidents) if incidents else False
        if not has_field and incidents:
            res.append((False, f"xác minh leo thang {'CÓ' if req else 'KHÔNG'} (FAIL vì API không trả trường 'notes'/'escalation_status')"))
        else:
            res.append((has_escalated == req, f"leo thang khẩn cấp == {req} (thấy {has_escalated})"))
    return res


# ----------------------------------------------------------------------------
# 4. BỘ PHÁT MẪU + ĐỌC PHÍM ĐA NỀN TẢNG
# ----------------------------------------------------------------------------

class KeyReader:
    """Đọc 1 phím không chặn, chạy trên Windows và Linux/macOS. Không có TTY -> không có phím."""

    def __enter__(self):
        self.mode = None
        if os.name == "nt":
            import msvcrt
            self.ms = msvcrt
            self.mode = "nt"
        elif sys.stdin.isatty():
            import select
            import termios
            import tty
            self.select, self.termios = select, termios
            self.fd = sys.stdin.fileno()
            self.old = termios.tcgetattr(self.fd)
            tty.setcbreak(self.fd)
            self.mode = "posix"
        return self

    def get(self):
        if self.mode == "nt":
            if self.ms.kbhit():
                return self.ms.getch().decode("utf-8", errors="ignore")
        elif self.mode == "posix":
            if self.select.select([sys.stdin], [], [], 0)[0]:
                return sys.stdin.read(1)
        return None

    def __exit__(self, *exc):
        if self.mode == "posix":
            self.termios.tcsetattr(self.fd, self.termios.TCSADRAIN, self.old)


class Watch:
    def __init__(self, args, battery: int, exercise_flag: str, tag: str = ""):
        self.a = args
        self.tag = f"[{tag}] " if tag else ""
        self.battery = battery
        self.exercise_flag = exercise_flag
        self.sim_now = datetime.now(timezone.utc)
        self.sent = 0
        self.failed = 0

    def emit(self, mode: str, step: int):
        s = apply_profile(generate(step, mode, self.battery), self.a.profile, self.exercise_flag)
        self.battery = s["battery"]
        payload = build_payload(self.a.device, s, self.sim_now, self.a.send_ts, self.a.nulls)
        if self.a.dry_run:
            ok, status, detail = True, 0, ""
            if self.a.verbose:
                print("   payload:", json.dumps(payload, ensure_ascii=False))
        else:
            ok, status, detail = post_json(f"{self.a.host.rstrip('/')}/api/v1/vitals", payload, self.a.token)
        self.sent += 1
        self.failed += 0 if ok else 1
        self.sim_now += timedelta(seconds=self.a.interval)

        f = lambda v, fmt: "--" if v is None else fmt.format(v)
        bat = "HẾT PIN" if s["battery"] <= 0 else (f"PIN YẾU {s['battery']}%" if s["battery"] <= 20 else f"pin {s['battery']}%")
        ex = {True: "ex=Y", False: "ex=N", None: "ex=?"}[s["exercising"]]
        err = "" if ok else f"  LỖI {status} {detail}"
        print(f"[{time.strftime('%H:%M:%S')}] {self.tag}{'OK ' if ok else 'ERR'} "
              f"HR {s['hr']:3d} | SpO2 {s['spo2']:2d}% | "
              f"T {f(s['temp'], '{:.1f}')} | HA {f(s['bp_sys'], '{}')}/{f(s['bp_dia'], '{}')} | "
              f"acc {s['motion']:.2f}g | {ex} | {bat} | {s['activity']}"
              f"{' | NGÃ' if s['fall'] else ''}{'' if s['is_worn'] else ' | THÁO'}{err}")

    def silence(self, seconds: float):
        print(f"[{time.strftime('%H:%M:%S')}] --- MẤT KẾT NỐI BLE {seconds:.0f}s (không gửi mẫu) ---")
        self.sim_now += timedelta(seconds=seconds)
        time.sleep(seconds / self.a.speed)

    def segment(self, seconds: float, mode: str, opts: dict = None):
        opts = opts or {}
        if mode == "silence":
            self.silence(seconds)
            return
        n = max(1, round(seconds / self.a.interval))
        saved = self.sim_now
        if opts.get("age_min"):                      # mẫu cũ: giờ đo lùi về quá khứ
            self.sim_now = saved - timedelta(minutes=opts["age_min"])
        for step in range(1, n + 1):
            self.emit(mode, step)
            time.sleep(0.02 if opts.get("burst") else self.a.interval / self.a.speed)
        if opts.get("age_min"):
            self.sim_now = saved


# ----------------------------------------------------------------------------
# 5. CHẠY KỊCH BẢN / CHẾ ĐỘ TƯƠNG TÁC
# ----------------------------------------------------------------------------

def _timeline_total(tl):
    return sum(seg[0] for seg in tl if not (len(seg) > 2 and seg[2].get("burst")))


def _play(watch, timeline):
    for seg in timeline:
        sec, mode = seg[0], seg[1]
        opts = seg[2] if len(seg) > 2 else {}
        print(f"--- {watch.tag}đoạn: {mode} {sec}s{' ' + str(opts) if opts else ''} ---")
        watch.segment(sec, mode, opts)


def fetch_devices(url: str, token: str) -> dict:
    """serial (device_id) -> UUID (id)."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with request.urlopen(request.Request(url, headers=headers), timeout=10) as r:
        body = json.loads(r.read().decode("utf-8"))
    if isinstance(body, list):
        items = body
    else:
        items = next((body[k] for k in ("items", "data", "devices", "results")
                      if isinstance(body.get(k), list)), [])
    return {str(d["device_id"]): str(d["id"]) for d in items if d.get("device_id") and d.get("id")}


def evaluate_multi(spec, incidents, dev_a, dev_b, ua, ub):
    res = [
        (ua is not None, f"thiết bị A '{dev_a}' có bản ghi riêng trong hệ thống"),
        (ub is not None, f"thiết bị B '{dev_b}' có bản ghi riêng trong hệ thống"),
        (ua is not None and ub is not None and ua != ub, "A và B là hai thiết bị khác nhau (không bị gộp)"),
    ]
    inc_a = [i for i in incidents if ua and str(i.get("device_id")) == ua]
    inc_b = [i for i in incidents if ub and str(i.get("device_id")) == ub]
    types_a = sorted({str(i.get("alert_type")) for i in inc_a})
    res.append((any(t in types_a for t in spec["expect_any_a"]),
                f"A phải có một trong {spec['expect_any_a']} (thấy {types_a})"))
    res.append((len(inc_b) == 0, f"B không được có cảnh báo (thấy {len(inc_b)})"))
    return res


def run_scenario(args, name: str) -> bool:
    spec = SCENARIOS[name]
    restore_ts = args.send_ts
    if spec.get("needs_ts") and not args.send_ts:
        print("Kịch bản này cần giờ mẫu: tự bật --send-ts (backend phải nhận trường 'time').")
        args.send_ts = True
    try:
        return _run_scenario(args, name, spec)
    finally:
        args.send_ts = restore_ts


def _run_scenario(args, name: str, spec: dict) -> bool:
    multi = bool(spec.get("multi"))
    total = _timeline_total(spec["timeline"])
    print("=" * 78)
    print(f"KỊCH BẢN: {name}\n  {spec['desc']}\n  Thời lượng mô phỏng ~{total / 60:.1f} phút, tốc độ x{args.speed:g}")
    print("=" * 78)
    flag = spec.get("exercise_flag", args.exercise_flag)
    start = datetime.now(timezone.utc) - timedelta(seconds=2)

    if multi:
        args_b = argparse.Namespace(**vars(args))
        args_b.device = args.device_b
        watches = [Watch(args, 85, flag, "A"), Watch(args_b, 85, flag, "B")]
        threads = [threading.Thread(target=_play, args=(watches[0], spec["timeline"])),
                   threading.Thread(target=_play, args=(watches[1], spec["timeline_b"]))]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
    else:
        watches = [Watch(args, spec.get("battery", 85), flag)]
        _play(watches[0], spec["timeline"])

    sent = sum(w.sent for w in watches)
    failed = sum(w.failed for w in watches)
    settle_sec = spec.get("settle_override", args.settle)
    print(f"\nĐã gửi {sent} mẫu ({failed} lỗi). Chờ backend xử lý {settle_sec:g}s...")
    time.sleep(settle_sec if not args.dry_run else 0)
    if args.dry_run:
        print("(dry-run: bỏ qua kiểm tra incident)")
        return True
    host = args.host.rstrip("/")
    inc_url = args.incidents_url or (f"{host}/api/v1/incidents" if multi else f"{host}/api/v1/incidents?device_id={args.device}")
    try:
        incidents = fetch_incidents(inc_url, args.token, start)
    except Exception as e:
        print(f"KHÔNG ĐỌC ĐƯỢC incident ({e}). Kiểm tra --incidents-url / --token.")
        return False

    print(f"Incident tạo ra trong lúc chạy: {len(incidents)}")
    for i in incidents:
        print(f"   - {i.get('alert_type')}  [{i.get('alert_level', '')}]  thiết bị {str(i.get('device_id', ''))[:8]}  "
              f"{str(i.get('message', ''))[:70]}")

    if multi:
        try:
            dmap = fetch_devices(args.devices_url or f"{host}/api/v1/devices", args.token)
        except Exception as e:
            print(f"KHÔNG ĐỌC ĐƯỢC danh sách thiết bị ({e}). Dùng --devices-url / --token.")
            dmap = {}
        results = evaluate_multi(spec, incidents, args.device, args.device_b,
                                 dmap.get(args.device), dmap.get(args.device_b))
    else:
        results = evaluate(spec, incidents)
    for ok, text in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {text}")
    verdict = all(ok for ok, _ in results) and failed == 0
    print(f"=> {'PASS' if verdict else 'FAIL'}: {name}\n")
    return verdict


KEY_MODE_MAP = {
    "1": "normal", "2": "exercise", "3": "off_wrist", "4": "tachy", "5": "tachy_critical",
    "6": "brady", "7": "hypoxia", "8": "exertion_hypoxia", "9": "fever", "0": "critical_triad",
    "b": "brady_hypoxia", "f": "fall", "d": "drain", "n": "motion_noise",
}


def print_menu(args):
    print("-" * 78)
    print(f"Hồ sơ: {args.profile} | cờ vận động: {args.exercise_flag} | gửi ts: {args.send_ts}")
    print("[1] Bình thường  [2] Thể dục  [3] Tháo vòng  [4] Tim cao lúc nghỉ  [5] Tim vọt")
    print("[6] Tim chậm  [7] Tụt SpO2  [8] Quá tải gắng sức  [9] Sốt  [0] Tam chứng")
    print("[F] Té ngã (1 lần)  [D] Xả pin  [N] Nhiễu vung tay  [G] Bật/tắt mất BLE")
    print("[M] Menu  [Q] Thoát")
    print("-" * 78)


def run_interactive(args):
    battery = args.battery if args.battery is not None else (21 if args.mode == "drain" else 85)
    watch = Watch(args, battery, args.exercise_flag)
    mode, step, gap = args.mode, 0, False
    print("=" * 78)
    print(f"ĐỒNG HỒ ẢO SECA | {args.host} | thiết bị {args.device} | mỗi {args.interval}s | chế độ {mode}")
    print("=" * 78)
    print_menu(args)
    with KeyReader() as keys:
        if keys.mode is None:
            print("(Không có TTY: không dùng được phím tắt, chạy cố định chế độ ban đầu.)")
        try:
            while True:
                step += 1
                if gap:
                    print(f"[{time.strftime('%H:%M:%S')}] --- đang MẤT KẾT NỐI BLE (bấm G để nối lại) ---")
                    watch.sim_now += timedelta(seconds=args.interval)
                else:
                    watch.emit(mode, step)
                    if mode == "fall" and not args.fall_repeat:
                        mode, step = "lying", 0          # ngã chỉ là một sự kiện
                if args.count and step >= args.count:
                    break
                end = time.time() + args.interval / args.speed
                while time.time() < end:
                    ch = keys.get()
                    if ch:
                        k = ch.lower()
                        if k in ("q", "\x03", "\x1b"):
                            raise KeyboardInterrupt
                        if k == "g":
                            gap = not gap
                            print(f"\n>>> {'MẤT' if gap else 'NỐI LẠI'} kết nối BLE\n")
                        elif k in KEY_MODE_MAP and KEY_MODE_MAP[k] != mode:
                            mode, step = KEY_MODE_MAP[k], 0
                            if mode == "drain":
                                watch.battery = 21
                            elif watch.battery <= 0:
                                watch.battery = 85
                            print(f"\n>>> ĐỔI CHẾ ĐỘ: {mode}\n")
                            break
                        elif k in ("m", "h", "?"):
                            print_menu(args)
                    time.sleep(0.05)
        except KeyboardInterrupt:
            print("\nĐã dừng đồng hồ ảo.")


def main():
    ap = argparse.ArgumentParser(description="SECA Virtual Smartwatch v2")
    ap.add_argument("--host", default="http://127.0.0.1:8000")
    ap.add_argument("--device", default="BLE_BAND_001")
    ap.add_argument("--device-b", default="BLE_BAND_002", help="Thiết bị thứ hai (kịch bản two_devices_isolated)")
    ap.add_argument("--devices-url", default="", help="Mặc định {host}/api/v1/devices")
    ap.add_argument("--interval", type=float, default=2.5, help="Chu kỳ gửi mẫu (giây)")
    ap.add_argument("--mode", choices=MODES, default="normal")
    ap.add_argument("--battery", type=int, default=None)
    ap.add_argument("--count", type=int, default=0, help="Số mẫu tối đa ở chế độ tương tác (0 = vô hạn)")
    ap.add_argument("--profile", choices=["my_watch", "full"], default="full",
                    help="my_watch = HR+SpO2+gia tốc; full = thêm nhiệt độ và huyết áp")
    ap.add_argument("--exercise-flag", choices=["unknown", "known"], default="unknown",
                    help="unknown: không gửi is_exercising; known: gửi true/false")
    ap.add_argument("--nulls", action="store_true", help="Gửi null tường minh thay vì bỏ khóa")
    ap.add_argument("--fall-repeat", action="store_true", help="Giữ fall_detected=True liên tục (kiểu bản cũ)")
    ap.add_argument("--seed", type=int, default=None, help="Cố định số ngẫu nhiên để tái hiện lỗi")
    ap.add_argument("--send-ts", action="store_true", help="Gửi trường time (giờ mẫu mô phỏng)")
    ap.add_argument("--speed", type=float, default=1.0, help="Tăng tốc mô phỏng (cần --send-ts hoặc --dry-run)")
    ap.add_argument("--dry-run", action="store_true", help="Không gửi HTTP, chỉ in")
    ap.add_argument("--verbose", action="store_true", help="In payload (dry-run)")
    ap.add_argument("--token", default=os.environ.get("SECA_TOKEN", ""), help="JWT nếu API yêu cầu")
    ap.add_argument("--scenario", help="Tên kịch bản, hoặc 'all'")
    ap.add_argument("--list", action="store_true", help="Liệt kê kịch bản")
    ap.add_argument("--incidents-url", default="")
    ap.add_argument("--settle", type=float, default=5.0, help="Chờ trước khi đọc incident (giây)")
    ap.add_argument("--pause", type=float, default=0.0, help="Nghỉ giữa các kịch bản khi chạy 'all'")
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
    if args.speed != 1.0 and not (args.send_ts or args.dry_run):
        ap.error("--speed khác 1 cần --send-ts (backend dùng giờ mẫu) hoặc --dry-run")

    if args.list:
        for n, sp in SCENARIOS.items():
            print(f"{n:22s} {sp['desc']}")
        return

    if args.scenario:
        names = list(SCENARIOS) if args.scenario == "all" else [args.scenario]
        for n in names:
            if n not in SCENARIOS:
                ap.error(f"Kịch bản không tồn tại: {n}. Dùng --list.")
        if len(names) > 1:
            print("Lưu ý: chống trùng cảnh báo (5-15 phút) có thể làm kịch bản sau bị nhiễu bởi kịch bản trước. "
                  "Hãy ACK/xóa incident giữa các kịch bản (dùng --pause).")
        results = {}
        for i, n in enumerate(names):
            results[n] = run_scenario(args, n)
            if args.pause and i < len(names) - 1:
                time.sleep(args.pause)
        print("TỔNG KẾT:")
        for n, ok in results.items():
            print(f"  {'PASS' if ok else 'FAIL'}  {n}")
        sys.exit(0 if all(results.values()) else 1)

    run_interactive(args)


if __name__ == "__main__":
    main()

import { Users, ShieldCheck, Activity, Server } from 'lucide-react';

export type TimeRange = 'live' | 'week' | 'month';

export type MetricKey = 'heartRate' | 'spo2' | 'bloodPressure' | 'fallRisk' | 'temperature';

export interface ActiveMetricsState {
  heartRate: boolean;
  spo2: boolean;
  bloodPressure: boolean;
  fallRisk: boolean;
  temperature: boolean;
}

export interface TelemetryPoint {
  time: string;
  heartRate: number | null;
  spo2: number | null;
  bloodPressure: number | null;
  temperature: number | null;
  fallRisk: number | null;
  fallMax?: number;
  alerts: number;
}

export interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  gradientId: string;
  strokeWidth: number;
  activeClass: string;
  dotShadow: string;
}

export const METRIC_CONFIGS: MetricConfig[] = [
  {
    key: 'heartRate',
    label: 'Nhịp tim (bpm)',
    color: '#F05A24',
    gradientId: 'colorHr',
    strokeWidth: 2.5,
    activeClass: 'bg-[#F05A24]/10 border-[#F05A24]/40 text-[#F05A24] shadow-xs',
    dotShadow: 'shadow-[0_0_5px_#F05A24]',
  },
  {
    key: 'spo2',
    label: 'Oxy SpO2 (%)',
    color: '#0EA5E9',
    gradientId: 'colorSpo2',
    strokeWidth: 2,
    activeClass: 'bg-[#0EA5E9]/10 border-[#0EA5E9]/40 text-[#0EA5E9] shadow-xs',
    dotShadow: 'shadow-[0_0_5px_#0EA5E9]',
  },
  {
    key: 'bloodPressure',
    label: 'Huyết áp (mmHg)',
    color: '#8B5CF6',
    gradientId: 'colorBp',
    strokeWidth: 2,
    activeClass: 'bg-[#8B5CF6]/10 border-[#8B5CF6]/40 text-[#8B5CF6] shadow-xs',
    dotShadow: 'shadow-[0_0_5px_#8B5CF6]',
  },
  {
    key: 'fallRisk',
    label: 'Nguy cơ ngã (Điểm)',
    color: '#E9A23B',
    gradientId: 'colorFall',
    strokeWidth: 2,
    activeClass: 'bg-[#E9A23B]/10 border-[#E9A23B]/40 text-[#E9A23B] shadow-xs',
    dotShadow: 'shadow-[0_0_5px_#E9A23B]',
  },
  {
    key: 'temperature',
    label: 'Thân nhiệt (°C)',
    color: '#10B981',
    gradientId: 'colorTemp',
    strokeWidth: 2,
    activeClass: 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981] shadow-xs',
    dotShadow: 'shadow-[0_0_5px_#10B981]',
  },
];

// Thứ tự render <Area> để giữ nguyên z-order chồng lớp trên biểu đồ
export const AREA_RENDER_ORDER: MetricKey[] = [
  'bloodPressure',
  'spo2',
  'heartRate',
  'fallRisk',
  'temperature',
];

export const TIME_RANGE_OPTIONS: { key: TimeRange; label: string; isLive?: boolean }[] = [
  { key: 'live', label: 'Trực tiếp (Live)', isLive: true },
  { key: 'week', label: 'Theo tuần (7 ngày)' },
  { key: 'month', label: 'Theo tháng (30 ngày)' },
];

export const CORE_MODULES = [
  {
    to: '/users',
    icon: Users,
    title: 'Quản lý người dùng',
    desc: 'Quản trị tài khoản, phân bổ vai trò Bác sĩ, Người thân và phân quyền căn hộ.',
    tag: 'MODULE_01',
  },
  {
    to: '/security',
    icon: ShieldCheck,
    title: 'Quản lý bảo mật hệ thống',
    desc: 'Chính sách mật khẩu, quản lý phiên JWT, nhật ký kiểm toán và ma trận RBAC.',
    tag: 'MODULE_02',
  },
  {
    to: '/monitoring',
    icon: Activity,
    title: 'Giám sát hoạt động hệ thống',
    desc: 'Theo dõi luồng camera AI, vòng đeo tay BLE, cảm biến té ngã và cảnh báo tức thì.',
    tag: 'MODULE_03',
  },
  {
    to: '/infrastructure',
    icon: Server,
    title: 'Quản lý hạ tầng',
    desc: 'Trạng thái PostgreSQL, TimescaleDB, bộ nhớ tạm Redis, EMQX MQTT Broker & Logs.',
    tag: 'MODULE_04',
  },
];

// Đánh giá chỉ số bất ổn sinh hiệu & nguy cơ ngã tổng hợp (Vital Instability & Fall Risk Index - Thang điểm 0–100):
// Hệ thống hỗ trợ sàng lọc tham khảo – Kết hợp sự kiện té ngã vật lý (IMU) và các bất thường huyết động (HR, SpO2, Huyết áp, Thân nhiệt, Vận động).
// Sử dụng nội suy tuyến tính (Piecewise Linear Interpolation) tránh giật ngưỡng và xử lý nghiêm ngặt khi thiếu dữ liệu cảm biến.
export const evaluateVitalFallRisk = (v: any): number => {
  // 1. Tháo vòng tay hoặc mất tín hiệu nhịp tim -> Tắt rủi ro đo đạc (0 điểm)
  const hr = typeof v.heart_rate === 'number' ? v.heart_rate : 0;
  if (v.is_worn === false || hr <= 0) return 0;

  // 2. KỊCH BẢN 11: Sự cố té ngã vật lý thực tế được kích hoạt (Fall Detected) -> Điểm báo động đỏ 95
  if (v.fall_detected) return 95;

  // Xử lý dữ liệu cảm biến: KHÔNG gán mặc định 98% SpO2 hay 120 mmHg để tránh che giấu lỗi cảm biến
  const spo2 = typeof v.spo2 === 'number' && v.spo2 > 0 ? v.spo2 : null;
  const bp = typeof v.bp_systolic === 'number' && v.bp_systolic > 0 ? v.bp_systolic : null;
  const temp = typeof v.skin_temp_max === 'number' && v.skin_temp_max > 0 ? v.skin_temp_max : null;

  // Nhận diện vận động: Ưu tiên cờ boolean chuẩn; nếu không rõ thì mặc định KHÔNG miễn trừ
  const act = String(v.activity_state || v.activity || '').toLowerCase();
  const isExercising = Boolean(
    v.is_exercising === true ||
    act.includes('tập') ||
    act.includes('exercise') ||
    act.includes('vận động thể dục')
  );

  // 3. CÁC TỔ HỢP ĐA YẾU TỐ NGUY HIỂM CAO (MULTI-VITAL SYNDROMES):
  // A. KỊCH BẢN 10: Tam chứng nguy kịch (Sốt >= 38.5°C + Tim >= 115 bpm + SpO2 < 90%) -> 90 điểm
  if (temp != null && temp >= 38.5 && hr >= 115 && spo2 != null && spo2 < 90) return 90;

  // B. KỊCH BẢN 8: Quá tải tim phổi khi gắng sức (Tim >= 115 bpm + SpO2 < 90%) -> 85 điểm
  if (hr >= 115 && spo2 != null && spo2 < 90) return 85;

  // C. KỊCH BẢN 6: Nghi ngờ nhịp chậm kèm tụt huyết áp, nguy cơ ngất (Tim <= 50 bpm + HA tâm thu < 90 mmHg) -> 85 điểm
  if (bp != null && bp < 90 && hr <= 50) return 85;

  // D. Nhịp tim cực chậm đơn độc (<= 44 bpm) ngay cả khi không có đo huyết áp -> Nguy cơ giảm tưới máu não cấp 80 điểm
  if (hr <= 44) return 80;

  // 4. TÍNH ĐIỂM CỘNG DỒN NỘI SUY TUYẾN TÍNH (PIECEWISE LINEAR INTERPOLATION):
  let risk = 5; // Mức nền sinh hoạt an toàn bình thường (Kịch bản 1: 5 điểm)

  // A. Biến động Nhịp tim (HR):
  if (hr >= 140) {
    risk += 50;
  } else if (hr >= 100) {
    const ratio = (hr - 100) / 40;
    if (isExercising && spo2 != null && spo2 >= 95) {
      risk += 10 + ratio * 15;
    } else {
      risk += 20 + ratio * 30;
    }
  } else if (hr >= 85) {
    // Nhịp tim tăng khi nghỉ ở người cao tuổi (85 - 100 bpm) -> Tăng nguy cơ chóng mặt/té ngã
    const ratio = (hr - 85) / 15;
    risk += Math.round(5 + ratio * 10);
  } else if (hr <= 58) {
    const ratio = Math.max(0, Math.min(1, (58 - hr) / 14));
    risk += 25 + ratio * 35;
  }

  // B. Tụt Oxy máu (SpO2):
  if (spo2 != null && spo2 < 95) {
    const ratio = Math.max(0, Math.min(1, (95 - spo2) / 7));
    risk += ratio * 35;
  }

  // C. Tụt huyết áp tâm thu (< 90 mmHg):
  if (bp != null && bp < 90) {
    const ratio = Math.max(0, Math.min(1, (90 - bp) / 30));
    risk += 15 + ratio * 15;
  }

  // D. Thân nhiệt cao (Sốt >= 38.0°C):
  if (temp != null && temp >= 38.0) {
    const ratio = Math.max(0, Math.min(1, (temp - 38.0) / 2.0));
    risk += 10 + ratio * 15;
  }

  return Math.min(95, Math.max(0, Math.round(risk)));
};

interface BucketAccumulator {
  hrSum: number; hrCnt: number;
  spo2Sum: number; spo2Cnt: number;
  bpSum: number; bpCnt: number;
  tempSum: number; tempCnt: number;
  fallSum: number; fallCnt: number;
  fallMax: number; alerts: number;
}

const createBucket = (): BucketAccumulator => ({
  hrSum: 0, hrCnt: 0,
  spo2Sum: 0, spo2Cnt: 0,
  bpSum: 0, bpCnt: 0,
  tempSum: 0, tempCnt: 0,
  fallSum: 0, fallCnt: 0,
  fallMax: 0, alerts: 0,
});

const accumulateVital = (bucket: BucketAccumulator, v: any, minHr: number) => {
  if (typeof v.heart_rate === 'number' && v.heart_rate > minHr) {
    bucket.hrSum += v.heart_rate; bucket.hrCnt++;
  }
  if (typeof v.spo2 === 'number' && v.spo2 > 70) {
    bucket.spo2Sum += v.spo2; bucket.spo2Cnt++;
  }
  if (typeof v.bp_systolic === 'number' && v.bp_systolic > 60) {
    bucket.bpSum += v.bp_systolic; bucket.bpCnt++;
  }
  if (typeof v.skin_temp_max === 'number' && v.skin_temp_max > 30) {
    bucket.tempSum += v.skin_temp_max; bucket.tempCnt++;
  }
  const fScore = evaluateVitalFallRisk(v);
  bucket.fallSum += fScore;
  bucket.fallCnt++;
  bucket.fallMax = Math.max(bucket.fallMax, fScore);
  if (v.alert_triggered) bucket.alerts++;
};

export const buildTelemetryData = (
  rawVitals: any[],
  timeRange: TimeRange,
  dailySummary: any[] = []
): TelemetryPoint[] => {
  const now = new Date();

  if (timeRange === 'live') {
    const minuteMap = new Map<string, BucketAccumulator>();

    for (const v of rawVitals) {
      if (!v.time) continue;
      const vDate = new Date(v.time);
      const timeKey = `${String(vDate.getHours()).padStart(2, '0')}:${String(vDate.getMinutes()).padStart(2, '0')}`;
      const cur = minuteMap.get(timeKey) || createBucket();
      accumulateVital(cur, v, 30);
      minuteMap.set(timeKey, cur);
    }

    // Neo thời gian: nếu có dữ liệu mới trong vòng 2h thì neo theo now, ngược lại neo theo bản ghi gần nhất
    const latestVitalMs = rawVitals[0]?.time ? new Date(rawVitals[0].time).getTime() : now.getTime();
    const anchorDate = now.getTime() - latestVitalMs <= 2 * 3600 * 1000 ? now : new Date(latestVitalMs);

    const points: TelemetryPoint[] = [];
    const windowMinutes = 20;
    for (let i = windowMinutes - 1; i >= 0; i--) {
      const d = new Date(anchorDate.getTime() - i * 60 * 1000);
      const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const rec = minuteMap.get(timeLabel);

      const hasHr = Boolean(rec && rec.hrCnt > 0);
      const hasSpo2 = Boolean(rec && rec.spo2Cnt > 0);
      const hasBp = Boolean(rec && rec.bpCnt > 0);
      const hasTemp = Boolean(rec && rec.tempCnt > 0);
      const hasFall = Boolean(rec && rec.fallMax > 0);
      const hasAny = hasHr || hasSpo2 || hasBp || hasTemp || hasFall;

      points.push({
        time: timeLabel,
        heartRate: hasHr ? Math.round(rec!.hrSum / rec!.hrCnt) : null,
        spo2: hasSpo2 ? Math.round(rec!.spo2Sum / rec!.spo2Cnt) : null,
        bloodPressure: hasBp ? Math.round(rec!.bpSum / rec!.bpCnt) : null,
        temperature: hasTemp ? Math.round((rec!.tempSum / rec!.tempCnt) * 10) / 10 : null,
        fallRisk: hasFall ? rec!.fallMax : hasAny ? 0 : null,
        alerts: rec?.alerts ?? 0,
      });
    }
    return points;
  }

  // 'week' (7 ngày) hoặc 'month' (30 ngày)
  const days = timeRange === 'week' ? 7 : 30;
  const dayMap = new Map<string, BucketAccumulator>();

  const toKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 1. Tải dữ liệu tổng hợp hàng ngày chính xác từ DB
  for (const s of dailySummary) {
    if (!s.date) continue;
    const cleanDate = String(s.date).split('T')[0];
    const shortKey = cleanDate.length >= 10 ? cleanDate.slice(5, 10) : cleanDate;

    // Đánh giá chỉ số bất ổn sinh hiệu & nguy cơ ngã tổng hợp đồng nhất cho toàn bộ các ngày:
    // Nếu ngày có cảnh báo té ngã (fallMax >= 90) -> 95;
    // Ngược lại, tính toán đồng bộ theo chỉ số sinh hiệu (HR, SpO2, Huyết áp, Thân nhiệt)
    const evaluatedFall = (s.fallMax ?? 0) >= 90 || (s.fallRisk ?? 0) >= 90
      ? 95
      : evaluateVitalFallRisk({
          heart_rate: s.heartRate,
          spo2: s.spo2,
          bp_systolic: s.bloodPressure,
          skin_temp_max: s.temperature,
          fall_detected: false,
          is_worn: true,
        });

    const bucket: BucketAccumulator = {
      hrSum: s.heartRate ?? 0, hrCnt: s.heartRate != null ? 1 : 0,
      spo2Sum: s.spo2 ?? 0, spo2Cnt: s.spo2 != null ? 1 : 0,
      bpSum: s.bloodPressure ?? 0, bpCnt: s.bloodPressure != null ? 1 : 0,
      tempSum: s.temperature ?? 0, tempCnt: s.temperature != null ? 1 : 0,
      fallSum: evaluatedFall, fallCnt: 1,
      fallMax: Math.max(s.fallMax ?? 0, evaluatedFall),
      alerts: s.alerts ?? 0,
    };
    dayMap.set(cleanDate, bucket);
    dayMap.set(shortKey, bucket);
  }

  // 2. Dự phòng hoặc bù đắp từ rawVitals nếu ngày chưa có trong dailySummary
  for (const v of rawVitals) {
    const rawTime = v.time || v.recorded_at;
    if (!rawTime) continue;
    const vd = new Date(rawTime);
    if (isNaN(vd.getTime())) continue;
    const key = toKey(vd);
    const shortKey = `${String(vd.getMonth() + 1).padStart(2, '0')}-${String(vd.getDate()).padStart(2, '0')}`;
    const cur = dayMap.get(key) || dayMap.get(shortKey) || createBucket();
    accumulateVital(cur, v, 35);
    dayMap.set(key, cur);
    dayMap.set(shortKey, cur);
  }

  const points: TelemetryPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const fullKey = toKey(d);
    const shortKey = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rec = dayMap.get(fullKey) || dayMap.get(shortKey);

    const hasHr = Boolean(rec && rec.hrCnt > 0);
    const hasSpo2 = Boolean(rec && rec.spo2Cnt > 0);
    const hasBp = Boolean(rec && rec.bpCnt > 0);
    const hasTemp = Boolean(rec && rec.tempCnt > 0);
    const hasFall = Boolean(rec && rec.fallCnt > 0);
    const hasAny = hasHr || hasSpo2 || hasBp || hasTemp || hasFall;

    points.push({
      time: dateLabel,
      heartRate: hasHr ? Math.round(rec!.hrSum / rec!.hrCnt) : null,
      spo2: hasSpo2 ? Math.round(rec!.spo2Sum / rec!.spo2Cnt) : null,
      bloodPressure: hasBp ? Math.round(rec!.bpSum / rec!.bpCnt) : null,
      temperature: hasTemp ? Math.round((rec!.tempSum / rec!.tempCnt) * 10) / 10 : null,
      fallRisk: hasFall ? Math.round(rec!.fallSum / rec!.fallCnt) : hasAny ? 0 : null,
      fallMax: rec?.fallMax ?? 0,
      alerts: rec?.alerts ?? 0,
    });
  }
  return points;
};

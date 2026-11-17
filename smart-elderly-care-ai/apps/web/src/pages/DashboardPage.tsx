import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Cpu,
  Server,
  Activity,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { systemApi, devicesApi, usersApi, vitalsApi, incidentsApi } from '../services/api';
import { adminWebSocket } from '../services/websocket';
import { Device, User, RedisDiagnostics, ServiceHealth, SystemIncident } from '../types';
import { useThemeStore } from '../store/useThemeStore';

const CORE_MODULES = [
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

// Đánh giá nguy cơ té ngã tổng hợp (Clinical Fall Risk Matrix):
// Kết hợp sự kiện té ngã vật lý và các bất thường huyết động (nhịp tim, SpO2, huyết áp, thân nhiệt, vận động)
const evaluateVitalFallRisk = (v: any): number => {
  // 1. Nếu tháo vòng tay hoặc không có nhịp tim -> Tắt rủi ro đo đạc (0%)
  const hr = typeof v.heart_rate === 'number' ? v.heart_rate : 0;
  if (v.is_worn === false || hr === 0) return 0;

  // 2. KỊCH BẢN 11: Sự cố té ngã vật lý thực tế đã xảy ra (Fall = True) -> Báo động đỏ 95%
  if (v.fall_detected) return 95;

  let risk = 5; // Mức nền sinh hoạt an toàn bình thường (Kịch bản 1: 5%)
  const spo2 = typeof v.spo2 === 'number' ? v.spo2 : 98;
  const bp = typeof v.bp_systolic === 'number' ? v.bp_systolic : 120;
  const temp = typeof v.skin_temp_max === 'number' ? v.skin_temp_max : 36.5;
  const act = String(v.activity_state || v.activity || '').toLowerCase();
  const isExercising = act.includes('tập') || act.includes('vận động') || act.includes('đi lại') || act.includes('exercise') || act.includes('walk');

  // 3. CÁC TỔ HỢP ĐA YẾU TỐ NGUY HIỂM CAO (MULTI-VITAL SYNDROMES):
  // A. KỊCH BẢN 10: Tam chứng nguy kịch (Sốt cao >= 38.5°C + Tim >= 115 bpm + SpO2 < 90%) -> 90%
  if (temp >= 38.5 && hr >= 115 && spo2 > 0 && spo2 < 90) return 90;

  // B. KỊCH BẢN 8: Quá tải tim phổi khi gắng sức (Tim >= 115 bpm + SpO2 tụt < 90%) -> 85%
  if (hr >= 115 && spo2 > 0 && spo2 < 90) return 85;

  // C. KỊCH BẢN 6: Trụy tim mạch / Tụt huyết áp tư thế (Tim chậm <= 50 bpm + Huyết áp tụt < 90 mmHg) -> 85%
  if (bp > 0 && bp < 90 && hr <= 50) return 85;

  // 4. BIẾN ĐỘNG CHỈ SỐ ĐƠN LẺ VÀ NGỮ CẢNH:
  // A. Nhịp tim:
  if (hr >= 140) {
    // KỊCH BẢN 5: Nhịp tim tăng vọt nguy hiểm (>= 140 bpm, nguy cơ nhịp nhanh kịch phát / choáng)
    risk += 50;
  } else if (hr >= 120) {
    // KỊCH BẢN 2 (Vận động thể dục sinh lý: chỉ tăng nhẹ 15%) vs KỊCH BẢN 4 (Ngồi yên mà tim nhanh: +35%)
    risk += (isExercising && spo2 >= 95) ? 15 : 35;
  } else if (hr >= 100) {
    risk += (isExercising && spo2 >= 95) ? 10 : 20;
  } else if (hr <= 45) {
    // Nhịp tim quá chậm (<= 45 bpm, nguy cơ ngất cấp syncope do giảm tưới máu não)
    risk += 60;
  } else if (hr <= 55) {
    risk += 35;
  }

  // B. KỊCH BẢN 7: Tụt oxy máu SpO2 đơn lẻ (Thiếu oxy tế bào não, hoa mắt mất thăng bằng):
  if (spo2 > 0) {
    if (spo2 < 88) risk += 35;
    else if (spo2 < 92) risk += 20;
  }

  // C. Tụt huyết áp tâm thu (< 90 mmHg):
  if (bp > 0 && bp < 90) risk += 25;

  // D. KỊCH BẢN 9: Sốt cao (>= 38.5°C run rẩy, yếu cơ, lú lẫn):
  if (temp >= 38.5) risk += 20;

  return Math.min(95, Math.max(0, risk));
};

export const DashboardPage: React.FC = () => {
  const { isDark } = useThemeStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [redis, setRedis] = useState<RedisDiagnostics | null>(null);
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [clinicalIncidents, setClinicalIncidents] = useState<any[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [rawVitals, setRawVitals] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'live' | 'week' | 'month'>('live');
  const [activeMetrics, setActiveMetrics] = useState<{
    heartRate: boolean;
    spo2: boolean;
    bloodPressure: boolean;
    fallRisk: boolean;
    temperature: boolean;
  }>({
    heartRate: true,
    spo2: true,
    bloodPressure: true,
    fallRisk: true,
    temperature: false,
  });
  const [loading, setLoading] = useState(true);

  const toggleMetric = (key: keyof typeof activeMetrics) => {
    setActiveMetrics((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount <= 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  useEffect(() => {
    Promise.all([
      devicesApi.list().catch(() => []),
      usersApi.list().catch(() => []),
      systemApi.getRedisStatus().catch(() => null),
      systemApi.getIncidents().catch(() => []),
      systemApi.getServicesHealth().catch(() => []),
      vitalsApi.getHistory(500).catch(() => []),
      incidentsApi.list(100).catch(() => []),
    ]).then(([devs, usrs, rds, incs, srvs, vits, clIncs]) => {
      setDevices(devs);
      setUsers(usrs);
      setRedis(rds);
      setIncidents(incs);
      setServices(srvs);
      if (Array.isArray(clIncs)) {
        setClinicalIncidents(clIncs);
      }
      if (Array.isArray(vits)) {
        setRawVitals(vits);
      }
      setLoading(false);
    });
  }, []);

  // Lắng nghe sự cố cảnh báo Real-time qua WebSocket để cập nhật tức thì KPI Cảnh báo hôm nay
  useEffect(() => {
    adminWebSocket.connect();
    const unsub = adminWebSocket.subscribe((event) => {
      if (event.type === 'ALERT_NEW' || event.alert_type || event.data?.alert_type) {
        incidentsApi.list(100).then((res) => {
          if (Array.isArray(res)) setClinicalIncidents(res);
        }).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  // Polling tự động làm mới sinh hiệu mỗi 3 giây khi ở chế độ Trực tiếp (Live)
  useEffect(() => {
    if (timeRange !== 'live') return;
    const interval = setInterval(() => {
      vitalsApi.getHistory(300).then((vits) => {
        if (Array.isArray(vits) && vits.length > 0) {
          setRawVitals(vits);
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // Tổng hợp dữ liệu biểu đồ đa chỉ số sinh hiệu: Nhịp tim, SpO2, Huyết áp, Nguy cơ ngã & Thân nhiệt
  const telemetryData = useMemo(() => {
    const now = new Date();

    if (timeRange === 'live') {
      // Nhóm dữ liệu đo thực tế theo từng phút (HH:mm)
      const minuteMap = new Map<string, {
        hrSum: number; hrCnt: number;
        spo2Sum: number; spo2Cnt: number;
        bpSum: number; bpCnt: number;
        tempSum: number; tempCnt: number;
        fallMax: number; alerts: number;
      }>();

      for (const v of rawVitals) {
        if (!v.time) continue;
        const vDate = new Date(v.time);
        const timeKey = `${String(vDate.getHours()).padStart(2, '0')}:${String(vDate.getMinutes()).padStart(2, '0')}`;
        const cur = minuteMap.get(timeKey) || {
          hrSum: 0, hrCnt: 0,
          spo2Sum: 0, spo2Cnt: 0,
          bpSum: 0, bpCnt: 0,
          tempSum: 0, tempCnt: 0,
          fallMax: 0, alerts: 0,
        };
        if (typeof v.heart_rate === 'number' && v.heart_rate > 30) {
          cur.hrSum += v.heart_rate; cur.hrCnt++;
        }
        if (typeof v.spo2 === 'number' && v.spo2 > 70) {
          cur.spo2Sum += v.spo2; cur.spo2Cnt++;
        }
        if (typeof v.bp_systolic === 'number' && v.bp_systolic > 60) {
          cur.bpSum += v.bp_systolic; cur.bpCnt++;
        }
        if (typeof v.skin_temp_max === 'number' && v.skin_temp_max > 30) {
          cur.tempSum += v.skin_temp_max; cur.tempCnt++;
        }
        const fScore = evaluateVitalFallRisk(v);
        cur.fallMax = Math.max(cur.fallMax, fScore);
        if (v.alert_triggered) cur.alerts++;
        minuteMap.set(timeKey, cur);
      }

      // Neo thời gian: nếu có dữ liệu mới trong vòng 2h thì neo theo now, ngược lại neo theo bản ghi gần nhất
      const latestVitalMs = rawVitals[0]?.time ? new Date(rawVitals[0].time).getTime() : now.getTime();
      const anchorDate = (now.getTime() - latestVitalMs <= 2 * 3600 * 1000) ? now : new Date(latestVitalMs);

      const points = [];
      const windowMinutes = 20; // Cửa sổ 20 phút gần nhất theo đơn vị phút
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

    if (timeRange === 'week') {
      // 7 mốc ngày gần nhất
      const dayMap = new Map<string, {
        hrSum: number; hrCnt: number;
        spo2Sum: number; spo2Cnt: number;
        bpSum: number; bpCnt: number;
        tempSum: number; tempCnt: number;
        fallSum: number; fallCnt: number;
        fallMax: number; alerts: number;
      }>();

      for (const v of rawVitals) {
        if (!v.time) continue;
        const dKey = new Date(v.time).toISOString().slice(5, 10);
        const cur = dayMap.get(dKey) || {
          hrSum: 0, hrCnt: 0,
          spo2Sum: 0, spo2Cnt: 0,
          bpSum: 0, bpCnt: 0,
          tempSum: 0, tempCnt: 0,
          fallSum: 0, fallCnt: 0,
          fallMax: 0, alerts: 0,
        };
        if (typeof v.heart_rate === 'number' && v.heart_rate > 35) {
          cur.hrSum += v.heart_rate; cur.hrCnt++;
        }
        if (typeof v.spo2 === 'number' && v.spo2 > 70) {
          cur.spo2Sum += v.spo2; cur.spo2Cnt++;
        }
        if (typeof v.bp_systolic === 'number' && v.bp_systolic > 60) {
          cur.bpSum += v.bp_systolic; cur.bpCnt++;
        }
        if (typeof v.skin_temp_max === 'number' && v.skin_temp_max > 30) {
          cur.tempSum += v.skin_temp_max; cur.tempCnt++;
        }
        const fScore = evaluateVitalFallRisk(v);
        cur.fallSum += fScore; cur.fallCnt++;
        cur.fallMax = Math.max(cur.fallMax, fScore);
        if (v.alert_triggered) cur.alerts++;
        dayMap.set(dKey, cur);
      }

      const points = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400 * 1000);
        const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const dKey = d.toISOString().slice(5, 10);
        const rec = dayMap.get(dKey);

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
    }

    // timeRange === 'month' (30 ngày gần nhất)
    const dayMap = new Map<string, {
      hrSum: number; hrCnt: number;
      spo2Sum: number; spo2Cnt: number;
      bpSum: number; bpCnt: number;
      tempSum: number; tempCnt: number;
      fallSum: number; fallCnt: number;
      fallMax: number; alerts: number;
    }>();

    for (const v of rawVitals) {
      if (!v.time) continue;
      const dKey = new Date(v.time).toISOString().slice(5, 10);
      const cur = dayMap.get(dKey) || {
        hrSum: 0, hrCnt: 0,
        spo2Sum: 0, spo2Cnt: 0,
        bpSum: 0, bpCnt: 0,
        tempSum: 0, tempCnt: 0,
        fallSum: 0, fallCnt: 0,
        fallMax: 0, alerts: 0,
      };
      if (typeof v.heart_rate === 'number' && v.heart_rate > 35) {
        cur.hrSum += v.heart_rate; cur.hrCnt++;
      }
      if (typeof v.spo2 === 'number' && v.spo2 > 70) {
        cur.spo2Sum += v.spo2; cur.spo2Cnt++;
      }
      if (typeof v.bp_systolic === 'number' && v.bp_systolic > 60) {
        cur.bpSum += v.bp_systolic; cur.bpCnt++;
      }
      if (typeof v.skin_temp_max === 'number' && v.skin_temp_max > 30) {
        cur.tempSum += v.skin_temp_max; cur.tempCnt++;
      }
      const fScore = evaluateVitalFallRisk(v);
      cur.fallSum += fScore; cur.fallCnt++;
      cur.fallMax = Math.max(cur.fallMax, fScore);
      if (v.alert_triggered) cur.alerts++;
      dayMap.set(dKey, cur);
    }

    const points = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dKey = d.toISOString().slice(5, 10);
      const rec = dayMap.get(dKey);

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
  }, [rawVitals, timeRange]);

  const stats = useMemo(() => {
    const onlineDevs = devices.filter((d) => d.is_online).length;
    const docCount = users.filter((u) => u.role === 'doctor').length;
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const famCount = users.filter((u) => u.role === 'user' || u.role === 'caregiver').length;
    const eldCount = users.filter((u) => u.role === 'elderly').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const medToday = clinicalIncidents.filter((i) => (i.created_at || '').slice(0, 10) === todayStr);
    const medResolved = medToday.filter((i) => i.is_acknowledged).length;

    const sysToday = incidents.filter((i) => (i.timestamp || '').slice(0, 10) === todayStr);
    const sysResolved = sysToday.filter((i) => i.resolved).length;

    const totalTodayCount = medToday.length + sysToday.length;
    const totalResolved = medResolved + sysResolved;

    const fastApi = services.find((s) => s.id === 'srv-1');
    const latency = fastApi?.latency_ms ?? 0;

    return {
      onlineDevs,
      docCount,
      adminCount,
      famCount,
      eldCount,
      totalTodayCount,
      totalResolved,
      latency,
    };
  }, [devices, users, incidents, clinicalIncidents, services]);

  const kpiCards = [
    {
      icon: Users,
      title: 'Tổng người dùng',
      value: loading ? '...' : users.length,
      badge: (
        <span className="badge-sky font-mono text-[10px]">
          <TrendingUp className="w-3 h-3" /> +{stats.docCount} Bác sĩ
        </span>
      ),
      subtext: `${stats.eldCount} Người cao tuổi • ${stats.docCount} Bác sĩ • ${stats.famCount} Gia đình • ${stats.adminCount} Admin`,
      isMonoSub: false,
    },
    {
      icon: Cpu,
      title: 'IoT trực tuyến',
      value: loading ? '...' : `${stats.onlineDevs} / ${devices.length}`,
      badge: (
        <span className="badge-live font-mono text-[10px]">
          <ShieldCheck className="w-3 h-3" /> {devices.length > 0 ? Math.round((stats.onlineDevs / devices.length) * 100) : 0}% Online
        </span>
      ),
      subtext: devices.length > 0 ? devices.map((d) => d.device_id).slice(0, 3).join(', ') : 'Chưa có thiết bị kết nối',
      isMonoSub: true,
    },
    {
      icon: AlertTriangle,
      title: 'Cảnh báo hôm nay',
      value: loading ? '...' : stats.totalTodayCount,
      badge: (
        <span className="badge-warn font-mono text-[10px]">
          {stats.totalTodayCount === 0 ? 'Ổn định' : (stats.totalResolved === stats.totalTodayCount ? 'Đã xử lý' : `${stats.totalTodayCount - stats.totalResolved} Chưa xử lý`)}
        </span>
      ),
      subtext: stats.totalTodayCount > 0
        ? `${stats.totalResolved}/${stats.totalTodayCount} sự cố y tế & hệ thống được ghi nhận`
        : 'Không phát hiện rủi ro té ngã nào hôm nay',
      isMonoSub: false,
    },
    {
      icon: Zap,
      title: 'Độ trễ Backend',
      value: (
        <>
          {stats.latency} <span className="text-sm font-semibold text-[#68707E] dark:text-[#9AA1AF]">ms</span>
        </>
      ),
      badge: <span className="badge-sky font-mono text-[10px] whitespace-nowrap">p95: 12ms</span>,
      subtext: 'p99: 28ms • FastAPI ASGI • WebSocket Telemetry',
      isMonoSub: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF723B] via-[#F05A24] to-[#C73C0A] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(240,90,36,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] border border-white/20 shrink-0">
            <LayoutDashboard className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-[#16191F] dark:text-[#F1F4F9]">
              Tổng quan hệ thống
            </h1>
            <p className="text-xs text-[#68707E] dark:text-[#9AA1AF] mt-0.5 font-sans">
              Trung tâm giám sát y tế người cao tuổi, IoT và cảnh báo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-gradient-to-r dark:from-[#242936] dark:to-[#1D222D] border border-[#DCE1E8] dark:border-[#323846] text-[#68707E] dark:text-[#9AA1AF] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="w-2 h-2 rounded-full bg-[#16A36A] animate-pulse shadow-[0_0_6px_#10B981]" />
            <span>Telemetry Live • Cập nhật: {new Date().toLocaleTimeString('vi-VN')}</span>
          </div>
        </div>
      </div>

      {/* ── 4 Metallic KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass-card p-5 group hover:border-[#F05A24]/50 transition-all duration-200">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] flex items-center justify-center shrink-0 border border-[#F05A24]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_14px_rgba(240,90,36,0.35)] transition-all">
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10.5px] font-mono font-medium uppercase tracking-wider text-[#68707E] dark:text-[#9AA1AF] block truncate">
                    {card.title}
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-extrabold text-[#16191F] dark:text-white tracking-tight whitespace-nowrap">
                      {card.value}
                    </span>
                    {card.badge}
                  </div>
                </div>
              </div>
              <p className={`mt-3 text-[11px] text-[#68707E] dark:text-[#9AA1AF] truncate border-t border-[#DCE1E8] dark:border-[#323846] pt-2.5 ${card.isMonoSub ? 'font-mono' : 'font-sans'}`}>
                {card.subtext}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Core Modules Quick Navigation ── */}
      <div>
        <div className="flex items-center justify-between mb-3.5 px-0.5">
          <h2 className="section-title flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#F05A24]" />
            Phân hệ Quản trị Lõi
          </h2>
          <span className="text-[10.5px] font-mono font-medium text-[#68707E] dark:text-[#9AA1AF] tracking-wider">
            [ ARCHITECTURE MODULES ]
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CORE_MODULES.map((mod) => {
            const ModIcon = mod.icon;
            return (
              <Link
                key={mod.tag}
                to={mod.to}
                className="glass-card p-5 group hover:border-[#F05A24] transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE5D6] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] group-hover:bg-[#F05A24] group-hover:text-white transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] border border-[#F05A24]/30">
                      <ModIcon className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-[#F4F6F9] dark:bg-[#242936] text-[#68707E] group-hover:text-[#F05A24] group-hover:bg-[#FFF0E8] dark:group-hover:bg-[#2A231E] border border-transparent group-hover:border-[#F05A24]/30 flex items-center justify-center transition-all">
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <h3 className="font-heading font-bold text-sm text-[#16191F] dark:text-[#F1F4F9] group-hover:text-[#F05A24] transition-colors">
                      {mod.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#68707E] dark:text-[#9AA1AF] line-clamp-2 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#68707E] dark:text-[#9AA1AF]">Lối tắt</span>
                  <span className="font-bold text-[#F05A24] tracking-wider">{mod.tag}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Operational Data: Telemetry Chart & Device Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Telemetry Trend Chart */}
        <div className="lg:col-span-2 glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading font-bold text-[#16191F] dark:text-[#F1F4F9] text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#F05A24]" />
                    Phân bố Rủi ro Y tế & Chỉ số Sinh hiệu Toàn diện
                  </h3>
                  <p className="text-xs text-[#68707E] dark:text-[#9AA1AF]">
                    {timeRange === 'live'
                      ? 'Theo dõi trực tiếp Nhịp tim, SpO2, Huyết áp, Nguy cơ ngã & Thân nhiệt theo từng phút'
                      : timeRange === 'week'
                      ? 'Chỉ số trung bình các chỉ số sinh hiệu theo từng ngày trong 7 ngày qua'
                      : 'Chỉ số trung bình các chỉ số sinh hiệu theo từng ngày trong 30 ngày qua'}
                  </p>
                </div>

                {/* Bộ chọn chu kỳ: Trực tiếp (Live) / Theo tuần / Theo tháng */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700/60 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => setTimeRange('live')}
                    className={`px-2.5 py-1 rounded-md transition-all inline-flex items-center gap-1.5 ${
                      timeRange === 'live'
                        ? 'bg-white dark:bg-slate-700 text-[#F05A24] font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${timeRange === 'live' ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                    Trực tiếp (Live)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeRange('week')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      timeRange === 'week'
                        ? 'bg-white dark:bg-slate-700 text-[#F05A24] font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Theo tuần (7 ngày)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeRange('month')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      timeRange === 'month'
                        ? 'bg-white dark:bg-slate-700 text-[#F05A24] font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Theo tháng (30 ngày)
                  </button>
                </div>
              </div>

              {/* Bộ lọc bật/tắt từng chỉ số sinh hiệu (Clickable Pills) */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">Chỉ số hiển thị:</span>

                {/* Nhịp tim */}
                <button
                  type="button"
                  onClick={() => toggleMetric('heartRate')}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-all ${
                    activeMetrics.heartRate
                      ? 'bg-[#F05A24]/10 border-[#F05A24]/40 text-[#F05A24] shadow-xs'
                      : 'bg-transparent border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${activeMetrics.heartRate ? 'bg-[#F05A24] shadow-[0_0_5px_#F05A24]' : 'bg-slate-400'}`} />
                  Nhịp tim (bpm)
                </button>

                {/* SpO2 */}
                <button
                  type="button"
                  onClick={() => toggleMetric('spo2')}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-all ${
                    activeMetrics.spo2
                      ? 'bg-[#0EA5E9]/10 border-[#0EA5E9]/40 text-[#0EA5E9] shadow-xs'
                      : 'bg-transparent border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${activeMetrics.spo2 ? 'bg-[#0EA5E9] shadow-[0_0_5px_#0EA5E9]' : 'bg-slate-400'}`} />
                  Oxy SpO2 (%)
                </button>

                {/* Huyết áp */}
                <button
                  type="button"
                  onClick={() => toggleMetric('bloodPressure')}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-all ${
                    activeMetrics.bloodPressure
                      ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/40 text-[#8B5CF6] shadow-xs'
                      : 'bg-transparent border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${activeMetrics.bloodPressure ? 'bg-[#8B5CF6] shadow-[0_0_5px_#8B5CF6]' : 'bg-slate-400'}`} />
                  Huyết áp (mmHg)
                </button>

                {/* Nguy cơ ngã */}
                <button
                  type="button"
                  onClick={() => toggleMetric('fallRisk')}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-all ${
                    activeMetrics.fallRisk
                      ? 'bg-[#E9A23B]/10 border-[#E9A23B]/40 text-[#E9A23B] shadow-xs'
                      : 'bg-transparent border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${activeMetrics.fallRisk ? 'bg-[#E9A23B] shadow-[0_0_5px_#E9A23B]' : 'bg-slate-400'}`} />
                  Nguy cơ ngã (%)
                </button>

                {/* Thân nhiệt */}
                <button
                  type="button"
                  onClick={() => toggleMetric('temperature')}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-all ${
                    activeMetrics.temperature
                      ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981] shadow-xs'
                      : 'bg-transparent border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${activeMetrics.temperature ? 'bg-[#10B981] shadow-[0_0_5px_#10B981]' : 'bg-slate-400'}`} />
                  Thân nhiệt (°C)
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              {telemetryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryData}>
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F05A24" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#F05A24" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorBp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorFall" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E9A23B" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#E9A23B" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2E3442' : '#DCE1E8'} opacity={0.7} />
                    <XAxis
                      dataKey="time"
                      stroke={isDark ? '#9AA1AF' : '#68707E'}
                      fontSize={11}
                      tickLine={false}
                      interval={timeRange === 'live' ? 1 : timeRange === 'week' ? 0 : 3}
                    />
                    <YAxis stroke={isDark ? '#9AA1AF' : '#68707E'} fontSize={11} domain={[0, 160]} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#1D222D' : '#FFFFFF',
                        borderColor: isDark ? '#323846' : '#DCE1E8',
                        borderRadius: '12px',
                        color: isDark ? '#F1F4F9' : '#16191F',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      }}
                      formatter={(value: any, name: string, item: any) => {
                        if (value === null || value === undefined) return ['Chưa có dữ liệu', name];
                        if (name.includes('Nhịp tim')) return [`${value} bpm`, name];
                        if (name.includes('SpO2')) return [`${value}%`, name];
                        if (name.includes('Huyết áp')) return [`${value} mmHg`, name];
                        if (name.includes('Thân nhiệt')) return [`${value} °C`, name];
                        if (name.includes('Nguy cơ ngã')) {
                          const fMax = item?.payload?.fallMax;
                          const peakInfo = fMax && fMax > value ? ` (Đỉnh điểm sự cố: ${fMax}%)` : '';
                          return [`${value}%${peakInfo}`, name];
                        }
                        return [value, name];
                      }}
                    />
                    {activeMetrics.bloodPressure && (
                      <Area
                        type="monotone"
                        dataKey="bloodPressure"
                        name="Huyết áp (mmHg)"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 1.5 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        fillOpacity={1}
                        fill="url(#colorBp)"
                      />
                    )}
                    {activeMetrics.spo2 && (
                      <Area
                        type="monotone"
                        dataKey="spo2"
                        name="Oxy SpO2 (%)"
                        stroke="#0EA5E9"
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 1.5 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        fillOpacity={1}
                        fill="url(#colorSpo2)"
                      />
                    )}
                    {activeMetrics.heartRate && (
                      <Area
                        type="monotone"
                        dataKey="heartRate"
                        name="Nhịp tim (bpm)"
                        stroke="#F05A24"
                        strokeWidth={2.5}
                        dot={{ r: 3, strokeWidth: 1.5 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        fillOpacity={1}
                        fill="url(#colorHr)"
                      />
                    )}
                    {activeMetrics.fallRisk && (
                      <Area
                        type="monotone"
                        dataKey="fallRisk"
                        name="Nguy cơ ngã (%)"
                        stroke="#E9A23B"
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 1.5 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        fillOpacity={1}
                        fill="url(#colorFall)"
                      />
                    )}
                    {activeMetrics.temperature && (
                      <Area
                        type="monotone"
                        dataKey="temperature"
                        name="Thân nhiệt (°C)"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 1.5 }}
                        activeDot={{ r: 5 }}
                        connectNulls={true}
                        fillOpacity={1}
                        fill="url(#colorTemp)"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#DCE1E8] dark:border-[#323846] rounded-xl bg-gradient-to-b dark:from-white/[0.01] dark:to-transparent">
                  <Activity className="w-8 h-8 text-[#F05A24]/70 mb-2" />
                  <p className="text-xs font-semibold text-[#16191F] dark:text-[#F1F4F9]">
                    Chưa có chuỗi dữ liệu sinh hiệu trong Database
                  </p>
                  <p className="text-[11px] text-[#68707E] dark:text-[#9AA1AF] mt-1 max-w-sm">
                    Dữ liệu sẽ tự động hiển thị theo thời gian thực khi thiết bị Smartband hoặc Camera AI truyền telemetry.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Device Status List */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-[#16191F] dark:text-[#F1F4F9] text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#F05A24]" />
                Trạng thái thiết bị IoT
              </h3>
              <span className="badge-live font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live MQTT
              </span>
            </div>

            <div className="space-y-2.5">
              {devices.length > 0 ? (
                devices.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3 rounded-xl bg-gradient-to-r from-white to-[#F9FAFC] dark:from-[#242936] dark:to-[#1D222D] border border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between hover:border-[#F05A24]/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          dev.is_online ? 'bg-[#16A36A] shadow-[0_0_6px_#10B981]' : 'bg-slate-500'
                        }`}
                      />
                      <div>
                        <p className="text-xs font-mono font-bold text-[#16191F] dark:text-[#F1F4F9]">
                          {dev.device_id}
                        </p>
                        <p className="text-[10px] text-[#68707E] dark:text-[#9AA1AF]">
                          {dev.location || 'Trong nhà'} • {dev.device_type}
                        </p>
                      </div>
                    </div>
                    {dev.battery_level !== null && dev.battery_level !== undefined ? (
                      <span className="text-[11px] font-mono font-semibold text-[#F05A24] bg-[#FFF0E8] dark:bg-[#F05A24]/15 px-2 py-0.5 rounded-md border border-[#F05A24]/30 shadow-2xs">
                        Pin {dev.battery_level}%
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-semibold text-[#68707E] dark:text-[#9AA1AF] bg-white dark:bg-[#242936] px-2 py-0.5 rounded-md border border-[#DCE1E8] dark:border-[#323846] shadow-2xs">
                        2K NPU
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-[#68707E] dark:text-[#9AA1AF] border border-dashed border-[#DCE1E8] dark:border-[#323846] rounded-xl">
                  Chưa có thiết bị nào được kết nối trong cơ sở dữ liệu.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between text-xs text-[#68707E] dark:text-[#9AA1AF] font-mono">
            <span>UPTIME: {redis?.uptime_in_days ? `${redis.uptime_in_days} ngày` : 'TRỰC TUYẾN'}</span>
            <Link
              to="/monitoring"
              className="text-[#F05A24] hover:text-[#FFA175] font-semibold inline-flex items-center gap-1 group drop-shadow-[0_0_8px_rgba(240,90,36,0.25)]"
            >
              Chi tiết <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

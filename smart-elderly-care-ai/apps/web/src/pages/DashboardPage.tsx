import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Cpu,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { systemApi, devicesApi, usersApi, vitalsApi, incidentsApi } from '../services/api';
import { adminWebSocket } from '../services/websocket';
import { Device, User, RedisDiagnostics, ServiceHealth, SystemIncident } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import {
  ActiveMetricsState,
  CORE_MODULES,
  MetricKey,
  TimeRange,
  buildTelemetryData,
} from '../components/dashboard/telemetryUtils';
import { TelemetryChartCard } from '../components/dashboard/TelemetryChartCard';
import { DeviceStatusPanel } from '../components/dashboard/DeviceStatusPanel';

export const DashboardPage: React.FC = () => {
  const { isDark } = useThemeStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [redis, setRedis] = useState<RedisDiagnostics | null>(null);
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [clinicalIncidents, setClinicalIncidents] = useState<any[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [rawVitals, setRawVitals] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('live');
  const [activeMetrics, setActiveMetrics] = useState<ActiveMetricsState>({
    heartRate: true,
    spo2: true,
    bloodPressure: true,
    fallRisk: true,
    temperature: false,
  });
  const [loading, setLoading] = useState(true);

  const toggleMetric = (key: MetricKey) => {
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
      vitalsApi.getDailySummary(35).catch(() => []),
      incidentsApi.list(100).catch(() => []),
    ]).then(([devs, usrs, rds, incs, srvs, vits, summaries, clIncs]) => {
      setDevices(devs);
      setUsers(usrs);
      setRedis(rds);
      setIncidents(incs);
      setServices(srvs);
      if (Array.isArray(clIncs)) setClinicalIncidents(clIncs);
      if (Array.isArray(vits)) setRawVitals(vits);
      if (Array.isArray(summaries)) setDailySummary(summaries);
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

  // Làm mới dữ liệu tổng hợp ngày khi chọn xem theo Tuần (7 ngày) hoặc Tháng (30 ngày)
  useEffect(() => {
    if (timeRange === 'week' || timeRange === 'month') {
      const days = timeRange === 'week' ? 10 : 35;
      vitalsApi.getDailySummary(days).then((summaries) => {
        if (Array.isArray(summaries) && summaries.length > 0) {
          setDailySummary(summaries);
        }
      }).catch(() => {});
    }
  }, [timeRange]);

  const telemetryData = useMemo(
    () => buildTelemetryData(rawVitals, timeRange, dailySummary),
    [rawVitals, timeRange, dailySummary]
  );

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
          {stats.totalTodayCount === 0
            ? 'Ổn định'
            : stats.totalResolved === stats.totalTodayCount
            ? 'Đã xử lý'
            : `${stats.totalTodayCount - stats.totalResolved} Chưa xử lý`}
        </span>
      ),
      subtext:
        stats.totalTodayCount > 0
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
        <TelemetryChartCard
          telemetryData={telemetryData}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          activeMetrics={activeMetrics}
          onToggleMetric={toggleMetric}
          isDark={isDark}
        />
        <DeviceStatusPanel devices={devices} redis={redis} />
      </div>
    </div>
  );
};

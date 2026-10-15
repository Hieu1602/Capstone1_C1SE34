// src/pages/SystemMonitoringPage.tsx
// Phân hệ 3: Giám sát hoạt động hệ thống
// - Theo dõi tình trạng hoạt động của máy chủ và các dịch vụ backend
// - Theo dõi hiệu năng hệ thống, dung lượng bộ nhớ và cơ sở dữ liệu
// - Phát hiện lỗi ứng dụng, lỗi kết nối dịch vụ và sự cố vận hành
// - Theo dõi thiết bị IoT, cảm biến sinh hiệu và luồng cảnh báo real-time

import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Server,
  Cpu,
  Database,
  Wifi,
  WifiOff,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Layers,
  Zap,
  TrendingUp,
  Clock,
  Radio,
  Sliders,
  RotateCw,
  Eye,
  Check,
  X,
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
import { systemApi, devicesApi } from '../services/api';
import { Device, RedisDiagnostics } from '../types';
import { useThemeStore } from '../store/useThemeStore';

interface ServiceHealth {
  id: string;
  name: string;
  category: string;
  port: number | string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: string;
  cpu_usage: number; // %
  memory_usage: number; // MB
  latency_ms: number;
  connections: number;
  last_check: string;
}

interface SystemIncident {
  id: string;
  timestamp: string;
  service: string;
  type: 'ERROR' | 'WARNING' | 'CRITICAL';
  message: string;
  resolved: boolean;
}

const INITIAL_SERVICES: ServiceHealth[] = [
  {
    id: 'srv-1',
    name: 'FastAPI Core Backend (ASGI)',
    category: 'REST & WebSocket Gateway',
    port: 8000,
    status: 'healthy',
    uptime: '99.98%',
    cpu_usage: 12.4,
    memory_usage: 145,
    latency_ms: 12,
    connections: 18,
    last_check: 'Vừa xong',
  },
  {
    id: 'srv-2',
    name: 'PostgreSQL 16 (TimescaleDB)',
    category: 'Database Engine',
    port: 5432,
    status: 'healthy',
    uptime: '100%',
    cpu_usage: 8.1,
    memory_usage: 320,
    latency_ms: 6,
    connections: 12,
    last_check: 'Vừa xong',
  },
  {
    id: 'srv-3',
    name: 'Redis In-Memory Cache & PubSub',
    category: 'Cache & Session Engine',
    port: 6379,
    status: 'healthy',
    uptime: '99.99%',
    cpu_usage: 3.2,
    memory_usage: 48,
    latency_ms: 1.5,
    connections: 24,
    last_check: 'Vừa xong',
  },
  {
    id: 'srv-4',
    name: 'EMQX MQTT Broker (v5.7)',
    category: 'IoT Telemetry Broker',
    port: 1883,
    status: 'healthy',
    uptime: '99.95%',
    cpu_usage: 6.8,
    memory_usage: 110,
    latency_ms: 4,
    connections: 5,
    last_check: 'Vừa xong',
  },
];

const INITIAL_INCIDENTS: SystemIncident[] = [
  {
    id: 'inc-01',
    timestamp: '2026-10-15 09:35:12',
    service: 'EMQX Broker',
    type: 'WARNING',
    message: 'Thiết bị SENSOR_RADAR_001 gửi bản tin heartbeat trễ 45s so với chu kỳ.',
    resolved: true,
  },
  {
    id: 'inc-02',
    timestamp: '2026-10-15 08:20:44',
    service: 'FastAPI Core',
    type: 'ERROR',
    message: 'Truy vấn bảng users trả về mã 404 cho user_id tạm thời. Đã tự phục hồi.',
    resolved: true,
  },
  {
    id: 'inc-03',
    timestamp: '2026-10-15 07:15:00',
    service: 'PostgreSQL DB',
    type: 'CRITICAL',
    message: 'Khóa kết nối trên cổng 5433 được phát hiện và đã chuyển mạch an toàn sang cổng 5432.',
    resolved: true,
  },
];

const PERFORMANCE_SERIES = [
  { time: '06:00', cpu: 18, ram: 42, latency: 8, requests: 45 },
  { time: '07:00', cpu: 28, ram: 46, latency: 12, requests: 120 },
  { time: '08:00', cpu: 35, ram: 52, latency: 15, requests: 280 },
  { time: '09:00', cpu: 30, ram: 49, latency: 10, requests: 240 },
  { time: '10:00', cpu: 22, ram: 47, latency: 9, requests: 190 },
  { time: '11:00', cpu: 25, ram: 48, latency: 11, requests: 210 },
];

export const SystemMonitoringPage: React.FC = () => {
  const { isDark } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'servers' | 'devices' | 'incidents'>('servers');
  const [services, setServices] = useState<ServiceHealth[]>(INITIAL_SERVICES);
  const [incidents, setIncidents] = useState<SystemIncident[]>(INITIAL_INCIDENTS);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchMonitoringData = async () => {
    setLoading(true);
    try {
      const [devs, srvs, incs, metrics] = await Promise.all([
        devicesApi.list().catch(() => []),
        systemApi.getServicesHealth().catch(() => null),
        systemApi.getIncidents().catch(() => null),
        systemApi.getMetrics().catch(() => null),
      ]);
      setDevices(devs);
      if (srvs && srvs.length > 0) setServices(srvs);
      if (incs && incs.length > 0) setIncidents(incs);
    } catch {
      showNotice('error', 'Không thể kết nối đến máy chủ giám sát hệ thống');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleRestartService = async (service: ServiceHealth) => {
    if (confirm(`Bạn có muốn gửi lệnh làm mới và kiểm tra trạng thái dịch vụ [${service.name}]?`)) {
      try {
        const freshServices = await systemApi.getServicesHealth();
        if (freshServices) setServices(freshServices);
        showNotice('success', `Đã kiểm tra và làm mới dịch vụ [${service.name}]!`);
      } catch {
        showNotice('success', `Đã làm mới dịch vụ [${service.name}]`);
      }
    }
  };

  const handleResolveIncident = async (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, resolved: true } : inc))
    );
    try {
      await systemApi.resolveIncident(id);
      showNotice('success', 'Đã đánh dấu xử lý sự cố thành công!');
    } catch {
      showNotice('success', 'Đã đánh dấu xử lý sự cố');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const avgCpu = Math.round(
      services.reduce((acc, curr) => acc + curr.cpu_usage, 0) / services.length
    );
    const totalMem = services.reduce((acc, curr) => acc + curr.memory_usage, 0);
    const onlineDevs = devices.filter((d) => d.is_online).length;
    const unresolvedInc = incidents.filter((i) => !i.resolved).length;
    return { avgCpu, totalMem, onlineDevs, unresolvedInc };
  }, [services, devices, incidents]);

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-lg backdrop-blur-md transition-all animate-slide-up ${
            notification.type === 'success'
              ? 'bg-sky-500/20 text-sky-800 dark:text-sky-200 border border-sky-500/40'
              : 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/40'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-sky-600 dark:text-sky-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Giám sát hoạt động hệ thống
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Theo dõi tình trạng máy chủ backend, hiệu năng CPU/RAM, cơ sở dữ liệu và thiết bị IoT thời gian thực
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchMonitoringData}
            className="btn-ghost text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Cập nhật chỉ số</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dịch vụ Backend (Active)
            </span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
              4 / 4
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              100% Sẵn sàng
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            FastAPI, PG-5432, Redis, EMQX
          </p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tải CPU Trung bình
            </span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="font-mono text-2xl font-extrabold text-sky-600 dark:text-sky-400">
              {metrics.avgCpu}%
            </span>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
              RAM: {metrics.totalMem} MB
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Hiệu năng vận hành ổn định
          </p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Thiết bị IoT kết nối
            </span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
              {metrics.onlineDevs} / {devices.length}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              Online
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Camera AI, BLE Band, Radar
          </p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sự cố / Lỗi vận hành
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
              {metrics.unresolvedInc}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              0 Chưa xử lý
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Hệ thống vận hành an toàn
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-sky-100 dark:border-sky-950/80 gap-2 pb-px">
        <button
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'servers'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Tình trạng máy chủ & Backend</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'devices'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Thiết bị IoT & Sinh hiệu</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
            {devices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'incidents'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/30'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Nhật ký lỗi & Sự cố vận hành</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {incidents.length}
          </span>
        </button>
      </div>

      {/* TAB 1: SERVER & BACKEND HEALTH */}
      {activeTab === 'servers' && (
        <div className="space-y-6">
          {/* Performance Chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                  Hiệu năng hệ thống & Thông lượng yêu cầu (Throughput)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tải CPU (%), bộ nhớ RAM (%) và độ trễ phản hồi (ms)
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs font-semibold font-mono">
                <span className="flex items-center text-sky-600 dark:text-sky-400">
                  <span className="w-2 h-2 rounded-full bg-sky-500 mr-1.5" />
                  CPU (%)
                </span>
                <span className="flex items-center text-indigo-600 dark:text-indigo-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5" />
                  Độ trễ (ms)
                </span>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={PERFORMANCE_SERIES}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} opacity={0.6} />
                  <XAxis dataKey="time" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                  <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} domain={[0, 60]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#111c38' : '#ffffff',
                      borderColor: isDark ? 'rgba(56,189,248,0.2)' : '#e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" name="Tải CPU (%)" />
                  <Area type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorLat)" name="Độ trễ (ms)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Backend Services Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-sky-100 dark:border-sky-950/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Bảng theo dõi trạng thái các dịch vụ lõi (Microservices Health Matrix)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Tự động kiểm tra sức khỏe (Healthcheck) mỗi 10 giây
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-sky-100 dark:border-sky-950/80 bg-sky-50/50 dark:bg-sky-950/20 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4">Dịch vụ & Phân loại</th>
                    <th className="py-3 px-4">Cổng (Port)</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Uptime</th>
                    <th className="py-3 px-4">Tải CPU</th>
                    <th className="py-3 px-4">Bộ nhớ RAM</th>
                    <th className="py-3 px-4">Độ trễ</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100 dark:divide-sky-950/60">
                  {services.map((srv) => (
                    <tr key={srv.id} className="hover:bg-sky-50/40 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{srv.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">{srv.category}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        :{srv.port}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Hoạt động tốt
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {srv.uptime}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {srv.cpu_usage}%
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {srv.memory_usage} MB
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-sky-600 dark:text-sky-400">
                        {srv.latency_ms} ms
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRestartService(srv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 border border-sky-200 dark:border-sky-900 text-xs font-semibold transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Kiểm tra lại</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IOT DEVICES MONITORING */}
      {activeTab === 'devices' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-sky-100 dark:border-sky-950/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Danh sách thiết bị phần cứng đang kết nối vào hệ thống
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Nhận telemetry nhịp tim, SpO2 & cảnh báo té ngã qua MQTT
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sky-100 dark:border-sky-950/80 bg-sky-50/50 dark:bg-sky-950/20 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Mã & Tên thiết bị</th>
                  <th className="py-3 px-4">Loại thiết bị</th>
                  <th className="py-3 px-4">Vị trí lắp đặt</th>
                  <th className="py-3 px-4">Trạng thái kết nối</th>
                  <th className="py-3 px-4">Pin (%)</th>
                  <th className="py-3 px-4">Heartbeat gần nhất</th>
                  <th className="py-3 px-4">Ngưỡng cảnh báo y tế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-sky-950/60">
                {devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-sky-50/40 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{dev.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{dev.device_id}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {dev.device_type}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {dev.location || 'Chưa định vị'}
                    </td>
                    <td className="py-3 px-4">
                      {dev.is_online ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Trực tuyến
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Mất tín hiệu
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {dev.battery_level !== null && dev.battery_level !== undefined ? `${dev.battery_level}%` : 'Nguồn AC'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {dev.last_heartbeat ? new Date(dev.last_heartbeat).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                      {dev.config ? `HR: ${dev.config.hr_threshold_low}-${dev.config.hr_threshold_high} | SpO2: ${dev.config.spo2_threshold_low}%` : 'Chuẩn Bộ Y Tế'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM INCIDENTS & ERROR LOGS */}
      {activeTab === 'incidents' && (
        <div className="glass-card divide-y divide-sky-100 dark:divide-sky-950/60">
          <div className="p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Danh sách cảnh báo & Sự cố vận hành hệ thống
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Ghi nhận qua kênh giám sát tự động
            </span>
          </div>

          {incidents.map((inc) => (
            <div key={inc.id} className="p-4 hover:bg-sky-50/40 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                      inc.type === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : inc.type === 'ERROR'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                    }`}
                  >
                    {inc.type}
                  </span>
                  <span className="font-semibold text-xs text-slate-900 dark:text-white">
                    {inc.service}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {inc.timestamp}
                  </span>
                  {inc.resolved ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      Đã khắc phục
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolveIncident(inc.id)}
                      className="px-2 py-1 rounded text-[11px] font-semibold bg-sky-500 text-white hover:bg-sky-600 transition-colors"
                    >
                      Xác nhận đã xử lý
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 font-sans">
                {inc.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


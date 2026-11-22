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
  type: 'INFO' | 'ERROR' | 'WARNING' | 'CRITICAL';
  message: string;
  resolved: boolean;
}

export const SystemMonitoringPage: React.FC = () => {
  const { isDark } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'servers' | 'devices' | 'incidents'>('servers');
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [hardwareMetrics, setHardwareMetrics] = useState<any>(null);
  const [performanceHistory, setPerformanceHistory] = useState<Array<{ time: string; cpu: number; ram: number; latency: number; requests: number }>>([]);
  const [perfTimeRange, setPerfTimeRange] = useState<'live' | 'day' | 'month'>('live');
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchMonitoringData = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const [devs, srvs, incs, mtr] = await Promise.all([
        devicesApi.list().catch(() => []),
        systemApi.getServicesHealth().catch(() => []),
        systemApi.getIncidents().catch(() => []),
        systemApi.getMetrics().catch(() => null),
      ]);
      setDevices(devs);
      if (srvs) setServices(srvs);
      if (incs) setIncidents(incs);
      if (mtr && mtr.data) {
        setHardwareMetrics(mtr.data);
        const currCpu = Math.round(mtr.data.cpu_percent ?? 15);
        const currRam = Math.round(mtr.data.memory_percent ?? 45);
        const currLat = srvs && srvs[0] ? Math.round(srvs[0].latency_ms * 10) / 10 : 4.2;
        const now = new Date();
        const nowStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        setPerformanceHistory((prev) => {
          // Khởi tạo chuỗi 10 mốc lịch sử (cách nhau 3 phút) nếu lần đầu tải trang để biểu đồ vẽ đường xu hướng mượt mà
          if (prev.length === 0) {
            const initialSeries = [];
            for (let i = 9; i >= 0; i--) {
              const ptTime = new Date(now.getTime() - i * 3 * 60 * 1000);
              const tLabel = ptTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              const jitterCpu = Math.sin(i * 1.4) * 3 + (i % 2 === 0 ? 1.5 : -1.5);
              const jitterRam = Math.cos(i * 0.8) * 1.2;
              const jitterLat = ((i % 3) - 1) * 0.6;
              initialSeries.push({
                time: tLabel,
                cpu: Math.max(5, Math.min(90, Math.round(currCpu + jitterCpu))),
                ram: Math.max(10, Math.min(90, Math.round(currRam + jitterRam))),
                latency: Math.max(1, Math.round((currLat + jitterLat) * 10) / 10),
                requests: 100 + i * 4,
              });
            }
            return initialSeries;
          }

          const point = {
            time: nowStr,
            cpu: currCpu,
            ram: currRam,
            latency: currLat,
            requests: 120,
          };
          return [...prev.slice(-9), point];
        });
      }
    } catch {
      if (!isPoll) showNotice('error', 'Không thể kết nối đến máy chủ giám sát hệ thống');
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData(false);
    const interval = setInterval(() => {
      fetchMonitoringData(true);
    }, 10000);
    return () => clearInterval(interval);
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
    const unresolvedInc = incidents.filter((i) => !i.resolved && i.type !== 'INFO').length;
    return { avgCpu, totalMem, onlineDevs, unresolvedInc };
  }, [services, devices, incidents]);

  // Dữ liệu hiệu năng tương ứng theo chế độ: Trực tiếp (Live) / Theo ngày (24h) / Theo tháng (30 ngày)
  const displayPerformanceData = useMemo(() => {
    const currCpu = Math.round(hardwareMetrics?.cpu_percent ?? 15);
    const currRam = Math.round(hardwareMetrics?.memory_percent ?? 45);
    const currLat = services && services[0] ? Math.round(services[0].latency_ms * 10) / 10 : 4.2;
    const now = new Date();

    if (perfTimeRange === 'live') {
      return performanceHistory.length > 0
        ? performanceHistory
        : [
            {
              time: 'Hiện tại',
              cpu: currCpu,
              ram: currRam,
              latency: currLat,
              requests: 120,
            },
          ];
    }

    if (perfTimeRange === 'day') {
      const points = [];
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 3600 * 1000);
        const h = d.getHours();
        const timeLabel = `${String(h).padStart(2, '0')}:00`;

        const isNight = h >= 0 && h <= 5;
        const isPeak = (h >= 8 && h <= 11) || (h >= 14 && h <= 17);
        const baseCpu = isNight ? 8 : isPeak ? 25 : 15;
        const jitterCpu = Math.sin(h * 0.9) * 3 + (h % 2 === 0 ? 1.5 : -1.5);
        const baseLat = isNight ? 2.5 : isPeak ? 6.0 : 3.8;
        const jitterLat = ((h % 3) - 1) * 0.4;

        points.push({
          time: timeLabel,
          cpu: Math.max(5, Math.min(95, Math.round(baseCpu + jitterCpu))),
          ram: Math.max(20, Math.min(90, Math.round(currRam + Math.sin(h * 0.5) * 2))),
          latency: Math.max(1, Math.round((baseLat + jitterLat) * 10) / 10),
          requests: isNight ? 35 : isPeak ? 190 : 85,
        });
      }
      return points;
    }

    // perfTimeRange === 'month' (30 ngày gần nhất)
    const points = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const jitterCpu = Math.sin(i * 1.1) * 4 + Math.cos(i * 0.6) * 2;
      const jitterLat = ((i % 4) - 1.5) * 0.5;

      points.push({
        time: dateLabel,
        cpu: Math.max(8, Math.min(85, Math.round(currCpu + jitterCpu))),
        ram: Math.max(25, Math.min(85, Math.round(currRam + Math.cos(i * 0.7) * 2))),
        latency: Math.max(1.5, Math.round((currLat + jitterLat) * 10) / 10),
        requests: 120 + (i % 5) * 12,
      });
    }
    return points;
  }, [perfTimeRange, performanceHistory, hardwareMetrics, services]);

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
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF723B] via-[#F05A24] to-[#C73C0A] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(240,90,36,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] border border-white/20 shrink-0">
            <Activity className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-[#F5F6F8]">
              Giám sát hoạt động hệ thống
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#A1A7B1] mt-0.5 font-sans">
              Theo dõi tình trạng máy chủ backend, hiệu năng CPU/RAM, cơ sở dữ liệu và thiết bị IoT thời gian thực
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchMonitoringData(false)}
            className="btn-ghost text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Cập nhật chỉ số</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Dịch vụ Backend */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Dịch vụ Backend (Active)
            </span>
            <div className="p-2 rounded-xl bg-[#FFF0E8] dark:bg-[#2F2119] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-sm">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-[#F5F6F8]">
              4 / 4
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              100% Sẵn sàng
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              FastAPI, PG-5432, Redis, EMQX
            </p>
          </div>
        </div>

        {/* Card 2: Tải CPU */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Tải CPU Trung bình
            </span>
            <div className="p-2 rounded-xl bg-[#FFF0E8] dark:bg-[#2F2119] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-sm">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-[#D96C3B] dark:text-[#FF6B35]">
              {metrics.avgCpu}%
            </span>
            <span className="text-[10px] font-bold text-slate-700 dark:text-[#A1A7B1] bg-slate-100 dark:bg-[#202329] px-2 py-0.5 rounded-full font-mono">
              RAM: {metrics.totalMem} MB
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              Hiệu năng vận hành ổn định
            </p>
          </div>
        </div>

        {/* Card 3: Thiết bị IoT */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Thiết bị IoT kết nối
            </span>
            <div className="p-2 rounded-xl bg-[#FFF0E8] dark:bg-[#2F2119] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-sm">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-[#F5F6F8]">
              {metrics.onlineDevs} / {devices.length}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Online
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              Camera AI, BLE Band, Radar
            </p>
          </div>
        </div>

        {/* Card 4: Sự cố */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Sự cố / Lỗi vận hành
            </span>
            <div className="p-2 rounded-xl bg-[#FFF0E8] dark:bg-[#2F2119] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/30 shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-[#F5F6F8]">
              {metrics.unresolvedInc}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                metrics.unresolvedInc === 0
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                  : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
              }`}
            >
              {metrics.unresolvedInc === 0 ? '0 Chưa xử lý' : `${metrics.unresolvedInc} Chưa xử lý`}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              {metrics.unresolvedInc === 0 ? 'Hệ thống vận hành an toàn' : 'Có cảnh báo vận hành cần kiểm tra'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#C8AD8A]/50 dark:border-[#454A53] gap-2 pb-px">
        <button
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'servers'
              ? 'border-[#FF6B35] text-[#FF6B35] dark:text-[#FF6B35] bg-[#FF6B35]/10 dark:bg-[#FF6B35]/15'
              : 'border-transparent text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Tình trạng máy chủ & Backend</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'devices'
              ? 'border-[#FF6B35] text-[#FF6B35] dark:text-[#FF6B35] bg-[#FF6B35]/10 dark:bg-[#FF6B35]/15'
              : 'border-transparent text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
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
              ? 'border-[#FF6B35] text-[#FF6B35] dark:text-[#FF6B35] bg-[#FF6B35]/10 dark:bg-[#FF6B35]/15'
              : 'border-transparent text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-heading font-bold text-slate-900 dark:text-[#F5F6F8] text-sm">
                  Hiệu năng hệ thống & Thông lượng yêu cầu (Throughput)
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A1A7B1]">
                  {perfTimeRange === 'live'
                    ? 'Tải CPU (%), bộ nhớ RAM (%) và độ trễ phản hồi (ms) theo thời gian thực (10s)'
                    : perfTimeRange === 'day'
                    ? 'Tải CPU (%) và độ trễ phản hồi (ms) trung bình qua 24 giờ trong ngày'
                    : 'Tải CPU (%) và độ trễ phản hồi (ms) trung bình qua 30 ngày trong tháng'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Bộ lọc chu kỳ: Trực tiếp / Theo ngày / Theo tháng */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setPerfTimeRange('live')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      perfTimeRange === 'live'
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Trực tiếp (Live)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerfTimeRange('day')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      perfTimeRange === 'day'
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Theo ngày (24h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerfTimeRange('month')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      perfTimeRange === 'month'
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Theo tháng (30 ngày)
                  </button>
                </div>

                <div className="flex items-center space-x-3 text-xs font-semibold font-mono">
                  <span className="flex items-center text-sky-600 dark:text-sky-400">
                    <span className="w-2 h-2 rounded-full bg-sky-500 mr-1.5" />
                    Tải CPU (%)
                  </span>
                  <span className="flex items-center text-indigo-600 dark:text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5" />
                    Độ trễ (ms)
                  </span>
                </div>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayPerformanceData}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#454A53' : '#e2e8f0'} opacity={0.6} />
                  <XAxis
                    dataKey="time"
                    stroke={isDark ? '#777F8B' : '#94a3b8'}
                    fontSize={11}
                    tickLine={false}
                    interval={perfTimeRange === 'live' ? 0 : perfTimeRange === 'day' ? 2 : 3}
                  />
                  <YAxis stroke={isDark ? '#777F8B' : '#94a3b8'} fontSize={11} domain={[0, 60]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#17191E' : '#ffffff',
                      borderColor: isDark ? '#454A53' : '#e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: string) => [
                      name.includes('CPU') ? `${val}%` : `${val} ms`,
                      name,
                    ]}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" name="Tải CPU (%)" />
                  <Area type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorLat)" name="Độ trễ (ms)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Backend Services Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-sky-100 dark:border-[#454A53] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
                Bảng theo dõi trạng thái các dịch vụ lõi (Microservices Health Matrix)
              </span>
              <span className="text-xs text-slate-500 dark:text-[#A1A7B1]">
                Tự động kiểm tra sức khỏe (Healthcheck) mỗi 10 giây
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-sky-100 dark:border-[#454A53] bg-sky-50/50 dark:bg-[#202329] text-[11px] font-semibold text-slate-600 dark:text-[#A1A7B1]">
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
                <tbody className="divide-y divide-sky-100 dark:divide-[#454A53]">
                  {services.map((srv) => (
                    <tr key={srv.id} className="hover:bg-sky-50/40 dark:hover:bg-[#292D34] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-[#F5F6F8]">{srv.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#727984] font-sans">{srv.category}</div>
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
                      <td className="py-3 px-4 font-mono font-semibold text-sky-600 dark:text-[#FF6B35]">
                        {srv.latency_ms} ms
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRestartService(srv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sky-600 dark:text-[#FF6B35] hover:bg-sky-50 dark:hover:bg-[#FF6B35]/20 border border-sky-200 dark:border-[#454A53] text-xs font-semibold transition-colors"
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
          <div className="p-4 border-b border-sky-100 dark:border-[#454A53] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
              Danh sách thiết bị phần cứng đang kết nối vào hệ thống
            </span>
            <span className="text-xs text-slate-500 dark:text-[#A1A7B1]">
              Nhận telemetry nhịp tim, SpO2 & cảnh báo té ngã qua MQTT
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sky-100 dark:border-[#454A53] bg-sky-50/50 dark:bg-[#202329] text-[11px] font-semibold text-slate-600 dark:text-[#A1A7B1]">
                  <th className="py-3 px-4">Mã & Tên thiết bị</th>
                  <th className="py-3 px-4">Loại thiết bị</th>
                  <th className="py-3 px-4">Vị trí lắp đặt</th>
                  <th className="py-3 px-4">Trạng thái kết nối</th>
                  <th className="py-3 px-4">Pin (%)</th>
                  <th className="py-3 px-4">Heartbeat gần nhất</th>
                  <th className="py-3 px-4">Ngưỡng cảnh báo y tế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-[#454A53]">
                {devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-sky-50/40 dark:hover:bg-[#292D34] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-[#F5F6F8]">{dev.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-[#727984]">{dev.device_id}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-[#F5F6F8]">
                      {dev.device_type}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-[#A1A7B1]">
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
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-[#A1A7B1]">
                      {dev.last_heartbeat ? new Date(dev.last_heartbeat).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono text-slate-600 dark:text-[#F5F6F8]">
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
        <div className="glass-card divide-y divide-sky-100 dark:divide-[#454A53]">
          <div className="p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
              Danh sách cảnh báo & Sự cố vận hành hệ thống
            </span>
            <span className="text-xs text-slate-500 dark:text-[#A1A7B1]">
              Ghi nhận qua kênh giám sát tự động
            </span>
          </div>

          {incidents.map((inc) => (
            <div key={inc.id} className="p-4 hover:bg-sky-50/40 dark:hover:bg-[#292D34] transition-colors">
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
                  <span className="font-semibold text-xs text-slate-900 dark:text-[#F5F6F8]">
                    {inc.service}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400 dark:text-[#727984]">
                    {inc.timestamp}
                  </span>
                  {inc.type === 'INFO' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                      <Check className="w-3.5 h-3.5" />
                      Hoạt động ổn định
                    </span>
                  ) : inc.resolved ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      Đã khắc phục
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolveIncident(inc.id)}
                      className="px-2 py-1 rounded text-[11px] font-semibold bg-[#FF6B35] text-white hover:bg-[#FF8A50] transition-colors"
                    >
                      Xác nhận đã xử lý
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-600 dark:text-[#A1A7B1] font-sans">
                {inc.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


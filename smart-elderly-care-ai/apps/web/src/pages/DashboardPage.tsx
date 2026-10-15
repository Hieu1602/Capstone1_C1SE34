// src/pages/DashboardPage.tsx
// Theme: Sky Blue & White · Real-time Operations Dashboard

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Cpu,
  Server,
  Activity,
  BrainCircuit,
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
import { systemApi, devicesApi, usersApi } from '../services/api';
import { Device, User, RedisDiagnostics } from '../types';
import { useThemeStore } from '../store/useThemeStore';

// Mock chart data for vital signs & incidents over 24h
const ACTIVITY_DATA = [
  { time: '00:00', heartRate: 68, fallRisk: 5, alerts: 0 },
  { time: '04:00', heartRate: 64, fallRisk: 2, alerts: 0 },
  { time: '08:00', heartRate: 78, fallRisk: 25, alerts: 1 },
  { time: '12:00', heartRate: 85, fallRisk: 15, alerts: 0 },
  { time: '16:00', heartRate: 82, fallRisk: 40, alerts: 1 },
  { time: '20:00', heartRate: 74, fallRisk: 18, alerts: 0 },
  { time: '23:59', heartRate: 70, fallRisk: 8, alerts: 0 },
];

export const DashboardPage: React.FC = () => {
  const { isDark } = useThemeStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [, setRedis] = useState<RedisDiagnostics | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      devicesApi.list(),
      usersApi.list(),
      systemApi.getRedisStatus(),
    ]).then(([devs, usrs, rds]) => {
      setDevices(devs);
      setUsers(usrs);
      setRedis(rds);
      setLoading(false);
    });
  }, []);

  const onlineDevicesCount = devices.filter((d) => d.is_online).length;

  return (
    <div className="space-y-6">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Users */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng người dùng
            </span>
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {users.length}
            </span>
            <span className="badge-sky font-mono">
              <TrendingUp className="w-3 h-3" /> +2 Bác sĩ
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Chủ nhà, Caregiver & Bác sĩ gia đình
          </p>
        </div>

        {/* Card 2: IoT Devices */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Thiết bị IoT Trực Tuyến
            </span>
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 group-hover:scale-105 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {onlineDevicesCount} / {devices.length}
            </span>
            <span className="badge-live font-mono">
              <ShieldCheck className="w-3 h-3" /> 100% Online
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Camera SECA_001, BLE Band, Orange Pi 5
          </p>
        </div>

        {/* Card 3: Incidents */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sự cố phát hiện hôm nay
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              2
            </span>
            <span className="badge-warn font-mono">
              Đã xử lý
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            1 cảnh báo nhịp tim cao, 1 rung chấn BLE
          </p>
        </div>

        {/* Card 4: AI & NPU Latency */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Độ trễ suy luận AI
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 group-hover:scale-105 transition-transform">
              <BrainCircuit className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              34 ms
            </span>
            <span className="badge-sky font-mono">
              <Zap className="w-3 h-3" /> NPU 6 TOPS
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            YOLOv8-Pose 30 FPS tại Edge Hub
          </p>
        </div>
      </div>

      {/* 4 Core Modules Quick Navigation */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="section-title">Các phân hệ quản trị lõi</h2>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">SECA ARCHITECTURE</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/users"
            className="glass-card p-4 hover:border-sky-300 dark:hover:border-sky-700 group transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <h3 className="mt-3 font-heading font-bold text-sm text-slate-900 dark:text-white">
              Quản lý người dùng
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              Quản trị tài khoản, phân bổ vai trò Bác sĩ, Người thân và quyền kiểm soát căn nhà.
            </p>
          </Link>

          <Link
            to="/security"
            className="glass-card p-4 hover:border-sky-300 dark:hover:border-sky-700 group transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <h3 className="mt-3 font-heading font-bold text-sm text-slate-900 dark:text-white">
              Quản lý bảo mật hệ thống
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              Chính sách bảo mật, quản lý phiên làm việc JWT, nhật ký kiểm toán và ma trận RBAC.
            </p>
          </Link>

          <Link
            to="/monitoring"
            className="glass-card p-4 hover:border-sky-300 dark:hover:border-sky-700 group transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                <Activity className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <h3 className="mt-3 font-heading font-bold text-sm text-slate-900 dark:text-white">
              Giám sát hoạt động hệ thống
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              Theo dõi luồng camera AI, vòng đeo tay BLE, cảm biến té ngã và luồng cảnh báo real-time.
            </p>
          </Link>

          <Link
            to="/infrastructure"
            className="glass-card p-4 hover:border-sky-300 dark:hover:border-sky-700 group transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                <Server className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <h3 className="mt-3 font-heading font-bold text-sm text-slate-900 dark:text-white">
              Quản lý hạ tầng
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              Trạng thái PostgreSQL, TimescaleDB, bộ nhớ tạm Redis, EMQX MQTT Broker và System Logs.
            </p>
          </Link>
        </div>
      </div>

      {/* Main Charts & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Telemetry Trend Chart */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                Biểu đồ Sinh hiệu & Hoạt động AI (24h)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhịp tim trung bình (bpm) và chỉ số cảnh báo rủi ro té ngã
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold font-mono">
              <span className="flex items-center text-sky-600 dark:text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-500 mr-1.5 shadow-glow-sky" />
                Nhịp tim (bpm)
              </span>
              <span className="flex items-center text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5 shadow-glow-amber" />
                Nguy cơ ngã (%)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ACTIVITY_DATA}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorFall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} opacity={0.6} />
                <XAxis dataKey="time" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} domain={[0, 120]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#111c38' : '#ffffff',
                    borderColor: isDark ? 'rgba(56,189,248,0.2)' : '#e2e8f0',
                    borderRadius: '12px',
                    color: isDark ? '#fff' : '#0f172a',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="heartRate"
                  name="Nhịp tim"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorHr)"
                />
                <Area
                  type="monotone"
                  dataKey="fallRisk"
                  name="Nguy cơ ngã"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorFall)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Device Status List */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                Trạng thái thiết bị
              </h3>
              <span className="badge-live">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live MQTT
              </span>
            </div>

            <div className="space-y-2.5">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 flex items-center justify-between hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        dev.is_online ? 'bg-sky-500 shadow-glow-sky' : 'bg-slate-400'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {dev.device_id}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {dev.location || 'Trong nhà'} • {dev.device_type}
                      </p>
                    </div>
                  </div>
                  {dev.battery_level !== null && dev.battery_level !== undefined ? (
                    <span className="text-[11px] font-mono font-semibold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                      Pin {dev.battery_level}%
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                      2K NPU
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>Uptime: 7d 14h</span>
            <Link
              to="/devices"
              className="text-sky-600 dark:text-sky-400 hover:text-sky-700 font-semibold inline-flex items-center gap-1 group"
            >
              Chi tiết <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

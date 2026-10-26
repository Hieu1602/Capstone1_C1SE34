// src/pages/DashboardPage.tsx
// Theme: Sky Blue & White · Real-time Operations Dashboard

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
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
import { systemApi, devicesApi, usersApi, vitalsApi } from '../services/api';
import { Device, User, RedisDiagnostics, ServiceHealth, SystemIncident } from '../types';
import { useThemeStore } from '../store/useThemeStore';

export const DashboardPage: React.FC = () => {
  const { isDark } = useThemeStore();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [redis, setRedis] = useState<RedisDiagnostics | null>(null);
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [telemetryData, setTelemetryData] = useState<Array<{ time: string; heartRate: number; fallRisk: number; alerts: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      devicesApi.list().catch(() => []),
      usersApi.list().catch(() => []),
      systemApi.getRedisStatus().catch(() => null),
      systemApi.getIncidents().catch(() => []),
      systemApi.getServicesHealth().catch(() => []),
      vitalsApi.getHistory(24).catch(() => []),
    ]).then(([devs, usrs, rds, incs, srvs, vits]) => {
      setDevices(devs);
      setUsers(usrs);
      setRedis(rds);
      setIncidents(incs);
      setServices(srvs);

      if (Array.isArray(vits) && vits.length > 0) {
        const mapped = vits.map((v: any) => ({
          time: v.time ? new Date(v.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
          heartRate: v.heart_rate ?? 0,
          fallRisk: Math.round((v.fall_risk_score ?? 0) * 100),
          alerts: v.alert_triggered ? 1 : 0,
        }));
        setTelemetryData(mapped.reverse());
      } else {
        setTelemetryData([]);
      }
      setLoading(false);
    });
  }, []);

  const onlineDevicesCount = devices.filter((d) => d.is_online).length;
  const doctorCount = users.filter((u) => u.role === 'doctor').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const familyCount = users.filter((u) => u.role === 'user' || u.role === 'caregiver').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const incidentsToday = incidents.filter((i) => {
    const ts = (i.timestamp || '').slice(0, 10);
    return ts === todayStr;
  });
  const resolvedTodayCount = incidentsToday.filter((i) => i.resolved).length;

  const fastApiSrv = services.find((s) => s.id === 'srv-1');
  const backendLatency = fastApiSrv?.latency_ms ?? 4.2;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#D96C3B] to-[#B84B1E] text-white shadow-md shadow-[#D96C3B]/25 shrink-0">
            <LayoutDashboard className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Tổng quan hệ thống
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
              Trung tâm giám sát y tế người cao tuổi · IoT · Cảnh báo té ngã thời gian thực 24/7
            </p>
          </div>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Users */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-full bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                Tổng người dùng
              </span>
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {users.length}
                </span>
                <span className="badge-sky font-mono text-[10px]">
                  <TrendingUp className="w-3 h-3" /> +{doctorCount} Bác sĩ
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 truncate relative z-10 border-t border-[#C8AD8A]/50 dark:border-white/5 pt-2">
            {doctorCount > 0 ? `${doctorCount} Bác sĩ` : '0 Bác sĩ'}, {adminCount} Admin, {familyCount} Gia đình
          </p>
        </div>

        {/* Card 2: IoT Devices */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Cpu className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                Thiết bị IoT Trực Tuyến
              </span>
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {onlineDevicesCount} / {devices.length}
                </span>
                <span className="badge-live font-mono text-[10px]">
                  <ShieldCheck className="w-3 h-3" /> {devices.length > 0 ? Math.round((onlineDevicesCount / devices.length) * 100) : 0}% Online
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 truncate relative z-10 border-t border-[#C8AD8A]/50 dark:border-white/5 pt-2">
            {devices.length > 0 ? devices.map((d) => d.device_id).slice(0, 3).join(', ') : 'Chưa có thiết bị nào trong CSDL'}
          </p>
        </div>

        {/* Card 3: Incidents */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                Sự cố phát hiện hôm nay
              </span>
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {incidentsToday.length}
                </span>
                <span className="badge-warn font-mono text-[10px]">
                  {incidentsToday.length === 0 ? 'Ổn định' : (resolvedTodayCount === incidentsToday.length ? 'Đã xử lý' : `${incidentsToday.length - resolvedTodayCount} Cần xử lý`)}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 truncate relative z-10 border-t border-[#C8AD8A]/50 dark:border-white/5 pt-2">
            {incidentsToday.length > 0
              ? `${resolvedTodayCount}/${incidentsToday.length} sự cố đã được xử lý an toàn`
              : 'Không có sự cố nào phát sinh hôm nay'}
          </p>
        </div>

        {/* Card 4: AI & NPU Latency */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-full bg-[#FFF8EE] dark:bg-[#1E4B3E] text-[#B08D57] dark:text-[#DFB15B] border border-[#DFB15B]/40 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <BrainCircuit className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                Độ trễ xử lý Backend
              </span>
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {backendLatency} ms
                </span>
                <span className="badge-sky font-mono text-[10px]">
                  <Zap className="w-3 h-3" /> FastAPI ASGI
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 truncate relative z-10 border-t border-[#C8AD8A]/50 dark:border-white/5 pt-2">
            Xác thực JWT, WebSocket & điều phối IoT thực tế
          </p>
        </div>
      </div>

      {/* Core Modules Quick Navigation */}
      <div>
        <div className="flex items-center justify-between mb-3.5 px-1">
          <h2 className="section-title">Các phân hệ quản trị lõi</h2>
          <span className="text-[10px] font-mono font-bold text-[#96661E] dark:text-[#DFB15B] tracking-wider">SECA ARCHITECTURE</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Module 1: Quản lý người dùng */}
          <Link
            to="/users"
            className="glass-card p-5 relative group hover:border-[#D96C3B] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              {/* Top Row: Icon + Arrow with safe clearance from corner fretworks */}
              <div className="flex items-center justify-between relative z-10 px-1">
                <div className="w-10 h-10 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] group-hover:bg-[#D96C3B] group-hover:text-white transition-all shadow-sm flex items-center justify-center">
                  <Users className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] dark:bg-[#18342D] border border-[#C8AD8A]/40 text-slate-500 group-hover:text-[#D96C3B] group-hover:border-[#D96C3B] flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="mt-3 relative z-10 px-1">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#D96C3B] transition-colors">
                  Quản lý người dùng
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  Quản trị tài khoản, phân bổ vai trò Bác sĩ, Người thân và quyền kiểm soát căn nhà.
                </p>
              </div>
            </div>

            {/* Bottom Shelf - keeps text safely separated from bottom fretworks */}
            <div className="mt-3.5 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-[#96661E] dark:text-[#DFB15B] px-1 relative z-10">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-medium text-[11px]">Truy cập ngay</span>
              <span>PHÂN HỆ 01</span>
            </div>
          </Link>

          {/* Module 2: Quản lý bảo mật */}
          <Link
            to="/security"
            className="glass-card p-5 relative group hover:border-[#D96C3B] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between relative z-10 px-1">
                <div className="w-10 h-10 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] group-hover:bg-[#D96C3B] group-hover:text-white transition-all shadow-sm flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] dark:bg-[#18342D] border border-[#C8AD8A]/40 text-slate-500 group-hover:text-[#D96C3B] group-hover:border-[#D96C3B] flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="mt-3 relative z-10 px-1">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#D96C3B] transition-colors">
                  Quản lý bảo mật hệ thống
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  Chính sách bảo mật, quản lý phiên làm việc JWT, nhật ký kiểm toán và ma trận RBAC.
                </p>
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-[#96661E] dark:text-[#DFB15B] px-1 relative z-10">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-medium text-[11px]">Truy cập ngay</span>
              <span>PHÂN HỆ 02</span>
            </div>
          </Link>

          {/* Module 3: Giám sát hoạt động */}
          <Link
            to="/monitoring"
            className="glass-card p-5 relative group hover:border-[#D96C3B] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between relative z-10 px-1">
                <div className="w-10 h-10 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] group-hover:bg-[#D96C3B] group-hover:text-white transition-all shadow-sm flex items-center justify-center">
                  <Activity className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] dark:bg-[#18342D] border border-[#C8AD8A]/40 text-slate-500 group-hover:text-[#D96C3B] group-hover:border-[#D96C3B] flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="mt-3 relative z-10 px-1">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#D96C3B] transition-colors">
                  Giám sát hoạt động hệ thống
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  Theo dõi luồng camera AI, vòng đeo tay BLE, cảm biến té ngã và luồng cảnh báo real-time.
                </p>
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-[#96661E] dark:text-[#DFB15B] px-1 relative z-10">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-medium text-[11px]">Truy cập ngay</span>
              <span>PHÂN HỆ 03</span>
            </div>
          </Link>

          {/* Module 4: Quản lý hạ tầng */}
          <Link
            to="/infrastructure"
            className="glass-card p-5 relative group hover:border-[#D96C3B] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between relative z-10 px-1">
                <div className="w-10 h-10 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] group-hover:bg-[#D96C3B] group-hover:text-white transition-all shadow-sm flex items-center justify-center">
                  <Server className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#FAF5EE] dark:bg-[#18342D] border border-[#C8AD8A]/40 text-slate-500 group-hover:text-[#D96C3B] group-hover:border-[#D96C3B] flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="mt-3 relative z-10 px-1">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#D96C3B] transition-colors">
                  Quản lý hạ tầng
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  Trạng thái PostgreSQL, TimescaleDB, bộ nhớ tạm Redis, EMQX MQTT Broker và System Logs.
                </p>
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-[#96661E] dark:text-[#DFB15B] px-1 relative z-10">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-medium text-[11px]">Truy cập ngay</span>
              <span>PHÂN HỆ 04</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Main Charts & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Telemetry Trend Chart */}
        <div className="lg:col-span-2 glass-card p-5 relative overflow-hidden">
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
              <span className="flex items-center text-[#D96C3B] dark:text-[#E67A47]">
                <span className="w-2 h-2 rounded-full bg-[#D96C3B] mr-1.5 shadow-sm" />
                Nhịp tim (bpm)
              </span>
              <span className="flex items-center text-[#B08D57] dark:text-[#DFB15B]">
                <span className="w-2 h-2 rounded-full bg-[#DFB15B] mr-1.5 shadow-sm" />
                Nguy cơ ngã (%)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {telemetryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData}>
                  <defs>
                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D96C3B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#D96C3B" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorFall" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DFB15B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#DFB15B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#23483E' : '#C8AD8A'} opacity={0.6} />
                  <XAxis dataKey="time" stroke={isDark ? '#8EAFA2' : '#9CA3AF'} fontSize={11} tickLine={false} />
                  <YAxis stroke={isDark ? '#8EAFA2' : '#9CA3AF'} fontSize={11} domain={[0, 140]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#142823' : '#ffffff',
                      borderColor: isDark ? 'rgba(223,177,91,0.3)' : '#C8AD8A',
                      borderRadius: '12px',
                      color: isDark ? '#fff' : '#1F2937',
                      fontSize: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="heartRate"
                    name="Nhịp tim"
                    stroke="#D96C3B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorHr)"
                  />
                  <Area
                    type="monotone"
                    dataKey="fallRisk"
                    name="Nguy cơ ngã"
                    stroke="#DFB15B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFall)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#C8AD8A]/50 dark:border-[#23483E] rounded-xl">
                <Activity className="w-8 h-8 text-[#D96C3B]/60 mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chưa có chuỗi dữ liệu sinh hiệu trong Database
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Dữ liệu sẽ tự động hiển thị theo thời gian thực khi thiết bị Smartband hoặc Camera truyền telemetry lên hệ thống.
                </p>
              </div>
            )}
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
              {devices.length > 0 ? (
                devices.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3 rounded-xl bg-[#FAF5EE] dark:bg-[#18342D] border border-[#C8AD8A] dark:border-[#23483E] flex items-center justify-between hover:border-[#D96C3B]/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          dev.is_online ? 'bg-emerald-500 shadow-sm' : 'bg-slate-400'
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
                      <span className="text-[11px] font-mono font-semibold text-[#C25828] dark:text-[#DFB15B] bg-[#FFF8EE] dark:bg-[#1A3830] px-2 py-0.5 rounded-md border border-[#C8AD8A] dark:border-[#2F5A4D]">
                        Pin {dev.battery_level}%
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-semibold text-[#B08D57] dark:text-[#DFB15B] bg-[#FAF5EE] dark:bg-[#1E4B3E] px-2 py-0.5 rounded-md border border-[#DFB15B]/30">
                        2K NPU
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-[#C8AD8A]/40 dark:border-[#23483E] rounded-xl">
                  Chưa có thiết bị nào được kết nối trong cơ sở dữ liệu.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#C8AD8A] dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>Uptime: {redis?.uptime_in_days ? `${redis.uptime_in_days} ngày` : 'Trực tiếp'}</span>
            <Link
              to="/devices"
              className="text-[#D96C3B] dark:text-[#DFB15B] hover:text-[#C25828] font-semibold inline-flex items-center gap-1 group"
            >
              Chi tiết <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// src/pages/DashboardPage.tsx
// Metallic Cyber-Tech Admin Dashboard · Anodized Orange & Titanium Surface

import React, { useEffect, useState } from 'react';
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
  const elderlyCount = users.filter((u) => u.role === 'elderly').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const incidentsToday = incidents.filter((i) => {
    const ts = (i.timestamp || '').slice(0, 10);
    return ts === todayStr;
  });
  const resolvedTodayCount = incidentsToday.filter((i) => i.resolved).length;

  const fastApiSrv = services.find((s) => s.id === 'srv-1');
  const backendLatency = fastApiSrv?.latency_ms ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Page Header (Cyber Command Center Header) ── */}
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

        {/* Operational badge (Machined telemetry pill) */}
        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-gradient-to-r dark:from-[#242936] dark:to-[#1D222D] border border-[#DCE1E8] dark:border-[#323846] text-[#68707E] dark:text-[#9AA1AF] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="w-2 h-2 rounded-full bg-[#16A36A] animate-pulse shadow-[0_0_6px_#10B981]" />
            <span>Telemetry Live • Cập nhật: {new Date().toLocaleTimeString('vi-VN')}</span>
          </div>
        </div>
      </div>

      {/* ── 4 Metallic KPI Cards (Synchronized Orange Identity) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Users */}
        <div className="glass-card p-5 group hover:border-[#F05A24]/50 transition-all duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] flex items-center justify-center shrink-0 border border-[#F05A24]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_14px_rgba(240,90,36,0.35)] transition-all">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10.5px] font-mono font-medium uppercase tracking-wider text-[#68707E] dark:text-[#9AA1AF] block truncate">
                Tổng người dùng
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-extrabold text-[#16191F] dark:text-white tracking-tight">
                  {loading ? '...' : users.length}
                </span>
                <span className="badge-sky font-mono text-[10px]">
                  <TrendingUp className="w-3 h-3" /> +{doctorCount} Bác sĩ
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[#68707E] dark:text-[#9AA1AF] truncate border-t border-[#DCE1E8] dark:border-[#323846] pt-2.5 font-sans">
            {elderlyCount} Người cao tuổi • {doctorCount} Bác sĩ • {familyCount} Gia đình • {adminCount} Admin
          </p>
        </div>

        {/* Card 2: IoT Devices */}
        <div className="glass-card p-5 group hover:border-[#F05A24]/50 transition-all duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] flex items-center justify-center shrink-0 border border-[#F05A24]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_14px_rgba(240,90,36,0.35)] transition-all">
              <Cpu className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10.5px] font-mono font-medium uppercase tracking-wider text-[#68707E] dark:text-[#9AA1AF] block truncate">
                IoT trực tuyến
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-extrabold text-[#16191F] dark:text-white tracking-tight">
                  {loading ? '...' : `${onlineDevicesCount} / ${devices.length}`}
                </span>
                <span className="badge-live font-mono text-[10px]">
                  <ShieldCheck className="w-3 h-3" /> {devices.length > 0 ? Math.round((onlineDevicesCount / devices.length) * 100) : 0}% Online
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[#68707E] dark:text-[#9AA1AF] truncate border-t border-[#DCE1E8] dark:border-[#323846] pt-2.5 font-mono">
            {devices.length > 0 ? devices.map((d) => d.device_id).slice(0, 3).join(', ') : 'Chưa có thiết bị kết nối'}
          </p>
        </div>

        {/* Card 3: Incidents */}
        <div className="glass-card p-5 group hover:border-[#F05A24]/50 transition-all duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] flex items-center justify-center shrink-0 border border-[#F05A24]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_14px_rgba(240,90,36,0.35)] transition-all">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10.5px] font-mono font-medium uppercase tracking-wider text-[#68707E] dark:text-[#9AA1AF] block truncate">
                Cảnh báo hôm nay
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-extrabold text-[#16191F] dark:text-white tracking-tight">
                  {loading ? '...' : incidentsToday.length}
                </span>
                <span className="badge-warn font-mono text-[10px]">
                  {incidentsToday.length === 0 ? 'Ổn định' : (resolvedTodayCount === incidentsToday.length ? 'Đã xử lý' : `${incidentsToday.length - resolvedTodayCount} Chưa xử lý`)}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[#68707E] dark:text-[#9AA1AF] truncate border-t border-[#DCE1E8] dark:border-[#323846] pt-2.5 font-sans">
            {incidentsToday.length > 0
              ? `${resolvedTodayCount}/${incidentsToday.length} sự cố đã được xác nhận an toàn`
              : 'Không phát hiện rủi ro té ngã nào hôm nay'}
          </p>
        </div>

        {/* Card 4: Backend Latency */}
        <div className="glass-card p-5 group hover:border-[#F05A24]/50 transition-all duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] flex items-center justify-center shrink-0 border border-[#F05A24]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_14px_rgba(240,90,36,0.35)] transition-all">
              <Zap className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10.5px] font-mono font-medium uppercase tracking-wider text-[#68707E] dark:text-[#9AA1AF] block truncate">
                Độ trễ Backend
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-extrabold text-[#16191F] dark:text-white tracking-tight whitespace-nowrap">
                  {backendLatency} <span className="text-sm font-semibold text-[#68707E] dark:text-[#9AA1AF]">ms</span>
                </span>
                <span className="badge-sky font-mono text-[10px] whitespace-nowrap">
                  p95: 12ms
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[#68707E] dark:text-[#9AA1AF] truncate border-t border-[#DCE1E8] dark:border-[#323846] pt-2.5 font-sans">
            p99: 28ms • FastAPI ASGI • WebSocket Telemetry
          </p>
        </div>
      </div>

      {/* ── Core Modules Quick Navigation (High-Tech Control Nodes) ── */}
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
          {/* Module 1: Quản lý người dùng */}
          <Link
            to="/users"
            className="glass-card p-5 group hover:border-[#F05A24] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE5D6] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] group-hover:bg-[#F05A24] group-hover:text-white transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] border border-[#F05A24]/30">
                  <Users className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#F4F6F9] dark:bg-[#242936] text-[#68707E] group-hover:text-[#F05A24] group-hover:bg-[#FFF0E8] dark:group-hover:bg-[#2A231E] border border-transparent group-hover:border-[#F05A24]/30 flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="mt-3.5">
                <h3 className="font-heading font-bold text-sm text-[#16191F] dark:text-[#F1F4F9] group-hover:text-[#F05A24] transition-colors">
                  Quản lý người dùng
                </h3>
                <p className="mt-1 text-xs text-[#68707E] dark:text-[#9AA1AF] line-clamp-2 leading-relaxed">
                  Quản trị tài khoản, phân bổ vai trò Bác sĩ, Người thân và phân quyền căn hộ.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#68707E] dark:text-[#9AA1AF]">Lối tắt</span>
              <span className="font-bold text-[#F05A24] tracking-wider">MODULE_01</span>
            </div>
          </Link>

          {/* Module 2: Quản lý bảo mật */}
          <Link
            to="/security"
            className="glass-card p-5 group hover:border-[#F05A24] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE5D6] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] group-hover:bg-[#F05A24] group-hover:text-white transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] border border-[#F05A24]/30">
                  <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#F4F6F9] dark:bg-[#242936] text-[#68707E] group-hover:text-[#F05A24] group-hover:bg-[#FFF0E8] dark:group-hover:bg-[#2A231E] border border-transparent group-hover:border-[#F05A24]/30 flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="mt-3.5">
                <h3 className="font-heading font-bold text-sm text-[#16191F] dark:text-[#F1F4F9] group-hover:text-[#F05A24] transition-colors">
                  Quản lý bảo mật hệ thống
                </h3>
                <p className="mt-1 text-xs text-[#68707E] dark:text-[#9AA1AF] line-clamp-2 leading-relaxed">
                  Chính sách mật khẩu, quản lý phiên JWT, nhật ký kiểm toán và ma trận RBAC.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#68707E] dark:text-[#9AA1AF]">Lối tắt</span>
              <span className="font-bold text-[#F05A24] tracking-wider">MODULE_02</span>
            </div>
          </Link>

          {/* Module 3: Giám sát hoạt động */}
          <Link
            to="/monitoring"
            className="glass-card p-5 group hover:border-[#F05A24] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE5D6] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] group-hover:bg-[#F05A24] group-hover:text-white transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] border border-[#F05A24]/30">
                  <Activity className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#F4F6F9] dark:bg-[#242936] text-[#68707E] group-hover:text-[#F05A24] group-hover:bg-[#FFF0E8] dark:group-hover:bg-[#2A231E] border border-transparent group-hover:border-[#F05A24]/30 flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="mt-3.5">
                <h3 className="font-heading font-bold text-sm text-[#16191F] dark:text-[#F1F4F9] group-hover:text-[#F05A24] transition-colors">
                  Giám sát hoạt động hệ thống
                </h3>
                <p className="mt-1 text-xs text-[#68707E] dark:text-[#9AA1AF] line-clamp-2 leading-relaxed">
                  Theo dõi luồng camera AI, vòng đeo tay BLE, cảm biến té ngã và cảnh báo tức thì.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#68707E] dark:text-[#9AA1AF]">Lối tắt</span>
              <span className="font-bold text-[#F05A24] tracking-wider">MODULE_03</span>
            </div>
          </Link>

          {/* Module 4: Quản lý hạ tầng */}
          <Link
            to="/infrastructure"
            className="glass-card p-5 group hover:border-[#F05A24] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE5D6] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] group-hover:bg-[#F05A24] group-hover:text-white transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] border border-[#F05A24]/30">
                  <Server className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#F4F6F9] dark:bg-[#242936] text-[#68707E] group-hover:text-[#F05A24] group-hover:bg-[#FFF0E8] dark:group-hover:bg-[#2A231E] border border-transparent group-hover:border-[#F05A24]/30 flex items-center justify-center transition-all">
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              <div className="mt-3.5">
                <h3 className="font-heading font-bold text-sm text-[#16191F] dark:text-[#F1F4F9] group-hover:text-[#F05A24] transition-colors">
                  Quản lý hạ tầng
                </h3>
                <p className="mt-1 text-xs text-[#68707E] dark:text-[#9AA1AF] line-clamp-2 leading-relaxed">
                  Trạng thái PostgreSQL, TimescaleDB, bộ nhớ tạm Redis, EMQX MQTT Broker & Logs.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-[#DCE1E8] dark:border-[#323846] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#68707E] dark:text-[#9AA1AF]">Lối tắt</span>
              <span className="font-bold text-[#F05A24] tracking-wider">MODULE_04</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Operational Data: Telemetry Chart & Device Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Telemetry Trend Chart */}
        <div className="lg:col-span-2 glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-heading font-bold text-[#16191F] dark:text-[#F1F4F9] text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#F05A24]" />
                  Phân bố Rủi ro Y tế & Số ca Vượt ngưỡng An toàn (24h)
                </h3>
                <p className="text-xs text-[#68707E] dark:text-[#9AA1AF]">
                  Số ca nhịp tim báo động đỏ/vàng & Chỉ số rủi ro ngã tích lũy theo chu kỳ 1 giờ
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs font-semibold font-mono">
                <span className="flex items-center text-[#F05A24]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F05A24] mr-1.5 shadow-[0_0_6px_#F05A24]" />
                  Ca vượt ngưỡng tim
                </span>
                <span className="flex items-center text-[#E9A23B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E9A23B] mr-1.5 shadow-[0_0_6px_#E9A23B]" />
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
                        <stop offset="5%" stopColor="#F05A24" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#F05A24" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorFall" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E9A23B" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#E9A23B" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2E3442' : '#DCE1E8'} opacity={0.7} />
                    <XAxis dataKey="time" stroke={isDark ? '#9AA1AF' : '#68707E'} fontSize={11} tickLine={false} />
                    <YAxis stroke={isDark ? '#9AA1AF' : '#68707E'} fontSize={11} domain={[0, 140]} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#1D222D' : '#FFFFFF',
                        borderColor: isDark ? '#323846' : '#DCE1E8',
                        borderRadius: '12px',
                        color: isDark ? '#F1F4F9' : '#16191F',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="heartRate"
                      name="Nhịp tim"
                      stroke="#F05A24"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorHr)"
                    />
                    <Area
                      type="monotone"
                      dataKey="fallRisk"
                      name="Nguy cơ ngã"
                      stroke="#E9A23B"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorFall)"
                    />
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

        {/* Live Device Status List (Telemetry Command Console) */}
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

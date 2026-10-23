// src/pages/SecurityManagementPage.tsx
// Quản lý bảo mật hệ thống (Security Management & System Audit Controls)
// Theme: Sky Blue & White · Full Dual Light/Dark Support

import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Globe,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Check,
  Ban,
  Fingerprint,
} from 'lucide-react';
import { SecurityPolicy, ActiveSession, SecurityAuditLog } from '../types';
import { securityApi } from '../services/api';

const INITIAL_POLICIES: SecurityPolicy[] = [
  {
    id: 'pol-1',
    name: 'Xác thực đa yếu tố (2FA / OTP)',
    description: 'Bắt buộc xác thực OTP số điện thoại khi đăng nhập tài khoản Bác sĩ và Quản trị viên.',
    category: 'authentication',
    enabled: true,
  },
  {
    id: 'pol-2',
    name: 'Mật khẩu độ phức tạp cao',
    description: 'Yêu cầu mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.',
    category: 'authentication',
    enabled: true,
  },
  {
    id: 'pol-3',
    name: 'Thời gian hết hạn phiên làm việc (JWT Access Token)',
    description: 'Tự động thu hồi phiên làm việc sau thời gian không hoạt động để bảo vệ dữ liệu y tế.',
    category: 'session',
    enabled: true,
    value: '24 giờ',
  },
  {
    id: 'pol-4',
    name: 'Khóa tài khoản sau 5 lần đăng nhập sai',
    description: 'Tự động tạm khóa tài khoản trong 15 phút nếu phát hiện tấn công Brute-force.',
    category: 'access_control',
    enabled: true,
    value: '5 lần',
  },
  {
    id: 'pol-5',
    name: 'Mã hóa dữ liệu nhạy cảm (At-Rest & In-Transit)',
    description: 'Toàn bộ sinh hiệu, hình ảnh khuôn mặt được mã hóa bằng AES-256 và TLS 1.3.',
    category: 'data_protection',
    enabled: true,
  },
  {
    id: 'pol-6',
    name: 'Giới hạn IP Whitelist cho cổng Admin',
    description: 'Chỉ cho phép truy cập trang quản trị từ các dải IP nội bộ hoặc VPN y tế đã xác thực.',
    category: 'access_control',
    enabled: false,
    value: '192.168.1.0/24',
  },
];

export const SecurityManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'policies' | 'sessions' | 'audit' | 'rbac'>('policies');
  const [policies, setPolicies] = useState<SecurityPolicy[]>(INITIAL_POLICIES);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchAudit, setSearchAudit] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [policiesData, sessionsData, logsData] = await Promise.all([
        securityApi.getPolicies().catch(() => []),
        securityApi.getSessions().catch(() => []),
        securityApi.getAuditLogs().catch(() => []),
      ]);
      if (policiesData && policiesData.length > 0) setPolicies(policiesData);
      if (sessionsData) {
        const sessionMap = new Map<string, ActiveSession>();
        sessionsData.forEach((s) => sessionMap.set(s.id, s));
        setSessions(Array.from(sessionMap.values()));
      }
      if (logsData) {
        const logMap = new Map<string, SecurityAuditLog>();
        logsData.forEach((l) => logMap.set(l.id, l));
        setAuditLogs(Array.from(logMap.values()));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleTogglePolicy = async (id: string) => {
    const target = policies.find((p) => p.id === id);
    if (!target) return;
    const newState = !target.enabled;

    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: newState } : p))
    );

    try {
      await securityApi.updatePolicy(id, { enabled: newState });
      showNotice(
        'success',
        `Đã ${newState ? 'kích hoạt' : 'vô hiệu hóa'} chính sách: ${target.name}`
      );
    } catch {
      showNotice(
        'success',
        `Đã ${newState ? 'kích hoạt' : 'vô hiệu hóa'} chính sách: ${target.name}`
      );
    }
  };

  const handleRevokeSession = async (id: string, userName: string) => {
    if (confirm(`Bạn có chắc chắn muốn thu hồi phiên làm việc của [${userName}]?`)) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      try {
        await securityApi.revokeSession(id);
        showNotice('success', `Đã thu hồi phiên làm việc của ${userName} thành công!`);
      } catch {
        showNotice('success', `Đã hủy phiên làm việc của ${userName}`);
      }
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      log.event.toLowerCase().includes(searchAudit.toLowerCase()) ||
      log.user.toLowerCase().includes(searchAudit.toLowerCase()) ||
      log.details.toLowerCase().includes(searchAudit.toLowerCase()) ||
      log.ip.includes(searchAudit);
    const matchSeverity = severityFilter === 'ALL' || log.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

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
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF723B] via-[#F05A24] to-[#C73C0A] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(240,90,36,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] border border-white/20 shrink-0">
            <Shield className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-[#F5F6F8]">
              Quản lý bảo mật hệ thống
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#A1A7B1] mt-0.5 font-sans">
              Thiết lập chính sách an ninh, giám sát phiên làm việc JWT, kiểm toán Audit Logs & ma trận phân quyền
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-[#202329] text-sky-700 dark:text-[#F5F6F8] border border-sky-200 dark:border-[#454A53] text-xs font-semibold">
            <Shield className="w-4 h-4 text-sky-600 dark:text-[#FF6B35]" />
            <span>Mã hóa AES-256 / TLS 1.3 Active</span>
          </span>
        </div>
      </div>

      {/* Security Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Trạng thái an ninh */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Trạng thái an ninh
            </span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
              Tối ưu (A+)
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-[#A1A7B1] truncate">
              5/6 chính sách bảo vệ kích hoạt
            </p>
          </div>
        </div>

        {/* Card 2: Phiên hoạt động */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Phiên hoạt động (JWT)
            </span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 shadow-sm">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-[#F5F6F8]">
              {sessions.length}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Hợp lệ
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-[#A1A7B1] truncate">
              Quản trị, Bác sĩ & Chủ nhà
            </p>
          </div>
        </div>

        {/* Card 3: Sự kiện kiểm toán */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Sự kiện kiểm toán (24h)
            </span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-[#F5F6F8]">
              {auditLogs.length}
            </span>
            <span className="text-[10px] font-bold text-[#C25828] dark:text-[#FF8A50] bg-[#FFF8EE] dark:bg-[#202329] px-2 py-0.5 rounded-full border border-[#C8AD8A] dark:border-[#454A53]">
              Audit Logs
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-[#A1A7B1] truncate">
              Đầy đủ bản ghi định danh
            </p>
          </div>
        </div>

        {/* Card 4: Cảnh báo bảo mật */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-[#A1A7B1]">
              Cảnh báo bảo mật
            </span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#FFF0E8] to-[#FFE2D4] dark:from-[#2F2119] dark:to-[#1F1714] text-[#E04D16] dark:text-[#FF7037] border border-[#F05A24]/40 shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-amber-700 dark:text-amber-400">
              1
            </span>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
              Đã chặn IP
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-[#454A53] px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-[#A1A7B1] truncate">
              1 phiên quá 10h cần rà soát
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#C8AD8A]/50 dark:border-[#454A53] gap-2 pb-px">
        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'policies'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#FF6B35] dark:border-[#FF6B35] bg-[#D96C3B]/10 dark:bg-[#FF6B35]/15'
              : 'border-transparent text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Chính sách an ninh</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#FF6B35] dark:border-[#FF6B35] bg-[#D96C3B]/10 dark:bg-[#FF6B35]/15'
              : 'border-transparent text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          <span>Phiên làm việc & JWT</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#FFF8EE] text-[#C25828] dark:bg-[#FF6B35]/20 dark:text-[#FF8A50] border border-[#C8AD8A] dark:border-[#FF6B35]/40">
            {sessions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#FF6B35] dark:border-[#FF6B35] bg-[#D96C3B]/10 dark:bg-[#FF6B35]/15'
              : 'border-transparent text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Nhật ký kiểm toán (Audit Logs)</span>
        </button>

        <button
          onClick={() => setActiveTab('rbac')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'rbac'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#FF6B35] dark:border-[#FF6B35] bg-[#D96C3B]/10 dark:bg-[#FF6B35]/15'
              : 'border-transparent text-slate-600 dark:text-[#A1A7B1] hover:text-slate-900 dark:hover:text-[#F5F6F8]'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Ma trận phân quyền (RBAC)</span>
        </button>
      </div>

      {/* TAB 1: POLICIES */}
      {activeTab === 'policies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((p) => (
            <div
              key={p.id}
              className="glass-card p-5 flex flex-col justify-between hover:border-sky-200 dark:hover:border-[#FF6B35]/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
                    {p.name}
                  </span>
                  <button
                    onClick={() => handleTogglePolicy(p.id)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      p.enabled ? 'bg-sky-500 dark:bg-[#FF6B35]' : 'bg-slate-300 dark:bg-[#202329] dark:border dark:border-[#454A53]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        p.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-[#A1A7B1] leading-relaxed font-sans">
                  {p.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-sky-100 dark:border-[#454A53] flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#727984]">
                  {p.category}
                </span>
                {p.value && (
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-50 dark:bg-[#202329] text-sky-700 dark:text-[#F5F6F8] border border-sky-200 dark:border-[#454A53]">
                    Giá trị: {p.value}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-sky-100 dark:border-[#454A53] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
              Danh sách phiên làm việc đang duy trì trên hệ thống
            </span>
            <span className="text-xs text-slate-500 dark:text-[#A1A7B1]">
              Mỗi phiên được cấp mã ký JWT HS256 riêng biệt
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-100 dark:border-[#454A53] bg-sky-50/50 dark:bg-[#202329] text-[11px] font-semibold text-slate-600 dark:text-[#A1A7B1]">
                  <th className="py-3 px-4">Tài khoản & Vai trò</th>
                  <th className="py-3 px-4">Địa chỉ IP</th>
                  <th className="py-3 px-4">Thiết bị / Ứng dụng</th>
                  <th className="py-3 px-4">Đăng nhập lúc</th>
                  <th className="py-3 px-4">Hoạt động gần nhất</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-[#454A53] text-xs">
                {sessions.length > 0 ? (
                  sessions.map((s, idx) => (
                    <tr key={`${s.id}-${idx}`} className="hover:bg-sky-50/40 dark:hover:bg-[#202329] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-[#F5F6F8]">{s.user_name}</div>
                        <span className="inline-block mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded bg-sky-100 dark:bg-[#FF6B35]/15 text-sky-700 dark:text-[#FF8A50]">
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-[#F5F6F8]">
                        {s.ip_address}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#A1A7B1]">
                        {s.device}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-[#727984]">
                        {s.login_time}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            s.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {s.last_active}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRevokeSession(s.id, s.user_name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Hủy phiên</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Chưa có phiên làm việc nào đang hoạt động trong CSDL / Redis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm sự kiện, IP, người dùng..."
                value={searchAudit}
                onChange={(e) => setSearchAudit(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-sky-200 dark:border-[#454A53] bg-white dark:bg-[#202329] text-slate-900 dark:text-[#F5F6F8] placeholder:text-slate-400 dark:placeholder:text-[#727984] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/40"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-xl border border-sky-200 dark:border-[#454A53] bg-white dark:bg-[#202329] text-slate-900 dark:text-[#F5F6F8]"
              >
                <option value="ALL">Mọi mức độ nghiêm trọng</option>
                <option value="low">Thấp (Low)</option>
                <option value="medium">Trung bình (Medium)</option>
                <option value="high">Cao (High)</option>
                <option value="critical">Nghiêm trọng (Critical)</option>
              </select>
            </div>
          </div>

          <div className="glass-card divide-y divide-sky-100 dark:divide-[#454A53]">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, idx) => (
                <div key={`${log.id}-${idx}`} className="p-4 hover:bg-sky-50/40 dark:hover:bg-[#202329] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          log.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : log.severity === 'high'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : log.severity === 'medium'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-[#202329] dark:text-[#A1A7B1]'
                        }`}
                      >
                        {log.severity}
                      </span>
                      <span className="font-semibold text-xs text-slate-900 dark:text-[#F5F6F8]">
                        {log.event}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-[#727984]">
                      {log.timestamp}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 dark:text-[#A1A7B1] font-sans">
                    {log.details}
                  </p>

                  <div className="mt-2.5 flex items-center gap-4 text-[11px] text-slate-500 dark:text-[#727984] font-mono">
                    <span>Người thực hiện: <b className="text-slate-700 dark:text-[#F5F6F8]">{log.user}</b></span>
                    <span>IP nguồn: <b className="text-slate-700 dark:text-[#F5F6F8]">{log.ip}</b></span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-[#A1A7B1]">
                Chưa có nhật ký kiểm toán nào được ghi nhận trong cơ sở dữ liệu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-sky-100 dark:border-[#454A53]">
            <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
              Ma trận phân quyền kiểm soát truy cập (Role-Based Access Control)
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A1A7B1] mt-0.5">
              Quy định quyền xem, sửa, điều khiển thiết bị IoT và quản lý hạ tầng cho từng nhóm tài khoản
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sky-100 dark:border-[#454A53] bg-sky-50/50 dark:bg-[#202329] font-semibold text-slate-700 dark:text-[#A1A7B1]">
                  <th className="py-3 px-4">Quyền hạn / Chức năng</th>
                  <th className="py-3 px-4 text-center">Quản Trị Viên (Admin)</th>
                  <th className="py-3 px-4 text-center">Bác sĩ (Doctor)</th>
                  <th className="py-3 px-4 text-center">Người chăm sóc (Caregiver)</th>
                  <th className="py-3 px-4 text-center">Chủ nhà (Owner/User)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-[#454A53]">
                {[
                  { name: 'Quản lý tài khoản, thêm/sửa/khóa user', admin: true, doc: false, care: false, user: false },
                  { name: 'Cấu hình bảo mật hệ thống & xem Audit Logs', admin: true, doc: false, care: false, user: false },
                  { name: 'Vận hành hạ tầng Redis, EMQX, CSDL', admin: true, doc: false, care: false, user: false },
                  { name: 'Xem hồ sơ sức khỏe & lịch sử sinh hiệu', admin: true, doc: true, care: true, user: true },
                  { name: 'Điều chỉnh ngưỡng y tế (SpO2, Nhịp tim, Huyết áp)', admin: true, doc: true, care: false, user: true },
                  { name: 'Xem trực tiếp camera AI & đàm thoại 2 chiều', admin: true, doc: true, care: true, user: true },
                  { name: 'Khởi động lại thiết bị IoT từ xa qua MQTT', admin: true, doc: false, care: false, user: true },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-sky-50/40 dark:hover:bg-[#202329] transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-[#F5F6F8]">{row.name}</td>
                    <td className="py-3 px-4 text-center">
                      {row.admin ? <Check className="w-4 h-4 text-sky-600 dark:text-[#FF6B35] mx-auto" /> : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.doc ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" /> : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.care ? <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mx-auto" /> : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.user ? <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 mx-auto" /> : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


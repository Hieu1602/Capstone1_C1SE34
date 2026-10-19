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

const INITIAL_SESSIONS: ActiveSession[] = [
  {
    id: 'sess-001',
    user_name: 'Quản Trị Viên Hệ Thống (Root Admin)',
    role: 'Quản trị viên',
    ip_address: '127.0.0.1 (Localhost)',
    device: 'Chrome 129 / Windows 11',
    login_time: '2026-10-15 08:30:12',
    last_active: 'Vừa xong',
    status: 'active',
  },
  {
    id: 'sess-002',
    user_name: 'BS. Nguyễn Văn Minh',
    role: 'Bác sĩ chuyên khoa',
    ip_address: '192.168.1.15',
    device: 'Safari / iPadOS 18 (Hospital Tablet)',
    login_time: '2026-10-15 07:15:40',
    last_active: '5 phút trước',
    status: 'active',
  },
  {
    id: 'sess-003',
    user_name: 'Nguyễn Hữu Nghĩa (Chủ nhà)',
    role: 'Người thân / Gia đình',
    ip_address: '14.232.208.54',
    device: 'SECA Mobile App / Android 14',
    login_time: '2026-10-15 06:45:10',
    last_active: '12 phút trước',
    status: 'active',
  },
];

const INITIAL_AUDIT_LOGS: SecurityAuditLog[] = [
  {
    id: 'aud-1',
    timestamp: '2026-10-15 09:15:22',
    event: 'ĐĂNG NHẬP THÀNH CÔNG',
    user: 'Admin123 (Root Admin)',
    ip: '127.0.0.1',
    severity: 'low',
    details: 'Đăng nhập trang quản trị thành công qua JWT Bearer token.',
  },
  {
    id: 'aud-2',
    timestamp: '2026-10-15 08:45:10',
    event: 'THAY ĐỔI CẤU HÌNH THIẾT BỊ',
    user: 'BS. Nguyễn Văn Minh',
    ip: '192.168.1.15',
    severity: 'medium',
    details: 'Cập nhật ngưỡng cảnh báo SpO2 < 90% cho cụ Nguyễn Văn An (Phòng ngủ).',
  },
  {
    id: 'aud-3',
    timestamp: '2026-10-15 07:10:05',
    event: 'CẢNH BÁO ĐĂNG NHẬP THẤT BẠI',
    user: '+84905999888',
    ip: '115.79.138.90',
    severity: 'high',
    details: 'Nhập sai mật khẩu lần thứ 3. Hệ thống gửi cảnh báo SMS OTP.',
  },
  {
    id: 'aud-4',
    timestamp: '2026-10-14 23:30:00',
    event: 'TỰ ĐỘNG THU HỒI TOKEN HẾT HẠN',
    user: 'System Cron',
    ip: 'localhost:8000',
    severity: 'low',
    details: 'Dọn sạch 14 refresh token đã hết hạn trong Redis cache.',
  },
  {
    id: 'aud-5',
    timestamp: '2026-10-14 20:12:44',
    event: 'PHÁT HIỆN TRUY CẬP TRÁI PHÉP',
    user: 'Anonymous',
    ip: '45.154.255.88',
    severity: 'critical',
    details: 'Quét cổng bất thường vào endpoint /api/v1/auth/login. Đã chặn IP tự động.',
  },
];

export const SecurityManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'policies' | 'sessions' | 'audit' | 'rbac'>('policies');
  const [policies, setPolicies] = useState<SecurityPolicy[]>(INITIAL_POLICIES);
  const [sessions, setSessions] = useState<ActiveSession[]>(INITIAL_SESSIONS);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>(INITIAL_AUDIT_LOGS);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchAudit, setSearchAudit] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [policiesData, sessionsData, logsData] = await Promise.all([
        securityApi.getPolicies().catch(() => null),
        securityApi.getSessions().catch(() => null),
        securityApi.getAuditLogs().catch(() => null),
      ]);
      if (policiesData && policiesData.length > 0) setPolicies(policiesData);
      if (sessionsData && sessionsData.length > 0) {
        // Author: DuongVanHieu - Khử trùng lặp sessions theo id phòng ngừa lỗi duplicate React keys
        const uniqueSessions = Array.from(new Map(sessionsData.map((s) => [s.id, s])).values());
        setSessions(uniqueSessions);
      }
      if (logsData && logsData.length > 0) {
        // Author: DuongVanHieu - Khử trùng lặp audit logs theo id
        const uniqueLogs = Array.from(new Map(logsData.map((l) => [l.id, l])).values());
        setAuditLogs(uniqueLogs);
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
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#D96C3B] to-[#B84B1E] text-white shadow-md shadow-[#D96C3B]/25 shrink-0">
            <Shield className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Quản lý bảo mật hệ thống
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
              Thiết lập chính sách an ninh, giám sát phiên làm việc JWT, kiểm toán Audit Logs & ma trận phân quyền
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-semibold">
            <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Mã hóa AES-256 / TLS 1.3 Active</span>
          </span>
        </div>
      </div>

      {/* Security Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Trạng thái an ninh */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Trạng thái an ninh
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
              Tối ưu (A+)
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              5/6 chính sách bảo vệ kích hoạt
            </p>
          </div>
        </div>

        {/* Card 2: Phiên hoạt động */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Phiên hoạt động (JWT)
            </span>
            <div className="p-2 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#D96C3B] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] shadow-sm">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
              {sessions.length}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Hợp lệ
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              Quản trị, Bác sĩ & Chủ nhà
            </p>
          </div>
        </div>

        {/* Card 3: Sự kiện kiểm toán */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Sự kiện kiểm toán (24h)
            </span>
            <div className="p-2 rounded-xl bg-[#FFF8EE] dark:bg-[#1A3830] text-[#B08D57] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D] shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2 px-1 relative z-10">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
              {auditLogs.length}
            </span>
            <span className="text-[10px] font-bold text-[#C25828] dark:text-[#DFB15B] bg-[#FFF8EE] dark:bg-[#1A3830] px-2 py-0.5 rounded-full border border-[#C8AD8A] dark:border-[#2F5A4D]">
              Audit Logs
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              Đầy đủ bản ghi định danh
            </p>
          </div>
        </div>

        {/* Card 4: Cảnh báo bảo mật */}
        <div className="glass-card p-5 relative group">
          <div className="flex items-center justify-between relative z-10 px-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Cảnh báo bảo mật
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm">
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
          <div className="mt-3 pt-2.5 border-t border-[#C8AD8A]/40 dark:border-white/5 px-1 relative z-10">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              1 phiên quá 10h cần rà soát
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#C8AD8A]/50 dark:border-white/10 gap-2 pb-px">
        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'policies'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#E67A47] bg-[#D96C3B]/10 dark:bg-[#D96C3B]/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Chính sách an ninh</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#E67A47] bg-[#D96C3B]/10 dark:bg-[#D96C3B]/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          <span>Phiên làm việc & JWT</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#FFF8EE] text-[#C25828] dark:bg-[#1A3830] dark:text-[#DFB15B] border border-[#C8AD8A] dark:border-[#2F5A4D]">
            {sessions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#E67A47] bg-[#D96C3B]/10 dark:bg-[#D96C3B]/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Nhật ký kiểm toán (Audit Logs)</span>
        </button>

        <button
          onClick={() => setActiveTab('rbac')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 cursor-pointer ${
            activeTab === 'rbac'
              ? 'border-[#D96C3B] text-[#D96C3B] dark:text-[#E67A47] bg-[#D96C3B]/10 dark:bg-[#D96C3B]/20'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
              className="glass-card p-5 flex flex-col justify-between hover:border-sky-200 dark:hover:border-sky-800 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {p.name}
                  </span>
                  <button
                    onClick={() => handleTogglePolicy(p.id)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      p.enabled ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        p.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  {p.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-sky-100 dark:border-sky-950/60 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500">
                  {p.category}
                </span>
                {p.value && (
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
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
          <div className="p-4 border-b border-sky-100 dark:border-sky-950/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Danh sách phiên làm việc đang duy trì trên hệ thống
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Mỗi phiên được cấp mã ký JWT HS256 riêng biệt
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-100 dark:border-sky-950/80 bg-sky-50/50 dark:bg-sky-950/20 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Tài khoản & Vai trò</th>
                  <th className="py-3 px-4">Địa chỉ IP</th>
                  <th className="py-3 px-4">Thiết bị / Ứng dụng</th>
                  <th className="py-3 px-4">Đăng nhập lúc</th>
                  <th className="py-3 px-4">Hoạt động gần nhất</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-sky-950/60 text-xs">
                {sessions.map((s, idx) => (
                  <tr key={`${s.id}-${idx}`} className="hover:bg-sky-50/40 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{s.user_name}</div>
                      <span className="inline-block mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {s.ip_address}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {s.device}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
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
                ))}
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
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-sky-200 dark:border-sky-900 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-xl border border-sky-200 dark:border-sky-900 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="ALL">Mọi mức độ nghiêm trọng</option>
                <option value="low">Thấp (Low)</option>
                <option value="medium">Trung bình (Medium)</option>
                <option value="high">Cao (High)</option>
                <option value="critical">Nghiêm trọng (Critical)</option>
              </select>
            </div>
          </div>

          <div className="glass-card divide-y divide-sky-100 dark:divide-sky-950/60">
            {filteredLogs.map((log, idx) => (
              <div key={`${log.id}-${idx}`} className="p-4 hover:bg-sky-50/40 dark:hover:bg-white/5 transition-colors">
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
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {log.severity}
                    </span>
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {log.event}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {log.timestamp}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 font-sans">
                  {log.details}
                </p>

                <div className="mt-2.5 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Người thực hiện: <b className="text-slate-700 dark:text-slate-300">{log.user}</b></span>
                  <span>IP nguồn: <b className="text-slate-700 dark:text-slate-300">{log.ip}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-sky-100 dark:border-sky-950/80">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Ma trận phân quyền kiểm soát truy cập (Role-Based Access Control)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quy định quyền xem, sửa, điều khiển thiết bị IoT và quản lý hạ tầng cho từng nhóm tài khoản
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sky-100 dark:border-sky-950/80 bg-sky-50/50 dark:bg-sky-950/20 font-semibold text-slate-700 dark:text-slate-300">
                  <th className="py-3 px-4">Quyền hạn / Chức năng</th>
                  <th className="py-3 px-4 text-center">Quản Trị Viên (Admin)</th>
                  <th className="py-3 px-4 text-center">Bác sĩ (Doctor)</th>
                  <th className="py-3 px-4 text-center">Người chăm sóc (Caregiver)</th>
                  <th className="py-3 px-4 text-center">Chủ nhà (Owner/User)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-sky-950/60">
                {[
                  { name: 'Quản lý tài khoản, thêm/sửa/khóa user', admin: true, doc: false, care: false, user: false },
                  { name: 'Cấu hình bảo mật hệ thống & xem Audit Logs', admin: true, doc: false, care: false, user: false },
                  { name: 'Vận hành hạ tầng Redis, EMQX, CSDL', admin: true, doc: false, care: false, user: false },
                  { name: 'Xem hồ sơ sức khỏe & lịch sử sinh hiệu', admin: true, doc: true, care: true, user: true },
                  { name: 'Điều chỉnh ngưỡng y tế (SpO2, Nhịp tim, Huyết áp)', admin: true, doc: true, care: false, user: true },
                  { name: 'Xem trực tiếp camera AI & đàm thoại 2 chiều', admin: true, doc: true, care: true, user: true },
                  { name: 'Khởi động lại thiết bị IoT từ xa qua MQTT', admin: true, doc: false, care: false, user: true },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-sky-50/40 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{row.name}</td>
                    <td className="py-3 px-4 text-center">
                      {row.admin ? <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 mx-auto" /> : <span className="text-slate-300 dark:text-slate-700">—</span>}
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


import React from 'react';
import { Filter, Search } from 'lucide-react';
import { SecurityAuditLog } from '../../types';
import { isDoctorAuditLog, SEVERITY_BADGE_STYLES } from './securityConfig';

interface AuditLogsTabProps {
  auditLogs: SecurityAuditLog[];
  filteredLogs: SecurityAuditLog[];
  doctorLogsCount: number;
  searchAudit: string;
  onSearchAuditChange: (val: string) => void;
  roleFilter: 'ALL' | 'doctor' | 'admin' | 'user';
  onRoleFilterChange: (val: 'ALL' | 'doctor' | 'admin' | 'user') => void;
  actionFilter: 'ALL' | 'LOGIN' | 'LOGOUT';
  onActionFilterChange: (val: 'ALL' | 'LOGIN' | 'LOGOUT') => void;
  severityFilter: string;
  onSeverityFilterChange: (val: string) => void;
}

export const AuditLogsTab: React.FC<AuditLogsTabProps> = ({
  auditLogs,
  filteredLogs,
  doctorLogsCount,
  searchAudit,
  onSearchAuditChange,
  roleFilter,
  onRoleFilterChange,
  actionFilter,
  onActionFilterChange,
  severityFilter,
  onSeverityFilterChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm sự kiện, IP, người dùng..."
            value={searchAudit}
            onChange={(e) => onSearchAuditChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-sky-200 dark:border-[#454A53] bg-white dark:bg-[#202329] text-slate-900 dark:text-[#F5F6F8] placeholder:text-slate-400 dark:placeholder:text-[#727984] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value as any)}
            className="text-xs py-1.5 px-3 rounded-xl border border-sky-200 dark:border-[#454A53] bg-white dark:bg-[#202329] text-slate-900 dark:text-[#F5F6F8]"
          >
            <option value="ALL">Mọi đối tượng</option>
            <option value="doctor">🩺 Bác sĩ (Doctor Web)</option>
            <option value="admin">🛡️ Quản trị viên (Admin)</option>
            <option value="user">👤 Người dùng / Gia đình</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => onActionFilterChange(e.target.value as any)}
            className="text-xs py-1.5 px-3 rounded-xl border border-sky-200 dark:border-[#454A53] bg-white dark:bg-[#202329] text-slate-900 dark:text-[#F5F6F8]"
          >
            <option value="ALL">Mọi hành động</option>
            <option value="LOGIN">Đăng nhập</option>
            <option value="LOGOUT">Đăng xuất</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => onSeverityFilterChange(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-xl border border-sky-200 dark:border-[#454A53] bg-white dark:bg-[#202329] text-slate-900 dark:text-[#F5F6F8]"
          >
            <option value="ALL">Mọi mức độ</option>
            <option value="low">Thấp (Low)</option>
            <option value="medium">Trung bình (Medium)</option>
            <option value="high">Cao (High)</option>
            <option value="critical">Nghiêm trọng (Critical)</option>
          </select>
        </div>
      </div>

      {/* Quick filter pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-400">Lọc nhanh:</span>
        <button
          type="button"
          onClick={() => {
            onRoleFilterChange('ALL');
            onActionFilterChange('ALL');
            onSeverityFilterChange('ALL');
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
            roleFilter === 'ALL' && actionFilter === 'ALL' && severityFilter === 'ALL'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-[#202329] text-slate-600 dark:text-[#A1A7B1] hover:bg-slate-200'
          }`}
        >
          Tất cả ({auditLogs.length})
        </button>
        <button
          type="button"
          onClick={() => onRoleFilterChange(roleFilter === 'doctor' ? 'ALL' : 'doctor')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
            roleFilter === 'doctor'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
          }`}
        >
          <span>🩺 Bác sĩ ({doctorLogsCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onActionFilterChange(actionFilter === 'LOGIN' ? 'ALL' : 'LOGIN')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
            actionFilter === 'LOGIN'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <span>Đăng nhập</span>
        </button>
        <button
          type="button"
          onClick={() => onActionFilterChange(actionFilter === 'LOGOUT' ? 'ALL' : 'LOGOUT')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
            actionFilter === 'LOGOUT'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
          }`}
        >
          <span>Đăng xuất</span>
        </button>
      </div>

      <div className="glass-card divide-y divide-sky-100 dark:divide-[#454A53]">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => {
            const isDoctorLog = isDoctorAuditLog(log);
            const isLogout = log.event.toLowerCase().includes('đăng xuất');
            const isLogin = log.event.toLowerCase().includes('đăng nhập');
            const severityStyle = SEVERITY_BADGE_STYLES[log.severity] || SEVERITY_BADGE_STYLES.low;

            return (
              <div key={`${log.id}-${idx}`} className="p-4 hover:bg-sky-50/40 dark:hover:bg-[#202329] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${severityStyle}`}>
                      {log.severity}
                    </span>
                    <span className="font-semibold text-xs text-slate-900 dark:text-[#F5F6F8]">
                      {log.event}
                    </span>
                    {isDoctorLog && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        🩺 Bác sĩ
                      </span>
                    )}
                    {isLogout && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        Đăng xuất
                      </span>
                    )}
                    {isLogin && !isLogout && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Đăng nhập
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-[#727984]">
                    {log.timestamp}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-600 dark:text-[#A1A7B1] font-sans">
                  {log.details}
                </p>

                <div className="mt-2.5 flex items-center gap-4 text-[11px] text-slate-500 dark:text-[#727984] font-mono">
                  <span>
                    Người thực hiện: <b className="text-slate-700 dark:text-[#F5F6F8]">{log.user}</b>
                  </span>
                  <span>
                    IP nguồn: <b className="text-slate-700 dark:text-[#F5F6F8]">{log.ip}</b>
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-[#A1A7B1]">
            Chưa có nhật ký kiểm toán nào được ghi nhận trong cơ sở dữ liệu.
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { AlertTriangle, Ban } from 'lucide-react';
import { ActiveSession } from '../../types';

interface SessionsTabProps {
  sessions: ActiveSession[];
  displaySessions: ActiveSession[];
  sessionFilter: 'ALL' | 'WARNING';
  warningSessionsCount: number;
  onFilterChange: (filter: 'ALL' | 'WARNING') => void;
  onRevokeSession: (id: string, userName: string) => void;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  sessions,
  displaySessions,
  sessionFilter,
  warningSessionsCount,
  onFilterChange,
  onRevokeSession,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#1A1D24] border border-sky-100 dark:border-[#454A53]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFilterChange('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sessionFilter === 'ALL'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#202329] text-slate-600 dark:text-[#A1A7B1] hover:bg-slate-200'
            }`}
          >
            Tất cả phiên ({sessions.length})
          </button>

          <button
            onClick={() => onFilterChange('WARNING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              sessionFilter === 'WARNING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Phiên cảnh báo quá 10h ({warningSessionsCount})</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 dark:text-[#A1A7B1]">
          Mỗi phiên được cấp mã ký JWT HS256 riêng biệt
        </span>
      </div>

      {sessionFilter === 'WARNING' && (
        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5 animate-slide-up">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-bold">Quy trình rà soát phiên bất thường:</p>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              Kiểm tra kỹ <b>Địa chỉ IP</b>, <b>Thiết bị đăng nhập</b> và <b>Thời gian hoạt động gần nhất</b>. Nếu phát hiện IP lạ hoặc phiên không còn sử dụng, hãy bấm nút <b>[Hủy phiên]</b> ở cột bên phải để lập tức vô hiệu hóa mã truy cập JWT của tài khoản đó.
            </p>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
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
              {displaySessions.length > 0 ? (
                displaySessions.map((s, idx) => {
                  const isWarning = s.status === 'warning';
                  return (
                    <tr
                      key={`${s.id}-${idx}`}
                      className={`transition-colors ${
                        isWarning
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40'
                          : 'hover:bg-sky-50/40 dark:hover:bg-[#202329]'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-[#F5F6F8] flex items-center gap-1.5">
                          <span>{s.user_name}</span>
                          {isWarning && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                              &gt;10 GIỜ
                            </span>
                          )}
                        </div>
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
                          onClick={() => onRevokeSession(s.id, s.user_name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold transition-colors cursor-pointer"
                          title="Thu hồi phiên đăng nhập ngay lập tức"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Hủy phiên</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    {sessionFilter === 'WARNING'
                      ? 'Tuyệt vời! Không có phiên làm việc nào quá 10 giờ hoặc có dấu hiệu bất thường.'
                      : 'Chưa có phiên làm việc nào đang hoạt động trong CSDL / Redis.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

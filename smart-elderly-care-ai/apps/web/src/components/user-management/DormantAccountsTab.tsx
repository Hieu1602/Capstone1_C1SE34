import React from 'react';
import { Moon, AlertTriangle, Lock, Trash2, RefreshCw } from 'lucide-react';
import { User } from '../../types';

export interface DormantAccountsTabProps {
  dormantLevel: '3m' | '6m' | '1y';
  dormantData: { level: string; threshold_days: number; count: number; items: User[] } | null;
  loadingDormant: boolean;
  onSelectLevel: (lvl: '3m' | '6m' | '1y') => void;
  onOpenBatchModal: (action: 'remind' | 'lock' | 'delete') => void;
  onOpenStatusModal: (user: User) => void;
}

const DORMANT_LEVEL_OPTIONS: Array<{ key: '3m' | '6m' | '1y'; label: string; activeColor: string }> = [
  { key: '3m', label: '> 3 tháng (Nhắc nhở)', activeColor: 'bg-amber-500' },
  { key: '6m', label: '> 6 tháng (Khóa)', activeColor: 'bg-rose-500' },
  { key: '1y', label: '> 1 năm (Đủ đ/k xóa)', activeColor: 'bg-purple-600' },
];

export const DormantAccountsTab: React.FC<DormantAccountsTabProps> = ({
  dormantLevel,
  dormantData,
  loadingDormant,
  onSelectLevel,
  onOpenBatchModal,
  onOpenStatusModal,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Level Selector & Action Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2024] border border-[#E7E9ED] dark:border-[#2E3238] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8] flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-500" />
            Bộ lọc tài khoản ngủ đông theo mốc thời gian
          </h2>
          <p className="text-xs text-[#737780] dark:text-[#A1A7B1] mt-1">
            Tự động loại trừ Admin và Owner có nhà/thiết bị hoạt động. Tính theo lần đăng nhập cuối (hoặc ngày tạo).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {DORMANT_LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSelectLevel(opt.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer ${
                dormantLevel === opt.key
                  ? `${opt.activeColor} text-white shadow-xs`
                  : 'bg-[#F3F4F6] dark:bg-[#2A2D33] text-[#737780] dark:text-[#A1A7B1]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dormant Preview Results */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1E2024] border border-[#E7E9ED] dark:border-[#2E3238] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E9ED] dark:border-[#2E3238]">
          <div>
            <span className="text-xs uppercase tracking-wider font-mono text-[#737780] dark:text-[#A1A7B1]">
              Kết quả quét ({dormantData?.threshold_days || 90} ngày không hoạt động)
            </span>
            <div className="text-xl font-bold text-[#191B20] dark:text-[#F5F6F8] mt-0.5">
              Phát hiện <span className="text-[#FF6B35] font-mono">{dormantData?.count ?? 0}</span> tài khoản ngủ đông
            </div>
          </div>

          {dormantData && dormantData.count > 0 && (
            <div className="flex items-center gap-2">
              {dormantLevel === '3m' && (
                <button
                  onClick={() => onOpenBatchModal('remind')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Gửi nhắc nhở hàng loạt
                </button>
              )}
              {dormantLevel === '6m' && (
                <button
                  onClick={() => onOpenBatchModal('lock')}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Khóa hàng loạt ({dormantData.count})
                </button>
              )}
              {dormantLevel === '1y' && (
                <button
                  onClick={() => onOpenBatchModal('delete')}
                  className="px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa vĩnh viễn hàng loạt ({dormantData.count})
                </button>
              )}
            </div>
          )}
        </div>

        {loadingDormant ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-[#737780]">
            <RefreshCw className="w-6 h-6 animate-spin text-[#FF6B35]" />
            <span className="text-xs">Đang quét phân tích tài khoản ngủ đông...</span>
          </div>
        ) : !dormantData || dormantData.items.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#737780] dark:text-[#A1A7B1]">
            Không có tài khoản nào thuộc diện ngủ đông tại mốc thời gian này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] dark:text-[#A1A7B1] font-mono">
                  <th className="py-2.5 px-3">Tài khoản</th>
                  <th className="py-2.5 px-3">Vai trò</th>
                  <th className="py-2.5 px-3">Đăng nhập cuối</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9ED] dark:divide-[#2E3238]">
                {dormantData.items.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#191B20] dark:text-[#F5F6F8]">{u.full_name}</div>
                      <div className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1]">{u.phone}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold bg-[#F3F4F6] dark:bg-[#2A2D33] text-[#737780]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#737780] dark:text-[#A1A7B1]">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString('vi-VN')
                        : `Tạo: ${new Date(u.created_at).toLocaleDateString('vi-VN')}`}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {u.status || (u.is_active ? 'active' : 'locked')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onOpenStatusModal(u)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        Khóa / Mở
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

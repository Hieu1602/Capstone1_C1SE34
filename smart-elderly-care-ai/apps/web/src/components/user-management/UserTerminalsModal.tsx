import React from 'react';
import { Smartphone, LogOut, RefreshCw } from 'lucide-react';
import { User } from '../../types';

export interface UserTerminalsModalProps {
  user: User | null;
  terminalsList: any[];
  loading: boolean;
  onClose: () => void;
  onRevokeTerminal: (terminalId: string) => void;
  onLogoutAll: () => void;
}

export const UserTerminalsModal: React.FC<UserTerminalsModalProps> = ({
  user,
  terminalsList,
  loading,
  onClose,
  onRevokeTerminal,
  onLogoutAll,
}) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">Thiết bị & Phiên hoạt động</h3>
              <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
                {user.full_name} ({user.phone})
              </p>
            </div>
          </div>

          <button
            onClick={onLogoutAll}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Tăng token_version để vô hiệu hóa tức thì toàn bộ token đã cấp"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất tất cả
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 py-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-[#737780] flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#FF6B35]" />
              <span>Đang truy xuất thông tin thiết bị...</span>
            </div>
          ) : terminalsList.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#737780]">
              Chưa ghi nhận thiết bị nào đang duy trì phiên đăng nhập.
            </div>
          ) : (
            terminalsList.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-xl border border-[#E7E9ED] dark:border-[#2E3238] flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-[#191B20] dark:text-[#F5F6F8]">
                    {t.device_type || 'Thiết bị di động'}
                  </div>
                  <div className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1] flex items-center gap-2 mt-0.5">
                    <span>IP: {t.ip_address || 'Chưa ghi nhận'}</span>
                    <span>•</span>
                    <span>
                      Lần cuối: {t.last_active_at ? new Date(t.last_active_at).toLocaleString('vi-VN') : 'Mới đây'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRevokeTerminal(t.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  Thu hồi
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-[#E7E9ED] dark:border-[#2E3238]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

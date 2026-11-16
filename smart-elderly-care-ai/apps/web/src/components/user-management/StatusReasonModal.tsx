import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { User } from '../../types';

export interface StatusReasonModalProps {
  user: User | null;
  reason: string;
  onReasonChange: (val: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (e: React.FormEvent) => void;
}

export const StatusReasonModal: React.FC<StatusReasonModalProps> = ({
  user,
  reason,
  onReasonChange,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  if (!user) return null;
  const isLocked = user.status === 'locked_admin' || !user.is_active;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLocked
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-rose-500/10 text-rose-500'
            }`}
          >
            {isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">
              {isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản thủ công'}
            </h3>
            <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
              Tài khoản: <span className="font-semibold">{user.full_name}</span> ({user.phone})
            </p>
          </div>
        </div>

        <form onSubmit={onConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#191B20] dark:text-[#F5F6F8] mb-1.5">
              Lý do {isLocked ? 'mở khóa' : 'khóa'}{' '}
              <span className="text-rose-500">* (Bắt buộc để ghi Audit Log)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Ví dụ: Vi phạm chính sách an ninh / Đã hoàn tất xác minh người dùng..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-[#E7E9ED] dark:border-[#2E3238] bg-transparent text-[#191B20] dark:text-[#F5F6F8] focus:outline-none focus:border-[#FF6B35]"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs ${
                isLocked
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận thực hiện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

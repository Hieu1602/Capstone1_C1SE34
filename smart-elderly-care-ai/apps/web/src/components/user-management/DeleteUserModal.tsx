import React from 'react';
import { Trash2 } from 'lucide-react';
import { User } from '../../types';

export interface DeleteUserModalProps {
  user: User | null;
  reason: string;
  onReasonChange: (val: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (e: React.FormEvent) => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  user,
  reason,
  onReasonChange,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">Xác nhận xóa tài khoản</h3>
            <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
              Xóa vĩnh viễn: <span className="font-semibold">{user.full_name}</span> ({user.phone})
            </p>
          </div>
        </div>

        <form onSubmit={onConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#191B20] dark:text-[#F5F6F8] mb-1.5">
              Lý do xóa <span className="text-rose-500">* (Bắt buộc ghi nhận kiểm toán)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Ví dụ: Người dùng yêu cầu hủy tài khoản sau thời gian dài ngủ đông..."
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
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React from 'react';
import { ShieldAlert } from 'lucide-react';

export interface DormantBatchModalProps {
  action: 'remind' | 'lock' | 'delete' | null;
  count: number;
  reason: string;
  onReasonChange: (val: string) => void;
  step: 1 | 2;
  onNextStep: () => void;
  onPrevStep: () => void;
  isSubmitting: boolean;
  onClose: () => void;
  onExecute: () => void;
}

export const DormantBatchModal: React.FC<DormantBatchModalProps> = ({
  action,
  count,
  reason,
  onReasonChange,
  step,
  onNextStep,
  onPrevStep,
  isSubmitting,
  onClose,
  onExecute,
}) => {
  if (!action) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#1E2024] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9ED] dark:border-[#2E3238] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#191B20] dark:text-[#F5F6F8]">
              Thao tác hàng loạt: {action.toUpperCase()}
            </h3>
            <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
              Áp dụng cho <span className="font-bold text-[#FF6B35]">{count}</span> tài khoản ngủ đông
            </p>
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-xs text-[#737780] dark:text-[#A1A7B1]">
              Bạn đang chuẩn bị thực hiện hành động{' '}
              <span className="font-bold text-rose-500">[{action}]</span> trên {count} tài khoản.
              Vui lòng nhập lý do để ghi Audit Log.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#191B20] dark:text-[#F5F6F8]">
                Lý do thao tác hàng loạt <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Ví dụ: Định kỳ dọn dẹp tài khoản ngủ đông theo quy chế 2026..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-[#E7E9ED] dark:border-[#2E3238] bg-transparent focus:outline-none focus:border-[#FF6B35]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={onNextStep}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6B35] text-white hover:bg-[#F05A24] cursor-pointer"
              >
                Bước 2: Xác nhận cuối cùng
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
              <strong>CẢNH BÁO BƯỚC 2:</strong> Hành động này sẽ thay đổi trạng thái của hàng loạt tài khoản ngay lập tức.
              Bạn có chắc chắn muốn tiến hành không?
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onPrevStep}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E7E9ED] dark:border-[#2E3238] text-[#737780] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                onClick={onExecute}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {isSubmitting ? 'Đang thực thi...' : 'Tôi xác nhận thực hiện'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

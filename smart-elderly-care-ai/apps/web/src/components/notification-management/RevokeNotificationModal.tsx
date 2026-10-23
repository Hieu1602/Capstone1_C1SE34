import React from 'react';
import { RotateCcw } from 'lucide-react';
import { SystemNotification } from '../../types';

interface RevokeNotificationModalProps {
  notification: SystemNotification | null;
  revokeReason: string;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const RevokeNotificationModal: React.FC<RevokeNotificationModalProps> = ({
  notification,
  revokeReason,
  onReasonChange,
  onClose,
  onConfirm,
}) => {
  if (!notification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl glass-card border border-rose-300 dark:border-rose-900/60 shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 shrink-0 border border-rose-200">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F6F8]">
              Thu hồi thông báo hệ thống
            </h3>
            <p className="text-xs text-slate-600 dark:text-[#A1A7B1] mt-1">
              Bạn có chắc muốn thu hồi thông báo: <br />
              <strong className="text-slate-900 dark:text-[#F5F6F8]">
                &ldquo;{notification.title}&rdquo;
              </strong>
              ?
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-[#F5F6F8] mb-1">
            Lý do thu hồi thông báo:
          </label>
          <textarea
            rows={2}
            value={revokeReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Nhập lý do thu hồi (sai lệch dữ liệu, hết hiệu lực, thay đổi chỉ thị...)"
            className="input-glass"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E9ED] dark:border-[#454A53]">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-danger"
          >
            Xác nhận thu hồi
          </button>
        </div>
      </div>
    </div>
  );
};


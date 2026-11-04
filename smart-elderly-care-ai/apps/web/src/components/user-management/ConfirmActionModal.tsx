import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Trash2, X } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  type?: 'save' | 'unsaved' | 'delete' | 'status' | 'reset-pwd';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  discardLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onDiscard?: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  type = 'save',
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  discardLabel = 'Không lưu',
  onConfirm,
  onCancel,
  onDiscard,
}) => {
  if (!isOpen) return null;

  const isDelete = type === 'delete';
  const isUnsaved = type === 'unsaved';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="glass-card w-full max-w-md overflow-hidden border border-[#E7E9ED] dark:border-[#454A53] shadow-2xl animate-slide-up bg-white dark:bg-[#1E2024] rounded-2xl">
        <div className="p-5 border-b border-[#E7E9ED] dark:border-[#454A53] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${
                isDelete
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900/40'
                  : isUnsaved
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border border-amber-200 dark:border-amber-900/40'
                  : 'bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/20'
              }`}
            >
              {isDelete ? (
                <Trash2 className="w-5 h-5" />
              ) : isUnsaved ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <HelpCircle className="w-5 h-5" />
              )}
            </div>
            <h3 className="font-heading font-bold text-[#191B20] dark:text-[#F5F6F8] text-sm">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-[#737780] hover:text-[#191B20] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-[#525660] dark:text-[#C5CAD3] leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-4 border-t border-[#E7E9ED] dark:border-[#454A53] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2">
          {/* Nút hủy / tiếp tục */}
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#737780] hover:text-[#191B20] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>

          {/* Nếu là Unsaved changes: thêm nút 'Không lưu (Hủy thay đổi)' */}
          {isUnsaved && onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all cursor-pointer"
            >
              {discardLabel}
            </button>
          )}

          {/* Nút xác nhận chính */}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#FF6B35] hover:bg-[#F05A24]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { AlertTriangle, Save } from 'lucide-react';

interface RoleUnsavedFloatingBarProps {
  isVisible: boolean;
  onReset: () => void;
  onSave: () => void;
}

export const RoleUnsavedFloatingBar: React.FC<RoleUnsavedFloatingBarProps> = ({
  isVisible,
  onReset,
  onSave,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-2xl animate-bounce-subtle">
      <div className="px-5 py-3.5 rounded-2xl bg-slate-950/95 dark:bg-slate-900/95 text-white border border-slate-700/80 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold tracking-wide">
            Cẩn thận — bạn có thay đổi chưa lưu!
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={onReset}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đặt lại
          </button>

          <button
            type="button"
            onClick={onSave}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export interface MonthYearPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number; // 0-11
  onSelectMonthYear: (year: number, month: number) => void;
  onSelectCurrent: () => void;
  currentLabel?: string;
  disableFuture?: boolean;
  align?: 'left' | 'right' | 'center';
}

const MONTHS_SHORT = [
  'Th1', 'Th2', 'Th3', 'Th4',
  'Th5', 'Th6', 'Th7', 'Th8',
  'Th9', 'Th10', 'Th11', 'Th12',
];

export const MonthYearPopover: React.FC<MonthYearPopoverProps> = ({
  isOpen,
  onClose,
  selectedYear,
  selectedMonth,
  onSelectMonthYear,
  onSelectCurrent,
  currentLabel = 'Tháng hiện tại',
  disableFuture = false,
  align = 'right',
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [viewYear, setViewYear] = useState(selectedYear);
  const [showYearGrid, setShowYearGrid] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setViewYear(selectedYear);
      setShowYearGrid(false);
    }
  }, [isOpen, selectedYear]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'right-0';

  const yearBase = Math.floor(viewYear / 12) * 12;
  const yearChoices = Array.from({ length: 12 }, (_, idx) => yearBase + idx);

  return (
    <div
      ref={popoverRef}
      className={`absolute top-full mt-2 ${alignClass} z-50 w-64 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-700 dark:bg-[#131C31]`}
    >
      {/* Hàng trên cùng: Chuyển năm < 2026 > hoặc chọn danh sách năm */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setViewYear((y) => (showYearGrid ? y - 12 : y - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
          title={showYearGrid ? '12 năm trước' : 'Năm trước'}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowYearGrid((v) => !v)}
          className="rounded-lg px-2.5 py-1 text-xs font-extrabold text-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Bấm để chọn năm nhanh"
        >
          {showYearGrid ? `${yearChoices[0]} - ${yearChoices[11]}` : `Năm ${viewYear}`}
        </button>

        <button
          type="button"
          disabled={disableFuture && viewYear >= nowYear}
          onClick={() => setViewYear((y) => (showYearGrid ? y + 12 : y + 1))}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
            disableFuture && viewYear >= nowYear
              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer'
          }`}
          title={showYearGrid ? '12 năm sau' : 'Năm sau'}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {showYearGrid ? (
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          {yearChoices.map((yr) => {
            const isSel = yr === viewYear;
            const isFutureYr = disableFuture && yr > nowYear;
            return (
              <button
                key={yr}
                type="button"
                disabled={isFutureYr}
                onClick={() => {
                  setViewYear(yr);
                  setShowYearGrid(false);
                }}
                className={`rounded-xl py-1.5 text-xs font-bold transition ${
                  isFutureYr
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : isSel
                    ? 'bg-blue-600 text-white shadow-sm cursor-pointer'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer'
                }`}
              >
                {yr}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          {MONTHS_SHORT.map((lbl, idx) => {
            const isSelected = viewYear === selectedYear && idx === selectedMonth;
            const isFuture =
              disableFuture && (viewYear > nowYear || (viewYear === nowYear && idx > nowMonth));
            const isCurrent = viewYear === nowYear && idx === nowMonth;

            return (
              <button
                key={lbl}
                type="button"
                disabled={isFuture}
                onClick={() => {
                  onSelectMonthYear(viewYear, idx);
                  onClose();
                }}
                className={`rounded-xl py-1.5 text-xs font-bold transition ${
                  isFuture
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : isSelected
                    ? 'bg-blue-600 text-white shadow-sm cursor-pointer'
                    : isCurrent
                    ? 'border border-blue-400 text-blue-600 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 cursor-pointer'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer'
                }`}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      )}

      {/* Nút nhanh quay về tháng hiện tại */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button
          type="button"
          onClick={() => {
            onSelectCurrent();
            onClose();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900 transition cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{currentLabel}</span>
        </button>
      </div>
    </div>
  );
};

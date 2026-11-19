import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export interface MiniCalendarCell {
  day: number | null;
  dateStr?: string;
  isToday?: boolean;
  isSelected?: boolean;
  dotStatus?: 'COMPLETED' | 'UPCOMING' | 'CRITICAL' | null;
}

export interface DoctorMiniCalendarProps {
  calendarMonth: Date;
  onMonthChange: (date: Date) => void;
  miniCalendarCells: MiniCalendarCell[];
  selectedDate?: string;
  onSelectDate?: (dateStr: string) => void;
  onNavigateAppointments: () => void;
}

const WEEKDAYS_HEADER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const DoctorMiniCalendar: React.FC<DoctorMiniCalendarProps> = ({
  calendarMonth,
  onMonthChange,
  miniCalendarCells,
  selectedDate,
  onSelectDate,
  onNavigateAppointments,
}) => {
  return (
    <div className="w-full h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between dark:border-slate-800/80 dark:bg-[#131C31]">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-heading text-sm font-extrabold text-slate-900 dark:text-white">
              Lịch khám trong tháng
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                onMonthChange(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                )
              }
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-1">
              Tháng {calendarMonth.getMonth() + 1}/{calendarMonth.getFullYear()}
            </span>
            <button
              onClick={() =>
                onMonthChange(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                )
              }
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Header thứ */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {WEEKDAYS_HEADER.map((d) => (
            <span key={d} className={`text-[10.5px] font-bold py-1 ${d === 'CN' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>
              {d}
            </span>
          ))}
        </div>

        {/* Lưới ngày */}
        <div className="grid grid-cols-7 gap-1">
          {miniCalendarCells.map((cell, idx) =>
            cell.day === null ? (
              <div key={idx} className="h-8" />
            ) : (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (cell.dateStr && onSelectDate) {
                    onSelectDate(cell.dateStr);
                  } else {
                    onNavigateAppointments();
                  }
                }}
                title={cell.dateStr ? `Xem lịch ngày ${cell.dateStr.split('-').reverse().join('/')}` : undefined}
                className={`relative flex h-8 flex-col items-center justify-center rounded-lg text-xs transition cursor-pointer ${
                  cell.isSelected
                    ? 'bg-blue-600 text-white font-extrabold shadow-sm ring-2 ring-blue-300 dark:ring-blue-600'
                    : cell.isToday
                    ? 'border-2 border-blue-600 font-extrabold text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 font-semibold'
                }`}
              >
                <span>{cell.day}</span>
                {cell.dotStatus && (
                  <span
                    className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${
                      cell.isSelected
                        ? 'bg-white'
                        : cell.dotStatus === 'COMPLETED'
                        ? 'bg-emerald-500'
                        : cell.dotStatus === 'UPCOMING'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                )}
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Đã khám
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Sắp tới
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Cần lưu ý
          </span>
        </div>

        <button
          type="button"
          onClick={onNavigateAppointments}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>
            Xem chi tiết lịch {selectedDate ? `ngày ${selectedDate.split('-').reverse().join('/')}` : ''}
          </span>
        </button>
      </div>
    </div>
  );
};

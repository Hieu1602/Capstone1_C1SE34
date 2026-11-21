// src/components/clinical/AppointmentWeekStrip.tsx
// Thanh chọn ngày theo tuần kèm Popover lịch tháng cho trang Lịch Khám

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { AppointmentItem } from '../../types';

export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function getDayAppointmentFlags(appointments: AppointmentItem[], targetDate: Date) {
  const targetStr = toLocalIsoDate(targetDate);
  const dayApts = appointments.filter((apt) => {
    if (apt.status === 'CANCELLED') return false;
    try {
      const dt = new Date(apt.scheduled_at);
      return !isNaN(dt.getTime()) && toLocalIsoDate(dt) === targetStr;
    } catch {
      return false;
    }
  });
  return {
    count: dayApts.length,
    hasUpcoming: dayApts.some((a) => a.status === 'UPCOMING' || a.status === 'CONFIRMED'),
    hasCompleted: dayApts.some((a) => a.status === 'COMPLETED'),
  };
}

interface AppointmentWeekStripProps {
  appointments: AppointmentItem[];
  selectedDateStr: string | null;
  onSelectDate: React.Dispatch<React.SetStateAction<string | null>>;
}

export const AppointmentWeekStrip: React.FC<AppointmentWeekStripProps> = ({
  appointments,
  selectedDateStr,
  onSelectDate,
}) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const monthPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMonthPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPicker]);

  useEffect(() => {
    if (!selectedDateStr) return;
    const parts = selectedDateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const diffWeeks = Math.round(
        (getMonday(targetDate).getTime() - getMonday(new Date()).getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      setWeekOffset(diffWeeks);
      setPickerMonth({ year: targetDate.getFullYear(), month: targetDate.getMonth() });
    }
  }, [selectedDateStr]);

  const handlePickCalendarDate = (targetDate: Date, isoDate: string) => {
    const diffWeeks = Math.round(
      (getMonday(targetDate).getTime() - getMonday(new Date()).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    setWeekOffset(diffWeeks);
    onSelectDate(isoDate);
    setShowMonthPicker(false);
  };

  const pickerCells = useMemo(() => {
    const { year, month } = pickerMonth;
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayIso = toLocalIsoDate(new Date());

    const cells: Array<{
      day: number | null;
      dateObj?: Date;
      isoDate?: string;
      isToday?: boolean;
      hasUpcoming?: boolean;
      hasCompleted?: boolean;
    }> = Array.from({ length: startOffset }, () => ({ day: null }));

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const isoDate = toLocalIsoDate(d);
      const flags = getDayAppointmentFlags(appointments, d);
      cells.push({
        day,
        dateObj: d,
        isoDate,
        isToday: isoDate === todayIso,
        hasUpcoming: flags.hasUpcoming,
        hasCompleted: flags.hasCompleted,
      });
    }
    return cells;
  }, [pickerMonth, appointments]);

  // Tính toán 7 ngày trong tuần (Thứ 2 -> Chủ Nhật)
  const weekDays = useMemo(() => {
    const now = new Date();
    const monday = getMonday(now);
    monday.setDate(monday.getDate() + weekOffset * 7);

    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const flags = getDayAppointmentFlags(appointments, d);
      return {
        label: WEEKDAY_LABELS[idx],
        dayNum: String(d.getDate()).padStart(2, '0'),
        monthNum: String(d.getMonth() + 1).padStart(2, '0'),
        isoDate: toLocalIsoDate(d),
        isToday: d.toDateString() === now.toDateString(),
        ...flags,
      };
    });
  }, [appointments, weekOffset]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="relative flex items-center space-x-2.5" ref={monthPickerRef}>
          <button
            type="button"
            onClick={() => setShowMonthPicker((v) => !v)}
            title="Chọn ngày từ lịch tháng"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-pointer ${
              showMonthPicker
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/60'
            }`}
          >
            <CalendarDays className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Lịch trình trong tuần</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Chọn một ngày cụ thể để lọc hoặc xem toàn bộ lịch hẹn
            </p>
          </div>

          {showMonthPicker && (
            <div className="absolute left-0 top-11 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 dark:border-slate-800/80 dark:bg-[#131C31] dark:shadow-slate-950/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Tháng {pickerMonth.month + 1} / {pickerMonth.year}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPickerMonth((prev) =>
                        prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
                      )
                    }
                    className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                    title="Tháng trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPickerMonth((prev) =>
                        prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
                      )
                    }
                    className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                    title="Tháng sau"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                {WEEKDAY_LABELS.map((w) => (
                  <span key={w} className="text-[10px] font-bold uppercase text-slate-400 py-1">
                    {w}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {pickerCells.map((cell, i) => {
                  if (cell.day === null) return <div key={`empty-${i}`} className="h-8" />;
                  const isSelected = selectedDateStr === cell.isoDate;
                  return (
                    <button
                      key={cell.isoDate}
                      type="button"
                      onClick={() => handlePickCalendarDate(cell.dateObj!, cell.isoDate!)}
                      className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : cell.isToday
                            ? 'ring-1 ring-blue-500 text-blue-600 font-bold hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                            : 'text-slate-700 font-medium hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{cell.day}</span>
                      {(cell.hasUpcoming || cell.hasCompleted) && (
                        <span
                          className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                            isSelected ? 'bg-white' : cell.hasUpcoming ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectDate(null);
                    setWeekOffset(0);
                    setShowMonthPicker(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Xóa lọc / Tất cả các ngày</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onSelectDate(null)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              selectedDateStr === null
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Tất cả các ngày
          </button>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700/60 dark:bg-[#0F172A]">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 transition dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              title="Tuần trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
            >
              Tuần này
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 transition dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              title="Tuần kế tiếp"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {weekDays.map((d) => {
          const isActive = selectedDateStr === d.isoDate;
          return (
            <button
              key={d.isoDate}
              onClick={() => onSelectDate((prev) => (prev === d.isoDate ? null : d.isoDate))}
              className={`group flex flex-col items-center justify-center rounded-2xl py-3.5 px-2 transition-all border cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 -translate-y-0.5'
                  : d.isToday
                    ? 'bg-blue-50/70 text-blue-700 border-blue-400 ring-1 ring-blue-400/50 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-500/60'
                    : 'bg-slate-50/70 text-slate-700 border-slate-200/70 hover:bg-blue-50/50 hover:border-blue-200 dark:bg-[#0F172A] dark:text-slate-300 dark:border-slate-800/80 dark:hover:bg-slate-800/70 dark:hover:border-slate-700'
              }`}
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isActive ? 'text-blue-100' : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                }`}
              >
                {d.label}
              </span>
              <span className={`mt-1 text-lg sm:text-xl font-extrabold ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {d.dayNum}
              </span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                Thg {d.monthNum}
              </span>

              <div className="mt-2 flex items-center space-x-1 h-2">
                {d.count > 0 ? (
                  <>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive ? 'bg-white' : d.hasUpcoming ? 'bg-blue-600' : 'bg-emerald-500'
                      }`}
                    />
                    {d.count > 1 && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-blue-200' : 'bg-amber-400'}`} />
                    )}
                  </>
                ) : (
                  <span className={`h-1 w-1 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-300 dark:bg-slate-700'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

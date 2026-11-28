// Lịch sử thao tác của 1 lịch khám: dòng tóm tắt thao tác gần nhất + nút mở dòng thời gian đầy đủ.
import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import type { AppointmentEvent, AppointmentItem } from '../../types';
import { doctorApi } from '../../services/api';
import { describeChanges, formatEventSummary, formatEventTime } from '../../utils/appointmentHistory';

export const AppointmentHistory: React.FC<{ apt: AppointmentItem }> = ({ apt }) => {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AppointmentEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // Luôn tải lại khi mở để thấy thao tác mới nhất
    setLoading(true);
    setError(false);
    try {
      setEvents(await doctorApi.getAppointmentHistory(apt.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Lịch tạo trước khi có tính năng lịch sử: chỉ còn mốc tạo/cập nhật
  const summary = apt.last_event
    ? formatEventSummary(apt.last_event)
    : apt.created_at
      ? `Tạo lúc ${formatEventTime(apt.created_at)}`
      : '';

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition cursor-pointer"
        title="Xem lịch sử thao tác"
      >
        <History className="h-3.5 w-3.5" />
        <span>{summary || 'Lịch sử thao tác'}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          {loading ? (
            <p className="text-[11px] text-slate-400">Đang tải lịch sử…</p>
          ) : error ? (
            <p className="text-[11px] text-rose-500">Không tải được lịch sử. Vui lòng thử lại.</p>
          ) : !events || events.length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Chưa có lịch sử chi tiết (lịch được tạo trước khi bật tính năng ghi lịch sử).
              {apt.created_at && <> Tạo lúc {formatEventTime(apt.created_at)}.</>}
              {apt.updated_at && apt.updated_at !== apt.created_at && (
                <> Cập nhật lần cuối {formatEventTime(apt.updated_at)}.</>
              )}
            </p>
          ) : (
            <ol className="relative space-y-2.5 border-l border-slate-200 pl-4 dark:border-slate-700">
              {events.map((ev) => {
                const changes = describeChanges(ev);
                return (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 dark:border-slate-900" />
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{formatEventSummary(ev)}</p>
                    {changes.map((c) => (
                      <p key={c} className="text-[11px] text-slate-500 dark:text-slate-400">
                        {c}
                      </p>
                    ))}
                    {ev.note && (
                      <p className="text-[11px] italic text-slate-500 dark:text-slate-400">“{ev.note}”</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

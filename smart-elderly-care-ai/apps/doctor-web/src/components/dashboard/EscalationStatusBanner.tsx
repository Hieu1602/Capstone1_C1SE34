import React, { useEffect, useState } from 'react';
import { AlertTriangle, PhoneCall, Clock, ArrowRight } from 'lucide-react';
import { Incident } from '../../types';
import { doctorWebSocket } from '../../services/websocket';

interface EscalationStatusBannerProps {
  incidents: Incident[];
  onOpenNotifications: () => void;
}

const ESCALATION_WINDOW_SEC = 45;

export const EscalationStatusBanner: React.FC<EscalationStatusBannerProps> = ({
  incidents,
  onOpenNotifications,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [wsEscalatedIds, setWsEscalatedIds] = useState<Set<string>>(() => new Set());

  const activeCriticalIncidents = incidents.filter((inc) => {
    if (inc.is_acknowledged) return false;
    const t = (inc.alert_type || '').toUpperCase();
    return (
      t.includes('FALL') ||
      t === 'CRITICAL_TRIAD' ||
      t === 'CARDIO_COLLAPSE' ||
      inc.alert_level === 'CRITICAL'
    );
  });

  useEffect(() => {
    if (activeCriticalIncidents.length === 0) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCriticalIncidents.length]);

  useEffect(() => {
    const unsub = doctorWebSocket.subscribe((event) => {
      if (event?.type === 'INCIDENT_ESCALATED') {
        const incId = event.incident_id || event.data?.id;
        if (incId) {
          setWsEscalatedIds((prev) => new Set(prev).add(String(incId)));
        }
      }
    });
    return () => unsub();
  }, []);

  if (activeCriticalIncidents.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {activeCriticalIncidents.slice(0, 2).map((inc) => {
        const createdMs = inc.created_at ? new Date(inc.created_at).getTime() : nowMs;
        const elapsedSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
        const remainingSec = Math.max(0, ESCALATION_WINDOW_SEC - elapsedSec);
        const isEscalated =
          Boolean(inc.notes?.includes('ESCALATED_AUTO_CALL')) ||
          wsEscalatedIds.has(inc.id) ||
          elapsedSec >= ESCALATION_WINDOW_SEC;

        return (
          <div
            key={inc.id}
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border p-4 shadow-sm transition-all ${
              isEscalated
                ? 'border-rose-300 bg-rose-50/90 dark:border-rose-800/80 dark:bg-rose-950/50'
                : 'border-amber-300 bg-amber-50/90 dark:border-amber-800/80 dark:bg-amber-950/40'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isEscalated
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {isEscalated ? (
                  <PhoneCall className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    {inc.alert_type?.includes('FALL')
                      ? 'Cảnh báo Té ngã AI'
                      : 'Sự cố Y tế Nguy kịch'}
                  </span>

                  {isEscalated ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white animate-pulse shadow-xs">
                      <PhoneCall className="h-3 w-3" />
                      Đã tự động kích hoạt gọi cấp cứu 115 (Chưa có người nhà hỗ trợ)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/60 dark:border-amber-700 dark:text-amber-200">
                      <Clock className="h-3 w-3 animate-spin" />
                      Đang chờ gia đình phản hồi (còn {remainingSec}s)
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 truncate">
                  {inc.message || 'Phát hiện sự cố khẩn cấp cần xác nhận hỗ trợ ngay.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenNotifications}
              className={`inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                isEscalated
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <span>Kiểm tra &amp; Xử lý</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

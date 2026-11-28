import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { Incident } from '../../types';
import { doctorWebSocket } from '../../services/websocket';

interface EscalationStatusBannerProps {
  incidents: Incident[];
  onOpenNotifications: () => void;
}

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const EscalationStatusBanner: React.FC<EscalationStatusBannerProps> = ({
  incidents,
  onOpenNotifications,
}) => {
  const [wsEscalatedIds, setWsEscalatedIds] = useState<Set<string>>(() => new Set());

  const nowMs = Date.now();
  const activeCriticalIncidents = incidents.filter((inc) => {
    if (inc.is_acknowledged) return false;
    if (inc.created_at) {
      const createdMs = new Date(inc.created_at).getTime();
      if (!Number.isNaN(createdMs) && nowMs - createdMs > RECENT_WINDOW_MS) {
        return false;
      }
    }
    const t = (inc.alert_type || '').toUpperCase();
    return (
      t.includes('FALL') ||
      t === 'CRITICAL_TRIAD' ||
      t === 'CARDIO_COLLAPSE' ||
      inc.alert_level === 'CRITICAL'
    );
  });

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
        const isUnconfirmedByFamily =
          Boolean(inc.notes?.includes('ESCALATED_AUTO_CALL')) ||
          wsEscalatedIds.has(inc.id);

        return (
          <div
            key={inc.id}
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border p-4 shadow-sm transition-all ${
              isUnconfirmedByFamily
                ? 'border-rose-200 bg-rose-50/80 dark:border-rose-800/70 dark:bg-rose-950/40'
                : 'border-amber-200 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/35'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isUnconfirmedByFamily
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    {inc.alert_type?.includes('FALL')
                      ? 'Cảnh báo Té ngã AI'
                      : 'Cảnh báo Sinh hiệu Mức cao'}
                  </span>

                  {isUnconfirmedByFamily ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-900/60 dark:border-rose-700 dark:text-rose-200">
                      <Clock className="h-3 w-3" />
                      Chưa có người nhà xác nhận • Cần theo dõi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/60 dark:border-amber-700 dark:text-amber-200">
                      <Clock className="h-3 w-3" />
                      Cần bác sĩ theo dõi
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 truncate">
                  {inc.message || 'Phát hiện chỉ số bất thường cần bác sĩ theo dõi.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenNotifications}
              className={`inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                isUnconfirmedByFamily
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <span>Xem chi tiết</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

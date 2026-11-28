// src/components/clinical/NotificationRow.tsx
// Một dòng thông báo trong Linear Inbox (Cảnh báo, Lịch khám, Lời mời, Admin)

import React from 'react';
import {
  AlertTriangle,
  Calendar,
  Sparkles,
  User,
  Check,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
  Megaphone,
} from 'lucide-react';
import type { NotificationInboxItem } from '../../utils/notificationBuilder';
import { getReadAt } from '../../utils/notificationSync';
import { formatEventTime } from '../../utils/appointmentHistory';

interface NotificationRowProps {
  item: NotificationInboxItem;
  onSelect: (item: NotificationInboxItem) => void;
  onToggleRead: (item: NotificationInboxItem) => void;
}

export const NotificationRow: React.FC<NotificationRowProps> = ({ item, onSelect, onToggleRead }) => {
  const isAdmin = item.type === 'ADMIN';
  const isCrit =
    item.alertLevel === 'CRITICAL' || item.alertType === 'FALL_DETECTED' || item.badgeLabel === 'Khẩn cấp';
  const isWarn = !isCrit && (item.alertLevel === 'WARNING' || item.badgeLabel === 'Cảnh báo');

  const borderL = isAdmin
    ? 'border-l-4 border-l-sky-500 bg-sky-50/20 dark:bg-sky-950/20'
    : isCrit
      ? 'border-l-4 border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/20'
      : isWarn
        ? 'border-l-4 border-l-amber-400 bg-amber-50/15 dark:bg-amber-950/10'
        : !item.isRead
          ? 'border-l-4 border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
          : 'border-l-4 border-l-transparent bg-white dark:bg-[#131C31]';

  const iconBoxClass = isAdmin
    ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300'
    : item.type === 'APPOINTMENT'
      ? 'bg-sky-50 text-sky-600'
      : item.type === 'INVITE'
        ? 'bg-emerald-50 text-emerald-600'
        : isCrit
          ? 'bg-rose-50 text-rose-600'
          : 'bg-amber-50 text-amber-600';

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${borderL} ${
        item.isRead ? 'opacity-85' : 'opacity-100'
      }`}
    >
      <div className="flex items-start space-x-3 min-w-0 flex-1">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl relative shadow-2xs mt-0.5 ${iconBoxClass}`}>
          {isAdmin ? (
            <Megaphone className="h-4 w-4" />
          ) : item.type === 'APPOINTMENT' ? (
            <Calendar className="h-4 w-4" />
          ) : item.type === 'INVITE' ? (
            <Sparkles className="h-4 w-4" />
          ) : isCrit ? (
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {!item.isRead && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${item.badgeColor}`}>
              {item.badgeLabel}
            </span>
            {item.patientName && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 text-[10.5px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <User className="h-2.5 w-2.5 text-slate-400" />
                {item.patientName} {item.patientMrCode ? `• ${item.patientMrCode}` : ''}
              </span>
            )}
            {item.repeatBadge && (
              <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold rounded bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                {item.repeatBadge}
              </span>
            )}
            {isCrit && item.badgeLabel !== 'Khẩn cấp' && item.badgeLabel !== 'Nguy cấp' && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-600">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                Khẩn cấp
              </span>
            )}
          </div>

          <h4
            className={`text-sm leading-snug line-clamp-1 ${
              !item.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'
            }`}
          >
            {item.cleanTitle}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
            {item.cleanDesc}
          </p>
          {item.isRead && getReadAt(item.id, item.rawIncidentId) && (
            <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-slate-500">
              Đã đọc lúc {formatEventTime(getReadAt(item.id, item.rawIncidentId))}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 sm:self-center">
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{item.timeOnly}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleRead(item);
          }}
          title={!item.isRead ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc lại'}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors cursor-pointer dark:hover:bg-slate-800 ${
            !item.isRead
              ? 'hover:bg-blue-50 hover:text-blue-600 dark:hover:text-blue-400'
              : 'hover:bg-amber-50 hover:text-amber-600 dark:hover:text-amber-400'
          }`}
        >
          {!item.isRead ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item);
          }}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 shadow-2xs transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
        >
          <span>Chi tiết</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

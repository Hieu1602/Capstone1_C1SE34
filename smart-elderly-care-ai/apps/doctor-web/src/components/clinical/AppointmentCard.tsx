// src/components/clinical/AppointmentCard.tsx
// Thẻ hiển thị thông tin một lịch hẹn khám và các thao tác nhanh

import React from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Volume2,
  Home,
  Building,
  Calendar as CalendarIcon,
} from 'lucide-react';
import type { AppointmentItem } from '../../types';
import { isAppointmentOverdue, isUpcomingAppointmentStatus, parseAppointmentNotes } from '../../utils/appointmentHelpers';

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  COMPLETED: {
    label: 'Đã khám xong',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  CANCELLED: {
    label: 'Đã hủy',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  },
  UPCOMING: {
    label: 'Sắp tới',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
};

interface AppointmentCardProps {
  apt: AppointmentItem;
  onBroadcastReminder?: (apt: AppointmentItem) => void;
  onReschedule: (apt: AppointmentItem) => void;
  onCancel: (apt: AppointmentItem) => void;
  onComplete: (apt: AppointmentItem) => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  apt,
  onBroadcastReminder,
  onReschedule,
  onCancel,
  onComplete,
}) => {
  const isClinic = apt.visit_type === 'CLINIC';
  const isTelehealth = apt.visit_type === 'TELEHEALTH';
  const isOverdue = isAppointmentOverdue(apt.scheduled_at, apt.status);
  const statusBadge = isOverdue
    ? {
        label: 'Quá giờ',
        className: 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900/60',
      }
    : STATUS_BADGE_MAP[apt.status] || STATUS_BADGE_MAP.UPCOMING;
  const { isFamilyConfirmedByNote, cleanNotes } = parseAppointmentNotes(apt.clinical_notes);
  const isFamilyConfirmed = isFamilyConfirmedByNote || apt.status === 'CONFIRMED';

  let timeStr = '--:--';
  let dateStr = apt.scheduled_at;
  try {
    const d = new Date(apt.scheduled_at);
    timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    dateStr = d.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    // fallback
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800/80 dark:bg-[#131C31] dark:hover:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-blue-50/90 border border-blue-100 px-3.5 py-2.5 text-center min-w-[76px] dark:bg-blue-950/40 dark:border-blue-900/50">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mb-1" />
            <span className="text-sm font-extrabold text-blue-700 dark:text-blue-300">{timeStr}</span>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {dateStr.split(',')[1] || dateStr}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {apt.patient_name || 'Bệnh nhân'}
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
              {isFamilyConfirmed && (
                <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Gia đình đã xác nhận đón tiếp</span>
                </span>
              )}
              <span
                className={`inline-flex items-center space-x-1 rounded-lg px-2.5 py-0.5 text-[10px] font-bold ${
                  isClinic
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40'
                    : 'bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/40'
                }`}
              >
                {isClinic ? <Building className="h-3 w-3 mr-1" /> : <Home className="h-3 w-3 mr-1" />}
                <span>
                  {isClinic ? 'Khám tại Phòng khám' : isTelehealth ? 'Tư vấn từ xa (Telehealth)' : 'Khám tại nhà'}
                </span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-slate-700 dark:text-slate-200">Triệu chứng / Ghi chú: </span>
              {cleanNotes || 'Khám sức khỏe định kỳ, kiểm tra huyết áp và tim mạch'}
            </p>
            {apt.status === 'CANCELLED' && apt.cancellation_reason && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                <span className="font-bold">Lý do hủy: </span>
                {apt.cancellation_reason}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center space-x-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>{apt.location || 'Tại nhà bệnh nhân'}</span>
              </div>
              {apt.enable_speaker_reminder !== false && (
                <div className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300">
                  <Volume2 className="h-3 w-3" />
                  <span>Đã đồng bộ Loa Hub (Nhắc 24h & 2h)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hàng nút thao tác nhanh */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3.5">
        <button
          type="button"
          disabled
          title="Chưa hỗ trợ phát loa trực tiếp từ Web — hệ thống tự động phát trước 24 giờ & 2 giờ"
          className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed opacity-75 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-500"
        >
          <Volume2 className="h-3.5 w-3.5" />
          <span>Phát loa trực tiếp (Chưa hỗ trợ)</span>
        </button>

        {isUpcomingAppointmentStatus(apt.status) && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onReschedule(apt)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <CalendarIcon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>Dời lịch</span>
            </button>
            <button
              onClick={() => onCancel(apt)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Hủy lịch</span>
            </button>
            <button
              onClick={() => onComplete(apt)}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Bắt đầu khám / Hoàn tất</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

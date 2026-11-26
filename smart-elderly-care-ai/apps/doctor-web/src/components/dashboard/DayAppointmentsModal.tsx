// src/components/dashboard/DayAppointmentsModal.tsx
// Pop-up modal hiển thị danh sách lịch khám chi tiết của một ngày được chọn từ Mini Calendar

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  CalendarX2,
  Clock,
  User,
  MapPin,
  FileText,
  Plus,
  X,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import type { AppointmentItem } from '../../types';
import { parseAppointmentNotes } from '../../utils/appointmentHelpers';

interface DayAppointmentsModalProps {
  isOpen: boolean;
  dateStr: string; // YYYY-MM-DD
  appointments: AppointmentItem[];
  onClose: () => void;
  onOpenCreate: (dateStr: string) => void;
  onNavigateAppointments: (dateStr: string) => void;
  onSelectPatient?: (patientId: string) => void;
}

export const DayAppointmentsModal: React.FC<DayAppointmentsModalProps> = ({
  isOpen,
  dateStr,
  appointments,
  onClose,
  onOpenCreate,
  onNavigateAppointments,
  onSelectPatient,
}) => {
  // Đóng bằng phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Khóa scroll khi mở modal
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Format ngày hiển thị
  const formattedDate = (() => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  })();

  // Tính thứ trong tuần và kiểm tra có phải hôm nay
  const dayInfo = (() => {
    if (!dateStr) return { dayOfWeek: '', isToday: false };
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayOfWeek = days[dt.getDay()];

      const today = new Date();
      const isToday =
        today.getFullYear() === y &&
        today.getMonth() === m - 1 &&
        today.getDate() === d;

      return { dayOfWeek, isToday };
    } catch {
      return { dayOfWeek: '', isToday: false };
    }
  })();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Click backdrop để đóng */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Hộp thoại Pop-up */}
      <div className="relative z-[101] flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden dark:bg-[#131C31] dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-base font-extrabold text-slate-900 dark:text-white">
                  Lịch khám ngày {formattedDate}
                </h3>
                {dayInfo.isToday && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    Hôm nay
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {dayInfo.dayOfWeek} • {appointments.length > 0 ? `${appointments.length} ca hẹn được lên lịch` : 'Chưa có lịch khám'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                appointments.length > 0
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {appointments.length} ca
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Đóng (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Nội dung danh sách hoặc thông báo rỗng */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {appointments.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
                <span>Danh sách bệnh nhân hẹn khám ({appointments.length})</span>
                <span className="text-[11px] text-slate-400">Sắp xếp theo khung giờ</span>
              </div>

              {appointments.map((apt) => {
                const isCompleted = apt.status === 'COMPLETED';
                const isCancelled = apt.status === 'CANCELLED';
                const { isFamilyConfirmedByNote, cleanNotes } = parseAppointmentNotes(apt.clinical_notes);
                const isFamilyConfirmed = isFamilyConfirmedByNote || apt.status === 'CONFIRMED';

                // Format thời gian
                const timeStr = (() => {
                  if (!apt.scheduled_at) return '--:--';
                  try {
                    const d = new Date(apt.scheduled_at);
                    return d.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    });
                  } catch {
                    return apt.scheduled_at.slice(11, 16) || '--:--';
                  }
                })();

                return (
                  <div
                    key={apt.id}
                    className="group relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-600"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Cột thông tin giờ và bệnh nhân */}
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Huy hiệu giờ khám */}
                        <div className="flex flex-col items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shrink-0">
                          <Clock className="h-4 w-4 mb-0.5 text-blue-600 dark:text-blue-400" />
                          <span className="font-mono text-xs font-extrabold">{timeStr}</span>
                        </div>

                        {/* Thông tin bệnh nhân */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {apt.patient_name || 'Bệnh nhân'}
                            </span>
                            {/* Trạng thái */}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold border ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60'
                                  : isCancelled
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Đã khám</span>
                                </>
                              ) : isCancelled ? (
                                <>
                                  <XCircle className="h-3 w-3" />
                                  <span>Đã hủy</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3" />
                                  <span>Sắp tới</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* Loại khám & Địa điểm */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              {apt.exam_type ||
                                (apt.visit_type === 'HOME' || apt.visit_type === 'HOME_VISIT'
                                  ? 'Khám tại nhà'
                                  : apt.visit_type === 'TELEHEALTH'
                                    ? 'Tư vấn từ xa'
                                    : 'Khám tại phòng khám')}
                            </span>
                            {apt.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                <span className="truncate max-w-[200px]">{apt.location}</span>
                              </span>
                            )}
                          </div>

                          {/* Ghi chú lâm sàng nếu có */}
                          {isFamilyConfirmed && (
                            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Gia đình đã xác nhận đón tiếp</span>
                            </span>
                          )}
                          {cleanNotes && (
                            <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs italic text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 border-l-2 border-blue-400">
                              "{cleanNotes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Nút tác vụ xem hồ sơ bệnh nhân */}
                      {onSelectPatient && apt.patient_id && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectPatient(apt.patient_id);
                          }}
                          className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Hồ sơ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Thông báo rỗng khi ngày đó KHÔNG CÓ lịch khám nào */
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-4 dark:bg-slate-800/80 dark:text-slate-500">
                <CalendarX2 className="h-8 w-8" />
              </div>
              <h4 className="font-heading text-base font-extrabold text-slate-800 dark:text-slate-100 mb-1">
                Không có lịch khám nào trong ngày này
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-5">
                Bác sĩ chưa có ca hẹn khám bệnh nào được ghi nhận cho ngày{' '}
                <strong className="text-slate-700 dark:text-slate-200 font-bold">{formattedDate}</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreate(dateStr);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Đặt lịch khám cho ngày này</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/50 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateAppointments(dateStr);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
          >
            <span>Đến trang Quản lý lịch khám</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-2">
            {appointments.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreate(dateStr);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm lịch</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

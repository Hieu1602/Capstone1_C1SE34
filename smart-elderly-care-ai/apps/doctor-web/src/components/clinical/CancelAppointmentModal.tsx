// src/components/clinical/CancelAppointmentModal.tsx
// Modal xác nhận hủy lịch khám thay thế hoàn toàn window.prompt() và alert()
// Đồng bộ phong cách SaaS Y tế hiện đại: Card tóm tắt ca khám, chọn nhanh lý do (Pill Chips), thông báo gửi loa Hub

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  X,
  User,
  Clock,
  MapPin,
  Volume2,
  Loader2,
} from 'lucide-react';
import { AppointmentItem } from '../../types';

interface CancelAppointmentModalProps {
  isOpen: boolean;
  appointment: AppointmentItem | null;
  onClose: () => void;
  onConfirm: (appointmentId: string, reason: string) => Promise<void>;
}

const QUICK_REASONS = [
  'Bác sĩ có ca cấp cứu đột xuất',
  'Bệnh nhân / Gia đình xin hoãn',
  'Thay đổi lịch công tác',
  'Lý do khác',
];

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return `${time} • ${date}`;
  } catch {
    return dateStr;
  }
}

export const CancelAppointmentModal: React.FC<CancelAppointmentModalProps> = ({
  isOpen,
  appointment,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState(QUICK_REASONS[0]);
  const [selectedChip, setSelectedChip] = useState(QUICK_REASONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason(QUICK_REASONS[0]);
      setSelectedChip(QUICK_REASONS[0]);
      setIsSubmitting(false);
    }
  }, [isOpen, appointment]);

  if (!isOpen || !appointment) return null;

  const handleSelectChip = (chip: string) => {
    setSelectedChip(chip);
    if (chip === 'Lý do khác') {
      setReason('');
    } else {
      setReason(chip);
    }
  };

  const handleTextChange = (val: string) => {
    setReason(val);
    if (QUICK_REASONS.includes(val)) {
      setSelectedChip(val);
    } else {
      setSelectedChip('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason.trim() || 'Thay đổi lịch khám từ Bác sĩ';
    setIsSubmitting(true);
    try {
      await onConfirm(appointment.id, finalReason);
      onClose();
    } catch {
      // lỗi được xử lý ở parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHomeVisit = appointment.visit_type === 'HOME_VISIT';

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative z-[101] w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng X ở góc phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 1. Header cảnh báo */}
        <div className="flex items-start space-x-3.5 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Xác nhận hủy cuộc hẹn khám
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cuộc hẹn sẽ bị hủy bỏ và gửi thông báo trực tiếp đến gia đình bệnh nhân.
            </p>
          </div>
        </div>

        {/* 2. Tóm tắt thông tin ca khám sắp hủy */}
        <div className="mb-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>{appointment.patient_name || 'Bệnh nhân'}</span>
            </div>
            <span
              className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold ${
                isHomeVisit
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
              }`}
            >
              {isHomeVisit ? 'Khám tại nhà' : 'Khám tại Phòng khám'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{formatDateTime(appointment.scheduled_at)}</span>
          </div>

          {appointment.location && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{appointment.location}</span>
            </div>
          )}
        </div>

        {/* 3. Form lý do & chọn nhanh Pill Chips */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Chọn nhanh lý do hủy:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((chip) => {
                const isActive = selectedChip === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSelectChip(chip)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'border border-rose-300 bg-rose-50 text-rose-700 shadow-2xs dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Chi tiết lý do gửi đến người nhà:
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Nhập hoặc bổ sung chi tiết lý do hủy lịch..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-white resize-none"
            />
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-cyan-700 dark:text-cyan-400 font-medium">
              <Volume2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Thông báo hủy kèm lý do sẽ được gửi ngay tới ứng dụng Gia đình &amp; Loa Hub.</span>
            </div>
          </div>

          {/* 4. Thanh nút hành động */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Quay lại
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-all disabled:opacity-50 cursor-pointer shadow-rose-600/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang hủy...</span>
                </>
              ) : (
                <span>Xác nhận hủy lịch</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

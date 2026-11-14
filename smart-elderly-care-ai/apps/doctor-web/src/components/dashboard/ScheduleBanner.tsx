// src/components/dashboard/ScheduleBanner.tsx
// Card Lịch Khám Kế Tiếp thiết kế gradient xanh #2563EB đồng bộ 100% với Mobile DoctorHomeScreen

import React from 'react';
import { AppointmentItem } from '../../types';
import { Calendar, Clock, MapPin, Volume2, ChevronRight, Stethoscope } from 'lucide-react';

interface ScheduleBannerProps {
  appointment: AppointmentItem | null;
  onOpenDetail?: (apt: AppointmentItem) => void;
}

export const ScheduleBanner: React.FC<ScheduleBannerProps> = ({
  appointment,
  onOpenDetail,
}) => {
  if (!appointment) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 text-white shadow-xl shadow-blue-500/20">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
            <Calendar className="h-6 w-6 text-blue-100" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Chưa có lịch khám kế tiếp</h3>
            <p className="text-xs text-blue-100/80">
              Hiện tại Bác sĩ không có ca khám nào sắp tới trong hôm nay.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Định dạng thời gian
  let formattedTime = appointment.scheduled_at;
  try {
    const d = new Date(appointment.scheduled_at);
    formattedTime = `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  } catch {
    // fallback
  }

  const isClinic = appointment.visit_type === 'CLINIC';

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 lg:p-7 text-white shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/30">
      {/* Lớp nền trang trí */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl transition-transform group-hover:scale-110" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-blue-400/20 blur-xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Bên trái: Thông tin lịch khám */}
        <div className="space-y-3">
          {/* Tag Lịch khám kế tiếp */}
          <div className="inline-flex items-center space-x-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/20">
            <Calendar className="h-3.5 w-3.5 text-blue-100" />
            <span className="tracking-wide">LỊCH KHÁM KẾ TIẾP</span>
          </div>

          {/* Tên bệnh nhân */}
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-xs">
              {appointment.patient_name || 'Bệnh nhân'}
            </h2>
            <p className="mt-1 text-xs md:text-sm text-blue-100/90 flex items-center space-x-2">
              <Stethoscope className="h-4 w-4 shrink-0 text-blue-200" />
              <span>
                {appointment.clinical_notes || appointment.exam_type || 'Khám sức khỏe tổng quát'}
              </span>
              <span>•</span>
              <span className="font-semibold text-white">
                {isClinic ? 'Khám tại Phòng khám' : 'Thăm khám Tại nhà'}
              </span>
            </p>
          </div>

          {/* Hàng thông tin thời gian & địa điểm */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center space-x-2 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-medium backdrop-blur-xs">
              <Clock className="h-3.5 w-3.5 text-blue-200" />
              <span>{formattedTime}</span>
            </div>

            <div className="flex items-center space-x-2 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-medium backdrop-blur-xs">
              <MapPin className="h-3.5 w-3.5 text-blue-200" />
              <span>{appointment.location || (isClinic ? 'Phòng khám Bác sĩ Gia đình' : 'Nhà riêng bệnh nhân')}</span>
            </div>
          </div>

          {/* Ghi chú Loa thông minh */}
          {appointment.enable_speaker_reminder !== false && (
            <div className="flex items-center space-x-1.5 text-[11px] text-blue-100/80">
              <Volume2 className="h-3.5 w-3.5 text-emerald-300" />
              <span>Loa Orange Pi Hub tự động phát giọng nói nhắc nhở trước 24h & 2h.</span>
            </div>
          )}
        </div>

        {/* Bên phải: Nút hành động */}
        <div className="flex shrink-0 items-center">
          <button
            onClick={() => onOpenDetail && onOpenDetail(appointment)}
            className="flex items-center space-x-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold text-blue-700 shadow-md transition-all hover:bg-blue-50 hover:shadow-lg active:scale-95"
          >
            <span>Chi tiết ca khám</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};


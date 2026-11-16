import React from 'react';
import { Clock, Plus, Volume2, RefreshCw } from 'lucide-react';
import { AppointmentItem } from '../../types';

export interface DoctorHeroBannerProps {
  doctorName: string;
  doctorAvatar: string | null;
  doctorInitial: string;
  nextAppointment: AppointmentItem | null;
  patientCount: number;
  warningCount: number;
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateAppointment: () => void;
  onNavigateAppointments: () => void;
}

export const DoctorHeroBanner: React.FC<DoctorHeroBannerProps> = ({
  doctorName,
  doctorAvatar,
  doctorInitial,
  nextAppointment,
  patientCount,
  warningCount,
  loading,
  onRefresh,
  onOpenCreateAppointment,
  onNavigateAppointments,
}) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 p-6 lg:p-8 text-white shadow-lg shadow-blue-500/15">
      {/* Ảnh minh họa Đội ngũ Bác sĩ phía bên phải */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 hidden md:block md:w-72 lg:w-96 overflow-hidden">
        <img
          src="/doctor-banner.png"
          alt="Đội ngũ Bác sĩ"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-blue-500 to-transparent" />
        <div className="absolute inset-0 bg-blue-600/10" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pr-0 md:pr-72 lg:pr-96">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/25">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              Đang trực tuyến
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-100">
              <Clock className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>

          <div className="flex items-center gap-3.5 pt-1">
            <div className="relative inline-block shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-700/90 border-2 border-white/70 text-lg font-black text-white shadow-md overflow-hidden">
                {doctorAvatar ? (
                  <img src={doctorAvatar} alt={doctorName} className="h-full w-full object-cover" />
                ) : (
                  doctorInitial
                )}
              </div>
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white shadow-md z-10" />
            </div>

            <div>
              <h1 className="font-heading text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                Xin chào, {doctorName} 👋
              </h1>
              <p className="text-xs text-blue-100 font-medium">
                Hôm nay công việc thế nào? Hệ thống AI luôn đồng hành cùng Bác sĩ.
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-blue-50/95 leading-relaxed">
            {nextAppointment ? (
              <>
                Ca khám kế tiếp: <strong>{nextAppointment.patient_name}</strong> lúc{' '}
                <strong>
                  {new Date(nextAppointment.scheduled_at).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>{' '}
                ({nextAppointment.location || 'Khám tại nhà'}).
              </>
            ) : (
              <>
                Chúc Bác sĩ một ngày làm việc hiệu quả! Hệ thống AI đang giám sát{' '}
                {loading && patientCount === 0 ? (
                  <span className="inline-block h-4 w-7 rounded bg-white/30 animate-pulse align-middle mx-1" />
                ) : (
                  <strong>{patientCount} hồ sơ người cao tuổi</strong>
                )}{' '}
                và{' '}
                {loading && warningCount === 0 ? (
                  <span className="inline-block h-4 w-7 rounded bg-white/30 animate-pulse align-middle mx-1" />
                ) : (
                  <strong>{warningCount} cảnh báo cần lưu ý</strong>
                )}{' '}
                hôm nay.
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onOpenCreateAppointment}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-blue-700 shadow-md transition hover:bg-blue-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Đặt lịch mới</span>
            </button>
            <button
              onClick={onNavigateAppointments}
              className="flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/25 cursor-pointer"
            >
              <Volume2 className="h-4 w-4" />
              <span>Tạo nhắc nhở loa Hub</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20 cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

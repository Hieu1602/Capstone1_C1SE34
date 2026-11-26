// src/components/settings/DoctorProfileColumn.tsx
// Cột trái trang Cài đặt: Hồ sơ Bác sĩ, Thống kê & Thông tin hành nghề / pháp lý

import React from 'react';
import { ShieldCheck, Camera, Edit3, Users, Calendar, Award, Monitor } from 'lucide-react';
import type { DoctorProfileInfo } from '../../types';
import { formatGender } from '../../utils/formatters';

const maskPhone = (phone?: string) => {
  const c = phone?.trim() || '';
  return !c ? 'Chưa cập nhật' : c.length <= 4 ? '***' : `${c.slice(0, 3)}****${c.slice(-3)}`;
};

interface DoctorProfileColumnProps {
  docInfo: DoctorProfileInfo;
  doctorInitial: string;
  patientCount: number;
  appointmentCount: number;
  onPreviewAvatar: () => void;
  onTriggerFileInput: () => void;
  onResetAvatar: (e?: React.MouseEvent) => void;
  onOpenEdit: () => void;
}

export const DoctorProfileColumn: React.FC<DoctorProfileColumnProps> = ({
  docInfo,
  doctorInitial,
  patientCount,
  appointmentCount,
  onPreviewAvatar,
  onTriggerFileInput,
  onResetAvatar,
  onOpenEdit,
}) => {
  const statCards = [
    {
      icon: Users,
      label: 'Bệnh nhân',
      value: patientCount,
      sub: 'Đang phụ trách điều trị',
      iconBox: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
      valClass: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: Calendar,
      label: 'Lịch khám',
      value: appointmentCount,
      sub: 'Ca khám bệnh',
      iconBox: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
      valClass: 'text-teal-600 dark:text-teal-400',
    },
  ];

  const legalRows: Array<{ label: string; value: React.ReactNode; valueClass?: string }> = [
    {
      label: 'Số chứng chỉ CCHN:',
      value: docInfo.cchn_number,
      valueClass:
        'rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300',
    },
    { label: 'Giới tính:', value: formatGender(docInfo.gender), valueClass: 'font-semibold text-slate-900 dark:text-white' },
    { label: 'Đơn vị công tác:', value: docInfo.hospital, valueClass: 'font-semibold text-slate-900 dark:text-white' },
    {
      label: 'Chuyên khoa phụ trách:',
      value: docInfo.department,
      valueClass: 'font-semibold text-slate-900 dark:text-white',
    },
    {
      label: 'SĐT trực cấp cứu:',
      value: maskPhone(docInfo.phone),
      valueClass: 'font-bold text-blue-600 dark:text-blue-400',
    },
  ];

  return (
    <div className="lg:col-span-6 space-y-5">
      {/* 1. Hero Profile Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="flex flex-col items-center sm:items-start gap-1.5 shrink-0">
            <div className="relative h-20 w-20">
              <div
                onClick={onPreviewAvatar}
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-[#131C31] bg-blue-600 text-2xl font-extrabold text-white shadow-md cursor-pointer hover:ring-2 hover:ring-blue-400/80 transition-all group"
                title="Nhấn để xem ảnh đại diện"
              >
                {docInfo.avatarUri ? (
                  <img
                    src={docInfo.avatarUri}
                    alt={docInfo.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  doctorInitial
                )}
              </div>

              <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full ring-2 ring-white dark:ring-[#131C31] shadow-md bg-emerald-500 z-10 pointer-events-none" />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerFileInput();
                }}
                className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm hover:scale-110 hover:bg-slate-50 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 z-20"
                title="Thay đổi ảnh đại diện"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            {docInfo.avatarUri && (
              <button
                type="button"
                onClick={onResetAvatar}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 hover:underline transition cursor-pointer"
                title="Khôi phục về chữ M nền xanh chuẩn y tế"
              >
                Xóa ảnh / Đặt lại
              </button>
            )}
          </div>

          {/* Thông tin */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Đã xác minh CCHN
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                <Monitor className="h-3 w-3" />
                Web MT + App ĐT
              </span>
            </div>
            <h2 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">{docInfo.name}</h2>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">{docInfo.degree}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{docInfo.specialty}</p>
          </div>
        </div>

        <button
          onClick={onOpenEdit}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 cursor-pointer dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          <Edit3 className="h-4 w-4" />
          <span>Chỉnh sửa hồ sơ chuyên môn Bác sĩ</span>
        </button>
      </div>

      {/* 2. Thống kê 2 cột: Bệnh nhân & Lịch khám */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBox}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{stat.label}</span>
              </div>
              <p className={`text-2xl font-extrabold ${stat.valClass}`}>{stat.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* 3. Thông tin hành nghề & Pháp lý */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Award className="h-4 w-4" />
            </div>
            <span className="text-xs font-extrabold tracking-wide text-slate-900 dark:text-white">
              HỒ SƠ CHUYÊN MÔN & PHÁP LÝ
            </span>
          </div>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
            BỘ Y TẾ CẤP
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {legalRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="font-medium text-slate-500 dark:text-slate-400">{row.label}</span>
              <span className={row.valueClass}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

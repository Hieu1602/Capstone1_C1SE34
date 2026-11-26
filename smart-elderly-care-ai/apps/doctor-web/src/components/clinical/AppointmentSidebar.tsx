// src/components/clinical/AppointmentSidebar.tsx
// Cột phải: Thống kê hiệu suất khám trong tuần & Trạng thái Loa Hub Gia đình

import React from 'react';
import { Sparkles, Radio, BellRing } from 'lucide-react';

interface AppointmentSidebarProps {
  counts: {
    UPCOMING: number;
    COMPLETED: number;
    CANCELLED: number;
    ALL: number;
  };
  completionRate: number;
  hubEnabledCount: number;
  onTestHubSpeaker?: () => void;
}

export const AppointmentSidebar: React.FC<AppointmentSidebarProps> = ({
  counts,
  completionRate,
  hubEnabledCount,
  onTestHubSpeaker,
}) => {
  const statTiles = [
    {
      label: 'Sắp tới',
      value: counts.UPCOMING,
      boxClass: 'bg-blue-50/70 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/40',
      valClass: 'text-blue-700 dark:text-blue-300',
    },
    {
      label: 'Đã khám',
      value: counts.COMPLETED,
      boxClass: 'bg-emerald-50/70 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40',
      valClass: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Đã hủy',
      value: counts.CANCELLED,
      boxClass: 'bg-rose-50/70 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/40',
      valClass: 'text-rose-700 dark:text-rose-300',
    },
  ];

  const hubRows = [
    {
      label: 'Ca khám bật Loa nhắc:',
      value: `${hubEnabledCount} / ${counts.ALL} ca`,
      valClass: 'font-extrabold text-slate-900 dark:text-white',
    },
    {
      label: 'Khung giờ phát tự động:',
      value: 'Trước 24h & Trước 2h',
      valClass: 'font-bold text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Âm lượng Loa Hub chuẩn:',
      value: '80% (Rõ ràng cho NCT)',
      valClass: 'font-bold text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <div className="lg:col-span-4 space-y-5">
      {/* Thẻ 1: Thống kê tỷ lệ hoàn thành khám trong tuần */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Hiệu suất Khám trong Tuần</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            {completionRate}%
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Tỷ lệ hoàn thành lịch hẹn và tái khám định kỳ cho người cao tuổi
        </p>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(15, completionRate))}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {statTiles.map((tile) => (
            <div key={tile.label} className={`rounded-xl p-2.5 border ${tile.boxClass}`}>
              <span className={`text-lg font-extrabold ${tile.valClass}`}>{tile.value}</span>
              <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {tile.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Thẻ 2: Trạng thái Đồng bộ Loa Thông minh Hub Gia đình */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Nhắc nhở Loa Hub Gia đình</h3>
            </div>
          </div>
          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Trực tuyến</span>
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          Hệ thống tự động phát thông báo giọng nói tiếng Việt qua thiết bị <strong>SmartCare Hub</strong> đặt tại nhà
          bệnh nhân trước giờ khám <strong>24 giờ</strong> và <strong>2 giờ</strong>.
        </p>

        <div className="space-y-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-100 mb-4 text-xs dark:bg-[#0F172A] dark:border-slate-700/60">
          {hubRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">{row.label}</span>
              <span className={row.valClass}>{row.value}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled
          title="Chưa hỗ trợ phát loa trực tiếp từ Web — hệ thống tự động phát trước 24 giờ & 2 giờ"
          className="flex w-full items-center justify-center space-x-2 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-400 cursor-not-allowed opacity-75 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-500"
        >
          <BellRing className="h-4 w-4" />
          <span>Phát thử Loa Hub (Chưa hỗ trợ từ Web)</span>
        </button>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">
          Chưa hỗ trợ phát loa trực tiếp từ Web — hệ thống tự động phát trước 24 giờ & 2 giờ.
        </p>
      </div>
    </div>
  );
};

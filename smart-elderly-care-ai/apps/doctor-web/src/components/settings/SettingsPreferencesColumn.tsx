// src/components/settings/SettingsPreferencesColumn.tsx
// Cột phải trang Cài đặt: Cảnh báo sinh hiệu, Loa Hub, Bảo mật & Chế độ nền tối

import React from 'react';
import { Bell, LogOut, ChevronRight, Moon, type LucideIcon } from 'lucide-react';

interface ToggleSwitchProps {
  checked: boolean;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
      checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
        checked ? 'translate-x-5' : ''
      }`}
    />
  </button>
);

export interface AlertSwitchItem {
  title: string;
  sub: string;
  val: boolean;
  onToggle: () => void;
}

export interface SettingsMenuAction {
  icon: LucideIcon;
  bg: string;
  title: string;
  sub: string;
  onClick: () => void;
}

interface SettingsPreferencesColumnProps {
  alertSwitches: AlertSwitchItem[];
  menuActions: SettingsMenuAction[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLogout: () => void;
}

export const SettingsPreferencesColumn: React.FC<SettingsPreferencesColumnProps> = ({
  alertSwitches,
  menuActions,
  isDarkMode,
  onToggleDarkMode,
  onOpenLogout,
}) => {
  const activeCount = alertSwitches.filter((sw) => sw.val).length;
  const allActive = activeCount === alertSwitches.length && alertSwitches.length > 0;
  const statusLabel =
    activeCount === 0
      ? 'Đã tắt'
      : allActive
      ? 'Đang kích hoạt'
      : `Đang bật ${activeCount}/${alertSwitches.length}`;

  return (
    <div className="lg:col-span-6 space-y-5">
      {/* 1. Thẻ Cấu hình Cảnh báo Sinh hiệu & Thông báo */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Bell className="h-4 w-4" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
              Cài đặt Thông báo
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
              activeCount > 0
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {statusLabel}
          </span>
        </div>

      <div className="space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800">
        {alertSwitches.map((sw) => (
          <div key={sw.title} className="flex items-center justify-between gap-4 pt-3 first:pt-0">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{sw.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sw.sub}</p>
            </div>
            <ToggleSwitch checked={sw.val} onToggle={sw.onToggle} />
          </div>
        ))}
      </div>
    </div>

    {/* 2. Bảo mật Tài khoản & Quản lý Thiết bị */}
    <div>
      <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        BẢO MẬT TÀI KHOẢN & THIẾT BỊ ĐỒNG BỘ
      </p>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white divide-y divide-slate-100 shadow-xs dark:border-slate-800/80 dark:bg-[#131C31] dark:divide-slate-800">
        {menuActions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={item.onClick}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${item.bg}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          );
        })}

        {/* Chế độ nền tối (Tối ưu thị giác khi trực ca đêm - Đồng bộ 100% với App Mobile) */}
        <div className="flex w-full items-center justify-between gap-3.5 px-4 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white bg-blue-600">
              <Moon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Chế độ nền tối</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Tối ưu thị giác khi Bác sĩ trực ca đêm
              </p>
            </div>
          </div>
          <ToggleSwitch checked={isDarkMode} onToggle={onToggleDarkMode} />
        </div>
      </div>
    </div>

    {/* Nút Đăng xuất */}
    <button
      onClick={onOpenLogout}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white py-3.5 text-xs font-bold text-rose-600 shadow-xs transition hover:bg-rose-50 cursor-pointer dark:border-rose-900/60 dark:bg-[#131C31] dark:text-rose-400 dark:hover:bg-rose-950/40"
    >
      <LogOut className="h-4 w-4" />
      <span>Đăng xuất khỏi tài khoản Bác sĩ</span>
    </button>
  </div>
  );
};

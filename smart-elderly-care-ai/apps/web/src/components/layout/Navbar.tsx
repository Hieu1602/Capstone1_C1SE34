// src/components/layout/Navbar.tsx
// Theme: Sky Blue & White · Interactive Light/Dark Toggle

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, Terminal } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string; tag: string }> = {
  '/': {
    title:    'Tổng Quan Hệ Thống',
    subtitle: 'Trung tâm giám sát y tế · IoT · AI 24/7',
    tag:      'Dashboard',
  },
  '/users': {
    title:    'Quản Lý Người Dùng & Phân Quyền',
    subtitle: 'Kiểm soát tài khoản · Caregiver · Bác sĩ · Phân quyền Role',
    tag:      'Phân hệ 1',
  },
  '/devices': {
    title:    'Giám Sát Thiết Bị IoT',
    subtitle: 'Camera SECA_001 · BLE Smartband · Ngưỡng sinh hiệu',
    tag:      'Phân hệ 2',
  },
  '/infrastructure': {
    title:    'Vận Hành Hạ Tầng & Log Hệ Thống',
    subtitle: 'Redis · TimescaleDB · EMQX Broker · Audit logs',
    tag:      'Phân hệ 3',
  },
  '/ai-maintenance': {
    title:    'Bảo Trì & Giám Sát AI',
    subtitle: 'YOLOv8-Pose · YAMNet · NPU RK3588 · Gemini RAG',
    tag:      'Phân hệ 4',
  },
};

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore();
  const [alertCount] = useState<number>(2);

  const currentRoute = ROUTE_TITLES[location.pathname] ?? {
    title:    'Bảng Điều Khiển',
    subtitle: 'Hệ thống Smart Elderly Care AI',
    tag:      'Admin',
  };

  return (
    <header
      role="banner"
      className="h-14 glass-panel border-b px-5 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200"
    >
      {/* ── Left: Title + Breadcrumb ── */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Terminal className="w-4 h-4" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h1 className="font-heading text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
            {currentRoute.title}
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans truncate hidden sm:block">
            {currentRoute.subtitle}
          </p>
        </div>

        {/* Route tag pill */}
        <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 shrink-0">
          {currentRoute.tag}
        </span>
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Live status micro-badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
          </span>
          <span className="text-[10px] font-semibold font-mono">Live</span>
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white hover:bg-sky-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title="Thông báo cảnh báo khẩn cấp"
          aria-label={`${alertCount} thông báo cảnh báo`}
        >
          <Bell className="w-4.5 h-4.5" aria-hidden="true" />
          {alertCount > 0 && (
            <span
              className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none animate-pulse"
              aria-hidden="true"
            >
              {alertCount}
            </span>
          )}
        </button>

        {/* Dark/Light toggle Button with High Contrast & Immediate Visual Feedback */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:border-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all cursor-pointer shadow-sm"
          title={isDark ? 'Chuyển sang Giao diện Sáng (Trắng & Xanh)' : 'Chuyển sang Giao diện Tối'}
          aria-label={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="text-[11px] font-mono font-semibold hidden md:inline text-amber-300">Sáng</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-600" aria-hidden="true" />
              <span className="text-[11px] font-mono font-semibold hidden md:inline text-sky-700">Tối</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

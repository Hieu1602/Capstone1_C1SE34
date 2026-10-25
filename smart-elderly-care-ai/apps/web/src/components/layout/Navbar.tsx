// src/components/layout/Navbar.tsx
// Dual Theme Support: Light Mode (Enterprise Source of Truth) · Dark Mode (Black Metallic + Orange)

import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sun,
  Moon,
  CheckCircle2,
} from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Tổng quan hệ thống', subtitle: 'Trung tâm điều hành & KPI' },
  '/users': { title: 'Quản lý người dùng', subtitle: 'Tài khoản & phân quyền vai trò' },
  '/security': { title: 'Quản lý bảo mật hệ thống', subtitle: 'Chính sách bảo mật & Audit log' },
  '/notifications': { title: 'Quản lý thông báo', subtitle: 'Thông báo & cảnh báo khẩn cấp' },
  '/monitoring': { title: 'Giám sát hoạt động hệ thống', subtitle: 'Hiệu năng máy chủ & luồng IoT' },
  '/ai-maintenance': { title: 'Bảo trì mô hình AI', subtitle: 'Trạng thái NPU, Edge AI & độ trễ' },
  '/infrastructure': { title: 'Quản lý hạ tầng', subtitle: 'Cơ sở dữ liệu, Cache & MQTT Broker' },
};

export const Navbar: React.FC = () => {
  const { isDark, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const location = useLocation();

  const currentRoute = ROUTE_TITLES[location.pathname] || {
    title: 'Cổng Quản Trị',
    subtitle: 'Smart Elderly Care AI',
  };

  return (
    <header
      role="banner"
      className="h-[68px] shrink-0 bg-white/95 dark:bg-[#161922]/95 backdrop-blur-md border-b border-[#E7E9ED] dark:border-[#323846] px-6 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200"
    >
      {/* ── Left: Page Context / Breadcrumb ── */}
      <div className="flex items-center gap-4 min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#737780] dark:text-[#A1A7B1] uppercase tracking-wider font-mono">
              SECA Platform
            </span>
            <span className="text-slate-300 dark:text-[#323846]">/</span>
            <span className="text-xs font-bold text-[#191B20] dark:text-[#F1F3F7]">
              {currentRoute.title}
            </span>
          </div>
          <p className="text-[11px] text-[#737780] dark:text-[#727984] truncate hidden sm:block font-sans">
            {currentRoute.subtitle}
          </p>
        </div>
      </div>

      {/* ── Right: System Actions ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* System connection indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-[#242936] border border-emerald-200/80 dark:border-[#323846] text-[#16A36A] dark:text-[#22C55E]">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_#22C55E]" />
          </span>
          <span className="text-[11px] font-semibold font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#16A36A] dark:text-[#22C55E]" />
            Hệ thống ổn định
          </span>
        </div>

        {/* Dark/Light Theme Switch */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 p-2.5 rounded-xl border border-[#E7E9ED] dark:border-[#323846] bg-[#F5F6F8] dark:bg-[#1D222D] text-[#737780] dark:text-[#A1A7B1] hover:border-[#F05A24]/40 hover:text-[#F05A24] transition-all cursor-pointer shadow-2xs"
          title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối (Black Metallic)'}
          aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4 text-[#F05A24]" aria-hidden="true" />
          )}
        </button>

        {/* Administrator Profile Pill */}
        <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-[#E7E9ED] dark:border-[#323846]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F05A24] to-[#D94814] dark:from-[#FF7037] dark:to-[#F05A24] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="text-left hidden xl:block">
            <p className="text-xs font-bold text-[#191B20] dark:text-[#F1F3F7] leading-tight">
              {user?.full_name || 'Quản Trị Viên'}
            </p>
            <p className="text-[10px] text-[#737780] dark:text-[#727984] font-mono leading-tight">
              Admin SECA
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

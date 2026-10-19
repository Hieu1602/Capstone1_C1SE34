// src/components/layout/Navbar.tsx
// Theme: Sky Blue & White · Interactive Light/Dark Toggle

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';

export const Navbar: React.FC = () => {
  const { isDark, toggleTheme } = useThemeStore();
  const [alertCount] = useState<number>(2);

  return (
    <header
      role="banner"
      className="h-14 glass-panel border-b border-[#C8AD8A] dark:border-[#23483E] px-5 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200 relative overflow-hidden"
    >
      {/* ── Imperial Heritage Cloud Ribbon Background ── */}
      <div 
        className="absolute inset-y-0 left-0 w-full pointer-events-none select-none z-0 flex items-center overflow-hidden"
        aria-hidden="true"
      >
        <img
          src="/assets/heritage/png/cloud-ribbon-navbar.png"
          alt=""
          className="h-full w-auto max-h-[50px] object-contain object-left opacity-90 dark:opacity-40 filter drop-shadow-xs ml-2"
        />
      </div>

      {/* ── Left: Spacer ── */}
      <div className="flex items-center gap-3 min-w-0 relative z-10" />

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-2 shrink-0 relative z-10">
        {/* Live status micro-badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold font-mono">Live</span>
        </div>

        {/* Notification Bell */}
        <Link
          to="/notifications"
          className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-[#D96C3B] dark:hover:text-white hover:bg-[#D96C3B]/10 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title="Thông báo toàn hệ thống"
          aria-label={`${alertCount} thông báo hệ thống`}
        >
          <Bell className="w-4.5 h-4.5" aria-hidden="true" />
          {alertCount > 0 && (
            <span
              className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#D96C3B] text-white text-[9px] font-bold flex items-center justify-center leading-none animate-pulse"
              aria-hidden="true"
            >
              {alertCount}
            </span>
          )}
        </Link>

        {/* Dark/Light toggle Button */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#EADBCC] dark:border-[#265A4C] bg-[#FFF8EE] dark:bg-[#1A3830] text-slate-700 dark:text-slate-200 hover:border-[#D96C3B] hover:bg-[#FDF0E2] dark:hover:bg-[#1E4B3E] transition-all cursor-pointer shadow-sm"
          title={isDark ? 'Chuyển sang Giao diện Sáng (Hoàng Gia & Cam Gạch)' : 'Chuyển sang Giao diện Tối'}
          aria-label={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="text-[11px] font-mono font-semibold hidden md:inline text-amber-300">Sáng</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-[#D96C3B]" aria-hidden="true" />
              <span className="text-[11px] font-mono font-semibold hidden md:inline text-[#B05325]">Tối</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

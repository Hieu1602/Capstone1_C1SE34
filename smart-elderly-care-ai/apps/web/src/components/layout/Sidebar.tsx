// src/components/layout/Sidebar.tsx
// Dual Theme Support: Light Mode (Enterprise Source of Truth) · Dark Mode (Black Metallic + Orange)

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  BellRing,
  Activity,
  Server,
  LogOut,
  Wifi,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Tổng quan hệ thống',
    path: '/',
    icon: LayoutDashboard,
    description: 'Bảng điều khiển & KPI tổng quan',
  },
  {
    name: 'Quản lý người dùng',
    path: '/users',
    icon: Users,
    description: 'Tài khoản · Phân quyền · Vai trò',
  },
  {
    name: 'Quản lý bảo mật',
    path: '/security',
    icon: ShieldCheck,
    description: 'Chính sách · Phiên JWT · Audit Log',
  },
  {
    name: 'Quản lý thông báo',
    path: '/notifications',
    icon: BellRing,
    description: 'Tạo · Lên lịch · Phát hành',
  },
  {
    name: 'Giám sát hoạt động',
    path: '/monitoring',
    icon: Activity,
    description: 'Hiệu năng máy chủ & luồng IoT',
  },
  {
    name: 'Quản lý hạ tầng',
    path: '/infrastructure',
    icon: Server,
    description: 'PostgreSQL · Redis · EMQX MQTT',
  },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-[250px] shrink-0 flex flex-col h-screen sticky top-0 select-none z-30 bg-[#17191D] dark:bg-[#161922] text-slate-100 border-r border-[#262A34] dark:border-[#323846] shadow-xl relative overflow-hidden transition-all duration-200">
      
      {/* ── Dark Mode Only: Metallic Specular Top Edge Line ── */}
      <div className="hidden dark:block absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#777F8B]/40 to-transparent pointer-events-none" />

      {/* ── Brand Header ── */}
      <div className="px-5 py-4 border-b border-[#262A34] dark:border-[#323846] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#23272F] dark:bg-[#242936] p-1.5 flex items-center justify-center shadow-inner border border-white/5 dark:border-[#323846] shrink-0">
            <img 
              src="/assets/logo.png" 
              alt="SECA Logo" 
              className="w-full h-full object-contain filter drop-shadow"
            />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>SECA</span>
              <span className="text-[#F05A24]">Admin</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#F05A24]/20 text-[#FFA175] border border-[#F05A24]/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-[#8E929C] dark:text-[#727984] truncate font-sans">
              Smart Elderly Care AI
            </p>
          </div>
        </div>
      </div>

      {/* ── System Status Indicator ── */}
      <div className="mx-3 mt-3 relative z-10">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#20242C] dark:bg-[#242936] border border-[#2B303B] dark:border-[#323846] dark:shadow-[inset_0_1px_0_rgba(119,127,139,0.15)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_#22C55E]" />
            </span>
            <span className="text-[11px] font-medium text-slate-300 dark:text-[#F1F3F7]">Hạ tầng trực tuyến</span>
          </div>
          <Wifi className="w-3.5 h-3.5 text-[#F05A24]" aria-hidden="true" />
        </div>
      </div>

      {/* ── Navigation Group ── */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto relative z-10 flex flex-col" aria-label="Admin navigation">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#737780] dark:text-[#727984]">
          Hệ thống Quản trị
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#F05A24] dark:bg-gradient-to-r dark:from-[#FF7037] dark:to-[#F05A24] text-white font-semibold shadow-md dark:shadow-[0_0_16px_rgba(240,90,36,0.25)] dark:border dark:border-white/20'
                    : 'text-[#9DA3AE] dark:text-[#A1A7B1] hover:text-white hover:bg-[#23272F] dark:hover:bg-[#2C3342]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`p-1.5 rounded-lg transition-all duration-150 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#23272F] dark:bg-[#242936] text-[#8E929C] dark:text-[#777F8B] group-hover:bg-[#2B303B] dark:group-hover:bg-[#2C3342] group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="truncate text-left">
                      <div className={`truncate leading-tight text-[12px] ${isActive ? 'text-white font-semibold' : 'text-[#E1E4EA] dark:text-[#F1F3F7]'}`}>
                        {item.name}
                      </div>
                      <div
                        className={`text-[10px] truncate leading-tight mt-0.5 ${
                          isActive
                            ? 'text-white/80'
                            : 'text-[#737780] dark:text-[#727984] group-hover:text-[#9DA3AE] dark:group-hover:text-[#A1A7B1]'
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 font-mono ${
                        isActive
                          ? 'bg-white text-[#F05A24]'
                          : 'bg-[#23272F] dark:bg-[#242936] text-[#FFA175] border border-[#F05A24]/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── User Profile & Logout Footer ── */}
      <div className="p-3 border-t border-[#262A34] dark:border-[#323846] bg-[#14161A] dark:bg-[#13161F] relative z-10">
        <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#1C1F26] dark:bg-[#242936] border border-[#2B303B] dark:border-[#323846]">
          <div className="flex items-center gap-2.5 truncate">
            <div
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F05A24] to-[#D94814] text-white font-bold text-xs flex items-center justify-center shrink-0 font-mono shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
              aria-hidden="true"
            >
              QT
            </div>
            <div className="truncate">
              <p className="text-[11px] font-semibold text-white dark:text-[#F5F6F8] truncate leading-tight">
                {user?.full_name || 'Quản Trị Viên'}
              </p>
              <p className="text-[10px] text-[#8E929C] dark:text-[#727984] truncate font-mono">
                {user?.phone || 'admin@seca.vn'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất khỏi hệ thống"
            className="p-1.5 rounded-lg text-[#8E929C] dark:text-[#777F8B] hover:text-[#EF4444] hover:bg-[#EF4444]/15 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};

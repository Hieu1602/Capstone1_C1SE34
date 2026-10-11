// src/components/layout/Sidebar.tsx
// Theme: Sky Blue & White · Full Dual Light/Dark Support

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Cpu,
  Server,
  BrainCircuit,
  LogOut,
  Activity,
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
    description: 'Dashboard chỉ số tổng thể',
  },
  {
    name: 'Quản lý người dùng',
    path: '/users',
    icon: Users,
    badge: 'PH1',
    description: 'Tài khoản · Phân quyền · Role',
  },
  {
    name: 'Giám sát thiết bị IoT',
    path: '/devices',
    icon: Cpu,
    badge: 'PH2',
    description: 'Camera AI · BLE Band · Ngưỡng',
  },
  {
    name: 'Vận hành hạ tầng',
    path: '/infrastructure',
    icon: Server,
    badge: 'PH3',
    description: 'Timescale · Redis · EMQX',
  },
  {
    name: 'Bảo trì AI',
    path: '/ai-maintenance',
    icon: BrainCircuit,
    badge: 'PH4',
    description: 'YOLOv8 · YAMNet · NPU',
  },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-64 flex flex-col h-screen sticky top-0 select-none z-30 bg-white dark:bg-[#0e1730] border-r border-sky-100 dark:border-sky-950 transition-colors duration-200">

      {/* ── Brand Header ── */}
      <div className="px-5 py-4 border-b border-sky-100 dark:border-sky-950/80">
        <div className="flex items-center gap-3">
          {/* Logo mark - Sky Blue */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
            <Activity className="w-5 h-5 text-white stroke-[2.2]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              SECA <span className="text-sky-600 dark:text-sky-400">Admin</span>
              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-sans">
              Smart Elderly Care AI
            </p>
          </div>
        </div>
      </div>

      {/* ── System Status Pill ── */}
      <div className="mx-3 mt-3">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
            <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">Hạ tầng trực tuyến</span>
          </div>
          <Wifi className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Admin navigation">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
          Cổng Quản Trị
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
                    ? 'bg-sky-500 text-white font-semibold shadow-md shadow-sky-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white hover:bg-sky-50 dark:hover:bg-white/5'
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
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-sky-100 group-hover:text-sky-600 dark:group-hover:bg-sky-950/60 dark:group-hover:text-sky-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="truncate text-left">
                      <div className="truncate leading-tight text-[12px]">{item.name}</div>
                      <div
                        className={`text-[10px] truncate leading-tight mt-0.5 ${
                          isActive
                            ? 'text-white/80'
                            : 'text-slate-400 dark:text-slate-500'
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
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60'
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

      {/* ── User Footer ── */}
      <div className="p-3 border-t border-sky-100 dark:border-sky-950/80 bg-slate-50/60 dark:bg-slate-900/40">
        <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-sky-100 dark:border-sky-900/60 shadow-sm">
          <div className="flex items-center gap-2.5 truncate">
            <div
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 font-mono shadow-sm"
              aria-hidden="true"
            >
              QT
            </div>
            <div className="truncate">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {user?.full_name || 'Quản Trị Viên'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                {user?.phone || 'admin@seca.vn'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất khỏi hệ thống"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};

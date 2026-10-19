// src/components/layout/Sidebar.tsx
// Theme: Sky Blue & White · Full Dual Light/Dark Support

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Shield,
  Activity,
  Server,
  LogOut,
  Wifi,
  Bell,
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
    name: 'Quản lý bảo mật hệ thống',
    path: '/security',
    icon: Shield,
    description: 'Chính sách · JWT Session · Audit Log',
  },
  {
    name: 'Quản lý thông báo',
    path: '/notifications',
    icon: Bell,
    description: 'Tạo · Lên lịch · Phát hành · Thu hồi',
  },
  {
    name: 'Giám sát hoạt động hệ thống',
    path: '/monitoring',
    icon: Activity,
    description: 'Máy chủ · Hiệu năng · IoT & Sự cố',
  },
  {
    name: 'Quản lý hạ tầng',
    path: '/infrastructure',
    icon: Server,
    description: 'PostgreSQL · Redis · EMQX · Log',
  },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-64 flex flex-col h-screen sticky top-0 select-none z-30 bg-[#13382F] text-slate-100 border-r border-[#1E4B3E] shadow-xl relative overflow-hidden transition-colors duration-200">
      


      {/* ── Brand Header ── */}
      <div className="px-5 py-4 border-b border-[#1E4B3E]/80 relative z-10">
        <div className="flex items-center gap-3">
          {/* Logo mark - Official Unified SECA Logo */}
          <div className="w-10 h-10 rounded-xl bg-white/10 p-1 flex items-center justify-center shadow-md border border-[#DFB15B]/30 shrink-0">
            <img 
              src="/assets/logo.png" 
              alt="SECA Logo" 
              className="w-full h-full object-contain filter drop-shadow"
            />
          </div>
          <div className="min-w-0">
            <div className="font-heading text-sm font-bold text-white tracking-tight flex items-center">
              SECA <span className="text-[#DFB15B] ml-1">Admin</span>
              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#DFB15B]/20 text-[#F5DEB3] border border-[#DFB15B]/40">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-[#A6C0B5] truncate font-sans">
              Smart Elderly Care AI
            </p>
          </div>
        </div>
      </div>

      {/* ── System Status Pill ── */}
      <div className="mx-3 mt-3 relative z-10">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#1A4439] border border-[#265A4C]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold text-[#E2F0EA]">Hạ tầng trực tuyến</span>
          </div>
          <Wifi className="w-3.5 h-3.5 text-[#DFB15B]" aria-hidden="true" />
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto relative z-10 flex flex-col" aria-label="Admin navigation">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8EAFA2]">
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
                    ? 'bg-[#1C5142] text-white font-semibold shadow-md border border-[#DFB15B]/40'
                    : 'text-[#C2D7CE] hover:text-white hover:bg-[#184236]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`p-1.5 rounded-lg transition-all duration-150 ${
                        isActive
                          ? 'bg-[#DFB15B] text-[#13382F]'
                          : 'bg-[#184236] text-[#DFB15B] group-hover:bg-[#1E5446] group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="truncate text-left">
                      <div className={`truncate leading-tight text-[12px] ${isActive ? 'text-[#FFF8EE]' : 'text-[#E1ECE7]'}`}>
                        {item.name}
                      </div>
                      <div
                        className={`text-[10px] truncate leading-tight mt-0.5 ${
                          isActive
                            ? 'text-[#DFB15B]'
                            : 'text-[#8EAFA2]'
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
                          ? 'bg-[#DFB15B] text-[#13382F]'
                          : 'bg-[#184236] text-[#DFB15B] border border-[#265A4C]'
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

      {/* Imperial Citadel Palace Artwork resting flush on top of footer line */}
      <div className="px-3 pt-1 pb-0 relative z-10 pointer-events-none select-none flex justify-center -mb-px leading-none">
        <img
          src="/assets/heritage/png/imperial-palace.png"
          alt="Hoàng Thành Huế"
          className="w-full max-w-[226px] h-auto block object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
        />
      </div>

      {/* ── User Footer ── */}
      <div className="p-3 border-t border-[#1E4B3E]/80 bg-[#0F2F27] relative z-10">
        <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#174338] border border-[#265A4C] shadow-sm">
          <div className="flex items-center gap-2.5 truncate">
            <div
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D96C3B] to-[#B08D57] text-white font-bold text-xs flex items-center justify-center shrink-0 font-mono shadow-sm"
              aria-hidden="true"
            >
              QT
            </div>
            <div className="truncate">
              <p className="text-[11px] font-semibold text-white truncate leading-tight">
                {user?.full_name || 'Quản Trị Viên'}
              </p>
              <p className="text-[10px] text-[#A6C0B5] truncate font-mono">
                {user?.phone || 'admin@seca.vn'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất khỏi hệ thống"
            className="p-1.5 rounded-lg text-[#A6C0B5] hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};

// src/components/layout/DoctorNavbar.tsx
// Thanh điều hướng trên cùng mang phong cách Y Tế Clinical Care

import React, { useState } from 'react';
import { useDoctorAuthStore } from '../../store/useDoctorAuthStore';
import { Stethoscope, Bell, LogOut, ShieldCheck, UserCheck } from 'lucide-react';

interface NavbarProps {
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

export const DoctorNavbar: React.FC<NavbarProps> = ({ unreadCount = 0 }) => {
  const { user, logout } = useDoctorAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const doctorName = user?.full_name || 'BS. Trần Văn Minh';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-md">
      {/* Bên trái: Brand & Định danh Bác sĩ gia đình */}
      <div className="flex items-center space-x-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-md shadow-blue-500/20">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-heading text-base font-bold tracking-tight text-slate-900">
              SmartCare AI
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/60">
              Bác sĩ Gia đình
            </span>
          </div>
          <p className="text-xs text-slate-500">Phân hệ Chăm sóc & Theo dõi Sức khỏe Người cao tuổi</p>
        </div>
      </div>

      {/* Bên phải: Chuông thông báo & Hồ sơ Bác sĩ */}
      <div className="flex items-center space-x-4">
        {/* Nút Chuông thông báo */}
        <button
          className="relative rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600"
          title="Thông báo lâm sàng"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Thông tin Bác sĩ & Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-3 rounded-xl p-1.5 transition-colors hover:bg-slate-50 border border-transparent hover:border-slate-200"
          >
            {/* Avatar Bác sĩ có chấm xanh Online */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
              {doctorName.charAt(0) || 'B'}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-slate-900">{doctorName}</p>
              <p className="text-[11px] text-blue-600 font-medium">Bác sĩ phụ trách</p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{doctorName}</p>
                <p className="text-[11px] text-slate-500">{user?.phone || 'Bác sĩ gia đình'}</p>
                <div className="mt-1 flex items-center space-x-1 text-[10px] text-emerald-600 font-medium">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Chứng chỉ hành nghề đã xác thực</span>
                </div>
              </div>

              <div className="py-1">
                <div className="flex items-center space-x-2 rounded-lg px-3 py-2 text-xs text-slate-600">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                  <span>Vai trò: Bác sĩ điều trị</span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={logout}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


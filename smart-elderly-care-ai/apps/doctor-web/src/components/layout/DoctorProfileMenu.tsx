// src/components/layout/DoctorProfileMenu.tsx
// Nút hồ sơ Bác sĩ và Menu Dropdown tài khoản trên DoctorNavbar

import React from 'react';
import { LogOut, ShieldCheck, UserCheck, Settings } from 'lucide-react';

interface DoctorAvatarProps {
  avatarUrl: string | null;
  name: string;
  initial: string;
  size?: 'sm' | 'md';
}

const DoctorAvatar: React.FC<DoctorAvatarProps> = ({ avatarUrl, name, initial, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-10 w-10 text-base';
  const dotClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={`flex ${sizeClass} items-center justify-center rounded-full bg-blue-600 font-extrabold text-white shadow-sm overflow-hidden`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <span
        className={`absolute bottom-0 right-0 ${dotClass} rounded-full bg-emerald-500 ring-2 ring-white shadow-sm dark:ring-slate-900 z-10`}
      />
    </div>
  );
};

interface DoctorProfileMenuProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  doctorName: string;
  doctorInitial: string;
  doctorAvatar: string | null;
  doctorPhone?: string;
  onNavigateSettings: () => void;
  onLogout: () => void;
}

export const DoctorProfileMenu: React.FC<DoctorProfileMenuProps> = ({
  isOpen,
  onToggleOpen,
  doctorName,
  doctorInitial,
  doctorAvatar,
  doctorPhone,
  onNavigateSettings,
  onLogout,
}) => {
  return (
    <div className="relative">
      <button
        onClick={onToggleOpen}
        className="flex items-center space-x-3 rounded-xl p-1.5 transition-colors hover:bg-slate-50 border border-transparent hover:border-slate-200 dark:hover:bg-slate-800/60 dark:hover:border-slate-700"
      >
        {/* Avatar Bác sĩ có chấm xanh Online (Chữ "M" nền xanh chuẩn như bên App) */}
        <DoctorAvatar avatarUrl={doctorAvatar} name={doctorName} initial={doctorInitial} size="sm" />
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold text-slate-900 dark:text-white">{doctorName}</p>
          <p className="text-[11px] text-blue-600 font-medium dark:text-blue-400">Bác sĩ phụ trách</p>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-150 dark:border-slate-800/80 dark:bg-[#131C31] dark:shadow-slate-950/80">
          <div className="flex items-center space-x-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <DoctorAvatar avatarUrl={doctorAvatar} name={doctorName} initial={doctorInitial} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{doctorName}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {doctorPhone || 'Bác sĩ gia đình'}
              </p>
              <div className="mt-0.5 flex items-center space-x-1 text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                <span>Chứng chỉ hành nghề đã xác thực</span>
              </div>
            </div>
          </div>

          <div className="py-1">
            <div className="flex items-center space-x-2 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
              <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Vai trò: Bác sĩ điều trị</span>
            </div>
            <button
              onClick={onNavigateSettings}
              className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
            >
              <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Cài đặt & Hồ sơ Bác sĩ</span>
            </button>
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onLogout}
              className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

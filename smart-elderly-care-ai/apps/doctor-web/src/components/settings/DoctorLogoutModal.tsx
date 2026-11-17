import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut } from 'lucide-react';

export interface DoctorLogoutModalProps {
  onClose: () => void;
  onLogout: () => void;
}

export const DoctorLogoutModal: React.FC<DoctorLogoutModalProps> = ({ onClose, onLogout }) => {
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative z-[101] w-full max-w-sm rounded-2xl bg-white dark:bg-[#131C31] dark:border dark:border-slate-800/80 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
          <LogOut className="h-7 w-7" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1.5">
          Đăng xuất tài khoản Bác sĩ
        </h3>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 mb-5">
          Bạn có chắc chắn muốn đăng xuất khỏi hệ thống? Mọi phiên làm việc và bảo mật hồ sơ bệnh án sẽ được kết thúc.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer"
          >
            Đăng xuất ngay
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

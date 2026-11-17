import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react';

export interface DoctorChangePasswordModalProps {
  onClose: () => void;
  onSavePassword: (oldPwd: string, newPwd: string, confirmPwd: string) => Promise<void>;
  pwdError: string;
  savingPwd: boolean;
}

export const DoctorChangePasswordModal: React.FC<DoctorChangePasswordModalProps> = ({
  onClose,
  onSavePassword,
  pwdError,
  savingPwd,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState({ old: false, new: false, confirm: false });

  const pwdRules = [
    { text: 'Từ 8 đến 16 ký tự', valid: newPassword.length >= 8 && newPassword.length <= 16 },
    { text: 'Có chữ hoa và chữ thường (VD: A-Z, a-z)', valid: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) },
    { text: 'Có chữ số (0-9)', valid: /[0-9]/.test(newPassword) },
    { text: 'Có ký tự đặc biệt (@, #, $, !, %, *, ?, &)', valid: /[@#$%!*?&]/.test(newPassword) },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePassword(oldPassword, newPassword, confirmPassword);
  };

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative z-[101] w-full max-w-md rounded-2xl bg-white dark:bg-[#131C31] dark:border dark:border-slate-800/80 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Đổi Mật Khẩu Bác Sĩ</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {pwdError && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/50 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
            {pwdError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: 'old' as const, label: 'Mật khẩu hiện tại (*)', val: oldPassword, setVal: setOldPassword, ph: 'Nhập mật khẩu hiện tại' },
            { key: 'new' as const, label: 'Mật khẩu mới (*)', val: newPassword, setVal: setNewPassword, ph: '8 - 16 ký tự (Hoa, thường, số, đặc biệt)' },
            { key: 'confirm' as const, label: 'Xác nhận mật khẩu mới (*)', val: confirmPassword, setVal: setConfirmPassword, ph: 'Nhập lại mật khẩu mới' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{f.label}</label>
              <div className="relative">
                <input
                  type={showPwd[f.key] ? 'text' : 'password'}
                  value={f.val}
                  onChange={(e) => f.setVal(e.target.value)}
                  placeholder={f.ph}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-white dark:focus:bg-[#0F172A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => ({ ...s, [f.key]: !s[f.key] }))}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPwd[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {f.key === 'new' && newPassword.length > 0 && (
                <div className="mt-2 space-y-1 rounded-xl bg-slate-50 dark:bg-[#0F172A] p-2.5">
                  {pwdRules.map((r) => (
                    <div key={r.text} className="flex items-center gap-1.5 text-[11px]">
                      {r.valid ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span className={r.valid ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                        {r.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingPwd}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingPwd ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

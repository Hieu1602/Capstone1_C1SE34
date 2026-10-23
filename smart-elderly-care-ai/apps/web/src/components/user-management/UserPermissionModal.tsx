import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { User, PermissionRule } from '../../types';
import { ROLE_CONFIG, PERMISSION_GROUPS } from './constants';

interface UserPermissionModalProps {
  user: User | null;
  rules: PermissionRule[];
  onClose: () => void;
  onNavigateToRulesTab: () => void;
}

export const UserPermissionModal: React.FC<UserPermissionModalProps> = ({
  user,
  rules,
  onClose,
  onNavigateToRulesTab,
}) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="glass-card w-full max-w-lg overflow-hidden border border-[#C8AD8A] shadow-2xl animate-slide-up flex flex-col">
        <div className="p-5 border-b border-[#C8AD8A]/50 bg-[#FFF8EE] dark:bg-[#1A3830] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF8EE] dark:bg-[#142823] text-[#D96C3B] border border-[#C8AD8A] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                Quyền hạn của tài khoản: {user.full_name}
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {user.phone} · Vai trò:{' '}
                <b className="text-[#D96C3B]">
                  {ROLE_CONFIG[user.role]?.label || user.role}
                </b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Các Rule phân quyền đang áp dụng:
            </span>
            {rules
              .filter(
                (r) =>
                  r.is_active &&
                  (r.target_role === 'all' ||
                    r.target_role === user.role ||
                    (r.target_role === 'user' && user.role === 'owner') ||
                    (r.target_role === 'caregiver' && user.role === 'member'))
              )
              .map((r) => (
                <div
                  key={r.id}
                  className="mt-2 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <div className="font-bold text-xs text-[#D96C3B]">{r.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{r.description}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.permissions.map((p) => {
                      const item = PERMISSION_GROUPS.flatMap((g) => g.items).find((i) => i.id === p);
                      return (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                        >
                          ✓ {item?.label || p}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
            💡 <b>Mẹo quản trị:</b> Để tùy biến thêm hoặc thu hồi bớt quyền cho nhóm vai trò này, hãy chuyển sang tab{' '}
            <b
              className="underline cursor-pointer"
              onClick={() => {
                onClose();
                onNavigateToRulesTab();
              }}
            >
              Quy tắc phân quyền (Rules)
            </b>{' '}
            để điều chỉnh rule tương ứng.
          </div>
        </div>

        <div className="p-4 bg-[#FFF8EE]/60 dark:bg-[#142823]/60 border-t border-[#C8AD8A]/40 flex justify-end">
          <button
            onClick={onClose}
            className="btn-primary text-xs py-2 px-5 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};


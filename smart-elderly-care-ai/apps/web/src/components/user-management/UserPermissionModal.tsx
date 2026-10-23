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
      <div className="glass-card w-full max-w-lg overflow-hidden border border-[#E7E9ED] dark:border-[#454A53] shadow-2xl animate-slide-up flex flex-col">
        <div className="p-5 border-b border-[#E7E9ED] dark:border-[#454A53] bg-[#F5F6F8] dark:bg-[#202329] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/20 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-[#191B20] dark:text-[#F5F6F8] text-sm">
                Quyền hạn tài khoản: {user.full_name}
              </h3>
              <p className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1]">
                {user.phone} · Vai trò:{' '}
                <b className="text-[#FF6B35]">
                  {ROLE_CONFIG[user.role]?.label || user.role}
                </b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737780] hover:text-[#191B20] dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#17191E] border border-[#E7E9ED] dark:border-[#454A53]">
            <span className="text-xs font-bold text-[#191B20] dark:text-[#F5F6F8] block mb-1">
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
                  className="mt-2 p-2.5 rounded-lg bg-white dark:bg-[#202329] border border-[#E7E9ED] dark:border-[#454A53]"
                >
                  <div className="font-bold text-xs text-[#FF6B35]">{r.name}</div>
                  <div className="text-[11px] text-[#737780] mt-0.5">{r.description}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.permissions.map((p) => {
                      const item = PERMISSION_GROUPS.flatMap((g) => g.items).find((i) => i.id === p);
                      return (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] font-medium"
                        >
                          ✓ {item?.name || p}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-[#16A36A]">
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

        <div className="p-4 border-t border-[#E7E9ED] dark:border-[#262A34] bg-[#F5F6F8] dark:bg-[#1A1D24] flex justify-end">
          <button
            onClick={onClose}
            className="btn-primary"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

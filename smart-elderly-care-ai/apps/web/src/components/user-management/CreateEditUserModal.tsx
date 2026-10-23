import React from 'react';
import { KeyRound, UserPlus, X, Check } from 'lucide-react';
import { User, UserRole } from '../../types';
import { ROLE_CONFIG } from './constants';

interface CreateEditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: User | null;
  formName: string;
  setFormName: (v: string) => void;
  formPhone: string;
  setFormPhone: (v: string) => void;
  formPassword: string;
  setFormPassword: (v: string) => void;
  formRole: UserRole;
  setFormRole: (v: UserRole) => void;
  formHouse: string;
  setFormHouse: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const CreateEditUserModal: React.FC<CreateEditUserModalProps> = ({
  isOpen,
  onClose,
  editingUser,
  formName,
  setFormName,
  formPhone,
  setFormPhone,
  formPassword,
  setFormPassword,
  formRole,
  setFormRole,
  formHouse,
  setFormHouse,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="glass-card w-full max-w-lg overflow-hidden border border-[#E7E9ED] dark:border-[#454A53] shadow-2xl animate-slide-up">
        <div className="p-5 border-b border-[#E7E9ED] dark:border-[#454A53] bg-[#F5F6F8] dark:bg-[#202329] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/20 flex items-center justify-center shadow-2xs">
              {editingUser ? <KeyRound className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-heading font-bold text-[#191B20] dark:text-[#F5F6F8] text-sm">
                {editingUser ? 'Cập nhật tài khoản & Phân quyền' : 'Thêm tài khoản người dùng mới'}
              </h3>
              <p className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1]">
                {editingUser ? editingUser.phone : 'Phân bổ vai trò Bác sĩ, Người thân hoặc Thành viên'}
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

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-[#737780] dark:text-[#A1A7B1] mb-1">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Hữu Nghĩa hoặc BS. Trần Văn Minh"
              className="input-glass"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-[#737780] dark:text-[#A1A7B1] mb-1">
              Số điện thoại đăng nhập <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="0905xxxxxx hoặc +84905xxxxxx"
              className="input-glass font-mono"
            />
          </div>

          {!editingUser && (
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-[#737780] dark:text-[#A1A7B1] mb-1">
                Mật khẩu khởi tạo
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Mặc định: 123456 (Nếu để trống)"
                className="input-glass"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-[#737780] dark:text-[#A1A7B1] mb-1">
              Vai trò & Trách nhiệm (Role) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {(Object.keys(ROLE_CONFIG) as UserRole[]).map((r) => {
                const cfg = ROLE_CONFIG[r];
                const Icon = cfg.icon;
                const isSelected = formRole === r;

                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFormRole(r)}
                    className={`flex items-start space-x-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FF6B35] bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] shadow-2xs font-semibold'
                        : 'border-[#E7E9ED] dark:border-[#454A53] hover:bg-slate-50 dark:hover:bg-white/5 text-[#737780]'
                    }`}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs leading-tight font-bold">{cfg.label}</p>
                      <p className="text-[10px] opacity-75 truncate">{cfg.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-[#737780] dark:text-[#A1A7B1] mb-1">
              Căn hộ / Phòng phụ trách
            </label>
            <input
              type="text"
              value={formHouse}
              onChange={(e) => setFormHouse(e.target.value)}
              placeholder="Ví dụ: Căn hộ 402 - Tháp A hoặc Nhà số 12 Huế"
              className="input-glass"
            />
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-[#E7E9ED] dark:border-[#454A53]">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

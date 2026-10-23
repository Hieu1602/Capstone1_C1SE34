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
      <div className="glass-card w-full max-w-lg overflow-hidden border border-[#C8AD8A] shadow-2xl animate-slide-up">
        <div className="p-5 border-b border-[#C8AD8A]/50 bg-[#FFF8EE] dark:bg-[#1A3830] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF8EE] dark:bg-[#142823] text-[#D96C3B] border border-[#C8AD8A] flex items-center justify-center shadow-xs">
              {editingUser ? <KeyRound className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                {editingUser ? 'Cập nhật tài khoản & Phân quyền' : 'Thêm tài khoản người dùng mới'}
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {editingUser ? editingUser.phone : 'Phân bổ vai trò Chủ nhà, Thành viên hoặc Bác sĩ'}
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

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
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
            <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
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
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Mật khẩu khởi tạo
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Mặc định: 12345678"
                className="input-glass font-mono"
              />
            </div>
          )}

          {/* Lựa chọn vai trò (Tách rõ ràng Chủ nhà vs Thành viên) */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 dark:text-slate-300 mb-2">
              Phân quyền vai trò (Role)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['user', 'caregiver', 'doctor', 'admin', 'elderly'] as UserRole[]).map((roleKey) => {
                const cfg = ROLE_CONFIG[roleKey];
                const Icon = cfg.icon;
                const isSelected = formRole === roleKey;
                return (
                  <button
                    type="button"
                    key={roleKey}
                    onClick={() => setFormRole(roleKey)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#D96C3B] bg-[#FFF8EE] dark:bg-[#1A3830] ring-1 ring-[#D96C3B]'
                        : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-[#D96C3B]' : 'text-slate-400'}`} />
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#D96C3B]" />}
                    </div>
                    <span className="font-heading font-bold text-xs text-slate-900 dark:text-white">
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1 line-clamp-2">
                      {cfg.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Hộ gia đình / Phạm vi quản lý
            </label>
            <input
              type="text"
              value={formHouse}
              onChange={(e) => setFormHouse(e.target.value)}
              placeholder="Ví dụ: Nhà của tôi (123 Hải Phòng)"
              className="input-glass"
            />
          </div>

          <div className="pt-3 border-t border-[#C8AD8A]/30 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs py-2 px-4 cursor-pointer"
            >
              Hủy
            </button>
            <button type="submit" className="btn-primary text-xs py-2 px-5 cursor-pointer">
              {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


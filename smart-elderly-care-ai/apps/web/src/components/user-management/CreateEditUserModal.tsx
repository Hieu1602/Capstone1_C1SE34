import React, { useState, useMemo } from 'react';
import {
  KeyRound,
  UserPlus,
  X,
  Check,
  Eye,
  EyeOff,
  Copy,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { ROLE_CONFIG, SELECTABLE_ROLES } from './constants';
import { ConfirmActionModal } from './ConfirmActionModal';

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
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // States cho các hộp thoại xác nhận
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Tính trạng thái có thay đổi so với ban đầu
  const isDirty = useMemo(() => {
    if (editingUser) {
      return (
        formName.trim() !== (editingUser.full_name || '').trim() ||
        formPhone.trim() !== (editingUser.phone || '').trim() ||
        formRole !== editingUser.role ||
        (formHouse.trim() || '') !== (editingUser.assigned_house || '').trim() ||
        formPassword.length > 0
      );
    } else {
      return (
        formName.trim().length > 0 ||
        formPhone.trim().length > 0 ||
        formPassword.length > 0 ||
        formHouse.trim().length > 0 ||
        formRole !== 'owner'
      );
    }
  }, [editingUser, formName, formPhone, formRole, formHouse, formPassword]);

  // Đóng modal: nếu có thay đổi thì hỏi xác nhận
  const handleRequestClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  };

  // Khôi phục giá trị cũ và đóng modal
  const handleDiscardChanges = () => {
    if (editingUser) {
      setFormName(editingUser.full_name);
      setFormPhone(editingUser.phone);
      setFormPassword('');
      setFormRole(editingUser.role);
      setFormHouse(editingUser.assigned_house || '');
    } else {
      setFormName('');
      setFormPhone('');
      setFormPassword('');
      setFormRole('owner');
      setFormHouse('');
    }
    setShowUnsavedModal(false);
    onClose();
  };

  // Submit form: mở modal xác nhận trước khi lưu
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSaveConfirmModal(true);
  };

  const handleConfirmSave = () => {
    setShowSaveConfirmModal(false);
    setShowUnsavedModal(false);
    const dummyEvent = { preventDefault: () => {} } as React.FormEvent;
    onSubmit(dummyEvent);
  };

  const handleTriggerResetPassword = () => {
    setShowResetConfirmModal(true);
  };

  const handleConfirmResetPassword = () => {
    setFormPassword('Seca@123456');
    setShowPassword(true);
    setShowResetConfirmModal(false);
  };

  const handleClearPassword = () => {
    setFormPassword('');
  };

  const handleCopyPassword = () => {
    if (!formPassword) return;
    navigator.clipboard.writeText(formPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
        <div className="glass-card w-full max-w-lg overflow-hidden border border-[#E7E9ED] dark:border-[#454A53] shadow-2xl animate-slide-up">
          <div className="p-5 border-b border-[#E7E9ED] dark:border-[#454A53] bg-[#F5F6F8] dark:bg-[#202329] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFF0E8] dark:bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/20 flex items-center justify-center shadow-2xs">
                {editingUser ? <KeyRound className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-heading font-bold text-[#191B20] dark:text-[#F5F6F8] text-sm">
                  {editingUser ? 'Cập nhật tài khoản người dùng' : 'Thêm tài khoản người dùng mới'}
                </h3>
                <p className="text-[11px] font-mono text-[#737780] dark:text-[#A1A7B1]">
                  {editingUser ? editingUser.phone : 'Phân bổ vai trò Bác sĩ, Người thân hoặc Thành viên'}
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestClose}
              className="p-1.5 rounded-lg text-[#737780] hover:text-[#191B20] dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
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

            {/* KHỐI QUẢN LÝ MẬT KHẨU: XEM - SỬA - XÓA / RESET */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-[#E7E9ED] dark:border-[#454A53] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono font-bold uppercase text-[#737780] dark:text-[#A1A7B1]">
                  {editingUser ? (
                    'Mật khẩu tài khoản'
                  ) : (
                    <>
                      Mật khẩu khởi tạo <span className="text-rose-500">*</span>
                    </>
                  )}
                </label>

                {editingUser && (
                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={handleTriggerResetPassword}
                      className="text-[11px] font-mono text-amber-600 dark:text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer"
                      title="Đặt lại mật khẩu về mặc định Seca@123456"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset về mặc định (Seca@123456)</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!editingUser}
                  minLength={8}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={
                    editingUser
                      ? '•••••••• (Để trống nếu giữ nguyên, nhập nếu muốn sửa)'
                      : 'Tối thiểu 8 ký tự (chữ hoa, thường, số)'
                  }
                  className="input-glass font-mono pr-24"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 text-[#737780]">
                  {formPassword ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className="p-1 hover:text-[#191B20] dark:hover:text-white transition-colors cursor-pointer"
                        title={copied ? 'Đã sao chép!' : 'Sao chép mật khẩu'}
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearPassword}
                        className="p-1 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Xóa trắng ô mật khẩu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 hover:text-[#191B20] dark:hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-[#FF6B35]" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-[#737780] dark:text-[#A1A7B1]">
                {editingUser
                  ? 'Mật khẩu ban đầu được hệ thống mã hóa băm 1 chiều (Bcrypt) an toàn. Bạn có thể xem khi nhập (icon mắt), sửa mật khẩu mới hoặc bấm Reset về mặc định.'
                  : 'Yêu cầu tối thiểu 8 ký tự tuân thủ chính sách bảo mật dữ liệu y tế.'}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-[#737780] dark:text-[#A1A7B1] mb-1">
                Vai trò & Trách nhiệm (Role) <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {SELECTABLE_ROLES.map((roleKey, idx) => {
                  const r = roleKey as UserRole;
                  const cfg = ROLE_CONFIG[r];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  const isSelected =
                    formRole === r ||
                    (r === 'owner' && (formRole as string) === 'user') ||
                    (r === 'user' && (formRole as string) === 'owner') ||
                    (r === 'member' && (formRole as string) === 'caregiver') ||
                    (r === 'caregiver' && (formRole as string) === 'member');
                  const isLastOdd = idx === SELECTABLE_ROLES.length - 1 && SELECTABLE_ROLES.length % 2 !== 0;

                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRole(r)}
                      className={`flex items-start space-x-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isLastOdd ? 'col-span-2' : ''
                      } ${
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
                onClick={handleRequestClose}
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

      {/* 1. Modal xác nhận khi bấm đóng / hủy mà có thay đổi chưa lưu */}
      <ConfirmActionModal
        isOpen={showUnsavedModal}
        type="unsaved"
        title="Bạn có thay đổi chưa lưu"
        message="Thông tin tài khoản đã được chỉnh sửa nhưng chưa được lưu. Bạn có muốn lưu các thay đổi này trước khi đóng không?"
        confirmLabel="Lưu thay đổi"
        discardLabel="Không lưu (Hủy thay đổi)"
        cancelLabel="Tiếp tục chỉnh sửa"
        onConfirm={handleConfirmSave}
        onDiscard={handleDiscardChanges}
        onCancel={() => setShowUnsavedModal(false)}
      />

      {/* 2. Modal xác nhận trước khi lưu */}
      <ConfirmActionModal
        isOpen={showSaveConfirmModal}
        type="save"
        title={editingUser ? 'Xác nhận lưu thay đổi' : 'Xác nhận tạo tài khoản'}
        message={
          editingUser
            ? `Bạn có chắc chắn muốn lưu các thông tin cập nhật cho tài khoản "${editingUser.full_name}" không?`
            : `Bạn có chắc chắn muốn tạo tài khoản người dùng mới "${formName.trim()}" không?`
        }
        confirmLabel="Xác nhận lưu"
        cancelLabel="Hủy bỏ"
        onConfirm={handleConfirmSave}
        onCancel={() => setShowSaveConfirmModal(false)}
      />

      {/* 3. Modal xác nhận trước khi reset mật khẩu về mặc định */}
      <ConfirmActionModal
        isOpen={showResetConfirmModal}
        type="reset-pwd"
        title="Xác nhận đặt lại mật khẩu"
        message="Mật khẩu của tài khoản sẽ được thiết lập thành mặc định (Seca@123456). Bạn có chắc chắn muốn thực hiện không?"
        confirmLabel="Đồng ý đặt lại"
        cancelLabel="Hủy bỏ"
        onConfirm={handleConfirmResetPassword}
        onCancel={() => setShowResetConfirmModal(false)}
      />
    </>
  );
};

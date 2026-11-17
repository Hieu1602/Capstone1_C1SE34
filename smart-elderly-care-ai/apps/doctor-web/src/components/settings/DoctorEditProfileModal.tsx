import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Edit3,
  X,
  Camera,
  Trash2,
  User,
  Phone,
  GraduationCap,
  Stethoscope,
  Building2,
  Briefcase,
  CheckCircle2,
  Check,
  Loader2,
} from 'lucide-react';
import { DoctorProfileInfo } from '../../types';

export const GENDER_OPTIONS = [
  {
    value: 'Nam',
    label: 'Nam',
    path: (
      <>
        <circle cx="10" cy="14" r="5" />
        <path d="M19 5l-5.4 5.4" />
        <path d="M15 5h4v4" />
      </>
    ),
  },
  {
    value: 'Nữ',
    label: 'Nữ',
    path: (
      <>
        <circle cx="12" cy="9" r="5" />
        <path d="M12 14v7" />
        <path d="M9 18h6" />
      </>
    ),
  },
  {
    value: 'Khác',
    label: 'Khác',
    path: (
      <>
        <circle cx="12" cy="12" r="5" />
        <path d="M12 2v5" />
        <path d="M12 17v5" />
        <path d="M2 12h5" />
        <path d="M17 12h5" />
      </>
    ),
  },
];

export interface DoctorEditProfileModalProps {
  editForm: DoctorProfileInfo;
  setEditForm: React.Dispatch<React.SetStateAction<DoctorProfileInfo>>;
  doctorInitial: string;
  savingProfile: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onTriggerFileInput: () => void;
}

export const DoctorEditProfileModal: React.FC<DoctorEditProfileModalProps> = ({
  editForm,
  setEditForm,
  doctorInitial,
  savingProfile,
  onClose,
  onSave,
  onTriggerFileInput,
}) => {
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative z-[101] flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white dark:bg-[#131C31] shadow-2xl border border-slate-100 dark:border-slate-800/80 animate-scale-up">
        {/* 1. Header Cố Định (Sticky Top) */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-[#131C31]/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 shadow-xs">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-extrabold text-slate-900 dark:text-white">
                Sửa Hồ Sơ Bác Sĩ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cập nhật thông tin định danh & hồ sơ chuyên môn y tế
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2. Thân Modal Cuộn Mượt (Scrollable Body) */}
        <form onSubmit={onSave} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Khu vực Ảnh Đại Diện (Profile Avatar Card) */}
            <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-white dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-[#0F172A] p-4 shadow-xs">
              <div className="relative shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-2xl font-bold text-white shadow-md ring-4 ring-white dark:ring-[#131C31]">
                  {editForm.avatarUri ? (
                    <img src={editForm.avatarUri} alt="" className="h-full w-full object-cover" />
                  ) : (
                    doctorInitial
                  )}
                </div>
                <button
                  type="button"
                  onClick={onTriggerFileInput}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white dark:ring-[#131C31] hover:bg-blue-700 transition cursor-pointer"
                  title="Đổi ảnh đại diện"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-center text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="font-heading text-sm font-bold text-slate-900 dark:text-white">
                    {editForm.name || 'BS. Trần Văn Minh'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    CCHN Đã xác thực
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ảnh chân dung hiển thị trên hồ sơ bệnh nhân & cổng tư vấn
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={onTriggerFileInput}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white/90 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-blue-600 shadow-2xs transition cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Tải ảnh mới</span>
                  </button>
                  {editForm.avatarUri && (
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, avatarUri: null }))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white/90 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-rose-600 shadow-2xs transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa ảnh</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nhóm 1 — Thông tin Định danh & Liên hệ */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Nhóm 1 — Thông tin Định danh & Liên hệ
                </h4>
              </div>

              <div className="space-y-3.5">
                {/* Họ và tên Bác sĩ (*) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Họ và tên Bác sĩ <span className="text-rose-500">(*)</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Nhập họ và tên bác sĩ"
                      className="h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-xs font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-white dark:focus:bg-[#0F172A]"
                    />
                  </div>
                </div>

                {/* Hàng 2 cột: Giới tính & Số điện thoại liên hệ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                  {/* Giới tính (Selectable Radio Cards) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Giới tính
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {GENDER_OPTIONS.map((g) => {
                        const isSelected = (editForm.gender || 'Nam') === g.value;
                        return (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, gender: g.value }))}
                            className={`relative flex h-[46px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'border-2 border-blue-600 bg-blue-50/80 font-bold text-blue-700 shadow-sm dark:bg-blue-950/60 dark:text-blue-300'
                                : 'border border-slate-200 bg-slate-50/70 font-medium text-slate-600 hover:border-blue-300 hover:bg-white dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                          >
                            <svg
                              className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              {g.path}
                            </svg>
                            <span>{g.label}</span>
                            {isSelected && (
                              <CheckCircle2 className="absolute right-1 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Số điện thoại liên hệ (*) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Số điện thoại liên hệ <span className="text-rose-500">(*)</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        required
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="VD: 0905111222"
                        className="h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-24 text-xs font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-white dark:focus:bg-[#0F172A]"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã xác thực
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nhóm 2 — Thông tin Chuyên môn & Công tác */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Nhóm 2 — Thông tin Chuyên môn & Công tác
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { label: 'Học hàm, học vị', key: 'degree' as const, icon: GraduationCap, ph: 'VD: Bác sĩ CKI, ThS. Y khoa...' },
                  { label: 'Chuyên khoa', key: 'specialty' as const, icon: Stethoscope, ph: 'VD: Lão khoa, Tim mạch...' },
                  { label: 'Bệnh viện / Cơ sở y tế', key: 'hospital' as const, icon: Building2, ph: 'VD: Bệnh viện Đa khoa Đà Nẵng' },
                  { label: 'Khoa / Phòng công tác', key: 'department' as const, icon: Briefcase, ph: 'VD: Khoa Chăm sóc Người cao tuổi' },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        {f.label}
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <Icon className="h-4 w-4" />
                        </div>
                        <input
                          type="text"
                          value={editForm[f.key] || ''}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.ph}
                          className="h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-xs font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-white dark:focus:bg-[#0F172A]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Thanh Nút Hành Động Ở Đáy (Sticky Footer) */}
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-[#131C31]/95 px-6 py-4 backdrop-blur-md rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              disabled={savingProfile}
              className="rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

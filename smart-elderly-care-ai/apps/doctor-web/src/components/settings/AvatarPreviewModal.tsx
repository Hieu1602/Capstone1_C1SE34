// src/components/settings/AvatarPreviewModal.tsx
// Lightbox phóng to xem, thay đổi hoặc đặt lại ảnh đại diện Bác sĩ

import React from 'react';
import { createPortal } from 'react-dom';
import { Camera, X } from 'lucide-react';
import type { DoctorProfileInfo } from '../../types';

interface AvatarPreviewModalProps {
  isOpen: boolean;
  docInfo: DoctorProfileInfo;
  doctorInitial: string;
  onClose: () => void;
  onChangeAvatar: () => void;
  onResetAvatar: () => void;
}

export const AvatarPreviewModal: React.FC<AvatarPreviewModalProps> = ({
  isOpen,
  docInfo,
  doctorInitial,
  onClose,
  onChangeAvatar,
  onResetAvatar,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200 !mt-0"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-[#131C31] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          title="Đóng (Esc)"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-5 px-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Ảnh đại diện Bác sĩ</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {docInfo.name} • {docInfo.degree || 'Bác sĩ phụ trách'}
          </p>
        </div>

        <div className="mx-auto flex h-64 w-64 items-center justify-center overflow-hidden rounded-2xl border-4 border-slate-100 shadow-inner bg-slate-100 dark:border-slate-800 dark:bg-[#0F172A]">
          {docInfo.avatarUri ? (
            <img src={docInfo.avatarUri} alt={docInfo.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-600 text-6xl font-extrabold text-white">
              {doctorInitial}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onChangeAvatar();
            }}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            <span>Thay đổi ảnh đại diện</span>
          </button>

          {docInfo.avatarUri && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onResetAvatar();
              }}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/50 transition cursor-pointer"
            >
              <span>Đặt lại mặc định</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

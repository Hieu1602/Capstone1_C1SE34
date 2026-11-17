import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PhoneCall, X, CheckCircle2, Copy, Check, Watch } from 'lucide-react';
import { DoctorPatientCard } from '../../types';

export interface FamilyContactModalProps {
  patient: DoctorPatientCard;
  onClose: () => void;
}

export const FamilyContactModal: React.FC<FamilyContactModalProps> = ({ patient, onClose }) => {
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative z-[101] w-full max-w-md rounded-3xl bg-white dark:bg-[#131C31] p-6 shadow-2xl border border-slate-100 dark:border-slate-800/80 animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-2xs border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-extrabold text-slate-900 dark:text-white">
                Liên hệ Gia đình
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {patient.name} • {patient.house_name || 'Hộ gia đình'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nội dung thông tin liên hệ */}
        <div className="space-y-4">
          {/* Thẻ số điện thoại người thân */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-white dark:border-emerald-900/60 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-[#0F172A] p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Số điện thoại người bảo hộ
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Đã xác thực
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-mono font-extrabold text-slate-900 dark:text-white tracking-tight">
                {patient.emergency_contact_phone || 'Chưa cập nhật SĐT'}
              </span>
              {patient.emergency_contact_phone && (
                <button
                  type="button"
                  onClick={() => handleCopyPhone(patient.emergency_contact_phone || '')}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Địa chỉ gia đình: <span className="font-medium text-slate-700 dark:text-slate-300">{patient.house_address || patient.house_name || 'Nhà riêng'}</span>
            </p>
          </div>

          {/* Thông báo tích hợp Loa Hub */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/30 p-3.5 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-300">
            <Watch className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11.5px] leading-relaxed">
              Thiết bị Loa thông minh Hub tại nhà bệnh nhân sẽ tự động đồng bộ cuộc gọi thoại hai chiều và cảnh báo tức thì khi bác sĩ kích hoạt gọi.
            </p>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Đóng
          </button>
          {patient.emergency_contact_phone ? (
            <a
              href={`tel:${patient.emergency_contact_phone}`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition active:scale-[0.98]"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Gọi ngay</span>
            </a>
          ) : (
            <button
              disabled
              className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-400 cursor-not-allowed"
            >
              Chưa có SĐT
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

import React, { useState } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-2xs border border-emerald-100">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-extrabold text-slate-900">
                Liên hệ Gia đình
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {patient.name} • {patient.house_name || 'Hộ gia đình'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nội dung thông tin liên hệ */}
        <div className="space-y-4">
          {/* Thẻ số điện thoại người thân */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-white p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Số điện thoại người bảo hộ
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Đã xác thực
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-mono font-extrabold text-slate-900 tracking-tight">
                {patient.emergency_contact_phone || 'Chưa cập nhật SĐT'}
              </span>
              {patient.emergency_contact_phone && (
                <button
                  type="button"
                  onClick={() => handleCopyPhone(patient.emergency_contact_phone || '')}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              Địa chỉ gia đình: <span className="font-medium text-slate-700">{patient.house_address || patient.house_name || 'Nhà riêng'}</span>
            </p>
          </div>

          {/* Thông báo tích hợp Loa Hub */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
            <Watch className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11.5px] leading-relaxed">
              Thiết bị Loa thông minh Hub tại nhà bệnh nhân sẽ tự động đồng bộ cuộc gọi thoại hai chiều và cảnh báo tức thì khi bác sĩ kích hoạt gọi.
            </p>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
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
    </div>
  );
};

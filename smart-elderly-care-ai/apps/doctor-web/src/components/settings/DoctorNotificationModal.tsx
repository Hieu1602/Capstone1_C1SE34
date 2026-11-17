import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';

export interface DoctorNotificationModalProps {
  notifyEmergency: boolean;
  setNotifyEmergency: (val: boolean) => void;
  notifyAppt: boolean;
  setNotifyAppt: (val: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

export const DoctorNotificationModal: React.FC<DoctorNotificationModalProps> = ({
  notifyEmergency,
  setNotifyEmergency,
  notifyAppt,
  setNotifyAppt,
  onSave,
  onClose,
}) => {
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative z-[101] w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-extrabold text-slate-900">Cài đặt thông báo</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 mb-5">
          {[
            {
              title: 'Cảnh báo sinh hiệu nguy cấp',
              sub: 'Tự động phát chuông to khi phát hiện cụ bị té ngã hoặc suy hô hấp',
              val: notifyEmergency,
              toggle: () => setNotifyEmergency(!notifyEmergency),
            },
            {
              title: 'Nhắc nhở ca trực & Lịch khám',
              sub: 'Thông báo trước giờ thăm khám định kỳ của bệnh nhân',
              val: notifyAppt,
              toggle: () => setNotifyAppt(!notifyAppt),
            },
          ].map((sw) => (
            <div
              key={sw.title}
              className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">{sw.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{sw.sub}</p>
              </div>
              <button
                type="button"
                onClick={sw.toggle}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  sw.val ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition ${
                    sw.val ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          Lưu cài đặt
        </button>
      </div>
    </div>,
    document.body
  );
};

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Smartphone, RefreshCw, X, Trash2 } from 'lucide-react';
import { DoctorTerminalItem } from '../../types';

export interface DoctorDevicesModalProps {
  terminals: DoctorTerminalItem[];
  loadingTerminals: boolean;
  onRefresh: () => void;
  onRevokeTerminal: (terminalId: string) => Promise<void>;
  onClose: () => void;
}

export const DoctorDevicesModal: React.FC<DoctorDevicesModalProps> = ({
  terminals,
  loadingTerminals,
  onRefresh,
  onRevokeTerminal,
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
      <div className="relative z-[101] w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-900">Thiết bị Bác sĩ đang mở</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
              title="Làm mới danh sách thiết bị"
            >
              <RefreshCw className={`h-4 w-4 ${loadingTerminals ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
          {terminals.map((t) => {
            const isDesktop = t.device_type === 'desktop';
            return (
              <div
                key={String(t.id)}
                className={`flex items-start justify-between rounded-xl border p-3.5 ${
                  t.is_current ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
                      isDesktop ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}
                  >
                    {isDesktop ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {t.device_name || (isDesktop ? 'Cổng Web Bác sĩ — Máy tính' : 'Ứng dụng SECA — Điện thoại')}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t.browser || (isDesktop ? 'Doctor Web Portal' : 'SECA Mobile App')} • {t.location || 'Đà Nẵng, VN'}
                    </p>
                    <p className={`text-[11px] font-bold mt-1 ${t.is_current ? 'text-blue-600' : 'text-emerald-600'}`}>
                      {t.is_current ? '● Đang mở trên thiết bị này' : '● Đang trực tuyến song song'}
                    </p>
                  </div>
                </div>
                {!t.is_current && (
                  <button
                    type="button"
                    onClick={() => onRevokeTerminal(String(t.id))}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Thu hồi phiên đăng nhập"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          Đóng
        </button>
      </div>
    </div>,
    document.body
  );
};

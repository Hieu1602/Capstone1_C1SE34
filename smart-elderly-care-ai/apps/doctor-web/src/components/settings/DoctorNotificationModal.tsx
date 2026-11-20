import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Volume2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  playEmergencyAlarmSound,
} from '../../utils/browserNotification';

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
  const [browserPerm, setBrowserPerm] = useState(() => getBrowserNotificationPermission());
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const handleRequestBrowserPerm = useCallback(async () => {
    const granted = await requestBrowserNotificationPermission();
    setBrowserPerm(granted ? 'granted' : 'denied');
    if (granted) {
      showBrowserNotification({
        title: '✅ Thông báo đẩy Desktop đã bật',
        body: 'Bạn sẽ nhận được cảnh báo sinh hiệu bất thường và té ngã ngay cả khi thu nhỏ trình duyệt.',
      });
    }
  }, []);

  const handleTestAlert = useCallback(() => {
    setTestSent(true);
    playEmergencyAlarmSound(3);
    showBrowserNotification({
      title: '🚨 Thử nghiệm cảnh báo khẩn cấp',
      body: 'Đây là thông báo đẩy thử nghiệm kiểm tra âm thanh còi hú y tế và pop-up màn hình.',
      tag: 'test-alert',
    });
    setTimeout(() => setTestSent(false), 3000);
  }, []);

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] !mt-0 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative z-[101] w-full max-w-md rounded-2xl bg-white dark:bg-[#131C31] dark:border dark:border-slate-800/80 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Cài đặt thông báo</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Trạng thái Thông báo đẩy trên Trình duyệt Desktop */}
        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Thông báo đẩy Desktop (Web Push)
            </span>
            {browserPerm === 'granted' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                Đã cho phép
              </span>
            ) : browserPerm === 'denied' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-extrabold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                Bị chặn trong trình duyệt
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestBrowserPerm}
                className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 cursor-pointer"
              >
                Kích hoạt ngay
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Giúp bác sĩ nhận cảnh báo té ngã & còi cấp cứu khi đang làm việc trên tab khác hoặc thu nhỏ trình duyệt.
          </p>

          <button
            type="button"
            onClick={handleTestAlert}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Volume2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{testSent ? 'Đang phát thử nghiệm...' : 'Thử nghiệm còi báo & thông báo đẩy'}</span>
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
              className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0"
            >
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">{sw.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sw.sub}</p>
              </div>
              <button
                type="button"
                onClick={sw.toggle}
                className={`relative h-6 w-11 shrink-0 rounded-full transition cursor-pointer ${
                  sw.val ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
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
          className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
        >
          Lưu cài đặt
        </button>
      </div>
    </div>,
    document.body
  );
};

// src/components/layout/DoctorLayout.tsx
// Bố cục tổng thể trang Bác sĩ: Navbar + Sidebar + Vùng nội dung (#F4F7FE)

import React, { useEffect, useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { DoctorNavbar } from './DoctorNavbar';
import { DoctorSidebar } from './DoctorSidebar';
import { AdminMarqueeBanner } from './AdminMarqueeBanner';
import { doctorWebSocket } from '../../services/websocket';
import { useDoctorDataStore } from '../../store/useDoctorDataStore';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  playEmergencyAlarmSound,
} from '../../utils/browserNotification';
import { AlertCircle, X, Bell } from 'lucide-react';

export const DoctorLayout: React.FC = () => {
  const [realtimeAlert, setRealtimeAlert] = useState<{
    id?: string;
    message?: string;
    time?: string;
    type?: string;
  } | null>(null);

  const [showPermissionBanner, setShowPermissionBanner] = useState<boolean>(() => {
    return isBrowserNotificationSupported() && getBrowserNotificationPermission() === 'default';
  });

  const handleEnableNotifications = useCallback(async () => {
    const granted = await requestBrowserNotificationPermission();
    if (granted) {
      setShowPermissionBanner(false);
      showBrowserNotification({
        title: '✅ Đã bật thông báo đẩy Bác sĩ thành công',
        body: 'Hệ thống SmartCare AI sẽ phát chuông và hiển thị cảnh báo té ngã / nguy kịch ngay cả khi thu nhỏ trình duyệt.',
        url: '/notifications',
      });
    }
  }, []);

  useEffect(() => {
    // Duy trì kết nối WebSocket duy nhất tại Root Layout
    doctorWebSocket.connect();

    // Tải trước dữ liệu toàn cục song song để các tab có dữ liệu ngay (0ms)
    useDoctorDataStore.getState().fetchAllData();

    const unsubscribe = doctorWebSocket.subscribe((event) => {
      if (!event) return;
      const alertType = event.alert_type || event.type || '';
      const isAppointmentEvent = alertType.startsWith('APPOINTMENT_') || alertType === 'MEDICAL_RECORD_UPDATED';

      if (isAppointmentEvent) {
        useDoctorDataStore.getState().fetchAllData(true);
        return;
      }

      if (event.type === 'ALERT_NEW' || event.message || event.heart_rate || event.spo2) {
        // Revalidate background data khi nhận cảnh báo lâm sàng mới
        useDoctorDataStore.getState().fetchAllData(true);

        const alertTitle =
          event.alert_type === 'FALL_DETECTED' || event.alert_type === 'AI_FALL_DETECTED'
            ? '🚨 BÁO ĐỘNG ĐỎ: PHÁT HIỆN TÉ NGÃ!'
            : '⚠️ CẢNH BÁO LÂM SÀNG KHẨN CẤP';
        const alertBody = event.message || event.data?.message || 'Phát hiện bất thường sinh hiệu hoặc sự cố nguy kịch!';

        // 1. Luôn phát âm thanh còi y tế báo động nếu là cảnh báo khẩn cấp
        playEmergencyAlarmSound(4);

        // 2. Bắn thông báo đẩy Desktop lên hệ điều hành (hiển thị kể cả khi ẩn Chrome hoặc chuyển tab)
        showBrowserNotification({
          title: alertTitle,
          body: alertBody,
          tag: event.incident_id || 'seca-alert',
          url: '/notifications',
        });

        setRealtimeAlert({
          message: event.message || 'Cảnh báo sinh hiệu bất thường từ bệnh nhân!',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          type: event.type || 'warning',
        });
      }
    });

    return () => {
      unsubscribe();
      doctorWebSocket.disconnect();
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F4F7FE] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 transition-colors">
      {/* Top Navbar: cố định tuyệt đối trên đỉnh */}
      <DoctorNavbar />

      {/* Main Body: chiếm toàn bộ chiều cao còn lại của màn hình */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar: cố định bên trái, hỗ trợ cuộn nội bộ nếu màn hình nhỏ */}
        <DoctorSidebar />

        {/* Content Area: phân vùng nội dung duy nhất cuộn theo chiều dọc */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-y-auto">
          {/* Banner xin quyền thông báo trình duyệt nếu chưa bật */}
          {showPermissionBanner && (
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/95 p-3.5 text-xs text-blue-900 shadow-xs backdrop-blur-xs dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-200 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-extrabold text-blue-950 dark:text-white">
                    Bật thông báo đẩy trên trình duyệt
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    Nhận chuông còi cấp cứu và pop-up cảnh báo té ngã / sinh hiệu ngay cả khi bạn thu nhỏ trình duyệt hoặc chuyển tab làm việc.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
                >
                  Bật thông báo ngay
                </button>
                <button
                  type="button"
                  onClick={() => setShowPermissionBanner(false)}
                  className="rounded-lg p-1.5 text-blue-400 hover:text-blue-700 transition cursor-pointer dark:hover:text-blue-200"
                  title="Để sau"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Thanh thông báo chữ chạy từ trái sang phải chuẩn như Mobile App */}
          <AdminMarqueeBanner />

          {/* Banner thông báo thời gian thực nếu có sự cố */}
          {realtimeAlert && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/95 p-4 shadow-sm backdrop-blur-sm animate-in fade-in duration-200">
              <div className="flex items-center space-x-3">
                <div className="rounded-xl bg-rose-500 p-2 text-white shadow-xs">
                  <AlertCircle className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                    CẢNH BÁO LÂM SÀNG THỜI GIAN THỰC ({realtimeAlert.time})
                  </p>
                  <p className="text-xs font-semibold text-rose-950">{realtimeAlert.message}</p>
                </div>
              </div>
              <button
                onClick={() => setRealtimeAlert(null)}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                title="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
};

// src/components/layout/DoctorLayout.tsx
// Bố cục tổng thể trang Bác sĩ: Navbar + Sidebar + Vùng nội dung (#F4F7FE)

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { DoctorNavbar } from './DoctorNavbar';
import { DoctorSidebar } from './DoctorSidebar';
import { AdminMarqueeBanner } from './AdminMarqueeBanner';
import { doctorWebSocket } from '../../services/websocket';
import { useDoctorDataStore } from '../../store/useDoctorDataStore';
import { useDoctorAuthStore } from '../../store/useDoctorAuthStore';
import { formatAppointmentWsNotification } from '../../utils/appointmentHelpers';
import { hydrateReadIdsFromServer, syncReadIdsFromServerPayload } from '../../utils/notificationSync';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  playEmergencyAlarmSound,
} from '../../utils/browserNotification';
import { AlertCircle, X, Bell, Calendar } from 'lucide-react';

export const DoctorLayout: React.FC = () => {
  const [realtimeAlert, setRealtimeAlert] = useState<{
    id?: string;
    message?: string;
    time?: string;
    type?: string;
  } | null>(null);
  const [appointmentToast, setAppointmentToast] = useState<{
    title: string;
    message: string;
    time: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    hydrateReadIdsFromServer().catch(() => {});
    const pollTimer = setInterval(() => {
      useDoctorDataStore.getState().fetchPatients(true);
    }, 15000);

    const unsubscribe = doctorWebSocket.subscribe((event) => {
      if (!event) return;
      const alertType = event.alert_type || event.type || '';
      const isAppointmentEvent = alertType.startsWith('APPOINTMENT_') || alertType === 'MEDICAL_RECORD_UPDATED';

      if (isAppointmentEvent) {
        useDoctorDataStore.getState().fetchAllData(true);
        if (alertType.startsWith('APPOINTMENT_')) {
          const { title, body } = formatAppointmentWsNotification(event);
          showBrowserNotification({
            title,
            body,
            tag: event.incident_id || alertType,
            url: '/appointments',
            requireInteraction: false,
          });
          setAppointmentToast({
            title,
            message: body,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setAppointmentToast(null), 6000);
        }
        return;
      }

      const evtType = String(event.type || '').toLowerCase();
      if (evtType === 'user_profile_updated') {
        const curUser = useDoctorAuthStore.getState().user;
        if (curUser && String(event.user_id) === String(curUser.id)) {
          useDoctorAuthStore.getState().updateUser({
            avatar_url: event.avatar_url ?? null,
            ...(event.full_name ? { full_name: event.full_name } : {}),
          });
          window.dispatchEvent(new Event('doctor-profile-updated'));
        }
        return;
      }

      if (evtType === 'vital_update' || evtType === 'vitals_update') {
        const liveHr = event.heart_rate != null ? Number(event.heart_rate) : undefined;
        const liveSpo2 = event.spo2 != null ? Number(event.spo2) : undefined;
        const liveTemp = event.skin_temp_max != null ? Number(event.skin_temp_max) : undefined;
        const store = useDoctorDataStore.getState();
        const pid = event.patient_id || event.elderly_id;
        store.setPatients(
          store.patients.map((p) => {
            const matched =
              (pid && String(p.id) === String(pid)) ||
              (event.device_id && p.device_id === event.device_id) ||
              (event.device_uuid && p.device_id === event.device_uuid);
            return matched
              ? {
                  ...p,
                  is_online: true,
                  heart_rate: liveHr !== undefined && liveHr > 0 ? liveHr : p.heart_rate,
                  spo2: liveSpo2 !== undefined && liveSpo2 > 0 ? liveSpo2 : p.spo2,
                  skin_temp_max: liveTemp !== undefined && liveTemp > 0 ? liveTemp : p.skin_temp_max,
                  last_updated: 'Vừa xong (Trực tuyến)',
                }
              : p;
          })
        );
        return;
      }

      // Đồng bộ acknowledge từ Mobile → Doctor Web: cập nhật store cục bộ, không cần re-fetch toàn bộ
      if (event.type === 'INCIDENT_RESOLVED') {
        const incId = event.incident_id || (event.data as { id?: string } | undefined)?.id;
        if (incId) {
          const store = useDoctorDataStore.getState();
          const ackName = (event.data as { acknowledged_by_name?: string } | undefined)?.acknowledged_by_name;
          const patchInc = (inc: import('../../types').Incident) =>
            String(inc.id) === String(incId)
              ? { ...inc, is_acknowledged: true, acknowledged_by_name: ackName }
              : inc;
          store.setIncidents(store.incidents.map(patchInc));
          // shortcut: clinicalIncidents cũng cần patch; setIncidents chỉ update incidents
          if (store.clinicalIncidents.some((i) => String(i.id) === String(incId))) {
            useDoctorDataStore.setState({ clinicalIncidents: store.clinicalIncidents.map(patchInc) });
          }
        }
        return;
      }

      // Đồng bộ "đọc tất cả" từ Mobile → Doctor Web
      if (event.type === 'INCIDENTS_ACKNOWLEDGED') {
        useDoctorDataStore.getState().fetchAllData(true);
        return;
      }

      // Đồng bộ trạng thái đã đọc (readIds) Mobile <-> Doctor Web 0ms
      if (event.type === 'NOTIFICATION_READ_STATE_UPDATED') {
        const curUser = useDoctorAuthStore.getState().user;
        if ((!event.user_id || !curUser?.id || String(event.user_id) === String(curUser.id)) && Array.isArray(event.read_ids)) {
          syncReadIdsFromServerPayload(event.read_ids);
        }
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
      clearInterval(pollTimer);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
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

      {appointmentToast && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-xs shadow-xl dark:border-blue-800/70 dark:bg-[#131C31] animate-in fade-in duration-200">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-slate-900 dark:text-white">
              {appointmentToast.title} <span className="font-normal text-slate-400">({appointmentToast.time})</span>
            </p>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">{appointmentToast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setAppointmentToast(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

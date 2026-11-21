// websocket.ts
// WebSocket client – Kết nối real-time với Backend FastAPI (/ws/alerts & /ws/vitals)
// Nhận sự kiện cảnh báo té ngã tức thì (Feature 1) & chỉ số sinh hiệu mô phỏng 5s/lần (Feature 3)

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useVitalStore, Incident } from '../store/useVitalStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAlertStore } from '../store/useAlertStore';
import { useEscalationStore } from '../store/useEscalationStore';
import { notificationService } from './notificationService';


const getWsBaseUrl = (): string => {
  // 1. Khi chay tren Web trinh duyet
  if (Platform.OS === 'web' || (typeof window !== 'undefined' && window.location?.hostname)) {
    const rawHost = (typeof window !== 'undefined' && window.location?.hostname) || '127.0.0.1';
    const host = (rawHost === 'localhost' || rawHost === '::1') ? '127.0.0.1' : rawHost;
    const protocol = (typeof window !== 'undefined' && window.location?.protocol === 'https:') ? 'wss' : 'ws';
    return `${protocol}://${host}:8000/ws`;
  }

  // 2. Tự động nhận diện IP máy tính từ Expo Metro host (kết nối trực tiếp điện thoại thật qua LAN Wi-Fi)
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;

  if (debuggerHost) {
    const hostIp = debuggerHost.split(':')[0];
    if (hostIp && !hostIp.includes('exp.direct') && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `ws://${hostIp}:8000/ws`;
    }
  }

  // 3. Biến môi trường EXPO_PUBLIC_WS_URL (nếu được chỉ định rõ và không trỏ vào localhost trên thiết bị thật)
  const envWsUrl = process.env.EXPO_PUBLIC_WS_URL;
  if (envWsUrl && !envWsUrl.includes('localhost') && !envWsUrl.includes('127.0.0.1')) {
    return envWsUrl;
  }

  // 4. Fallback về IP máy tính phát triển trong mạng nội bộ
  return 'ws://16.178.128.42:8000/ws';
};

const WS_BASE_URL: string = getWsBaseUrl();

export type VitalPayload = {
  heart_rate?: number | null;
  spo2?: number | null;
  skin_temp_max?: number | null;
  person_count?: number | null;
  fall_detected?: boolean;
  timestamp?: number | null;
  [key: string]: any;
};

export type WebSocketAlertEvent = {
  type: 'ALERT_NEW' | 'INCIDENT_RESOLVED' | 'VITALS_UPDATE' | 'SYSTEM_MODE_UPDATE' | 'telemetry' | string;
  alert_type?: string;
  incident_id?: string;
  house_id?: string;
  patient_id?: string | number;
  appointment_id?: string;
  data?: any;
  timestamp?: string | number;
  [key: string]: any;
};

type AlertHandler = (event: any) => void;

class AlertsWebSocket {
  private socket: WebSocket | null = null;
  private handlers: Set<AlertHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;

  connect(_deviceId?: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const wsUrl = `${WS_BASE_URL}/alerts`;
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        console.log('[WS] Kết nối WebSocket Real-time Alerts thành công:', wsUrl);
        // Ping mỗi 25s để duy trì kết nối
        this._clearPing();
        this.pingInterval = setInterval(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send('ping');
          }
        }, 25_000);
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          if (event.data === 'pong') return;
          const msg: WebSocketAlertEvent = JSON.parse(event.data);

          // Xử lý cập nhật Zustand store tự động cho toàn bộ ứng dụng
          this._handleStoreUpdate(msg);

          // Báo cho các listener đã đăng ký
          this.handlers.forEach((h) => h(msg));
        } catch {
          // Bỏ qua tin nhắn không phải JSON
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this._clearPing();
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this._connect(), 3000);
        }
      };

      this.socket.onerror = (err) => {
        this.isConnecting = false;
        console.warn('[WS] Alerts WebSocket status/fallback:', err);
      };
    } catch (e) {
      this.isConnecting = false;
      console.warn('[WS] Không thể mở kết nối WebSocket:', e);
    }
  }

  private _handleStoreUpdate(event: WebSocketAlertEvent) {
    const store = useVitalStore.getState();

    // 0. Lịch khám mới từ Bác sĩ hoặc Yêu cầu lịch khám từ Gia đình
    if (
      event.alert_type === 'APPOINTMENT_SCHEDULED' ||
      event.type === 'APPOINTMENT_SCHEDULED' ||
      event.alert_type === 'APPOINTMENT_REQUESTED' ||
      event.type === 'APPOINTMENT_REQUESTED'
    ) {
      const incData = event.data || {};
      const isRequestedByFamily =
        event.alert_type === 'APPOINTMENT_REQUESTED' ||
        event.type === 'APPOINTMENT_REQUESTED' ||
        incData.notes?.includes('APPOINTMENT_REQUESTED') ||
        incData.message?.includes('đã đặt lịch khám');
      const newIncident: Incident = {
        id: incData.id || `inc-apt-${Date.now()}`,
        device_id: incData.device_id || event.house_id || 'system',
        alert_type: isRequestedByFamily ? 'APPOINTMENT_REQUESTED' : 'APPOINTMENT_SCHEDULED',
        alert_level: 'LOW',
        message:
          incData.message ||
          (isRequestedByFamily
            ? '🗓️ Người nhà vừa yêu cầu lịch khám mới.'
            : '🗓️ Bác sĩ vừa lên lịch khám mới. Vui lòng kiểm tra và xác nhận.'),
        video_clip_url: null,
        thumbnail_url: null,
        is_acknowledged: false,
        created_at: incData.created_at || new Date().toISOString(),
        note: event.appointment_id || incData.appointment_id || (isRequestedByFamily ? 'APPOINTMENT_REQUESTED' : null),
        notes: incData.notes || (isRequestedByFamily ? 'APPOINTMENT_REQUESTED' : null),
      };

      store.addIncident(newIncident);

      // Bắn thông báo đẩy cục bộ nhẹ nhàng (không kích hoạt còi hú khẩn cấp)
      notificationService.triggerEmergencyNotification({
        title:
          incData.title ||
          (isRequestedByFamily ? '🗓️ YÊU CẦU LỊCH KHÁM TỪ GIA ĐÌNH' : '🗓️ LỊCH KHÁM MỚI TỪ BÁC SĨ'),
        body: newIncident.message,
        data: {
          incident_id: newIncident.id,
          alert_type: newIncident.alert_type,
          appointment_id: event.appointment_id,
          patient_id: event.patient_id,
        },
      });
      return;
    }

    // 0.1. Lịch khám đã được xác nhận (Doctor Appointment Confirmed)
    if (event.alert_type === 'APPOINTMENT_CONFIRMED' || event.type === 'APPOINTMENT_CONFIRMED') {
      const aptId = event.appointment_id || event.data?.appointment_id;
      const incData = event.data || {};
      const targetUserId = incData.target_user_id;
      const currentUserId = useAuthStore.getState().userId || useAuthStore.getState().user_id;
      const isDoctor =
        useAuthStore.getState().viewRole === 'DOCTOR' ||
        useAuthStore.getState().role?.toLowerCase() === 'doctor';

      // 1. Phía Người nhà: Acknowledge incident APPOINTMENT_SCHEDULED cũ nếu có
      const targetInc = store.incidents.find(
        (i) => (aptId && (i.note === aptId || i.notes?.includes(aptId))) || i.id === event.incident_id || i.id === incData.id
      );
      if (targetInc) {
        store.acknowledgeIncident(targetInc.id, 'Gia đình đã xác nhận lịch khám');
      }

      // 2. Phía Bác sĩ: Thêm thông báo mới xác nhận từ Người nhà & Bắn Notification
      const isTargetForThisDoctor = (targetUserId && currentUserId && String(targetUserId) === String(currentUserId)) || isDoctor;
      if (isTargetForThisDoctor && event.type !== 'INCIDENT_RESOLVED') {
        const newDocIncident: Incident = {
          id: incData.id || `inc-doc-apt-${Date.now()}`,
          device_id: incData.device_id || 'system',
          alert_type: 'APPOINTMENT_CONFIRMED',
          alert_level: 'LOW',
          message: incData.message || '🗓️ Gia đình đã xác nhận lịch khám. Sẵn sàng đón tiếp Bác sĩ!',
          video_clip_url: null,
          thumbnail_url: null,
          is_acknowledged: false,
          created_at: incData.created_at || new Date().toISOString(),
          notes: `USER:${targetUserId || currentUserId}|APPOINTMENT_CONFIRMED|APT:${aptId || ''}`,
        };

        store.addIncident(newDocIncident);

        notificationService.triggerEmergencyNotification({
          title: '🗓️ GIA ĐÌNH ĐÃ XÁC NHẬN LỊCH KHÁM',
          body: newDocIncident.message,
          data: {
            incident_id: newDocIncident.id,
            alert_type: 'APPOINTMENT_CONFIRMED',
            appointment_id: aptId,
          },
        });
      }
      return;
    }

    // 0.2. Lịch khám đã bị Bác sĩ hủy (Doctor Appointment Cancelled)
    if (event.alert_type === 'APPOINTMENT_CANCELLED' || event.type === 'APPOINTMENT_CANCELLED') {
      const aptId = event.appointment_id || event.data?.appointment_id;
      const reason = event.cancellation_reason || event.data?.cancellation_reason || 'Bác sĩ bận việc đột xuất';
      const targetInc = store.incidents.find((i) => {
        const noteStr = String((i as any).notes ?? (i as any).note ?? '');
        return (
          (aptId && noteStr && (noteStr === aptId || noteStr.includes(aptId))) ||
          i.id === event.incident_id ||
          i.id === event.data?.id ||
          (i.alert_type === 'APPOINTMENT_SCHEDULED' && (!aptId || (noteStr && noteStr.includes(aptId))))
        );
      });
      if (targetInc) {
        store.acknowledgeIncident(targetInc.id, `Lịch khám đã bị hủy: ${reason}`);
      }

      // Thông báo nhẹ nhàng cho người nhà/gia đình biết lịch đã hủy
      notificationService.triggerEmergencyNotification({
        title: '🗓️ LỊCH KHÁM ĐÃ BỊ HỦY',
        body: event.data?.message || `Bác sĩ đã hủy lịch khám. Lý do: ${reason}`,
        data: {
          alert_type: 'APPOINTMENT_CANCELLED',
          appointment_id: aptId,
          cancellation_reason: reason,
        },
      });
      return;
    }

    // 0.3. Hồ sơ bệnh án được cập nhật (Medical Record Updated)
    if (event.alert_type === 'MEDICAL_RECORD_UPDATED' || event.type === 'MEDICAL_RECORD_UPDATED') {
      const incData = event.data || {};
      const newIncident: Incident = {
        id: incData.id || `inc-med-${Date.now()}`,
        device_id: incData.device_id || 'system',
        alert_type: 'MEDICAL_RECORD_UPDATED',
        alert_level: 'LOW',
        message: incData.message || '📋 Hồ sơ bệnh án người cao tuổi vừa được cập nhật.',
        video_clip_url: null,
        thumbnail_url: null,
        is_acknowledged: false,
        created_at: incData.created_at || new Date().toISOString(),
        notes: incData.patient_id ? `PATIENT:${incData.patient_id}` : null,
      };

      store.addIncident(newIncident);

      notificationService.triggerEmergencyNotification({
        title: '📋 HỒ SƠ BỆNH ÁN ĐƯỢC CẬP NHẬT',
        body: newIncident.message,
        data: {
          incident_id: newIncident.id,
          alert_type: 'MEDICAL_RECORD_UPDATED',
          patient_id: incData.patient_id,
        },
      });
      return;
    }

    // 0.4. Lời mời tham gia nhà / Yêu cầu vào nhà / Xóa khỏi nhà
    if (['HOUSE_INVITE_PENDING', 'HOUSE_JOIN_REQUEST', 'HOUSE_MEMBER_ADDED', 'HOUSE_MEMBER_REMOVED', 'HOUSE_JOIN_APPROVED', 'HOUSE_JOIN_REJECTED', 'HOUSE_INVITE_REJECTED'].includes(event.alert_type || event.type)) {
      const incData = event.data || {};
      const alertType = event.alert_type || event.type;
      const targetUserId = incData.target_user_id || incData.user_id;
      const currentUserId = useAuthStore.getState().userId || useAuthStore.getState().user_id;

      if (targetUserId && currentUserId && String(targetUserId) !== String(currentUserId)) {
        return;
      }

      if (alertType === 'HOUSE_MEMBER_REMOVED') {
        try {
          useVitalStore.getState().fetchHouseFromBackend?.();
        } catch {}
      }

      const newIncident: Incident = {
        id: incData.id || `inc-house-${Date.now()}`,
        device_id: incData.device_id || 'system',
        alert_type: alertType,
        alert_level: 'LOW',
        message: incData.message || 'Thông báo mới về thành viên gia đình',
        video_clip_url: null,
        thumbnail_url: null,
        is_acknowledged: false,
        created_at: incData.created_at || new Date().toISOString(),
        notes: `USER:${targetUserId}|${alertType}|MEMBER_ID:${incData.member_id || ''}|HOUSE_ID:${incData.house_id || ''}`,
      };

      store.addIncident(newIncident);
      useAuthStore.getState().fetchMyPermissions?.().catch(() => {});
      useVitalStore.getState().syncAllWithBackend?.().catch(() => {});

      notificationService.triggerEmergencyNotification({
        title: alertType === 'HOUSE_INVITE_PENDING' ? '🏠 LỜI MỜI THAM GIA NHÀ' : '🏠 THÀNH VIÊN GIA ĐÌNH',
        body: newIncident.message,
        data: {
          incident_id: newIncident.id,
          alert_type: alertType,
        },
      });
      return;
    }

    // 0.2b. Lịch khám đổi giờ / hoàn tất / xóa -> bỏ qua còi báo động khẩn cấp
    if (
      ['APPOINTMENT_RESCHEDULED', 'APPOINTMENT_COMPLETED', 'APPOINTMENT_DELETED'].includes(
        String(event.alert_type || event.type || '')
      )
    ) {
      return;
    }

    // 1. Cảnh báo té ngã / pin yếu / sự cố khẩn cấp mới (Feature 1)
    if (
      event.alert_type === 'LOW_BATTERY' ||
      event.alert_type === 'DEVICE_BATTERY_DEAD' ||
      ((event.type === 'ALERT_NEW' &&
        !String(event.alert_type || '').startsWith('APPOINTMENT_') &&
        event.alert_type !== 'MEDICAL_RECORD_UPDATED') ||
        event.alert_type === 'FALL_DETECTED')
    ) {
      const incData = event.data || {};
      const incDevId = String(incData.device_id || event.device_id || '').toLowerCase();
      const incHouseId = String(incData.house_id || event.house_id || '').toLowerCase();
      const vitalState = useVitalStore.getState();
      const currentHouseId = String(vitalState.house?.id || '').toLowerCase();
      const userDevices = vitalState.iotDevices || [];
      const userPatients = vitalState.patientsList || [];

      const myDeviceIds = new Set<string>();
      userDevices.forEach((d: any) => {
        if (d.id) myDeviceIds.add(String(d.id).toLowerCase());
        if (d.device_id) myDeviceIds.add(String(d.device_id).toLowerCase());
      });
      userPatients.forEach((p: any) => {
        (p.devices || []).forEach((d: any) => {
          if (d.id) myDeviceIds.add(String(d.id).toLowerCase());
          if (d.device_id) myDeviceIds.add(String(d.device_id).toLowerCase());
        });
      });

      // Bỏ qua cảnh báo nếu không thuộc ngôi nhà hoặc thiết bị của gia đình người dùng
      if (incHouseId && currentHouseId && incHouseId !== currentHouseId) {
        return;
      }
      if (myDeviceIds.size > 0 && incDevId && !myDeviceIds.has(incDevId)) {
        return;
      }

      const alertType = incData.type || event.alert_type || 'FALL_DETECTED';
      const isBatteryAlert = alertType === 'LOW_BATTERY' || alertType === 'DEVICE_BATTERY_DEAD';
      const getDefaultAlertMessage = (type: string) => {
        switch (type) {
          case 'DEVICE_BATTERY_DEAD':
            return '🪫 Vòng đeo tay thông minh đã cạn pin (0%) và ngắt kết nối!';
          case 'LOW_BATTERY':
            return '🔋 Cảnh báo: Pin đồng hồ thông minh sắp hết (< 20%)!';
          case 'HIGH_HEART_RATE':
            return '💓 Cảnh báo: Nhịp tim đo được từ vòng đeo tay tăng cao bất thường!';
          case 'LOW_HEART_RATE':
            return '💓 Cảnh báo: Nhịp tim đo được từ vòng đeo tay quá thấp!';
          case 'SUDDEN_HR_SPIKE':
            return '💓 Cảnh báo loạn nhịp: Nhịp tim tăng vọt đột ngột!';
          case 'SUDDEN_HR_DROP':
            return '💓 Cảnh báo loạn nhịp: Nhịp tim tụt đột ngột!';
          case 'LOW_SPO2':
            return '⚠️ Cảnh báo: Nồng độ oxy trong máu (SpO₂) tụt sâu dưới ngưỡng an toàn!';
          case 'CRITICAL_TRIAD':
            return '🚨 BÁO ĐỘNG ĐỎ: Tam chứng nguy kịch (Sốt cao + Tim nhanh + SpO₂ tụt)!';
          case 'EXERTION_HYPOXIA':
            return '🚨 Cảnh báo: Quá tải tim phổi khi gắng sức!';
          case 'FEVER_TACHYCARDIA':
            return '⚠️ Cảnh báo: Thân nhiệt cao kèm nhịp tim nhanh!';
          case 'CARDIO_COLLAPSE':
            return '🚨 BÁO ĐỘNG SINH TỬ: Nhịp tim tụt nguy kịch kèm thiếu oxy!';
          case 'HIGH_FEVER':
            return '🌡️ Cảnh báo: Thân nhiệt của cụ tăng cao (dấu hiệu sốt cao)!';
          case 'FALL_DETECTED':
          default:
            return '🚨 Cảnh báo té ngã khẩn cấp (Phát hiện bởi Edge AI)';
        }
      };

      const newIncident: Incident = {
        id: incData.id || `inc-${Date.now()}`,
        device_id: incData.device_id || 'BLE_BAND_001',
        alert_type: alertType,
        alert_level: incData.alert_level || (alertType === 'DEVICE_BATTERY_DEAD' || alertType === 'CRITICAL_TRIAD' || alertType === 'CARDIO_COLLAPSE' ? 'CRITICAL' : 'HIGH'),
        message: incData.message || incData.description || getDefaultAlertMessage(alertType),
        video_clip_url: incData.video_clip_url || null,
        thumbnail_url: incData.thumbnail_url || null,
        is_acknowledged: false,
        created_at: incData.created_at || new Date().toISOString(),
      };

      store.addIncident(newIncident);

      if (isBatteryAlert) {
        notificationService.triggerEmergencyNotification({
          title: alertType === 'DEVICE_BATTERY_DEAD' ? '🪫 ĐỒNG HỒ ĐÃ HẾT PIN' : '🔋 CẢNH BÁO PIN ĐỒNG HỒ YẾU',
          body: newIncident.message,
          data: { incident_id: newIncident.id, alert_type: newIncident.alert_type },
        });
      } else if (alertType === 'FALL_DETECTED' || alertType === 'AI_FALL_DETECTED') {
        store.setVitals({
          fall_detected: true,
          acoustic_status: 'Phát hiện sự cố té ngã!',
        });
        store.setSirenActive(true);

        // Kích hoạt Modal Đếm ngược Khẩn cấp Tự động (Auto-Escalation 45s)
        useEscalationStore.getState().triggerEscalation({
          incidentId: newIncident.id,
          alertType,
          patientName: incData.patient_name || incData.elderly_name || '',
          location: incData.location || incData.house_address || 'Nhà riêng đang giám sát',
          message: newIncident.message,
          thumbnailUrl: newIncident.thumbnail_url,
          delaySeconds: incData.escalation_seconds,
          createdAt: newIncident.created_at,
        });

        // Bắn thông báo khẩn cấp cục bộ té ngã
        notificationService.triggerEmergencyNotification({
          title: '🚨 CẢNH BÁO TÉ NGÃ KHẨN CẤP',
          body: newIncident.message,
          data: { incident_id: newIncident.id, alert_type: newIncident.alert_type },
        });
      } else {
        // Cảnh báo sinh hiệu: Nhịp tim, SpO2, Sốt cao, Loạn nhịp
        let alertTitle = '⚠️ CẢNH BÁO SINH TỒN BẤT THƯỜNG';
        if (alertType === 'HIGH_HEART_RATE') {
          alertTitle = '💓 CẢNH BÁO NHỊP TIM CAO BẤT THƯỜNG';
          store.setSirenActive(true);
        } else if (alertType === 'LOW_HEART_RATE') {
          alertTitle = '💓 CẢNH BÁO NHỊP TIM QUÁ THẤP';
          store.setSirenActive(true);
        } else if (alertType === 'SUDDEN_HR_SPIKE' || alertType === 'SUDDEN_HR_DROP') {
          alertTitle = '💓 CẢNH BÁO LOẠN NHỊP TIM ĐỘT NGỘT';
        } else if (alertType === 'LOW_SPO2') {
          alertTitle = '⚠️ CẢNH BÁO OXY MÁU (SPO2) TỤT SÂU';
          store.setSirenActive(true);
        } else if (alertType === 'CRITICAL_TRIAD' || alertType === 'CARDIO_COLLAPSE' || Boolean(incData.escalation_seconds)) {
          alertTitle = '🚨 BÁO ĐỘNG ĐỎ: TÌNH TRẠNG NGUY KỊCH';
          store.setSirenActive(true);
          useEscalationStore.getState().triggerEscalation({
            incidentId: newIncident.id,
            alertType,
            patientName: incData.patient_name || incData.elderly_name || '',
            location: incData.location || incData.house_address || 'Nhà riêng đang giám sát',
            message: newIncident.message,
            thumbnailUrl: newIncident.thumbnail_url,
            delaySeconds: incData.escalation_seconds,
            createdAt: newIncident.created_at,
          });
        } else if (alertType === 'HIGH_FEVER' || alertType === 'FEVER_TACHYCARDIA') {
          alertTitle = '🌡️ CẢNH BÁO THÂN NHIỆT SỐT CAO';
        }

        notificationService.triggerEmergencyNotification({
          title: alertTitle,
          body: newIncident.message,
          data: { incident_id: newIncident.id, alert_type: newIncident.alert_type },
        });
      }
    }


    // 2. Sự cố đã được xử lý (Đánh dấu đã xử lý / Resolved)
    else if (event.type === 'INCIDENT_RESOLVED') {
      // Dừng ngay lập tức chuông báo động & ngắt rung điện thoại (0ms)
      notificationService.stopEmergencyAlarm();

      const incId = event.incident_id || event.data?.id;
      if (incId) {
        useEscalationStore.getState().clearEscalation(incId);
        const handlerName =
          event.data?.acknowledged_by_name ||
          event.data?.acknowledged_by ||
          'Bác sĩ phụ trách';
        store.acknowledgeIncident(
          incId,
          event.data?.note || 'Đã kiểm tra an toàn',
          handlerName
        );
      }
      // Kiểm tra lại nếu không còn sự cố Critical chưa xử lý nào thì tắt còi & tắt cờ té ngã
      const remainingCritical = useVitalStore.getState().incidents.some(
        (i: any) => !i.is_acknowledged && (i.alert_level === 'CRITICAL' || i.alert_type === 'FALL_DETECTED')
      );
      if (!remainingCritical) {
        store.setVitals({ fall_detected: false, acoustic_status: 'Bình thường' });
        store.setSirenActive(false);
      }
    }

    // 2b. Sự cố đã tự động leo thang gọi điện khẩn cấp (ESCALATED_AUTO_CALL)
    else if (event.type === 'INCIDENT_ESCALATED') {
      const incId = event.incident_id || event.data?.id;
      if (incId) {
        useEscalationStore.getState().markEscalated(incId);
      }
    }

    // 2c. Sự cố đã tự hồi phục an toàn sau RECHECK (STOOD_DOWN)
    else if (event.type === 'INCIDENT_STOOD_DOWN') {
      const incId = event.incident_id || event.data?.id;
      if (incId) {
        useEscalationStore.getState().clearEscalation(incId);
      }
      store.setSirenActive(false);
    }

    // 3. Chỉ số sinh hiệu mô phỏng thời gian thực (Feature 3)
    else if (
      (event.type === 'VITALS_UPDATE' || event.type === 'vital_update') &&
      (event.data || (event as any).heart_rate !== undefined || (event as any).bracelet_battery !== undefined)
    ) {
      const d = event.data || (event as any);
      store.setVitals({
        device_id: d.device_id || (event as any).device_id,
        heart_rate: d.heart_rate,
        spo2: d.spo2,
        skin_temp_max: d.body_temp ?? d.skin_temp_max,
        person_count: d.person_count ?? 1,
        fall_detected: Boolean(d.fall_detected),
        acoustic_status: d.sound ?? d.acoustic_status ?? 'Bình thường',
        bracelet_battery: d.bracelet_battery !== undefined ? d.bracelet_battery : d.battery_level !== undefined ? d.battery_level : undefined,
        bracelet_connected: d.bracelet_connected !== undefined ? Boolean(d.bracelet_connected) : (d.bracelet_battery !== undefined ? d.bracelet_battery > 0 : undefined),
        timestamp: d.timestamp ?? Date.now(),
      });
    }

    // 4. Cập nhật chế độ an ninh nhà (Feature 4)
    else if (event.type === 'SYSTEM_MODE_UPDATE' && event.data) {
      const m = event.data;
      if (m.mode) {
        store.setHouseMode(m.mode);
      }
      if (m.is_mute_alarm !== undefined) {
        store.setAlarmSnooze({ active: Boolean(m.is_mute_alarm) });
      }
    }
  }

  subscribe(handler: AlertHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  unsubscribe(handler: AlertHandler): void {
    this.handlers.delete(handler);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this._clearPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private _clearPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const alertsWS = new AlertsWebSocket();
export const vitalsWS = alertsWS; // Alias tương thích ngược

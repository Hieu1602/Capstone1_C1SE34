// websocket.ts
// WebSocket client – Kết nối real-time với Backend FastAPI (/ws/alerts & /ws/vitals)
// Nhận sự kiện cảnh báo té ngã tức thì (Feature 1) & chỉ số sinh hiệu mô phỏng 5s/lần (Feature 3)

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useVitalStore, Incident } from '../store/useVitalStore';
import { notificationService } from './notificationService';


const getWsBaseUrl = (): string => {
  // 1. Khi chạy trên Web trình duyệt
  if (Platform.OS === 'web' || (typeof window !== 'undefined' && window.location?.hostname)) {
    const host = (typeof window !== 'undefined' && window.location?.hostname) || 'localhost';
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
  return 'ws://192.168.2.7:8000/ws';
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

    // 0. Lịch khám mới từ Bác sĩ (Doctor Appointment Scheduled)
    if (event.alert_type === 'APPOINTMENT_SCHEDULED' || event.type === 'APPOINTMENT_SCHEDULED') {
      const incData = event.data || {};
      const newIncident: Incident = {
        id: incData.id || `inc-apt-${Date.now()}`,
        device_id: incData.device_id || event.house_id || 'system',
        alert_type: 'APPOINTMENT_SCHEDULED',
        alert_level: 'LOW',
        message: incData.message || '🗓️ Bác sĩ vừa lên lịch khám mới. Vui lòng kiểm tra và xác nhận.',
        video_clip_url: null,
        thumbnail_url: null,
        is_acknowledged: false,
        created_at: incData.created_at || new Date().toISOString(),
        note: event.appointment_id || incData.appointment_id || null,
      };

      store.addIncident(newIncident);

      // Bắn thông báo đẩy cục bộ nhẹ nhàng (không kích hoạt còi hú khẩn cấp)
      notificationService.triggerEmergencyNotification({
        title: incData.title || '🗓️ LỊCH KHÁM MỚI TỪ BÁC SĨ',
        body: newIncident.message,
        data: {
          incident_id: newIncident.id,
          alert_type: 'APPOINTMENT_SCHEDULED',
          appointment_id: event.appointment_id,
          patient_id: event.patient_id,
        },
      });
      return;
    }

    // 0.1. Lịch khám đã được xác nhận (Doctor Appointment Confirmed)
    if (event.alert_type === 'APPOINTMENT_CONFIRMED' || event.type === 'APPOINTMENT_CONFIRMED') {
      const aptId = event.appointment_id || event.data?.appointment_id;
      const targetInc = store.incidents.find(
        (i) => (aptId && i.note === aptId) || i.id === event.incident_id || i.id === event.data?.id
      );
      if (targetInc) {
        store.acknowledgeIncident(targetInc.id, 'Gia đình đã xác nhận lịch khám');
      }
      return;
    }

    // 0.2. Lịch khám đã bị Bác sĩ hủy (Doctor Appointment Cancelled)
    if (event.alert_type === 'APPOINTMENT_CANCELLED' || event.type === 'APPOINTMENT_CANCELLED') {
      const aptId = event.appointment_id || event.data?.appointment_id;
      const reason = event.cancellation_reason || event.data?.cancellation_reason || 'Bác sĩ bận việc đột xuất';
      const targetInc = store.incidents.find(
        (i) =>
          (aptId && i.note && (i.note === aptId || i.note.includes(aptId))) ||
          i.id === event.incident_id ||
          i.id === event.data?.id ||
          (i.alert_type === 'APPOINTMENT_SCHEDULED' && (!aptId || (i.note && i.note.includes(aptId))))
      );
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

    // 1. Cảnh báo té ngã / sự cố khẩn cấp mới (Feature 1)
    if ((event.type === 'ALERT_NEW' && event.alert_type !== 'APPOINTMENT_SCHEDULED') || event.alert_type === 'FALL_DETECTED') {
      const incData = event.data || {};
      const newIncident: Incident = {
        id: incData.id || `inc-${Date.now()}`,
        device_id: incData.device_id || 'hub-001',
        alert_type: incData.type || event.alert_type || 'FALL_DETECTED',
        alert_level: incData.alert_level || 'CRITICAL',
        message: incData.message || incData.description || '🚨 Cảnh báo té ngã khẩn cấp (Phát hiện bởi Edge AI)',
        video_clip_url: incData.video_clip_url || 'http://localhost:8000/static/evidence/fall_evidence_ai.jpg',
        thumbnail_url: incData.thumbnail_url || 'http://localhost:8000/static/evidence/fall_evidence_ai.jpg',
        is_acknowledged: false,
        created_at: incData.created_at || new Date().toISOString(),
      };

      store.addIncident(newIncident);
      store.setVitals({
        fall_detected: true,
        acoustic_status: 'Phát hiện sự cố té ngã!',
      });
      store.setSirenActive(true);

      // Bắn thông báo khẩn cấp cục bộ (Feature 5)
      notificationService.triggerEmergencyNotification({
        title: '🚨 CẢNH BÁO TÉ NGÃ KHẨN CẤP',
        body: newIncident.message,
        data: { incident_id: newIncident.id, alert_type: newIncident.alert_type },
      });
    }


    // 2. Sự cố đã được xử lý (Đánh dấu đã xử lý / Resolved)
    else if (event.type === 'INCIDENT_RESOLVED') {
      const incId = event.incident_id || event.data?.id;
      if (incId) {
        store.acknowledgeIncident(incId, event.data?.note || 'Đã kiểm tra an toàn');
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

    // 3. Chỉ số sinh hiệu mô phỏng thời gian thực (Feature 3)
    else if (event.type === 'VITALS_UPDATE' && event.data) {
      const d = event.data;
      store.setVitals({
        heart_rate: d.heart_rate,
        spo2: d.spo2,
        skin_temp_max: d.body_temp ?? d.skin_temp_max,
        person_count: d.person_count ?? 1,
        fall_detected: Boolean(d.fall_detected),
        acoustic_status: d.sound ?? d.acoustic_status ?? 'Bình thường',
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

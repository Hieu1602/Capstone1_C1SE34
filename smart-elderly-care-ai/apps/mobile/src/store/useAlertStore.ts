/**
 * ============================================================================
 * TỆP: useAlertStore.ts
 * TÁC GIẢ: Phan Nguyễn Giáng My
 * MÔ TẢ:
 *   Domain Store quản lý danh sách sự cố cảnh báo (Incidents), trạng thái còi
 *   hú khẩn cấp (Siren) và chế độ tạm tắt chuông báo động (Alarm Snooze).
 *   Tách biệt theo nguyên lý Single Responsibility Principle (SRP).
 * ============================================================================
 */

import { create } from 'zustand';
import { incidentsApi } from '../services/api';

// ---- Định nghĩa kiểu dữ liệu (Types) ----
export interface Incident {
  id: string;
  device_id?: string;
  alert_type: string;
  alert_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  confidence?: number | null;
  sources?: string | null;
  video_clip_url: string | null;
  thumbnail_url: string | null;
  is_acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_by_name?: string | null;
  acknowledged_at?: string | null;
  note?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AlarmSnoozeInfo {
  active: boolean;
  until: number | null;
  durationMinutes: number;
  mode: 'VIBRATE' | 'SILENT';
  syncAll: boolean;
}

interface AlertState {
  incidents: Incident[];
  alarmSnooze: AlarmSnoozeInfo;
  sirenActive: boolean;

  // Actions
  fetchNotifications: () => Promise<Incident[] | null>;
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  /** localOnly: chỉ cập nhật RAM (dùng khi nhận INCIDENT_RESOLVED từ server) – không gọi lại API để tránh vòng lặp */
  acknowledgeIncident: (incidentId: string, note?: string, user?: string, localOnly?: boolean) => void;
  reopenIncident: (incidentId: string, note?: string) => void;
  acknowledgeAll: () => Promise<void>;
  setAlarmSnooze: (snooze: Partial<AlarmSnoozeInfo>) => void;
  cancelAlarmSnooze: () => void;
  setSirenActive: (active: boolean) => void;
  resetAlertStore: () => void;
}

const DEFAULT_SNOOZE: AlarmSnoozeInfo = {
  active: false,
  until: null,
  durationMinutes: 15,
  mode: 'VIBRATE',
  syncAll: true,
};

/** Cảnh báo khẩn cấp: chỉ tắt bằng thao tác "Đã xử lý" rõ ràng, không bằng "đã đọc" */
export const isUrgentIncident = (inc?: { alert_level?: string | null } | null) =>
  inc?.alert_level === 'HIGH' || inc?.alert_level === 'CRITICAL';

export const useAlertStore = create<AlertState>()((set, get) => ({
  incidents: [],
  alarmSnooze: { ...DEFAULT_SNOOZE },
  sirenActive: false,

  fetchNotifications: async () => {
    try {
      const res = await incidentsApi.list();
      if (res.data && Array.isArray(res.data)) {
        const seen = new Set<string>();
        const unique = res.data.filter((item: Incident) => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        set({ incidents: unique });
        return unique;
      }
    } catch (e) {
      console.warn('fetchNotifications API fallback:', e);
    }
    return null;
  },

  setIncidents: (incidents: Incident[]) => set({ incidents }),

  addIncident: (incident: Incident) =>
    set((state) => {
      // 1. Chống trùng lặp theo ID
      if (state.incidents.some((i) => i.id === incident.id)) {
        return state;
      }
      // 2. Chống trùng lặp theo nhóm sinh hiệu/thiết bị trong vòng 30 giây
      const now = Date.now();
      const isDuplicateRecent = state.incidents.some((i) => {
        if (i.device_id && incident.device_id && i.device_id !== incident.device_id) return false;
        const diffMs = Math.abs(now - new Date(i.created_at).getTime());
        if (diffMs > 30000) return false;
        const hrGroup = ['HIGH_HEART_RATE', 'LOW_HEART_RATE', 'SUDDEN_HR_SPIKE', 'SUDDEN_HR_DROP'];
        if (hrGroup.includes(i.alert_type) && hrGroup.includes(incident.alert_type)) {
          return true;
        }
        return i.alert_type === incident.alert_type;
      });

      if (isDuplicateRecent) {
        return state;
      }
      return {
        incidents: [incident, ...state.incidents].slice(0, 100),
        sirenActive: incident.alert_level === 'CRITICAL' ? true : state.sirenActive,
      };
    }),

  acknowledgeIncident: async (incidentId: string, note?: string, user: string = 'Demo User', localOnly = false) => {
    // 0. Tắt ngay lập tức chuông báo động và rung điện thoại khi bấm Đã xử lý (0ms)
    try {
      const { notificationService } = require('../services/notificationService');
      notificationService.stopEmergencyAlarm();
    } catch {}

    // 1. Optimistic Update tức thời trong RAM (0ms)
    set((state) => {
      const updatedIncidents = state.incidents.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              is_acknowledged: true,
              acknowledged_by: user,
              acknowledged_by_name: user,
              acknowledged_at: new Date().toISOString(),
              note: note ?? inc.note,
            }
          : inc
      );

      const hasOtherCritical = updatedIncidents.some(
        (inc) => !inc.is_acknowledged && (inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED')
      );

      return {
        incidents: updatedIncidents,
        sirenActive: hasOtherCritical,
      };
    });

    // 2. Đồng bộ ngầm xuống backend
    if (localOnly) return;
    try {
      await incidentsApi.acknowledge(incidentId, note);
    } catch (e) {
      console.warn('acknowledgeIncident API error:', e);
    }
  },

  acknowledgeAll: async () => {
    // 0. Tắt ngay lập tức chuông báo động và rung điện thoại khi bấm Đã xử lý tất cả (0ms)
    try {
      const { notificationService } = require('../services/notificationService');
      notificationService.stopEmergencyAlarm();
    } catch {}

    // 1. Optimistic Update tức thời trong RAM (0ms) — giữ nguyên lời mời chờ xác nhận.
    // Bác sĩ: giống backend, "đánh dấu tất cả" không đụng tới cảnh báo khẩn cấp HIGH/CRITICAL
    const { useAuthStore } = require('./useAuthStore');
    const isDoctor = useAuthStore.getState().userRole === 'doctor' || useAuthStore.getState().role === 'doctor';
    set((state) => ({
      incidents: state.incidents.map((inc) =>
        inc.alert_type === 'HOUSE_INVITE_PENDING' || (isDoctor && isUrgentIncident(inc))
          ? inc
          : {
              ...inc,
              is_acknowledged: true,
              acknowledged_at: new Date().toISOString(),
            }
      ),
      sirenActive: false,
    }));

    // 2. Đồng bộ ngầm xuống backend
    try {
      await incidentsApi.acknowledgeAll();
    } catch (e) {
      console.warn('acknowledgeAll error:', e);
    }
  },

  reopenIncident: (incidentId: string, note?: string) =>
    set((state) => {
      const updatedIncidents = state.incidents.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              is_acknowledged: false,
              acknowledged_by: undefined,
              acknowledged_by_name: undefined,
              acknowledged_at: undefined,
              note: note ?? 'Chưa an toàn - Cần tiếp tục hỗ trợ',
            }
          : inc
      );

      const reopened = updatedIncidents.find((i) => i.id === incidentId);
      const isCritical = Boolean(
        reopened && (reopened.alert_level === 'CRITICAL' || reopened.alert_type === 'FALL_DETECTED')
      );

      return {
        incidents: updatedIncidents,
        sirenActive: isCritical ? true : state.sirenActive,
      };
    }),

  setAlarmSnooze: (snooze: Partial<AlarmSnoozeInfo>) =>
    set((state) => ({
      alarmSnooze: { ...state.alarmSnooze, ...snooze },
      sirenActive: false,
    })),

  cancelAlarmSnooze: () => set({ alarmSnooze: { ...DEFAULT_SNOOZE } }),

  setSirenActive: (active: boolean) => {
    set({ sirenActive: active });
    if (!active) {
      try {
        const { notificationService } = require('../services/notificationService');
        notificationService.stopEmergencyAlarm();
      } catch {}
    }
  },

  resetAlertStore: () =>
    set({
      incidents: [],
      alarmSnooze: { ...DEFAULT_SNOOZE },
      sirenActive: false,
    }),
}));

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
  acknowledgeIncident: (incidentId: string, note?: string, user?: string) => void;
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

export const useAlertStore = create<AlertState>()((set, get) => ({
  incidents: [],
  alarmSnooze: { ...DEFAULT_SNOOZE },
  sirenActive: false,

  fetchNotifications: async () => {
    try {
      const res = await incidentsApi.list();
      if (res.data && Array.isArray(res.data)) {
        set({ incidents: res.data });
        return res.data;
      }
    } catch (e) {
      console.warn('fetchNotifications API fallback:', e);
    }
    return null;
  },

  setIncidents: (incidents: Incident[]) => set({ incidents }),

  addIncident: (incident: Incident) =>
    set((state) => ({
      incidents: [incident, ...state.incidents].slice(0, 100),
      sirenActive: incident.alert_level === 'CRITICAL' ? true : state.sirenActive,
    })),

  acknowledgeIncident: (incidentId: string, note?: string, user: string = 'Demo User') =>
    set((state) => {
      const updatedIncidents = state.incidents.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              is_acknowledged: true,
              acknowledged_by: user,
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
    }),

  acknowledgeAll: async () => {
    try {
      await incidentsApi.acknowledgeAll();
    } catch (e) {
      console.warn('acknowledgeAll error:', e);
    }
    set((state) => ({
      incidents: state.incidents.map((inc) => ({
        ...inc,
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })),
      sirenActive: false,
    }));
  },

  setAlarmSnooze: (snooze: Partial<AlarmSnoozeInfo>) =>
    set((state) => ({
      alarmSnooze: { ...state.alarmSnooze, ...snooze },
      sirenActive: false,
    })),

  cancelAlarmSnooze: () => set({ alarmSnooze: { ...DEFAULT_SNOOZE } }),

  setSirenActive: (active: boolean) => set({ sirenActive: active }),

  resetAlertStore: () =>
    set({
      incidents: [],
      alarmSnooze: { ...DEFAULT_SNOOZE },
      sirenActive: false,
    }),
}));

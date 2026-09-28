// useVitalStore.ts
// Zustand store – State Management cho toàn bộ app

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from './useThemeStore';
import {
  vitalsApi,
  systemApi,
  remindersApi,
  patientApi,
  incidentsApi,
} from '../services/api';

// ---- Types ----
export interface VitalData {
  heart_rate: number | null;
  spo2: number | null;
  skin_temp_max: number | null;
  person_count: number | null;
  fall_detected: boolean;
  timestamp: number | null;
  acoustic_status?: string;
  bracelet_battery?: number;
  bracelet_connected?: boolean;
  edge_hub_connected?: boolean;
}

export interface Incident {
  id: string;
  device_id: string;
  alert_type: string;
  alert_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  video_clip_url: string | null;
  thumbnail_url: string | null;
  is_acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  note?: string | null;
  created_at: string;
}

export interface AlarmSnoozeInfo {
  active: boolean;
  until: number | null; // null if indefinitely until manually re-enabled
  durationMinutes: number; // 15, 60, 120, 0
  mode: 'VIBRATE' | 'SILENT';
  syncAll: boolean;
}

export interface MedicalConditionItem {
  id: string;
  name: string;
  severity: 'warning' | 'danger' | 'info';
  note: string;
}

export interface PatientMedicalRecord {
  patient_id: number;
  name: string;
  birth_year: string;
  age: number;
  gender: string;
  blood_type: string;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  security_badge: string;
  conditions: MedicalConditionItem[];
  drug_allergies: string;
  food_allergies: string;
  dietary_notes: string;
  doctor_name: string;
  doctor_phone: string;
  doctor_specialty: string;
  hospital: string;
  next_appointment: string;
}

export interface ReminderItem {
  id: string;
  name: string;
  time: string;
  session: 'MORNING' | 'NOON' | 'EVENING' | string;
  dose: string;
  purpose: string;
  taken: boolean;
}

export interface RemindersData {
  date: string;
  total_medications: number;
  completed_medications: number;
  hub_voice_reminder_enabled: boolean;
  medications: ReminderItem[];
  meals: Array<{ name: string; time: string; completed: boolean; note: string }>;
}

export interface Device {
  id: string;
  device_id: string;
  name: string;
  location: string;
  is_online: boolean;
}

export interface HouseInfo {
  name: string;
  address: string;
  membersCount: number;
  currentMode: 'AWAY' | 'HOME' | 'DISARM' | 'ALARM' | 'PRIVACY';
}

export interface CameraDevice {
  id: string;
  name: string;
  room: string;
  isOnline: boolean;
  isSleep: boolean;
  isAIProtect: boolean;
  resolution: 'HD' | 'BASIC';
  sdCardStatus: 'OK' | 'NO_CARD';
  wifiStrength: number; // 1-3
  streamUrl: string;
}

export interface IoTDeviceItem {
  id: string;
  name: string;
  sub: string;
  type: string;
  status: string;
  isOnline: boolean;
  icon: string;
  color: string;
  location?: string;
  streamUrl?: string;
  macAddress?: string;
}

// ---- Vital Store ----
interface VitalStoreState {
  currentVitals: VitalData;
  incidents: Incident[];
  activeDevice: Device | null;
  isConnected: boolean;
  house: HouseInfo;
  camera: CameraDevice;
  iotDevices: IoTDeviceItem[];
  deviceGroups: string[];
  selectedDate: string; // e.g. "09/07"
  algoSettings: {
    maxHeartRate: number;
    minHeartRate: number;
    minSpO2: number;
    maxTemp: number;
    fallAngle: number;
    immobilitySec: number;
  };

  alarmSnooze: AlarmSnoozeInfo;
  sirenActive: boolean;

  patientRecord: PatientMedicalRecord | null;
  todayReminders: RemindersData | null;
  isLoadingVitals: boolean;
  isLoadingMode: boolean;
  isLoadingReminders: boolean;
  isLoadingPatient: boolean;

  fetchVitals: () => Promise<VitalData | null>;
  fetchSystemMode: () => Promise<{ mode: string; is_mute_alarm: boolean; is_camera_privacy: boolean } | null>;
  fetchReminders: () => Promise<RemindersData | null>;
  fetchPatientRecord: (patientId?: number) => Promise<PatientMedicalRecord | null>;
  fetchNotifications: () => Promise<Incident[] | null>;

  setVitals: (data: Partial<VitalData>) => void;
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  acknowledgeIncident: (incidentId: string, note?: string, user?: string) => void;
  setAlarmSnooze: (snooze: Partial<AlarmSnoozeInfo>) => void;
  cancelAlarmSnooze: () => void;
  setSirenActive: (active: boolean) => void;
  setActiveDevice: (device: Device | null) => void;
  setConnected: (connected: boolean) => void;
  setHouseMode: (mode: 'AWAY' | 'HOME' | 'DISARM' | 'ALARM' | 'PRIVACY') => void;
  updateHouseAddress: (address: string) => void;
  toggleCameraSleep: () => void;
  toggleCameraAIProtect: () => void;
  setCameraResolution: (res: 'HD' | 'BASIC') => void;
  setSelectedDate: (date: string) => void;
  updateAlgoSettings: (settings: Partial<VitalStoreState['algoSettings']>) => void;
  addIoTDevice: (device: IoTDeviceItem) => void;
  removeIoTDevice: (deviceId: string) => void;
  addDeviceGroup: (groupName: string) => void;
  updateDeviceGroup: (oldName: string, newName: string, deviceIds?: string[]) => void;
  removeDeviceGroup: (groupName: string) => void;
  assignDevicesToGroup: (deviceIds: string[], groupName: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;

  // Backend Sync State & Actions
  isLoadingDevices: boolean;
  fetchHouseFromBackend: () => Promise<void>;
  fetchGroupsFromBackend: () => Promise<void>;
  fetchDevicesFromBackend: () => Promise<void>;
  syncAllWithBackend: () => Promise<void>;
}

const createVitalStore: StateCreator<VitalStoreState> = (set, get) => ({
  currentVitals: {
    heart_rate: 74,
    spo2: 98,
    skin_temp_max: 36.8,
    person_count: 1,
    fall_detected: false,
    timestamp: Date.now(),
    acoustic_status: 'Bình thường',
    bracelet_battery: 88,
    bracelet_connected: true,
    edge_hub_connected: true,
  },
  incidents: [
    {
      id: 'inc-01',
      device_id: 'hub-001',
      alert_type: 'PERSON_DETECTED',
      alert_level: 'LOW',
      message: 'Nhận diện người cao tuổi đang sinh hoạt tại phòng khách (YOLOv8)',
      video_clip_url: null,
      thumbnail_url: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=300&q=80',
      is_acknowledged: true,
      created_at: new Date(Date.now() - 45 * 1000).toISOString(),
    },
    {
      id: 'inc-02',
      device_id: 'hub-001',
      alert_type: 'PERSON_DETECTED',
      alert_level: 'LOW',
      message: 'Phát hiện chuyển động di chuyển ra khu vực cửa sổ',
      video_clip_url: null,
      thumbnail_url: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?w=300&q=80',
      is_acknowledged: true,
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'inc-03',
      device_id: 'hub-001',
      alert_type: 'FALL_DETECTED',
      alert_level: 'CRITICAL',
      message: '🚨 Cảnh báo té ngã (Fall Detected) - Trích xuất clip 5s bộ đệm Edge Hub RAM',
      video_clip_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=300&q=80',
      is_acknowledged: false,
      created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
    {
      id: 'inc-04',
      device_id: 'hub-001',
      alert_type: 'HIGH_HEART_RATE',
      alert_level: 'HIGH',
      message: 'Nhịp tim đo được từ vòng đeo tay BLE Band: 128 bpm (Vượt ngưỡng 100 bpm)',
      video_clip_url: null,
      thumbnail_url: null,
      is_acknowledged: false,
      created_at: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
    },
    {
      id: 'inc-05',
      device_id: 'hub-001',
      alert_type: 'ACOUSTIC_DISTRESS',
      alert_level: 'CRITICAL',
      message: 'Phát hiện âm thanh cầu cứu: "Cứu tôi với!" tại khu vực bếp (YAMNet AI)',
      video_clip_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=300&q=80',
      is_acknowledged: false,
      created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    },
  ],
  activeDevice: {
    id: 'hub-001',
    device_id: 'hub-001',
    name: 'Orange Pi 5 Edge Hub',
    location: 'Phòng khách',
    is_online: true,
  },
  isConnected: true,
  house: {
    name: 'Nhà của tôi',
    address: '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng',
    membersCount: 1,
    currentMode: 'HOME',
  },
  camera: {
    id: 'SECA_001',
    name: 'Camera Góc Rộng AI - SECA_001',
    room: 'Phòng khách',
    isOnline: true,
    isSleep: false,
    isAIProtect: true,
    resolution: 'HD',
    sdCardStatus: 'OK',
    wifiStrength: 3,
    streamUrl: 'http://10.0.2.2:8080',
  },
  alarmSnooze: {
    active: false,
    until: null,
    durationMinutes: 15,
    mode: 'VIBRATE',
    syncAll: true,
  },
  sirenActive: false,
  selectedDate: '09/07',
  algoSettings: {
    maxHeartRate: 120,
    minHeartRate: 50,
    minSpO2: 90,
    maxTemp: 37.8,
    fallAngle: 60,
    immobilitySec: 30,
  },

  patientRecord: null,
  todayReminders: null,
  isLoadingVitals: false,
  isLoadingMode: false,
  isLoadingReminders: false,
  isLoadingPatient: false,

  fetchVitals: async () => {
    set({ isLoadingVitals: true });
    try {
      const res = await vitalsApi.getCurrent();
      if (res.data) {
        const d = res.data;
        const updatedVitals: VitalData = {
          heart_rate: d.heart_rate ?? 74,
          spo2: d.spo2 ?? 98,
          skin_temp_max: d.body_temp ?? 36.8,
          person_count: d.person_count ?? 1,
          fall_detected: Boolean(d.fall_detected),
          timestamp: d.timestamp ?? Date.now(),
          acoustic_status: d.sound ?? 'Bình thường',
          bracelet_battery: d.bracelet_battery ?? 88,
          bracelet_connected: true,
          edge_hub_connected: d.edge_hub_connected ?? true,
        };
        set({ currentVitals: updatedVitals, isLoadingVitals: false });
        return updatedVitals;
      }
    } catch (e) {
      console.warn('fetchVitals API fallback:', e);
    }
    set({ isLoadingVitals: false });
    return null;
  },

  fetchSystemMode: async () => {
    set({ isLoadingMode: true });
    try {
      const res = await systemApi.getMode();
      if (res.data) {
        const { mode, is_mute_alarm, is_camera_privacy, mute_mode } = res.data;
        set((state) => ({
          house: {
            ...state.house,
            currentMode: (mode as any) || state.house.currentMode,
          },
          alarmSnooze: {
            ...state.alarmSnooze,
            active: Boolean(is_mute_alarm),
            mode: (mute_mode as any) || state.alarmSnooze.mode,
          },
          camera: {
            ...state.camera,
            isSleep: Boolean(is_camera_privacy),
          },
          isLoadingMode: false,
        }));
        return res.data;
      }
    } catch (e) {
      console.warn('fetchSystemMode API fallback:', e);
    }
    set({ isLoadingMode: false });
    return null;
  },

  fetchReminders: async () => {
    set({ isLoadingReminders: true });
    try {
      const res = await remindersApi.getToday();
      if (res.data) {
        set({ todayReminders: res.data, isLoadingReminders: false });
        return res.data;
      }
    } catch (e) {
      console.warn('fetchReminders API fallback:', e);
    }
    set({ isLoadingReminders: false });
    return null;
  },

  fetchPatientRecord: async (patientId: number = 1) => {
    set({ isLoadingPatient: true });
    try {
      const res = await patientApi.getMedicalRecord(patientId);
      if (res.data) {
        set({ patientRecord: res.data, isLoadingPatient: false });
        return res.data;
      }
    } catch (e) {
      console.warn('fetchPatientRecord API fallback:', e);
    }
    set({ isLoadingPatient: false });
    return null;
  },

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

  setVitals: (data: Partial<VitalData>) =>
    set((state: VitalStoreState) => ({
      currentVitals: { ...state.currentVitals, ...data },
    })),

  setIncidents: (incidents: Incident[]) => set({ incidents }),

  addIncident: (incident: Incident) =>
    set((state: VitalStoreState) => ({
      incidents: [incident, ...state.incidents].slice(0, 100),
      sirenActive: incident.alert_level === 'CRITICAL' ? true : state.sirenActive,
    })),

  acknowledgeIncident: (incidentId: string, note?: string, user: string = 'Demo User') =>
    set((state: VitalStoreState) => {
      const updatedIncidents = state.incidents.map((inc) => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            is_acknowledged: true,
            acknowledged_by: user,
            acknowledged_at: new Date().toISOString(),
            note: note ?? inc.note,
          };
        }
        return inc;
      });

      const hasOtherCritical = updatedIncidents.some(
        (inc) => !inc.is_acknowledged && (inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED')
      );

      return {
        incidents: updatedIncidents,
        sirenActive: false,
        currentVitals: {
          ...state.currentVitals,
          fall_detected: hasOtherCritical ? state.currentVitals.fall_detected : false,
          acoustic_status: hasOtherCritical ? state.currentVitals.acoustic_status : 'Bình thường',
        },
      };
    }),

  setAlarmSnooze: (snooze: Partial<AlarmSnoozeInfo>) =>
    set((state: VitalStoreState) => ({
      alarmSnooze: { ...state.alarmSnooze, ...snooze },
      sirenActive: false,
    })),

  cancelAlarmSnooze: () =>
    set(() => ({
      alarmSnooze: {
        active: false,
        until: null,
        durationMinutes: 15,
        mode: 'VIBRATE',
        syncAll: true,
      },
    })),

  setSirenActive: (active: boolean) => set({ sirenActive: active }),

  setActiveDevice: (device: Device | null) => set({ activeDevice: device }),
  setConnected: (connected: boolean) => set({ isConnected: connected }),

  setHouseMode: (mode: 'AWAY' | 'HOME' | 'DISARM' | 'ALARM' | 'PRIVACY') => {
    set((state) => ({ house: { ...state.house, currentMode: mode } }));
    houseApi.updateHouseMode(mode).catch((err) =>
      console.log('[Store] Không thể đồng bộ chế độ nhà lên backend:', err)
    );
  },

  updateHouseAddress: (address: string) => {
    set((state) => ({ house: { ...state.house, address } }));
    houseApi.updateHouse({ address }).catch((err) =>
      console.log('[Store] Không thể đồng bộ địa chỉ nhà lên backend:', err)
    );
  },

  toggleCameraSleep: () => {
    const nextVal = !get().camera.isSleep;
    set((state) => ({
      camera: { ...state.camera, isSleep: nextVal },
    }));
    devicesApi.updateDeviceConfig(get().camera.id, { is_sleep: nextVal }).catch((err) =>
      console.log('[Store] Không thể đồng bộ trạng thái ngủ camera lên backend:', err)
    );
  },

  toggleCameraAIProtect: () => {
    const nextVal = !get().camera.isAIProtect;
    set((state) => ({
      camera: { ...state.camera, isAIProtect: nextVal },
    }));
    devicesApi.updateDeviceConfig(get().camera.id, { is_ai_protect: nextVal }).catch((err) =>
      console.log('[Store] Không thể đồng bộ AI Protect camera lên backend:', err)
    );
  },

  setCameraResolution: (res: 'HD' | 'BASIC') =>
    set((state) => ({ camera: { ...state.camera, resolution: res } })),

  setSelectedDate: (date: string) => set({ selectedDate: date }),

  updateAlgoSettings: (settings) =>
    set((state) => ({
      algoSettings: { ...state.algoSettings, ...settings },
    })),

  iotDevices: [
    {
      id: 'SECA_001',
      name: 'SECA_001',
      sub: 'Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều',
      type: 'camera',
      status: 'Đang ghi hình',
      isOnline: true,
      icon: 'videocam',
      color: '#FF7A00',
      location: 'Phòng khách',
    },
    {
      id: 'BLE_BAND_001',
      name: 'Vòng đeo tay BLE Smartband',
      sub: 'Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập',
      type: 'watch',
      status: 'Pin 84% • Đang đeo',
      isOnline: true,
      icon: 'watch',
      color: '#10B981',
      location: 'Phòng ngủ',
    },
  ],

  deviceGroups: ['Phòng khách', 'Phòng ngủ'],

  addIoTDevice: (device: IoTDeviceItem) => {
    set((state) => ({
      iotDevices: [device, ...state.iotDevices],
    }));
    // Đăng ký lên backend nếu có kết nối
    const isCam = device.type === 'camera';
    devicesApi
      .createDevice({
        device_id: device.id,
        name: device.name,
        sub_title: device.sub,
        device_type: isCam ? 'CAMERA' : 'SMARTBAND',
        location: device.location || 'Phòng khách',
      })
      .catch((err) =>
        console.log('[Store] Thiết bị lưu local cache, đồng bộ backend sau:', err)
      );
  },

  removeIoTDevice: (deviceId: string) => {
    set((state) => ({
      iotDevices: state.iotDevices.filter((d) => d.id !== deviceId),
    }));
    devicesApi.deleteDevice(deviceId).catch((err) =>
      console.log('[Store] Xóa thiết bị backend failed:', err)
    );
  },

  addDeviceGroup: (groupName: string) => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    const exists = get().deviceGroups.some(
      (g) => g.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      set((state) => ({
        deviceGroups: [...state.deviceGroups, trimmed],
      }));
      deviceGroupApi.createGroup({ name: trimmed }).catch((err) =>
        console.log('[Store] Tạo nhóm backend failed:', err)
      );
    }
  },

  updateDeviceGroup: (oldName: string, newName: string, deviceIds?: string[]) => {
    const trimmedNew = newName.trim();
    const trimmedOld = oldName.trim();
    const updatedGroups = get().deviceGroups.map((g) =>
      g.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : g
    );
    let updatedDevices = get().iotDevices;
    if (deviceIds) {
      updatedDevices = updatedDevices.map((dev) => {
        if (deviceIds.includes(dev.id)) {
          return { ...dev, location: trimmedNew };
        } else if (dev.location?.trim().toLowerCase() === trimmedOld.toLowerCase()) {
          return { ...dev, location: 'Chưa nhóm' };
        }
        return dev;
      });
    } else if (trimmedOld.toLowerCase() !== trimmedNew.toLowerCase()) {
      updatedDevices = updatedDevices.map((dev) =>
        dev.location?.trim().toLowerCase() === trimmedOld.toLowerCase()
          ? { ...dev, location: trimmedNew }
          : dev
      );
    }
    set({
      deviceGroups: updatedGroups,
      iotDevices: updatedDevices,
    });

    (async () => {
      try {
        const groupsRes = await deviceGroupApi.listGroups();
        const found = groupsRes.data.find(
          (g) => g.name.toLowerCase() === trimmedOld.toLowerCase()
        );
        if (found) {
          await deviceGroupApi.updateGroup(found.id, { name: trimmedNew });
        }
      } catch (err) {
        console.log('[Store] Cập nhật nhóm backend failed:', err);
      }
    })();
  },

  removeDeviceGroup: (groupName: string) => {
    set((state) => ({
      deviceGroups: state.deviceGroups.filter(
        (g) => g.trim().toLowerCase() !== groupName.trim().toLowerCase()
      ),
      iotDevices: state.iotDevices.map((dev) =>
        dev.location?.trim().toLowerCase() === groupName.trim().toLowerCase()
          ? { ...dev, location: 'Chưa nhóm' }
          : dev
      ),
    }));

    (async () => {
      try {
        const groupsRes = await deviceGroupApi.listGroups();
        const found = groupsRes.data.find(
          (g) => g.name.toLowerCase() === groupName.trim().toLowerCase()
        );
        if (found) {
          await deviceGroupApi.deleteGroup(found.id);
        }
      } catch (err) {
        console.log('[Store] Xóa nhóm backend failed:', err);
      }
    })();
  },

  assignDevicesToGroup: (deviceIds: string[], groupName: string) => {
    set((state) => ({
      iotDevices: state.iotDevices.map((dev) =>
        deviceIds.includes(dev.id) ? { ...dev, location: groupName } : dev
      ),
    }));

    (async () => {
      try {
        const groupsRes = await deviceGroupApi.listGroups();
        const found = groupsRes.data.find(
          (g) => g.name.toLowerCase() === groupName.trim().toLowerCase()
        );
        if (found) {
          await deviceGroupApi.assignDevices(deviceIds, found.id);
        }
      } catch (err) {
        console.log('[Store] Gán thiết bị vào nhóm backend failed:', err);
      }
    })();
  },

  isDarkMode: useThemeStore.getState().isDarkMode,
  toggleDarkMode: () => {
    useThemeStore.getState().toggleTheme();
    set((state) => ({ isDarkMode: !state.isDarkMode }));
  },
  setDarkMode: (isDark: boolean) => {
    useThemeStore.getState().setDarkMode(isDark);
    set({ isDarkMode: isDark });
  },

  // ---- Backend Sync Operations ----
  isLoadingDevices: false,

  fetchHouseFromBackend: async () => {
    try {
      const res = await houseApi.getCurrentHouse();
      if (res.data) {
        set((state) => ({
          house: {
            ...state.house,
            name: res.data.name,
            address: res.data.address || state.house.address,
            currentMode: res.data.current_mode,
          },
        }));
      }
    } catch (e) {
      console.log('[Store] fetchHouseFromBackend fallback to cache');
    }
  },

  fetchGroupsFromBackend: async () => {
    try {
      const res = await deviceGroupApi.listGroups();
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const names = res.data.map((g) => g.name);
        set({ deviceGroups: names });
      }
    } catch (e) {
      console.log('[Store] fetchGroupsFromBackend fallback to cache');
    }
  },

  fetchDevicesFromBackend: async () => {
    try {
      const res = await devicesApi.listDevices();
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: IoTDeviceItem[] = res.data.map((dev) => {
          const isCam = dev.device_type === 'CAMERA';
          return {
            id: dev.device_id || dev.id,
            name: dev.name,
            sub:
              dev.sub_title ||
              (isCam
                ? 'Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều'
                : 'Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập'),
            type: isCam ? 'camera' : 'watch',
            status: dev.status_text || (dev.is_online ? 'Trực tuyến' : 'Ngoại tuyến'),
            isOnline: dev.is_online,
            icon: isCam ? 'videocam' : 'watch',
            color: isCam ? '#FF7A00' : '#10B981',
            location: dev.location || 'Chưa nhóm',
            streamUrl: dev.config?.stream_url || undefined,
            macAddress: dev.mac_address || undefined,
          };
        });
        set({ iotDevices: mapped });

        const firstCam = res.data.find((d) => d.device_type === 'CAMERA');
        if (firstCam && firstCam.config) {
          set((state) => ({
            camera: {
              ...state.camera,
              id: firstCam.device_id,
              name: firstCam.name,
              room: firstCam.location || 'Phòng khách',
              isOnline: firstCam.is_online,
              isSleep: Boolean(firstCam.config?.is_sleep),
              isAIProtect: Boolean(firstCam.config?.is_ai_protect),
              resolution: (firstCam.config?.resolution as '2K' | 'FHD' | 'SD') || '2K',
              streamUrl: firstCam.config?.stream_url || state.camera.streamUrl,
            },
          }));
        }
      }
    } catch (e) {
      console.log('[Store] fetchDevicesFromBackend fallback to cache');
    }
  },

  syncAllWithBackend: async () => {
    set({ isLoadingDevices: true });
    try {
      await Promise.allSettled([
        get().fetchHouseFromBackend(),
        get().fetchGroupsFromBackend(),
        get().fetchDevicesFromBackend(),
      ]);
    } finally {
      set({ isLoadingDevices: false });
    }
  },
});

export const useVitalStore = create<VitalStoreState>()(createVitalStore);

// Đồng bộ trạng thái Theme giữa useThemeStore và useVitalStore hai chiều
useThemeStore.subscribe((state) => {
  if (useVitalStore.getState().isDarkMode !== state.isDarkMode) {
    useVitalStore.setState({ isDarkMode: state.isDarkMode });
  }
});

useVitalStore.subscribe((state) => {
  if (useThemeStore.getState().isDarkMode !== state.isDarkMode) {
    useThemeStore.getState().setDarkMode(state.isDarkMode);
  }
});

// ---- Auth Store (persisted & decoupled) ----
export { useAuthStore, AuthStoreState } from './useAuthStore';


// useVitalStore.ts
// Zustand store – State Management cho toàn bộ app

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from './useThemeStore';

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
  created_at: string;
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

  setVitals: (data: Partial<VitalData>) => void;
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
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
  addDeviceGroup: (groupName: string) => void;
  updateDeviceGroup: (oldName: string, newName: string, deviceIds?: string[]) => void;
  removeDeviceGroup: (groupName: string) => void;
  assignDevicesToGroup: (deviceIds: string[], groupName: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;

  acknowledgeIncident: (id: string, noteOrOperator?: string, operatorName?: string) => void;
  isSirenActive: boolean;
  setSirenActive: (active: boolean) => void;
  fetchVitals: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  syncAllWithBackend: () => Promise<void>;
  alarmSnooze: any;
  setAlarmSnooze: (val: any) => void;
  cancelAlarmSnooze: () => void;
  todayReminders: any;
  fetchSystemMode: () => Promise<void>;
  fetchReminders: () => Promise<void>;
  patientRecord: any;
  fetchPatientRecord: (patientId?: any) => Promise<any>;
  isLoadingPatient: boolean;
}

type VitalSet = (
  partial:
    | VitalStoreState
    | Partial<VitalStoreState>
    | ((state: VitalStoreState) => VitalStoreState | Partial<VitalStoreState>),
  replace?: boolean
) => void;

const createVitalStore: StateCreator<VitalStoreState> = (set: VitalSet, get: any) => ({
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
    id: 'cam-ranger-2c',
    name: 'Camera Phòng Ngủ - Hub #01',
    room: 'Phòng ngủ',
    isOnline: true,
    isSleep: false,
    isAIProtect: true,
    resolution: 'HD',
    sdCardStatus: 'OK',
    wifiStrength: 3,
    streamUrl: 'http://10.0.2.2:8080',
  },
  selectedDate: '09/07',
  algoSettings: {
    maxHeartRate: 120,
    minHeartRate: 50,
    minSpO2: 90,
    maxTemp: 37.8,
    fallAngle: 60,
    immobilitySec: 30,
  },

  setVitals: (data: Partial<VitalData>) =>
    set((state: VitalStoreState) => ({
      currentVitals: { ...state.currentVitals, ...data },
    })),

  setIncidents: (incidents: Incident[]) => set({ incidents }),

  addIncident: (incident: Incident) =>
    set((state: VitalStoreState) => ({
      incidents: [incident, ...state.incidents].slice(0, 100),
    })),

  setActiveDevice: (device: Device | null) => set({ activeDevice: device }),
  setConnected: (connected: boolean) => set({ isConnected: connected }),

  setHouseMode: (mode: 'AWAY' | 'HOME' | 'DISARM' | 'ALARM' | 'PRIVACY') =>
    set((state) => ({ house: { ...state.house, currentMode: mode } })),

  updateHouseAddress: (address: string) =>
    set((state) => ({ house: { ...state.house, address } })),

  toggleCameraSleep: () =>
    set((state) => ({
      camera: { ...state.camera, isSleep: !state.camera.isSleep },
    })),

  toggleCameraAIProtect: () =>
    set((state) => ({
      camera: { ...state.camera, isAIProtect: !state.camera.isAIProtect },
    })),

  setCameraResolution: (res: 'HD' | 'BASIC') =>
    set((state) => ({ camera: { ...state.camera, resolution: res } })),

  setSelectedDate: (date: string) => set({ selectedDate: date }),

  updateAlgoSettings: (settings) =>
    set((state) => ({
      algoSettings: { ...state.algoSettings, ...settings },
    })),

  iotDevices: [
    {
      id: 'dev-01',
      name: 'Orange Pi 5 - Edge AI Hub',
      sub: 'Rockchip RK3588S NPU • 32 FPS YOLO-Pose • EMQX MQTT',
      type: 'hub',
      status: 'Trực tuyến (24/7)',
      isOnline: true,
      icon: 'server',
      color: '#0284C7',
      location: 'Phòng khách',
    },
    {
      id: 'dev-02',
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
      id: 'dev-03',
      name: 'Vòng đeo tay BLE Smartband',
      sub: 'Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập',
      type: 'watch',
      status: 'Pin 84% • Đang đeo',
      isOnline: true,
      icon: 'watch',
      color: '#10B981',
      location: 'Phòng ngủ',
    },
    {
      id: 'dev-04',
      name: 'Cảm biến hồng ngoại AMG8833',
      sub: 'Ma trận nhiệt 8x8 IR • Sàng lọc sốt vùng trán',
      type: 'thermal',
      status: '36.8°C • Hoạt động tốt',
      isOnline: true,
      icon: 'thermometer',
      color: '#F59E0B',
      location: 'Phòng khách',
    },
    {
      id: 'dev-05',
      name: 'Micro AI âm thanh YAMNet',
      sub: 'Phát hiện tiếng kêu cứu, la hét, tiếng ngã đập mạnh',
      type: 'audio',
      status: 'Đang lắng nghe',
      isOnline: true,
      icon: 'mic',
      color: '#8B5CF6',
      location: 'Phòng ngủ',
    },
    {
      id: 'dev-06',
      name: 'Loa thông minh Hub (Voice Reminder)',
      sub: 'Phát giọng nói tiếng Việt nhắc nhở người cao tuổi (FR12)',
      type: 'speaker',
      status: 'Sẵn sàng',
      isOnline: true,
      icon: 'volume-high',
      color: '#EC4899',
      location: 'Phòng khách',
    },
  ],

  deviceGroups: ['Phòng khách', 'Phòng ngủ', 'Nhà tắm & Cửa'],

  addIoTDevice: (device: IoTDeviceItem) =>
    set((state) => ({
      iotDevices: [device, ...state.iotDevices],
    })),

  addDeviceGroup: (groupName: string) =>
    set((state) => {
      const trimmed = groupName.trim();
      if (!trimmed) return state;
      const exists = state.deviceGroups.some(
        (g) => g.trim().toLowerCase() === trimmed.toLowerCase()
      );
      return {
        deviceGroups: exists ? state.deviceGroups : [...state.deviceGroups, trimmed],
      };
    }),

  updateDeviceGroup: (oldName: string, newName: string, deviceIds?: string[]) =>
    set((state) => {
      const trimmedNew = newName.trim();
      const trimmedOld = oldName.trim();
      const updatedGroups = state.deviceGroups.map((g) =>
        g.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : g
      );
      let updatedDevices = state.iotDevices;
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
      return {
        deviceGroups: updatedGroups,
        iotDevices: updatedDevices,
      };
    }),

  removeDeviceGroup: (groupName: string) =>
    set((state) => ({
      deviceGroups: state.deviceGroups.filter(
        (g) => g.trim().toLowerCase() !== groupName.trim().toLowerCase()
      ),
      iotDevices: state.iotDevices.map((dev) =>
        dev.location?.trim().toLowerCase() === groupName.trim().toLowerCase()
          ? { ...dev, location: 'Chưa nhóm' }
          : dev
      ),
    })),

  assignDevicesToGroup: (deviceIds: string[], groupName: string) =>
    set((state) => ({
      iotDevices: state.iotDevices.map((dev) =>
        deviceIds.includes(dev.id) ? { ...dev, location: groupName } : dev
      ),
    })),

  isDarkMode: useThemeStore.getState().isDarkMode,
  toggleDarkMode: () => {
    useThemeStore.getState().toggleTheme();
    set((state) => ({ isDarkMode: !state.isDarkMode }));
  },
  setDarkMode: (isDark: boolean) => {
    useThemeStore.getState().setDarkMode(isDark);
    set({ isDarkMode: isDark });
  },

  acknowledgeIncident: (id: string, noteOrOperator?: string, operatorName?: string) => {
    const operator = operatorName || noteOrOperator || 'Người chăm sóc';
    set((state) => ({
      incidents: state.incidents.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              is_acknowledged: true,
              acknowledged_by: operator,
              acknowledged_at: new Date().toISOString(),
            }
          : inc
      ),
    }));
  },
  isSirenActive: false,
  setSirenActive: (active: boolean) => set({ isSirenActive: active }),
  fetchVitals: async () => {
    try {
      const activeDev = get ? get().activeDevice : null;
      const deviceId = activeDev?.device_id || 'dev-001';
      const { vitalsApi } = await import('../services/api');
      const res = await vitalsApi.getLatest(deviceId);
      if (res.data) {
        set((state) => ({
          currentVitals: {
            ...state.currentVitals,
            heart_rate: res.data.heart_rate ?? state.currentVitals.heart_rate,
            spo2: res.data.spo2 ?? state.currentVitals.spo2,
            skin_temp_max: res.data.skin_temp_max ?? state.currentVitals.skin_temp_max,
            fall_detected: res.data.fall_detected ?? state.currentVitals.fall_detected,
            person_count: res.data.person_count ?? state.currentVitals.person_count,
            timestamp: res.data.timestamp ? new Date(res.data.timestamp).getTime() : Date.now(),
          },
        }));
      }
    } catch {
      // Keep existing vitals
    }
  },
  fetchNotifications: async () => {
    try {
      const { incidentsApi } = await import('../services/api');
      const res = await incidentsApi.list();
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        set({ incidents: res.data });
      }
    } catch {
      // Keep existing incidents
    }
  },
  syncAllWithBackend: async () => {
    try {
      await Promise.allSettled([
        get().fetchVitals(),
        get().fetchNotifications(),
        get().fetchReminders(),
        get().fetchSystemMode(),
      ]);
    } catch {
      // Ignore sync error
    }
  },
  alarmSnooze: { active: false, durationMinutes: 15, mode: 'VIBRATE', syncAll: true, until: null },
  setAlarmSnooze: (val: any) => set({ alarmSnooze: val }),
  cancelAlarmSnooze: () =>
    set({
      alarmSnooze: { active: false, durationMinutes: 15, mode: 'VIBRATE', syncAll: true, until: null },
    }),
  todayReminders: {
    medications: [
      { name: 'Uống thuốc tim mạch (Digoxin 0.25mg)', time: '08:00', taken: true },
      { name: 'Uống canxi & Vitamin D3', time: '12:00', taken: true },
      { name: 'Đo huyết áp & đường huyết', time: '15:00', taken: true },
      { name: 'Uống thuốc huyết áp (Amlodipine 5mg)', time: '18:30', taken: false },
    ],
  },
  fetchSystemMode: async () => {},
  fetchReminders: async () => {},
  patientRecord: {
    name: 'Nguyễn Văn An',
    birth_year: '1948',
    age: 78,
    gender: 'Nam',
    blood_type: 'O+',
    height_cm: 165,
    weight_kg: 62,
    conditions: [
      { id: '1', name: 'Tăng huyết áp vô căn (Grade 2)', severity: 'warning', note: 'Uống thuốc đều đặn' },
      { id: '2', name: 'Đái tháo đường Type 2', severity: 'warning', note: 'Kiểm soát đường huyết sau ăn' },
    ],
    drug_allergies: 'Penicillin, Aspirin',
    food_allergies: 'Hải sản (Tôm, Cua)',
    dietary_notes: 'Giảm muối dưới 5g/ngày, hạn chế chất béo bão hòa',
    doctor_name: 'BS. Trần Văn Minh',
    doctor_phone: '0905 111 222',
    doctor_specialty: 'Tim mạch Can thiệp & Lão khoa',
    hospital: 'Bệnh viện Đa khoa Đà Nẵng',
    next_appointment: '2026-10-25 09:00',
  },
  fetchPatientRecord: async (patientId?: any) => {
    return get().patientRecord;
  },
  isLoadingPatient: false,
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

// ---- Auth Store (persisted) ----
interface AuthStoreState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  user_id: number | string | null;
  userName: string | null;
  full_name: string | null;
  userEmail: string | null;
  userPhone: string | null;
  phone_number: string | null;
  role: string;
  household_id: number | string | null;
  viewRole: 'family' | 'doctor';

  login: (access: string, refresh: string, name: string, userId: string, emailOrPhone?: string, role?: string) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (id: string, email?: string, name?: string, phone?: string) => void;
  setProfile: (profile: {
    user_id?: number | string;
    full_name?: string;
    phone_number?: string;
    role?: string;
    household_id?: number | string;
  }) => void;
  updateUserName: (arg1: string, arg2?: string) => void;
  toggleViewRole: () => void;
  logout: () => void;
}

type AuthSet = (
  partial:
    | AuthStoreState
    | Partial<AuthStoreState>
    | ((state: AuthStoreState) => AuthStoreState | Partial<AuthStoreState>),
  replace?: boolean
) => void;

const createAuthStore: StateCreator<AuthStoreState, [], [['zustand/persist', AuthStoreState]]> = (
  set: AuthSet
) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  user_id: null,
  userName: null,
  full_name: null,
  userEmail: null,
  userPhone: null,
  phone_number: null,
  role: 'family',
  household_id: null,
  viewRole: 'family',

  login: (access: string, refresh: string, name: string, userId: string, emailOrPhone?: string, role?: string) => {
    const isEmail = emailOrPhone?.includes('@');
    set({
      accessToken: access,
      refreshToken: refresh,
      userId,
      user_id: userId,
      userName: name,
      full_name: name,
      userEmail: isEmail ? emailOrPhone : null,
      userPhone: !isEmail ? (emailOrPhone || null) : null,
      phone_number: !isEmail ? (emailOrPhone || null) : null,
      role: role || 'family',
      viewRole: role === 'doctor' ? 'doctor' : 'family',
    });
  },

  setTokens: (access: string, refresh: string) =>
    set({ accessToken: access, refreshToken: refresh }),

  setUser: (id: string, email?: string, name?: string, phone?: string) =>
    set((state) => ({
      userId: id,
      user_id: id,
      userEmail: email ?? state.userEmail ?? null,
      userName: name ?? state.userName ?? null,
      full_name: name ?? state.full_name ?? null,
      userPhone: phone ?? state.userPhone ?? null,
      phone_number: phone ?? state.phone_number ?? null,
    })),

  setProfile: (profile) =>
    set((state) => ({
      userId: profile.user_id !== undefined ? String(profile.user_id) : state.userId,
      user_id: profile.user_id !== undefined ? profile.user_id : state.user_id,
      userName: profile.full_name || state.userName,
      full_name: profile.full_name || state.full_name,
      userPhone: profile.phone_number || state.userPhone,
      phone_number: profile.phone_number || state.phone_number,
      role: profile.role || state.role,
      household_id: profile.household_id !== undefined ? profile.household_id : state.household_id,
      viewRole: profile.role === 'doctor' ? 'doctor' : state.viewRole,
    })),

  updateUserName: (arg1: string, arg2?: string) => {
    if (arg2 !== undefined) {
      set({ userId: arg1, user_id: arg1, userName: arg2, full_name: arg2 });
    } else {
      set({ userName: arg1, full_name: arg1 });
    }
  },

  toggleViewRole: () =>
    set((state) => ({
      viewRole: state.viewRole === 'doctor' ? 'family' : 'doctor',
    })),

  logout: () =>
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      user_id: null,
      userName: null,
      full_name: null,
      userEmail: null,
      userPhone: null,
      phone_number: null,
      role: 'family',
      household_id: null,
      viewRole: 'family',
    }),
});

const persistOptions: PersistOptions<AuthStoreState> = {
  name: 'auth-storage',
  storage: createJSONStorage(() => AsyncStorage),
};

export const useAuthStore = create<AuthStoreState>()(
  persist(createAuthStore, persistOptions)
);

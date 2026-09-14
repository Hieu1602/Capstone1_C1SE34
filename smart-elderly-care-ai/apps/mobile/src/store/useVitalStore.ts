// useVitalStore.ts
// Zustand store – State Management cho toàn bộ app

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---- Types ----
export interface VitalData {
  heart_rate: number | null;
  spo2: number | null;
  skin_temp_max: number | null;
  person_count: number | null;
  fall_detected: boolean;
  timestamp: number | null;
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
  currentMode: 'AWAY' | 'HOME' | 'PRIVACY';
}

export interface CameraDevice {
  id: string;
  name: string;
  room: string;
  isOnline: boolean;
  isSleep: boolean;
  isAIProtect: boolean;
  resolution: '2K' | 'FHD' | 'SD';
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
  setHouseMode: (mode: 'AWAY' | 'HOME' | 'PRIVACY') => void;
  updateHouseAddress: (address: string) => void;
  toggleCameraSleep: () => void;
  toggleCameraAIProtect: () => void;
  setCameraResolution: (res: '2K' | 'FHD' | 'SD') => void;
  setSelectedDate: (date: string) => void;
  updateAlgoSettings: (settings: Partial<VitalStoreState['algoSettings']>) => void;
  addIoTDevice: (device: IoTDeviceItem) => void;
}

type VitalSet = (
  partial:
    | VitalStoreState
    | Partial<VitalStoreState>
    | ((state: VitalStoreState) => VitalStoreState | Partial<VitalStoreState>),
  replace?: boolean
) => void;

const createVitalStore: StateCreator<VitalStoreState> = (set: VitalSet) => ({
  currentVitals: {
    heart_rate: 74,
    spo2: 98,
    skin_temp_max: 36.8,
    person_count: 1,
    fall_detected: false,
    timestamp: Date.now(),
  },
  incidents: [
    {
      id: 'inc-01',
      device_id: 'hub-001',
      alert_type: 'PERSON_DETECTED',
      alert_level: 'LOW',
      message: 'Đã phát hiện người',
      video_clip_url: null,
      thumbnail_url: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=300&q=80',
      is_acknowledged: true,
      created_at: '2026-09-07T17:35:22Z',
    },
    {
      id: 'inc-02',
      device_id: 'hub-001',
      alert_type: 'PERSON_DETECTED',
      alert_level: 'LOW',
      message: 'Đã phát hiện người',
      video_clip_url: null,
      thumbnail_url: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?w=300&q=80',
      is_acknowledged: true,
      created_at: '2026-09-07T17:31:44Z',
    },
    {
      id: 'inc-03',
      device_id: 'hub-001',
      alert_type: 'FALL_DETECTED',
      alert_level: 'CRITICAL',
      message: '🚨 Cảnh báo té ngã (Fall Detected) - Clip 5s trích xuất RAM',
      video_clip_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=300&q=80',
      is_acknowledged: false,
      created_at: '2026-09-07T17:18:04Z',
    },
    {
      id: 'inc-04',
      device_id: 'hub-001',
      alert_type: 'HIGH_HEART_RATE',
      alert_level: 'HIGH',
      message: 'Nhịp tim bất thường cao: 128 bpm',
      video_clip_url: null,
      thumbnail_url: null,
      is_acknowledged: false,
      created_at: '2026-09-07T16:45:10Z',
    },
    {
      id: 'inc-05',
      device_id: 'hub-001',
      alert_type: 'ACOUSTIC_DISTRESS',
      alert_level: 'CRITICAL',
      message: 'Phát hiện âm thanh cầu cứu: "Cứu tôi với!"',
      video_clip_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=300&q=80',
      is_acknowledged: false,
      created_at: '2026-09-07T15:20:00Z',
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
    currentMode: 'AWAY',
  },
  camera: {
    id: 'cam-ranger-2c',
    name: 'SECA_001',
    room: 'Phòng khách',
    isOnline: true,
    isSleep: false,
    isAIProtect: true,
    resolution: '2K',
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

  setHouseMode: (mode: 'AWAY' | 'HOME' | 'PRIVACY') =>
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

  setCameraResolution: (res: '2K' | 'FHD' | 'SD') =>
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

  addIoTDevice: (device: IoTDeviceItem) =>
    set((state) => ({
      iotDevices: [device, ...state.iotDevices],
    })),
});

export const useVitalStore = create<VitalStoreState>()(createVitalStore);

// ---- Auth Store (persisted) ----
interface AuthStoreState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;

  setTokens: (access: string, refresh: string) => void;
  setUser: (id: string, email: string, name: string) => void;
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
  userEmail: null,
  userName: null,

  setTokens: (access: string, refresh: string) =>
    set({ accessToken: access, refreshToken: refresh }),

  setUser: (id: string, email: string, name: string) =>
    set({ userId: id, userEmail: email, userName: name }),

  logout: () =>
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      userEmail: null,
      userName: null,
    }),
});

const persistOptions: PersistOptions<AuthStoreState> = {
  name: 'auth-storage',
  storage: createJSONStorage(() => AsyncStorage),
};

export const useAuthStore = create<AuthStoreState>()(
  persist(createAuthStore, persistOptions)
);

// useHealthStore.ts
// Domain Store: Vitals streaming, sensor data, algo settings
// Tách từ useVitalStore.ts (Single Responsibility Principle)

import { create } from 'zustand';
import { vitalsApi, systemApi } from '../services/api';

// ---- Types ----
export interface VitalData {
  heart_rate: number | null;
  spo2: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  skin_temp_max: number | null;
  person_count: number | null;
  fall_detected: boolean;
  timestamp: number | null;
  acoustic_status?: string;
  bracelet_battery?: number | null;
  bracelet_connected?: boolean;
  edge_hub_connected?: boolean;
}

export interface AlgoSettings {
  maxHeartRate: number;
  minHeartRate: number;
  minSpO2: number;
  maxBpSystolic?: number;
  minBpSystolic?: number;
  maxBpDiastolic?: number;
  minBpDiastolic?: number;
  maxTemp: number;
  fallAngle: number;
  immobilitySec: number;
}

interface HealthState {
  currentVitals: VitalData;
  isConnected: boolean;
  selectedDate: string;
  algoSettings: AlgoSettings;
  isLoadingVitals: boolean;
  isLoadingMode: boolean;

  // Actions
  fetchVitals: () => Promise<VitalData | null>;
  fetchSystemMode: () => Promise<{ mode: string; is_mute_alarm: boolean; is_camera_privacy: boolean } | null>;
  setVitals: (data: Partial<VitalData>) => void;
  setConnected: (connected: boolean) => void;
  setSelectedDate: (date: string) => void;
  updateAlgoSettings: (settings: Partial<AlgoSettings>) => void;
}

export const useHealthStore = create<HealthState>()((set, get) => ({
  currentVitals: {
    heart_rate: null,
    spo2: null,
    bp_systolic: null,
    bp_diastolic: null,
    skin_temp_max: null,
    person_count: null,
    fall_detected: false,
    timestamp: null,
    acoustic_status: 'Bình thường',
    bracelet_battery: null,
    bracelet_connected: false,
    edge_hub_connected: false,
  },
  isConnected: true,
  selectedDate: '09/07',
  algoSettings: {
    maxHeartRate: 120,
    minHeartRate: 50,
    minSpO2: 90,
    maxBpSystolic: 140,
    minBpSystolic: 90,
    maxBpDiastolic: 90,
    minBpDiastolic: 60,
    maxTemp: 37.8,
    fallAngle: 60,
    immobilitySec: 30,
  },
  isLoadingVitals: false,
  isLoadingMode: false,

  fetchVitals: async () => {
    set({ isLoadingVitals: true });
    try {
      const res = await vitalsApi.getCurrent();
      if (res.data) {
        const d = res.data;
        const updatedVitals: VitalData = {
          heart_rate: d.heart_rate ?? null,
          spo2: d.spo2 ?? null,
          bp_systolic: d.bp_systolic ?? null,
          bp_diastolic: d.bp_diastolic ?? null,
          skin_temp_max: d.skin_temp_max ?? d.body_temp ?? null,
          person_count: d.person_count ?? 0,
          fall_detected: Boolean(d.fall_detected),
          timestamp: d.timestamp ?? Date.now(),
          acoustic_status: d.sound ?? 'Bình thường',
          bracelet_battery: d.bracelet_battery ?? null,
          bracelet_connected: d.bracelet_connected !== undefined ? Boolean(d.bracelet_connected) : true,
          edge_hub_connected: d.edge_hub_connected !== undefined ? Boolean(d.edge_hub_connected) : true,
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
        set({ isLoadingMode: false });
        return res.data;
      }
    } catch (e) {
      console.warn('fetchSystemMode API fallback:', e);
    }
    set({ isLoadingMode: false });
    return null;
  },

  setVitals: (data: Partial<VitalData>) =>
    set((state) => ({ currentVitals: { ...state.currentVitals, ...data } })),

  setConnected: (connected: boolean) => set({ isConnected: connected }),

  setSelectedDate: (date: string) => set({ selectedDate: date }),

  updateAlgoSettings: (settings: Partial<AlgoSettings>) =>
    set((state) => ({ algoSettings: { ...state.algoSettings, ...settings } })),
}));

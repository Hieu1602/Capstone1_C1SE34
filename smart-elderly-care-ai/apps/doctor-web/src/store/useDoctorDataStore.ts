// src/store/useDoctorDataStore.ts
// Quản lý và lưu trữ dữ liệu tập trung (Global Cache + LocalStorage + Stale-While-Revalidate)
// Cho phép chuyển đổi tab Trang chủ, Lịch khám, Danh sách bệnh nhân với độ trễ 0ms

import { create } from 'zustand';
import { DoctorPatientCard, AppointmentItem, HouseInvite, Incident } from '../types';
import { doctorApi, householdApi, incidentsApi } from '../services/api';

const STORAGE_KEYS = {
  PATIENTS: 'seca_cache_patients',
  APPOINTMENTS: 'seca_cache_appointments',
  INVITES: 'seca_cache_invites',
  INCIDENTS: 'seca_cache_incidents',
  CLINICAL_INCIDENTS: 'seca_cache_clinical_incidents',
  TIMESTAMP: 'seca_cache_timestamp',
};

const getStorageItem = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const setStorageItem = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

// Biến lưu trữ in-flight promise để tránh gọi API trùng lặp khi nhiều component cùng mount
let inFlightFetchAll: Promise<void> | null = null;
let inFlightFetchPatients: Promise<DoctorPatientCard[]> | null = null;
let inFlightFetchAppointments: Promise<AppointmentItem[]> | null = null;

interface DoctorDataState {
  patients: DoctorPatientCard[];
  appointments: AppointmentItem[];
  invites: HouseInvite[];
  incidents: Incident[];
  clinicalIncidents: Incident[];

  isLoading: boolean;
  isLoadingPatients: boolean;
  isLoadingAppointments: boolean;
  isRevalidating: boolean;
  lastUpdated: number | null;

  // Actions
  fetchPatients: (force?: boolean) => Promise<DoctorPatientCard[]>;
  fetchAppointments: (force?: boolean) => Promise<AppointmentItem[]>;
  fetchAllData: (force?: boolean) => Promise<void>;

  setPatients: (patients: DoctorPatientCard[]) => void;
  setAppointments: (appointments: AppointmentItem[]) => void;
  setInvites: (invites: HouseInvite[]) => void;
  setIncidents: (incidents: Incident[]) => void;
  clearCache: () => void;
}

const initialPatients = getStorageItem<DoctorPatientCard[]>(STORAGE_KEYS.PATIENTS, []);
const initialAppointments = getStorageItem<AppointmentItem[]>(STORAGE_KEYS.APPOINTMENTS, []);
const initialInvites = getStorageItem<HouseInvite[]>(STORAGE_KEYS.INVITES, []);
const initialIncidents = getStorageItem<Incident[]>(STORAGE_KEYS.INCIDENTS, []);
const initialClinicalIncidents = getStorageItem<Incident[]>(STORAGE_KEYS.CLINICAL_INCIDENTS, []);
const initialTimestamp = getStorageItem<number | null>(STORAGE_KEYS.TIMESTAMP, null);

const hasCachedData = initialPatients.length > 0 || initialAppointments.length > 0;

export const useDoctorDataStore = create<DoctorDataState>((set, get) => ({
  patients: initialPatients,
  appointments: initialAppointments,
  invites: initialInvites,
  incidents: initialIncidents,
  clinicalIncidents: initialClinicalIncidents,

  // Nếu đã có cache từ trước thì isLoading = false ngay lập tức (0ms)
  isLoading: !hasCachedData,
  isLoadingPatients: initialPatients.length === 0,
  isLoadingAppointments: initialAppointments.length === 0,
  isRevalidating: false,
  lastUpdated: initialTimestamp,

  fetchAllData: async (force = false) => {
    // Nếu có request đang thực hiện, đợi hoàn tất rồi chạy thêm 1 lượt nếu force=true
    if (inFlightFetchAll) {
      if (!force) return inFlightFetchAll;
      await inFlightFetchAll.catch(() => {});
    }

    const { patients, appointments, lastUpdated } = get();
    const hasData = patients.length > 0 || appointments.length > 0;
    const isRecent = lastUpdated && Date.now() - lastUpdated < 15000;

    if (!force && hasData && isRecent) {
      return;
    }

    set({ isRevalidating: true, isLoading: !hasData });

    inFlightFetchAll = (async () => {
      try {
        // Thực hiện tất cả các request song song bằng Promise.all()
        const [patData, aptData, invData, incData, clinicalData] = await Promise.all([
          doctorApi.getPatients().catch((err) => {
            console.warn('[DoctorDataStore] Tải bệnh nhân thất bại:', err);
            return get().patients;
          }),
          doctorApi.getAppointments().catch((err) => {
            console.warn('[DoctorDataStore] Tải lịch khám thất bại:', err);
            return get().appointments;
          }),
          householdApi.getInvites().catch((err) => {
            console.warn('[DoctorDataStore] Tải lời mời thất bại:', err);
            return get().invites;
          }),
          incidentsApi.list(undefined, 100).catch((err) => {
            console.warn('[DoctorDataStore] Tải cảnh báo thất bại:', err);
            return get().incidents;
          }),
          incidentsApi.list(undefined, 500, 'doctor_analytics').catch((err) => {
            console.warn('[DoctorDataStore] Tải thống kê cảnh báo thất bại:', err);
            return get().clinicalIncidents;
          }),
        ]);

        const validPatients = Array.isArray(patData) ? patData : get().patients;
        const validAppointments = Array.isArray(aptData) ? aptData : get().appointments;
        const validInvites = Array.isArray(invData) ? invData : get().invites;
        const validIncidents = Array.isArray(incData) ? incData : get().incidents;
        const validClinicalIncidents = Array.isArray(clinicalData) ? clinicalData : get().clinicalIncidents;
        const now = Date.now();

        setStorageItem(STORAGE_KEYS.PATIENTS, validPatients);
        setStorageItem(STORAGE_KEYS.APPOINTMENTS, validAppointments);
        setStorageItem(STORAGE_KEYS.INVITES, validInvites);
        setStorageItem(STORAGE_KEYS.INCIDENTS, validIncidents);
        setStorageItem(STORAGE_KEYS.CLINICAL_INCIDENTS, validClinicalIncidents);
        setStorageItem(STORAGE_KEYS.TIMESTAMP, now);

        set({
          patients: validPatients,
          appointments: validAppointments,
          invites: validInvites,
          incidents: validIncidents,
          clinicalIncidents: validClinicalIncidents,
          isLoading: false,
          isLoadingPatients: false,
          isLoadingAppointments: false,
          isRevalidating: false,
          lastUpdated: now,
        });
      } finally {
        inFlightFetchAll = null;
        set({ isRevalidating: false, isLoading: false, isLoadingPatients: false, isLoadingAppointments: false });
      }
    })();

    return inFlightFetchAll;
  },

  fetchPatients: async (force = false) => {
    if (inFlightFetchPatients) {
      return inFlightFetchPatients;
    }

    const { patients } = get();
    if (!force && patients.length > 0) {
      // Revalidate in background without blocking
      get().fetchAllData();
      return patients;
    }

    inFlightFetchPatients = (async () => {
      try {
        set({ isLoadingPatients: patients.length === 0, isRevalidating: true });
        const res = await doctorApi.getPatients();
        const valid = Array.isArray(res) ? res : patients;
        setStorageItem(STORAGE_KEYS.PATIENTS, valid);
        set({ patients: valid, isLoadingPatients: false, isRevalidating: false });
        return valid;
      } catch (err) {
        console.warn('[DoctorDataStore] Lỗi tải bệnh nhân:', err);
        set({ isLoadingPatients: false, isRevalidating: false });
        return get().patients;
      } finally {
        inFlightFetchPatients = null;
      }
    })();

    return inFlightFetchPatients;
  },

  fetchAppointments: async (force = false) => {
    if (inFlightFetchAppointments) {
      return inFlightFetchAppointments;
    }

    const { appointments } = get();
    if (!force && appointments.length > 0) {
      get().fetchAllData();
      return appointments;
    }

    inFlightFetchAppointments = (async () => {
      try {
        set({ isLoadingAppointments: appointments.length === 0, isRevalidating: true });
        const res = await doctorApi.getAppointments();
        const valid = Array.isArray(res) ? res : appointments;
        setStorageItem(STORAGE_KEYS.APPOINTMENTS, valid);
        set({ appointments: valid, isLoadingAppointments: false, isRevalidating: false });
        return valid;
      } catch (err) {
        console.warn('[DoctorDataStore] Lỗi tải lịch khám:', err);
        set({ isLoadingAppointments: false, isRevalidating: false });
        return get().appointments;
      } finally {
        inFlightFetchAppointments = null;
      }
    })();

    return inFlightFetchAppointments;
  },

  setPatients: (patients) => {
    setStorageItem(STORAGE_KEYS.PATIENTS, patients);
    set({ patients, isLoadingPatients: false });
  },

  setAppointments: (appointments) => {
    setStorageItem(STORAGE_KEYS.APPOINTMENTS, appointments);
    set({ appointments, isLoadingAppointments: false });
  },

  setInvites: (invites) => {
    setStorageItem(STORAGE_KEYS.INVITES, invites);
    set({ invites });
  },

  setIncidents: (incidents) => {
    setStorageItem(STORAGE_KEYS.INCIDENTS, incidents);
    set({ incidents });
  },

  clearCache: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.PATIENTS);
      localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
      localStorage.removeItem(STORAGE_KEYS.INVITES);
      localStorage.removeItem(STORAGE_KEYS.INCIDENTS);
      localStorage.removeItem(STORAGE_KEYS.CLINICAL_INCIDENTS);
      localStorage.removeItem(STORAGE_KEYS.TIMESTAMP);
    }
    set({
      patients: [],
      appointments: [],
      invites: [],
      incidents: [],
      clinicalIncidents: [],
      isLoading: true,
      isLoadingPatients: true,
      isLoadingAppointments: true,
      isRevalidating: false,
      lastUpdated: null,
    });
  },
}));

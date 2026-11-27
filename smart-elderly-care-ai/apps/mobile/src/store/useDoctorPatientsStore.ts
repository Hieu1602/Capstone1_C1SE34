import { create } from 'zustand';
import { doctorApi } from '../services/api';
import {
  PatientCardData,
  PatientDetail,
  PrescriptionItem,
  extractPatientsArray,
  normalizePatientsList,
} from '../features/doctor/components/types';

interface DoctorPatientsState {
  patients: PatientCardData[];
  patientDetailsCache: Record<string, PatientDetail>;
  prescriptionsCache: Record<string, PrescriptionItem[]>;
  loading: boolean;
  lastFetchedAt: number | null;
  error: string | null;
  fetchPatients: () => Promise<PatientCardData[]>;
  setPatients: (items: PatientCardData[]) => void;
  setPatientDetailCache: (patientId: string, detail: PatientDetail) => void;
  setPrescriptionsCache: (patientId: string, items: PrescriptionItem[]) => void;
  reset: () => void;
}

let inFlightFetch: Promise<PatientCardData[]> | null = null;

export const useDoctorPatientsStore = create<DoctorPatientsState>((set, get) => ({
  patients: [],
  patientDetailsCache: {},
  prescriptionsCache: {},
  loading: false,
  lastFetchedAt: null,
  error: null,

  fetchPatients: async () => {
    if (inFlightFetch) return inFlightFetch;

    set({ loading: true, error: null });
    inFlightFetch = (async () => {
      try {
        const res = await doctorApi.getPatients();
        const rawArray = extractPatientsArray(res?.data);
        if (rawArray === null) {
          // Giữ nguyên dữ liệu đã có trong store nếu payload trả về undefined/sai format
          set({ error: 'Dữ liệu danh sách bệnh nhân không hợp lệ.' });
          return get().patients;
        }
        const normalized = normalizePatientsList(rawArray);
        set({
          patients: normalized,
          lastFetchedAt: Date.now(),
          error: null,
        });
        return normalized;
      } catch (err: any) {
        // Giữ nguyên dữ liệu đã có trong store khi API lỗi (401/403/500/network)
        set({
          error: err?.response?.data?.detail || err?.message || 'Không thể tải danh sách bệnh nhân.',
        });
        return get().patients;
      } finally {
        set({ loading: false });
        inFlightFetch = null;
      }
    })();

    return inFlightFetch;
  },

  setPatients: (items) => {
    set({ patients: items });
  },

  setPatientDetailCache: (patientId, detail) => {
    if (!patientId) return;
    set((state) => ({
      patientDetailsCache: {
        ...state.patientDetailsCache,
        [String(patientId)]: detail,
      },
    }));
  },

  setPrescriptionsCache: (patientId, items) => {
    if (!patientId) return;
    set((state) => ({
      prescriptionsCache: {
        ...state.prescriptionsCache,
        [String(patientId)]: items,
      },
    }));
  },

  reset: () => {
    inFlightFetch = null;
    set({
      patients: [],
      patientDetailsCache: {},
      prescriptionsCache: {},
      loading: false,
      lastFetchedAt: null,
      error: null,
    });
  },
}));

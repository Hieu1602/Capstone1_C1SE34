// usePatientStore.ts
// Domain Store: Patient medical record, reminders, face enrollment
// Tách từ useVitalStore.ts (Single Responsibility Principle)

import { create } from 'zustand';
import { remindersApi, patientApi } from '../services/api';

// ---- Types ----
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
  avatar_url?: string | null;
  has_face_enrolled?: boolean;
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

interface PatientState {
  patientRecord: PatientMedicalRecord | null;
  todayReminders: RemindersData | null;
  isLoadingReminders: boolean;
  isLoadingPatient: boolean;

  // Actions
  fetchReminders: () => Promise<RemindersData | null>;
  fetchPatientRecord: (patientId?: number) => Promise<PatientMedicalRecord | null>;
  enrollPatientFace: (patientId: number, formData: FormData) => Promise<any>;
}

export const usePatientStore = create<PatientState>()((set) => ({
  patientRecord: null,
  todayReminders: null,
  isLoadingReminders: false,
  isLoadingPatient: false,

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

  enrollPatientFace: async (patientId: number, formData: FormData) => {
    try {
      const res = await patientApi.enrollFace(patientId, formData);
      if (res.data) {
        set((state) => {
          if (!state.patientRecord) return state;
          return {
            patientRecord: {
              ...state.patientRecord,
              avatar_url: res.data.avatar_url,
              has_face_enrolled: true,
            },
          };
        });
        return res.data;
      }
    } catch (e) {
      console.warn('enrollPatientFace API error:', e);
      throw e;
    }
    return null;
  },
}));

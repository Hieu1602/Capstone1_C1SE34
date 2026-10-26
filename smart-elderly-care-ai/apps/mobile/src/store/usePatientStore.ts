/**
 * ============================================================================
 * TỆP: usePatientStore.ts
 * TÁC GIẢ: Phan Nguyễn Giáng My
 * MÔ TẢ:
 *   Domain Store quản lý hồ sơ bệnh án điện tử (Patient Medical Record),
 *   lịch nhắc uống thuốc & dinh dưỡng (Reminders) và đăng ký khuôn mặt AI
 *   (Face Enrollment) cho người cao tuổi.
 * ============================================================================
 */

import { create } from 'zustand';
import { remindersApi, patientApi } from '../services/api';

// ---- Định nghĩa kiểu dữ liệu (Types) ----
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
  target_date?: string;
  daily_vitals?: any[];
  daily_events?: any[];
}

export interface ReminderItem {
  id: string;
  name: string;
  time: string;
  session: 'MORNING' | 'NOON' | 'EVENING' | string;
  dose: string;
  purpose: string;
  taken: boolean;
  takenAt?: string;
  snoozedUntil?: string;
}

export interface RemindersData {
  date: string;
  total_medications: number;
  completed_medications: number;
  hub_voice_reminder_enabled: boolean;
  medications: ReminderItem[];
  meals: Array<{ name: string; time: string; completed: boolean; note: string }>;
}

export const DEFAULT_MEDICATIONS: ReminderItem[] = [
  {
    id: 'med-01',
    name: 'Amlodipine 5mg (Thuốc hạ huyết áp)',
    time: '07:30',
    session: 'MORNING',
    dose: '1 viên sau ăn sáng',
    purpose: 'Huyết áp',
    taken: true,
    takenAt: '07:35',
  },
  {
    id: 'med-02',
    name: 'Metformin 500mg (Thuốc tiểu đường)',
    time: '12:00',
    session: 'NOON',
    dose: '1 viên sau ăn trưa',
    purpose: 'Tiểu đường',
    taken: false,
  },
  {
    id: 'med-03',
    name: 'Atorvastatin 10mg (Thuốc mỡ máu & tim mạch)',
    time: '18:30',
    session: 'EVENING',
    dose: '1 viên sau ăn tối',
    purpose: 'Tim mạch',
    taken: false,
  },
  {
    id: 'med-04',
    name: 'Ginkgo Biloba 120mg (Bổ não, hỗ trợ giấc ngủ)',
    time: '21:00',
    session: 'EVENING',
    dose: '1 viên trước khi ngủ',
    purpose: 'Giấc ngủ',
    taken: false,
  },
];

interface PatientState {
  patientRecord: PatientMedicalRecord | null;
  todayReminders: RemindersData | null;
  isLoadingReminders: boolean;
  isLoadingPatient: boolean;

  // Actions
  fetchReminders: () => Promise<RemindersData | null>;
  markMedicationTaken: (idOrName: string, taken?: boolean, takenAt?: string) => Promise<void>;
  snoozeMedication: (idOrName: string, minutes?: number) => void;
  fetchPatientRecord: (patientId?: number | string, target_date?: string) => Promise<PatientMedicalRecord | null>;
  updatePatientRecord: (patientId: number | string, data: Partial<PatientMedicalRecord>) => Promise<PatientMedicalRecord | null>;
  enrollPatientFace: (patientId: number, formData: FormData) => Promise<any>;
}

export const usePatientStore = create<PatientState>()((set, get) => ({
  patientRecord: null,
  todayReminders: {
    date: new Date().toISOString().split('T')[0],
    total_medications: DEFAULT_MEDICATIONS.length,
    completed_medications: DEFAULT_MEDICATIONS.filter((m) => m.taken).length,
    hub_voice_reminder_enabled: true,
    medications: DEFAULT_MEDICATIONS,
    meals: [],
  },
  isLoadingReminders: false,
  isLoadingPatient: false,

  fetchReminders: async () => {
    set({ isLoadingReminders: true });
    try {
      const res = await remindersApi.getToday();
      if (res.data) {
        const meds = Array.isArray(res.data.medications) && res.data.medications.length > 0
          ? res.data.medications
          : (get().todayReminders?.medications || DEFAULT_MEDICATIONS);
        const completed = meds.filter((m: any) => m.taken).length;
        const normalized: RemindersData = {
          ...res.data,
          medications: meds,
          total_medications: meds.length,
          completed_medications: completed,
        };
        set({ todayReminders: normalized, isLoadingReminders: false });
        return normalized;
      }
    } catch (e) {
      console.warn('fetchReminders API fallback:', e);
    }
    set((state) => ({
      todayReminders: state.todayReminders || {
        date: new Date().toISOString().split('T')[0],
        total_medications: DEFAULT_MEDICATIONS.length,
        completed_medications: DEFAULT_MEDICATIONS.filter((m) => m.taken).length,
        hub_voice_reminder_enabled: true,
        medications: DEFAULT_MEDICATIONS,
        meals: [],
      },
      isLoadingReminders: false,
    }));
    return null;
  },

  markMedicationTaken: async (idOrName: string, taken: boolean = true, takenAt?: string) => {
    const timeStr = takenAt || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    set((state) => {
      const currentList = state.todayReminders?.medications && state.todayReminders.medications.length > 0
        ? state.todayReminders.medications
        : DEFAULT_MEDICATIONS;

      const updated = currentList.map((m) => {
        if (m.id === idOrName || m.name === idOrName) {
          return {
            ...m,
            taken,
            takenAt: taken ? timeStr : undefined,
          };
        }
        return m;
      });

      const completedCount = updated.filter((m) => m.taken).length;
      return {
        todayReminders: {
          date: state.todayReminders?.date || new Date().toISOString().split('T')[0],
          total_medications: updated.length,
          completed_medications: completedCount,
          hub_voice_reminder_enabled: state.todayReminders?.hub_voice_reminder_enabled ?? true,
          medications: updated,
          meals: state.todayReminders?.meals || [],
        },
      };
    });

    try {
      if (idOrName && !idOrName.startsWith('med-')) {
        await remindersApi.toggle(idOrName);
      }
    } catch {
      // offline fallback
    }
  },

  snoozeMedication: (idOrName: string, minutes: number = 15) => {
    const nextTime = new Date(Date.now() + minutes * 60000);
    const timeStr = nextTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    set((state) => {
      if (!state.todayReminders?.medications) return state;
      const updated = state.todayReminders.medications.map((m) => {
        if (m.id === idOrName || m.name === idOrName) {
          return { ...m, snoozedUntil: timeStr };
        }
        return m;
      });
      return {
        todayReminders: {
          ...state.todayReminders,
          medications: updated,
        },
      };
    });
  },

  fetchPatientRecord: async (patientId: number | string = 1, target_date?: string) => {
    set({ isLoadingPatient: true });
    try {
      const res = await patientApi.getMedicalRecord(patientId, target_date);
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

  updatePatientRecord: async (patientId: number | string = 1, data: Partial<PatientMedicalRecord>) => {
    // Cập nhật ngay vào state để giao diện phản hồi tức thì
    set((state) => ({
      patientRecord: state.patientRecord ? { ...state.patientRecord, ...data } : (data as PatientMedicalRecord),
    }));
    try {
      const res = await patientApi.updateMedicalRecord(patientId, data);
      if (res.data) {
        set((state) => ({
          patientRecord: state.patientRecord ? { ...state.patientRecord, ...res.data } : res.data,
        }));
        return res.data;
      }
    } catch (e) {
      console.warn('updatePatientRecord API fallback:', e);
    }
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

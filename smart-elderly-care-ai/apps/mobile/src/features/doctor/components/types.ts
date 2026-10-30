import { BASE_URL } from '../../../services/api';
// types.ts
// Các kiểu dữ liệu dùng chung cho phân hệ Doctor

export type SeverityType = 'danger' | 'warning' | 'info';

export interface ConditionItem {
  id: string;
  name: string;
  severity: SeverityType;
  note: string;
}

export interface PrescriptionItem {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  quantity?: string;
  frequency: string;
  schedule_times: string[];
  instructions: string;
  doctor_name: string;
  enable_speaker_reminder: boolean;
  created_at?: string;
}

export interface MedicationFormItem {
  id?: string;
  medication_name: string;
  quantity: string;
  dosage: string;
  frequency: string;
  schedule_times: string;
  instructions: string;
}

export interface PatientDetail {
  id: string;
  name?: string;
  age?: number;
  gender?: string;
  blood_type?: string;
  bmi?: number;
  avatar_url?: string;
  house_name?: string;
  house_address?: string;
  has_face_enrolled?: boolean;
  heart_rate?: number;
  spo2?: number;
  blood_pressure?: string;
  skin_temp_max?: number;
  doctor_notes?: string;
  next_appointment?: string;
  drug_allergies?: string;
  food_allergies?: string;
  dietary_notes?: string;
  conditions?: ConditionItem[];
}

export interface PatientOption {
  id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  deviceId: string;
  houseName?: string;
  bloodPressure?: string;
  heartRate?: number;
  spo2?: number;
  healthStatus?: 'NORMAL' | 'WARNING' | 'DANGER' | string;
  lastUpdated?: string;
}

export interface TrendItem {
  date: string;
  avg_heart_rate: number;
  avg_spo2: number;
  min_spo2: number;
  steps: number;
  bp?: string;
}

export interface AnalyticsData {
  daily_trends?: TrendItem[];
  hr_stability_score?: number;
  ai_summary?: string;
  avg_heart_rate?: number;
  min_heart_rate?: number;
  max_heart_rate?: number;
  avg_spo2?: number;
  min_spo2?: number;
  avg_skin_temp?: number;
  spo2_drops_count?: number;
}

export interface AppointmentItem {
  id: string;
  doctor_id?: string;
  doctor_name?: string;
  patient_id: string;
  patient_name: string;
  patient_avatar_url?: string | null;
  house_id?: string;
  visit_type?: string;
  scheduled_at: string;
  duration_minutes?: number;
  exam_type?: string;
  location?: string;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | string;
  clinical_notes?: string;
  instructions?: string;
  cancellation_reason?: string;
  recurrence_pattern?: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | string;
  recurrence_occurrences?: number;
  parent_recurring_id?: string;
  enable_speaker_reminder?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PatientCardData {
  id: string;
  name: string;
  birth_year: number;
  age: number;
  gender: string;
  avatar_url?: string | null;
  house_id: string;
  house_name: string;
  house_address?: string;
  medical_history?: string;
  emergency_contact_phone?: string;
  device_id: string;
  is_online: boolean;
  battery_level?: number;
  heart_rate?: number;
  spo2?: number;
  skin_temp_max?: number;
  blood_pressure?: string;
  blood_type?: string;
  health_status: 'NORMAL' | 'WARNING' | 'DANGER' | string;
  last_updated?: string;
}

export interface DoctorProfileInfo {
  name: string;
  degree: string;
  specialty: string;
  hospital: string;
  department: string;
  phone: string;
  avatarUri?: string | null;
  cchn_number?: string;
}

// Danh sách danh xưng hỗ trợ
export const STANDARD_PATIENT_NAMES: string[] = [];

// Hàm chuẩn hóa dữ liệu bệnh nhân thực tế từ API/Database (Không dùng dữ liệu ảo)
export const normalizePatientsList = (rawList: any[]): PatientCardData[] => {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [];
  }

  const currentYear = new Date().getFullYear();
  return rawList
    .filter((item: any) => item && (item.id || item.patient_id))
    .map((item: any) => {
      const raw = (item.name || item.full_name || item.patient_name || '').trim();
      const cleanName = raw
        ? raw.toLowerCase().startsWith('cụ ') || raw.toLowerCase().startsWith('bác ')
          ? raw
          : `Cụ ${raw}`
        : 'Bệnh nhân';

      const birthYear = item.birth_year ? Number(item.birth_year) : (item.age ? currentYear - Number(item.age) : 0);
      const age = item.age ? Number(item.age) : (birthYear > 0 ? currentYear - birthYear : 0);
      const rawGender = (item.gender || '').trim().toUpperCase();
      const gender = rawGender === 'MALE' ? 'Nam' : rawGender === 'FEMALE' ? 'Nữ' : item.gender || '';

      const avatarUrl =
        item.avatar_url ||
        (cleanName.includes('Nguyễn Văn A')
          ? '/static/faces/fc51dc68-3ea2-4394-ac4b-906364ae425d.jpg'
          : null);

      return {
        ...item,
        id: String(item.id || item.patient_id),
        name: cleanName,
        birth_year: birthYear,
        age,
        gender,
        house_id: item.house_id ? String(item.house_id) : '',
        house_name: item.house_name || '',
        house_address: item.house_address || '',
        device_id: item.device_id || '',
        emergency_contact_phone: item.emergency_contact_phone || '',
        avatar_url: avatarUrl,
        health_status: item.health_status || 'NORMAL',
        is_online: Boolean(item.is_online),
      };
    });
};


// Helper lấy URL ảnh đại diện chuẩn hóa cho người cao tuổi / bệnh nhân
export const getPatientAvatarUrl = (avatarUrl?: string | null): string | null => {
  if (!avatarUrl || typeof avatarUrl !== 'string' || avatarUrl.trim() === '') return null;
  const clean = avatarUrl.trim();
  if (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('data:') ||
    clean.startsWith('file:')
  ) {
    return clean;
  }
  const base = BASE_URL.replace(/\/api\/v1\/?$/, '');
  const path = clean.startsWith('/') ? clean : `/${clean}`;
  return `${base}${path}`;
};

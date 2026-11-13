// src/types/index.ts
// Các kiểu dữ liệu cốt lõi cho Doctor Web Portal

export interface DoctorUser {
  id: string;
  phone: string;
  full_name: string;
  role: 'doctor';
  email?: string;
  avatar_url?: string;
}

export type HealthStatus = 'NORMAL' | 'WARNING' | 'DANGER' | string;

export interface DoctorPatientCard {
  id: string;
  name: string;
  birth_year?: number;
  age: number;
  gender: string;
  avatar_url?: string | null;
  house_id: string;
  house_name: string;
  house_address?: string;
  medical_history?: string;
  emergency_contact_phone?: string;
  device_id?: string;
  is_online?: boolean;
  battery_level?: number;
  heart_rate?: number;
  spo2?: number;
  skin_temp_max?: number;
  blood_pressure?: string;
  blood_type?: string;
  health_status: HealthStatus;
  last_updated?: string;
}

export interface ConditionItem {
  id: string;
  name: string;
  severity: 'danger' | 'warning' | 'info';
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

export interface DoctorPatientDetail {
  id: string;
  name?: string;
  age?: number;
  gender?: string;
  blood_type?: string;
  bmi?: number;
  avatar_url?: string;
  house_name?: string;
  house_address?: string;
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
  prescriptions?: PrescriptionItem[];
}

export interface AppointmentItem {
  id: string;
  doctor_id?: string;
  doctor_name?: string;
  patient_id: string;
  patient_name: string;
  patient_avatar_url?: string | null;
  house_id?: string;
  visit_type?: 'CLINIC' | 'HOME' | 'HOME_VISIT' | string;
  scheduled_at: string;
  duration_minutes?: number;
  exam_type?: string;
  location?: string;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | string;
  clinical_notes?: string;
  instructions?: string;
  cancellation_reason?: string;
  recurrence_pattern?: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | string;
  enable_speaker_reminder?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TrendItem {
  date: string;
  avg_heart_rate: number;
  avg_spo2: number;
  min_spo2?: number;
  min_heart_rate?: number;
  max_heart_rate?: number;
  avg_skin_temp?: number;
  steps?: number;
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

export interface HouseInvite {
  id: string;
  house_id: string;
  house_name: string;
  inviter_name: string;
  message?: string;
  created_at?: string;
}


// api.ts
// Axios client setup – kết nối Frontend React Native với Backend FastAPI (http://localhost:8000/api/v1)

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

// Cấu hình BASE_URL tự động:
// - Nếu có biến EXPO_PUBLIC_API_URL thì dùng nó
// - Nếu chạy trên Web và truy cập qua LAN IP (ví dụ từ điện thoại): tự động kết nối API qua IP đó
// - Nếu chạy trên Web hoặc iOS simulator cục bộ: dùng http://localhost:8000/api/v1
// - Nếu chạy trên Android emulator: dùng http://10.0.2.2:8000/api/v1
const getBaseUrl = (): string => {
  // Khi chạy trên Web: Luôn dùng hostname hiện tại của trình duyệt (localhost hoặc LAN IP)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host}:8000/api/v1`;
  }
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://192.168.1.8:8000/api/v1';
};

export const BASE_URL: string = getBaseUrl();


const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Request Interceptor: Attach JWT token ----
api.interceptors.request.use(
  (config: import('axios').InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ---- Response Interceptor: Auto refresh token on 401 ----
api.interceptors.response.use(
  (response: import('axios').AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// ---- API Service Functions ----

export const authApi = {
  requestOtp: (phone: string) => api.post('/auth/request-otp', { phone }),
  verifyOtp: (phone: string, code: string) => api.post('/auth/verify-otp', { phone, code }),
  login: (phone: string, password: string) => {
    // Chuẩn OAuth2 Password Request quy định application/x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('username', phone);
    params.append('password', password);
    return api.post('/auth/login', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  register: (data: {
    phone: string;
    full_name: string;
    password: string;
    role: string;
  }) => api.post('/auth/register', data),
};

// 1. System Mode API
export const systemApi = {
  getMode: () => api.get('/system/mode'),
  updateMode: (data: {
    mode?: string;
    is_mute_alarm?: boolean;
    is_camera_privacy?: boolean;
    mute_mode?: string;
    duration_minutes?: number;
  }) => api.put('/system/mode', data),
};

// 2. Vitals API
export const vitalsApi = {
  getCurrent: () => api.get('/vitals/current'),
  getLatest: (deviceId: string) => api.get(`/vitals/${deviceId}/latest`),
  getHistory: (deviceId: string, limit = 100) =>
    api.get(`/vitals/${deviceId}/history`, { params: { limit } }),
  getStats: (deviceId: string, hours = 24) =>
    api.get(`/vitals/${deviceId}/stats`, { params: { hours } }),
};

// 3. Reminders API
export const remindersApi = {
  getToday: () => api.get('/reminders/today'),
};

// 4. Patients & Medical Record API
export const patientApi = {
  getMedicalRecord: (patientId: number = 1) =>
    api.get(`/patients/${patientId}/medical-record`),
  enrollFace: (patientId: number, formData: FormData) =>
    api.post(`/patients/${patientId}/face-enroll`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// 5. Notifications & Incidents API
export const incidentsApi = {
  list: (deviceId?: string, limit = 20) =>
    api.get('/notifications', { params: { device_id: deviceId, limit } }),
  get: (id: string) => api.get(`/incidents/${id}`),
  acknowledge: (id: string, notes?: string) =>
    api.post(`/incidents/${id}/acknowledge`, null, { params: { note: notes } }),
};

export const notificationsApi = incidentsApi;

// 6. Doctor Subsystem API
export const doctorApi = {
  getPatients: () => api.get('/doctor/patients'),
  getPatientDetail: (id: string) => api.get(`/doctor/patients/${id}`),
  getPrescriptions: (id: string) => api.get(`/doctor/patients/${id}/prescriptions`),
  createPrescription: (
    id: string,
    data: {
      medication_name: string;
      dosage: string;
      frequency?: string;
      schedule_times?: string[];
      instructions?: string;
      enable_speaker_reminder?: boolean;
    }
  ) => api.post(`/doctor/patients/${id}/prescriptions`, data),
  updatePrescription: (
    patientId: string,
    rxId: string,
    data: {
      medication_name?: string;
      dosage?: string;
      frequency?: string;
      schedule_times?: string[];
      instructions?: string;
      enable_speaker_reminder?: boolean;
    }
  ) => api.put(`/doctor/patients/${patientId}/prescriptions/${rxId}`, data),
  deletePrescription: (patientId: string, rxId: string) =>
    api.delete(`/doctor/patients/${patientId}/prescriptions/${rxId}`),
  togglePrescriptionReminder: (patientId: string, rxId: string) =>
    api.patch(`/doctor/patients/${patientId}/prescriptions/${rxId}/toggle-reminder`),
  updateMedicalRecord: (id: string, data: any) =>
    api.put(`/doctor/patients/${id}/medical-record`, data),
  getAnalytics: (id: string, days = 7) =>
    api.get(`/doctor/patients/${id}/analytics`, { params: { days } }),
  updateThresholds: (id: string, data: any) =>
    api.put(`/doctor/patients/${id}/thresholds`, data),
  getAppointments: (status?: string) =>
    api.get('/doctor/appointments', { params: status ? { status } : undefined }),
  createAppointment: (data: {
    patient_id: string;
    patient_name: string;
    scheduled_at: string;
    exam_type?: string;
    location?: string;
    instructions?: string;
    enable_speaker_reminder?: boolean;
  }) => api.post('/doctor/appointments', data),
  updateAppointment: (
    appointmentId: string,
    data: {
      scheduled_at?: string;
      exam_type?: string;
      location?: string;
      status?: string;
      instructions?: string;
      enable_speaker_reminder?: boolean;
    }
  ) => api.put(`/doctor/appointments/${appointmentId}`, data),
  deleteAppointment: (appointmentId: string) =>
    api.delete(`/doctor/appointments/${appointmentId}`),
};



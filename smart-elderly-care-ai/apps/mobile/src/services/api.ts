// api.ts
// Axios client setup – kết nối Frontend React Native với Backend FastAPI (http://localhost:8000/api/v1)

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';

// Cấu hình BASE_URL tự động:
// - Nếu có biến EXPO_PUBLIC_API_URL thì dùng nó
// - Nếu chạy trên Web và truy cập qua LAN IP: tự động kết nối API qua IP đó
// - Tự động trích xuất IP từ host của Metro Bundler (Expo Constants)
// - Fallback về IP máy tính hiện tại: 192.168.1.160
const getBaseUrl = (): string => {
  // 1. Khi chạy trên Web trình duyệt
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host}:8000/api/v1`;
  }

  // 2. Tự động nhận diện IP máy tính từ Expo Metro host (kết nối trực tiếp điện thoại thật qua LAN Wi-Fi)
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;

  if (debuggerHost) {
    const hostIp = debuggerHost.split(':')[0];
    if (hostIp && !hostIp.includes('exp.direct') && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:8000/api/v1`;
    }
  }

  // 3. Biến môi trường EXPO_PUBLIC_API_URL (nếu được chỉ định rõ và không trỏ vào localhost trên thiết bị thật)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // 4. Fallback về IP máy tính phát triển trong mạng nội bộ
  return 'http://192.168.1.160:8000/api/v1';
};

export const BASE_URL: string = getBaseUrl();

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Request Interceptor: Attach JWT token ----
api.interceptors.request.use(
  async (config: import('axios').InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      const language = await AsyncStorage.getItem('smartcare-user-language');
      if (language === 'en' || language === 'vi') {
        config.headers['Accept-Language'] = language;
      }
    } catch (error) {
      console.warn('[API] Could not load saved language preference:', error);
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
    const isAuthRoute =
      original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        }, {
          headers: {
            'Accept-Language': original.headers?.['Accept-Language'] || 'vi',
          },
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
    otp_code?: string;
  }) => api.post('/auth/register', data),
  resetPassword: (data: {
    phone: string;
    otp_code: string;
    new_password: string;
  }) => api.post('/auth/reset-password', data),
  requestPasswordResetOtp: (phone: string) =>
    api.post('/auth/password/request-otp', { phone }),
  completePasswordReset: (data: {
    phone: string;
    otp_code: string;
    new_password: string;
  }) => api.post('/auth/password/reset', data),
};

// 0. Users API
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: any) => api.patch('/users/me', data),
  updateLanguage: (language: 'vi' | 'en') =>
    api.patch('/users/me/language', { preferred_language: language, language }),
  updateFontPreferences: (fontSizeMode: 'system' | 'custom', customFontScale: number) =>
    api.patch('/users/me/font-preferences', {
      font_size_mode: fontSizeMode,
      custom_font_scale: customFontScale,
    }),
  changePassword: (data: {
    current_password: string;
    new_password: string;
    confirm_new_password: string;
  }) => api.patch('/users/me/password', data),
};

// API SOS báo cho các thành viên trong cùng hộ; app sẽ tự mở trình gọi 115.
export const emergencyApi = {
  triggerSOS: (data: {
    address?: string;
    latitude?: number;
    longitude?: number;
    message?: string;
  } = {}) => api.post('/emergency/sos', data),
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
  getHistory: (deviceId: string = 'BLE_BAND_001', limit = 100, target_date?: string) =>
    api.get('/vitals/history', { params: { device_id: deviceId, limit, target_date } }),
  getStats: (deviceId: string, hours = 24) =>
    api.get(`/vitals/${deviceId}/stats`, { params: { hours } }),
};

// 3. Reminders API
export const remindersApi = {
  getToday: () => api.get('/reminders/today'),
};

// 4. Patients & Medical Record API
export const patientApi = {
  getMedicalRecord: (patientId: number | string = 1, target_date?: string) =>
    api.get(`/patients/${patientId}/medical-record`, { params: { target_date } }),
  updateMedicalRecord: (patientId: number | string = 1, data: any) =>
    api.put(`/patients/${patientId}/medical-record`, data),
  getVitals: (patientId: number | string = 1, target_date?: string) =>
    api.get(`/patients/${patientId}/vitals`, { params: { target_date } }),
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

// 7. User & Household Profile API
export const userApi = {
  getMe: (params?: { phone?: string; user_id?: number }) => api.get('/users/me', { params }),
  updateProfile: (data: { full_name?: string; phone_number?: string }) => api.put('/users/me', data),
};

export const householdApi = {
  getMembers: (householdId: number | string = 1) => api.get(`/households/${householdId}/members`),
  addMember: (
    householdId: number | string = 1,
    data: { phone_number: string; role_in_house?: string; role?: string; full_name?: string }
  ) => api.post(`/households/${householdId}/members`, data),
  removeMember: (householdId: number | string = 1, memberId: number | string) =>
    api.delete(`/households/${householdId}/members/${memberId}`),
};

// 8. Chatbot AI API
export const chatbotApi = {
  chat: (data: { message: string; session_id?: string; context_window?: number; house_id?: string }) =>
    api.post('/chatbot/chat', data),
  getHealth: () => api.get('/chatbot/health'),
  getSessions: () => api.get('/chatbot/sessions'),
  getSessionDetail: (sessionId: string) => api.get(`/chatbot/sessions/${sessionId}`),
  deleteSession: (sessionId: string) => api.delete(`/chatbot/sessions/${sessionId}`),
  transcribeAudio: (formData: any) =>
    api.post('/chatbot/transcribe-audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};


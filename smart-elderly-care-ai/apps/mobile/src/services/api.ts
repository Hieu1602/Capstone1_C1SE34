// api.ts
// Axios client setup – kết nối Frontend React Native với Backend FastAPI (http://localhost:8000/api/v1)

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';

// Cấu hình BASE_URL tự động:
// - Ưu tiên EXPO_PUBLIC_API_URL nếu được khai báo
// - Nếu chạy trên Web: dùng 127.0.0.1 nếu là localhost để tránh xung đột IPv6 [::1] trên Windows
// - Tự động trích xuất IP từ host của Metro Bundler (Expo Constants)
// - Hỗ trợ Android Emulator (10.0.2.2)
// - Fallback về IP máy tính hiện tại: 192.168.1.7
const getBaseUrl = (): string => {
  // 1. Khi chạy trên Web trình duyệt: Tự động dùng host trình duyệt đang truy cập (tránh chết IP LAN khi DHCP đổi IP)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    const resolvedHost = (host === 'localhost' || host === '::1') ? '127.0.0.1' : host;
    return `http://${resolvedHost}:8000/api/v1`;
  }

  // 2. Biến môi trường EXPO_PUBLIC_API_URL cho Mobile (Expo Go / Device)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  // 3. Tự động nhận diện IP máy tính từ Expo Metro host (kết nối trực tiếp điện thoại thật qua LAN Wi-Fi)
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

  // 4. Nếu chạy trên Android Emulator
  return 'http://192.168.1.5:8000/api/v1';
};

export const BASE_URL: string = getBaseUrl();

export const setCustomServerUrl = async (url: string) => {
  let formatted = url.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `http://${formatted}`;
  }
  if (!formatted.endsWith('/api/v1')) {
    formatted = formatted.replace(/\/+$/, '') + '/api/v1';
  }
  api.defaults.baseURL = formatted;
  await AsyncStorage.setItem('custom_server_url', formatted);
  return formatted;
};

export const getCustomServerUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem('custom_server_url');
    if (saved && saved.trim()) {
      api.defaults.baseURL = saved.trim();
      return saved.trim();
    }
  } catch {}
  return api.defaults.baseURL || BASE_URL;
};


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
    try {
      const saved = await AsyncStorage.getItem('custom_server_url');
      if (saved && saved.trim()) {
        config.baseURL = saved.trim();
      }
    } catch {}

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
  logout: (userName?: string, role?: string) =>
    api.post('/auth/logout', { user_name: userName, role }).catch(() => {}),
  requestOtp: (phone: string) => api.post('/auth/request-otp', { phone }),
  verifyOtp: (phone: string, otp_code: string) => api.post('/auth/verify-otp', { phone, otp_code }),
  verifyCchn: (cchn_number: string, full_name: string) =>
    api.post('/auth/verify-cchn', { cchn_number, full_name }),
  login: (phone: string, password: string, clientLocation?: string) => {
    // Chuẩn OAuth2 Password Request quy định application/x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('username', phone);
    params.append('password', password);
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (clientLocation) {
      headers['x-client-location'] = encodeURIComponent(clientLocation);
    }
    return api.post('/auth/login', params.toString(), { headers });
  },
  register: (data: {
    phone: string;
    full_name: string;
    password: string;
    role: string;
    otp_code?: string;
  }) => api.post('/auth/register', data),
  registerDoctor: (data: {
    phone: string;
    full_name: string;
    password: string;
    role?: string;
    otp_code: string;
    cchn_number: string;
    workplace?: string;
    specialty?: string;
  }) => api.post('/auth/register-doctor', data),
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
  getTerminals: (clientLocation?: string) => {
    const headers: Record<string, string> = {};
    if (clientLocation) {
      headers['x-client-location'] = encodeURIComponent(clientLocation);
    }
    return api.get('/users/me/terminals', { headers });
  },
  deleteTerminal: (terminalId: string) => api.delete(`/users/me/terminals/${terminalId}`),
  getLoginHistory: (limit: number = 20) => api.get('/users/me/login-history', { params: { limit } }),
  getDevices: () => api.get('/users/me/terminals'),
  deleteDevice: (deviceId: string) => api.delete(`/users/me/terminals/${deviceId}`),
  uploadAvatar: (formData: any) =>
    api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadAvatarBase64: (base64: string) =>
    api.post('/users/me/avatar', { avatar_base64: base64 }),
  deleteAvatar: () => api.delete('/users/me/avatar'),
  getNotificationPreferences: () =>
    api.get('/users/me/notification-preferences'),
  updateNotificationPreferences: (preferences: {
    notifications_enabled?: boolean;
    alert_sound_enabled?: boolean;
    critical_alert_enabled?: boolean;
  }) =>
    api.patch('/users/me/notification-preferences', preferences),
};

// API SOS báo cho các thành viên trong cùng hộ; app sẽ tự mở trình gọi 115 hoặc tổng đài hỗ trợ 0898230852.
export const emergencyApi = {
  triggerSOS: (data: {
    address?: string;
    latitude?: number;
    longitude?: number;
    message?: string;
  } = {}) => api.post('/emergency/sos', data),
  requestSupportCall: (data: {
    topic?: string;
    note?: string;
  } = {}) => api.post('/emergency/support-call', data),
  getSupportHotline: () => api.get('/emergency/support-hotline'),
  reverseGeocode: (lat: number, lon: number) =>
    api.get<{ address: string | null }>(`/emergency/reverse-geocode?lat=${lat}&lon=${lon}`),
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
  createVital: (data: {
    device_id?: string;
    heart_rate?: number;
    spo2?: number;
    bp_systolic?: number;
    bp_diastolic?: number;
    skin_temp_max?: number;
    fall_detected?: boolean;
    raw_payload?: Record<string, any>;
  }) => api.post('/vitals', data),
};

// 3. Reminders API
export const remindersApi = {
  getToday: () => api.get('/reminders/today'),
  create: (data: any) => api.post('/reminders', data),
  toggle: (reminderId: string) => api.put(`/reminders/${reminderId}/toggle`),
  delete: (reminderId: string) => api.delete(`/reminders/${reminderId}`),
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
  getAppointments: (patientId: number | string = 1, status?: string) =>
    api.get(`/patients/${patientId}/appointments`, { params: status ? { status } : undefined }),
  confirmAppointment: (patientId: number | string, appointmentId: string) =>
    api.post(`/patients/${patientId}/appointments/${appointmentId}/confirm`),
};

// 5. Notifications & Incidents API
export const incidentsApi = {
  list: (deviceId?: string, limit = 20) =>
    api.get('/notifications', { params: { device_id: deviceId, limit } }),
  get: (id: string) => api.get(`/incidents/${id}`),
  acknowledge: (id: string, notes?: string) =>
    api.post(`/incidents/${id}/acknowledge`, null, { params: { note: notes } }),
  acknowledgeAll: () =>
    api.post('/incidents/acknowledge-all'),
};

export const notificationsApi = incidentsApi;

export interface AppointmentItem {
  id: string;
  doctor_id?: string;
  doctor_name?: string;
  patient_id: string;
  patient_name: string;
  house_id?: string;
  visit_type?: string;
  scheduled_at: string;
  duration_minutes?: number;
  location: string;
  clinical_notes?: string;
  instructions?: string;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  cancellation_reason?: string;
  recurrence_pattern?: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  parent_recurring_id?: string;
  enable_speaker_reminder?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AppointmentCreateData {
  patient_id: string;
  patient_name?: string;
  scheduled_at: string;
  duration_minutes?: number;
  visit_type?: string;
  location?: string;
  clinical_notes?: string;
  instructions?: string;
  enable_speaker_reminder?: boolean;
  recurrence_pattern?: string;
  recurrence_occurrences?: number;
}

export interface AppointmentUpdateData {
  scheduled_at?: string;
  duration_minutes?: number;
  visit_type?: string;
  location?: string;
  status?: string;
  clinical_notes?: string;
  instructions?: string;
  enable_speaker_reminder?: boolean;
}

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
      quantity?: string;
      frequency?: string;
      schedule_times?: string[];
      instructions?: string;
      enable_speaker_reminder?: boolean;
    }
  ) => api.post(`/doctor/patients/${id}/prescriptions`, data),
  createBatchPrescriptions: (
    id: string,
    data: {
      diagnosis?: string;
      general_notes?: string;
      enable_speaker_reminder?: boolean;
      medications: Array<{
        medication_name: string;
        quantity?: string;
        dosage: string;
        frequency?: string;
        schedule_times?: string[];
        instructions?: string;
      }>;
    }
  ) => api.post(`/doctor/patients/${id}/prescriptions/batch`, data),
  updatePrescription: (
    patientId: string,
    rxId: string,
    data: {
      medication_name?: string;
      dosage?: string;
      quantity?: string;
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
  getAppointments: (status?: string, patientId?: string) =>
    api.get('/doctor/appointments', { params: { ...(status ? { status } : {}), ...(patientId ? { patient_id: patientId } : {}) } }),
  createAppointment: (data: AppointmentCreateData) => api.post('/doctor/appointments', data),
  updateAppointment: (appointmentId: string, data: AppointmentUpdateData) =>
    api.put(`/doctor/appointments/${appointmentId}`, data),
  completeAppointment: (appointmentId: string) =>
    api.post(`/doctor/appointments/${appointmentId}/complete`),
  cancelAppointment: (appointmentId: string, data: { cancellation_reason: string }) =>
    api.post(`/doctor/appointments/${appointmentId}/cancel`, data),
  deleteAppointment: (appointmentId: string) =>
    api.delete(`/doctor/appointments/${appointmentId}`),
};

// 7. User & Household Profile API
export const userApi = {
  getMe: (params?: { phone?: string; user_id?: number }) => api.get('/users/me', { params }),
  updateProfile: (data: { full_name?: string; phone_number?: string }) => api.put('/users/me', data),
};

export const householdApi = {
  getMembers: (householdId: number | string = 'current') =>
    api.get(`/houses/${householdId}/members`),
  addMember: (
    householdId: number | string = 1,
    data: {
      phone_number: string;
      role_in_house?: string;
      role?: string;
      full_name?: string;
      can_view_health?: boolean;
      can_view_camera?: boolean;
      can_handle_emergency?: boolean;
      can_manage_devices?: boolean;
      can_manage_records?: boolean;
    }
  ) => api.post(`/houses/${householdId}/members`, data),
  updateMemberPermissions: (
    householdId: number | string = 'current',
    memberId: number | string,
    data: {
      role_in_house?: string;
      permissions?: string;
      can_view_health?: boolean;
      can_view_camera?: boolean;
      can_handle_emergency?: boolean;
      can_manage_devices?: boolean;
      can_manage_records?: boolean;
    }
  ) => api.patch(`/houses/${householdId}/members/${memberId}/permissions`, data),
  removeMember: (householdId: number | string = 1, memberId: number | string) =>
    api.delete(`/houses/${householdId}/members/${memberId}`),
  getMyPermissions: (householdId: number | string = 'current') =>
    api.get(`/houses/${householdId}/my-permissions`),
  joinHouse: (codeOrLink: string) =>
    api.post('/houses/join', { code: codeOrLink }),
};

export const houseApi = {
  getCurrent: () => api.get('/houses/current'),
  getCurrentHouse: () => api.get('/houses/current'),
  updateHouse: (data: { name?: string; address?: string; current_mode?: string }) =>
    api.patch('/houses/current', data),
  updateHouseMode: (mode: string) => api.patch('/houses/current/mode', { mode }),
  updateCurrent: (data: { name?: string; address?: string; current_mode?: string }) =>
    api.patch('/houses/current', data),
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

// 9. Health Reports API (Báo cáo sức khỏe tổng hợp thực tế từ backend)
export const reportsApi = {
  getSummary: (period: 'WEEK' | 'MONTH' = 'WEEK', patientId?: string, deviceId?: string) =>
    api.get('/reports/summary', { params: { period, patient_id: patientId, device_id: deviceId } }),
  getPdfUrl: (period: 'WEEK' | 'MONTH' = 'WEEK', patientId?: string, deviceId?: string) => {
    let url = `${BASE_URL}/reports/pdf?period=${period}`;
    if (patientId) url += `&patient_id=${encodeURIComponent(patientId)}`;
    if (deviceId) url += `&device_id=${encodeURIComponent(deviceId)}`;
    return url;
  },
  getExcelUrl: (period: 'WEEK' | 'MONTH' = 'WEEK', patientId?: string, deviceId?: string) => {
    let url = `${BASE_URL}/reports/excel?period=${period}`;
    if (patientId) url += `&patient_id=${encodeURIComponent(patientId)}`;
    if (deviceId) url += `&device_id=${encodeURIComponent(deviceId)}`;
    return url;
  },
};

// 10. Support & Documentation API (CSKH 24/7 & Hướng dẫn sử dụng)
export const supportApi = {
  getHotline: () => api.get('/support/hotline'),
  getDocumentation: () => api.get('/support/documentation'),
  getFaqs: () => api.get('/support/faq'),
  createTicket: (data: {
    topic: string;
    device_type?: string;
    phone?: string;
    note?: string;
  }) => api.post('/support/tickets', data),
  getMyTickets: () => api.get('/support/tickets/me'),
  requestCall: (data: { topic?: string; note?: string } = {}) =>
    api.post('/support/call', data),
};




// 11. System Notifications / Admin Broadcasts API
export interface SystemAnnouncement {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'system_maintenance' | 'emergency' | 'health_tip' | 'feature_update' | string;
  target_audience: 'all' | 'caregivers' | 'doctors' | 'elderly' | string;
  status: 'draft' | 'scheduled' | 'published' | 'revoked' | string;
  created_at?: string;
  published_at?: string;
  expires_at?: string;
}

export const adminBroadcastsApi = {
  getActive: (targetAudience?: string) =>
    api.get<SystemAnnouncement[]>('/system-notifications/broadcasts/active', {
      params: targetAudience ? { target_audience: targetAudience } : {},
    }),
};

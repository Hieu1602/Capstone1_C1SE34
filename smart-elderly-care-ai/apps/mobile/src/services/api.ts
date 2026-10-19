// api.ts
// Axios client setup – tất cả API calls đều qua file này

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/useVitalStore';

const defaultBaseUrl = Platform.OS === 'web'
  ? 'http://localhost:8000/api/v1'
  : Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/v1'
    : 'http://localhost:8000/api/v1';

const BASE_URL: string = (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) || defaultBaseUrl;

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
    const refreshToken = useAuthStore.getState().refreshToken;
    const isLoginRequest = original?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !original?._retry && !isLoginRequest && refreshToken) {
      original._retry = true;
      try {
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
  requestPasswordResetOtp: (phone: string) => api.post('/auth/password/request-otp', { phone }),
  resetPassword: (data: { phone: string; otp_code: string; new_password: string }) =>
    api.post('/auth/password/reset', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.patch('/users/me/password', data),
  login: (phone: string, password: string) => {
    // Use FormData for OAuth2 password flow (avoids URLSearchParams compatibility issues)
    const formData = new FormData();
    formData.append('username', phone);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  register: (data: {
    phone: string;
    full_name: string;
    password: string;
    role: string;
    otp_code: string;
  }) => api.post('/auth/register', data),
};

export const vitalsApi = {
  getLatest: (deviceId: string) =>
    api.get(`/vitals/${deviceId}/latest`),
  getHistory: (deviceId: string, limit = 100) =>
    api.get(`/vitals/${deviceId}/history`, { params: { limit } }),
  getStats: (deviceId: string, hours = 24) =>
    api.get(`/vitals/${deviceId}/stats`, { params: { hours } }),
};

export const incidentsApi = {
  list: (deviceId?: string, limit = 20) =>
    api.get('/incidents', { params: { device_id: deviceId, limit } }),
  get: (id: string) =>
    api.get(`/incidents/${id}`),
  acknowledge: (id: string, notes?: string) =>
    api.patch(`/incidents/${id}/acknowledge`, { notes }),
};

export const emergencyApi = {
  triggerSOS: (payload: {
    address?: string;
    latitude?: number;
    longitude?: number;
    message?: string;
  }) => api.post('/mobile/emergency/sos', payload),
};

export const doctorApi = {
  getPatients: () => api.get('/doctor/patients'),
  getAnalytics: (patientId: any, days = 7) =>
    api.get('/doctor/analytics', { params: { patient_id: patientId, days } }),
  getAppointments: () => api.get('/doctor/appointments'),
  createAppointment: (payload: any) => api.post('/doctor/appointments', payload),
  updateAppointment: (aptId: any, payload: any) =>
    api.patch(`/doctor/appointments/${aptId}`, payload),
  deleteAppointment: (aptId: any) => api.delete(`/doctor/appointments/${aptId}`),
  getPatientDetail: (patientId: any) => api.get(`/doctor/patients/${patientId}`),
  getPrescriptions: (patientId: any) =>
    api.get(`/doctor/patients/${patientId}/prescriptions`),
  createPrescription: (patientId: any, payload: any) =>
    api.post(`/doctor/patients/${patientId}/prescriptions`, payload),
  updatePrescription: (patientId: any, rxId: any, payload: any) =>
    api.patch(`/doctor/patients/${patientId}/prescriptions/${rxId}`, payload),
  deletePrescription: (patientId: any, rxId: any) =>
    api.delete(`/doctor/patients/${patientId}/prescriptions/${rxId}`),
  togglePrescriptionReminder: (patientId: any, rxId: any) =>
    api.post(`/doctor/patients/${patientId}/prescriptions/${rxId}/toggle-reminder`),
  updateMedicalRecord: (patientId: any, payload: any) =>
    api.patch(`/doctor/patients/${patientId}/medical-record`, payload),
  updateThresholds: (patientId: any, payload: any) =>
    api.patch(`/doctor/patients/${patientId}/thresholds`, payload),
};

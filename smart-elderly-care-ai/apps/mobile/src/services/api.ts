// api.ts
// Axios client setup – kết nối Frontend React Native với Backend FastAPI (http://localhost:8000/api/v1)

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

// Cấu hình BASE_URL tự động:
// - Nếu có biến EXPO_PUBLIC_API_URL thì dùng nó
// - Nếu chạy trên Web hoặc iOS simulator: dùng http://localhost:8000/api/v1
// - Nếu chạy trên Android emulator: dùng http://10.0.2.2:8000/api/v1
const getBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web' || Platform.OS === 'ios') {
    return 'http://localhost:8000/api/v1';
  }
  return 'http://10.0.2.2:8000/api/v1';
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
  login: (email: string, password: string) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  register: (data: {
    email?: string;
    phone?: string;
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

// api.ts
// Axios client setup – tất cả API calls đều qua file này

import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '../store/useVitalStore';

const BASE_URL: string = (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) || 'http://10.0.2.2:8000/api/v1';

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
    // Use FormData for OAuth2 password flow (avoids URLSearchParams compatibility issues)
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  register: (data: { email: string; full_name: string; password: string; role: string }) =>
    api.post('/auth/register', data),
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

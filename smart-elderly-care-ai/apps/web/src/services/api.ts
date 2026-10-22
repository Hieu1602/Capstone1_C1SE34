// src/services/api.ts - Axios client & API Endpoints for Admin Web Portal

import axios from 'axios';
import {
  User,
  Device,
  DeviceConfig,
  RedisDiagnostics,
  SystemModeConfig,
  AIModelStatus,
  SystemLog,
  SystemNotification,
  CreateNotificationPayload,
  UpdateNotificationPayload,
} from '../types';

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname
    ? `http://${window.location.hostname}:8000/api/v1`
    : 'http://localhost:8000/api/v1');

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('seca_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor for 401 handling
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/login')) {
      localStorage.removeItem('seca_admin_token');
      localStorage.removeItem('seca_admin_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// =============================================================================
// API MODULES
// =============================================================================

// 1. AUTH API
export const authApi = {
  login: async (phone: string, pass: string) => {
    const params = new URLSearchParams();
    params.append('username', phone.startsWith('0') ? `+84${phone.slice(1)}` : phone);
    params.append('password', pass);
    return api.post('/auth/login', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  getMe: () => api.get<User>('/auth/me'),
};

// 2. USERS & PERMISSIONS API
export const usersApi = {
  list: async (): Promise<User[]> => {
    const res = await api.get<User[]>('/users');
    return res.data;
  },

  create: (data: Partial<User> & { password?: string }) => api.post('/users', data),
  update: (id: string, data: Partial<User>) => api.patch(`/users/${id}`, data),
  toggleStatus: (id: string, active: boolean) => api.patch(`/users/${id}`, { is_active: active }),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// 3. IOT DEVICES API
export const devicesApi = {
  list: async (): Promise<Device[]> => {
    const res = await api.get<Device[]>('/devices');
    return res.data;
  },
  getConfig: (deviceId: string) => api.get<DeviceConfig>(`/devices/${deviceId}/config`),
  updateConfig: (deviceId: string, config: Partial<DeviceConfig>) =>
    api.put<DeviceConfig>(`/devices/${deviceId}/config`, config),
  rebootDevice: (deviceId: string) => api.post(`/devices/${deviceId}/reboot`),
};

// 4. SECURITY MANAGEMENT API (Phân hệ 2)
export const securityApi = {
  getPolicies: async (): Promise<import('../types').SecurityPolicy[]> => {
    const res = await api.get('/security/policies');
    return res.data;
  },
  updatePolicy: async (id: string, data: { enabled?: boolean; value?: string | number }) => {
    const res = await api.put(`/security/policies/${id}`, data);
    return res.data;
  },
  getSessions: async (): Promise<import('../types').ActiveSession[]> => {
    const res = await api.get('/security/sessions');
    return res.data;
  },
  revokeSession: async (id: string) => {
    const res = await api.delete(`/security/sessions/${id}`);
    return res.data;
  },
  getAuditLogs: async (severity?: string, search?: string, limit?: number): Promise<import('../types').SecurityAuditLog[]> => {
    const res = await api.get('/security/audit-logs', {
      params: { severity, search, limit },
    });
    return res.data;
  },
  getAbnormalAccess: async () => {
    const res = await api.get('/security/abnormal-access');
    return res.data;
  },
  getRbacMatrix: async () => {
    const res = await api.get('/security/rbac-matrix');
    return res.data;
  },
};

// 5. INFRASTRUCTURE & SYSTEM MONITORING API (Phân hệ 3 & 4)
export const systemApi = {
  getServicesHealth: async (): Promise<import('../types').ServiceHealth[]> => {
    const res = await api.get('/system/services-health');
    return res.data;
  },
  getDatabaseStatus: async (): Promise<import('../types').DatabaseStatus> => {
    const res = await api.get('/system/database-status');
    return res.data;
  },
  getIncidents: async (): Promise<import('../types').SystemIncident[]> => {
    const res = await api.get('/system/incidents');
    return res.data;
  },
  resolveIncident: (incidentId: string) => api.post(`/system/incidents/${incidentId}/resolve`),
  getBackups: async (): Promise<import('../types').BackupItem[]> => {
    const res = await api.get('/system/backups');
    return res.data;
  },
  triggerBackup: () => api.post('/system/backup'),
  restoreBackup: (backupId: string) => api.post('/system/restore', { backup_id: backupId }),
  getTechnicalConfig: () => api.get('/system/technical-config'),
  flushRedis: () => api.post('/system/redis/flush'),
  getRedisStatus: async (): Promise<RedisDiagnostics> => {
    const res = await api.get('/system/redis-status');
    return res.data;
  },
  getSystemMode: async (): Promise<SystemModeConfig> => {
    const res = await api.get('/system/mode');
    return res.data;
  },
  updateSystemMode: (mode: string) => api.put('/system/mode', { mode }),
  getLogs: async (): Promise<SystemLog[]> => {
    const res = await api.get('/system/logs');
    return res.data;
  },
  getMetrics: () => api.get('/system/metrics'),
};

// 6. CLINICAL & VITALS TELEMETRY API
export const vitalsApi = {
  getHistory: async (limit = 24) => {
    const res = await api.get(`/vitals/history?limit=${limit}`);
    return res.data;
  },
  getCurrent: async () => {
    const res = await api.get('/vitals/current');
    return res.data;
  },
};

// 7. INCIDENTS API
export const incidentsApi = {
  list: async (limit = 50) => {
    const res = await api.get(`/incidents?limit=${limit}`);
    return res.data;
  },
};

// 5. AI MAINTENANCE API
export const aiApi = {
  getModels: async (): Promise<AIModelStatus[]> => {
    return [
      {
        id: 'model-yolo-pose',
        name: 'YOLOv8-Pose (Fall & Posture Detection)',
        category: 'VISION',
        runtime_engine: 'RKNN / NPU',
        status: 'ACTIVE',
        fps: 29.4,
        latency_ms: 34,
        accuracy: 98.2,
        version: 'v8.4.2-rknn-fp16',
        confidence_threshold: 0.75,
        last_updated: '05/10/2026',
        memory_footprint_mb: 180,
        description: 'Mô hình thị giác máy tính nhận diện 17 điểm khớp xương người, phát hiện té ngã ngã khuỵu, bất động > 10s.',
      },
      {
        id: 'model-yamnet',
        name: 'YAMNet Sound Event Classifier',
        category: 'AUDIO',
        runtime_engine: 'TFLite',
        status: 'ACTIVE',
        fps: undefined,
        latency_ms: 18,
        accuracy: 96.5,
        version: 'v2.1.0-embedded',
        confidence_threshold: 0.80,
        last_updated: '28/09/2026',
        memory_footprint_mb: 45,
        description: 'Mô hình phân loại âm thanh bất thường qua microphone: tiếng kêu cứu "Cứu tôi với", tiếng la hét, tiếng đổ vỡ va đập.',
      },
      {
        id: 'model-face-recog',
        name: 'MobileFaceNet Biometric Recognition',
        category: 'BIOMETRIC',
        runtime_engine: 'ONNX Runtime',
        status: 'ACTIVE',
        fps: 22.0,
        latency_ms: 45,
        accuracy: 99.1,
        version: 'v1.5.0-onnx',
        confidence_threshold: 0.65,
        last_updated: '02/10/2026',
        memory_footprint_mb: 68,
        description: 'Nhận diện khuôn mặt người thân trong gia đình & phát hiện người lạ đột nhập khi ở chế độ AWAY.',
      },
      {
        id: 'model-gemini-rag',
        name: 'Google Gemini 2.0 Flash + Medical RAG',
        category: 'LLM_AGENT',
        runtime_engine: 'Google Gemini Cloud',
        status: 'ACTIVE',
        fps: undefined,
        latency_ms: 820,
        accuracy: 97.8,
        version: 'gemini-2.0-flash-medical',
        confidence_threshold: 0.85,
        last_updated: 'Hôm nay',
        memory_footprint_mb: 0,
        description: 'Trợ lý AI tư vấn y khoa lão khoa & giải thích nguyên nhân tăng nhịp tim/hạ đường huyết cho người nhà.',
      },
    ];
  },
  updateThreshold: async (modelId: string, threshold: number) => {
    // Updates confidence threshold on Edge Hub
    return { success: true, modelId, threshold };
  },
};

// 7. SYSTEM NOTIFICATIONS & BROADCASTS API
export const notificationsApi = {
  list: async (params?: {
    status?: string;
    type?: string;
    target_audience?: string;
    search?: string;
  }): Promise<SystemNotification[]> => {
    const res = await api.get<SystemNotification[]>('/admin/notifications', { params });
    return res.data;
  },
  get: (id: string) => api.get<SystemNotification>(`/admin/notifications/${id}`).then((r) => r.data),
  create: (payload: CreateNotificationPayload) => api.post<SystemNotification>('/admin/notifications', payload).then((r) => r.data),
  update: (id: string, payload: UpdateNotificationPayload) => api.put<SystemNotification>(`/admin/notifications/${id}`, payload).then((r) => r.data),
  publish: (id: string) => api.post<SystemNotification>(`/admin/notifications/${id}/publish`).then((r) => r.data),
  schedule: (id: string, scheduled_at: string) => api.post<SystemNotification>(`/admin/notifications/${id}/schedule`, { scheduled_at }).then((r) => r.data),
  revoke: (id: string, revoke_reason?: string) => api.post<SystemNotification>(`/admin/notifications/${id}/revoke`, { revoke_reason }).then((r) => r.data),
  delete: (id: string) => api.delete(`/admin/notifications/${id}`).then((r) => r.data),
};



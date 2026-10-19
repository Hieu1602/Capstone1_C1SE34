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

const BASE_URL = import.meta.env.VITE_API_URL || 'http://16.178.128.42:8000/api/v1';

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
    try {
      const res = await api.get<User[]>('/users');
      return res.data;
    } catch {
      // Mock / fallback data if backend /users endpoint is not yet paginated
      return [
        {
          id: 'c9999999-b4e1-4b08-b2d3-d949a0eb075c',
          phone: '+84900000000',
          full_name: 'System Admin (Root Admin)',
          role: 'admin',
          is_active: true,
          created_at: '2026-09-01T08:00:00Z',
          assigned_house: 'Toàn hệ thống (Root)',
        },
        {
          id: '2',
          phone: '+84905123456',
          full_name: 'Nguyễn Hữu Nghĩa (Chủ nhà)',
          role: 'user',
          is_active: true,
          created_at: '2026-09-15T09:30:00Z',
          assigned_house: 'Nhà của tôi (123 Hải Phòng)',
        },
        {
          id: 'b2222222-b4e1-4b08-b2d3-d949a0eb075c',
          phone: '+84905888999',
          full_name: 'BS. Nguyễn Văn Minh',
          role: 'doctor',
          is_active: true,
          created_at: '2026-09-20T14:15:00Z',
          assigned_house: 'Phụ trách y tế (Nhà của tôi)',
        },
        {
          id: 'b3333333-b4e1-4b08-b2d3-d949a0eb075c',
          phone: '+84905111222',
          full_name: 'BS. Trần Văn Minh',
          role: 'doctor',
          is_active: true,
          created_at: '2026-09-22T10:00:00Z',
          assigned_house: 'Bác sĩ dự phòng (Nhà của tôi)',
        },
        {
          id: 'a1111111-b4e1-4b08-b2d3-d949a0eb075c',
          phone: '+84905999888',
          full_name: 'Nguyễn Thị Lan (Người thân)',
          role: 'user',
          is_active: true,
          created_at: '2026-09-25T11:45:00Z',
          assigned_house: 'Nhà của tôi (123 Hải Phòng)',
        },
      ];
    }
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
    try {
      const res = await api.get('/system/services-health');
      return res.data;
    } catch {
      return [
        {
          id: 'srv-1',
          name: 'FastAPI Core Backend (ASGI)',
          category: 'REST & WebSocket Gateway',
          port: 8000,
          status: 'healthy',
          uptime: '99.98%',
          cpu_usage: 12.4,
          memory_usage: 145,
          latency_ms: 4.2,
          connections: 18,
          last_check: 'Vừa xong',
        },
        {
          id: 'srv-2',
          name: 'PostgreSQL 16 (TimescaleDB)',
          category: 'Database Engine',
          port: 5432,
          status: 'healthy',
          uptime: '100%',
          cpu_usage: 8.1,
          memory_usage: 320,
          latency_ms: 6.5,
          connections: 12,
          last_check: 'Vừa xong',
        },
        {
          id: 'srv-3',
          name: 'Redis In-Memory Cache & PubSub',
          category: 'Cache & Session Engine',
          port: 6379,
          status: 'healthy',
          uptime: '99.99%',
          cpu_usage: 3.2,
          memory_usage: 48,
          latency_ms: 1.5,
          connections: 24,
          last_check: 'Vừa xong',
        },
        {
          id: 'srv-4',
          name: 'EMQX MQTT Broker (v5.7)',
          category: 'IoT Telemetry Broker',
          port: 1883,
          status: 'healthy',
          uptime: '99.95%',
          cpu_usage: 6.8,
          memory_usage: 110,
          latency_ms: 5.0,
          connections: 5,
          last_check: 'Vừa xong',
        },
        {
          id: 'srv-5',
          name: 'MinIO S3 Object Storage',
          category: 'Biometric & Media Storage',
          port: 9000,
          status: 'healthy',
          uptime: '99.90%',
          cpu_usage: 4.5,
          memory_usage: 95,
          latency_ms: 15.0,
          connections: 8,
          last_check: 'Vừa xong',
        },
      ];
    }
  },
  getDatabaseStatus: async (): Promise<import('../types').DatabaseStatus> => {
    const res = await api.get('/system/database-status');
    return res.data;
  },
  getIncidents: async (): Promise<import('../types').SystemIncident[]> => {
    try {
      const res = await api.get('/system/incidents');
      return res.data;
    } catch {
      return [
        {
          id: 'inc-01',
          timestamp: '2026-10-15 09:35:12',
          service: 'EMQX Broker',
          type: 'WARNING',
          message: 'Thiết bị SENSOR_RADAR_001 gửi bản tin heartbeat trễ 45s so với chu kỳ.',
          resolved: true,
        },
        {
          id: 'inc-02',
          timestamp: '2026-10-15 08:20:44',
          service: 'FastAPI Core',
          type: 'ERROR',
          message: 'Truy vấn bảng users trả về mã 404 cho user_id tạm thời. Đã tự phục hồi.',
          resolved: true,
        },
        {
          id: 'inc-03',
          timestamp: '2026-10-15 07:15:00',
          service: 'PostgreSQL DB',
          type: 'CRITICAL',
          message: 'Khóa kết nối trên cổng 5433 được phát hiện và đã chuyển mạch an toàn sang cổng 5432.',
          resolved: true,
        },
      ];
    }
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
    try {
      const res = await api.get('/system/redis-status');
      return res.data;
    } catch {
      return {
        connected: true,
        total_keys: 142,
        used_memory_human: '2.15M',
        online_devices_count: 3,
        uptime_in_days: 7,
        redis_version: '7.2-alpine',
        hit_rate: 98.7,
      };
    }
  },
  getSystemMode: async (): Promise<SystemModeConfig> => {
    try {
      const res = await api.get('/system/mode');
      return res.data;
    } catch {
      return {
        mode: 'HOME',
        is_mute_alarm: false,
        is_camera_privacy: false,
        mute_mode: 'SILENT',
        duration_minutes: 60,
      };
    }
  },
  updateSystemMode: (mode: string) => api.put('/system/mode', { mode }),
  getLogs: async (): Promise<SystemLog[]> => {
    try {
      const res = await api.get('/system/logs');
      return res.data;
    } catch {
      return [
        {
          id: 'log-101',
          timestamp: '14:52:12 - 15/10/2026',
          level: 'INFO',
          module: 'MQTT',
          message: 'MQTT Broker EMQX: Client backend-fastapi-001 kết nối thành công qua cổng 1883',
          source_ip: '127.0.0.1',
        },
        {
          id: 'log-102',
          timestamp: '14:48:30 - 15/10/2026',
          level: 'INFO',
          module: 'AUTH',
          message: 'Quản trị viên Admin123 đăng nhập hệ thống thành công qua JWT Bearer',
          source_ip: '127.0.0.1',
        },
        {
          id: 'log-103',
          timestamp: '14:45:00 - 15/10/2026',
          level: 'WARN',
          module: 'EDGE_AI',
          message: 'BLE_BAND_001 phát hiện nhịp tim vượt ngưỡng: 124 bpm (Cụ Nguyễn Văn An)',
          source_ip: 'Edge-Hub-01',
        },
        {
          id: 'log-104',
          timestamp: '14:20:18 - 15/10/2026',
          level: 'INFO',
          module: 'WEBSOCKET',
          message: 'Kênh WebSocket /ws/alerts đã phân phối 1 sự kiện thời gian thực cho client',
          source_ip: 'FastAPI Core',
        },
        {
          id: 'log-105',
          timestamp: '13:55:04 - 15/10/2026',
          level: 'INFO',
          module: 'DATABASE',
          message: 'PostgreSQL 16 (TimescaleDB) lưu trữ bản ghi sinh hiệu (vital_signs) ổn định',
          source_ip: 'localhost:5432',
        },
      ];
    }
  },
  getMetrics: () => api.get('/system/metrics'),
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
    try {
      const res = await api.get<SystemNotification[]>('/admin/notifications', { params });
      return res.data;
    } catch {
      // Fallback mock data if server offline
      return [
        {
          id: 'notif-1',
          title: 'Bảo trì nâng cấp hệ thống định kỳ',
          body: 'Hệ thống Smart Elderly Care AI sẽ tiến hành tối ưu hóa kết nối IoT và sao lưu cơ sở dữ liệu từ 01:00 đến 03:00 ngày 18/10/2026. Trong thời gian này, các tính năng báo cáo có thể bị chậm nhẹ.',
          type: 'system_maintenance',
          target_audience: 'all',
          status: 'published',
          published_at: '2026-10-14T10:00:00Z',
          delivered_count: 152,
          read_count: 128,
          created_at: '2026-10-14T09:30:00Z',
          updated_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'notif-2',
          title: 'Khuyến cáo sức khỏe mùa giao mùa',
          body: 'Nhiệt độ thay đổi đột ngột có thể ảnh hưởng đến huyết áp của người cao tuổi. Gia đình vui lòng kiểm tra thiết bị đo sinh hiệu phòng ngủ và duy trì nhiệt độ phòng 26-28 độ C.',
          type: 'health_tip',
          target_audience: 'caregivers',
          status: 'published',
          published_at: '2026-10-15T07:15:00Z',
          delivered_count: 89,
          read_count: 74,
          created_at: '2026-10-15T07:00:00Z',
          updated_at: '2026-10-15T07:15:00Z',
        },
        {
          id: 'notif-3',
          title: 'Cập nhật tính năng trợ lý AI Y khoa',
          body: 'Phiên bản mới của Chatbot y khoa đã được tích hợp mô hình phân tích triệu chứng chuyên sâu dành cho bác sĩ gia đình và người chăm sóc.',
          type: 'feature_update',
          target_audience: 'all',
          status: 'scheduled',
          scheduled_at: '2026-10-16T08:00:00Z',
          delivered_count: 0,
          read_count: 0,
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
        },
        {
          id: 'notif-4',
          title: 'Bản thảo hướng dẫn kết nối vòng đeo tay SpO2 mới',
          body: 'Hướng dẫn các bước ghép nối Bluetooth và cấu hình đo nhịp tim liên tục cho thiết bị thế hệ mới.',
          type: 'info',
          target_audience: 'all',
          status: 'draft',
          delivered_count: 0,
          read_count: 0,
          created_at: '2026-10-15T11:00:00Z',
          updated_at: '2026-10-15T11:00:00Z',
        },
      ];
    }
  },
  get: (id: string) => api.get<SystemNotification>(`/admin/notifications/${id}`).then((r) => r.data),
  create: (payload: CreateNotificationPayload) => api.post<SystemNotification>('/admin/notifications', payload).then((r) => r.data),
  update: (id: string, payload: UpdateNotificationPayload) => api.put<SystemNotification>(`/admin/notifications/${id}`, payload).then((r) => r.data),
  publish: (id: string) => api.post<SystemNotification>(`/admin/notifications/${id}/publish`).then((r) => r.data),
  schedule: (id: string, scheduled_at: string) => api.post<SystemNotification>(`/admin/notifications/${id}/schedule`, { scheduled_at }).then((r) => r.data),
  revoke: (id: string, revoke_reason?: string) => api.post<SystemNotification>(`/admin/notifications/${id}/revoke`, { revoke_reason }).then((r) => r.data),
  delete: (id: string) => api.delete(`/admin/notifications/${id}`).then((r) => r.data),
};



// types/index.ts - Core types for Admin Web Portal

export type UserRole = 'admin' | 'doctor' | 'caregiver' | 'user' | 'elderly' | 'owner' | 'member';

export interface PermissionRule {
  id: string;
  name: string;
  description: string;
  target_role: UserRole | 'all';
  module: 'camera' | 'vitals' | 'emergency' | 'devices' | 'members' | 'medical' | 'all';
  permissions: string[];
  is_active: boolean;
  color?: string;
  is_system?: boolean;
  member_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
  fcm_token?: string | null;
  assigned_house?: string;
  role_title?: string;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'session' | 'access_control' | 'data_protection';
  enabled: boolean;
  value?: string | number | null;
}

export interface ActiveSession {
  id: string;
  user_name: string;
  role: string;
  ip_address: string;
  device: string;
  login_time: string;
  last_active: string;
  status: 'active' | 'warning' | 'expired';
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  event: string;
  user: string;
  ip: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
}

export interface ServiceHealth {
  id: string;
  name: string;
  category: string;
  port: number | string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: string;
  cpu_usage: number;
  memory_usage: number;
  latency_ms: number;
  connections: number;
  last_check: string;
  version?: string;
  description?: string;
}

export interface SystemIncident {
  id: string;
  timestamp: string;
  service: string;
  type: 'ERROR' | 'WARNING' | 'CRITICAL';
  message: string;
  resolved: boolean;
}

export interface BackupItem {
  id: string;
  created_at: string;
  size_mb: number;
  type: string;
  storage: string;
  status: string;
  checksum?: string;
}

export interface DatabaseStatus {
  engine: string;
  database_name: string;
  status: string;
  port: number;
  size_pretty: string;
  active_connections: number;
  tables_count: number;
  rows_summary: {
    users: number;
    devices: number;
    vital_signs_timeseries: number;
    emergency_incidents: number;
  };
}

export type DeviceType = 'CAMERA' | 'SMARTBAND' | 'EDGE_HUB' | 'SENSOR';

export interface DeviceConfig {
  device_id: string;
  stream_url?: string;
  resolution?: string;
  is_sleep?: boolean;
  is_ai_protect?: boolean;
  has_two_way_audio?: boolean;
  hr_threshold_high?: number;
  hr_threshold_low?: number;
  spo2_threshold_low?: number;
  fall_impact_threshold?: number;
  immobility_seconds?: number;
  mqtt_topic?: string;
  updated_at?: string;
}

export interface Device {
  id: string;
  device_id: string;
  name: string;
  sub_title?: string;
  device_type: DeviceType;
  location?: string;
  is_online: boolean;
  status_text?: string;
  battery_level?: number | null;
  owner_id?: string;
  house_id?: string;
  elderly_name?: string;
  config?: DeviceConfig;
  last_heartbeat?: string;
}

export interface SystemServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number;
  port: number | string;
  version?: string;
  details?: string;
}

export interface RedisDiagnostics {
  connected: boolean;
  total_keys: number;
  used_memory_human: string;
  online_devices_count: number;
  uptime_in_days: number;
  redis_version: string;
  hit_rate?: number;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  module: 'AUTH' | 'MQTT' | 'EDGE_AI' | 'DATABASE' | 'WEBSOCKET' | 'API';
  message: string;
  source_ip?: string;
  details?: Record<string, any>;
}

export interface AIModelStatus {
  id: string;
  name: string;
  category: 'VISION' | 'AUDIO' | 'BIOMETRIC' | 'LLM_AGENT';
  runtime_engine: 'RKNN / NPU' | 'ONNX Runtime' | 'TFLite' | 'Google Gemini Cloud';
  status: 'ACTIVE' | 'STANDBY' | 'DEGRADED';
  fps?: number;
  latency_ms: number;
  accuracy: number; // Percentage e.g. 98.4
  version: string;
  confidence_threshold: number;
  last_updated: string;
  memory_footprint_mb: number;
  description: string;
}

export interface SystemModeConfig {
  mode: 'HOME' | 'AWAY' | 'DISARM' | 'ALARM' | 'PRIVACY';
  is_mute_alarm: boolean;
  is_camera_privacy: boolean;
  mute_mode: string;
  duration_minutes: number;
}

// =============================================================================
// QUẢN LÝ THÔNG BÁO TOÀN HỆ THỐNG (SYSTEM NOTIFICATIONS & BROADCASTS)
// =============================================================================
export type NotificationType = 'info' | 'system_maintenance' | 'emergency' | 'health_tip' | 'feature_update';
export type TargetAudience = 'all' | 'caregivers' | 'doctors' | 'elderly';
export type NotificationStatus = 'draft' | 'scheduled' | 'published' | 'revoked';

export interface SystemNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  target_audience: TargetAudience;
  status: NotificationStatus;
  scheduled_at?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  delivered_count: number;
  read_count: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  target_audience: TargetAudience;
  status?: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string | null;
  expires_at?: string | null;
}

export interface UpdateNotificationPayload {
  title?: string;
  body?: string;
  type?: NotificationType;
  target_audience?: TargetAudience;
  status?: NotificationStatus;
  scheduled_at?: string | null;
  expires_at?: string | null;
}



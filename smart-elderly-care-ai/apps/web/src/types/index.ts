// types/index.ts - Core types for Admin Web Portal

export type UserRole = 'admin' | 'doctor' | 'caregiver' | 'user';

export interface User {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  fcm_token?: string | null;
  assigned_house?: string;
}

export type DeviceType = 'CAMERA' | 'SMARTBAND' | 'EDGE_HUB';

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


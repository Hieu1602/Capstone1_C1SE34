/**
 * deviceService.ts
 * Dịch vụ REST API gọi Backend cho Thiết bị (Devices), Nhóm (Device Groups), và Căn nhà (Houses).
 * Vị trí: apps/mobile/src/services/deviceService.ts
 */

import api from './api';

// ==========================================
// TypeScript Interfaces đồng bộ Backend
// ==========================================

export interface DeviceConfigBackend {
  stream_url?: string | null;
  resolution?: string;
  is_sleep?: boolean;
  is_ai_protect?: boolean;
  has_two_way_audio?: boolean;
  hr_threshold_high?: number;
  hr_threshold_low?: number;
  spo2_threshold_low?: number;
  fall_impact_threshold?: number;
  immobility_seconds?: number;
  mqtt_topic?: string | null;
  extra_settings?: Record<string, any>;
  updated_at?: string;
}

export interface DeviceBackend {
  id: string;
  device_id: string;
  name: string;
  sub_title?: string | null;
  device_type: 'CAMERA' | 'SMARTBAND';
  location?: string | null;
  is_online: boolean;
  status_text?: string | null;
  battery_level?: number | null;
  mac_address?: string | null;
  ip_address?: string | null;
  firmware_version?: string | null;
  last_heartbeat?: string | null;
  house_id?: string | null;
  group_id?: string | null;
  elderly_id?: string | null;
  created_at: string;
  updated_at: string;
  config?: DeviceConfigBackend | null;
}

export interface DeviceGroupBackend {
  id: string;
  house_id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  sort_order: number;
  device_count: number;
  created_at: string;
  updated_at: string;
}

export interface HouseBackend {
  id: string;
  owner_id: string;
  name: string;
  address?: string | null;
  current_mode: 'HOME' | 'AWAY' | 'DISARM' | 'ALARM' | 'PRIVACY';
  created_at: string;
  updated_at: string;
}

// ==========================================
// House APIs
// ==========================================

export const houseApi = {
  getCurrentHouse: () => api.get<HouseBackend>('/houses/current'),

  updateHouse: (data: { name?: string; address?: string }) =>
    api.patch<HouseBackend>('/houses/current', data),

  updateHouseMode: (mode: 'HOME' | 'AWAY' | 'DISARM' | 'ALARM' | 'PRIVACY') =>
    api.patch<HouseBackend>('/houses/current/mode', { mode }),
};

// ==========================================
// Device Groups APIs
// ==========================================

export const deviceGroupApi = {
  listGroups: () => api.get<DeviceGroupBackend[]>('/device-groups'),

  createGroup: (data: {
    name: string;
    icon?: string;
    color?: string;
    sort_order?: number;
    device_ids?: string[];
  }) => api.post<DeviceGroupBackend>('/device-groups', data),

  getGroup: (groupId: string) =>
    api.get<DeviceGroupBackend>(`/device-groups/${groupId}`),

  updateGroup: (
    groupId: string,
    data: {
      name?: string;
      icon?: string;
      color?: string;
      sort_order?: number;
      device_ids?: string[];
    }
  ) => api.put<DeviceGroupBackend>(`/device-groups/${groupId}`, data),

  deleteGroup: (groupId: string) =>
    api.delete<{ message: string }>(`/device-groups/${groupId}`),

  assignDevices: (deviceIds: string[], groupId: string | null) =>
    api.post<{ message: string; updated_count: number }>('/device-groups/assign', {
      device_ids: deviceIds,
      group_id: groupId,
    }),

  getGroupDevices: (groupId: string) =>
    api.get<DeviceBackend[]>(`/device-groups/${groupId}/devices`),
};

// ==========================================
// Devices APIs
// ==========================================

export const devicesApi = {
  listDevices: (params?: {
    device_type?: 'CAMERA' | 'SMARTBAND';
    group_id?: string;
    is_online?: boolean;
    skip?: number;
    limit?: number;
  }) => api.get<DeviceBackend[]>('/devices', { params }),

  getDevice: (idOrDeviceId: string) =>
    api.get<DeviceBackend>(`/devices/${idOrDeviceId}`),

  createDevice: (data: {
    device_id: string;
    name: string;
    sub_title?: string;
    device_type: 'CAMERA' | 'SMARTBAND';
    location?: string;
    group_id?: string;
    house_id?: string;
    mac_address?: string;
    ip_address?: string;
    config?: Partial<DeviceConfigBackend>;
  }) => api.post<DeviceBackend>('/devices', data),

  updateDevice: (
    idOrDeviceId: string,
    data: Partial<{
      name: string;
      sub_title: string;
      location: string;
      group_id: string | null;
      elderly_id: string | null;
      is_online: boolean;
      status_text: string;
      battery_level: number;
    }>
  ) => api.put<DeviceBackend>(`/devices/${idOrDeviceId}`, data),

  deleteDevice: (idOrDeviceId: string) =>
    api.delete<{ message: string }>(`/devices/${idOrDeviceId}`),

  updateDeviceConfig: (idOrDeviceId: string, config: Partial<DeviceConfigBackend>) =>
    api.patch<DeviceConfigBackend>(`/devices/${idOrDeviceId}/config`, config),

  updateDeviceStatus: (
    idOrDeviceId: string,
    status: {
      is_online?: boolean;
      battery_level?: number;
      status_text?: string;
    }
  ) => api.patch<DeviceBackend>(`/devices/${idOrDeviceId}/status`, status),

  sendHeartbeat: (idOrDeviceId: string) =>
    api.post<{ message: string; last_heartbeat: string }>(
      `/devices/${idOrDeviceId}/heartbeat`
    ),
};


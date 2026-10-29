/**
 * types.ts
 * Kiểu dữ liệu và ánh xạ trạng thái cho quy trình Thêm thiết bị (AddDeviceScreen).
 */

export type FlowStep =
  | 'CATEGORY_SELECT'
  | 'CAMERA_LIST'
  | 'WATCH_LIST'
  | 'OTHER_LIST'
  | 'WIFI_POWER_CHECK'
  | 'WIFI_GUIDE'
  | 'WIFI_SEARCHING'
  | 'HEALTH_CONNECT_SETUP'
  | 'BLE_POWER_CHECK'
  | 'BLE_PERMISSION'
  | 'BLE_SCAN'
  | 'BLE_PAIRING'
  | 'SETUP_SUCCESS';

export type ProtocolType = 'WIFI_AP' | 'BLUETOOTH' | 'GATEWAY_MQTT';

export const PREVIOUS_STEP_MAP: Partial<Record<FlowStep, FlowStep>> = {
  CAMERA_LIST: 'CATEGORY_SELECT',
  WATCH_LIST: 'CATEGORY_SELECT',
  OTHER_LIST: 'CATEGORY_SELECT',
  WIFI_POWER_CHECK: 'CAMERA_LIST',
  WIFI_GUIDE: 'WIFI_POWER_CHECK',
  WIFI_SEARCHING: 'WIFI_GUIDE',
  HEALTH_CONNECT_SETUP: 'WATCH_LIST',
  BLE_POWER_CHECK: 'WATCH_LIST',
  BLE_PERMISSION: 'BLE_POWER_CHECK',
  BLE_SCAN: 'BLE_PERMISSION',
  BLE_PAIRING: 'BLE_SCAN',
};

export interface DiscoveredBleItem {
  id: string;
  name: string;
  mac: string;
  rssi: string;
  battery: number;
  services: string;
  rawDevice?: any;
}

export interface SetupSuccessInfo {
  name: string;
  type: string;
  protocol: string;
  details: string;
  location: string;
  icon: string;
  color: string;
}


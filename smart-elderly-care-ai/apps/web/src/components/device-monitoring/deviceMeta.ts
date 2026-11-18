import React from 'react';
import { Video, Activity, Cpu, Zap } from 'lucide-react';

/** Cấu hình form hiệu chuẩn ngưỡng hoạt động của thiết bị */
export interface DeviceFormConfig {
  hrHigh: number;
  hrLow: number;
  spo2Low: number;
  fallImpact: number;
  immobilitySec: number;
  rtspUrl: string;
  aiProtect: boolean;
  privacyShutter: boolean;
  resolution: string;
  assignedElderly: string;
  doctorApprovedBy: string;
  clinicalReason: string;
}

export const DEFAULT_CONFIG: DeviceFormConfig = {
  hrHigh: 120,
  hrLow: 50,
  spo2Low: 90,
  fallImpact: 2.5,
  immobilitySec: 10,
  rtspUrl: '',
  aiProtect: true,
  privacyShutter: false,
  resolution: '2K Super HD',
  assignedElderly: '',
  doctorApprovedBy: '',
  clinicalReason: '',
};

/** Metadata ánh xạ hiển thị cho từng loại thiết bị theo kiến trúc phần cứng */
export const DEVICE_TYPE_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    style: string;
  }
> = {
  CAMERA: {
    label: 'Camera AI',
    icon: Video,
    style: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800',
  },
  SMARTBAND: {
    label: 'Smartband BLE',
    icon: Activity,
    style: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800',
  },
  EDGE_HUB: {
    label: 'Edge Hub AI',
    icon: Cpu,
    style: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
  },
  SENSOR: {
    label: 'Cảm biến',
    icon: Zap,
    style: 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-800',
  },
};

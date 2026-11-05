/**
 * wearableIntegration.ts
 * Xử lý luồng dữ liệu sức khỏe thống nhất từ BLE & Health Connect:
 * 1. Chuẩn hóa dữ liệu (Normalize)
 * 2. Kiểm tra tính hợp lệ (Validate sinh lý)
 * 3. Gửi dữ liệu lên FastAPI và cập nhật Store hiển thị SECA
 */

import { wearableManager, Measurement } from './wearableService';
import { vitalsApi } from './api';
import { useHealthStore } from '../store/useHealthStore';

export interface RawVitalInput {
  deviceId?: string;
  metric?: string; // 'heartRate' | 'spo2' | 'bodyTemperature' | 'skin_temp_max' | 'steps'
  value?: number;
  heartRate?: number;
  spo2?: number;
  bodyTemperature?: number;
  fallDetected?: boolean;
  battery?: number;
  timestamp?: number;
}

export interface NormalizedVital {
  device_id: string;
  heart_rate?: number;
  spo2?: number;
  skin_temp_max?: number;
  fall_detected?: boolean;
  bracelet_battery?: number;
  timestamp: number;
}

/**
 * BƯỚC 1: Chuẩn hóa dữ liệu (Data Normalization)
 * Chuyển đổi các định dạng khác nhau từ BLE hoặc Health Connect về schema chuẩn của SECA
 */
export function normalizeVitalData(input: RawVitalInput, defaultDeviceId: string = 'smartwatch-ble'): NormalizedVital {
  const norm: NormalizedVital = {
    device_id: input.deviceId || defaultDeviceId,
    timestamp: input.timestamp || Date.now(),
  };

  // Nếu input đến từ callback Measurement của BLE
  if (input.metric && typeof input.value === 'number') {
    if (input.metric === 'heartRate') norm.heart_rate = Math.round(input.value);
    if (input.metric === 'spo2') norm.spo2 = Math.round(input.value);
    if (input.metric === 'bodyTemperature' || input.metric === 'skin_temp_max') {
      norm.skin_temp_max = parseFloat(input.value.toFixed(1));
    }
  }

  // Nếu input là object chứa nhiều trường (từ Health Connect / batch)
  if (typeof input.heartRate === 'number') norm.heart_rate = Math.round(input.heartRate);
  if (typeof input.spo2 === 'number') norm.spo2 = Math.round(input.spo2);
  if (typeof input.bodyTemperature === 'number') norm.skin_temp_max = parseFloat(input.bodyTemperature.toFixed(1));
  if (typeof input.fallDetected === 'boolean') norm.fall_detected = input.fallDetected;
  if (typeof input.battery === 'number') norm.bracelet_battery = input.battery;

  return norm;
}

/**
 * BƯỚC 2: Kiểm tra tính hợp lệ (Data Validation)
 * Loại bỏ nhiễu cảm biến, giá trị lỗi kỹ thuật ngoài ngưỡng sinh lý an toàn
 */
export function validateVitalData(data: NormalizedVital): boolean {
  // Kiểm tra nhịp tim: 30 - 220 bpm
  if (data.heart_rate !== undefined) {
    if (data.heart_rate < 30 || data.heart_rate > 220) {
      console.warn(`[Validation] Nhịp tim bất thường/nhiễu: ${data.heart_rate} bpm (bị loại)`);
      return false;
    }
  }

  // Kiểm tra nồng độ oxy SpO2: 50% - 100%
  if (data.spo2 !== undefined) {
    if (data.spo2 < 50 || data.spo2 > 100) {
      console.warn(`[Validation] SpO2 bất thường/nhiễu: ${data.spo2}% (bị loại)`);
      return false;
    }
  }

  // Kiểm tra nhiệt độ bề mặt da / thân nhiệt: 30.0 - 45.0 độ C
  if (data.skin_temp_max !== undefined) {
    if (data.skin_temp_max < 30.0 || data.skin_temp_max > 45.0) {
      console.warn(`[Validation] Thân nhiệt bất thường/nhiễu: ${data.skin_temp_max}°C (bị loại)`);
      return false;
    }
  }

  return true;
}

/**
 * BƯỚC 3 & 4: Xử lý toàn vẹn luồng (Chuẩn hóa -> Kiểm tra -> Gửi FastAPI & Cập nhật UI)
 */
export async function processAndUploadVital(raw: RawVitalInput, defaultDeviceId: string = 'smartwatch-ble'): Promise<boolean> {
  // 1. Chuẩn hóa dữ liệu
  const normalized = normalizeVitalData(raw, defaultDeviceId);

  // 2. Kiểm tra tính hợp lệ
  if (!validateVitalData(normalized)) {
    return false;
  }

  // 3. Cập nhật Dashboard Mobile ngay lập tức
  const vitalsToSet: any = {
    bracelet_connected: true,
    timestamp: normalized.timestamp,
  };
  if (normalized.heart_rate !== undefined) vitalsToSet.heart_rate = normalized.heart_rate;
  if (normalized.spo2 !== undefined) vitalsToSet.spo2 = normalized.spo2;
  if (normalized.skin_temp_max !== undefined) vitalsToSet.skin_temp_max = normalized.skin_temp_max;
  if (normalized.fall_detected !== undefined) vitalsToSet.fall_detected = normalized.fall_detected;
  if (normalized.bracelet_battery !== undefined) vitalsToSet.bracelet_battery = normalized.bracelet_battery;

  useHealthStore.getState().setVitals(vitalsToSet);

  // 4. Gửi lên FastAPI Backend lưu vào TimescaleDB / PostgreSQL
  try {
    await vitalsApi.createVital({
      device_id: normalized.device_id,
      heart_rate: normalized.heart_rate,
      spo2: normalized.spo2,
      skin_temp_max: normalized.skin_temp_max,
      fall_detected: normalized.fall_detected,
    });
    return true;
  } catch (err) {
    console.warn('[VitalsPipeline] Gửi dữ liệu lên FastAPI thất bại:', err);
    return false;
  }
}

/**
 * Khởi động lắng nghe stream đo liên tục từ phần cứng BLE
 */
export const startWearablePipeline = async (deviceId?: string) => {
  const targetId = deviceId || 'ble-smartband-001';

  const callback = async (m: Measurement) => {
    await processAndUploadVital({
      deviceId: targetId,
      metric: m.metric,
      value: m.value,
      timestamp: m.measuredAt.getTime(),
    }, targetId);
  };

  await wearableManager.start(callback);
};

export const stopWearablePipeline = async () => {
  await wearableManager.stop();
};

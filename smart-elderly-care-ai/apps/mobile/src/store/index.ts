// store/index.ts
// Re-export toàn bộ stores từ 1 điểm tập trung.
//
// Cách import khuyến nghị:
//   import { useHealthStore, useAlertStore } from '../store';
//
// Backward-compatible:
//   import { useVitalStore } from '../store/useVitalStore'; // vẫn hoạt động

export { useHealthStore } from './useHealthStore';
export type { VitalData, AlgoSettings } from './useHealthStore';

export { useAlertStore } from './useAlertStore';
export type { Incident, AlarmSnoozeInfo } from './useAlertStore';

export { useDeviceStore } from './useDeviceStore';
export type { Device, HouseInfo, CameraDevice, IoTDeviceItem } from './useDeviceStore';

export { usePatientStore } from './usePatientStore';
export type { PatientMedicalRecord, RemindersData, ReminderItem, MedicalConditionItem } from './usePatientStore';

export { useAuthStore } from './useAuthStore';
export type { AuthStoreState } from './useAuthStore';

export { useThemeStore } from './useThemeStore';

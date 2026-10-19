// ==============================================================================
// TỆP: useVitalStore.ts
// PHÂN HỆ: Zustand Store Tổng hợp (Facade Store) quản lý Sinh hiệu, Cảnh báo & Nhà
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ KIẾN TRÚC:
//   Toàn bộ state của ứng dụng đã được chia thành 4 Domain Stores chuyên biệt (Single Responsibility):
//     - useHealthStore  → Dữ liệu sinh hiệu (Nhịp tim, SpO2, Thân nhiệt), ngưỡng cảnh báo AI.
//     - useAlertStore   → Danh sách sự cố khẩn cấp (Incidents), Tạm tắt chuông (Snooze), Còi hú (Siren).
//     - useDeviceStore  → Thiết bị IoT, Trạng thái Camera AI, Chế độ an ninh ngôi nhà (House Mode).
//     - usePatientStore → Hồ sơ bệnh án điện tử, Lịch nhắc uống thuốc, Đăng ký khuôn mặt ArcFace.
//   File này đóng vai trò Facade/Aggregator kết nối cả 4 store để các màn hình truy xuất đồng bộ.
// ==============================================================================

import { useHealthStore } from './useHealthStore';
import { useAlertStore } from './useAlertStore';
import { useDeviceStore } from './useDeviceStore';
import { usePatientStore } from './usePatientStore';
import { useThemeStore } from './useThemeStore';

// Re-export types cho backward compat
export type { VitalData } from './useHealthStore';
export type { Incident, AlarmSnoozeInfo } from './useAlertStore';
export type { Device, HouseInfo, CameraDevice, IoTDeviceItem } from './useDeviceStore';
export type {
  PatientMedicalRecord,
  RemindersData,
  ReminderItem,
  MedicalConditionItem,
} from './usePatientStore';

function getVitalState() {
  const health  = useHealthStore.getState();
  const alerts  = useAlertStore.getState();
  const devices = useDeviceStore.getState();
  const patient = usePatientStore.getState();
  const theme   = useThemeStore.getState();

  return {
    // --- từ useHealthStore ---
    currentVitals:       health.currentVitals,
    isConnected:         health.isConnected,
    selectedDate:        health.selectedDate,
    algoSettings:        health.algoSettings,
    isLoadingVitals:     health.isLoadingVitals,
    isLoadingMode:       health.isLoadingMode,
    fetchVitals:         health.fetchVitals,
    fetchSystemMode:     health.fetchSystemMode,
    setVitals:           health.setVitals,
    setConnected:        health.setConnected,
    setSelectedDate:     health.setSelectedDate,
    updateAlgoSettings:  health.updateAlgoSettings,

    // --- từ useAlertStore ---
    incidents:           alerts.incidents,
    alarmSnooze:         alerts.alarmSnooze,
    sirenActive:         alerts.sirenActive,
    fetchNotifications:  alerts.fetchNotifications,
    setIncidents:        alerts.setIncidents,
    addIncident:         alerts.addIncident,
    acknowledgeIncident: alerts.acknowledgeIncident,
    setAlarmSnooze:      alerts.setAlarmSnooze,
    cancelAlarmSnooze:   alerts.cancelAlarmSnooze,
    setSirenActive:      alerts.setSirenActive,

    // --- từ useDeviceStore ---
    activeDevice:           devices.activeDevice,
    house:                  devices.house,
    camera:                 devices.camera,
    iotDevices:             devices.iotDevices,
    deviceGroups:           devices.deviceGroups,
    isLoadingDevices:       devices.isLoadingDevices,
    setActiveDevice:        devices.setActiveDevice,
    setHouseMode:           devices.setHouseMode,
    updateHouseAddress:     devices.updateHouseAddress,
    toggleCameraSleep:      devices.toggleCameraSleep,
    toggleCameraAIProtect:  devices.toggleCameraAIProtect,
    setCameraResolution:    devices.setCameraResolution,
    addIoTDevice:           devices.addIoTDevice,
    removeIoTDevice:        devices.removeIoTDevice,
    addDeviceGroup:         devices.addDeviceGroup,
    updateDeviceGroup:      devices.updateDeviceGroup,
    removeDeviceGroup:      devices.removeDeviceGroup,
    assignDevicesToGroup:   devices.assignDevicesToGroup,
    fetchHouseFromBackend:  devices.fetchHouseFromBackend,
    fetchGroupsFromBackend: devices.fetchGroupsFromBackend,
    fetchDevicesFromBackend: devices.fetchDevicesFromBackend,
    syncAllWithBackend:     devices.syncAllWithBackend,

    // --- từ usePatientStore ---
    patientRecord:       patient.patientRecord,
    todayReminders:      patient.todayReminders,
    isLoadingReminders:  patient.isLoadingReminders,
    isLoadingPatient:    patient.isLoadingPatient,
    fetchReminders:      patient.fetchReminders,
    fetchPatientRecord:  patient.fetchPatientRecord,
    updatePatientRecord: patient.updatePatientRecord,
    enrollPatientFace:   patient.enrollPatientFace,

    // --- từ useThemeStore (bridge) ---
    isDarkMode:     theme.isDarkMode,
    toggleDarkMode: theme.toggleTheme,
    setDarkMode:    theme.setDarkMode,
  };
}

/**
 * @deprecated Sử dụng các domain stores chuyên biệt thay thế.
 * Shim này tổng hợp state từ 4 stores để duy trì backward compatibility.
 */
export function useVitalStore() {
  const health  = useHealthStore();
  const alerts  = useAlertStore();
  const devices = useDeviceStore();
  const patient = usePatientStore();
  const theme   = useThemeStore();

  return {
    // --- từ useHealthStore ---
    currentVitals:       health.currentVitals,
    isConnected:         health.isConnected,
    selectedDate:        health.selectedDate,
    algoSettings:        health.algoSettings,
    isLoadingVitals:     health.isLoadingVitals,
    isLoadingMode:       health.isLoadingMode,
    fetchVitals:         health.fetchVitals,
    fetchSystemMode:     health.fetchSystemMode,
    setVitals:           health.setVitals,
    setConnected:        health.setConnected,
    setSelectedDate:     health.setSelectedDate,
    updateAlgoSettings:  health.updateAlgoSettings,

    // --- từ useAlertStore ---
    incidents:           alerts.incidents,
    alarmSnooze:         alerts.alarmSnooze,
    sirenActive:         alerts.sirenActive,
    fetchNotifications:  alerts.fetchNotifications,
    setIncidents:        alerts.setIncidents,
    addIncident:         alerts.addIncident,
    acknowledgeIncident: alerts.acknowledgeIncident,
    setAlarmSnooze:      alerts.setAlarmSnooze,
    cancelAlarmSnooze:   alerts.cancelAlarmSnooze,
    setSirenActive:      alerts.setSirenActive,

    // --- từ useDeviceStore ---
    activeDevice:           devices.activeDevice,
    house:                  devices.house,
    camera:                 devices.camera,
    iotDevices:             devices.iotDevices,
    deviceGroups:           devices.deviceGroups,
    isLoadingDevices:       devices.isLoadingDevices,
    setActiveDevice:        devices.setActiveDevice,
    setHouseMode:           devices.setHouseMode,
    updateHouseAddress:     devices.updateHouseAddress,
    toggleCameraSleep:      devices.toggleCameraSleep,
    toggleCameraAIProtect:  devices.toggleCameraAIProtect,
    setCameraResolution:    devices.setCameraResolution,
    addIoTDevice:           devices.addIoTDevice,
    removeIoTDevice:        devices.removeIoTDevice,
    addDeviceGroup:         devices.addDeviceGroup,
    updateDeviceGroup:      devices.updateDeviceGroup,
    removeDeviceGroup:      devices.removeDeviceGroup,
    assignDevicesToGroup:   devices.assignDevicesToGroup,
    fetchHouseFromBackend:  devices.fetchHouseFromBackend,
    fetchGroupsFromBackend: devices.fetchGroupsFromBackend,
    fetchDevicesFromBackend: devices.fetchDevicesFromBackend,
    syncAllWithBackend:     devices.syncAllWithBackend,

    // --- từ usePatientStore ---
    patientRecord:       patient.patientRecord,
    todayReminders:      patient.todayReminders,
    isLoadingReminders:  patient.isLoadingReminders,
    isLoadingPatient:    patient.isLoadingPatient,
    fetchReminders:      patient.fetchReminders,
    fetchPatientRecord:  patient.fetchPatientRecord,
    updatePatientRecord: patient.updatePatientRecord,
    enrollPatientFace:   patient.enrollPatientFace,

    // --- từ useThemeStore (bridge) ---
    isDarkMode:     theme.isDarkMode,
    toggleDarkMode: theme.toggleTheme,
    setDarkMode:    theme.setDarkMode,
  };
}

useVitalStore.getState = getVitalState;

// ---- Auth Store (persisted & decoupled) ----
export { useAuthStore } from './useAuthStore';
export type { AuthStoreState } from './useAuthStore';

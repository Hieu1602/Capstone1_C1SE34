// Backward-compatible facade over the domain-specific stores.

import { useHealthStore, type VitalData } from './useHealthStore';
import { useAlertStore, type Incident, type AlarmSnoozeInfo } from './useAlertStore';
import { useDeviceStore, type Device, type HouseInfo, type CameraDevice, type IoTDeviceItem } from './useDeviceStore';
import {
  usePatientStore,
  type PatientMedicalRecord,
  type RemindersData,
  type ReminderItem,
  type MedicalConditionItem,
} from './usePatientStore';
import { useThemeStore } from './useThemeStore';

export type {
  VitalData,
  Incident,
  AlarmSnoozeInfo,
  Device,
  HouseInfo,
  CameraDevice,
  IoTDeviceItem,
  PatientMedicalRecord,
  RemindersData,
  ReminderItem,
  MedicalConditionItem,
};
export { useAuthStore } from './useAuthStore';
export type { AuthStoreState } from './useAuthStore';

function createVitalState(
  health: ReturnType<typeof useHealthStore.getState>,
  alerts: ReturnType<typeof useAlertStore.getState>,
  devices: ReturnType<typeof useDeviceStore.getState>,
  patient: ReturnType<typeof usePatientStore.getState>,
  theme: ReturnType<typeof useThemeStore.getState>,
) {
  return {
    currentVitals: health.currentVitals,
    isConnected: health.isConnected,
    selectedDate: health.selectedDate,
    algoSettings: health.algoSettings,
    isLoadingVitals: health.isLoadingVitals,
    isLoadingMode: health.isLoadingMode,
    fetchVitals: health.fetchVitals,
    fetchSystemMode: health.fetchSystemMode,
    setVitals: health.setVitals,
    setConnected: health.setConnected,
    setSelectedDate: health.setSelectedDate,
    updateAlgoSettings: health.updateAlgoSettings,
    incidents: alerts.incidents,
    alarmSnooze: alerts.alarmSnooze,
    sirenActive: alerts.sirenActive,
    fetchNotifications: alerts.fetchNotifications,
    setIncidents: alerts.setIncidents,
    addIncident: alerts.addIncident,
    acknowledgeIncident: alerts.acknowledgeIncident,
    setAlarmSnooze: alerts.setAlarmSnooze,
    cancelAlarmSnooze: alerts.cancelAlarmSnooze,
    setSirenActive: alerts.setSirenActive,
    activeDevice: devices.activeDevice,
    house: devices.house,
    camera: devices.camera,
    iotDevices: devices.iotDevices,
    deviceGroups: devices.deviceGroups,
    isLoadingDevices: devices.isLoadingDevices,
    setActiveDevice: devices.setActiveDevice,
    setHouseMode: devices.setHouseMode,
    updateHouseAddress: devices.updateHouseAddress,
    toggleCameraSleep: devices.toggleCameraSleep,
    toggleCameraAIProtect: devices.toggleCameraAIProtect,
    setCameraResolution: devices.setCameraResolution,
    addIoTDevice: devices.addIoTDevice,
    removeIoTDevice: devices.removeIoTDevice,
    addDeviceGroup: devices.addDeviceGroup,
    updateDeviceGroup: devices.updateDeviceGroup,
    removeDeviceGroup: devices.removeDeviceGroup,
    assignDevicesToGroup: devices.assignDevicesToGroup,
    fetchHouseFromBackend: devices.fetchHouseFromBackend,
    fetchGroupsFromBackend: devices.fetchGroupsFromBackend,
    fetchDevicesFromBackend: devices.fetchDevicesFromBackend,
    syncAllWithBackend: devices.syncAllWithBackend,
    patientRecord: patient.patientRecord,
    todayReminders: patient.todayReminders,
    isLoadingReminders: patient.isLoadingReminders,
    isLoadingPatient: patient.isLoadingPatient,
    fetchReminders: patient.fetchReminders,
    fetchPatientRecord: patient.fetchPatientRecord,
    enrollPatientFace: patient.enrollPatientFace,
    isDarkMode: theme.isDarkMode,
    toggleDarkMode: theme.toggleTheme,
    setDarkMode: theme.setDarkMode,
  };
}

function getVitalState() {
  return createVitalState(
    useHealthStore.getState(),
    useAlertStore.getState(),
    useDeviceStore.getState(),
    usePatientStore.getState(),
    useThemeStore.getState(),
  );
}

function useVitalStoreHook() {
  return createVitalState(
    useHealthStore(),
    useAlertStore(),
    useDeviceStore(),
    usePatientStore(),
    useThemeStore(),
  );
}

export const useVitalStore = Object.assign(useVitalStoreHook, { getState: getVitalState });

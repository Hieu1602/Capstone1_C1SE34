// useDeviceStore.ts
// Domain Store: IoT Devices, Camera, House, Device Groups
// Tách từ useVitalStore.ts (Single Responsibility Principle)

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { houseApi, deviceGroupApi, devicesApi } from '../services/deviceService';

// ---- Types ----
export interface Device {
  id: string;
  device_id: string;
  name: string;
  location: string;
  is_online: boolean;
}

export interface HouseInfo {
  name: string;
  address: string;
  membersCount: number;
  currentMode: 'AWAY' | 'HOME' | 'NIGHT' | 'DISARM' | 'ALARM' | 'PRIVACY';
}

export interface CameraDevice {
  id: string;
  name: string;
  room: string;
  isOnline: boolean;
  isSleep: boolean;
  isAIProtect: boolean;
  resolution: 'HD' | 'BASIC' | '2K' | 'FHD' | 'SD';
  sdCardStatus: 'OK' | 'NO_CARD';
  wifiStrength: number;
  streamUrl: string;
}

export interface IoTDeviceItem {
  id: string;
  name: string;
  sub: string;
  type: string;
  status: string;
  isOnline: boolean;
  icon: string;
  color: string;
  location?: string;
  streamUrl?: string;
  macAddress?: string;
}

interface DeviceState {
  activeDevice: Device | null;
  house: HouseInfo;
  camera: CameraDevice;
  iotDevices: IoTDeviceItem[];
  deviceGroups: string[];
  isLoadingDevices: boolean;

  // Actions
  setActiveDevice: (device: Device | null) => void;
  setHouseMode: (mode: HouseInfo['currentMode']) => void;
  updateHouseAddress: (address: string) => void;
  toggleCameraSleep: () => void;
  toggleCameraAIProtect: () => void;
  setCameraResolution: (res: CameraDevice['resolution']) => void;
  addIoTDevice: (device: IoTDeviceItem) => void;
  removeIoTDevice: (deviceId: string) => void;
  addDeviceGroup: (groupName: string) => void;
  updateDeviceGroup: (oldName: string, newName: string, deviceIds?: string[]) => void;
  removeDeviceGroup: (groupName: string) => void;
  assignDevicesToGroup: (deviceIds: string[], groupName: string) => void;
  fetchHouseFromBackend: () => Promise<void>;
  fetchGroupsFromBackend: () => Promise<void>;
  fetchDevicesFromBackend: () => Promise<void>;
  syncAllWithBackend: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      activeDevice: null,
      house: {
        name: 'Nhà của tôi',
        address: '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu, TP. Đà Nẵng',
        membersCount: 1,
        currentMode: 'HOME',
      },
      camera: {
        id: 'SECA_001',
        name: 'Camera AI An Ninh',
        room: 'Phòng khách',
        isOnline: true,
        isSleep: false,
        isAIProtect: true,
        resolution: '2K',
        sdCardStatus: 'OK',
        wifiStrength: 3,
        streamUrl: 'http://10.0.2.2:8080',
      },
      iotDevices: [],
      deviceGroups: [],
      isLoadingDevices: false,

      setActiveDevice: (device) => set({ activeDevice: device }),

      setHouseMode: (mode) => {
        set((state) => ({ house: { ...state.house, currentMode: mode } }));
        houseApi.updateHouseMode(mode).catch((err) =>
          console.log('[DeviceStore] Không thể đồng bộ chế độ nhà lên backend:', err)
        );
      },

      updateHouseAddress: (address) => {
        set((state) => ({ house: { ...state.house, address } }));
        houseApi.updateHouse({ address }).catch((err) =>
          console.log('[DeviceStore] Không thể đồng bộ địa chỉ nhà lên backend:', err)
        );
      },

      toggleCameraSleep: () => {
        const nextVal = !get().camera.isSleep;
        set((state) => ({ camera: { ...state.camera, isSleep: nextVal } }));
        devicesApi.updateDeviceConfig(get().camera.id, { is_sleep: nextVal }).catch((err) =>
          console.log('[DeviceStore] Không thể đồng bộ trạng thái ngủ camera lên backend:', err)
        );
      },

      toggleCameraAIProtect: () => {
        const nextVal = !get().camera.isAIProtect;
        set((state) => ({ camera: { ...state.camera, isAIProtect: nextVal } }));
        devicesApi.updateDeviceConfig(get().camera.id, { is_ai_protect: nextVal }).catch((err) =>
          console.log('[DeviceStore] Không thể đồng bộ AI Protect camera lên backend:', err)
        );
      },

      setCameraResolution: (res) =>
        set((state) => ({ camera: { ...state.camera, resolution: res } })),

      addIoTDevice: (device) => {
        set((state) => ({ iotDevices: [device, ...state.iotDevices] }));
        const isCam = device.type === 'camera';
        devicesApi
          .createDevice({
            device_id: device.id,
            name: device.name,
            sub_title: device.sub,
            device_type: isCam ? 'CAMERA' : 'SMARTBAND',
            location: device.location || 'Phòng khách',
          })
          .catch((err) =>
            console.log('[DeviceStore] Thiết bị lưu local cache, đồng bộ backend sau:', err)
          );
      },

      removeIoTDevice: (deviceId) => {
        set((state) => ({ iotDevices: state.iotDevices.filter((d) => d.id !== deviceId) }));
        devicesApi.deleteDevice(deviceId).catch((err) =>
          console.log('[DeviceStore] Xóa thiết bị backend failed:', err)
        );
      },

      addDeviceGroup: (groupName) => {
        const trimmed = groupName.trim();
        if (!trimmed) return;
        const exists = get().deviceGroups.some(
          (g) => g.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (!exists) {
          set((state) => ({ deviceGroups: [...state.deviceGroups, trimmed] }));
          deviceGroupApi.createGroup({ name: trimmed }).catch((err) =>
            console.log('[DeviceStore] Tạo nhóm backend failed:', err)
          );
        }
      },

      updateDeviceGroup: (oldName, newName, deviceIds?) => {
        const trimmedNew = newName.trim();
        const trimmedOld = oldName.trim();
        const updatedGroups = get().deviceGroups.map((g) =>
          g.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : g
        );
        let updatedDevices = get().iotDevices;
        if (deviceIds) {
          updatedDevices = updatedDevices.map((dev) => {
            if (deviceIds.includes(dev.id)) return { ...dev, location: trimmedNew };
            if (dev.location?.trim().toLowerCase() === trimmedOld.toLowerCase())
              return { ...dev, location: 'Chưa nhóm' };
            return dev;
          });
        } else if (trimmedOld.toLowerCase() !== trimmedNew.toLowerCase()) {
          updatedDevices = updatedDevices.map((dev) =>
            dev.location?.trim().toLowerCase() === trimmedOld.toLowerCase()
              ? { ...dev, location: trimmedNew }
              : dev
          );
        }
        set({ deviceGroups: updatedGroups, iotDevices: updatedDevices });
        (async () => {
          try {
            const groupsRes = await deviceGroupApi.listGroups();
            const found = groupsRes.data.find(
              (g: any) => g.name.toLowerCase() === trimmedOld.toLowerCase()
            );
            if (found) await deviceGroupApi.updateGroup(found.id, { name: trimmedNew });
          } catch (err) {
            console.log('[DeviceStore] Cập nhật nhóm backend failed:', err);
          }
        })();
      },

      removeDeviceGroup: (groupName) => {
        set((state) => ({
          deviceGroups: state.deviceGroups.filter(
            (g) => g.trim().toLowerCase() !== groupName.trim().toLowerCase()
          ),
          iotDevices: state.iotDevices.map((dev) =>
            dev.location?.trim().toLowerCase() === groupName.trim().toLowerCase()
              ? { ...dev, location: 'Chưa nhóm' }
              : dev
          ),
        }));
        (async () => {
          try {
            const groupsRes = await deviceGroupApi.listGroups();
            const found = groupsRes.data.find(
              (g: any) => g.name.toLowerCase() === groupName.trim().toLowerCase()
            );
            if (found) await deviceGroupApi.deleteGroup(found.id);
          } catch (err) {
            console.log('[DeviceStore] Xóa nhóm backend failed:', err);
          }
        })();
      },

      assignDevicesToGroup: (deviceIds, groupName) => {
        set((state) => ({
          iotDevices: state.iotDevices.map((dev) =>
            deviceIds.includes(dev.id) ? { ...dev, location: groupName } : dev
          ),
        }));
        (async () => {
          try {
            const groupsRes = await deviceGroupApi.listGroups();
            const found = groupsRes.data.find(
              (g: any) => g.name.toLowerCase() === groupName.trim().toLowerCase()
            );
            if (found) await deviceGroupApi.assignDevices(deviceIds, found.id);
          } catch (err) {
            console.log('[DeviceStore] Gán thiết bị vào nhóm backend failed:', err);
          }
        })();
      },

      fetchHouseFromBackend: async () => {
        try {
          const res = await houseApi.getCurrentHouse();
          if (res.data) {
            set((state) => ({
              house: {
                ...state.house,
                name: res.data.name,
                address: res.data.address || state.house.address,
                currentMode: res.data.current_mode,
              },
            }));
          }
        } catch (e) {
          console.log('[DeviceStore] fetchHouseFromBackend fallback to cache');
        }
      },

      fetchGroupsFromBackend: async () => {
        try {
          const res = await deviceGroupApi.listGroups();
          if (res.data && Array.isArray(res.data)) {
            set({ deviceGroups: res.data.map((g: any) => g.name) });
          }
        } catch (e) {
          console.log('[DeviceStore] fetchGroupsFromBackend fallback to cache');
        }
      },

      fetchDevicesFromBackend: async () => {
        try {
          const res = await devicesApi.listDevices();
          if (res.data && Array.isArray(res.data)) {
            const mapped: IoTDeviceItem[] = res.data.map((dev: any) => {
              const isCam = dev.device_type === 'CAMERA';
              const isBand = dev.device_type === 'SMARTBAND';
              const isHub = dev.device_type === 'EDGE_HUB';
              return {
                id: dev.device_id || dev.id,
                name: dev.name,
                sub: dev.sub_title || (isCam
                  ? 'Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều'
                  : isBand
                  ? 'Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập'
                  : isHub
                  ? 'Bộ xử lý biên AI tại chỗ'
                  : 'Cảm biến an toàn'),
                type: isCam ? 'camera' : isBand ? 'watch' : isHub ? 'hub' : 'sensor',
                status: dev.status_text || (dev.is_online ? 'Trực tuyến' : 'Ngoại tuyến'),
                isOnline: dev.is_online,
                icon: isCam ? 'videocam' : isBand ? 'watch' : isHub ? 'server' : 'hardware-chip',
                color: isCam ? '#FF7A00' : isBand ? '#10B981' : isHub ? '#F59E0B' : '#0EA5E9',
                location: dev.location || 'Chưa nhóm',
                streamUrl: dev.config?.stream_url || undefined,
                macAddress: dev.mac_address || undefined,
              };
            });
            set({ iotDevices: mapped });

            if (mapped.length > 0 && !get().activeDevice) {
              const firstOnline = res.data.find((d: any) => d.is_online) || res.data[0];
              set({
                activeDevice: {
                  id: firstOnline.id,
                  device_id: firstOnline.device_id,
                  name: firstOnline.name,
                  location: firstOnline.location || 'Phòng khách',
                  is_online: firstOnline.is_online,
                },
              });
            }

            const firstCam = res.data.find((d: any) => d.device_type === 'CAMERA');
            if (firstCam) {
              set((state) => ({
                camera: {
                  ...state.camera,
                  id: firstCam.device_id,
                  name: firstCam.name,
                  room: firstCam.location || 'Phòng khách',
                  isOnline: firstCam.is_online,
                  isSleep: Boolean(firstCam.config?.is_sleep),
                  isAIProtect: Boolean(firstCam.config?.is_ai_protect ?? true),
                  resolution: (firstCam.config?.resolution as CameraDevice['resolution']) || '2K',
                  streamUrl: firstCam.config?.stream_url || state.camera.streamUrl,
                },
              }));
            }
          }
        } catch (e) {
          console.log('[DeviceStore] fetchDevicesFromBackend fallback to cache');
        }
      },

      syncAllWithBackend: async () => {
        set({ isLoadingDevices: true });
        try {
          await Promise.allSettled([
            get().fetchHouseFromBackend(),
            get().fetchGroupsFromBackend(),
            get().fetchDevicesFromBackend(),
          ]);
        } finally {
          set({ isLoadingDevices: false });
        }
      },
    }),
    {
      name: 'device-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Chỉ persist những field cần thiết, không persist loading states
      partialize: (state) => ({
        house: state.house,
        camera: state.camera,
        iotDevices: state.iotDevices,
        deviceGroups: state.deviceGroups,
        activeDevice: state.activeDevice,
      }),
    }
  )
);

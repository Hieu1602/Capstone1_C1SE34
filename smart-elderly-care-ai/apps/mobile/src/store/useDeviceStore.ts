/**
 * useDeviceStore.ts
 * Domain Store: IoT Devices, Camera AI, House & Device Groups
 * Người làm: DuongVanHieu
 * Nghiệp vụ: Quản lý tập trung trạng thái thiết bị ngoại vi, đồng bộ hai chiều (Client Cache + Backend FastAPI)
 * và tự động chuyển đổi thông số phần cứng thành model giao diện.
 */
import { Platform } from "react-native";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  houseApi,
  deviceGroupApi,
  devicesApi,
} from "../services/deviceService";
const getDefaultStreamUrl = () => {
  if (Platform.OS === "android") {
    return "http://192.168.1.5:8080";
  }
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location
  ) {
    return `http://${window.location.hostname || "localhost"}:8080`;
  }
  return "http://localhost:8080";
};
/** Ánh xạ giá trị mặc định cho từng dòng phần cứng ngoại vi (DRY & O(1) Lookup) */
const DEVICE_TYPE_DEFAULTS: Record<
  string,
  { sub: string; type: string; icon: string; color: string }
> = {
  CAMERA: {
    sub: "Camera góc rộng • 2K Super HD • Đàm thoại 2 chiều",
    type: "camera",
    icon: "videocam",
    color: "#FF7A00",
  },
  SMARTBAND: {
    sub: "Nhịp tim • SpO₂ • Gia tốc kế phát hiện va đập",
    type: "watch",
    icon: "watch",
    color: "#10B981",
  },
  EDGE_HUB: {
    sub: "Bộ xử lý biên AI tại chỗ",
    type: "hub",
    icon: "server",
    color: "#F59E0B",
  },
  SENSOR: {
    sub: "Cảm biến an toàn",
    type: "sensor",
    icon: "hardware-chip",
    color: "#0EA5E9",
  },
};
/** Tra cứu ID của nhóm theo tên từ backend (Tách logic lặp lại từ lần 3 - Rule DRY) */
const getGroupIdByName = async (name: string): Promise<string | null> => {
  try {
    const res = await deviceGroupApi.listGroups();
    const target = name.trim().toLowerCase();
    const found = res.data?.find((g) => g.name.trim().toLowerCase() === target);
    return found?.id ?? null;
  } catch (err) {
    console.log("[DeviceStore] Không thể tra cứu nhóm backend:", err);
    return null;
  }
};
// ---- Types ----
export interface Device {
  id: string;
  device_id: string;
  name: string;
  location: string;
  is_online: boolean;
}
export interface HouseInfo {
  id?: string;
  name: string;
  address: string;
  membersCount: number;
  currentMode: "AWAY" | "HOME" | "NIGHT" | "DISARM" | "ALARM" | "PRIVACY";
  hasHouse?: boolean;
}
export interface CameraDevice {
  id: string;
  name: string;
  room: string;
  isOnline: boolean;
  isSleep: boolean;
  isAIProtect: boolean;
  resolution: "HD" | "BASIC" | "2K" | "FHD" | "SD";
  sdCardStatus: "NO_CARD" | "NO_CARD";
  wifiStrength: number;
  streamUrl: string;
}
export interface IoTDeviceItem {
  id: string;
  deviceId?: string;
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
  setHouseMode: (mode: HouseInfo["currentMode"]) => void;
  updateHouseAddress: (address: string) => void;
  toggleCameraSleep: () => void;
  toggleCameraAIProtect: () => void;
  setCameraResolution: (res: CameraDevice["resolution"]) => void;
  addIoTDevice: (device: IoTDeviceItem) => void;
  removeIoTDevice: (deviceId: string) => void;
  addDeviceGroup: (groupName: string) => void;
  updateDeviceGroup: (
    oldName: string,
    newName: string,
    deviceIds?: string[],
  ) => void;
  removeDeviceGroup: (groupName: string) => void;
  assignDevicesToGroup: (deviceIds: string[], groupName: string) => void;
  fetchHouseFromBackend: () => Promise<void>;
  fetchGroupsFromBackend: () => Promise<void>;
  fetchDevicesFromBackend: () => Promise<void>;
  syncAllWithBackend: () => Promise<void>;
  resetDeviceStore: () => void;
}
export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      activeDevice: null,
      house: {
        id: "",
        name: "",
        address: "",
        membersCount: 0,
        currentMode: "HOME",
        hasHouse: false,
      },
      camera: {
        id: "",
        name: "",
        room: "",
        isOnline: false,
        isSleep: false,
        isAIProtect: false,
        resolution: "2K",
        sdCardStatus: "NO_CARD",
        wifiStrength: 0,
        streamUrl: "",
      },
      iotDevices: [],
      deviceGroups: [],
      isLoadingDevices: false,
      setActiveDevice: (device) => set({ activeDevice: device }),
      setHouseMode: (mode) => {
        set((state) => ({ house: { ...state.house, currentMode: mode } }));
        houseApi
          .updateHouseMode(mode)
          .catch((err) =>
            console.log(
              "[DeviceStore] Không thể đồng bộ chế độ nhà lên backend:",
              err,
            ),
          );
      },
      updateHouseAddress: (address) => {
        set((state) => ({ house: { ...state.house, address } }));
        houseApi
          .updateHouse({ address })
          .catch((err) =>
            console.log(
              "[DeviceStore] Không thể đồng bộ địa chỉ nhà lên backend:",
              err,
            ),
          );
      },
      toggleCameraSleep: () => {
        const nextVal = !get().camera.isSleep;
        set((state) => ({ camera: { ...state.camera, isSleep: nextVal } }));
        devicesApi
          .updateDeviceConfig(get().camera.id, { is_sleep: nextVal })
          .catch((err) =>
            console.log(
              "[DeviceStore] Không thể đồng bộ trạng thái ngủ camera lên backend:",
              err,
            ),
          );
      },
      toggleCameraAIProtect: () => {
        const nextVal = !get().camera.isAIProtect;
        set((state) => ({ camera: { ...state.camera, isAIProtect: nextVal } }));
        devicesApi
          .updateDeviceConfig(get().camera.id, { is_ai_protect: nextVal })
          .catch((err) =>
            console.log(
              "[DeviceStore] Không thể đồng bộ AI Protect camera lên backend:",
              err,
            ),
          );
      },
      setCameraResolution: (res) =>
        set((state) => ({ camera: { ...state.camera, resolution: res } })),
      addIoTDevice: (device) => {
        set((state) => ({ iotDevices: [device, ...state.iotDevices] }));
        const isCam = device.type === "camera";
        devicesApi
          .createDevice({
            device_id: device.id,
            name: device.name,
            sub_title: device.sub,
            device_type: isCam ? "CAMERA" : "SMARTBAND",
            location: device.location || "Phòng khách",
          })
          .catch((err) =>
            console.log(
              "[DeviceStore] Thiết bị lưu local cache, đồng bộ backend sau:",
              err,
            ),
          );
      },
      removeIoTDevice: (deviceId) => {
        set((state) => ({
          iotDevices: state.iotDevices.filter((d) => d.id !== deviceId),
        }));
        devicesApi
          .deleteDevice(deviceId)
          .catch((err) =>
            console.log("[DeviceStore] Xóa thiết bị backend failed:", err),
          );
      },
      addDeviceGroup: (groupName) => {
        const trimmed = groupName.trim();
        if (!trimmed) return;
        const exists = get().deviceGroups.some(
          (g) => g.trim().toLowerCase() === trimmed.toLowerCase(),
        );
        if (!exists) {
          set((state) => ({ deviceGroups: [...state.deviceGroups, trimmed] }));
          deviceGroupApi
            .createGroup({ name: trimmed })
            .catch((err) =>
              console.log("[DeviceStore] Tạo nhóm backend failed:", err),
            );
        }
      },
      updateDeviceGroup: (oldName, newName, deviceIds?) => {
        const trimmedNew = newName.trim();
        const trimmedOld = oldName.trim();
        if (!trimmedNew || !trimmedOld) return;
        const updatedGroups = get().deviceGroups.map((g) =>
          g.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : g,
        );
        let updatedDevices = get().iotDevices;
        if (deviceIds) {
          updatedDevices = updatedDevices.map((dev) => {
            if (deviceIds.includes(dev.id))
              return { ...dev, location: trimmedNew };
            if (dev.location?.trim().toLowerCase() === trimmedOld.toLowerCase())
              return { ...dev, location: "Chưa nhóm" };
            return dev;
          });
        } else if (trimmedOld.toLowerCase() !== trimmedNew.toLowerCase()) {
          updatedDevices = updatedDevices.map((dev) =>
            dev.location?.trim().toLowerCase() === trimmedOld.toLowerCase()
              ? { ...dev, location: trimmedNew }
              : dev,
          );
        }
        set({ deviceGroups: updatedGroups, iotDevices: updatedDevices });
        (async () => {
          const groupId = await getGroupIdByName(trimmedOld);
          if (groupId) {
            await deviceGroupApi.updateGroup(groupId, { name: trimmedNew });
          }
        })().catch((err) =>
          console.log("[DeviceStore] Cập nhật nhóm backend failed:", err),
        );
      },
      removeDeviceGroup: (groupName) => {
        const target = groupName.trim();
        if (!target) return;
        set((state) => ({
          deviceGroups: state.deviceGroups.filter(
            (g) => g.trim().toLowerCase() !== target.toLowerCase(),
          ),
          iotDevices: state.iotDevices.map((dev) =>
            dev.location?.trim().toLowerCase() === target.toLowerCase()
              ? { ...dev, location: "Chưa nhóm" }
              : dev,
          ),
        }));
        (async () => {
          const groupId = await getGroupIdByName(target);
          if (groupId) {
            await deviceGroupApi.deleteGroup(groupId);
          }
        })().catch((err) =>
          console.log("[DeviceStore] Xóa nhóm backend failed:", err),
        );
      },
      assignDevicesToGroup: (deviceIds, groupName) => {
        const target = groupName.trim();
        if (!target) return;
        set((state) => ({
          iotDevices: state.iotDevices.map((dev) =>
            deviceIds.includes(dev.id) ? { ...dev, location: target } : dev,
          ),
        }));
        (async () => {
          const groupId = await getGroupIdByName(target);
          if (groupId) {
            await deviceGroupApi.assignDevices(deviceIds, groupId);
          }
        })().catch((err) =>
          console.log(
            "[DeviceStore] Gán thiết bị vào nhóm backend failed:",
            err,
          ),
        );
      },
      fetchHouseFromBackend: async () => {
        try {
          const res = await houseApi.getCurrentHouse();
          if (res.data && res.data.id) {
            set((state) => ({
              house: {
                ...state.house,
                id: res.data.id,
                name: res.data.name || "Căn nhà gia đình",
                address: res.data.address || "",
                currentMode: res.data.current_mode || "HOME",
                hasHouse: true,
              },
            }));
          } else {
            set((state) => ({
              house: {
                ...state.house,
                id: "",
                name: "",
                hasHouse: false,
              },
            }));
          }
        } catch {
          // Người dùng mới chưa có căn nhà nào (HTTP 404)
          set({
            house: {
              id: "",
              name: "",
              address: "",
              membersCount: 0,
              currentMode: "HOME",
              hasHouse: false,
            },
            activeDevice: null,
            iotDevices: [],
            deviceGroups: [],
            camera: {
              id: "",
              name: "",
              room: "",
              isOnline: false,
              isSleep: false,
              isAIProtect: false,
              resolution: "2K",
              sdCardStatus: "NO_CARD",
              wifiStrength: 0,
              streamUrl: "",
            },
          });
        }
      },
      fetchGroupsFromBackend: async () => {
        try {
          const res = await deviceGroupApi.listGroups();
          if (res.data && Array.isArray(res.data)) {
            set({ deviceGroups: res.data.map((g: any) => g.name) });
          }
        } catch {
          console.log("[DeviceStore] fetchGroupsFromBackend fallback to cache");
        }
      },
      fetchDevicesFromBackend: async () => {
        try {
          const res = await devicesApi.listDevices();
          if (res.data && Array.isArray(res.data)) {
            const mapped: IoTDeviceItem[] = res.data.map((dev: any) => {
              const def =
                DEVICE_TYPE_DEFAULTS[dev.device_type] ||
                DEVICE_TYPE_DEFAULTS.SENSOR;
              return {
                id: String(dev.id || dev.device_id),
                deviceId: dev.device_id || dev.id,
                name: dev.name,
                sub: dev.sub_title || def.sub,
                type: def.type,
                status:
                  dev.status_text ||
                  (dev.is_online ? "Trực tuyến" : "Ngoại tuyến"),
                isOnline: Boolean(dev.is_online),
                icon: def.icon,
                color: def.color,
                location: dev.location || "Chưa nhóm",
                streamUrl: dev.config?.stream_url || undefined,
                macAddress: dev.mac_address || undefined,
              };
            });
            set({ iotDevices: mapped });
            if (mapped.length > 0) {
              if (!get().activeDevice) {
                const firstOnline =
                  res.data.find((d: any) => d.is_online) || res.data[0];
                set({
                  activeDevice: {
                    id: firstOnline.id,
                    device_id: firstOnline.device_id,
                    name: firstOnline.name,
                    location: firstOnline.location || "Phòng khách",
                    is_online: firstOnline.is_online,
                  },
                });
              }
            } else {
              set({ activeDevice: null });
            }
            const firstCam = res.data.find(
              (d: any) => d.device_type === "CAMERA",
            );
            if (firstCam) {
              set((state) => ({
                camera: {
                  ...state.camera,
                  id: firstCam.device_id,
                  name: firstCam.name,
                  room: firstCam.location || "Phòng khách",
                  isOnline: firstCam.is_online,
                  isSleep: Boolean(firstCam.config?.is_sleep),
                  isAIProtect: Boolean(firstCam.config?.is_ai_protect ?? true),
                  resolution:
                    (firstCam.config
                      ?.resolution as CameraDevice["resolution"]) || "2K",
                  streamUrl:
                    firstCam.config?.stream_url || state.camera.streamUrl,
                },
              }));
            } else {
              set((state) => ({
                camera: {
                  ...state.camera,
                  id: "",
                  name: "",
                  room: "",
                  isOnline: false,
                  streamUrl: "",
                },
              }));
            }
          }
        } catch (e) {
          console.log(
            "[DeviceStore] fetchDevicesFromBackend fallback to cache",
          );
          if (!get().house?.hasHouse) {
            set({ iotDevices: [], activeDevice: null });
          }
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
      resetDeviceStore: () =>
        set({
          activeDevice: null,
          house: {
            id: "",
            name: "",
            address: "",
            membersCount: 0,
            currentMode: "HOME",
            hasHouse: false,
          },
          camera: {
            id: "",
            name: "",
            room: "",
            isOnline: false,
            isSleep: false,
            isAIProtect: false,
            resolution: "2K",
            sdCardStatus: "NO_CARD",
            wifiStrength: 0,
            streamUrl: "",
          },
          iotDevices: [],
          deviceGroups: [],
          isLoadingDevices: false,
        }),
    }),
    {
      name: "device-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Chỉ persist những field cần thiết, không persist loading states
      partialize: (state) => ({
        house: state.house,
        camera: state.camera,
        iotDevices: state.iotDevices,
        deviceGroups: state.deviceGroups,
        activeDevice: state.activeDevice,
      }),
    },
  ),
);

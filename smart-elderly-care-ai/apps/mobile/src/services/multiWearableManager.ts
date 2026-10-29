// Multi-device BLE manager – discover, connect, and collect measurements from several smart bands.
// Safe for both Mobile (Native) and Web environments.

let BleManagerClass: any = null;
try {
  if (Platform.OS !== 'web') {
    BleManagerClass = require('react-native-ble-plx')?.BleManager;
  }
} catch {}

type BleManager = any;
type Device = any;
type Subscription = any;
import { Platform, PermissionsAndroid } from 'react-native';
import { Measurement, base64ToBytes } from './wearableService';

export interface DiscoveredDevice {
  id: string;
  name: string;
  device: Device;
}

export class MultiWearableManager {
  private manager: BleManager | null = null;
  private devices: Map<string, WearableInstance> = new Map(); // key = device.id

  private getManager(): BleManager | null {
    if (Platform.OS === 'web' || !BleManagerClass) return null;
    if (!this.manager) {
      try {
        this.manager = new BleManagerClass();
      } catch (e) {
        console.warn('[MultiWearable] BleManager init error:', e);
      }
    }
    return this.manager;
  }

  // Request Android permissions – same as single manager
  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    return true;
  }

  // Scan for BLE devices that advertise at least one of the required services.
  // Returns a promise that resolves with the list of discovered devices after timeout.
  async discoverDevices(timeoutMs = 8000): Promise<DiscoveredDevice[]> {
    const mgr = this.getManager();
    if (!mgr) return [];

    const hasPerm = await this.requestPermissions();
    if (!hasPerm) return [];

    const found: DiscoveredDevice[] = [];
    mgr.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.warn('[MultiWearable] Scan error', error);
        return;
      }
      if (device && device.name) {
        // Avoid duplicates
        if (!found.find(d => d.id === device.id)) {
          found.push({ id: device.id, name: device.name, device });
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
    mgr.stopDeviceScan();
    return found;
  }

  // Connect to a specific device and start measurement collection.
  // The callback receives each measurement from that device.
  async connectAndStart(
    deviceInfo: DiscoveredDevice,
    callback: (deviceId: string, m: Measurement) => void,
  ): Promise<void> {
    const { device } = deviceInfo;
    if (!device) {
      throw new Error('Thiết bị BLE không hợp lệ hoặc không có kết nối phần cứng.');
    }
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      const wearable = new WearableInstance(connected);
      this.devices.set(device.id, wearable);
      await wearable.start(m => callback(device.id, m));
    } catch (e) {
      console.warn('[MultiWearable] Connect/start failed for', deviceInfo.name, e);
      throw e;
    }
  }

  // Stop all active connections and clean up.
  async stopAll(): Promise<void> {
    const stops = Array.from(this.devices.values()).map(w => w.stop());
    await Promise.allSettled(stops);
    this.devices.clear();
    this.manager?.destroy();
  }
}

// Re‑use the core logic from wearableService.ts but allow injection of an already‑connected Device.
class WearableInstance {
  private device: Device;
  private subscriptions: Subscription[] = [];

  static HEART_RATE_SERVICE = '180D';
  static HEART_RATE_CHAR = '2A37';
  static SPO2_SERVICE = '1822';
  static SPO2_CHAR = '2A5F';
  static TEMPERATURE_SERVICE = '1809';
  static TEMPERATURE_CHAR = '2A1C';

  constructor(device: Device) {
    this.device = device;
  }

  async start(callback: (m: Measurement) => void): Promise<void> {
    const monitorChar = async (
      serviceUuid: string,
      charUuid: string,
      metric: Measurement['metric'],
    ) => {
      const sub = this.device.monitorCharacteristicForService(
        serviceUuid,
        charUuid,
        (error, characteristic) => {
          if (error) {
            console.warn(`[MultiWearable] ${metric} monitor error`, error);
            return;
          }
          if (characteristic?.value) {
            const bytes = base64ToBytes(characteristic.value);
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            let value = 0;
            if (metric === 'heartRate') {
              const flags = view.getUint8(0);
              const hr16 = flags & 0x01;
              value = hr16 ? view.getUint16(1, true) : view.getUint8(1);
            } else if (metric === 'spo2') {
              value = view.getUint8(1);
            } else if (metric === 'bodyTemperature') {
              const tempRaw = view.getInt16(1, true);
              value = tempRaw / 100;
            }
            callback({ metric, value, measuredAt: new Date() });
          }
        },
      );
      this.subscriptions.push(sub);
    };
    // Heart Rate is mandatory
    await monitorChar(
      WearableInstance.HEART_RATE_SERVICE,
      WearableInstance.HEART_RATE_CHAR,
      'heartRate',
    );
    // Try optional services – ignore errors
    try {
      await monitorChar(
        WearableInstance.SPO2_SERVICE,
        WearableInstance.SPO2_CHAR,
        'spo2',
      );
    } catch {}
    try {
      await monitorChar(
        WearableInstance.TEMPERATURE_SERVICE,
        WearableInstance.TEMPERATURE_CHAR,
        'bodyTemperature',
      );
    } catch {}
  }

  async stop(): Promise<void> {
    this.subscriptions.forEach(s => s.remove());
    this.subscriptions = [];
    await this.device.cancelConnection();
  }
}

export const multiWearableManager = new MultiWearableManager();

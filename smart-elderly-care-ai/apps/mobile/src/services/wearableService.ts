import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

export interface Measurement {
  metric: 'heartRate' | 'spo2' | 'bodyTemperature';
  value: number;
  measuredAt: Date;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = typeof atob !== 'undefined'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class WearableManager {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];

  static HEART_RATE_SERVICE = '180D';
  static HEART_RATE_CHAR = '2A37';
  static SPO2_SERVICE = '1822';
  static SPO2_CHAR = '2A5F';
  static TEMPERATURE_SERVICE = '1809';
  static TEMPERATURE_CHAR = '2A1C';

  private getManager(): BleManager | null {
    if (Platform.OS === 'web') return null;
    if (!this.manager) {
      try {
        this.manager = new BleManager();
      } catch (e) {
        console.warn('[Wearable] BleManager init error:', e);
      }
    }
    return this.manager;
  }

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

  async start(callback: (m: Measurement) => void): Promise<void> {
    const mgr = this.getManager();
    if (!mgr) return;
    const hasPerm = await this.requestPermissions();
    if (!hasPerm) return;

    mgr.startDeviceScan(
      [WearableManager.HEART_RATE_SERVICE],
      null,
      async (error, device) => {
        if (error || !device) return;
        mgr.stopDeviceScan();
        try {
          const connected = await device.connect();
          await connected.discoverAllServicesAndCharacteristics();
          this.device = connected;
          this.subscribe(connected, callback);
        } catch (e) {
          console.warn('[Wearable] Connection failed', e);
          this.fallbackHealthKit(callback);
        }
      }
    );
  }

  private subscribe(device: Device, callback: (m: Measurement) => void) {
    const sub = device.monitorCharacteristicForService(
      WearableManager.HEART_RATE_SERVICE,
      WearableManager.HEART_RATE_CHAR,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const bytes = base64ToBytes(characteristic.value);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const flags = view.getUint8(0);
        const hr16 = flags & 0x01;
        const value = hr16 ? view.getUint16(1, true) : view.getUint8(1);
        callback({ metric: 'heartRate', value, measuredAt: new Date() });
      }
    );
    this.subscriptions.push(sub);
  }

  private async fallbackHealthKit(callback: (m: Measurement) => void) {
    if (Platform.OS === 'web') return;
    try {
      // Dynamic import to prevent crash on Web TurboModuleRegistry
      const mod = require('@mbdayo/react-native-health-kits');
      const HealthKits = mod.default || mod;
      if (!HealthKits?.readData) return;

      const records = await HealthKits.readData({
        type: 'heartRate',
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(),
      });
      if (Array.isArray(records) && records.length > 0) {
        const latest = records[records.length - 1] as any;
        const val = typeof latest.value === 'number' ? latest.value : (latest.heartRate ?? 0);
        const dt = latest.date || latest.startDate || latest.endTime || Date.now();
        callback({ metric: 'heartRate', value: val, measuredAt: new Date(dt) });
      }
    } catch (e) {
      console.warn('[Wearable] HealthKit fallback failed', e);
    }
  }

  async stop(): Promise<void> {
    this.subscriptions.forEach(s => s.remove());
    this.subscriptions = [];
    if (this.device) {
      await this.device.cancelConnection().catch(() => {});
      this.device = null;
    }
    this.manager?.stopDeviceScan();
  }
}

export const wearableManager = new WearableManager();

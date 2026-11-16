export type ScannedDevice = {
  deviceId: string;
  type: 'camera' | 'watch';
};

export const parseDeviceQr = (data: string, barcodeType = 'qr'): ScannedDevice | null => {
  const deviceId = data.trim().toUpperCase();
  if (barcodeType === 'code128') {
    if (/^(?![0-9A-F]{12}$)[A-Z0-9]{10,32}$/.test(deviceId)) {
      return { deviceId: `TAPO_SN_${deviceId}`, type: 'camera' };
    }
    return null;
  }

  if (
    deviceId.length > 100 ||
    !/^(SECA|CAM|CAMERA|BLE|SMARTBAND|WATCH)[-_][A-Z0-9_-]+$/.test(deviceId)
  ) {
    return null;
  }

  return {
    deviceId,
    type: /^(BLE|SMARTBAND|WATCH)[-_]/.test(deviceId) ? 'watch' : 'camera',
  };
};

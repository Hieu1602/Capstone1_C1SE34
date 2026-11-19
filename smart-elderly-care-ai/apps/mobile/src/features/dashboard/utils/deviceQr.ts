export type ScannedDevice = {
  deviceId: string;
  type: 'camera' | 'watch';
  brand?: string;
  mac?: string;
  sn?: string;
  suggestedName?: string;
  username?: string;
  password?: string;
};

// Nhận diện OUI đăng ký của TP-Link Tapo
const TP_LINK_OUIS = ['0CEF15', '50C7BF', '14EBCE', '54AF97', '704F57', 'B0A7B9', 'C006C3'];

export const parseDeviceQr = (data: string, barcodeType = 'qr'): ScannedDevice | null => {
  if (!data) return null;
  const raw = data.trim();
  const upper = raw.toUpperCase().replace(/^(S\/N|SN|MAC)[:\s-]+/, '');

  // 1. Kiểm tra nếu là địa chỉ MAC (0C-EF-15-15-80-C5 hoặc 0C:EF:15:15:80:C5 hoặc 0CEF151580C5)
  const cleanMac = upper.replace(/[:-]/g, '');
  if (/^[0-9A-F]{12}$/.test(cleanMac)) {
    const formattedMac = cleanMac.match(/.{1,2}/g)?.join(':') || upper;
    const isTpLink = TP_LINK_OUIS.some((oui) => cleanMac.startsWith(oui));
    const brand = isTpLink ? 'TP-Link Tapo' : 'Camera IP';
    const suggestedName = isTpLink ? 'Camera Tapo C200C' : `Camera (${cleanMac.slice(-4)})`;
    return {
      deviceId: `CAM_MAC_${cleanMac}`,
      type: 'camera',
      brand,
      mac: formattedMac,
      suggestedName,
      username: 'admin123',
      password: 'admin123',
    };
  }

  // 2. Kiểm tra nếu là Serial Number (Code 128 / Code 39 / Code 93 / EAN 13 / QR)
  const is1DBarcode = ['code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar'].includes(barcodeType.toLowerCase());
  if (is1DBarcode || /^[0-9]{5}[A-Z0-9]{8,24}$/.test(upper) || /^[A-Z0-9]{10,32}$/.test(upper)) {
    const snPart = upper.split(/[\s/]/)[0];
    if (/^[A-Z0-9]{8,32}$/.test(snPart)) {
      const isTpLink = /^[0-9]{5}[A-Z0-9]{8,15}$/.test(snPart);
      return {
        deviceId: `CAM_SN_${snPart}`,
        type: 'camera',
        brand: isTpLink ? 'TP-Link Tapo' : 'Camera IP',
        sn: snPart,
        suggestedName: isTpLink ? `Camera Tapo (${snPart.slice(-4)})` : `Camera (${snPart.slice(-4)})`,
        username: 'admin123',
        password: 'admin123',
      };
    }
  }

  // 3. Chuỗi QR Code SECA / Camera / BLE
  if (
    upper.length <= 100 &&
    /^(SECA|CAM|CAMERA|BLE|SMARTBAND|WATCH)[-_][A-Z0-9_-]+$/.test(upper)
  ) {
    const isWatch = /^(BLE|SMARTBAND|WATCH)[-_]/.test(upper);
    return {
      deviceId: upper,
      type: isWatch ? 'watch' : 'camera',
      brand: isWatch ? 'Vòng tay thông minh' : 'TP-Link Tapo',
      suggestedName: isWatch ? `Vòng tay ${upper.slice(-4)}` : `Camera An Ninh ${upper.slice(-4)}`,
      username: isWatch ? undefined : 'admin123',
      password: isWatch ? undefined : 'admin123',
    };
  }

  return null;
};

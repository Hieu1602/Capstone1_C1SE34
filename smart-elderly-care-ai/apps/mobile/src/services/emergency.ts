import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { emergencyApi } from './api';

// Số điện thoại dùng cho Test Mode khi gọi khẩn cấp SOS (UI vẫn hiển thị 115)
export const EMERGENCY_TEST_PHONE = '0898230852';

/** Xin quyền CALL_PHONE trên Android để tự động gọi trực tiếp (ACTION_CALL) khi hết đếm ngược SOS. */
export async function requestEmergencyCallPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
    if (already) return true;
    const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
      title: 'Quyền gọi khẩn cấp tự động',
      message: 'SmartCare AI cần quyền gọi điện để tự động liên hệ cấp cứu khi hết thời gian chờ 45s.',
      buttonPositive: 'Cho phép',
      buttonNegative: 'Từ chối',
    });
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Thực hiện gọi khẩn cấp: trên Android APK ưu tiên Native ACTION_CALL (tự bấm gọi luôn),
 * fallback sang Linking.openURL('tel:...') trên Web / iOS / Expo Go.
 */
export async function dialEmergencyNumber(phone = EMERGENCY_TEST_PHONE): Promise<void> {
  if (Platform.OS === 'android' && NativeModules.NativeNotificationModule?.placeEmergencyCall) {
    try {
      await requestEmergencyCallPermission();
      const mode = await NativeModules.NativeNotificationModule.placeEmergencyCall(phone);
      if (mode === 'CALLED' || mode === 'DIALED') {
        return;
      }
    } catch (err) {
      console.warn('[EmergencySOS] Native placeEmergencyCall failed, falling back to Linking:', err);
    }
  }
  await Linking.openURL(`tel:${phone}`);
}

export async function launchEmergencyCall() {
  const notificationRequest = emergencyApi.triggerSOS().then(
    ({ data }) => {
      if (data?.notification_sent === 0 || data?.notification_failed > 0) {
        console.warn('[EmergencySOS] Household notification delivery was incomplete:', data);
      }
    },
    (error) => {
      console.warn('[EmergencySOS] Could not notify household through backend:', error);
    },
  );

  // Start dialing immediately; do not wait for the backend in an emergency.
  await dialEmergencyNumber(EMERGENCY_TEST_PHONE);
  void notificationRequest;
}

export const SUPPORT_HOTLINE_NUMBER = '0898230852';

export async function launchSupportCall(topic = 'Hỗ trợ kết nối camera, vòng tay, hub AI') {
  let dialUri = `tel:${SUPPORT_HOTLINE_NUMBER}`;

  const supportRequest = emergencyApi.requestSupportCall({ topic }).then(
    ({ data }) => {
      if (typeof data?.dial_uri === 'string' && data.dial_uri.startsWith('tel:')) {
        dialUri = data.dial_uri;
      }
    },
    (error) => {
      console.warn('[SupportHotline] Could not log support call through backend:', error);
    },
  );

  await Promise.race([
    supportRequest,
    new Promise((resolve) => setTimeout(resolve, 600)),
  ]);

  await Linking.openURL(dialUri);
}


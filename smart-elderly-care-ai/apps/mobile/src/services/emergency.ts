import { Linking } from 'react-native';
import { emergencyApi } from './api';

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
  await Linking.openURL('tel:115');
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


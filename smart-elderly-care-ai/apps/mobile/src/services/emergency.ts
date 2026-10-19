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

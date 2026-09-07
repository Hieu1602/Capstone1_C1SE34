// fcm.ts
// Firebase Cloud Messaging – xử lý push notification khẩn cấp
// Còi hú ghi đè chế độ im lặng trên Android / iOS

import { Alert, Platform, Vibration } from 'react-native';

type AlertLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

let messaging: any = null;
if (Platform.OS !== 'web') {
  try {
    messaging = require('@react-native-firebase/messaging').default;
  } catch (e) {
    console.warn('[FCM] Native Firebase Messaging not available:', e);
  }
}

class FCMService {
  private unsubscribeForeground: (() => void) | null = null;

  // ------------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (Platform.OS === 'web' || !messaging) {
      console.log('[FCM] Running on web or without native Firebase module. Skipping FCM initialization.');
      return;
    }
    await this._requestPermission();
    await this._registerToken();
    this._setupForegroundHandler();
    this._setupBackgroundHandler();
    this._handleInitialNotification();
  }

  // ------------------------------------------------------------------
  // Permission
  // ------------------------------------------------------------------

  private async _requestPermission(): Promise<void> {
    if (!messaging) return;
    try {
      const authStatus = await messaging().requestPermission({
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: true,  // iOS: critical alert ghi đè silent mode
        provisional: false,
        sound: true,
      });

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('[FCM] Push notification permission denied.');
      }
    } catch (e) {
      console.warn('[FCM] Error requesting permission:', e);
    }
  }

  // ------------------------------------------------------------------
  // Token Registration
  // ------------------------------------------------------------------

  private async _registerToken(): Promise<void> {
    if (!messaging) return;
    try {
      const token = await messaging().getToken();
      console.log('[FCM] Device token:', token);
    } catch (err) {
      console.error('[FCM] Failed to get device token:', err);
    }

    messaging().onTokenRefresh(async (newToken: string) => {
      console.log('[FCM] Token refreshed:', newToken);
    });
  }

  // ------------------------------------------------------------------
  // Foreground Handler (App đang mở)
  // ------------------------------------------------------------------

  private _setupForegroundHandler(): void {
    if (!messaging) return;
    this.unsubscribeForeground = messaging().onMessage(
      async (remoteMessage: any) => {
        console.log('[FCM] Foreground message:', remoteMessage);

        const { notification, data } = remoteMessage;
        const level = (data?.alert_level as AlertLevel) || 'MEDIUM';
        const message = notification?.body || data?.message || 'Cảnh báo mới từ hệ thống';

        this._triggerAlert(level, message);
      },
    );
  }

  // ------------------------------------------------------------------
  // Background / Quit State Handler
  // ------------------------------------------------------------------

  private _setupBackgroundHandler(): void {
    if (!messaging) return;
    try {
      messaging().setBackgroundMessageHandler(
        async (remoteMessage: any) => {
          console.log('[FCM] Background message:', remoteMessage);
          return Promise.resolve();
        },
      );
    } catch (e) {
      console.warn('[FCM] Background handler setup warning:', e);
    }
  }

  private async _handleInitialNotification(): Promise<void> {
    if (!messaging) return;
    try {
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        console.log('[FCM] Opened from quit state:', initialNotification);
      }
    } catch (e) {
      console.warn('[FCM] Error getting initial notification:', e);
    }
  }

  // ------------------------------------------------------------------
  // Alert Trigger
  // ------------------------------------------------------------------

  private _triggerAlert(level: AlertLevel, message: string): void {
    if (level === 'CRITICAL' || level === 'HIGH') {
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 200, 500, 200, 500], false);
      }

      Alert.alert(
        level === 'CRITICAL' ? '🚨 KHẨN CẤP!' : '⚠️ CẢNH BÁO!',
        message,
        [
          { text: 'Xem chi tiết', style: 'default' },
          { text: 'Đã xử lý', style: 'cancel' },
        ],
        { cancelable: false },
      );
    }
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  cleanup(): void {
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
    }
  }
}

export const fcmService = new FCMService();

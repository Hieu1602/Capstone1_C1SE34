// fcm.ts
// Firebase Cloud Messaging – xử lý push notification khẩn cấp
// Còi hú ghi đè chế độ im lặng trên Android / iOS

import { NativeModules, Platform, Vibration } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { LocalizedAlert } from '../i18n/LocalizedComponents';

type AlertLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Kiểm tra môi trường Expo Go hoặc thiếu Native Module Firebase
const hasNativeFirebase = Boolean(NativeModules && NativeModules.RNFBAppModule);
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo' ||
  !hasNativeFirebase;

let messaging: any = null;
if (Platform.OS !== 'web' && hasNativeFirebase && !isExpoGo) {
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
    if (Platform.OS === 'web' || !messaging || isExpoGo || !hasNativeFirebase) {
      console.log('[FCM] Running in Expo Go, on web, or without native Firebase module. Skipping FCM initialization.');
      return;
    }
    try {
      await this._requestPermission();
      await this._registerToken();
      this._setupForegroundHandler();
      this._setupBackgroundHandler();
      this._handleInitialNotification();
    } catch (e) {
      console.warn('[FCM] Skipping native FCM init error:', e);
    }
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

      messaging().onTokenRefresh(async (newToken: string) => {
        console.log('[FCM] Token refreshed:', newToken);
      });
    } catch (err) {
      console.warn('[FCM] Failed to get device token:', err);
    }
  }

  // ------------------------------------------------------------------
  // Foreground Handler (App đang mở)
  // ------------------------------------------------------------------

  private _setupForegroundHandler(): void {
    if (!messaging) return;
    try {
      this.unsubscribeForeground = messaging().onMessage(
        async (remoteMessage: any) => {
          console.log('[FCM] Foreground message:', remoteMessage);

          const { notification, data } = remoteMessage;
          const level: AlertLevel = (data?.level as AlertLevel) || 'HIGH';

          if (level === 'CRITICAL' || level === 'HIGH') {
            this._triggerVibrationPattern(level);
          }

          LocalizedAlert.alert(
            notification?.title || 'Cảnh báo khẩn cấp',
            notification?.body || 'Phát hiện sự cố bất thường!',
            [{ text: 'Đã hiểu', style: 'default' }]
          );
        },
      );
    } catch (e) {
      console.warn('[FCM] Foreground handler setup error:', e);
    }
  }

  private _triggerVibrationPattern(level: AlertLevel): void {
    if (Platform.OS === 'web') return;
    if (level === 'CRITICAL') {
      Vibration.vibrate([0, 1000, 500, 1000, 500, 1000], false);
    } else {
      Vibration.vibrate([0, 500, 200, 500], false);
    }
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

      LocalizedAlert.alert(
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

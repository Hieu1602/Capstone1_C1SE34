// fcm.ts
// Firebase Cloud Messaging – xử lý push notification khẩn cấp
// Hiển thị trực tiếp lên thanh thông báo hệ thống (Notification Drawer) và còi hú ghi đè chế độ im lặng trên Android / iOS

import { NativeModules, Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { LocalizedAlert } from '../i18n/LocalizedComponents';
import { notificationService } from './notificationService';
import { usersApi } from './api';

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
        criticalAlert: true, // iOS: critical alert ghi đè silent mode
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
  // Token Registration & Sync
  // ------------------------------------------------------------------

  private async _registerToken(): Promise<void> {
    if (!messaging) return;
    try {
      const token = await messaging().getToken();
      console.log('[FCM] Device token:', token);
      await this._syncTokenToBackend(token);

      messaging().onTokenRefresh(async (newToken: string) => {
        console.log('[FCM] Token refreshed:', newToken);
        await this._syncTokenToBackend(newToken);
      });
    } catch (err) {
      console.warn('[FCM] Failed to get device token:', err);
    }
  }

  private async _syncTokenToBackend(token: string): Promise<void> {
    if (!token) return;
    try {
      await AsyncStorage.setItem('user_fcm_token', token);
      await usersApi.updateFcmToken(token);
      console.log('[FCM] Đã đồng bộ FCM Token lên máy chủ backend thành công.');
    } catch (e) {
      // Có thể người dùng chưa đăng nhập, token vẫn được lưu trong AsyncStorage để gửi khi login
      console.log('[FCM] Lưu token cục bộ (sẽ đồng bộ khi đăng nhập).');
    }
  }

  /**
   * Đồng bộ lại FCM token khi người dùng đăng nhập thành công
   */
  async syncTokenOnLogin(): Promise<void> {
    try {
      let token = await AsyncStorage.getItem('user_fcm_token');
      if (!token && messaging && !isExpoGo && hasNativeFirebase) {
        token = await messaging().getToken();
        if (token) await AsyncStorage.setItem('user_fcm_token', token);
      }
      if (token) {
        await usersApi.updateFcmToken(token);
        console.log('[FCM] Đã cập nhật fcm_token sau khi đăng nhập.');
      }
    } catch (e) {
      console.warn('[FCM] Lỗi cập nhật fcm_token sau đăng nhập:', e);
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
          const title = notification?.title || data?.title || '🚨 Cảnh báo SmartCare AI';
          const body = notification?.body || data?.body || data?.message || 'Phát hiện sự cố bất thường!';

          // 1. Luôn bắn thông báo lên thanh trạng thái (Notification Drawer) của điện thoại
          await notificationService.triggerEmergencyNotification({
            title,
            body,
            data,
          });

          // 2. Rung điện thoại theo mức độ cảnh báo
          if (level === 'CRITICAL' || level === 'HIGH') {
            this._triggerVibrationPattern(level);
          }

          // 3. Hiển thị hộp thoại trong app
          LocalizedAlert.alert(
            title,
            body,
            [
              {
                text: 'Đã hiểu / Tắt chuông',
                style: 'default',
                onPress: () => {
                  notificationService.stopEmergencyAlarm();
                },
              },
            ]
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
      Vibration.vibrate([0, 1000, 400, 1000, 400, 1000, 800], true);
    } else {
      Vibration.vibrate([0, 800, 400, 800], true);
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
          const { notification, data } = remoteMessage;
          const title = notification?.title || data?.title || '🚨 Cảnh báo SmartCare AI';
          const body = notification?.body || data?.body || data?.message || 'Phát hiện sự cố bất thường!';

          // Bắn thông báo lên thanh trạng thái khi app ở chế độ chạy nền
          await notificationService.triggerEmergencyNotification({
            title,
            body,
            data,
          });

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
  // Cleanup
  // ------------------------------------------------------------------

  cleanup(): void {
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
    }
  }
}

export const fcmService = new FCMService();

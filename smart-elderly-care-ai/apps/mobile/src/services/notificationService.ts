// notificationService.ts
// Quản lý thông báo đẩy cục bộ (Local Notifications) và rung thiết bị khi có thông báo bác sĩ / khẩn cấp
// Tự động kiểm tra môi trường: Android Native Module, iOS hoặc Web fallback

import { Platform, NativeModules, Vibration } from 'react-native';

const { NativeNotificationModule } = NativeModules;

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (Platform.OS !== 'web') {
      try {
        const Notifications = require('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          console.log('[NotificationService] Quyền thông báo cục bộ đã được cấp.');
        }
      } catch (err) {
        // expo-notifications không có sẵn, NativeNotificationModule sẽ đảm nhiệm
      }
    }
    this.isInitialized = true;
  }

  startBackgroundMonitor(serverUrl: string): void {
    if (Platform.OS === 'android' && NativeNotificationModule?.startBackgroundMonitor) {
      try {
        NativeNotificationModule.startBackgroundMonitor(serverUrl);
        console.log('[NotificationService] Đã kích hoạt Android Foreground Service tới server:', serverUrl);
      } catch (err) {
        console.warn('[NotificationService] Lỗi kích hoạt Background Service:', err);
      }
    }
  }

  stopBackgroundMonitor(): void {
    if (Platform.OS === 'android' && NativeNotificationModule?.stopBackgroundMonitor) {
      try {
        NativeNotificationModule.stopBackgroundMonitor();
      } catch (err) {
        console.warn('[NotificationService] Lỗi dừng Background Service:', err);
      }
    }
  }

  async triggerEmergencyNotification(payload: NotificationPayload): Promise<void> {
    const { title, body, data } = payload;

    if (Platform.OS !== 'web') {
      // 1. Kích hoạt rung điện thoại ngay lập tức
      try {
        Vibration.vibrate([0, 500, 200, 500], false);
      } catch (vibErr) {
        console.warn('[NotificationService] Lỗi rung thiết bị:', vibErr);
      }

      // 2. Bắn thông báo lên thanh trạng thái (Notification Drawer) qua Android Native Module
      if (Platform.OS === 'android' && NativeNotificationModule?.showNotification) {
        try {
          NativeNotificationModule.showNotification(title, body);
          return;
        } catch (nativeErr) {
          console.warn('[NotificationService] NativeNotificationModule failed:', nativeErr);
        }
      }

      // 3. Fallback qua expo-notifications nếu có
      try {
        const Notifications = require('expo-notifications');
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: data || {},
            sound: true,
            priority: Notifications.AndroidNotificationPriority?.MAX ?? 'max',
          },
          trigger: null,
        });
        return;
      } catch (e) {
        // Fallback im lặng
      }
    }

    // 4. Web hoặc fallback: Hiển thị browser notification nếu được cấp quyền
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.png' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.png' });
          }
        });
      }
    }
  }
}

export const notificationService = new NotificationService();

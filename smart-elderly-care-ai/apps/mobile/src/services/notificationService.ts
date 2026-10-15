// notificationService.ts
// Quản lý thông báo đẩy cục bộ (Local Notifications) cho sự cố Critical bằng expo-notifications
// Tự động kiểm tra môi trường: Native (iOS/Android) hoặc Web fallback

import { Platform, Alert } from 'react-native';

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
        console.log('[NotificationService] expo-notifications fallback:', err);
      }
    }
    this.isInitialized = true;
  }

  async triggerEmergencyNotification(payload: NotificationPayload): Promise<void> {
    const { title, body, data } = payload;

    if (Platform.OS !== 'web') {
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
          trigger: null, // Bắn thông báo ngay lập tức
        });
        return;
      } catch (e) {
        console.warn('[NotificationService] Không thể bắn native notification:', e);
      }
    }

    // Web hoặc fallback: Hiển thị browser notification nếu được cấp quyền
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

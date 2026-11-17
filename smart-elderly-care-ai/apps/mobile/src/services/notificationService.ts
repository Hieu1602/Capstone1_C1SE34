// notificationService.ts
// Quản lý thông báo đẩy cục bộ (Local Notifications), quyền hệ thống và rung thiết bị khi có thông báo bác sĩ / khẩn cấp
// Hỗ trợ hiển thị trực tiếp trên thanh thông báo (Notification Drawer / Status Bar) của điện thoại Android & iOS

import { Platform, NativeModules, Vibration, PermissionsAndroid } from 'react-native';

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

    if (Platform.OS === 'android') {
      await this.requestNotificationPermission();
    } else if (Platform.OS === 'ios') {
      try {
        const Notifications = require('expo-notifications');
        await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
      } catch (e) {
        // Fallback im lặng nếu expo-notifications chưa cấu hình
      }
    }

    this.isInitialized = true;
  }

  /**
   * Yêu cầu quyền gửi thông báo lên thanh thông báo hệ thống (bắt buộc từ Android 13+)
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      // Android 13+ (API level 33+) yêu cầu xin quyền runtime POST_NOTIFICATIONS
      if (Platform.Version >= 33) {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (!hasPermission) {
          const status = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Cấp quyền thông báo',
              message:
                'SmartCare AI cần quyền gửi thông báo để hiển thị các cảnh báo sức khỏe khẩn cấp, nhắc nhở lịch khám bác sĩ trên thanh thông báo của điện thoại.',
              buttonPositive: 'Cho phép',
              buttonNegative: 'Để sau',
            }
          );
          const granted = status === PermissionsAndroid.RESULTS.GRANTED;
          console.log('[NotificationService] Kết quả cấp quyền POST_NOTIFICATIONS:', status);
          return granted;
        }
        return true;
      }
      return true;
    } catch (err) {
      console.warn('[NotificationService] Lỗi khi kiểm tra/xin quyền thông báo Android:', err);
      return false;
    }
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

  /**
   * Bắn thông báo đẩy lên thanh thông báo hệ thống của điện thoại (Notification Tray / Status Bar)
   */
  async triggerEmergencyNotification(payload: NotificationPayload): Promise<void> {
    const { title, body, data } = payload;
    const alertType = data?.alert_type || data?.type || '';
    const isCritical =
      alertType === 'FALL_DETECTED' ||
      alertType === 'HIGH_HEART_RATE' ||
      alertType === 'LOW_HEART_RATE' ||
      alertType === 'CRITICAL_TRIAD' ||
      alertType === 'LOW_SPO2' ||
      alertType === 'CARDIO_COLLAPSE' ||
      alertType === 'EXERTION_HYPOXIA' ||
      title.includes('🚨') ||
      title.includes('💓') ||
      title.includes('KHẨN CẤP') ||
      title.includes('BÁO ĐỘNG') ||
      title.includes('NGUY CẤP');

    if (Platform.OS !== 'web') {
      // 1. Kích hoạt rung điện thoại: Nếu khẩn cấp -> Rung liên tục (repeat = true)
      try {
        if (isCritical) {
          Vibration.vibrate([0, 1000, 400, 1000, 400, 1000, 800], true);
        } else {
          Vibration.vibrate([0, 500, 250, 500], false);
        }
      } catch (vibErr) {
        console.warn('[NotificationService] Lỗi rung thiết bị:', vibErr);
      }

      // 2. Bắn thông báo lên thanh trạng thái qua NativeNotificationModule
      if (Platform.OS === 'android' && NativeNotificationModule) {
        try {
          if (NativeNotificationModule.triggerEmergencyAlarm) {
            NativeNotificationModule.triggerEmergencyAlarm(title, body, isCritical);
          } else if (NativeNotificationModule.showNotification) {
            NativeNotificationModule.showNotification(title, body);
          }
          console.log('[NotificationService] Đã gửi thông báo qua NativeNotificationModule:', title);
          return;
        } catch (nativeErr) {
          console.warn('[NotificationService] NativeNotificationModule failed:', nativeErr);
        }
      }

      // 3. Fallback qua expo-notifications nếu có
      try {
        const Notifications = require('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

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

  /**
   * Dừng chuông báo động và ngắt rung liên tục
   */
  stopEmergencyAlarm(): void {
    if (Platform.OS !== 'web') {
      try {
        Vibration.cancel();
      } catch (e) {
        console.warn('[NotificationService] Lỗi huỷ rung:', e);
      }
      if (Platform.OS === 'android' && NativeNotificationModule?.stopAlarm) {
        try {
          NativeNotificationModule.stopAlarm();
        } catch (e) {
          console.warn('[NotificationService] Native stopAlarm error:', e);
        }
      }
    }
  }
}

export const notificationService = new NotificationService();

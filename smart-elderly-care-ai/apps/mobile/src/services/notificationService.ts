// notificationService.ts
// Quản lý thông báo đẩy cục bộ (Local Notifications), quyền hệ thống và rung thiết bị khi có thông báo bác sĩ / khẩn cấp
// Hỗ trợ hiển thị trực tiếp trên thanh thông báo (Notification Drawer / Status Bar) của điện thoại Android & iOS

import { Platform, NativeModules, Vibration, PermissionsAndroid, Alert, Linking } from 'react-native';

const { NativeNotificationModule } = NativeModules;

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private isInitialized = false;
  private webAudioCtx: any = null;
  private webAlarmTimer: any = null;
  private webVibTimer: any = null;
  private webIsAlarmPlaying = false;

  private _getAudioContext(): any {
    if (typeof window === 'undefined') return null;
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.webAudioCtx || this.webAudioCtx.state === 'closed') {
      this.webAudioCtx = new AudioCtx();
    }
    if (this.webAudioCtx.state === 'suspended') {
      this.webAudioCtx.resume().catch(() => {});
    }
    return this.webAudioCtx;
  }

  private _startWebAlarm(): void {
    if (typeof window === 'undefined') return;
    this._stopWebAlarm();
    this.webIsAlarmPlaying = true;

    // 1. Rung lặp lại liên tục trên Web Mobile (Chrome / Firefox Android)
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([0, 1000, 400, 1000, 400, 1000, 800]);
        this.webVibTimer = setInterval(() => {
          if (this.webIsAlarmPlaying && 'vibrate' in navigator) {
            navigator.vibrate([0, 1000, 400, 1000, 400, 1000, 800]);
          }
        }, 4600);
      } catch (_) {}
    }

    // 2. Chuông còi hú báo động liên tục (Web Audio Siren)
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;

      let isHigh = true;
      const playBeep = () => {
        if (!this.webIsAlarmPlaying) return;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(isHigh ? 960 : 720, ctx.currentTime);
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
          isHigh = !isHigh;
        } catch (_) {}
      };

      playBeep();
      this.webAlarmTimer = setInterval(playBeep, 380);
    } catch (_) {}
  }

  private _playWebChime(): void {
    if (typeof window === 'undefined') return;
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1150, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch (_) {}
  }

  private _stopWebAlarm(): void {
    this.webIsAlarmPlaying = false;
    if (this.webAlarmTimer) {
      clearInterval(this.webAlarmTimer);
      this.webAlarmTimer = null;
    }
    if (this.webVibTimer) {
      clearInterval(this.webVibTimer);
      this.webVibTimer = null;
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (Platform.OS === 'android') {
      await this.requestNotificationPermission();
      await this.checkAndPromptNotificationPermission();
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

  /**
   * Kiểm tra xem thông báo hệ thống có bị TẮT trong Cài đặt Android không.
   * Nếu bị tắt, hiển thị hướng dẫn mở cài đặt để bật ngay.
   */
  async checkAndPromptNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      if (NativeNotificationModule?.areNotificationsEnabled) {
        const enabled = await NativeNotificationModule.areNotificationsEnabled();
        if (!enabled) {
          Alert.alert(
            '⚠️ Bật thông báo khẩn cấp',
            'Ứng dụng đang bị TẮT quyền thông báo trong Cài đặt hệ thống của điện thoại. Để nhận chuông báo, rung khẩn cấp và thông báo trên thanh kéo xuống khi nhịp tim bất thường hoặc té ngã, vui lòng chọn "Cài đặt ngay" và bật "Cho phép thông báo".',
            [
              { text: 'Để sau', style: 'cancel' },
              {
                text: 'Cài đặt ngay',
                onPress: () => {
                  if (NativeNotificationModule?.openNotificationSettings) {
                    NativeNotificationModule.openNotificationSettings();
                  } else {
                    Linking.openSettings();
                  }
                },
              },
            ]
          );
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  startBackgroundMonitor(serverUrl: string): void {
    if (Platform.OS === 'android' && NativeNotificationModule) {
      try {
        const { useAuthStore } = require('../store/useAuthStore');
        const token = useAuthStore.getState().accessToken || '';
        if (NativeNotificationModule.startBackgroundMonitorWithToken) {
          NativeNotificationModule.startBackgroundMonitorWithToken(serverUrl, token);
        } else if (NativeNotificationModule.startBackgroundMonitor) {
          NativeNotificationModule.startBackgroundMonitor(serverUrl);
        }
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
   * Phân loại sự cố: Trả về true nếu là CẢNH BÁO nguy hiểm khẩn cấp (té ngã, nhịp tim nguy kịch, SpO2 tụt, SOS, v.v.)
   * Trả về false nếu là THÔNG BÁO thường (lịch khám, đơn thuốc, cập nhật bệnh án, gia đình, pin, thông báo hệ thống) -> chỉ lên thanh thông báo Android kèm tiếng "ting ting".
   */
  isCriticalAlert(payload: NotificationPayload): boolean {
    const { title, data } = payload;
    const alertType = String(data?.alert_type || data?.type || '').toUpperCase();

    // 1. Danh sách thông báo bình thường chắc chắn chỉ kêu "ting ting" nhẹ trên thanh thông báo Android (không hú còi báo động)
    const normalTypes = [
      'APPOINTMENT_SCHEDULED',
      'APPOINTMENT_REQUESTED',
      'APPOINTMENT_CONFIRMED',
      'APPOINTMENT_CANCELLED',
      'APPOINTMENT_RESCHEDULED',
      'APPOINTMENT_COMPLETED',
      'APPOINTMENT_DELETED',
      'MEDICAL_RECORD_UPDATED',
      'PRESCRIPTION_CREATED',
      'PRESCRIPTION_UPDATED',
      'PRESCRIPTION_DELETED',
      'MEDICATION_REMINDER',
      'HYDRATION_REMINDER',
      'DEVICE_CONFIG_UPDATED',
      'HOUSE_INVITE_PENDING',
      'HOUSE_JOIN_REQUEST',
      'HOUSE_MEMBER_ADDED',
      'MEMBER_ADDED',
      'HOUSE_MEMBER_REMOVED',
      'HOUSE_JOIN_APPROVED',
      'HOUSE_JOIN_REJECTED',
      'HOUSE_INVITE_REJECTED',
      'SYSTEM_NOTIFICATION',
      'INFO',
      'SYSTEM_MAINTENANCE',
      'HEALTH_TIP',
      'FEATURE_UPDATE',
      'LOW_BATTERY',
      'DEVICE_BATTERY_DEAD',
    ];

    if (normalTypes.includes(alertType) || alertType.startsWith('APPOINTMENT_') || alertType.startsWith('HOUSE_') || alertType.startsWith('PRESCRIPTION_')) {
      return false;
    }

    // 2. Danh sách các cảnh báo sức khỏe / sự cố nguy hiểm thực sự -> Phát chuông báo động kêu to & rung mạnh
    const emergencyTypes = [
      'FALL_DETECTED',
      'AI_FALL_DETECTED',
      'CRITICAL_TRIAD',
      'CARDIO_COLLAPSE',
      'HIGH_HEART_RATE',
      'LOW_HEART_RATE',
      'SUDDEN_HR_SPIKE',
      'SUDDEN_HR_DROP',
      'ARRHYTHMIA_RECURRENT',
      'ARRHYTHMIA_SUSPECT',
      'LOW_SPO2',
      'EXERTION_HYPOXIA',
      'HIGH_FEVER',
      'FEVER_TACHYCARDIA',
      'ACOUSTIC_DISTRESS',
      'SOS_EMERGENCY',
      'EMERGENCY_SOS',
      'OUT_OF_RANGE_NO_PHONE',
      'EMERGENCY',
    ];

    if (emergencyTypes.includes(alertType)) {
      return true;
    }

    // 3. Fallback kiểm tra tiêu đề có chứa các biểu tượng hoặc từ khóa cảnh báo nguy hiểm
    return (
      title.includes('🚨') ||
      title.includes('💓') ||
      title.includes('KHẨN CẤP') ||
      title.includes('BÁO ĐỘNG') ||
      title.includes('NGUY CẤP') ||
      title.includes('TÉ NGÃ')
    );
  }

  /**
   * Hiển thị thông báo thường lên thanh thông báo Android kèm tiếng "ting ting" nhẹ nhàng (không hú còi báo động).
   */
  async showTingTingNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
    return this.triggerEmergencyNotification({
      title,
      body,
      data: { ...(data || {}), alert_type: data?.alert_type || data?.type || 'INFO' },
    });
  }

  /**
   * Bắn thông báo đẩy lên thanh thông báo hệ thống của điện thoại (Notification Tray / Status Bar)
   */
  async triggerEmergencyNotification(payload: NotificationPayload): Promise<void> {
    const { title, body, data } = payload;
    const isCritical = this.isCriticalAlert(payload);

    if (Platform.OS !== 'web') {
      // 1. Chỉ rung liên tục và rung mạnh đối với BÁO ĐỘNG NGUY HIỂM KHẨN CẤP
      // Đối với thông báo thường (lịch khám, tin nhắn): chỉ rung nhẹ 1 nhịp ngắn (haptic feedback)
      try {
        if (isCritical) {
          Vibration.vibrate([0, 1000, 400, 1000, 400, 1000, 800], true);
        } else {
          Vibration.vibrate([0, 150], false);
        }
      } catch (vibErr) {
        console.warn('[NotificationService] Lỗi rung thiết bị:', vibErr);
      }

      // 2. Bắn thông báo lên thanh trạng thái qua NativeNotificationModule
      if (Platform.OS === 'android' && NativeNotificationModule) {
        try {
          if (isCritical) {
            // Báo động nguy hiểm: Hú chuông báo động, rung liên tục, tự động gọi số khẩn cấp sau 30s reo chuông nếu không ai tắt chuông
            const phone = '0898230852';
            if (NativeNotificationModule.triggerEmergencyAlarmWithConfig) {
              NativeNotificationModule.triggerEmergencyAlarmWithConfig(title, body, true, phone, 30);
            } else {
              NativeNotificationModule.triggerEmergencyAlarm(title, body, true);
            }
          } else {
            // Thông báo thông thường (Lịch khám, Tin nhắn): Chỉ phát tiếng ting ting nhẹ nhàng, không hú còi
            NativeNotificationModule.showNotification(title, body);
          }
          console.log('[NotificationService] Đã gửi thông báo qua NativeNotificationModule:', title, { isCritical });
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

    // 4. Web hoặc fallback: Hiển thị browser notification & kích hoạt chuông/rung Web
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
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

      // Kích hoạt chuông còi & rung liên tục trên Web
      if (isCritical) {
        this._startWebAlarm();
      } else {
        this._playWebChime();
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([0, 150]);
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Dừng chuông báo động và ngắt rung liên tục lập tức (0ms)
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

    // Web: Ngắt còi hú và dừng rung tức thì (0ms)
    this._stopWebAlarm();
  }
}

export const notificationService = new NotificationService();

// src/utils/browserNotification.ts
// Quản lý Thông báo đẩy trên Trình duyệt (Browser Desktop Notifications) & Còi báo động lâm sàng Web Audio API
// Đảm bảo Bác sĩ nhận được thông báo âm thanh và pop-up hệ thống của máy tính (Windows/macOS) ngay cả khi chuyển tab hoặc thu nhỏ trình duyệt

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

let sharedAudioCtx: AudioContext | null = null;
let activeAlarmTimeout: any = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Kiểm tra trình duyệt có hỗ trợ Notification API không
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Lấy trạng thái quyền hiện tại ('granted' | 'denied' | 'default' | 'unsupported')
 */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Xin quyền hiển thị thông báo Desktop từ người dùng
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('[BrowserNotification] Lỗi xin quyền thông báo:', err);
    return false;
  }
}

/**
 * Bắn thông báo đẩy Desktop lên hệ điều hành (Notification Center của Windows / macOS)
 * Ngay cả khi bác sĩ đang làm việc ở tab khác hoặc Chrome đang minimize
 */
export function showBrowserNotification(options: BrowserNotificationOptions): Notification | null {
  if (!isBrowserNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const { title, body, icon = '/vite.svg', tag = 'seca-alert', url = '/notifications', requireInteraction = true, onClick } = options;

    const notif = new Notification(title, {
      body,
      icon,
      tag,
      requireInteraction, // Giữ thông báo trên màn hình cho đến khi bác sĩ bấm vào hoặc tắt
      silent: false,
    });

    notif.onclick = () => {
      try {
        window.focus();
      } catch {}
      if (onClick) {
        onClick();
      } else if (url) {
        if (window.location.pathname !== url) {
          window.location.href = url;
        }
      }
      notif.close();
    };

    return notif;
  } catch (err) {
    console.warn('[BrowserNotification] Lỗi hiển thị Desktop Notification:', err);
    return null;
  }
}

/**
 * Phát âm thanh còi báo động khẩn cấp y tế (Two-Tone Medical Alert Beep) qua Web Audio API thuần
 * Tần số: 880Hz (La) và 659Hz (Mi) xen kẽ nhau báo hiệu cấp cứu
 */
export function playEmergencyAlarmSound(durationSeconds = 6): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Dừng timeout cũ nếu đang chạy
  if (activeAlarmTimeout) {
    clearTimeout(activeAlarmTimeout);
    activeAlarmTimeout = null;
  }

  const startTime = ctx.currentTime;
  const cycleCount = Math.min(10, Math.floor(durationSeconds * 2));

  for (let i = 0; i < cycleCount; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Xen kẽ 880Hz (cao) và 659Hz (trung)
    osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 659, startTime + i * 0.3);

    // Fade in / Fade out để tránh tiếng click âm thanh
    gain.gain.setValueAtTime(0.01, startTime + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.35, startTime + i * 0.3 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + i * 0.3 + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime + i * 0.3);
    osc.stop(startTime + i * 0.3 + 0.28);
  }

  activeAlarmTimeout = setTimeout(() => {
    activeAlarmTimeout = null;
  }, durationSeconds * 1000);
}

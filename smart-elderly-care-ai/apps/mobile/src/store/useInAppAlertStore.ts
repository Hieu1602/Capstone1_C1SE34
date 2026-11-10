// ==============================================================================
// useInAppAlertStore.ts – Quản lý trạng thái Alert Modal trong App
// ------------------------------------------------------------------------------
// Thay thế hoàn toàn window.alert trình duyệt ("localhost:8081 says")
// Hiển thị hộp thoại thông báo chuẩn giao diện Mobile ngay trong khung ứng dụng.
// ==============================================================================

import { create } from 'zustand';

export interface AlertButton {
  text?: string;
  onPress?: ((value?: any) => any) | Function;
  style?: 'default' | 'cancel' | 'destructive';
  isPreferred?: boolean;
}

export type AlertType = 'error' | 'success' | 'warning' | 'info';

export interface InAppAlertData {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: AlertType;
}

interface InAppAlertState {
  visible: boolean;
  alertData: InAppAlertData | null;
  showAlert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type?: AlertType
  ) => void;
  hideAlert: () => void;
}

export const useInAppAlertStore = create<InAppAlertState>((set) => ({
  visible: false,
  alertData: null,

  showAlert: (title, message, buttons, type) => {
    let resolvedType: AlertType = type || 'info';

    if (!type) {
      const combined = `${title || ''} ${message || ''}`.toLowerCase();
      if (
        combined.includes('thành công') ||
        combined.includes('success') ||
        combined.includes('đã gửi') ||
        combined.includes('hoàn tất')
      ) {
        resolvedType = 'success';
      } else if (
        combined.includes('thất bại') ||
        combined.includes('lỗi') ||
        combined.includes('sai') ||
        combined.includes('không chính xác') ||
        combined.includes('không hợp lệ') ||
        combined.includes('khóa') ||
        combined.includes('chưa được đăng ký') ||
        combined.includes('error')
      ) {
        resolvedType = 'error';
      } else if (
        combined.includes('chú ý') ||
        combined.includes('cảnh báo') ||
        combined.includes('warning') ||
        combined.includes('thiếu')
      ) {
        resolvedType = 'warning';
      }
    }

    const defaultButtons: AlertButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: 'Đồng ý', style: 'default' }];

    set({
      visible: true,
      alertData: {
        title: title || 'Thông báo',
        message: message || '',
        buttons: defaultButtons,
        type: resolvedType,
      },
    });
  },

  hideAlert: () => set({ visible: false, alertData: null }),
}));

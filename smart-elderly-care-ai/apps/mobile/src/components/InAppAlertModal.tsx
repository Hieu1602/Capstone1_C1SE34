// ==============================================================================
// InAppAlertModal.tsx – Hộp thoại thông báo chuẩn Mobile App (In-App Modal)
// ------------------------------------------------------------------------------
// Hiển thị trực tiếp bên trong màn hình ứng dụng Mobile (cả trên Expo Web & App).
// Tuyệt đối không bật pop-up trình duyệt ("localhost:8081 says").
// ==============================================================================

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInAppAlertStore, AlertButton, AlertType } from '../store/useInAppAlertStore';

interface TypeConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badgeBg: string;
  defaultBtnBg: string;
}

const TYPE_CONFIGS: Record<AlertType, TypeConfig> = {
  error: {
    icon: 'alert-circle',
    iconColor: '#D92D20',
    badgeBg: '#FEF3F2',
    defaultBtnBg: '#D92D20',
  },
  success: {
    icon: 'checkmark-circle',
    iconColor: '#039855',
    badgeBg: '#ECFDF3',
    defaultBtnBg: '#0284C7',
  },
  warning: {
    icon: 'warning',
    iconColor: '#DC6803',
    badgeBg: '#FFFAEB',
    defaultBtnBg: '#EA580C',
  },
  info: {
    icon: 'information-circle',
    iconColor: '#1570EF',
    badgeBg: '#EFF8FF',
    defaultBtnBg: '#0284C7',
  },
};

export const InAppAlertModal: React.FC = () => {
  const { visible, alertData, hideAlert } = useInAppAlertStore();

  if (!visible || !alertData) {
    return null;
  }

  const { title, message, buttons = [], type = 'info' } = alertData;
  const config = TYPE_CONFIGS[type] || TYPE_CONFIGS.info;

  const handleButtonPress = (btn: AlertButton) => {
    hideAlert();
    if (btn.onPress) {
      setTimeout(() => {
        btn.onPress?.();
      }, 50);
    }
  };

  const isMultiButton = buttons.length > 1;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={hideAlert}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={hideAlert}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Icon Badge */}
          <View style={[styles.iconBadge, { backgroundColor: config.badgeBg }]}>
            <Ionicons name={config.icon} size={28} color={config.iconColor} />
          </View>

          {/* Tiêu đề */}
          <Text style={styles.title}>{title}</Text>

          {/* Nội dung thông báo */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Cụm nút hành động */}
          <View
            style={[
              styles.buttonRow,
              isMultiButton ? styles.buttonRowMulti : styles.buttonRowSingle,
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnBg = config.defaultBtnBg;
              let textColor = '#FFFFFF';

              if (isCancel) {
                btnBg = '#F1F5F9';
                textColor = '#475467';
              } else if (isDestructive) {
                btnBg = '#D92D20';
                textColor = '#FFFFFF';
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isMultiButton && styles.buttonFlex,
                    { backgroundColor: btnBg },
                  ]}
                  activeOpacity={0.82}
                  onPress={() => handleButtonPress(btn)}
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>
                    {btn.text || 'Đồng ý'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 999999,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: '#475467',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  buttonRow: {
    width: '100%',
  },
  buttonRowSingle: {
    flexDirection: 'column',
  },
  buttonRowMulti: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
export default InAppAlertModal;

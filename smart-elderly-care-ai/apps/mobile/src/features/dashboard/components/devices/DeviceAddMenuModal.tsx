import React from 'react';
import { View, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface DeviceAddMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onSelectQr: () => void;
  onSelectGroup: () => void;
  isDarkMode?: boolean;
  colors?: any;
}

export const DeviceAddMenuModal: React.FC<DeviceAddMenuModalProps> = ({
  visible,
  onClose,
  onSelectManual,
  onSelectQr,
  onSelectGroup,
  isDarkMode = false,
  colors = {},
}) => {
  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.menuOverlay}>
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.floatingMenuCard,
              isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.menuHeaderIndicator}>
              <LocalizedText style={[styles.menuHeaderLabel, isDarkMode && { color: colors.textSecondary }]}>
                Tùy chọn thiết bị
              </LocalizedText>
            </View>

            {/* 1. Thêm thủ công */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={onSelectManual}
              activeOpacity={0.7}
            >
              <View style={[styles.menuItemIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="construct-outline" size={20} color="#EA580C" />
              </View>
              <View style={styles.menuItemContent}>
                <LocalizedText style={[styles.menuItemTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Thêm thủ công
                </LocalizedText>
                <LocalizedText style={[styles.menuItemDesc, isDarkMode && { color: colors.textSecondary }]}>
                  Camera Wi-Fi, Đồng hồ BLE, IoT Hub
                </LocalizedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, isDarkMode && { backgroundColor: colors.border }]} />

            {/* 2. Quét mã QR */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={onSelectQr}
              activeOpacity={0.7}
            >
              <View style={[styles.menuItemIconBox, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="qr-code-outline" size={20} color="#0284C7" />
              </View>
              <View style={styles.menuItemContent}>
                <LocalizedText style={[styles.menuItemTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Quét mã QR
                </LocalizedText>
                <LocalizedText style={[styles.menuItemDesc, isDarkMode && { color: colors.textSecondary }]}>
                  Quét tem QR trên thân camera/vòng tay
                </LocalizedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, isDarkMode && { backgroundColor: colors.border }]} />

            {/* 3. Nhóm */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={onSelectGroup}
              activeOpacity={0.7}
            >
              <View style={[styles.menuItemIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="layers-outline" size={20} color="#7C3AED" />
              </View>
              <View style={styles.menuItemContent}>
                <LocalizedText style={[styles.menuItemTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Nhóm thiết bị
                </LocalizedText>
                <LocalizedText style={[styles.menuItemDesc, isDarkMode && { color: colors.textSecondary }]}>
                  Tạo & quản lý nhóm phòng, người đeo
                </LocalizedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 999,
  },
  floatingMenuCard: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    ...Shadows.lg,
  },
  menuHeaderIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  menuHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  menuItemIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 10,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuItemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 8,
  },
});

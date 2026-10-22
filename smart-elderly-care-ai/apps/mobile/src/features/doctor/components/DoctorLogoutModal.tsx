import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DoctorLogoutModalProps {
  visible: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorLogoutModal: React.FC<DoctorLogoutModalProps> = ({
  visible,
  onConfirm,
  onClose,
  isDarkMode,
  colors,
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.logoutModalOverlay}>
        <View style={[styles.logoutModalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.logoutModalIconBox}>
            <Ionicons name="log-out-outline" size={32} color="#DC2626" />
          </View>
          <Text style={[styles.logoutModalTitle, { color: colors.textPrimary }]}>
            Đăng xuất tài khoản Bác sĩ
          </Text>
          <Text style={[styles.logoutModalSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Bạn có chắc chắn muốn đăng xuất khỏi hệ thống? Mọi phiên làm việc và bảo mật hồ sơ bệnh án sẽ được kết thúc.
          </Text>
          <View style={styles.logoutModalActions}>
            <TouchableOpacity
              style={[styles.logoutCancelBtn, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.logoutCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                Hủy bỏ
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutConfirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <Ionicons name="log-out" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.logoutConfirmText}>Đăng xuất ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutModalBox: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
  },
  logoutModalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  logoutModalSub: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  logoutModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  logoutCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCancelText: { fontSize: 14, fontWeight: '600' },
  logoutConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

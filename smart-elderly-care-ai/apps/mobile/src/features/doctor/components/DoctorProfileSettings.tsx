import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DoctorProfileSettingsProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  onOpenPasswordModal: () => void;
  onOpenLogoutModal: () => void;
  colors: any;
}

export const DoctorProfileSettings: React.FC<DoctorProfileSettingsProps> = ({
  isDarkMode,
  toggleTheme,
  onOpenPasswordModal,
  onOpenLogoutModal,
  colors,
}) => {
  return (
    <>
      {/* TIỆN ÍCH LÂM SÀNG & HỆ THỐNG */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
        ]}
      >
        <Text style={[styles.groupTitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          TIỆN ÍCH LÂM SÀNG & HỆ THỐNG
        </Text>

        <View style={styles.menuItem}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={17} color="#7C3AED" />
          </View>
          <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
            Chế độ {isDarkMode ? 'Giao diện Tối' : 'Giao diện Sáng'}
          </Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: '#CBD5E1', true: '#7C3AED' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={onOpenPasswordModal}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="key" size={17} color="#D97706" />
          </View>
          <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
            Đổi mật khẩu tài khoản Bác sĩ
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* THÔNG TIN PHIÊN BẢN */}
      <View style={styles.versionBox}>
        <Text style={[styles.versionText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
          Smart Elderly Care AI Hub • Phiên bản Bác sĩ 2.4.0
        </Text>
        <Text style={[styles.versionSub, { color: isDarkMode ? '#475569' : '#CBD5E1' }]}>
          Hệ thống Giám sát & Chăm sóc Y tế Người cao tuổi
        </Text>
      </View>

      {/* NÚT ĐĂNG XUẤT */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onOpenLogoutModal} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
        <Text style={styles.logoutBtnText}>Đăng xuất khỏi tài khoản Bác sĩ</Text>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  groupTitle: { fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F033',
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  menuItemText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  versionBox: { alignItems: 'center', marginVertical: 12 },
  versionText: { fontSize: 11, fontWeight: '600' },
  versionSub: { fontSize: 10, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    marginTop: 4,
  },
  logoutBtnText: { color: '#DC2626', fontSize: 13.5, fontWeight: '700' },
});

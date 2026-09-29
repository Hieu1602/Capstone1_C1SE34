// DoctorProfileScreen.tsx
// Hồ sơ Bác sĩ gia đình, thông tin chuyên môn & nút chuyển đổi chế độ xem

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';

export default function DoctorProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const { userName, userPhone, toggleViewRole, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleSwitchToCaregiver = () => {
    Alert.alert(
      'Chuyển đổi giao diện',
      'Chuyển sang giao diện Người nhà (Caregiver) để kiểm tra góc nhìn của gia đình?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Chuyển đổi', onPress: () => toggleViewRole() },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Hồ Sơ Bác Sĩ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Doctor Info Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBig}>
              <Ionicons name="medical" size={36} color="#FFFFFF" />
            </View>
            <View style={styles.onlineDot} />
          </View>

          <Text style={[styles.docName, { color: colors.textPrimary }]}>
            {userName || 'BS. Trần Văn Minh'}
          </Text>
          <Text style={styles.docSpecialty}>Bác sĩ Chuyên khoa Tim mạch & Lão khoa</Text>
          <Text style={[styles.docHospital, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Bệnh viện Đa khoa Đà Nẵng • SĐT: {userPhone || '0905 111 222'}
          </Text>

          {/* Quick Metrics */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: Colors.primary }]}>2</Text>
              <Text style={styles.statLabel}>Bệnh nhân</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#059669' }]}>3</Text>
              <Text style={styles.statLabel}>Đơn thuốc</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#0284C7' }]}>96%</Text>
              <Text style={styles.statLabel}>Tuân thủ y tế</Text>
            </View>
          </View>
        </View>

        {/* Switch Mode Action (Key Feature for Capstone 1 Demo) */}
        <TouchableOpacity
          style={[
            styles.switchModeCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF', borderColor: '#3B82F666' },
          ]}
          onPress={handleSwitchToCaregiver}
          activeOpacity={0.8}
        >
          <View style={styles.switchIconBox}>
            <Ionicons name="repeat" size={22} color="#2563EB" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.switchModeTitle, { color: colors.textPrimary }]}>
              Chuyển sang Giao diện Người nhà
            </Text>
            <Text style={[styles.switchModeSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Trải nghiệm góc nhìn của gia đình, camera an ninh và trợ lý AI Bot
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#2563EB" />
        </TouchableOpacity>

        {/* Clinical Settings Group */}
        <View
          style={[
            styles.menuGroup,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <Text style={[styles.groupTitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            TIỆN ÍCH LÂM SÀNG & BẢO MẬT
          </Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert(
                'Quy trình Cấp cứu 115',
                'Khi người cao tuổi gặp nạn té ngã chấn thương nặng hoặc SpO2 < 85%:\n\n1. Kiểm tra camera xác định chấn thương.\n2. Liên hệ Trung tâm Cấp cứu 115.\n3. Hướng dẫn người nhà không di chuyển bệnh nhân nếu nghi ngờ chấn thương cột sống.'
              )
            }
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="call" size={18} color="#DC2626" />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
              Protocol Cấp cứu 115 & Chấn thương
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
            <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={18} color="#7C3AED" />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
              Chế độ {isDarkMode ? 'Sáng' : 'Tối'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Đăng xuất khỏi tài khoản Bác sĩ</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  profileCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  docName: { fontSize: 20, fontWeight: '800' },
  docSpecialty: { fontSize: 13, color: '#0284C7', fontWeight: '600', marginTop: 4 },
  docHospital: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F066',
    width: '100%',
    justifyContent: 'space-around',
  },
  statBox: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  divider: { width: 1, height: '80%', backgroundColor: '#E2E8F066' },
  switchModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  switchIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchModeTitle: { fontSize: 14, fontWeight: '700' },
  switchModeSub: { fontSize: 11, marginTop: 2 },
  menuGroup: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  groupTitle: { fontSize: 11, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
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
  menuItemText: { flex: 1, fontSize: 13, fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  logoutBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
});

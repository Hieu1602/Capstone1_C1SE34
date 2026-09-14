// ProfileScreen.tsx
// Màn hình Cá nhân / Quản trị hệ thống khớp chính xác Hình 2 (Phong cách Imou Protect & Elderly Care AI)

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Pressable,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';

export default function ProfileScreen({ navigation }: any) {
  const { userId, userEmail, userName, logout } = useAuthStore();
  const { house } = useVitalStore();
  const [isUserMenuVisible, setUserMenuVisible] = React.useState(false);
  const [isSettingsVisible, setSettingsVisible] = React.useState(false);
  const [isChangePasswordVisible, setChangePasswordVisible] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [marketingOptIn, setMarketingOptIn] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [alertSoundEnabled, setAlertSoundEnabled] = React.useState(true);
  const [vibrationEnabled, setVibrationEnabled] = React.useState(true);
  const [criticalAlertEnabled, setCriticalAlertEnabled] = React.useState(true);

  const handleLogout = () => {
    const performLogout = async () => {
      logout();
      await useAuthStore.persist.clearStorage();

      if (Platform.OS === 'web') {
        window.location.reload();
        return;
      }

      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống giám sát?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Modal
        transparent
        visible={isUserMenuVisible}
        animationType="fade"
        onRequestClose={() => setUserMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setUserMenuVisible(false)}>
          <Pressable style={styles.userMenuSheet} onPress={() => {}}>
            <TouchableOpacity
              style={[styles.backButton, styles.userMenuBackButton]}
              onPress={() => setUserMenuVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.avatarContainerLarge}>
              <View style={styles.avatarCircleLarge}>
                <Ionicons name="person" size={42} color="#CBD5E1" />
              </View>
            </View>

            <TouchableOpacity style={styles.userMenuRow} activeOpacity={0.8}>
              <Text style={styles.userMenuLabel}>Email</Text>
              <Text style={styles.userMenuValue}>{userEmail || 'ngolevinh***@gmail.com'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.userMenuRow} activeOpacity={0.8}>
              <Text style={styles.userMenuLabel}>Số điện thoại</Text>
              <Text style={styles.userMenuValue}>Trợ giúp để khôi phục tài khoản</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.userMenuRow}
              activeOpacity={0.8}
              onPress={() => setChangePasswordVisible(true)}
            >
              <Text style={styles.userMenuLabel}>Đổi mật khẩu</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.userMenuRow} activeOpacity={0.8}>
              <Text style={styles.userMenuLabel}>Cài đặt đăng nhập</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.userMenuRow} activeOpacity={0.8}>
              <Text style={styles.userMenuLabel}>Kết nối với tài khoản bên thứ ba</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.marketingRow}
              activeOpacity={0.8}
              onPress={() => setMarketingOptIn(!marketingOptIn)}
            >
              <View style={[styles.checkbox, marketingOptIn && styles.checkboxChecked]}>
                {marketingOptIn && <View style={styles.checkboxInner} />}
              </View>
              <Text style={styles.marketingText}>
                Tôi đồng ý nhận email/SMS tiếp thị, bao gồm tin, bảng câu hỏi về mục đổ hại hoặc khảo sát thị trường.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.9} onPress={handleLogout}>
              <Text style={styles.primaryActionText}>Đăng xuất</Text>
            </TouchableOpacity>

          
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isChangePasswordVisible}
        animationType="slide"
        onRequestClose={() => setChangePasswordVisible(false)}
      >
        <SafeAreaView style={styles.changePasswordScreen} edges={['top']}>
          <View style={styles.changePasswordHeader}>
            <TouchableOpacity
              style={[styles.backButton, styles.userMenuBackButton]}
              onPress={() => setChangePasswordVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.changePasswordTitle}>Đổi mật khẩu</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.changePasswordContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.changePasswordIntro}>
              Tạo mật khẩu mới để bảo vệ tài khoản của bạn.
            </Text>

            <Text style={styles.passwordLabel}>Mật khẩu hiện tại</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Ionicons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordLabel}>Mật khẩu mới</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nhập mật khẩu mới"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordLabel}>Nhập lại mật khẩu mới</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.changePasswordButton}
              onPress={handleChangePassword}
              activeOpacity={0.85}
            >
              <Text style={styles.changePasswordButtonText}>Cập nhật mật khẩu</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        transparent
        visible={isSettingsVisible}
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <Pressable style={styles.settingsOverlay} onPress={() => setSettingsVisible(false)}>
          <Pressable style={styles.settingsSheet} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSettingsVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Cài đặt</Text>
            </View>

            <View style={styles.settingsList}>
              <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name="person-circle-outline" size={20} color="#475569" />
                  </View>
                  <Text style={styles.settingsLabel}>Hồ sơ của tôi</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name="settings-outline" size={20} color="#475569" />
                  </View>
                  <Text style={styles.settingsLabel}>Cài đặt chung</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name="notifications-outline" size={20} color="#475569" />
                  </View>
                  <Text style={styles.settingsLabel}>Thiết lập báo cáo</Text>
                </View>
                <View style={styles.redBadge} />
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name="hardware-chip-outline" size={20} color="#475569" />
                  </View>
                  <Text style={styles.settingsLabel}>Các công cụ cùng thiết bị</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name="folder-open-outline" size={20} color="#475569" />
                  </View>
                  <Text style={styles.settingsLabel}>Xem trip tệp LAN</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#475569" />
                  </View>
                  <Text style={styles.settingsLabel}>Cài đặt quyền hệ thống</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} activeOpacity={0.8}>
                <View style={styles.settingsLeft}>
                  <View style={styles.settingsIconWrap}>
                    <Ionicons name="information-circle-outline" size={20} color="#475569" />
                  </View>
                  <Text style={styles.settingsLabel}>Về EZVIZ</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Top Header: Avatar, User ID "1057", QR Scanner */}
        <View style={styles.topProfileRow}>
          <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.8} onPress={() => setUserMenuVisible(true)}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={38} color="#CBD5E1" />
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.userIdText}>1057</Text>
              <Text style={styles.userRoleText}>{userName || 'Người chăm sóc chính'}</Text>
            </View>
          </TouchableOpacity>

        </View>


        {/* 3. Card "Nhà của tôi" (Thành viên: 1, icon add user -> mở Hình 3) */}
        <TouchableOpacity
          style={styles.houseCard}
          onPress={() => navigation.navigate('HouseDetail')}
          activeOpacity={0.9}
        >
          <View>
            <Text style={styles.houseCardTitle}>{house.name}</Text>
            <Text style={styles.houseCardSub}>Thành viên: {house.membersCount}</Text>
          </View>
          <View style={styles.addMemberCircleBtn}>
            <Ionicons name="person-add" size={18} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* 4. Menu Card 1: AI, Tự động hóa, Thuật toán, Cảm biến IoT */}
        <View style={styles.menuGroupCard}>
          {/* Row 1: Mô hình AI */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('AIModelDetail')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="sparkles" size={20} color="#0284C7" />
            </View>
            <Text style={styles.menuTitleText}>Mô hình AI</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 2: Tự động hóa */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => Alert.alert('Tự động hóa (Automation)', '1. Phát loa tiếng Việt khi người già rời giường quên đeo vòng (FR12).\n2. Tự động gửi clip 5s lên Cloud MinIO khi có Red Alert (FR08).\n3. Tự động sao chép địa chỉ khi bấm SOS 115 (FR11).')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#E0F7FA' }]}>
              <Ionicons name="cube" size={20} color="#00ACC1" />
            </View>
            <Text style={styles.menuTitleText}>Tự động hóa</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 3: Chơi Algo (Thuật toán cảnh báo) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('AlgoConfig')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="color-wand" size={20} color="#A855F7" />
            </View>
            <Text style={styles.menuTitleText}>Chơi Algo</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 4: Hoạt động với (Thiết bị IoT) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Devices')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FFEDD5' }]}>
              <Ionicons name="hardware-chip" size={20} color="#F97316" />
            </View>
            <Text style={styles.menuTitleText}>Hoạt động với</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* 5. Menu Card 2: Báo cáo y tế & Cài Đặt */}
        <View style={styles.menuGroupCard}>
          {/* Row 1: Đơn hàng của tôi / Báo cáo y tế xuất PDF/Excel */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('MedicalReport')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="bag-handle" size={20} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitleText}>Đơn hàng của tôi</Text>
              <Text style={styles.menuSubText}>Báo cáo y tế &amp; Xuất file (FR13)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 2: Cài Đặt (Có chấm đỏ thông báo cập nhật) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="settings" size={20} color="#D97706" />
            </View>
            <Text style={styles.menuTitleText}>Cài Đặt</Text>
            <View style={styles.redUpdateDot} />
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* 6. Nút Đăng xuất */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  userMenuSheet: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 26,
    paddingTop: 10,
    paddingBottom: 28,
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'flex-start',
    marginTop: 0,
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  settingsSheet: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 18,
    marginTop: 0,
  },
  settingsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 0,
    paddingTop: 0,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
  },
  userMenuBackButton: {
    marginLeft: -20,
  },
  changePasswordScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  changePasswordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  changePasswordTitle: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  changePasswordContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  changePasswordIntro: {
    marginBottom: 28,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  passwordLabel: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    marginBottom: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  changePasswordButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  changePasswordButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarContainerLarge: {
    alignItems: 'center',
    marginBottom: 22,
  },
  avatarCircleLarge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  userMenuLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  userMenuValue: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    marginLeft: 12,
    maxWidth: '60%',
  },
  marketingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 18,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  marketingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  primaryActionButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#F8FBFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  secondaryActionButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // Top Profile
  topProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 6,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIdText: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  userRoleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qrScanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  // Banners
  bannerContainer: {
    gap: 12,
    paddingBottom: 16,
  },
  protectBannerCard: {
    width: 270,
    backgroundColor: '#DDEEFE',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  protectBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  protectBannerSub: {
    fontSize: 11,
    color: '#3B82F6',
    lineHeight: 16,
  },
  medalShieldWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  eventSmartBannerCard: {
    width: 220,
    backgroundColor: '#F3E8FF',
    borderRadius: 18,
    padding: 16,
  },
  eventSmartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6B21A8',
    marginBottom: 4,
  },
  eventSmartSub: {
    fontSize: 11,
    color: '#9333EA',
    lineHeight: 16,
  },
  // House Card
  houseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    ...Shadows.card,
  },
  houseCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  houseCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  addMemberCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Menu Groups
  menuGroupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
    ...Shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTitleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  menuSubText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 50,
  },
  settingsList: {
    marginTop: 8,
    paddingBottom: 8,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  redBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4D4F',
    marginRight: 10,
  },
  redUpdateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    marginRight: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  },
});

// ProfileScreen.tsx
// Màn hình Cá nhân / Quản trị hệ thống (Phong cách Elderly Care AI)

import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { SUPPORT_HOTLINE_NUMBER } from '../../../services/emergency';
import { useProfileManager } from '../hooks/useProfileManager';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  ProfileHeader,
  ProfileUserCard,
  ProfileQuickGrid,
  ProfileHelpAccordion,
  ProfileSettingsAccordion,
  LogoutConfirmModal,
  CustomerSupportModal,
  AvatarPickerModal,
  ChangePasswordModal,
  ProfileInfoModal,
  SecurityCenterModal,
  MenuSearchModal,
  SearchableMenuItem,
} from '../components/profile';
import {
  FontSizeSettingsModal,
  NotificationSettingsModal,
  AppearanceSettingsModal,
} from '../components/settings';

export default function ProfileScreen({ navigation, route }: any) {
  const mgr = useProfileManager(navigation, route);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    useAuthStore.getState().fetchMyPermissions?.();
    return navigation?.addListener?.('focus', () => {
      useAuthStore.getState().fetchMyPermissions?.();
    });
  }, [navigation]);

  const searchItems = useMemo<SearchableMenuItem[]>(() => {
    const isDark = mgr.isDarkMode;

    return [
      {
        id: 'profile-info',
        title: 'Hồ sơ người giám sát',
        subtitle: 'Tài khoản người thân & SĐT liên hệ khẩn cấp',
        category: 'account',
        categoryLabel: 'Tài khoản',
        icon: 'person-circle-outline',
        iconColor: '#6366F1',
        iconBg: isDark ? '#1E1B4B' : '#EEF2FF',
        keywords: [
          'ho so',
          'nguoi giam sat',
          'tai khoan',
          'thong tin ca nhan',
          'so dien thoai',
          'sdt',
          'ten',
          'user',
          'profile',
        ],
        onPress: () => mgr.setUserMenuVisible(true),
      },
      {
        id: 'medical-record',
        title: 'Hồ sơ bệnh án người cao tuổi',
        subtitle: 'Bệnh nền, nhóm máu & đơn thuốc',
        category: 'health',
        categoryLabel: 'Sức khỏe & Y tế',
        icon: 'medkit-outline',
        iconColor: '#0EA5E9',
        iconBg: isDark ? '#082F49' : '#E0F2FE',
        badge: 'AES-256',
        keywords: [
          'benh an',
          'nguoi cao tuoi',
          'don thuoc',
          'nhom mau',
          'tien su benh',
          'ho so y te',
          'medical',
          'record',
        ],
        onPress: () => navigation.navigate('PatientMedicalRecord'),
      },
      {
        id: 'house-detail',
        title: mgr.house?.name || 'Nhà của tôi',
        subtitle: `Thành viên: ${mgr.house?.membersCount || 1} • Quản lý phòng & sơ đồ`,
        category: 'device',
        categoryLabel: 'Thiết bị & Nhà',
        icon: 'home-outline',
        iconColor: '#10B981',
        iconBg: isDark ? '#064E3B' : '#ECFDF5',
        keywords: [
          'nha cua toi',
          'phong',
          'quan ly phong',
          'thanh vien',
          'so do nha',
          'house',
          'room',
        ],
        onPress: () => navigation.navigate('HouseDetail'),
      },
      {
        id: 'add-member',
        title: 'Thêm thành viên gia đình',
        subtitle: 'Mời người thân cùng theo dõi qua số điện thoại',
        category: 'account',
        categoryLabel: 'Tài khoản',
        icon: 'person-add-outline',
        iconColor: '#10B981',
        iconBg: isDark ? '#064E3B' : '#ECFDF5',
        keywords: [
          'them thanh vien',
          'moi nguoi than',
          'gia dinh',
          'chia se tai khoan',
          'invite',
          'member',
        ],
        onPress: () => navigation.navigate('HouseDetail', { openInviteModal: true }),
      },
      {
        id: 'devices',
        title: 'Thiết bị kết nối',
        subtitle: 'Camera AI, Vòng đeo tay BLE & Cảm biến',
        category: 'device',
        categoryLabel: 'Thiết bị & Nhà',
        icon: 'hardware-chip-outline',
        iconColor: '#FF7A00',
        iconBg: isDark ? '#451A03' : '#FFF7ED',
        keywords: [
          'thiet bi',
          'camera',
          'vong tay',
          'smartband',
          'ble',
          'cam bien',
          'ket noi',
          'devices',
        ],
        onPress: () => navigation.navigate('Devices'),
      },
      {
        id: 'add-device',
        title: 'Thêm thiết bị mới',
        subtitle: 'Quét mã QR kết nối Camera AI hoặc Vòng tay BLE',
        category: 'device',
        categoryLabel: 'Thiết bị & Nhà',
        icon: 'add-circle-outline',
        iconColor: '#2563EB',
        iconBg: isDark ? '#1E293B' : '#EFF6FF',
        keywords: [
          'them thiet bi',
          'quet ma',
          'qr code',
          'pair device',
          'them camera',
          'them vong tay',
        ],
        onPress: () => navigation.navigate('AddDevice'),
      },
      {
        id: 'multiview',
        title: 'Multi-View Camera',
        subtitle: 'Xem nhiều góc quay camera cùng lúc',
        category: 'device',
        categoryLabel: 'Thiết bị & Nhà',
        icon: 'grid-outline',
        iconColor: '#7C3AED',
        iconBg: isDark ? '#2E1065' : '#F3E8FF',
        keywords: [
          'multiview',
          'multi-view',
          'camera',
          'nhieu goc quay',
          'chia man hinh',
          'live view',
        ],
        onPress: () => navigation.navigate('MultiView'),
      },
      {
        id: 'algo-config',
        title: 'Cấu hình AI',
        subtitle: 'Độ nhạy té ngã, ngưỡng nhịp tim & SpO2',
        category: 'health',
        categoryLabel: 'Sức khỏe & Y tế',
        icon: 'color-wand-outline',
        iconColor: '#8B5CF6',
        iconBg: isDark ? '#3B1D54' : '#F5F3FF',
        keywords: [
          'cau hinh ai',
          'te nga',
          'do nhay',
          'nhip tim',
          'spo2',
          'nguong bao dong',
          'fall detection',
          'ai config',
        ],
        onPress: () => navigation.navigate('AlgoConfig'),
      },
      {
        id: 'medical-report',
        title: 'Báo cáo sức khỏe',
        subtitle: 'Xuất file PDF & Excel gửi bác sĩ',
        category: 'health',
        categoryLabel: 'Sức khỏe & Y tế',
        icon: 'document-text-outline',
        iconColor: '#2563EB',
        iconBg: isDark ? '#1E293B' : '#EFF6FF',
        keywords: [
          'bao cao',
          'suc khoe',
          'pdf',
          'excel',
          'xuat file',
          'gui bac si',
          'thong ke',
          'report',
        ],
        onPress: () => navigation.navigate('MedicalReport'),
      },
      {
        id: 'medication-reminder',
        title: 'Lịch nhắc thuốc',
        subtitle: 'Đơn thuốc & Lịch tái khám bác sĩ',
        category: 'health',
        categoryLabel: 'Sức khỏe & Y tế',
        icon: 'calendar-outline',
        iconColor: '#D97706',
        iconBg: isDark ? '#451A03' : '#FEF3C7',
        keywords: [
          'lich nhac thuoc',
          'uong thuoc',
          'don thuoc',
          'tai kham',
          'bac si',
          'nhac nho',
          'medication',
          'reminder',
        ],
        onPress: () => navigation.navigate('MedicationReminder'),
      },
      {
        id: 'alerts-log',
        title: 'Nhật ký cảnh báo',
        subtitle: 'Sự kiện té ngã & Sinh hiệu bất thường',
        category: 'health',
        categoryLabel: 'Sức khỏe & Y tế',
        icon: 'notifications-outline',
        iconColor: '#EF4444',
        iconBg: isDark ? '#450A0A' : '#FEE2E2',
        keywords: [
          'nhat ky',
          'canh bao',
          'te nga',
          'su kien',
          'sinh hieu',
          'khan cap',
          'alert',
          'notification',
        ],
        onPress: () => navigation.navigate('Alerts'),
      },
      {
        id: 'ai-assistant',
        title: 'Trợ lý Bác sĩ AI',
        subtitle: 'Tư vấn dinh dưỡng & Vận động 24/7',
        category: 'health',
        categoryLabel: 'Sức khỏe & Y tế',
        icon: 'chatbubble-ellipses-outline',
        iconColor: '#06B6D4',
        iconBg: isDark ? '#164E63' : '#ECFEFF',
        keywords: [
          'tro ly ai',
          'bac si ai',
          'hoi dap',
          'tu van',
          'dinh duong',
          'van dong',
          'chat bot',
          'assistant',
        ],
        onPress: () => navigation.navigate('AIAssistant'),
      },
      {
        id: 'emergency-115',
        title: 'Gọi cấp cứu y tế khẩn cấp 115',
        subtitle: 'Kết nối trực tiếp đường dây nóng cấp cứu y tế',
        category: 'support',
        categoryLabel: 'Hỗ trợ',
        icon: 'call-outline',
        iconColor: '#EF4444',
        iconBg: isDark ? '#450A0A' : '#FEE2E2',
        badge: 'Khẩn cấp',
        keywords: [
          'cap cuu',
          '115',
          'goi khan cap',
          'duong day nong',
          'benh vien',
          'emergency',
          'sos',
        ],
        onPress: mgr.callEmergencyService,
      },
      {
        id: 'customer-support',
        title: 'Tổng đài hỗ trợ kỹ thuật CSKH 24/7',
        subtitle: 'Hỗ trợ kết nối camera, vòng tay, hub AI',
        category: 'support',
        categoryLabel: 'Hỗ trợ',
        icon: 'headset-outline',
        iconColor: '#3B82F6',
        iconBg: isDark ? '#1E293B' : '#EFF6FF',
        badge: '24/7',
        keywords: [
          'tong dai',
          'cskh',
          'ho tro',
          'ky thuat',
          'hotline',
          'support',
          'lien he',
        ],
        onPress: () => mgr.setCustomerSupportVisible(true),
      },
      {
        id: 'app-info',
        title: 'Hướng dẫn sử dụng & Giới thiệu đồ án',
        subtitle: 'Tài liệu kỹ thuật Smart Elderly Care AI',
        category: 'support',
        categoryLabel: 'Hỗ trợ',
        icon: 'book-outline',
        iconColor: '#8B5CF6',
        iconBg: isDark ? '#3B1D54' : '#F5F3FF',
        keywords: [
          'huong dan su dung',
          'gioi thieu',
          'do an',
          'tai lieu',
          'smart elderly care ai',
          'app info',
          'help',
        ],
        onPress: () => navigation.navigate('AppInfo'),
      },
      {
        id: 'settings-general',
        title: 'Cài đặt chung',
        subtitle: 'Vùng, ngôn ngữ giao diện & chế độ Sáng / Tối',
        category: 'settings',
        categoryLabel: 'Cài đặt',
        icon: 'settings-outline',
        iconColor: '#FF7A00',
        iconBg: isDark ? '#451A03' : '#FFF7ED',
        keywords: [
          'cai dat chung',
          'ngon ngu',
          'vung',
          'giao dien',
          'settings',
          'general',
        ],
        onPress: () => navigation.navigate('Settings'),
      },
      {
        id: 'settings-notification',
        title: 'Cài đặt thông báo & Âm thanh báo động',
        subtitle: 'Chuông còi hú, rung, thông báo đẩy',
        category: 'settings',
        categoryLabel: 'Cài đặt',
        icon: 'notifications-outline',
        iconColor: '#EAB308',
        iconBg: isDark ? '#422006' : '#FEF9C3',
        keywords: [
          'cai dat thong bao',
          'am thanh',
          'coi hu',
          'rung',
          'thong bao day',
          'notifications',
        ],
        onPress: () => mgr.setNotificationSettingsVisible(true),
      },
      {
        id: 'settings-font-size',
        title: 'Cỡ chữ lớn (Dành cho người cao tuổi)',
        subtitle: 'Điều chỉnh độ phóng to chữ đọc dễ dàng',
        category: 'settings',
        categoryLabel: 'Cài đặt',
        icon: 'text-outline',
        iconColor: '#10B981',
        iconBg: isDark ? '#064E3B' : '#ECFDF5',
        keywords: [
          'co chu',
          'chu to',
          'phong to',
          'nguoi cao tuoi',
          'font size',
          'kha nang tiep can',
          'accessibility',
        ],
        onPress: () => mgr.setFontSizeVisible(true),
      },
      {
        id: 'settings-appearance',
        title: 'Chế độ giao diện Sáng / Tối',
        subtitle: `Đang dùng Giao diện ${isDark ? 'Tối' : 'Sáng'}`,
        category: 'settings',
        categoryLabel: 'Cài đặt',
        icon: 'moon-outline',
        iconColor: '#64748B',
        iconBg: isDark ? '#1E293B' : '#F1F5F9',
        keywords: [
          'che do toi',
          'che do sang',
          'giao dien',
          'dark mode',
          'light mode',
          'theme',
          'mau nen',
        ],
        onPress: () => mgr.setAppearanceVisible(true),
      },
      {
        id: 'settings-security',
        title: 'Trung tâm bảo mật',
        subtitle: 'Xác thực 2 bước, quản lý thiết bị & đăng nhập',
        category: 'settings',
        categoryLabel: 'Cài đặt',
        icon: 'shield-checkmark-outline',
        iconColor: '#10B981',
        iconBg: isDark ? '#064E3B' : '#ECFDF5',
        keywords: [
          'trung tam bao mat',
          'bao mat',
          '2fa',
          'xac thuc 2 buoc',
          'thiet bi dang nhap',
          'security',
        ],
        onPress: () => mgr.setSecurityCenterVisible(true),
      },
      {
        id: 'settings-change-password',
        title: 'Đổi mật khẩu tài khoản',
        subtitle: 'Cập nhật mã bảo mật đăng nhập',
        category: 'account',
        categoryLabel: 'Tài khoản',
        icon: 'key-outline',
        iconColor: '#EF4444',
        iconBg: isDark ? '#450A0A' : '#FEE2E2',
        keywords: [
          'doi mat khau',
          'mat khau',
          'password',
          'cap nhat mat khau',
          'pass',
        ],
        onPress: () => mgr.setChangePasswordVisible(true),
      },
      {
        id: 'logout',
        title: 'Đăng xuất tài khoản',
        subtitle: 'Thoát khỏi phiên làm việc hiện tại',
        category: 'account',
        categoryLabel: 'Tài khoản',
        icon: 'log-out-outline',
        iconColor: '#EF4444',
        iconBg: isDark ? '#450A0A' : '#FEE2E2',
        keywords: ['dang xuat', 'thoat', 'logout', 'sign out'],
        onPress: () => mgr.setLogoutConfirmVisible(true),
      },
    ];
  }, [mgr, navigation]);

  return (
    <SafeAreaView
      style={[styles.safeArea, mgr.isDarkMode && { backgroundColor: mgr.colors.background }]}
      edges={['top']}
    >
      {/* ─── MODALS ────────────────────────────────────────── */}
      <MenuSearchModal
        visible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
        isDarkMode={mgr.isDarkMode}
        colors={mgr.colors}
        items={searchItems}
      />

      <LogoutConfirmModal
        visible={mgr.isLogoutConfirmVisible}
        isDarkMode={mgr.isDarkMode}
        onClose={() => mgr.setLogoutConfirmVisible(false)}
        onConfirm={mgr.performLogout}
      />

      <ProfileInfoModal
        visible={mgr.isUserMenuVisible}
        isDarkMode={mgr.isDarkMode}
        displayName={mgr.resolvedDisplayName}
        phone={mgr.profilePhone}
        avatarUri={mgr.avatarUri}
        onClose={() => mgr.setUserMenuVisible(false)}
        onPickFromCamera={mgr.pickAvatarFromCamera}
        onPickFromLibrary={mgr.pickAvatarFromLibrary}
        onChangePasswordPress={() => mgr.setChangePasswordVisible(true)}
        onLogoutPress={() => mgr.setLogoutConfirmVisible(true)}
        onSaveName={mgr.handleSaveName}
        onSavePhone={mgr.handleSavePhone}
      />

      <CustomerSupportModal
        visible={mgr.isCustomerSupportVisible}
        isDarkMode={mgr.isDarkMode}
        hotlineNumber={SUPPORT_HOTLINE_NUMBER}
        onClose={() => mgr.setCustomerSupportVisible(false)}
        onCall={mgr.callCustomerSupportService}
      />

      <AvatarPickerModal
        visible={mgr.isAvatarPickerVisible}
        isDarkMode={mgr.isDarkMode}
        onClose={() => mgr.setAvatarPickerVisible(false)}
        onPickFromCamera={mgr.pickAvatarFromCamera}
        onPickFromLibrary={mgr.pickAvatarFromLibrary}
      />

      <ChangePasswordModal
        visible={mgr.isChangePasswordVisible}
        isDarkMode={mgr.isDarkMode}
        onClose={() => mgr.setChangePasswordVisible(false)}
        onSubmit={mgr.handleChangePassword}
      />

      <FontSizeSettingsModal
        visible={mgr.isFontSizeVisible}
        isDarkMode={mgr.isDarkMode}
        fontSizeMode={mgr.fontSizeMode}
        customFontScale={mgr.customFontScale}
        onApplyMode={mgr.applyFontScaleMode}
        onUpdateScale={mgr.handleUpdateFontScale}
        onClose={() => mgr.setFontSizeVisible(false)}
      />

      <NotificationSettingsModal
        visible={mgr.isNotificationSettingsVisible}
        isDarkMode={mgr.isDarkMode}
        notificationsEnabled={mgr.notificationsEnabled}
        alertSoundEnabled={mgr.alertSoundEnabled}
        criticalAlertEnabled={mgr.criticalAlertEnabled}
        onToggleNotifications={(val) =>
          mgr.handleToggleNotification('notifications_enabled', val)
        }
        onToggleAlertSound={(val) =>
          mgr.handleToggleNotification('alert_sound_enabled', val)
        }
        onToggleCriticalAlert={(val) =>
          mgr.handleToggleNotification('critical_alert_enabled', val)
        }
        onClose={() => mgr.setNotificationSettingsVisible(false)}
      />

      <AppearanceSettingsModal
        visible={mgr.isAppearanceVisible}
        isDarkMode={mgr.isDarkMode}
        appearanceMode={mgr.isDarkMode ? 'dark' : 'light'}
        onSelectMode={(mode) => mgr.setDarkMode(mode === 'dark')}
        onClose={() => mgr.setAppearanceVisible(false)}
      />

      <SecurityCenterModal
        visible={mgr.isSecurityCenterVisible}
        isDarkMode={mgr.isDarkMode}
        onClose={() => mgr.setSecurityCenterVisible(false)}
        onSubmitChangePassword={mgr.handleChangePassword}
      />

      {/* ─── MAIN CONTENT ──────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          mgr.isDarkMode && { backgroundColor: mgr.colors.background },
        ]}
      >
        <ProfileHeader
          isDarkMode={mgr.isDarkMode}
          colors={mgr.colors}
          onPressSearch={() => setIsSearchVisible(true)}
          onPressSettings={() => navigation.navigate('Settings')}
        />

        <ProfileUserCard
          displayName={mgr.resolvedDisplayName}
          avatarUri={mgr.avatarUri}
          isDarkMode={mgr.isDarkMode}
          colors={mgr.colors}
          onPressProfile={() => mgr.setUserMenuVisible(true)}
          onPressAddMember={() => navigation.navigate('HouseDetail', { openInviteModal: true })}
        />

        <ProfileQuickGrid
          isDarkMode={mgr.isDarkMode}
          colors={mgr.colors}
          houseName={mgr.house?.name || 'Nhà của tôi'}
          membersCount={mgr.house?.membersCount || 1}
          hasHouse={Boolean(mgr.house?.id && mgr.house?.hasHouse !== false && mgr.house?.name)}
          showMore={mgr.showMoreGrid}
          onToggleShowMore={() => mgr.setShowMoreGrid(!mgr.showMoreGrid)}
          onNavigate={(screen) => navigation.navigate(screen)}
          onOpenProfile={() => mgr.setUserMenuVisible(true)}
        />

        <ProfileHelpAccordion
          isExpanded={mgr.isHelpExpanded}
          onToggle={() => mgr.setIsHelpExpanded(!mgr.isHelpExpanded)}
          isDarkMode={mgr.isDarkMode}
          colors={mgr.colors}
          onCallEmergency={mgr.callEmergencyService}
          onOpenSupport={() => mgr.setCustomerSupportVisible(true)}
          onNavigateAppInfo={() => navigation.navigate('AppInfo')}
        />

        <ProfileSettingsAccordion
          isExpanded={mgr.isSettingsExpanded}
          onToggle={() => mgr.setIsSettingsExpanded(!mgr.isSettingsExpanded)}
          isDarkMode={mgr.isDarkMode}
          colors={mgr.colors}
          onOpenNotifications={() => mgr.setNotificationSettingsVisible(true)}
          onOpenFontSize={() => mgr.setFontSizeVisible(true)}
          onOpenAppearance={() => mgr.setAppearanceVisible(true)}
          onOpenSecurityCenter={() => mgr.setSecurityCenterVisible(true)}
          onOpenChangePassword={() => mgr.setChangePasswordVisible(true)}
        />

        <TouchableOpacity
          style={[
            styles.fbLogoutBtn,
            mgr.isDarkMode && {
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderColor: '#EF4444',
            },
          ]}
          activeOpacity={0.8}
          onPress={() => mgr.setLogoutConfirmVisible(true)}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.fbLogoutBtnText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  fbLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 14,
    marginBottom: 20,
  },
  fbLogoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
});

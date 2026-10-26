// ProfileScreen.tsx
// Màn hình Cá nhân / Quản trị hệ thống (Phong cách Elderly Care AI)

import React from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { SUPPORT_HOTLINE_NUMBER } from '../../../services/emergency';
import { useProfileManager } from '../hooks/useProfileManager';
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
} from '../components/profile';
import {
  FontSizeSettingsModal,
  NotificationSettingsModal,
  AppearanceSettingsModal,
} from '../components/settings';

export default function ProfileScreen({ navigation, route }: any) {
  const mgr = useProfileManager(navigation, route);

  return (
    <SafeAreaView
      style={[styles.safeArea, mgr.isDarkMode && { backgroundColor: mgr.colors.background }]}
      edges={['top']}
    >
      {/* ─── MODALS ────────────────────────────────────────── */}
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
        onAvatarPress={() => mgr.setAvatarPickerVisible(true)}
        onChangePasswordPress={() => mgr.setChangePasswordVisible(true)}
        onLogoutPress={() => mgr.setLogoutConfirmVisible(true)}
        onSaveName={mgr.handleSaveName}
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
          onPressSearch={() => navigation.navigate('Settings')}
          onPressSettings={() => navigation.navigate('Settings')}
        />

        <ProfileUserCard
          displayName={mgr.resolvedDisplayName}
          avatarUri={mgr.avatarUri}
          isDarkMode={mgr.isDarkMode}
          colors={mgr.colors}
          onPressProfile={() => mgr.setUserMenuVisible(true)}
          onPressAddMember={() => navigation.navigate('HouseDetail')}
        />

        <ProfileQuickGrid
          isDarkMode={mgr.isDarkMode}
          colors={mgr.colors}
          houseName={mgr.house?.name || 'Nhà của tôi'}
          membersCount={mgr.house?.membersCount || 1}
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

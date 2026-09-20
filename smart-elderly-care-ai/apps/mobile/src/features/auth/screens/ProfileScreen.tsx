// ProfileScreen.tsx
// Màn hình Cá nhân / xtrị hệ thống khớp chính xác Hình 2 (Phong cách Imou Protect & Elderly Care AI)

import React from 'react';
import * as Location from 'expo-location';
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
  Image,
  Vibration,
  PanResponder,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';

export default function ProfileScreen({ navigation }: any) {
  const { userId, userName, logout, updateUserName } = useAuthStore();
  const { house } = useVitalStore();
  const { isDarkMode, colors, setDarkMode } = useTheme();
  const [profileName, setProfileName] = React.useState(userName || 'ngolevinh233');
  const [profilePhone, setProfilePhone] = React.useState('0912 345 678');
  const [editingField, setEditingField] = React.useState<'name' | null>(null);
  const [draftValue, setDraftValue] = React.useState('');
  const [isUserMenuVisible, setUserMenuVisible] = React.useState(false);
  const [isAvatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [isLocationVisible, setLocationVisible] = React.useState(false);
  const [locationAddress, setLocationAddress] = React.useState('');
  const [locationCoords, setLocationCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocationLoading, setLocationLoading] = React.useState(false);
  const [isSettingsVisible, setSettingsVisible] = React.useState(false);
  const [accountEntrySource, setAccountEntrySource] = React.useState<'main' | 'settings'>('main');
  const [isNotificationSettingsVisible, setNotificationSettingsVisible] = React.useState(false);
  const [isVibrationDetailVisible, setVibrationDetailVisible] = React.useState(false);
  const [isAboutInfoVisible, setAboutInfoVisible] = React.useState(false);
  const [infoDetail, setInfoDetail] = React.useState<'terms' | 'app' | null>(null);
  const [isGeneralSettingsVisible, setGeneralSettingsVisible] = React.useState(false);
  const [isLanguageVisible, setLanguageVisible] = React.useState(false);
  const [languageMode, setLanguageMode] = React.useState<'vi' | 'en'>('vi');
  const [isAccessibilityVisible, setAccessibilityVisible] = React.useState(false);
  const [isFontSizeVisible, setFontSizeVisible] = React.useState(false);
  const [fontSizeMode, setFontSizeMode] = React.useState<'system' | 'custom'>('system');
  const [customFontScale, setCustomFontScale] = React.useState(2);
  const [isAppearanceVisible, setAppearanceVisible] = React.useState(false);
  const [appearanceMode, setAppearanceMode] = React.useState<'light' | 'dark'>(isDarkMode ? 'dark' : 'light');

  React.useEffect(() => {
    setAppearanceMode(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const [highContrastEnabled, setHighContrastEnabled] = React.useState(false);
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const sliderTrackPosition = React.useRef(0);
  const [isChangePasswordVisible, setChangePasswordVisible] = React.useState(false);
  const [isLogoutConfirmVisible, setLogoutConfirmVisible] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [marketingOptIn, setMarketingOptIn] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [alertSoundEnabled, setAlertSoundEnabled] = React.useState(true);
  const [vibrationEnabled, setVibrationEnabled] = React.useState(true);
  const [criticalAlertEnabled, setCriticalAlertEnabled] = React.useState(true);
  const [isCustomerSupportVisible, setCustomerSupportVisible] = React.useState(false);
  const [isSecurityCenterVisible, setSecurityCenterVisible] = React.useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [securityDetail, setSecurityDetail] = React.useState<'twoFactor' | 'devices' | 'logins' | 'question' | null>(null);
  const [selectedSecurityQuestion, setSelectedSecurityQuestion] = React.useState('');

  const openSecurityDetail = (detail: 'twoFactor' | 'devices' | 'logins' | 'question') => {
    setSecurityCenterVisible(false);
    setTimeout(() => setSecurityDetail(detail), 220);
  };
  const [returnToSecurityAfterPassword, setReturnToSecurityAfterPassword] = React.useState(false);

  const closeChangePassword = () => {
    setChangePasswordVisible(false);

    if (returnToSecurityAfterPassword) {
      setReturnToSecurityAfterPassword(false);
      setSecurityCenterVisible(true);
    }
  };


  const handleVibrationToggle = (value: boolean) => {
    setVibrationEnabled(value);

    if (value) {
      Vibration.vibrate(80);
      return;
    }

    Vibration.cancel();
  };

  const handleCustomerSupportPress = () => {
    setCustomerSupportVisible(true);
  };

  const callEmergencyService = async () => {
    try {
      await Linking.openURL('tel:115');
    } catch {
      Alert.alert('Không thể gọi', 'Thiết bị không hỗ trợ thực hiện cuộc gọi trực tiếp.');
    }
  };

  const updateFontScaleFromPosition = React.useCallback((positionX: number) => {
    if (!sliderWidth) return;

    const rawRatio = Math.min(Math.max(positionX / sliderWidth, 0), 1);
    const nextScale = Math.round(rawRatio * 4);
    setCustomFontScale(nextScale);
  }, [sliderWidth]);

  const fontSliderResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, gestureState) => {
          updateFontScaleFromPosition(gestureState.x0 - sliderTrackPosition.current);
        },
        onPanResponderMove: (_, gestureState) => {
          updateFontScaleFromPosition(gestureState.moveX - sliderTrackPosition.current);
        },
      }),
    [updateFontScaleFromPosition]
  );

  const closeUserMenu = React.useCallback(() => {
    setUserMenuVisible(false);

    if (accountEntrySource === 'settings') {
      setSettingsVisible(true);
      return;
    }

    setSettingsVisible(false);
  }, [accountEntrySource]);

  const performLogout = async () => {
    logout();
    await useAuthStore.persist.clearStorage();
    setUserMenuVisible(false);

    if (Platform.OS !== 'web') {
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  React.useEffect(() => {
    if (userName) {
      setProfileName(userName);
    }
  }, [userName]);

  const handleLogout = () => {
    setLogoutConfirmVisible(true);
  };

  const openFieldEditor = (field: 'name') => {
    if (field !== 'name') return;
    setDraftValue(profileName);
    setEditingField(field);
  };

  const closeFieldEditor = () => {
    setEditingField(null);
    setDraftValue('');
  };

  const saveEditedField = () => {
    if (!editingField) return;

    const trimmed = draftValue.trim();
    if (!trimmed) {
      Alert.alert('Lỗi', 'Tên không được để trống.');
      return;
    }

    setProfileName(trimmed);
    updateUserName(userId ?? 'demo-user-001', trimmed);
    closeFieldEditor();
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Vui lòng kiểm tra lại mật khẩu mới.');
      return;
    }

    Alert.alert('Thành công', 'Đổi mật khẩu thành công!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    closeChangePassword();
  };

  const handleAvatarPress = async () => {
    setAvatarPickerVisible(true);
  };

  const pickAvatarFromCamera = async () => {
    setAvatarPickerVisible(false);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền bị từ chối', 'Bạn cần cho phép truy cập máy ảnh để chụp ảnh.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const pickAvatarFromLibrary = async () => {
    setAvatarPickerVisible(false);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền bị từ chối', 'Bạn cần cho phép truy cập thư viện ảnh để chọn ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setLocationLoading(false);
      Alert.alert('Quyền bị từ chối', 'Bạn cần cho phép truy cập vị trí để sử dụng định vị địa lý.');
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setLocationCoords({ latitude, longitude });
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = places[0];
      const address = [
        place?.name,
        place?.street,
        place?.district,
        place?.city,
        place?.region,
        place?.country,
      ].filter(Boolean).join(', ');

      setLocationAddress(
        address || `Vĩ độ: ${latitude.toFixed(6)}, Kinh độ: ${longitude.toFixed(6)}`
      );
    } catch {
      Alert.alert('Không lấy được vị trí', 'Vui lòng bật GPS và thử lại.');
    } finally {
      setLocationLoading(false);
    }
  };

  React.useEffect(() => {
    if (isLocationVisible && !locationCoords) {
      void handleGetCurrentLocation();
    }
  }, [isLocationVisible, locationCoords]);

  const locationMapHtml = locationCoords
    ? `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>html,body,#map{height:100%;margin:0}body{overflow:hidden}</style><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const point=[${locationCoords.latitude},${locationCoords.longitude}];const map=L.map('map',{zoomControl:false}).setView(point,16);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);L.marker(point).addTo(map).bindPopup('Vị trí hiện tại').openPopup();</script></body></html>`
    : '';

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top']}>
      {/* Modal xác nhận đăng xuất */}
      <Modal
        transparent
        visible={isLogoutConfirmVisible}
        animationType="fade"
        onRequestClose={() => setLogoutConfirmVisible(false)}
      >
        <Pressable
          style={styles.confirmModalOverlay}
          onPress={() => setLogoutConfirmVisible(false)}
        >
          <Pressable style={[styles.confirmModalCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]} onPress={() => {}}>
            <View style={styles.confirmModalIconCircle}>
              <Ionicons name="log-out-outline" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.confirmModalTitle, isDarkMode && { color: '#F8FAFC' }]}>Đăng xuất tài khoản</Text>
            <Text style={[styles.confirmModalMessage, isDarkMode && { color: '#94A3B8' }]}>
              Bạn có chắc chắn muốn đăng xuất khỏi hệ thống giám sát Smart Elderly Care?
            </Text>
            <View style={styles.confirmModalButtonRow}>
              <TouchableOpacity
                style={[styles.confirmModalCancelBtn, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => setLogoutConfirmVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.confirmModalCancelText, isDarkMode && { color: '#94A3B8' }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmModalLogoutBtn}
                onPress={performLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmModalLogoutText}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isUserMenuVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!isLogoutConfirmVisible) closeUserMenu();
        }}
      >
        <Pressable
          style={[styles.modalOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            if (!isLogoutConfirmVisible) closeUserMenu();
          }}
        >
          <Pressable style={[styles.userMenuSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <TouchableOpacity
              style={[styles.backButton, styles.userMenuBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
              onPress={closeUserMenu}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.avatarContainerLarge}>
              <TouchableOpacity
                style={[styles.avatarCircleLarge, isDarkMode && { backgroundColor: '#1E293B' }]}
                activeOpacity={0.8}
                onPress={handleAvatarPress}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImageLarge} />
                ) : (
                  <Ionicons name="person" size={42} color={isDarkMode ? '#64748B' : '#E8EEF5'} />
                )}
              </TouchableOpacity>

              <Text style={[styles.profileNameText, isDarkMode && { color: '#F8FAFC' }]}>{profileName || 'ngolevinh233'}</Text>
            </View>

            <View style={[styles.profileInfoListCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TouchableOpacity style={[styles.infoRow, isDarkMode && { borderBottomColor: '#334155' }]} activeOpacity={0.8} onPress={() => openFieldEditor('name')}>
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="person-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Tên</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={[styles.infoValue, isDarkMode && { color: '#94A3B8' }]}>{profileName || 'ngolevinh233'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.infoRow, isDarkMode && { borderBottomColor: '#334155' }]} activeOpacity={0.8}>
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="call-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Số điện thoại</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={[styles.infoValue, isDarkMode && { color: '#94A3B8' }]}>{profilePhone}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.infoRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.8}
                onPress={() => {
                  setReturnToSecurityAfterPassword(false);
                  setChangePasswordVisible(true);
                }}
              >
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="lock-closed-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Thay đổi mật mã</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

             
            </View>

            <TouchableOpacity style={styles.logoutButton} activeOpacity={0.9} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Đăng xuất</Text>
            </TouchableOpacity>

            <Modal
              transparent
              visible={editingField !== null}
              animationType="fade"
              onRequestClose={closeFieldEditor}
            >
              <Pressable style={styles.editorOverlay} onPress={closeFieldEditor}>
                <Pressable style={[styles.editorSheet, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]} onPress={() => {}}>
                  <View style={styles.editorHeader}>
                    <TouchableOpacity
                      style={[styles.editorBackButton, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                      onPress={closeFieldEditor}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-back-outline" size={26} color={isDarkMode ? '#F8FAFC' : '#111827'} />
                    </TouchableOpacity>
                    <Text style={[styles.editorTitle, isDarkMode && { color: '#F8FAFC' }]}>Chỉnh sửa tên</Text>
                  </View>

                  <TextInput
                    value={draftValue}
                    onChangeText={setDraftValue}
                    style={[styles.editorInput, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
                    placeholder="Nhập tên mới"
                    placeholderTextColor="#94A3B8"
                    autoFocus
                    autoCapitalize="words"
                    keyboardType="default"
                  />

                  <View style={styles.editorActions}>
                    <TouchableOpacity style={[styles.editorCancel, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]} onPress={closeFieldEditor}>
                      <Text style={[styles.editorCancelText, isDarkMode && { color: '#94A3B8' }]}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editorSave} onPress={saveEditedField}>
                      <Text style={styles.editorSaveText}>Lưu</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>

            {isLogoutConfirmVisible && (
              <View style={styles.logoutInlineOverlay}>
                <View style={[styles.logoutDialog, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
                  <Text style={[styles.logoutTitle, isDarkMode && { color: '#F8FAFC' }]}>Đăng xuất</Text>
                  <Text style={[styles.logoutMessage, isDarkMode && { color: '#94A3B8' }]}>
                    Bạn có chắc chắn muốn đăng xuất khỏi hệ thống giám sát?
                  </Text>
                  <View style={styles.logoutActions}>
                    <TouchableOpacity
                      style={[styles.logoutCancelButton, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                      onPress={() => setLogoutConfirmVisible(false)}
                    >
                      <Text style={[styles.logoutCancelText, isDarkMode && { color: '#94A3B8' }]}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.logoutConfirmButton}
                      onPress={() => {
                        setLogoutConfirmVisible(false);
                        void performLogout();
                      }}
                    >
                      <Text style={styles.logoutConfirmText}>Đăng xuất</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={securityDetail !== null}
        animationType="slide"
              onRequestClose={() => {
                setSecurityDetail(null);
                setSecurityCenterVisible(true);
              }}
      >
        <SafeAreaView style={styles.securityDetailScreen} edges={['top']}>
          <View style={styles.securityDetailHeader}>
            <TouchableOpacity
              style={styles.changePasswordBackButton}
              onPress={() => {
                setSecurityDetail(null);
                setSecurityCenterVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back-outline" size={28} color="#0F172A" />
            </TouchableOpacity>
            {securityDetail !== 'question' && (
              <Text style={styles.securityDetailTitle}>
                {securityDetail === 'twoFactor'
                  ? 'Xác minh hai bước'
                  : securityDetail === 'devices'
                    ? 'Quản lý đầu cuối'
                    : 'Đăng nhập tài khoản'}
              </Text>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.securityDetailContent}>
            {securityDetail === 'twoFactor' && (
              <View style={styles.securityDetailCard}>
                <View style={styles.securityDetailRowHeader}>
                  <Text style={styles.securityDetailCardTitle}>Xác minh hai bước</Text>
                  <Switch
                    value={twoFactorEnabled}
                    onValueChange={setTwoFactorEnabled}
                    trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
                    thumbColor={twoFactorEnabled ? '#0284C7' : '#FFFFFF'}
                  />
                </View>
                <Text style={styles.securityDetailDescription}>
                  Để giữ bảo mật tài khoản, bạn sẽ được yêu cầu xác minh qua tin nhắn SMS khi đăng nhập trên thiết bị mới.
                </Text>
                <View style={styles.securityInfoBanner}>
                  <Ionicons name="information-circle-outline" size={21} color="#2563EB" />
                  <Text style={styles.securityInfoText}>
                    {twoFactorEnabled ? 'Tính năng đang bật cho tài khoản của bạn.' : 'Bật tính năng để tăng bảo vệ tài khoản.'}
                  </Text>
                </View>
              </View>
            )}

            {securityDetail === 'devices' && (
              <View style={styles.securityDetailCard}>
                <Text style={styles.securityDetailCardTitle}>Các thiết bị hiện tại: 1</Text>
                <View style={styles.securityDeviceItem}>
                  <View style={styles.securityDeviceIcon}>
                    <Ionicons name="phone-portrait" size={22} color="#2563EB" />
                  </View>
                  <View style={styles.securityDeviceCopy}>
                    <Text style={styles.securityDeviceName}>Thiết bị hiện tại</Text>
                    <Text style={styles.securityDeviceMeta}>Android · Đang hoạt động</Text>
                    <Text style={styles.securityDeviceMeta}>Đăng nhập lúc 20:41 hôm nay</Text>
                  </View>
                  <Text style={styles.securityCurrentLabel}>Hiện tại</Text>
                </View>
                <Text style={styles.securityDetailDescription}>Thiết bị không hoạt động trong 3 tháng sẽ được đề xuất loại bỏ tự động.</Text>
              </View>
            )}

            {securityDetail === 'logins' && (
              <View style={styles.securityDetailCard}>
                <Text style={styles.securityDetailCardTitle}>Lịch sử đăng nhập</Text>
                {['Hôm nay · 20:41', '09-14 · 21:20', '09-14 · 21:08', '09-12 · 00:07'].map((loginItem) => (
                  <View key={loginItem} style={styles.securityLoginItem}>
                    <View style={styles.securityTimelineDot} />
                    <View style={styles.securityDeviceCopy}>
                      <Text style={styles.securityLoginName}>Đăng nhập tài khoản</Text>
                      <Text style={styles.securityDeviceMeta}>SM-A127F · Thiết bị hiện tại</Text>
                    </View>
                    <Text style={styles.securityLoginTime}>{loginItem}</Text>
                  </View>
                ))}
              </View>
            )}

            {securityDetail === 'question' && (
              <View style={styles.securityQuestionDetail}>
                <Text style={styles.securityQuestionDetailTitle}>{selectedSecurityQuestion}</Text>
                <Text style={styles.securityQuestionDetailDescription}>
                  {selectedSecurityQuestion === 'Mật khẩu mã hóa thiết bị là gì?'
                    ? 'Mật khẩu mã hóa thiết bị là một mật khẩu đối xứng được sử dụng để mã hóa luồng video và hình ảnh của thiết bị, với giá trị mặc định giống với mã xác minh thiết bị. Đề nghị thay đổi mật khẩu mặc định thành một mật khẩu an toàn sau khi liên kết thiết bị lần đầu tiên. Mật khẩu mã hóa thiết bị là chìa khóa cho cơ chế "Bảo mật Hợp tác" được cung cấp bởi EZVIZ. EZVIZ không ghi lại hoặc lưu trữ mật khẩu mã hóa thiết bị. Những mật khẩu này chỉ được lưu trữ trên các thiết bị tương ứng và điện thoại di động của người dùng. Việc thiết lập, cập nhật, sử dụng và hủy bỏ mật khẩu mã hóa đều được quản lý bởi người dùng. EZVIZ kỹ thuật không có khả năng lấy lại, đặt lại hoặc khôi phục mật khẩu mã hóa thiết bị.'
                    : selectedSecurityQuestion === 'Có ràng buộc một thiết bị an toàn không?'
                      ? 'Để kết nối một thiết bị EZVIZ, ba điều kiện sau phải được đáp ứng đồng thời:\n\n1. Biết số serial của thiết bị và mã xác thực tương ứng của thiết bị;\n\n2. Thiết bị đang trực tuyến;\n\n3. Thiết bị không được ràng buộc;\n\nViệc lấy số serial và mã xác thực là điều kiện tiên quyết quan trọng, nhưng không đảm bảo việc kết nối thiết bị. Nếu một thiết bị đã được kết nối bởi chủ sở hữu, người khác không thể kết nối thiết bị đó ngay cả khi họ có số serial và mã xác thực của nó. Chỉ có tài khoản đã kết nối thiết bị đó mới có thể hủy kết nối. EZVIZ khuyến khích người dùng kết nối thiết bị của mình ngay sau khi kết nối với mạng.'
                      : selectedSecurityQuestion === 'Việc sử dụng mã xác minh qua tin nhắn SMS'
                        ? 'Mã xác minh SMS là một lớp bảo mật bổ sung được cung cấp bởi EZVIZ vượt ra ngoài cơ sở tên người dùng-mật khẩu. Khi người dùng thực hiện các hoạt động nhạy cảm (như đăng nhập vào một khách hàng mới, tắt mã hóa thiết bị hoặc lấy mật khẩu tạm thời cho khóa, v.v.), EZVIZ yêu cầu sử dụng mã xác minh SMS cho xác thực cấp độ hai để tăng cường bảo mật và giảm thiểu rủi ro mất mát hoặc đánh cắp tài khoản người dùng. Do đó, rất quan trọng đối với người dùng để đảm bảo tính bảo mật của mã xác minh SMS và không tiết lộ cho người khác.'
                      : 'Hệ thống sử dụng các lớp bảo vệ tài khoản, xác minh thiết bị và mã xác thực để hạn chế truy cập trái phép. Bạn nên bật xác minh hai bước và thường xuyên kiểm tra lịch sử đăng nhập.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        transparent
        visible={isCustomerSupportVisible}
        animationType="fade"
        onRequestClose={() => setCustomerSupportVisible(false)}
      >
        <Pressable style={styles.customerSupportOverlay} onPress={() => setCustomerSupportVisible(false)}>
          <Pressable style={[styles.customerSupportDialog, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]} onPress={() => {}}>
            <Ionicons name="call" size={28} color="#DC2626" />
            <Text style={[styles.customerSupportTitle, isDarkMode && { color: '#F8FAFC' }]}>Hỗ trợ khẩn cấp</Text>
            <Text style={[styles.customerSupportMessage, isDarkMode && { color: '#94A3B8' }]}>
              Bạn muốn gọi tổng đài cấp cứu 115 ngay bây giờ?
            </Text>
            <View style={styles.customerSupportActions}>
              <TouchableOpacity
                style={[styles.customerSupportCancelButton, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => setCustomerSupportVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.customerSupportCancelText, isDarkMode && { color: '#94A3B8' }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customerSupportCallButton}
                onPress={() => {
                  setCustomerSupportVisible(false);
                  void callEmergencyService();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={17} color="#FFFFFF" />
                <Text style={styles.customerSupportCallText}>Gọi 115</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isSecurityCenterVisible}
        animationType="slide"
        onRequestClose={() => setSecurityCenterVisible(false)}
      >
        <SafeAreaView style={[styles.securityScreen, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.securityScrollContent}>
            <View style={[styles.securityHero, isDarkMode && { backgroundColor: '#0F766E' }]}>
              <TouchableOpacity
                style={styles.securityHeroBackButton}
                onPress={() => setSecurityCenterVisible(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back-outline" size={28} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
              </TouchableOpacity>
              <View style={styles.securityHeroShield}>
                <Ionicons name="shield-checkmark" size={108} color="rgba(255,255,255,0.88)" />
              </View>
              <Text style={[styles.securityHeroStatus, isDarkMode && { color: '#F8FAFC' }]}>Tốt</Text>
              <Text style={[styles.securityHeroDescription, isDarkMode && { color: '#E2E8F0' }]}>Có thể cải thiện 2 mục</Text>
              <TouchableOpacity style={styles.securityImproveButton} activeOpacity={0.8}>
                <Text style={[styles.securityImproveText, isDarkMode && { color: '#F8FAFC' }]}>Cải thiện ngay bây giờ</Text>
                <Ionicons name="chevron-forward" size={23} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.securitySectionCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
              <View style={styles.securitySectionHeader}>
                <Text style={[styles.securitySectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Bảo mật tài khoản</Text>
                <Ionicons name="ellipsis-vertical" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
              </View>
              <View style={styles.securityTileGrid}>
              <TouchableOpacity
                style={[styles.securityTile, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => {
                  setReturnToSecurityAfterPassword(true);
                  setSecurityCenterVisible(false);
                  setChangePasswordVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.securityTileTitle, isDarkMode && { color: '#F8FAFC' }]}>Đổi mật khẩu</Text>
                <Ionicons name="lock-closed" size={34} color="#38BDF8" style={styles.securityTileIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.securityTile, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => openSecurityDetail('twoFactor')}
                activeOpacity={0.8}
              >
                <Text style={[styles.securityTileTitle, isDarkMode && { color: '#F8FAFC' }]}>Xác minh hai bước</Text>
                <Ionicons name="shield-checkmark" size={34} color="#38BDF8" style={styles.securityTileIcon} />
                <Switch
                  value={twoFactorEnabled}
                  onValueChange={setTwoFactorEnabled}
                  style={styles.securityTileSwitch}
                  trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
                  thumbColor={twoFactorEnabled ? '#0284C7' : '#FFFFFF'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.securityTile, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => openSecurityDetail('devices')}
                activeOpacity={0.8}
              >
                <Text style={[styles.securityTileTitle, isDarkMode && { color: '#F8FAFC' }]}>Quản lý đầu cuối</Text>
                <Ionicons name="phone-portrait" size={34} color="#38BDF8" style={styles.securityTileIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.securityTile, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => openSecurityDetail('logins')}
                activeOpacity={0.8}
              >
                <Text style={[styles.securityTileTitle, isDarkMode && { color: '#F8FAFC' }]}>Đăng nhập tài khoản</Text>
                <Ionicons name="card-outline" size={34} color="#38BDF8" style={styles.securityTileIcon} />
              </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.securitySectionCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
              <View style={styles.securitySectionHeader}>
                <Text style={[styles.securitySectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Bạn cũng có thể hỏi</Text>
                <Ionicons name="ellipsis-vertical" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
              </View>
              {['Mật khẩu mã hóa thiết bị là gì?', 'Có ràng buộc một thiết bị an toàn không?', 'Bảo vệ quyền riêng tư của người dùng', 'Việc sử dụng mã xác minh qua tin nhắn SMS'].map((question) => (
                <TouchableOpacity
                  key={question}
                  style={[styles.securityQuestionRow, isDarkMode && { borderTopColor: '#334155' }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedSecurityQuestion(question);
                    openSecurityDetail('question');
                  }}
                >
                  <Text style={[styles.securityQuestionText, isDarkMode && { color: '#F8FAFC' }]}>{question}</Text>
                  <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        transparent
        visible={isLocationVisible}
        animationType="slide"
        onRequestClose={() => setLocationVisible(false)}
      >
        <Pressable style={styles.locationOverlay} onPress={() => setLocationVisible(false)}>
          <Pressable style={[styles.locationSheet, isDarkMode && { backgroundColor: '#1E293B' }]} onPress={() => {}}>
            <View style={styles.locationHeader}>
              <View style={styles.locationHeaderIcon}>
                <Ionicons name="navigate" size={22} color="#2563EB" />
              </View>
              <View style={styles.locationHeaderCopy}>
                <Text style={[styles.locationTitle, isDarkMode && { color: '#F8FAFC' }]}>Định vị địa lý</Text>
                <Text style={[styles.locationDescription, isDarkMode && { color: '#94A3B8' }]}>Xác định vị trí hiện tại của thiết bị</Text>
              </View>
              <TouchableOpacity
                style={styles.locationCloseIcon}
                onPress={() => setLocationVisible(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={20} color={isDarkMode ? '#F8FAFC' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.locationMapFrame, isDarkMode && { borderColor: '#334155', backgroundColor: '#0F172A' }]}>
              {locationCoords ? (
                Platform.OS === 'web' ? (
                  <View style={[styles.locationMap, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="map" size={48} color="#2563EB" />
                    <Text style={{ marginTop: 8, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A', fontSize: 13 }}>
                      Bản đồ OpenStreetMap
                    </Text>
                    <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 11, marginTop: 4 }}>
                      Tọa độ: {locationCoords.latitude.toFixed(4)}, {locationCoords.longitude.toFixed(4)}
                    </Text>
                  </View>
                ) : (
                  <WebView
                    originWhitelist={['*']}
                    source={{ html: locationMapHtml }}
                    style={styles.locationMap}
                    javaScriptEnabled
                    scrollEnabled={false}
                  />
                )
              ) : (
                <View style={styles.locationMapLoading}>
                  <Ionicons name="navigate-outline" size={30} color="#2563EB" />
                  <Text style={[styles.locationMapLoadingText, isDarkMode && { color: '#94A3B8' }]}>
                    {isLocationLoading ? 'Đang lấy vị trí hiện tại...' : 'Chưa có dữ liệu bản đồ'}
                  </Text>
                </View>
              )}
              <View style={[styles.locationMapBadge, isDarkMode && { backgroundColor: 'rgba(15, 23, 42, 0.9)' }]}>
                <View style={styles.locationMapBadgeDot} />
                <Text style={[styles.locationMapBadgeText, isDarkMode && { color: '#F8FAFC' }]}>Vị trí của bạn</Text>
              </View>
            </View>

            <View style={[styles.locationResultBox, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <View style={styles.locationResultIcon}>
                <Ionicons name="location" size={19} color="#2563EB" />
              </View>
              <View style={styles.locationResultCopy}>
                <View style={styles.locationStatusRow}>
                  <Text style={[styles.locationResultLabel, isDarkMode && { color: '#94A3B8' }]}>Vị trí hiện tại</Text>
                  <View style={[styles.locationStatusBadge, locationAddress ? styles.locationStatusBadgeActive : null]}>
                    <View style={[styles.locationStatusDot, locationAddress ? styles.locationStatusDotActive : null]} />
                    <Text style={[styles.locationStatusText, locationAddress ? styles.locationStatusTextActive : null]}>
                      {locationAddress ? 'Đã cập nhật' : 'Chưa cập nhật'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.locationResultText, isDarkMode && { color: '#F8FAFC' }]}>
                  {locationAddress || 'Nhấn nút bên dưới để lấy địa chỉ hiện tại'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleGetCurrentLocation}
              activeOpacity={0.85}
            >
              <Ionicons name={isLocationLoading ? 'sync-outline' : 'locate-outline'} size={20} color="#FFFFFF" />
              <Text style={styles.locationButtonText}>{isLocationLoading ? 'Đang định vị...' : 'Cập nhật vị trí'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locationCloseButton}
              onPress={() => setLocationVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.locationCloseText, isDarkMode && { color: '#94A3B8' }]}>Để sau</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isAvatarPickerVisible}
        animationType="fade"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <Pressable style={styles.avatarPickerOverlay} onPress={() => setAvatarPickerVisible(false)}>
          <Pressable style={[styles.avatarPickerSheet, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]} onPress={() => {}}>
            <View style={styles.avatarPickerOptions}>
              <TouchableOpacity style={[styles.avatarPickerRow, isDarkMode && { borderBottomColor: '#334155' }]} activeOpacity={0.8} onPress={pickAvatarFromCamera}>
                <Ionicons name="camera-outline" size={24} color={isDarkMode ? '#F8FAFC' : '#111827'} />
                <Text style={[styles.avatarPickerText, isDarkMode && { color: '#F8FAFC' }]}>Chụp ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.avatarPickerRow, styles.avatarPickerLastRow]} activeOpacity={0.8} onPress={pickAvatarFromLibrary}>
                <Ionicons name="images-outline" size={24} color={isDarkMode ? '#F8FAFC' : '#111827'} />
                <Text style={[styles.avatarPickerText, isDarkMode && { color: '#F8FAFC' }]}>Chọn từ Hình ảnh</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isChangePasswordVisible}
        animationType="slide"
        onRequestClose={closeChangePassword}
      >
        <SafeAreaView style={[styles.changePasswordScreen, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
          <View style={styles.changePasswordHeader}>
            <TouchableOpacity
              style={[styles.changePasswordBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
              onPress={closeChangePassword}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
            </TouchableOpacity>

            <Text style={[styles.changePasswordTitle, isDarkMode && { color: '#F8FAFC' }]}>Đổi mật khẩu</Text>

            <View style={styles.changePasswordHeaderRight} />
          </View>

          <ScrollView
            contentContainerStyle={styles.changePasswordContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.changePasswordIntro, isDarkMode && { color: '#94A3B8' }]}>
              Tạo mật khẩu mới để bảo vệ tài khoản của bạn.
            </Text>

            <Text style={[styles.passwordLabel, isDarkMode && { color: '#F8FAFC' }]}>Mật khẩu hiện tại</Text>
            <View style={[styles.passwordInputWrap, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.passwordInput, isDarkMode && { color: '#F8FAFC' }]}
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

            <Text style={[styles.passwordLabel, isDarkMode && { color: '#F8FAFC' }]}>Mật khẩu mới</Text>
            <View style={[styles.passwordInputWrap, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.passwordInput, isDarkMode && { color: '#F8FAFC' }]}
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

            <View style={[styles.passwordRequirements, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}>
              <Text style={[styles.passwordRequirementsTitle, isDarkMode && { color: '#F8FAFC' }]}>Các yêu cầu về mật khẩu:</Text>
              <Text style={[styles.passwordRequirement, isDarkMode && { color: '#94A3B8' }]}>◯  Dài 8-16 ký tự</Text>
              <Text style={[styles.passwordRequirement, isDarkMode && { color: '#94A3B8' }]}>
                ◯  Bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.
              </Text>
            </View>

            <Text style={[styles.passwordLabel, isDarkMode && { color: '#F8FAFC' }]}>Nhập lại mật khẩu mới</Text>
            <View style={[styles.passwordInputWrap, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.passwordInput, isDarkMode && { color: '#F8FAFC' }]}
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
        <Pressable style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setSettingsVisible(false)}>
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
                onPress={() => setSettingsVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài đặt</Text>
            </View>

            <View style={styles.settingsCard}>
              <View style={styles.settingsList}>
                {/* Khối 1: Hồ sơ của tôi */}
                <View style={[styles.settingsGroupCard, isDarkMode ? { backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: 16 } : { backgroundColor: '#FFFFFF', borderColor: '#F1F5F9', borderRadius: 16 }]}>
                  <TouchableOpacity
                    style={[styles.settingsItem, styles.settingsItemLast, isDarkMode && { borderBottomColor: '#334155' }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setAccountEntrySource('settings');
                      setSettingsVisible(false);
                      setUserMenuVisible(true);
                    }}
                  >
                    <View style={styles.settingsLeft}>
                      <View style={[styles.settingsIconWrap, isDarkMode && { backgroundColor: '#0F172A' }]}>
                        <Ionicons name="person-circle-outline" size={20} color={isDarkMode ? '#94A3B8' : '#475569'} />
                      </View>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Hồ sơ của tôi</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Khối 2: Nhóm 3 mục */}
                <View style={[styles.settingsGroupCard, isDarkMode ? { backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: 16 } : { backgroundColor: '#FFFFFF', borderColor: '#F1F5F9', borderRadius: 16 }]}>
                  <TouchableOpacity
                    style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSettingsVisible(false);
                      setGeneralSettingsVisible(true);
                    }}
                  >
                    <View style={styles.settingsLeft}>
                      <View style={[styles.settingsIconWrap, isDarkMode && { backgroundColor: '#0F172A' }]}>
                        <Ionicons name="settings-outline" size={20} color={isDarkMode ? '#94A3B8' : '#475569'} />
                      </View>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Cài đặt chung</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSettingsVisible(false);
                      setAccessibilityVisible(true);
                    }}
                  >
                    <View style={styles.settingsLeft}>
                      <View style={[styles.settingsIconWrap, isDarkMode && { backgroundColor: '#0F172A' }]}>
                        <Ionicons name="accessibility-outline" size={20} color={isDarkMode ? '#94A3B8' : '#475569'} />
                      </View>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Khả năng tiếp cận</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.settingsItem, styles.settingsItemLast]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSettingsVisible(false);
                      setAboutInfoVisible(true);
                    }}
                  >
                    <View style={styles.settingsLeft}>
                      <View style={[styles.settingsIconWrap, isDarkMode && { backgroundColor: '#0F172A' }]}>
                        <Ionicons name="information-circle-outline" size={20} color={isDarkMode ? '#94A3B8' : '#475569'} />
                      </View>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Thông tin</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Khối 3: Nhóm 2 mục */}
                <View style={[styles.settingsGroupCard, isDarkMode ? { backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: 16 } : { backgroundColor: '#FFFFFF', borderColor: '#F1F5F9', borderRadius: 16 }]}>
                  <TouchableOpacity
                    style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSettingsVisible(false);
                      setNotificationSettingsVisible(true);
                    }}
                  >
                    <View style={styles.settingsLeft}>
                      <View style={[styles.settingsIconWrap, isDarkMode && { backgroundColor: '#0F172A' }]}>
                        <Ionicons name="notifications-outline" size={20} color={isDarkMode ? '#94A3B8' : '#475569'} />
                      </View>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Thiết lập thông báo</Text>
                    </View>
                    <View style={styles.settingsRightStatus}>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.settingsItem, styles.settingsItemLast]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSettingsVisible(false);
                      setVibrationDetailVisible(true);
                    }}
                  >
                    <View style={styles.settingsLeft}>
                      <View style={[styles.settingsIconWrap, isDarkMode && { backgroundColor: '#0F172A' }]}>
                        <Ionicons name="phone-portrait-outline" size={20} color={isDarkMode ? '#94A3B8' : '#475569'} />
                      </View>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Rung</Text>
                    </View>
                    <View style={styles.settingsRightStatus}>
                      <Text style={[styles.settingsValueText, isDarkMode ? { color: '#94A3B8' } : { color: '#64748B' }]}>{vibrationEnabled ? 'Mở' : 'Tắt'}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isAccessibilityVisible}
        animationType="slide"
        onRequestClose={() => setAccessibilityVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            setAccessibilityVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
                onPress={() => {
                  setAccessibilityVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Khả năng tiếp cận</Text>
            </View>

            <View style={[styles.accessibilityList, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TouchableOpacity
                style={[styles.accessibilityRow, isDarkMode && { borderBottomColor: '#334155' }]}
                activeOpacity={0.8}
                onPress={() => {
                  setAccessibilityVisible(false);
                  setFontSizeVisible(true);
                }}
              >
                <Text style={[styles.accessibilityLabel, isDarkMode && { color: '#F8FAFC' }]}>Kích thước phông chữ</Text>
                <View style={styles.accessibilityValueWrap}>
                  <Text style={[styles.accessibilityValue, isDarkMode && { color: '#94A3B8' }]}>{fontSizeMode === 'system' ? 'Theo hệ thống' : 'Tùy chỉnh'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <View style={[styles.accessibilityRow, styles.accessibilityRowLast]}>
                <Text style={[styles.accessibilityLabel, isDarkMode && { color: '#F8FAFC' }]}>Tăng độ tương phản</Text>
                <Switch
                  value={highContrastEnabled}
                  onValueChange={setHighContrastEnabled}
                  trackColor={{ false: '#D1D5DB', true: '#9BD7D0' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isFontSizeVisible}
        animationType="slide"
        onRequestClose={() => setFontSizeVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            setFontSizeVisible(false);
            setAccessibilityVisible(true);
          }}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
                onPress={() => {
                  setFontSizeVisible(false);
                  setAccessibilityVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Kích thước phông chữ</Text>
            </View>

            <View style={styles.fontSizeList}>
              <TouchableOpacity
                style={[styles.fontSizeOption, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                activeOpacity={0.8}
                onPress={() => {
                  setFontSizeMode('system');
                }}
              >
                <Text style={[styles.fontSizeOptionText, isDarkMode && { color: '#F8FAFC' }]}>Theo hệ thống</Text>
                {fontSizeMode === 'system' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fontSizeOption, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                activeOpacity={0.8}
                onPress={() => setFontSizeMode('custom')}
              >
                <Text style={[styles.fontSizeOptionText, isDarkMode && { color: '#F8FAFC' }]}>Tùy chỉnh</Text>
                {fontSizeMode === 'custom' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
              </TouchableOpacity>

              {fontSizeMode === 'custom' && (
                <View style={[styles.customFontSliderPanel, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18, padding: 16 }]}>
                  <Text style={[styles.customFontSliderTitle, isDarkMode && { color: '#F8FAFC' }]}>Mặc định</Text>

                  <View style={styles.customFontSliderRow}>
                    <Text style={[styles.customFontSmall, isDarkMode && { color: '#94A3B8' }]}>Aa</Text>

                    <View
                      style={styles.customFontTrackWrap}
                      onLayout={(event) => {
                        const { width, x } = event.nativeEvent.layout;
                        setSliderWidth(width);
                        sliderTrackPosition.current = x;
                      }}
                      {...fontSliderResponder.panHandlers}
                    >
                      <View style={[styles.customFontTrack, isDarkMode && { backgroundColor: '#334155' }]}>
                        {[0, 1, 2, 3, 4].map((value) => (
                          <View
                            key={value}
                            style={[
                              styles.customFontTick,
                              customFontScale === value && styles.customFontTickSelected,
                            ]}
                          />
                        ))}

                        <View
                          style={[
                            styles.customFontThumb,
                            { left: `${(customFontScale / 4) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>

                    <Text style={[styles.customFontLarge, isDarkMode && { color: '#F8FAFC' }]}>Aa</Text>
                  </View>
                </View>
              )}

              <Text style={[styles.fontSizeNote, isDarkMode && { color: '#94A3B8' }]}>
                Nếu một số văn bản hoặc nội dung không được phóng to, hãy nhấn và giữ màn hình để kích hoạt tính năng Zoom.
              </Text>

              <Text style={styles.fontSizeLink}>Cách sử dụng tính năng Zoom</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isAboutInfoVisible}
        animationType="slide"
        onRequestClose={() => setAboutInfoVisible(false)}
      >
        <Pressable
          style={[styles.infoOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            setAboutInfoVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={[styles.infoScreen, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.infoHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.infoBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
                onPress={() => {
                  if (infoDetail) {
                    setInfoDetail(null);
                  } else {
                    setAboutInfoVisible(false);
                    setSettingsVisible(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.infoTitle, isDarkMode && { color: '#F8FAFC' }]}>
                {infoDetail === 'terms' ? 'Điều khoản sử dụng' : infoDetail === 'app' ? 'Thông tin ứng dụng' : 'Thông tin'}
              </Text>
            </View>

            {infoDetail === null ? (
              <View style={[styles.infoListCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <TouchableOpacity
                  style={[styles.infoListRow, isDarkMode && { borderBottomColor: '#334155' }]}
                  activeOpacity={0.8}
                  onPress={() => setInfoDetail('terms')}
                >
                  <Text style={[styles.infoRowText, isDarkMode && { color: '#F8FAFC' }]}>Điều khoản sử dụng</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.infoListRow, { borderBottomWidth: 0 }]}
                  activeOpacity={0.8}
                  onPress={() => setInfoDetail('app')}
                >
                  <Text style={[styles.infoRowText, isDarkMode && { color: '#F8FAFC' }]}>Thông tin ứng dụng</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.infoDetailContent}
              >
                {infoDetail === 'terms' ? (
                  <>
                    <Text style={[styles.infoDetailHeading, isDarkMode && { color: '#F8FAFC' }]}>Điều khoản sử dụng</Text>
                    <Text style={[styles.infoDetailText, isDarkMode && { color: '#94A3B8' }]}>
                      Ứng dụng Smart Elderly Care AI hỗ trợ theo dõi sức khoẻ, thiết bị và cảnh báo an toàn cho người cao tuổi. Người dùng cần cung cấp thông tin chính xác và sử dụng ứng dụng đúng mục đích.
                    </Text>
                    <Text style={[styles.infoDetailText, isDarkMode && { color: '#94A3B8' }]}>
                      Người dùng chịu trách nhiệm bảo mật tài khoản, mã xác thực và các thiết bị đã liên kết. Không chia sẻ thông tin đăng nhập cho người khác.
                    </Text>
                    <Text style={[styles.infoDetailText, isDarkMode && { color: '#94A3B8' }]}>
                      Các cảnh báo trong ứng dụng chỉ có tính chất hỗ trợ theo dõi, không thay thế cho chẩn đoán hoặc điều trị y tế chuyên môn.
                    </Text>
                  </>
                ) : (
                  <View style={styles.appInfoPanel}>
                    <View style={styles.appInfoIcon}>
                      <Ionicons name="shield-checkmark" size={38} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.infoDetailHeading, isDarkMode && { color: '#F8FAFC' }]}>Smart Elderly Care AI</Text>
                    <Text style={[styles.appInfoVersion, isDarkMode && { color: '#94A3B8' }]}>Phiên bản 1.0.0</Text>
                    <Text style={[styles.infoDetailText, isDarkMode && { color: '#94A3B8' }]}>
                      Hệ thống giám sát thông minh giúp gia đình theo dõi sức khỏe, thiết bị và nhận cảnh báo kịp thời.
                    </Text>
                    <Text style={[styles.appInfoCopyright, isDarkMode && { color: '#64748B' }]}>© 2026 Smart Elderly Care AI</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isVibrationDetailVisible}
        animationType="slide"
        onRequestClose={() => setVibrationDetailVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            setVibrationDetailVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={[styles.vibrationDetailSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
                onPress={() => {
                  setVibrationDetailVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Rung</Text>
            </View>

            <View style={[styles.vibrationDetailRow, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <Text style={[styles.vibrationDetailLabel, isDarkMode && { color: '#F8FAFC' }]}>Rung</Text>
              <Switch value={vibrationEnabled} onValueChange={handleVibrationToggle} />
            </View>

            <Text style={[styles.vibrationDetailDescription, isDarkMode && { color: '#94A3B8' }]}>
              Khi được bật, điện thoại / máy tính bảng của bạn sẽ rung khi bật nhấn / 
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isNotificationSettingsVisible}
        animationType="slide"
        onRequestClose={() => setNotificationSettingsVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            setNotificationSettingsVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
                onPress={() => {
                  setNotificationSettingsVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Thiết lập thông báo</Text>
            </View>

            <View style={styles.notificationSettingsContent}>
              <Text style={[styles.notificationSettingsIntro, isDarkMode && { color: '#94A3B8' }]}>
                Chọn cách bạn muốn nhận cảnh báo từ hệ thống.
              </Text>

              <View style={[styles.notificationSettingsCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>Thông báo cảnh báo</Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>Nhận cảnh báo sức khỏe mới</Text>
                  </View>
                  <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
                </View>
                <View style={[styles.notificationSettingDivider, isDarkMode && { backgroundColor: '#334155' }]} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>Âm thanh cảnh báo</Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>Phát âm thanh khi có cảnh báo</Text>
                  </View>
                  <Switch value={alertSoundEnabled} onValueChange={setAlertSoundEnabled} />
                </View>
                <View style={[styles.notificationSettingDivider, isDarkMode && { backgroundColor: '#334155' }]} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>Cảnh báo khẩn cấp</Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>Luôn ưu tiên cảnh báo nguy hiểm</Text>
                  </View>
                  <Switch value={criticalAlertEnabled} onValueChange={setCriticalAlertEnabled} />
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isGeneralSettingsVisible}
        animationType="slide"
        onRequestClose={() => setGeneralSettingsVisible(false)}
      >
        <Pressable style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setGeneralSettingsVisible(false)}>
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 }]}
                onPress={() => {
                  setGeneralSettingsVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài đặt chung</Text>
            </View>

            <View style={[styles.generalSettingsList, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18, overflow: 'hidden' }]}>
              <View style={[styles.generalRow, isDarkMode && { borderBottomColor: '#334155' }]}>
                <Text style={[styles.generalRowLabel, isDarkMode && { color: '#F8FAFC' }]}>Vùng</Text>
                <Text style={[styles.generalRowValue, isDarkMode && { color: '#94A3B8' }]}>Vietnam</Text>
              </View>

              <TouchableOpacity
                style={[styles.generalRow, isDarkMode && { borderBottomColor: '#334155' }]}
                activeOpacity={0.8}
                onPress={() => setLanguageVisible(true)}
              >
                <Text style={[styles.generalRowLabel, isDarkMode && { color: '#F8FAFC' }]}>Ngôn ngữ</Text>
                <View style={styles.generalValueWrap}>
                  <Text style={[styles.generalRowValue, isDarkMode && { color: '#94A3B8' }]}>{languageMode === 'vi' ? 'Việt Nam' : 'English'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.generalRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.8}
                onPress={() => setAppearanceVisible(true)}
              >
                <Text style={[styles.generalRowLabel, isDarkMode && { color: '#F8FAFC' }]}>Chế độ tối</Text>
                <View style={styles.generalValueWrap}>
                  <Text style={[styles.generalRowValue, isDarkMode && { color: '#94A3B8' }]}>{appearanceMode === 'light' ? 'Màu sáng' : 'Tối'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isLanguageVisible}
        animationType="slide"
        onRequestClose={() => setLanguageVisible(false)}
      >
        <Pressable style={[styles.appearanceOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setLanguageVisible(false)}>
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={[styles.appearanceCloseButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => setLanguageVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={28} color={isDarkMode ? '#F8FAFC' : '#111827'} />
              </TouchableOpacity>

              <Text style={[styles.appearanceTitle, isDarkMode && { color: '#F8FAFC' }]}>Ngôn ngữ</Text>
              <View style={styles.appearanceHeaderSpacer} />
            </View>

            <View style={[styles.appearanceCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  languageMode === 'vi' && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setLanguageMode('vi');
                  setLanguageVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>Việt Nam</Text>
                {languageMode === 'vi' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  languageMode === 'en' && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setLanguageMode('en');
                  setLanguageVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>English</Text>
                {languageMode === 'en' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
              </TouchableOpacity>
              
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={isAppearanceVisible}
        animationType="slide"
        onRequestClose={() => setAppearanceVisible(false)}
      >
        <Pressable style={styles.appearanceOverlay} onPress={() => setAppearanceVisible(false)}>
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={styles.appearanceCloseButton}
                onPress={() => setAppearanceVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={28} color={isDarkMode ? colors.textPrimary : '#111827'} />
              </TouchableOpacity>

              <Text style={[styles.appearanceTitle, isDarkMode && { color: colors.textPrimary }]}>Về bề ngoài</Text>
              <View style={styles.appearanceHeaderSpacer} />
            </View>

            <View style={[styles.appearanceCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  appearanceMode === 'light' && styles.appearanceOptionRowSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setAppearanceMode('light');
                  setDarkMode(false);
                  setAppearanceVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: colors.textPrimary }]}>Màu sáng</Text>
                {appearanceMode === 'light' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  appearanceMode === 'dark' && styles.appearanceOptionRowSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setAppearanceMode('dark');
                  setDarkMode(true);
                  setAppearanceVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: colors.textPrimary }]}>Tối</Text>
                {appearanceMode === 'dark' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
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
          <TouchableOpacity
            style={styles.avatarContainer}
            activeOpacity={0.8}
            onPress={() => {
              setAccountEntrySource('main');
              setUserMenuVisible(true);
            }}
          >
            <View style={[styles.avatarCircle, isDarkMode && { backgroundColor: colors.card }]}>
              <Ionicons name="person" size={38} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={[styles.userIdText, isDarkMode && { color: colors.textPrimary }]}>1057</Text>
              <Text style={[styles.userRoleText, isDarkMode && { color: colors.textSecondary }]}>{userName || 'Người chăm sóc chính'}</Text>
              <View style={[styles.accountBadgeWrap, isDarkMode && { backgroundColor: colors.card }]}>
                <View style={styles.accountBadgeDot} />
                <Text style={[styles.accountBadgeText, isDarkMode && { color: colors.textSecondary }]}>Xem tài khoản</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* 3. Card "Nhà của tôi" (Thành viên: 1, icon add user -> mở Hình 3) */}
        <TouchableOpacity
          style={[styles.houseCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => navigation.navigate('HouseDetail')}
          activeOpacity={0.9}
        >
          <View>
            <Text style={[styles.houseCardTitle, isDarkMode && { color: colors.textPrimary }]}>{house.name}</Text>
            <Text style={[styles.houseCardSub, isDarkMode && { color: colors.textSecondary }]}>Thành viên: {house.membersCount}</Text>
          </View>
          <View style={[styles.addMemberCircleBtn, isDarkMode && { backgroundColor: colors.background }]}>
            <Ionicons name="person-add" size={18} color={isDarkMode ? colors.textSecondary : '#94A3B8'} />
          </View>
        </TouchableOpacity>

        {/* 4. Menu Card 1: Thuật toán cảnh báo và thiết bị IoT */}
        <View style={[styles.menuGroupCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          {/* Row 1: Chơi Algo (Thuật toán cảnh báo) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('AlgoConfig')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDarkMode ? '#3B1D54' : '#F3E8FF' }]}>
              <Ionicons name="color-wand" size={20} color="#A855F7" />
            </View>
            <Text style={[styles.menuTitleText, isDarkMode && { color: colors.textPrimary }]}>Chơi Algo</Text>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textSecondary : '#CBD5E1'} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, isDarkMode && { backgroundColor: colors.border }]} />

          {/* Row 2: Hoạt động với (Thiết bị IoT) */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Devices')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDarkMode ? '#4A2810' : '#FFEDD5' }]}>
              <Ionicons name="hardware-chip" size={20} color="#F97316" />
            </View>
            <Text style={[styles.menuTitleText, isDarkMode && { color: colors.textPrimary }]}>Hoạt động với</Text>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textSecondary : '#CBD5E1'} />
          </TouchableOpacity>
        </View>

        {/* 5. Menu Card 2: Báo cáo y tế & Cài Đặt */}
        <View style={[styles.menuGroupCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          {/* Row 1: Đơn hàng của tôi / Báo cáo y tế xuất PDF/Excel */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('MedicalReport')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDarkMode ? '#3B1D54' : '#F3E8FF' }]}>
              <Ionicons name="bag-handle" size={20} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitleText, isDarkMode && { color: colors.textPrimary }]}>Báo cáo</Text>
              <Text style={[styles.menuSubText, isDarkMode && { color: colors.textSecondary }]}>Báo cáo y tế &amp; Xuất file (FR13)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textSecondary : '#CBD5E1'} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, isDarkMode && { backgroundColor: colors.border }]} />

          {/* Row 2: Cài Đặt (Có chấm đỏ thông báo cập nhật) */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleCustomerSupportPress}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDarkMode ? '#4C1D1D' : '#FEE2E2' }]}>
              <Ionicons name="call-outline" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.menuTitleText, isDarkMode && { color: colors.textPrimary }]}>Liên hệ khẩn cấp tới dịch vụ CSKH</Text>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textSecondary : '#CBD5E1'} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, isDarkMode && { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => setLocationVisible(true)}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDarkMode ? '#1E2958' : '#DBEAFE' }]}>
              <Ionicons name="location-outline" size={20} color="#2563EB" />
            </View>
            <Text style={[styles.menuTitleText, isDarkMode && { color: colors.textPrimary }]}>Định vị địa lý</Text>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textSecondary : '#CBD5E1'} />
          </TouchableOpacity>
        </View>

        <View style={[styles.menuGroupCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setSecurityCenterVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDarkMode ? '#133E3B' : '#CCFBF1' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#0F766E" />
            </View>
            <View style={styles.securityMenuCopy}>
              <Text style={[styles.menuTitleText, isDarkMode && { color: colors.textPrimary }]}>Trung tâm bảo mật</Text>
              <Text style={[styles.menuSubText, isDarkMode && { color: colors.textSecondary }]}>Bảo vệ tài khoản và thiết bị</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textSecondary : '#CBD5E1'} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, isDarkMode && { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDarkMode ? '#452F10' : '#FEF3C7' }]}>
              <Ionicons name="settings" size={20} color="#D97706" />
            </View>
            <Text style={[styles.menuTitleText, isDarkMode && { color: colors.textPrimary }]}>Cài Đặt</Text>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textSecondary : '#CBD5E1'} />
          </TouchableOpacity>
        </View>

        
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
    paddingTop: 30,
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  customerSupportOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  customerSupportDialog: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  customerSupportTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  customerSupportMessage: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#64748B',
  },
  customerSupportActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 22,
  },
  customerSupportCancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
  },
  customerSupportCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  customerSupportCallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: '#DC2626',
  },
  customerSupportCallText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  securityScreen: {
    flex: 1,
    backgroundColor: '#F6F8F8',
  },
  securityScrollContent: {
    paddingBottom: 28,
  },
  securityHero: {
    position: 'relative',
    minHeight: 324,
    paddingHorizontal: 22,
    paddingTop: 8,
    backgroundColor: '#5ADCE5',
    overflow: 'hidden',
  },
  securityBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginTop: 1,
  },
  securityHeroBackButton: {
    position: 'absolute',
    left: 0,
    top: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityHeroShield: {
    position: 'absolute',
    right: 18,
    top: 90,
    opacity: 0.9,
  },
  securityHeroStatus: {
    marginTop: 56,
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityHeroDescription: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
  },
  securityImproveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 30,
  },
  securityImproveText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  securitySectionCard: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  securitySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  securitySectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#2F3338',
  },
  securityTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 10,
    rowGap: 14,
  },
  securityTile: {
    width: '48.2%',
    minHeight: 124,
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 17,
    borderRadius: 17,
    backgroundColor: '#EAF1FC',
    position: 'relative',
    overflow: 'hidden',
  },
  securityTileTitle: {
    maxWidth: '92%',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#30343A',
    textAlign: 'left',
  },
  securityTileIcon: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  securityTileSwitch: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    transform: [{ scale: 0.8 }],
  },
  securityQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
  },
  securityQuestionText: {
    flex: 1,
    paddingRight: 12,
    fontSize: 15,
    lineHeight: 21,
    color: '#3C4045',
  },
  securityDetailScreen: {
    flex: 1,
    backgroundColor: '#F6F8F8',
  },
  securityDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#F6F8F8',
  },
  securityDetailTitle: {
    flex: 1,
    marginRight: 36,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
  },
  securityDetailContent: {
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 32,
  },
  securityQuestionDetail: {
    backgroundColor: 'transparent',
  },
  securityQuestionDetailTitle: {
    marginBottom: 32,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: '400',
    color: '#303236',
  },
  securityQuestionDetailDescription: {
    fontSize: 16,
    lineHeight: 27,
    fontWeight: '400',
    color: '#4B4D50',
  },
  securityDetailCard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  securityDetailRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  securityDetailCardTitle: {
    flex: 1,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  securityDetailDescription: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  securityInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  securityInfoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  securityDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#EAF0F8',
  },
  securityDeviceIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
  },
  securityDeviceCopy: {
    flex: 1,
    marginHorizontal: 10,
    minWidth: 0,
  },
  securityDeviceName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: '#111827',
  },
  securityLoginName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: '#111827',
  },
  securityDeviceMeta: {
    marginTop: 2,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  securityCurrentLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  securityLoginItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  securityTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#5B8DEF',
    marginRight: 12,
    marginTop: 2,
  },
  securityLoginTime: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
  },
  securityOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  securitySheet: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#F8FAFC',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  securityHeaderIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 15,
    backgroundColor: '#CCFBF1',
  },
  securityHeaderCopy: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  securitySubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
  securityCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
  },
  securityScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
  },
  securityScoreIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#BBF7D0',
  },
  securityScoreCopy: {
    flex: 1,
    marginLeft: 10,
  },
  securityScoreLabel: {
    fontSize: 12,
    color: '#166534',
  },
  securityScoreValue: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '800',
    color: '#15803D',
  },
  securityScorePercent: {
    fontSize: 20,
    fontWeight: '900',
    color: '#15803D',
  },
  securityList: {
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
  },
  securityRowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  securityRowCopy: {
    flex: 1,
    marginHorizontal: 10,
  },
  securityRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  securityRowDescription: {
    marginTop: 3,
    fontSize: 11,
    color: '#64748B',
  },
  securityDivider: {
    height: 1,
    backgroundColor: '#EEF2F7',
  },
  securityMenuCopy: {
    flex: 1,
  },
  avatarPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPickerSheet: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarPickerClose: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  avatarPickerHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 18,
  },
  avatarPickerAvatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#D1D5DB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarPickerAvatar: {
    width: '100%',
    height: '100%',
  },
  avatarPickerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  avatarPickerOptions: {
    backgroundColor: '#FFFFFF',
  },
  avatarPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  avatarPickerLastRow: {
    borderBottomWidth: 0,
  },
  avatarPickerText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#111827',
  },
  locationOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  locationSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  locationHeaderIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 15,
    backgroundColor: '#DBEAFE',
  },
  locationHeaderCopy: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  locationDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
  },
  locationCloseIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
  },
  locationMapFrame: {
    height: 190,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8E5F2',
    borderRadius: 16,
    backgroundColor: '#EAF2F8',
    position: 'relative',
  },
  locationMap: {
    flex: 1,
  },
  locationMapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2F8',
  },
  locationMapLoadingText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#42617E',
  },
  locationMapBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  locationMapBadgeDot: {
    width: 7,
    height: 7,
    marginRight: 5,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  locationMapBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  locationResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 86,
    padding: 13,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    marginBottom: 16,
  },
  locationResultIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
  },
  locationResultCopy: {
    flex: 1,
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationResultLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  locationStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  locationStatusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  locationStatusDot: {
    width: 6,
    height: 6,
    marginRight: 4,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  locationStatusDotActive: {
    backgroundColor: '#16A34A',
  },
  locationStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  locationStatusTextActive: {
    color: '#15803D',
  },
  locationResultText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#315A9A',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  locationButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  locationCloseButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  locationCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  logoutInlineOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoutDialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 22,
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  logoutMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
    marginBottom: 20,
  },
  logoutActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  logoutCancelButton: {
    minWidth: 78,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    alignItems: 'center',
  },
  logoutCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  logoutConfirmButton: {
    minWidth: 100,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    paddingVertical: 11,
    alignItems: 'center',
  },
  logoutConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userMenuSheet: {
    position: 'relative',
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 26,
    paddingTop: 10,
    paddingBottom: 28,
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'flex-start',
    marginTop: 0,
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  settingsSheet: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    marginTop: 0,
  },
  settingsHeaderRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 10,
    paddingTop: 6,
    paddingBottom: 6,
    minHeight: 44,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  settingsSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 14,
    paddingLeft: 4,
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  infoScreen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  infoHeaderRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 40,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  infoBrandWrapper: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  infoBrandIconWrap: {
    width: 92,
    height: 92,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#1E90FF',
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  infoBrandName: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  infoVersionText: {
    marginTop: 10,
    fontSize: 17,
    color: '#374151',
    fontWeight: '500',
  },
  infoListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  infoListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  infoDetailContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  infoDetailHeading: {
    marginBottom: 18,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  infoDetailText: {
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  appInfoPanel: {
    alignItems: 'center',
    paddingTop: 20,
  },
  appInfoIcon: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderRadius: 20,
    backgroundColor: '#2563EB',
  },
  appInfoVersion: {
    marginBottom: 24,
    fontSize: 14,
    color: '#64748B',
  },
  appInfoCopyright: {
    marginTop: 6,
    fontSize: 13,
    color: '#94A3B8',
  },
  generalSettingsList: {
    marginTop: 8,
  },
  accessibilityList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  accessibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  accessibilityRowLast: {
    borderBottomWidth: 0,
  },
  accessibilityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  accessibilityValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accessibilityValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#64748B',
  },
  fontSizeList: {
    marginTop: 8,
  },
  fontSizeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    marginBottom: 12,
  },
  fontSizeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  customFontSliderPanel: {
    marginTop: 18,
    marginBottom: 10,
    paddingTop: 6,
  },
  customFontSliderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 14,
    marginLeft: 6,
  },
  customFontSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  customFontSmall: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3F3F46',
    marginRight: 4,
  },
  customFontLarge: {
    fontSize: 30,
    fontWeight: '500',
    color: '#3F3F46',
    marginLeft: 4,
  },
  customFontTrackWrap: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  customFontTrack: {
    position: 'relative',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  customFontTick: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  customFontTickSelected: {
    backgroundColor: '#1D9BF0',
    borderColor: '#1D9BF0',
  },
  customFontThumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1D9BF0',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#1D9BF0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ translateX: -10 }],
  },
  fontSizeNote: {
    fontSize: 15,
    lineHeight: 24,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 10,
  },
  fontSizeLink: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1D9BF0',
    textDecorationLine: 'underline',
  },
  generalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  generalRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  generalRowValue: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  generalValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  appearanceOverlay: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    justifyContent: 'flex-start',
  },
  appearanceSheet: {
    width: '100%',
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 0,
    overflow: 'hidden',
    paddingTop: 12,
    paddingHorizontal: 0,
    paddingBottom: 18,
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  appearanceHeaderSpacer: {
    width: 36,
    height: 36,
  },
  appearanceCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearanceTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  appearanceCard: {
    marginTop: 8,
    marginHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
  },
  appearanceOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  appearanceOptionRowSelected: {
    backgroundColor: '#FFFFFF',
  },
  appearanceOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
    marginLeft: -8,
    paddingTop: 0,
    zIndex: 2,
    elevation: 2,
  },
  settingsBackButton: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  infoBackButton: {
    position: 'absolute',
    left: 0,
    top: 0,
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
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  changePasswordBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  changePasswordHeaderRight: {
    width: 36,
    height: 36,
  },
  changePasswordTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  changePasswordContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },
  changePasswordIntro: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  passwordLabel: {
    marginBottom: 7,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    marginBottom: 17,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    paddingRight: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  passwordRequirements: {
    marginBottom: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  passwordRequirementsTitle: {
    marginBottom: 6,
    fontSize: 14,
    color: '#64748B',
  },
  passwordRequirement: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  changePasswordButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 49,
    marginTop: 13,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    width: '100%',
  },
  changePasswordButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  notificationSettingsContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 18,
    backgroundColor: '#F8FAFC',
  },
  notificationSettingsIntro: {
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  notificationSettingsCard: {
    borderWidth: 1,
    borderColor: '#E5EAF1',
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  notificationSettingRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
  },
  notificationSettingText: {
    flex: 1,
  },
  notificationSettingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  notificationSettingDescription: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
  notificationSettingDivider: {
    height: 1,
    backgroundColor: '#EDF1F5',
  },
  avatarContainerLarge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    marginTop: 10,
  },
  avatarCircleLarge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#D5D7DB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImageLarge: {
    width: '100%',
    height: '100%',
  },
  avatarAddBadge: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileNameText: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  profileInfoListCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
  },
  infoRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
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
  container: {
  flex: 1,
},

logoutButton: {
  width: '100%',
  marginTop: 'auto',
  marginBottom: 25,
  borderRadius: 26,
  borderWidth: 1.8,
  borderColor: '#F87171',
  backgroundColor: '#FFFFFF',
  paddingVertical: 12,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 54,
},
  logoutButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.12,
  },
  editorOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'flex-start',
  },
  editorSheet: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    justifyContent: 'flex-start',
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    marginBottom: 12,
  },
  editorBackButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    marginRight: 4,
  },
  editorTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 2,
  },
  editorInput: {
    borderWidth: 1,
    borderColor: '#D7DEE7',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  editorCancel: {
    minWidth: 78,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  editorCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  editorSave: {
    minWidth: 80,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  editorSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
    marginTop: 0,
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
  accountBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  accountBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0EA5E9',
    marginRight: 6,
  },
  accountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
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
  settingsCard: {
    backgroundColor: 'transparent',
    marginTop: 0,
  },
  settingsList: {
    gap: 12,
    paddingBottom: 0,
  },
  settingsGroupCard: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: 'transparent',
  },
  settingsItemLast: {
    borderBottomWidth: 0,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingsRightStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 32,
  },
  settingsValueText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  vibrationDetailSheet: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  vibrationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  vibrationDetailLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  vibrationDetailDescription: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 24,
    color: '#64748B',
    textAlign: 'left',
  },
  redBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4D4F',
    marginRight: 8,
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
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...Shadows.card,
  },
  confirmModalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmModalButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  confirmModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  confirmModalLogoutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalLogoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

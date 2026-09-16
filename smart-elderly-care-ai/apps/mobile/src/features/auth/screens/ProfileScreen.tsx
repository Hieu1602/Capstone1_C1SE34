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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';

export default function ProfileScreen({ navigation }: any) {
  const { userId, userEmail, userName, logout, setUser } = useAuthStore();
  const { house } = useVitalStore();
  const [profileName, setProfileName] = React.useState(userName || 'ngolevinh233');
  const [profileEmail, setProfileEmail] = React.useState(userEmail || 'ngolevinh233@gmail.com');
  const [profilePhone, setProfilePhone] = React.useState('0912 345 678');
  const [editingField, setEditingField] = React.useState<'name' | 'email' | null>(null);
  const [draftValue, setDraftValue] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  const [otpSentForEmail, setOtpSentForEmail] = React.useState(false);
  const [isUserMenuVisible, setUserMenuVisible] = React.useState(false);
  const [isAvatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [isLocationVisible, setLocationVisible] = React.useState(false);
  const [locationAddress, setLocationAddress] = React.useState('');
  const [isSettingsVisible, setSettingsVisible] = React.useState(false);
  const [accountEntrySource, setAccountEntrySource] = React.useState<'main' | 'settings'>('main');
  const [isNotificationSettingsVisible, setNotificationSettingsVisible] = React.useState(false);
  const [isVibrationDetailVisible, setVibrationDetailVisible] = React.useState(false);
  const [isAboutInfoVisible, setAboutInfoVisible] = React.useState(false);
  const [isGeneralSettingsVisible, setGeneralSettingsVisible] = React.useState(false);
  const [isAccessibilityVisible, setAccessibilityVisible] = React.useState(false);
  const [isFontSizeVisible, setFontSizeVisible] = React.useState(false);
  const [fontSizeMode, setFontSizeMode] = React.useState<'system' | 'custom'>('system');
  const [customFontScale, setCustomFontScale] = React.useState(2);
  const [isAppearanceVisible, setAppearanceVisible] = React.useState(false);
  const [appearanceMode, setAppearanceMode] = React.useState<'light' | 'dark'>('light');
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

  const handleVibrationToggle = (value: boolean) => {
    setVibrationEnabled(value);

    if (value) {
      Vibration.vibrate(80);
      return;
    }

    Vibration.cancel();
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

  const openFieldEditor = (field: 'name' | 'email') => {
    const value = field === 'name' ? profileName : profileEmail;
    setDraftValue(value);
    setOtpCode('');
    setOtpSentForEmail(false);
    setEditingField(field);
  };

  const closeFieldEditor = () => {
    setEditingField(null);
    setDraftValue('');
    setOtpCode('');
    setOtpSentForEmail(false);
  };

  const handleSendOtp = () => {
    const trimmed = draftValue.trim();

    if (!trimmed) {
      Alert.alert('Lỗi', 'Email không được để trống.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Lỗi', 'Email không hợp lệ. Ví dụ: ten@gmail.com');
      return;
    }

    setOtpSentForEmail(true);
    Alert.alert('Đã gửi mã OTP', `Mã xác thực đã được gửi tới ${trimmed}`);
  };

  const saveEditedField = () => {
    if (!editingField) return;

    const trimmed = draftValue.trim();
    if (!trimmed) {
      Alert.alert('Lỗi', editingField === 'name' ? 'Tên không được để trống.' : 'Email không được để trống.');
      return;
    }

    if (editingField === 'name') {
      setProfileName(trimmed);
      setUser(userId ?? 'demo-user-001', userEmail ?? profileEmail, trimmed);
      closeFieldEditor();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Lỗi', 'Email không hợp lệ. Ví dụ: ten@gmail.com');
      return;
    }

    if (!otpSentForEmail) {
      Alert.alert('Lỗi', 'Vui lòng gửi mã OTP trước khi lưu thay đổi.');
      return;
    }

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã OTP gồm 6 chữ số.');
      return;
    }

    setProfileEmail(trimmed);
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
    setChangePasswordVisible(false);
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
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền bị từ chối', 'Bạn cần cho phép truy cập vị trí để sử dụng định vị địa lý.');
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
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
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Modal
        transparent
        visible={isUserMenuVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!isLogoutConfirmVisible) closeUserMenu();
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isLogoutConfirmVisible) closeUserMenu();
          }}
        >
          <Pressable style={styles.userMenuSheet} onPress={() => {}}>
            <TouchableOpacity
              style={[styles.backButton, styles.userMenuBackButton]}
              onPress={closeUserMenu}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.avatarContainerLarge}>
              <TouchableOpacity
                style={styles.avatarCircleLarge}
                activeOpacity={0.8}
                onPress={handleAvatarPress}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImageLarge} />
                ) : (
                  <Ionicons name="person" size={42} color="#E8EEF5" />
                )}
              </TouchableOpacity>

              <Text style={styles.profileNameText}>{profileName || 'ngolevinh233'}</Text>
            </View>

            <View style={styles.profileInfoListCard}>
              <TouchableOpacity style={styles.infoRow} activeOpacity={0.8} onPress={() => openFieldEditor('name')}>
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="person-outline" size={22} color="#1F2937" />
                  <Text style={styles.infoLabel}>Tên</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={styles.infoValue}>{profileName || 'ngolevinh233'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoRow} activeOpacity={0.8}>
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="call-outline" size={22} color="#1F2937" />
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={styles.infoValue}>{profilePhone}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.8}
                onPress={() => setChangePasswordVisible(true)}
              >
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="lock-closed-outline" size={22} color="#1F2937" />
                  <Text style={styles.infoLabel}>Thay đổi mật mã</Text>
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
                <Pressable style={styles.editorSheet} onPress={() => {}}>
                  <View style={styles.editorHeader}>
                    <TouchableOpacity
                      style={styles.editorBackButton}
                      onPress={closeFieldEditor}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chevron-back" size={26} color="#111827" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.editorTitle}>{editingField === 'name' ? 'Chỉnh sửa tên' : 'Chỉnh sửa Gmail'}</Text>

                  {editingField === 'email' ? (
                    <>
                      <View style={styles.editorEmailRow}>
                        <TextInput
                          value={draftValue}
                          onChangeText={setDraftValue}
                          style={[styles.editorInput, styles.editorEmailInput]}
                          placeholder="name@gmail.com"
                          placeholderTextColor="#94A3B8"
                          autoFocus
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                        <TouchableOpacity style={styles.sendOtpButton} onPress={handleSendOtp}>
                          <Text style={styles.sendOtpText}>Gửi OTP</Text>
                        </TouchableOpacity>
                      </View>

                      {otpSentForEmail && (
                        <TextInput
                          value={otpCode}
                          onChangeText={setOtpCode}
                          style={[styles.editorInput, styles.otpInput]}
                          placeholder="Nhập mã OTP"
                          placeholderTextColor="#94A3B8"
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                      )}
                    </>
                  ) : (
                    <TextInput
                      value={draftValue}
                      onChangeText={setDraftValue}
                      style={styles.editorInput}
                      placeholder="Nhập tên mới"
                      placeholderTextColor="#94A3B8"
                      autoFocus
                      autoCapitalize="words"
                      keyboardType="default"
                    />
                  )}

                  <View style={styles.editorActions}>
                    <TouchableOpacity style={styles.editorCancel} onPress={closeFieldEditor}>
                      <Text style={styles.editorCancelText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editorSave} onPress={saveEditedField}>
                      <Text style={styles.editorSaveText}>{editingField === 'email' ? 'Xác nhận' : 'Lưu'}</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>

            {isLogoutConfirmVisible && (
              <View style={styles.logoutInlineOverlay}>
                <View style={styles.logoutDialog}>
                  <Text style={styles.logoutTitle}>Đăng xuất</Text>
                  <Text style={styles.logoutMessage}>
                    Bạn có chắc chắn muốn đăng xuất khỏi hệ thống giám sát?
                  </Text>
                  <View style={styles.logoutActions}>
                    <TouchableOpacity
                      style={styles.logoutCancelButton}
                      onPress={() => setLogoutConfirmVisible(false)}
                    >
                      <Text style={styles.logoutCancelText}>Hủy</Text>
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
        transparent
        visible={isLocationVisible}
        animationType="slide"
        onRequestClose={() => setLocationVisible(false)}
      >
        <Pressable style={styles.locationOverlay} onPress={() => setLocationVisible(false)}>
          <Pressable style={styles.locationSheet} onPress={() => {}}>
            <Text style={styles.locationTitle}>Định vị địa lý</Text>
            <Text style={styles.locationDescription}>Lấy vị trí hiện tại của thiết bị để xác định địa chỉ.</Text>

            <View style={styles.locationResultBox}>
              <Ionicons name="location" size={20} color="#2563EB" />
              <Text style={styles.locationResultText}>
                {locationAddress || 'Chưa lấy vị trí hiện tại'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleGetCurrentLocation}
              activeOpacity={0.85}
            >
              <Ionicons name="locate-outline" size={20} color="#FFFFFF" />
              <Text style={styles.locationButtonText}>Lấy vị trí hiện tại</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locationCloseButton}
              onPress={() => setLocationVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.locationCloseText}>Đóng</Text>
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
          <Pressable style={styles.avatarPickerSheet} onPress={() => {}}>
            <View style={styles.avatarPickerOptions}>
              <TouchableOpacity style={styles.avatarPickerRow} activeOpacity={0.8} onPress={pickAvatarFromCamera}>
                <Ionicons name="camera-outline" size={24} color="#111827" />
                <Text style={styles.avatarPickerText}>Chụp ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.avatarPickerRow, styles.avatarPickerLastRow]} activeOpacity={0.8} onPress={pickAvatarFromLibrary}>
                <Ionicons name="images-outline" size={24} color="#111827" />
                <Text style={styles.avatarPickerText}>Chọn từ Hình ảnh</Text>
              </TouchableOpacity>
            </View>
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
              style={styles.changePasswordBackButton}
              onPress={() => setChangePasswordVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.changePasswordTitle}>Đổi mật khẩu</Text>

            <View style={styles.changePasswordHeaderRight} />
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
                style={[styles.backButton, styles.settingsBackButton]}
                onPress={() => setSettingsVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Cài đặt</Text>
            </View>

  

            <View style={styles.settingsCard}>
              <View style={styles.settingsList}>
                <TouchableOpacity
                  style={styles.settingsItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setAccountEntrySource('settings');
                    setSettingsVisible(false);
                    setUserMenuVisible(true);
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="person-circle-outline" size={20} color="#475569" />
                    </View>
                    <Text style={styles.settingsLabel}>Hồ sơ của tôi</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSettingsVisible(false);
                    setGeneralSettingsVisible(true);
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="settings-outline" size={20} color="#475569" />
                    </View>
                    <Text style={styles.settingsLabel}>Cài đặt chung</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSettingsVisible(false);
                    setNotificationSettingsVisible(true);
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="notifications-outline" size={20} color="#475569" />
                    </View>
                    <Text style={styles.settingsLabel}>Thiết lập thông báo</Text>
                  </View>
                  <View style={styles.settingsRightStatus}>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSettingsVisible(false);
                    setVibrationDetailVisible(true);
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="phone-portrait-outline" size={20} color="#475569" />
                    </View>
                    <Text style={styles.settingsLabel}>Rung</Text>
                  </View>
                  <View style={styles.settingsRightStatus}>
                    <Text style={styles.settingsValueText}>{vibrationEnabled ? 'Mở' : 'Tắt'}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSettingsVisible(false);
                    setAccessibilityVisible(true);
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="accessibility-outline" size={20} color="#475569" />
                    </View>
                    <Text style={styles.settingsLabel}>Khả năng tiếp cận</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSettingsVisible(false);
                    setAboutInfoVisible(true);
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View style={styles.settingsIconWrap}>
                      <Ionicons name="information-circle-outline" size={20} color="#475569" />
                    </View>
                    <Text style={styles.settingsLabel}>Thông tin</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

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
          style={styles.settingsOverlay}
          onPress={() => {
            setAccessibilityVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={styles.settingsSheet} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton]}
                onPress={() => {
                  setAccessibilityVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Khả năng tiếp cận</Text>
            </View>

            <View style={styles.accessibilityList}>
              <TouchableOpacity
                style={styles.accessibilityRow}
                activeOpacity={0.8}
                onPress={() => {
                  setAccessibilityVisible(false);
                  setFontSizeVisible(true);
                }}
              >
                <Text style={styles.accessibilityLabel}>Kích thước phông chữ</Text>
                <View style={styles.accessibilityValueWrap}>
                  <Text style={styles.accessibilityValue}>{fontSizeMode === 'system' ? 'Theo hệ thống' : 'Tùy chỉnh'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <View style={[styles.accessibilityRow, styles.accessibilityRowLast]}>
                <Text style={styles.accessibilityLabel}>Tăng độ tương phản</Text>
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
          style={styles.settingsOverlay}
          onPress={() => {
            setFontSizeVisible(false);
            setAccessibilityVisible(true);
          }}
        >
          <Pressable style={styles.settingsSheet} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton]}
                onPress={() => {
                  setFontSizeVisible(false);
                  setAccessibilityVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Kích thước phông chữ</Text>
            </View>

            <View style={styles.fontSizeList}>
              <TouchableOpacity
                style={styles.fontSizeOption}
                activeOpacity={0.8}
                onPress={() => {
                  setFontSizeMode('system');
                }}
              >
                <Text style={styles.fontSizeOptionText}>Theo hệ thống</Text>
                {fontSizeMode === 'system' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fontSizeOption}
                activeOpacity={0.8}
                onPress={() => setFontSizeMode('custom')}
              >
                <Text style={styles.fontSizeOptionText}>Tùy chỉnh</Text>
                {fontSizeMode === 'custom' && (
                  <Ionicons name="checkmark" size={22} color="#1D9BF0" />
                )}
              </TouchableOpacity>

              {fontSizeMode === 'custom' && (
                <View style={styles.customFontSliderPanel}>
                  <Text style={styles.customFontSliderTitle}>Mặc định</Text>

                  <View style={styles.customFontSliderRow}>
                    <Text style={styles.customFontSmall}>Aa</Text>

                    <View
                      style={styles.customFontTrackWrap}
                      onLayout={(event) => {
                        const { width, x } = event.nativeEvent.layout;
                        setSliderWidth(width);
                        sliderTrackPosition.current = x;
                      }}
                      {...fontSliderResponder.panHandlers}
                    >
                      <View style={styles.customFontTrack}>
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

                    <Text style={styles.customFontLarge}>Aa</Text>
                  </View>
                </View>
              )}

              <Text style={styles.fontSizeNote}>
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
          style={styles.infoOverlay}
          onPress={() => {
            setAboutInfoVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={styles.infoScreen} onPress={() => {}}>
            <View style={styles.infoHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.infoBackButton]}
                onPress={() => {
                  setAboutInfoVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.infoTitle}>Thông tin</Text>
            </View>

   
            <View style={styles.infoListCard}>
              <TouchableOpacity style={styles.infoListRow} activeOpacity={0.8}>
                <Text style={styles.infoRowText}>Điều khoản sử dụng</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoListRow} activeOpacity={0.8}>
                <Text style={styles.infoRowText}>Chính sách bảo mật</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.infoListRow} activeOpacity={0.8}>
                <Text style={styles.infoRowText}>Cài đặt bảo mật</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
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
          style={styles.settingsOverlay}
          onPress={() => {
            setVibrationDetailVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={styles.vibrationDetailSheet} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton]}
                onPress={() => {
                  setVibrationDetailVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Rung</Text>
            </View>

            <View style={styles.vibrationDetailRow}>
              <Text style={styles.vibrationDetailLabel}>Rung</Text>
              <Switch value={vibrationEnabled} onValueChange={handleVibrationToggle} />
            </View>

            <Text style={styles.vibrationDetailDescription}>
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
          style={styles.settingsOverlay}
          onPress={() => {
            setNotificationSettingsVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={styles.settingsSheet} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton]}
                onPress={() => {
                  setNotificationSettingsVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Thiết lập thông báo</Text>
            </View>

            <View style={styles.notificationSettingsContent}>
              <Text style={styles.notificationSettingsIntro}>
                Chọn cách bạn muốn nhận cảnh báo từ hệ thống.
              </Text>

              <View style={styles.notificationSettingsCard}>
                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={styles.notificationSettingTitle}>Thông báo cảnh báo</Text>
                    <Text style={styles.notificationSettingDescription}>Nhận cảnh báo sức khỏe mới</Text>
                  </View>
                  <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
                </View>
                <View style={styles.notificationSettingDivider} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={styles.notificationSettingTitle}>Âm thanh cảnh báo</Text>
                    <Text style={styles.notificationSettingDescription}>Phát âm thanh khi có cảnh báo</Text>
                  </View>
                  <Switch value={alertSoundEnabled} onValueChange={setAlertSoundEnabled} />
                </View>
                <View style={styles.notificationSettingDivider} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={styles.notificationSettingTitle}>Rung</Text>
                    <Text style={styles.notificationSettingDescription}>Rung thiết bị khi có cảnh báo</Text>
                  </View>
                  <Switch value={vibrationEnabled} onValueChange={handleVibrationToggle} />
                </View>
                <View style={styles.notificationSettingDivider} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={styles.notificationSettingTitle}>Cảnh báo khẩn cấp</Text>
                    <Text style={styles.notificationSettingDescription}>Luôn ưu tiên cảnh báo nguy hiểm</Text>
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
        <Pressable style={styles.settingsOverlay} onPress={() => setGeneralSettingsVisible(false)}>
          <Pressable style={styles.settingsSheet} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[styles.backButton, styles.settingsBackButton]}
                onPress={() => {
                  setGeneralSettingsVisible(false);
                  setSettingsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.settingsTitle}>Cài đặt chung</Text>
            </View>

            <View style={styles.generalSettingsList}>
              <View style={styles.generalRow}>
                <Text style={styles.generalRowLabel}>Vùng</Text>
                <Text style={styles.generalRowValue}>Vietnam</Text>
              </View>

              <TouchableOpacity style={styles.generalRow} activeOpacity={0.8}>
                <Text style={styles.generalRowLabel}>Ngôn ngữ</Text>
                <View style={styles.generalValueWrap}>
                  <Text style={styles.generalRowValue}>Tự động</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.generalRow}
                activeOpacity={0.8}
                onPress={() => setAppearanceVisible(true)}
              >
                <Text style={styles.generalRowLabel}>Chế độ tối</Text>
                <View style={styles.generalValueWrap}>
                  <Text style={styles.generalRowValue}>{appearanceMode === 'light' ? 'Màu sáng' : 'Tối'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
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
          <Pressable style={styles.appearanceSheet} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={styles.appearanceCloseButton}
                onPress={() => setAppearanceVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={28} color="#111827" />
              </TouchableOpacity>

              <Text style={styles.appearanceTitle}>Về bề ngoài</Text>
              <View style={styles.appearanceHeaderSpacer} />
            </View>

            <View style={styles.appearanceCard}>
              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  appearanceMode === 'light' && styles.appearanceOptionRowSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setAppearanceMode('light');
                  setAppearanceVisible(false);
                }}
              >
                <Text style={styles.appearanceOptionLabel}>Màu sáng</Text>
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
                  setAppearanceVisible(false);
                }}
              >
                <Text style={styles.appearanceOptionLabel}>Tối</Text>
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
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={38} color="#CBD5E1" />
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.userIdText}>1057</Text>
              <Text style={styles.userRoleText}>{userName || 'Người chăm sóc chính'}</Text>
              <View style={styles.accountBadgeWrap}>
                <View style={styles.accountBadgeDot} />
                <Text style={styles.accountBadgeText}>Xem tài khoản</Text>
              </View>
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

        {/* 4. Menu Card 1: Thuật toán cảnh báo và thiết bị IoT */}
        <View style={styles.menuGroupCard}>
          {/* Row 1: Chơi Algo (Thuật toán cảnh báo) */}
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

          {/* Row 2: Hoạt động với (Thiết bị IoT) */}
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
              <Text style={styles.menuTitleText}>Báo cáo</Text>
              <Text style={styles.menuSubText}>Báo cáo y tế &amp; Xuất file (FR13)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          {/* Row 2: Cài Đặt (Có chấm đỏ thông báo cập nhật) */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert(
              'Dịch vụ CSKH',
              'Vui lòng liên hệ bộ phận chăm sóc khách hàng để được hỗ trợ khẩn cấp.'
            )}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="call-outline" size={20} color="#EF4444" />
            </View>
            <Text style={styles.menuTitleText}>Liên hệ khẩn cấp tới dịch vụ CSKH</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => setLocationVisible(true)}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="location-outline" size={20} color="#2563EB" />
            </View>
            <Text style={styles.menuTitleText}>Định vị địa lý</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="settings" size={20} color="#D97706" />
            </View>
            <Text style={styles.menuTitleText}>Cài Đặt</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
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
  avatarPickerEmail: {
    fontSize: 18,
    color: '#111827',
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
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
  },
  locationTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  locationDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 16,
  },
  locationResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 62,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    marginBottom: 14,
  },
  locationResultText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#1E3A8A',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  locationButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  locationCloseButton: {
    alignItems: 'center',
    paddingVertical: 12,
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
    marginTop: 4,
    marginBottom: 16,
    paddingTop: 2,
    paddingBottom: 2,
    minHeight: 40,
  },
  settingsTitle: {
    fontSize: 22,
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
    marginBottom: 18,
    minHeight: 40,
  },
  infoTitle: {
    fontSize: 22,
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
    fontSize: 17,
    fontWeight: '500',
    color: '#111827',
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
    fontSize: 18,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '500',
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
    fontSize: 17,
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
    marginBottom: 8,
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
    fontSize: 22,
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
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
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
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  changePasswordBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePasswordHeaderRight: {
    width: 36,
    height: 36,
  },
  changePasswordTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  changePasswordContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
  },
  changePasswordIntro: {
    marginBottom: 22,
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  passwordLabel: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    marginBottom: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D7DEE8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  changePasswordButton: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    width: '100%',
  },
  changePasswordButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  notificationSettingsContent: {
    flex: 1,
    paddingHorizontal: 18,
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
    paddingHorizontal: 16,
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
    fontWeight: '600',
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
    height: 36,
    justifyContent: 'center',
    marginBottom: 10,
  },
  editorBackButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  editorInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 14,
  },
  editorEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  editorEmailInput: {
    flex: 1,
    marginBottom: 0,
  },
  sendOtpButton: {
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  sendOtpText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  otpInput: {
    marginBottom: 14,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editorCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  editorCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  editorSave: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#2563EB',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 0,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  settingsList: {
    paddingBottom: 0,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    backgroundColor: '#FFFFFF',
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
    fontSize: 16,
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
});

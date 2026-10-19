// ProfileScreen.tsx
// Màn hình Cá nhân / xtrị hệ thống khớp chính xác Hình 2 (Phong cách Imou Protect & Elderly Care AI)

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  Switch,
  Image,
  Vibration,
  PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAuthStore } from '../../../store/useAuthStore';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../../i18n/config';
import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedText,
  LocalizedTextInput as TextInput,
} from '../../../i18n/LocalizedComponents';
import api, { usersApi } from '../../../services/api';
import { launchEmergencyCall } from '../../../services/emergency';

const FONT_SCALE_LEVELS = [0.8, 1, 1.2, 1.5, 1.8] as const;

export default function ProfileScreen({ navigation }: any) {
  const {
    userId,
    userName,
    full_name,
    userPhone,
    phone_number,
    logout,
    updateUserName,
    toggleViewRole,
    setProfile,
  } = useAuthStore();
  const { house } = useVitalStore();
  const { isDarkMode, colors, setDarkMode, setFontScale } = useTheme();
  const [profileName, setProfileName] = React.useState(full_name || userName || '');
  const [profilePhone, setProfilePhone] = React.useState(phone_number || userPhone || '');
  const [showMoreGrid, setShowMoreGrid] = React.useState(false);
  const [isHelpExpanded, setIsHelpExpanded] = React.useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = React.useState(false);
  const [editingField, setEditingField] = React.useState<'name' | null>(null);
  const [draftValue, setDraftValue] = React.useState('');
  const [isSavingName, setIsSavingName] = React.useState(false);
  const [nameEditorError, setNameEditorError] = React.useState<string | null>(null);
  const [isUserMenuVisible, setUserMenuVisible] = React.useState(false);
  const [isAvatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [isSettingsVisible, setSettingsVisible] = React.useState(false);
  const [accountEntrySource, setAccountEntrySource] = React.useState<'main' | 'settings'>('main');
  const [isNotificationSettingsVisible, setNotificationSettingsVisible] = React.useState(false);
  const [isVibrationDetailVisible, setVibrationDetailVisible] = React.useState(false);
  const [isAboutInfoVisible, setAboutInfoVisible] = React.useState(false);
  const [infoDetail, setInfoDetail] = React.useState<'terms' | 'app' | null>(null);
  const [isGeneralSettingsVisible, setGeneralSettingsVisible] = React.useState(false);
  const [isLanguageVisible, setLanguageVisible] = React.useState(false);
  const [languageMode, setLanguageMode] = React.useState<'vi' | 'en'>(
    (i18n.language === 'en' ? 'en' : 'vi') as 'vi' | 'en'
  );
  const [fontSizeMode, setFontSizeMode] = React.useState<'system' | 'custom'>('system');
  const [customFontScale, setCustomFontScale] = React.useState(2);

  React.useEffect(() => {
    if (i18n.language === 'en' || i18n.language === 'vi') {
      setLanguageMode(i18n.language as 'vi' | 'en');
    }
    usersApi
      .getMe()
      .then((res: any) => {
        const backendLang = res?.data?.preferred_language || res?.data?.language;
        if (backendLang && (backendLang === 'vi' || backendLang === 'en')) {
          setLanguageMode(backendLang);
          if (i18n.language !== backendLang) {
            void i18n.changeLanguage(backendLang);
            void AsyncStorage.setItem('smartcare-user-language', backendLang);
          }
        }
        // Giữ mức tùy chỉnh đã chọn để dùng khi người dùng bật lại chế độ tùy chỉnh.
        const backendFontScale = res?.data?.custom_font_scale;
        if (Number.isInteger(backendFontScale) && backendFontScale >= 0 && backendFontScale <= 4) {
          setCustomFontScale(backendFontScale);
        }
      })
      .catch(() => {});
  }, []);

  const handleLanguageChange = async (lang: 'vi' | 'en') => {
    try {
      setLanguageMode(lang);
      await i18n.changeLanguage(lang);
      await AsyncStorage.setItem('smartcare-user-language', lang);
      setLanguageVisible(false);

      try {
        await usersApi.updateLanguage(lang);
      } catch (apiErr) {
        await usersApi.updateMe({ preferred_language: lang, language: lang });
      }
    } catch (err) {
      console.warn('[ProfileScreen] Error changing language:', err);
      setLanguageVisible(false);
    }
  };
  const [isAccessibilityVisible, setAccessibilityVisible] = React.useState(false);
  const [isFontSizeVisible, setFontSizeVisible] = React.useState(false);
  const [isAppearanceVisible, setAppearanceVisible] = React.useState(false);
  const [appearanceMode, setAppearanceMode] = React.useState<'light' | 'dark'>(isDarkMode ? 'dark' : 'light');

  React.useEffect(() => {
    setAppearanceMode(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const [highContrastEnabled, setHighContrastEnabled] = React.useState(false);
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const sliderTrackPosition = React.useRef(0);
  const saveFontPreferences = React.useCallback(async (
    mode: 'system' | 'custom',
    scale: number,
  ) => {
    try {
      await usersApi.updateFontPreferences(mode, scale);
    } catch (err) {
      console.warn('[ProfileScreen] Could not save font-size preferences:', err);
    }
  }, []);
  const applyFontScaleMode = (mode: 'system' | 'custom') => {
    setFontSizeMode(mode);
    setFontScale(mode === 'custom' ? FONT_SCALE_LEVELS[customFontScale] : 1);
    void saveFontPreferences(mode, customFontScale);
  };
  const [isChangePasswordVisible, setChangePasswordVisible] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordChangeFeedback, setPasswordChangeFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  React.useEffect(() => {
    if (isChangePasswordVisible) setPasswordChangeFeedback(null);
  }, [isChangePasswordVisible]);
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
      await launchEmergencyCall();
    } catch (error) {
      console.warn('[ProfileScreen] Could not open emergency dialer:', error);
      Alert.alert('Không thể mở cuộc gọi', 'Vui lòng gọi cấp cứu 115 trực tiếp.');
    }
  };

  const updateFontScaleFromPosition = React.useCallback((positionX: number) => {
    if (!sliderWidth) return;

    const rawRatio = Math.min(Math.max(positionX / sliderWidth, 0), 1);
    const nextScale = Math.round(rawRatio * 4);
    setCustomFontScale(nextScale);
    setFontScale(FONT_SCALE_LEVELS[nextScale]);
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
        onPanResponderRelease: (_, gestureState) => {
          if (sliderWidth <= 0) return;
          const rawRatio = Math.min(
            Math.max((gestureState.moveX - sliderTrackPosition.current) / sliderWidth, 0),
            1,
          );
          const nextScale = Math.round(rawRatio * 4);
          setCustomFontScale(nextScale);
          setFontScale(FONT_SCALE_LEVELS[nextScale]);
          void saveFontPreferences('custom', nextScale);
        },
      }),
    [saveFontPreferences, setFontScale, sliderWidth, updateFontScaleFromPosition]
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
    if (full_name || userName) {
      setProfileName(full_name || userName || '');
    }
    if (phone_number || userPhone) {
      setProfilePhone(phone_number || userPhone || '');
    }
  }, [userName, full_name, userPhone, phone_number]);

  React.useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await api.get('/users/me');
        if (res.data) {
          if (typeof res.data.full_name === 'string' && res.data.full_name.trim()) {
            setProfileName(res.data.full_name);
          }
          const phone = res.data.phone_number || res.data.phone;
          if (typeof phone === 'string') {
            setProfilePhone(phone);
          }
          setProfile({
            user_id: res.data.user_id || res.data.id,
            full_name: res.data.full_name,
            phone_number: phone,
            role: res.data.role,
            household_id: res.data.household_id,
          });
        }
      } catch (error) {
        console.warn('[Profile] Không thể tải hồ sơ từ database:', error);
      }
    };
    void fetchUserProfile();
  }, [setProfile]);

  const handleLogout = () => {
    setLogoutConfirmVisible(true);
  };

  const openFieldEditor = (field: 'name') => {
    if (field !== 'name') return;
    setDraftValue(profileName);
    setNameEditorError(null);
    setEditingField(field);
  };

  const closeFieldEditor = () => {
    if (isSavingName) return;
    setEditingField(null);
    setDraftValue('');
    setNameEditorError(null);
  };

  const saveEditedField = async () => {
    if (!editingField || isSavingName) return;

    const trimmed = draftValue.trim();
    if (!trimmed) {
      setNameEditorError('Tên không được để trống.');
      return;
    }

    setIsSavingName(true);
    setNameEditorError(null);

    try {
      const res = await usersApi.updateMe({ full_name: trimmed });
      const savedName =
        typeof res?.data?.full_name === 'string' && res.data.full_name.trim()
          ? res.data.full_name.trim()
          : trimmed;
      const resolvedId = String(res?.data?.id || res?.data?.user_id || userId || 'demo-user-001');

      setProfileName(savedName);
      updateUserName(resolvedId, savedName);
      setProfile({
        user_id: res?.data?.id || res?.data?.user_id || userId || undefined,
        full_name: savedName,
      });

      setEditingField(null);
      setDraftValue('');
      setNameEditorError(null);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Không thể lưu tên vào cơ sở dữ liệu. Vui lòng thử lại.';
      const msg = typeof detail === 'string' ? detail : 'Không thể lưu tên vào cơ sở dữ liệu.';
      setNameEditorError(msg);
      Alert.alert('Lỗi', msg);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordChangeFeedback({ type: 'error', message: 'Vui lòng nhập đầy đủ thông tin mật khẩu.' });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 16) {
      setPasswordChangeFeedback({ type: 'error', message: 'Mật khẩu mới phải dài từ 8 đến 16 ký tự.' });
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/.test(newPassword)) {
      setPasswordChangeFeedback({
        type: 'error',
        message: 'Mật khẩu cần có chữ hoa, chữ thường, số và ký tự đặc biệt.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeFeedback({ type: 'error', message: 'Vui lòng kiểm tra lại mật khẩu mới; hai mật khẩu chưa khớp.' });
      return;
    }

    setPasswordChangeFeedback(null);
    setIsChangingPassword(true);
    try {
      await usersApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChangeFeedback({
        type: 'success',
        message: 'Đổi mật khẩu thành công. Mật khẩu mới đã được lưu vào tài khoản.',
      });
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join('\n')
        : detail;
      setPasswordChangeFeedback({
        type: 'error',
        message: message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại và thử lại.',
      });
    } finally {
      setIsChangingPassword(false);
    }
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
              <Pressable
                style={[styles.editorOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
                onPress={closeFieldEditor}
              >
                <Pressable
                  style={[styles.editorSheet, isDarkMode && { backgroundColor: '#0B0F19' }]}
                  onPress={() => {}}
                >
                  <View style={styles.editorHeader}>
                    <TouchableOpacity
                      style={[
                        styles.editorBackButton,
                        isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                      ]}
                      onPress={closeFieldEditor}
                      activeOpacity={0.7}
                      disabled={isSavingName}
                    >
                      <Ionicons
                        name="chevron-back-outline"
                        size={24}
                        color={isDarkMode ? '#F8FAFC' : Colors.textPrimary}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.editorTitle, isDarkMode && { color: '#F8FAFC' }]}>
                      Chỉnh sửa tên
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.editorCard,
                      isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                    ]}
                  >
                    <View style={styles.editorFieldHeader}>
                      <View
                        style={[
                          styles.editorFieldIconBadge,
                          isDarkMode && { backgroundColor: 'rgba(255, 122, 0, 0.16)' },
                        ]}
                      >
                        <Ionicons name="person-outline" size={20} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.editorFieldLabel, isDarkMode && { color: '#F8FAFC' }]}>
                          Họ và tên
                        </Text>
                      
                      </View>
                    </View>

                    <View
                      style={[
                        styles.editorInputWrap,
                        isDarkMode && { backgroundColor: '#0F172A', borderColor: Colors.primary },
                        nameEditorError ? { borderColor: Colors.danger } : null,
                      ]}
                    >
                      <TextInput
                        value={draftValue}
                        onChangeText={(text) => {
                          setDraftValue(text);
                          if (nameEditorError) setNameEditorError(null);
                        }}
                        style={[styles.editorInput, isDarkMode && { color: '#F8FAFC' }]}
                        placeholder="Nhập tên mới"
                        placeholderTextColor="#94A3B8"
                        autoFocus
                        autoCapitalize="words"
                        keyboardType="default"
                        returnKeyType="done"
                        editable={!isSavingName}
                        onSubmitEditing={() => {
                          void saveEditedField();
                        }}
                      />
                      {draftValue.length > 0 && !isSavingName && (
                        <TouchableOpacity
                          onPress={() => setDraftValue('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={isDarkMode ? '#64748B' : '#94A3B8'}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {nameEditorError && (
                      <View
                        style={[
                          styles.editorErrorBox,
                          isDarkMode && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#7F1D1D' },
                        ]}
                      >
                        <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                        <Text style={[styles.editorErrorText, isDarkMode && { color: '#FCA5A5' }]}>
                          {nameEditorError}
                        </Text>
                      </View>
                    )}

                    <View style={styles.editorActions}>
                      <TouchableOpacity
                        style={[
                          styles.editorCancel,
                          isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                        ]}
                        onPress={closeFieldEditor}
                        activeOpacity={0.8}
                        disabled={isSavingName}
                      >
                        <Text style={[styles.editorCancelText, isDarkMode && { color: '#CBD5E1' }]}>
                          Hủy
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editorSave, isSavingName && { opacity: 0.75 }]}
                        onPress={() => {
                          void saveEditedField();
                        }}
                        activeOpacity={0.85}
                        disabled={isSavingName}
                      >
                        {isSavingName ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.editorSaveText}>Lưu</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
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
          <View style={[styles.changePasswordHeader, isDarkMode && { borderBottomColor: '#1E293B' }]}>
            <TouchableOpacity
              style={[
                styles.changePasswordBackButton,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
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
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.changePasswordCard,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
              ]}
            >
              <View style={styles.changePasswordHeroRow}>
                <View
                  style={[
                    styles.changePasswordIconBadge,
                    isDarkMode && { backgroundColor: 'rgba(255, 122, 0, 0.16)' },
                  ]}
                >
                  <Ionicons name="key-outline" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.changePasswordCardHeading, isDarkMode && { color: '#F8FAFC' }]}>
                    Bảo mật tài khoản
                  </Text>
                  <Text style={[styles.changePasswordIntro, isDarkMode && { color: '#94A3B8' }]}>
                    Tạo mật khẩu mới để bảo vệ tài khoản của bạn.
                  </Text>
                </View>
              </View>

              {passwordChangeFeedback && (
                <View
                  accessibilityRole="alert"
                  style={[
                    styles.passwordFeedbackBanner,
                    passwordChangeFeedback.type === 'success'
                      ? isDarkMode
                        ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#065F46' }
                        : { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                      : isDarkMode
                        ? { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#7F1D1D' }
                        : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                  ]}
                >
                  <Ionicons
                    name={passwordChangeFeedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={passwordChangeFeedback.type === 'success' ? '#10B981' : '#EF4444'}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      fontWeight: '600',
                      lineHeight: 19,
                      color:
                        passwordChangeFeedback.type === 'success'
                          ? isDarkMode
                            ? '#A7F3D0'
                            : '#065F46'
                          : isDarkMode
                            ? '#FCA5A5'
                            : '#991B1B',
                    }}
                  >
                    {passwordChangeFeedback.message}
                  </Text>
                </View>
              )}

              <Text style={[styles.passwordLabel, isDarkMode && { color: '#F8FAFC' }]}>Mật khẩu hiện tại</Text>
              <View
                style={[
                  styles.passwordInputWrap,
                  isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                  currentPassword.length > 0 && { borderColor: Colors.primary },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={currentPassword.length > 0 ? Colors.primary : '#94A3B8'}
                  style={styles.passwordLeadingIcon}
                />
                <TextInput
                  style={[styles.passwordInput, isDarkMode && { color: '#F8FAFC' }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Nhập mật khẩu hiện tại"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showCurrentPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={isDarkMode ? '#94A3B8' : '#64748B'}
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.passwordLabel, isDarkMode && { color: '#F8FAFC' }]}>Mật khẩu mới</Text>
              <View
                style={[
                  styles.passwordInputWrap,
                  isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                  newPassword.length > 0 && { borderColor: Colors.primary },
                ]}
              >
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={newPassword.length > 0 ? Colors.primary : '#94A3B8'}
                  style={styles.passwordLeadingIcon}
                />
                <TextInput
                  style={[styles.passwordInput, isDarkMode && { color: '#F8FAFC' }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Nhập mật khẩu mới"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={isDarkMode ? '#94A3B8' : '#64748B'}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.passwordRequirements,
                  isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                ]}
              >
                <Text style={[styles.passwordRequirementsTitle, isDarkMode && { color: '#E2E8F0' }]}>
                  Các yêu cầu về mật khẩu:
                </Text>
                <View style={styles.passwordRequirementRow}>
                  <Ionicons
                    name={
                      newPassword.length >= 8 && newPassword.length <= 16
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={16}
                    color={
                      newPassword.length >= 8 && newPassword.length <= 16
                        ? '#10B981'
                        : Colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.passwordRequirement,
                      isDarkMode && { color: '#94A3B8' },
                      newPassword.length >= 8 &&
                        newPassword.length <= 16 && { color: '#10B981', fontWeight: '600' },
                    ]}
                  >
                    Dài 8-16 ký tự
                  </Text>
                </View>
                <View style={styles.passwordRequirementRow}>
                  <Ionicons
                    name={
                      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(newPassword)
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={16}
                    color={
                      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(newPassword)
                        ? '#10B981'
                        : Colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.passwordRequirement,
                      isDarkMode && { color: '#94A3B8' },
                      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(newPassword) && {
                        color: '#10B981',
                        fontWeight: '600',
                      },
                    ]}
                  >
                    Bao gồm chữ hoa, chữ thường, số và ký hiệu đặc biệt.
                  </Text>
                </View>
              </View>

              <Text style={[styles.passwordLabel, isDarkMode && { color: '#F8FAFC' }]}>Nhập lại mật khẩu mới</Text>
              <View
                style={[
                  styles.passwordInputWrap,
                  isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                  confirmPassword.length > 0 && { borderColor: Colors.primary },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={confirmPassword.length > 0 ? Colors.primary : '#94A3B8'}
                  style={styles.passwordLeadingIcon}
                />
                <TextInput
                  style={[styles.passwordInput, isDarkMode && { color: '#F8FAFC' }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={isDarkMode ? '#94A3B8' : '#64748B'}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.changePasswordButton, isChangingPassword && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                activeOpacity={0.85}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.changePasswordButtonText}>Cập nhật mật khẩu</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => setSettingsVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài đặt</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.settingsCard}>
                <View style={styles.settingsList}>
                  {/* Khối 1: Hồ sơ người giám sát & Hồ sơ bệnh án người cao tuổi */}
                  <View style={[styles.settingsGroupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                    {/* Mục 1: Hồ sơ người giám sát */}
                    <TouchableOpacity
                      style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setAccountEntrySource('settings');
                        setSettingsVisible(false);
                        setUserMenuVisible(true);
                      }}
                    >
                      <View style={styles.settingsLeft}>
                        <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.16)' : Colors.primaryLight }]}>
                          <Ionicons name="person-circle-outline" size={22} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Hồ sơ người giám sát</Text>
                          <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Tài khoản người thân theo dõi, SĐT liên hệ khẩn cấp</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                    </TouchableOpacity>

                    {/* Mục 2: Hồ sơ bệnh án người cao tuổi */}
                    <TouchableOpacity
                      style={[styles.settingsItem, styles.settingsItemLast, isDarkMode && { borderBottomColor: '#334155' }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSettingsVisible(false);
                        navigation.navigate('PatientMedicalRecord');
                      }}
                    >
                      <View style={styles.settingsLeft}>
                        <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' }]}>
                          <Ionicons name="medkit-outline" size={21} color="#0284C7" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Hồ sơ bệnh án người cao tuổi</Text>
                            <View style={[styles.profileAesBadge, isDarkMode && { backgroundColor: 'rgba(255, 122, 0, 0.16)' }]}>
                              <Text style={[styles.profileAesBadgeText, isDarkMode && { color: Colors.primary }]}>Bảo mật AES-256</Text>
                            </View>
                          </View>
                          <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Thông tin cụ, bệnh nền, nhóm máu &amp; đơn thuốc</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Khối 2: Nhóm 3 mục */}
                  <View style={[styles.settingsGroupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                    <TouchableOpacity
                      style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSettingsVisible(false);
                        setGeneralSettingsVisible(true);
                      }}
                    >
                      <View style={styles.settingsLeft}>
                        <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.16)' : Colors.primaryLight }]}>
                          <Ionicons name="settings-outline" size={21} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Cài đặt chung</Text>
                          <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Vùng, ngôn ngữ giao diện &amp; chế độ Sáng / Tối</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
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
                        <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' }]}>
                          <Ionicons name="accessibility-outline" size={21} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Khả năng tiếp cận</Text>
                          <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Kích thước phông chữ &amp; độ tương phản hiển thị</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
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
                        <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' }]}>
                          <Ionicons name="information-circle-outline" size={21} color="#6366F1" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Thông tin</Text>
                          <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Điều khoản sử dụng &amp; phiên bản ứng dụng</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Khối 3: Nhóm 2 mục */}
                  <View style={[styles.settingsGroupCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                    <TouchableOpacity
                      style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSettingsVisible(false);
                        setNotificationSettingsVisible(true);
                      }}
                    >
                      <View style={styles.settingsLeft}>
                        <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7' }]}>
                          <Ionicons name="notifications-outline" size={21} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Thiết lập thông báo</Text>
                          <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Cảnh báo sức khỏe, âm thanh &amp; trường hợp khẩn cấp</Text>
                        </View>
                      </View>
                      <View style={styles.settingsRightStatus}>
                        <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
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
                        <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.16)' : Colors.primaryLight }]}>
                          <Ionicons name="phone-portrait-outline" size={21} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>Rung</Text>
                          <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Phản hồi rung khi có cảnh báo hệ thống</Text>
                        </View>
                      </View>
                      <View style={styles.settingsRightStatus}>
                        <View
                          style={[
                            styles.settingsStatusPill,
                            vibrationEnabled
                              ? isDarkMode
                                ? { backgroundColor: 'rgba(255, 122, 0, 0.18)' }
                                : { backgroundColor: Colors.primaryLight }
                              : isDarkMode
                                ? { backgroundColor: '#0F172A' }
                                : { backgroundColor: '#F1F5F9' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.settingsValueText,
                              vibrationEnabled
                                ? { color: Colors.primary, fontWeight: '700' }
                                : isDarkMode
                                  ? { color: '#94A3B8' }
                                  : { color: '#64748B' },
                            ]}
                          >
                            {vibrationEnabled ? 'Mở' : 'Tắt'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
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
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
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
                  <Text style={[styles.accessibilityValue, { color: Colors.primary, fontWeight: '600', fontSize: 15 }]}>{fontSizeMode === 'system' ? 'Theo hệ thống' : 'Tùy chỉnh'}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </View>
              </TouchableOpacity>

              <View style={[styles.accessibilityRow, styles.accessibilityRowLast]}>
                <Text style={[styles.accessibilityLabel, isDarkMode && { color: '#F8FAFC' }]}>Tăng độ tương phản</Text>
                <Switch
                  value={highContrastEnabled}
                  onValueChange={setHighContrastEnabled}
                  trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                  thumbColor={highContrastEnabled ? Colors.primary : '#FFFFFF'}
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
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
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
                style={[
                  styles.fontSizeOption,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                  fontSizeMode === 'system' && { borderColor: Colors.primary, borderWidth: 1.5 },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  applyFontScaleMode('system');
                }}
              >
                <Text style={[styles.fontSizeOptionText, isDarkMode && { color: '#F8FAFC' }]}>Theo hệ thống</Text>
                {fontSizeMode === 'system' && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.fontSizeOption,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                  fontSizeMode === 'custom' && { borderColor: Colors.primary, borderWidth: 1.5 },
                ]}
                activeOpacity={0.8}
                onPress={() => applyFontScaleMode('custom')}
              >
                <Text style={[styles.fontSizeOptionText, isDarkMode && { color: '#F8FAFC' }]}>Tùy chỉnh</Text>
                {fontSizeMode === 'custom' && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>

              {fontSizeMode === 'custom' && (
                <View style={[styles.customFontSliderPanel, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18, padding: 16 }]}>
                  <Text style={[styles.customFontSliderTitle, isDarkMode && { color: '#F8FAFC' }]}>Xem trước cỡ chữ</Text>
                  <Text
                    style={[
                      styles.customFontSliderTitle,
                      {
                        fontSize: 18 * FONT_SCALE_LEVELS[customFontScale],
                        lineHeight: 24 * FONT_SCALE_LEVELS[customFontScale],
                        marginBottom: 12,
                      },
                      isDarkMode && { color: '#F8FAFC' },
                    ]}
                  >
                    Aa - Văn bản mẫu
                  </Text>

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

              <Text style={[styles.fontSizeLink, { color: Colors.primary }]}>Cách sử dụng tính năng Zoom</Text>
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
                style={[styles.backButton, styles.infoBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
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
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.infoListRow, { borderBottomWidth: 0 }]}
                  activeOpacity={0.8}
                  onPress={() => setInfoDetail('app')}
                >
                  <Text style={[styles.infoRowText, isDarkMode && { color: '#F8FAFC' }]}>Thông tin ứng dụng</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
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
                    <View style={[styles.appInfoIcon, { backgroundColor: Colors.primary }]}>
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
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
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
              <Switch
                value={vibrationEnabled}
                onValueChange={handleVibrationToggle}
                trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                thumbColor={vibrationEnabled ? Colors.primary : '#FFFFFF'}
              />
            </View>

            <Text style={[styles.vibrationDetailDescription, isDarkMode && { color: '#94A3B8' }]}>
              Khi được bật, điện thoại / máy tính bảng của bạn sẽ rung khi có cảnh báo hoặc thông báo mới từ hệ thống.
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
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
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
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                    thumbColor={notificationsEnabled ? Colors.primary : '#FFFFFF'}
                  />
                </View>
                <View style={[styles.notificationSettingDivider, isDarkMode && { backgroundColor: '#334155' }]} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>Âm thanh cảnh báo</Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>Phát âm thanh khi có cảnh báo</Text>
                  </View>
                  <Switch
                    value={alertSoundEnabled}
                    onValueChange={setAlertSoundEnabled}
                    trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                    thumbColor={alertSoundEnabled ? Colors.primary : '#FFFFFF'}
                  />
                </View>
                <View style={[styles.notificationSettingDivider, isDarkMode && { backgroundColor: '#334155' }]} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>Cảnh báo khẩn cấp</Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>Luôn ưu tiên cảnh báo nguy hiểm</Text>
                  </View>
                  <Switch
                    value={criticalAlertEnabled}
                    onValueChange={setCriticalAlertEnabled}
                    trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                    thumbColor={criticalAlertEnabled ? Colors.primary : '#FFFFFF'}
                  />
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
                style={[styles.backButton, styles.settingsBackButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
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
                  <Text style={[styles.generalRowValue, { color: Colors.primary, fontWeight: '600' }]}>{languageMode === 'vi' ? 'Việt Nam' : 'English'}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.generalRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.8}
                onPress={() => setAppearanceVisible(true)}
              >
                <Text style={[styles.generalRowLabel, isDarkMode && { color: '#F8FAFC' }]}>Chế độ tối</Text>
                <View style={styles.generalValueWrap}>
                  <Text style={[styles.generalRowValue, { color: Colors.primary, fontWeight: '600' }]}>{appearanceMode === 'light' ? 'Màu sáng' : 'Tối'}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
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
                style={[styles.appearanceCloseButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => setLanguageVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : '#111827'} />
              </TouchableOpacity>

              <Text style={[styles.appearanceTitle, isDarkMode && { color: '#F8FAFC' }]}>Ngôn ngữ</Text>
              <View style={styles.appearanceHeaderSpacer} />
            </View>

            <View style={[styles.appearanceCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  isDarkMode ? { backgroundColor: '#1E293B', borderBottomColor: '#334155' } : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB' },
                  languageMode === 'vi' && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => handleLanguageChange('vi')}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>Việt Nam</Text>
                {languageMode === 'vi' && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  isDarkMode ? { backgroundColor: '#1E293B', borderBottomColor: '#334155', borderBottomWidth: 0 } : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 0 },
                  languageMode === 'en' && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => handleLanguageChange('en')}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>English</Text>
                {languageMode === 'en' && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
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
        <Pressable style={[styles.appearanceOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setAppearanceVisible(false)}>
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={[styles.appearanceCloseButton, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => setAppearanceVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : '#111827'} />
              </TouchableOpacity>

              <Text style={[styles.appearanceTitle, isDarkMode && { color: '#F8FAFC' }]}>Vẻ bề ngoài</Text>
              <View style={styles.appearanceHeaderSpacer} />
            </View>

            <View style={[styles.appearanceCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  isDarkMode ? { backgroundColor: '#1E293B', borderBottomColor: '#334155' } : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB' },
                  appearanceMode === 'light' && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setAppearanceMode('light');
                  setDarkMode(false);
                  setAppearanceVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>Màu sáng</Text>
                {appearanceMode === 'light' && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  isDarkMode ? { backgroundColor: '#1E293B', borderBottomColor: '#334155', borderBottomWidth: 0 } : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 0 },
                  appearanceMode === 'dark' && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setAppearanceMode('dark');
                  setDarkMode(true);
                  setAppearanceVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>Tối</Text>
                {appearanceMode === 'dark' && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isDarkMode && { backgroundColor: colors.background }]}
      >
        {/* ================================================================= */}
        {/* HEADER: TITLE "Menu" & QUICK ACTIONS (SEARCH, SETTINGS)           */}
        {/* ================================================================= */}
        <View style={styles.fbHeaderRow}>
          <Text style={[styles.fbHeaderTitle, isDarkMode && { color: colors.textPrimary }]}>Menu</Text>
          <View style={styles.fbHeaderActionIcons}>
            <TouchableOpacity
              style={[styles.fbHeaderCircleBtn, isDarkMode && { backgroundColor: colors.card }]}
              onPress={() => setSettingsVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={20} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fbHeaderCircleBtn, isDarkMode && { backgroundColor: colors.card }]}
              onPress={() => setSettingsVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-sharp" size={20} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ================================================================= */}
        {/* USER PROFILE CARD (CARD THÔNG TIN NGƯỜI DÙNG PHONG CÁCH FB)      */}
        {/* ================================================================= */}
        <View style={[styles.fbProfileCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Hàng 1: Avatar, Tên người dùng thật, SĐT, Badge vai trò & Dropdown */}
          <TouchableOpacity
            style={styles.fbProfileInfoRow}
            activeOpacity={0.8}
            onPress={() => {
              setAccountEntrySource('main');
              setUserMenuVisible(true);
            }}
          >
            <View style={styles.fbAvatarCircle}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.fbAvatarImg} />
              ) : (
                <Ionicons name="person" size={26} color="#FFFFFF" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <LocalizedText style={[styles.fbProfileName, isDarkMode && { color: colors.textPrimary }]}>
                {profileName || full_name || userName || 'Nguyễn Hữu Nghĩa'}
              </LocalizedText>
            </View>
            {/* Badge thông báo & icon switch */}
            <View style={styles.fbProfileRightBadge}>
              <Ionicons name="chevron-down-circle" size={24} color="#64748B" />
              <View style={styles.fbNotiCountBadge}>
                <Text style={styles.fbNotiCountText}>2</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.fbCardDivider, isDarkMode && { backgroundColor: colors.border }]} />

          {/* Hàng 2: Quick action "+ Thêm thành viên hoặc người cần chăm sóc" */}
          <TouchableOpacity
            style={styles.fbSubActionRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('HouseDetail')}
          >
            <View style={styles.fbPlusCircleBtn}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </View>
            <Text style={[styles.fbSubActionText, isDarkMode && { color: colors.textPrimary }]}>
              Thêm thành viên gia đình & Cụ cần chăm sóc
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* LỐI TẮT CỦA BẠN (YOUR SHORTCUTS - CAROUSEL NGANG PHONG CÁCH FB)   */}
        {/* ================================================================= */}
        <View style={styles.fbShortcutsSection}>
          <Text style={[styles.fbSectionTitle, isDarkMode && { color: colors.textPrimary }]}>
            Lối tắt của bạn
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fbShortcutsScroll}
          >
            {/* Lối tắt 1: Cụ Nguyễn Văn An (Bệnh án) */}
            <TouchableOpacity
              style={styles.fbShortcutItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('PatientMedicalRecord')}
            >
              <View style={styles.fbShortcutThumbWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=200&q=80' }}
                  style={styles.fbShortcutThumb}
                />
                <View style={[styles.fbShortcutBadge, { backgroundColor: '#EF4444' }]}>
                  <Ionicons name="heart" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.fbShortcutLabel, isDarkMode && { color: colors.textSecondary }]}>
                Cụ Nguyễn...
              </Text>
            </TouchableOpacity>

            {/* Lối tắt 2: Camera AI Phòng Khách */}
            <TouchableOpacity
              style={styles.fbShortcutItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CameraDetail', { deviceId: 'SECA_001', name: 'Camera AI Phòng Khách' })}
            >
              <View style={styles.fbShortcutThumbWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=200&q=80' }}
                  style={styles.fbShortcutThumb}
                />
                <View style={[styles.fbShortcutBadge, { backgroundColor: '#0284C7' }]}>
                  <Ionicons name="videocam" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.fbShortcutLabel, isDarkMode && { color: colors.textSecondary }]}>
                Camera PK
              </Text>
            </TouchableOpacity>

            {/* Lối tắt 3: Vòng đeo tay BLE */}
            <TouchableOpacity
              style={styles.fbShortcutItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('SmartbandDetail')}
            >
              <View style={styles.fbShortcutThumbWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=200&q=80' }}
                  style={styles.fbShortcutThumb}
                />
                <View style={[styles.fbShortcutBadge, { backgroundColor: '#FF7A00' }]}>
                  <Ionicons name="pulse" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.fbShortcutLabel, isDarkMode && { color: colors.textSecondary }]}>
                Vòng tay BLE
              </Text>
            </TouchableOpacity>

            {/* Lối tắt 4: Lịch nhắc thuốc */}
            <TouchableOpacity
              style={styles.fbShortcutItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('MedicationReminder')}
            >
              <View style={styles.fbShortcutThumbWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80' }}
                  style={styles.fbShortcutThumb}
                />
                <View style={[styles.fbShortcutBadge, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="medkit" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.fbShortcutLabel, isDarkMode && { color: colors.textSecondary }]}>
                Nhắc thuốc
              </Text>
            </TouchableOpacity>

            {/* Lối tắt 5: Báo cáo y tế */}
            <TouchableOpacity
              style={styles.fbShortcutItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('MedicalReport')}
            >
              <View style={styles.fbShortcutThumbWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=200&q=80' }}
                  style={styles.fbShortcutThumb}
                />
                <View style={[styles.fbShortcutBadge, { backgroundColor: '#8B5CF6' }]}>
                  <Ionicons name="document-text" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.fbShortcutLabel, isDarkMode && { color: colors.textSecondary }]}>
                Báo cáo y tế
              </Text>
            </TouchableOpacity>

            {/* Lối tắt 6: Nhà của tôi */}
            <TouchableOpacity
              style={styles.fbShortcutItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('HouseDetail')}
            >
              <View style={styles.fbShortcutThumbWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=200&q=80' }}
                  style={styles.fbShortcutThumb}
                />
                <View style={[styles.fbShortcutBadge, { backgroundColor: '#0EA5E9' }]}>
                  <Ionicons name="home" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.fbShortcutLabel, isDarkMode && { color: colors.textSecondary }]}>
                Nhà của tôi
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ================================================================= */}
        {/* LƯỚI TÍNH NĂNG 2 CỘT (2-COLUMN FUNCTIONAL GRID - PHONG CÁCH FB)   */}
        {/* Sửa lại toàn bộ tên đúng chuẩn, không dùng tên kỳ quặc           */}
        {/* ================================================================= */}
        <View style={styles.fbGridContainer}>
          {/* Ô 1: Hồ sơ giám sát */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              setAccountEntrySource('main');
              setUserMenuVisible(true);
            }}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' }]}>
              <Ionicons name="person-circle-outline" size={24} color="#6366F1" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Hồ sơ giám sát
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Tài khoản người thân & SĐT khẩn cấp
            </Text>
          </TouchableOpacity>

          {/* Ô 2: Hồ sơ bệnh án người cao tuổi */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PatientMedicalRecord')}
          >
            <View style={styles.fbGridCardTopRow}>
              <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' }]}>
                <Ionicons name="medkit-outline" size={24} color="#0EA5E9" />
              </View>
              <View style={styles.fbAesBadge}>
                <Text style={styles.fbAesBadgeText}>AES-256</Text>
              </View>
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Hồ sơ bệnh án
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Cụ An, bệnh nền, nhóm máu & đơn thuốc
            </Text>
          </TouchableOpacity>

          {/* Ô 3: Nhà của tôi */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('HouseDetail')}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' }]}>
              <Ionicons name="home-outline" size={24} color="#10B981" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              {house.name || 'Nhà của tôi'}
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Thành viên: {house.membersCount || 1} • Phòng khách
            </Text>
          </TouchableOpacity>

          {/* Ô 4: Thiết bị kết nối (Sửa từ "Hoạt động với") */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Devices')}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#451A03' : '#FFF7ED' }]}>
              <Ionicons name="hardware-chip-outline" size={24} color="#FF7A00" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Thiết bị kết nối
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Camera AI, Vòng BLE & Cảm biến
            </Text>
          </TouchableOpacity>

          {/* Ô 5: Cấu hình AI & Cảnh báo (Sửa từ "Chơi Algo") */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AlgoConfig')}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#3B1D54' : '#F5F3FF' }]}>
              <Ionicons name="color-wand-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Cấu hình 
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Độ nhạy té ngã, ngưỡng nhịp tim & SpO2
            </Text>
          </TouchableOpacity>

          {/* Ô 6: Báo cáo sức khỏe (Sửa từ "Báo cáo y tế & Xuất file (FR13)") */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('MedicalReport')}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
              <Ionicons name="document-text-outline" size={24} color="#2563EB" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Báo cáo sức khỏe
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Xuất file PDF & Excel gửi bác sĩ
            </Text>
          </TouchableOpacity>

          {/* Ô 8: Trung tâm bảo mật */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => setSecurityCenterVisible(true)}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#133E3B' : '#F0FDFA' }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#0D9488" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Trung tâm bảo mật
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Xác thực 2FA & Quản lý phiên đăng nhập
            </Text>
          </TouchableOpacity>

          {/* Ô 9: Lịch nhắc thuốc */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('MedicationReminder')}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7' }]}>
              <Ionicons name="calendar-outline" size={24} color="#D97706" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Lịch nhắc thuốc
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Đơn thuốc & Lịch tái khám bác sĩ
            </Text>
          </TouchableOpacity>

          {/* HIỂN THỊ THÊM KHI BẤM "XEM THÊM" (GIỐNG HÌNH 1) */}
          {showMoreGrid && (
            <>
              {/* Ô 10: Nhật ký cảnh báo SOS */}
              <TouchableOpacity
                style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Alerts')}
              >
                <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' }]}>
                  <Ionicons name="notifications-outline" size={24} color="#EF4444" />
                </View>
                <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Nhật ký cảnh báo
                </Text>
                <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
                  Sự kiện té ngã & Sinh hiệu bất thường
                </Text>
              </TouchableOpacity>

              {/* Ô 11: Trợ lý Bác sĩ AI */}
              <TouchableOpacity
                style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AIAssistant')}
              >
                <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#164E63' : '#ECFEFF' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={24} color="#06B6D4" />
                </View>
                <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Trợ lý Bác sĩ AI
                </Text>
                <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
                  Tư vấn dinh dưỡng & Vận động 24/7
                </Text>
              </TouchableOpacity>

              {/* Ô 12: Giám sát đa màn hình */}
              <TouchableOpacity
                style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('MultiView')}
              >
                <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#2E1065' : '#F3E8FF' }]}>
                  <Ionicons name="grid-outline" size={24} color="#7C3AED" />
                </View>
                <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Multi-View Camera
                </Text>
                <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
                  Xem nhiều góc quay camera cùng lúc
                </Text>
              </TouchableOpacity>

              {/* Ô 13: Chế độ Bác sĩ Gia đình */}
              <TouchableOpacity
                style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: '#0284C7' }]}
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert(
                    'Chuyển sang Chế độ Bác sĩ',
                    'Bạn muốn chuyển sang giao diện chuyên môn của Bác sĩ gia đình (Danh sách bệnh nhân, Kê đơn thuốc, Báo cáo y tế)?',
                    [
                      { text: 'Hủy', style: 'cancel' },
                      { text: 'Chuyển ngay', onPress: () => toggleViewRole() },
                    ]
                  );
                }}
              >
                <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' }]}>
                  <Ionicons name="medical-outline" size={24} color="#0284C7" />
                </View>
                <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Chế độ Bác sĩ
                </Text>
                <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
                  Bệnh án, Kê đơn & Báo cáo y tế
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* NÚT "XEM THÊM" / "ẨN BỚT" (GIỐNG HỆT HÌNH 1) */}
        <TouchableOpacity
          style={[styles.fbViewMoreBtn, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => setShowMoreGrid(!showMoreGrid)}
        >
          <Text style={[styles.fbViewMoreText, isDarkMode && { color: colors.textPrimary }]}>
            {showMoreGrid ? 'Ẩn bớt' : 'Xem thêm'}
          </Text>
          <Ionicons
            name={showMoreGrid ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isDarkMode ? colors.textPrimary : '#1E293B'}
          />
        </TouchableOpacity>

        {/* ================================================================= */}
        {/* ACCORDION 1: TRỢ GIÚP VÀ HỖ TRỢ (GIỐNG HÌNH 1)                    */}
        {/* ================================================================= */}
        <View style={[styles.fbAccordionCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.fbAccordionHeader}
            activeOpacity={0.7}
            onPress={() => setIsHelpExpanded(!isHelpExpanded)}
          >
            <View style={styles.fbAccordionHeaderLeft}>
              <Ionicons name="help-circle-outline" size={24} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
              <Text style={[styles.fbAccordionTitle, isDarkMode && { color: colors.textPrimary }]}>
                Trợ giúp và hỗ trợ
              </Text>
            </View>
            <Ionicons
              name={isHelpExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748B"
            />
          </TouchableOpacity>

          {isHelpExpanded && (
            <View style={styles.fbAccordionBody}>
              {/* Cấp cứu 115 */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={callEmergencyService}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="call" size={18} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, { color: '#EF4444', fontWeight: '800' }]}>
                    Gọi cấp cứu y tế khẩn cấp 115
                  </Text>
                  <Text style={styles.fbSubRowSub}>Kết nối trực tiếp đường dây nóng y tế</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>

              <View style={[styles.fbSubDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Dịch vụ CSKH */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={handleCustomerSupportPress}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="headset" size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>
                    Tổng đài hỗ trợ kỹ thuật CSKH 24/7
                  </Text>
                  <Text style={styles.fbSubRowSub}>Hỗ trợ kết nối camera, vòng tay, hub AI</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>

              <View style={[styles.fbSubDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Hướng dẫn sử dụng */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => {
                  setInfoDetail('app');
                  setAboutInfoVisible(true);
                }}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="book-outline" size={18} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>
                    Hướng dẫn sử dụng & Giới thiệu đồ án
                  </Text>
                  <Text style={styles.fbSubRowSub}>Tài liệu kỹ thuật Smart Elderly Care AI</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ================================================================= */}
        {/* ACCORDION 2: CÀI ĐẶT VÀ QUYỀN RIÊNG TƯ (GIỐNG HÌNH 1)             */}
        {/* ================================================================= */}
        <View style={[styles.fbAccordionCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.fbAccordionHeader}
            activeOpacity={0.7}
            onPress={() => setIsSettingsExpanded(!isSettingsExpanded)}
          >
            <View style={styles.fbAccordionHeaderLeft}>
              <Ionicons name="settings-outline" size={24} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
              <Text style={[styles.fbAccordionTitle, isDarkMode && { color: colors.textPrimary }]}>
                Cài đặt và quyền riêng tư
              </Text>
            </View>
            <Ionicons
              name={isSettingsExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748B"
            />
          </TouchableOpacity>

          {isSettingsExpanded && (
            <View style={styles.fbAccordionBody}>
              {/* Cài đặt thông báo & Âm thanh */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => setNotificationSettingsVisible(true)}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="notifications-outline" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>
                    Cài đặt thông báo & Âm thanh báo động
                  </Text>
                  <Text style={styles.fbSubRowSub}>Chuông còi hú, rung, thông báo đẩy</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>

              <View style={[styles.fbSubDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Kích thước chữ cho người cao tuổi */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => setFontSizeVisible(true)}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="text-outline" size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>
                    Cỡ chữ lớn (Dành cho người cao tuổi)
                  </Text>
                  <Text style={styles.fbSubRowSub}>Điều chỉnh độ phóng to chữ đọc dễ dàng</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>

              <View style={[styles.fbSubDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Chế độ Sáng / Tối */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => setAppearanceVisible(true)}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="contrast-outline" size={18} color="#475569" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>
                    Chế độ giao diện Sáng / Tối
                  </Text>
                  <Text style={styles.fbSubRowSub}>
                    {isDarkMode ? 'Đang dùng Giao diện Tối' : 'Đang dùng Giao diện Sáng'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>

              <View style={[styles.fbSubDivider, isDarkMode && { backgroundColor: colors.border }]} />

              {/* Đổi mật khẩu */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => setChangePasswordVisible(true)}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>
                    Đổi mật khẩu tài khoản
                  </Text>
                  <Text style={styles.fbSubRowSub}>Cập nhật mã bảo mật đăng nhập</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ================================================================= */}
        {/* NÚT ĐĂNG XUẤT (NẰM DƯỚI CÙNG PHONG CÁCH THANH LỊCH)              */}
        {/* ================================================================= */}
        <TouchableOpacity
          style={[styles.fbLogoutBtn, isDarkMode && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}
          activeOpacity={0.8}
          onPress={handleLogout}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
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
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  customFontThumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: Colors.primary,
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
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
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
    backgroundColor: Colors.background,
    justifyContent: 'flex-start',
  },
  appearanceSheet: {
    width: '100%',
    flex: 1,
    backgroundColor: Colors.background,
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
    width: 38,
    height: 38,
  },
  appearanceCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  appearanceTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  appearanceCard: {
    marginTop: 8,
    marginHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    ...Shadows.card,
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
    borderBottomColor: Colors.border,
  },
  appearanceOptionRowSelected: {
    backgroundColor: Colors.primaryLight,
  },
  appearanceOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    paddingTop: 0,
    zIndex: 2,
    ...Shadows.soft,
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
    backgroundColor: Colors.background,
  },
  changePasswordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
  },
  changePasswordBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  changePasswordHeaderRight: {
    width: 38,
    height: 38,
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
    paddingTop: 8,
    paddingBottom: 28,
  },
  changePasswordCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  changePasswordHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  changePasswordIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePasswordCardHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  changePasswordIntro: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  passwordFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: '#FFFBF7',
  },
  passwordLeadingIcon: {
    marginRight: 10,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    paddingRight: 8,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    borderWidth: 0,
    outlineWidth: 0,
  },
  passwordRequirements: {
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  passwordRequirementsTitle: {
    marginBottom: 8,
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  passwordRequirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  passwordRequirement: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  changePasswordButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  notificationSettingsContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 18,
    backgroundColor: 'transparent',
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
    backgroundColor: Colors.background,
    justifyContent: 'flex-start',
  },
  editorSheet: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    justifyContent: 'flex-start',
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 18,
    gap: 10,
  },
  editorBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.soft,
  },
  editorTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  editorCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  editorFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  editorFieldIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorFieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  editorFieldHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editorInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: '#FFFBF7',
    marginBottom: 16,
  },
  editorInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingVertical: 8,
    borderWidth: 0,
    outlineWidth: 0,
  },
  editorErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
  },
  editorErrorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  editorCancel: {
    minWidth: 92,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  editorSave: {
    minWidth: 108,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  editorSaveText: {
    fontSize: 15,
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
    gap: 14,
    paddingBottom: 8,
  },
  settingsGroupCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Shadows.card,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: 'transparent',
  },
  settingsItemLast: {
    borderBottomWidth: 0,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  settingsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingsLabel: {
    fontSize: 15.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  settingsRightStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 32,
  },
  settingsStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  settingsValueText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
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
  settingsItemSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  profileAesBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  profileAesBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },

  // -------------------------------------------------------------------------
  // FACEBOOK MENU STYLES (MATCHING SCREENSHOT 1)
  // -------------------------------------------------------------------------
  fbHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 16,
    marginTop: 4,
  },
  fbHeaderTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  fbHeaderActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fbHeaderCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E4E6EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User Profile Card
  fbProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fbProfileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  fbAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fbAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  fbProfileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  fbProfileRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  fbProfileRightBadge: {
    position: 'relative',
    padding: 4,
  },
  fbNotiCountBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#E41E3F',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  fbNotiCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  fbCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  fbSubActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  fbPlusCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbSubActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },

  // Shortcuts Section
  fbShortcutsSection: {
    marginBottom: 20,
  },
  fbSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  fbShortcutsScroll: {
    gap: 12,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  fbShortcutItem: {
    alignItems: 'center',
    width: 76,
  },
  fbShortcutThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'visible',
    marginBottom: 6,
  },
  fbShortcutThumb: {
    width: 68,
    height: 68,
    borderRadius: 16,
  },
  fbShortcutBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fbShortcutLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },

  // 2-Column Grid
  fbGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  fbGridCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 120,
    justifyContent: 'space-between',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  fbGridCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fbGridIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  fbAesBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  fbAesBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284C7',
  },
  fbGridCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 20,
  },
  fbGridCardSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },

  // View More Button
  fbViewMoreBtn: {
    height: 44,
    backgroundColor: '#E4E6EB',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  fbViewMoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Accordion Sections
  fbAccordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fbAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fbAccordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fbAccordionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  fbAccordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  fbAccordionSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  fbSubIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbSubRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  fbSubRowSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fbSubDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 46,
  },

  // Logout Button
  fbLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
    marginBottom: 20,
  },
  fbLogoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
});

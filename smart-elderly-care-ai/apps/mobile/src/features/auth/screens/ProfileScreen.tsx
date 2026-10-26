// ProfileScreen.tsx
// Màn hình Cá nhân / Quản trị hệ thống (Phong cách Elderly Care AI)

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
  Image,
  Switch,
  PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAuthStore } from '../../../store/useAuthStore';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from '../../../i18n/LocalizedComponents';
import api, { usersApi, BASE_URL } from '../../../services/api';
import {
  launchEmergencyCall,
  launchSupportCall,
  SUPPORT_HOTLINE_NUMBER,
} from '../../../services/emergency';

const resolveAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('file:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }
  const hostOrigin = BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${hostOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function ProfileScreen({ navigation, route }: any) {
  const {
    userId,
    userName,
    full_name,
    userPhone,
    phone_number,
    avatarUrl,
    avatar_url,
    setAvatar,
    logout,
    updateUserName,
    toggleViewRole,
    setProfile,
  } = useAuthStore();
  const { house } = useVitalStore();
  const {
    isDarkMode,
    colors,
    setDarkMode,
    fontScale,
    fontSizeMode: storeFontSizeMode,
    setFontScale,
    setFontSizeMode: setStoreFontSizeMode,
  } = useTheme();

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
  const [accountEntrySource, setAccountEntrySource] = React.useState<'main' | 'settings'>('main');

  const [isChangePasswordVisible, setChangePasswordVisible] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordChangeFeedback, setPasswordChangeFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [isLogoutConfirmVisible, setLogoutConfirmVisible] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [avatarUri, setAvatarUri] = React.useState<string | null>(() => {
    const raw = avatarUrl || avatar_url;
    if (raw && !raw.startsWith('blob:')) {
      return resolveAvatarUrl(raw);
    }
    return null;
  });
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [isCustomerSupportVisible, setCustomerSupportVisible] = React.useState(false);
  const [isSecurityCenterVisible, setSecurityCenterVisible] = React.useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [securityDetail, setSecurityDetail] = React.useState<
    'twoFactor' | 'devices' | 'logins' | 'question' | null
  >(null);
  const [selectedSecurityQuestion, setSelectedSecurityQuestion] = React.useState('');
  const [returnToSecurityAfterPassword, setReturnToSecurityAfterPassword] = React.useState(false);

  const openSecurityDetail = (detail: 'twoFactor' | 'devices' | 'logins' | 'question') => {
    setSecurityCenterVisible(false);
    setTimeout(() => setSecurityDetail(detail), 220);
  };

  const FONT_SCALE_LEVELS = [0.8, 1, 1.2, 1.5, 1.8] as const;

  const [isNotificationSettingsVisible, setNotificationSettingsVisible] = React.useState(false);
  const [isFontSizeVisible, setFontSizeVisible] = React.useState(false);
  const [isAppearanceVisible, setAppearanceVisible] = React.useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [alertSoundEnabled, setAlertSoundEnabled] = React.useState(true);
  const [criticalAlertEnabled, setCriticalAlertEnabled] = React.useState(true);

  const [fontSizeMode, setFontSizeMode] = React.useState<'system' | 'custom'>(storeFontSizeMode || 'system');
  const [customFontScale, setCustomFontScale] = React.useState(1);
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const sliderTrackPosition = React.useRef(0);

  const saveFontPreferences = React.useCallback(async (mode: 'system' | 'custom', scale: number) => {
    try {
      await usersApi.updateFontPreferences(mode, scale);
    } catch (err) {
      console.warn('[ProfileScreen] Could not save font-size preferences:', err);
    }
  }, []);

  const handleToggleNotification = React.useCallback(
    async (
      key: 'notifications_enabled' | 'alert_sound_enabled' | 'critical_alert_enabled',
      value: boolean
    ) => {
      if (key === 'notifications_enabled') setNotificationsEnabled(value);
      if (key === 'alert_sound_enabled') setAlertSoundEnabled(value);
      if (key === 'critical_alert_enabled') setCriticalAlertEnabled(value);

      try {
        await usersApi.updateNotificationPreferences({ [key]: value });
      } catch (err) {
        console.warn('[ProfileScreen] Không thể lưu cài đặt thông báo:', err);
      }
    },
    []
  );

  const applyFontScaleMode = (mode: 'system' | 'custom') => {
    setFontSizeMode(mode);
    setStoreFontSizeMode(mode);
    setFontScale(mode === 'custom' ? FONT_SCALE_LEVELS[customFontScale] : 1);
    void saveFontPreferences(mode, customFontScale);
  };

  const updateFontScaleFromPosition = React.useCallback(
    (positionX: number) => {
      if (!sliderWidth) return;
      const rawRatio = Math.min(Math.max(positionX / sliderWidth, 0), 1);
      const nextScale = Math.round(rawRatio * 4);
      setCustomFontScale(nextScale);
      setFontScale(FONT_SCALE_LEVELS[nextScale]);
    },
    [sliderWidth, setFontScale]
  );

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
            1
          );
          const nextScale = Math.round(rawRatio * 4);
          setCustomFontScale(nextScale);
          setFontScale(FONT_SCALE_LEVELS[nextScale]);
          void saveFontPreferences('custom', nextScale);
        },
      }),
    [saveFontPreferences, setFontScale, sliderWidth, updateFontScaleFromPosition]
  );

  React.useEffect(() => {
    if (isChangePasswordVisible) setPasswordChangeFeedback(null);
  }, [isChangePasswordVisible]);

  React.useEffect(() => {
    if (route?.params?.openUserMenu) {
      setAccountEntrySource('settings');
      setUserMenuVisible(true);
      navigation?.setParams?.({ openUserMenu: undefined });
    }
  }, [route?.params?.openUserMenu, navigation]);

  React.useEffect(() => {
    if (full_name || userName) {
      setProfileName(full_name || userName || '');
    }
    if (phone_number || userPhone) {
      setProfilePhone(phone_number || userPhone || '');
    }
  }, [userName, full_name, userPhone, phone_number]);

  React.useEffect(() => {
    const raw = avatarUrl || avatar_url;
    if (raw && !raw.startsWith('blob:')) {
      setAvatarUri(resolveAvatarUrl(raw));
    }
  }, [avatarUrl, avatar_url]);

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
          if (res.data.avatar_url) {
            const resolved = resolveAvatarUrl(res.data.avatar_url);
            if (resolved) {
              setAvatarUri(resolved);
              setAvatar(resolved);
            }
          }
          if (typeof res.data.notifications_enabled === 'boolean') {
            setNotificationsEnabled(res.data.notifications_enabled);
          }
          if (typeof res.data.alert_sound_enabled === 'boolean') {
            setAlertSoundEnabled(res.data.alert_sound_enabled);
          }
          if (typeof res.data.critical_alert_enabled === 'boolean') {
            setCriticalAlertEnabled(res.data.critical_alert_enabled);
          }
          if (Number.isInteger(res.data.custom_font_scale) && res.data.custom_font_scale >= 0 && res.data.custom_font_scale <= 4) {
            setCustomFontScale(res.data.custom_font_scale);
          }
          setProfile({
            user_id: res.data.user_id || res.data.id,
            full_name: res.data.full_name,
            phone_number: phone,
            role: res.data.role,
            household_id: res.data.household_id,
            avatar_url: res.data.avatar_url,
          });
        }
      } catch (error) {
        console.warn('[Profile] Không thể tải hồ sơ từ database:', error);
      }
    };
    void fetchUserProfile();
  }, [setProfile, setAvatar]);

  const closeUserMenu = React.useCallback(() => {
    setUserMenuVisible(false);

    if (accountEntrySource === 'settings') {
      navigation.navigate('Settings');
    }
  }, [accountEntrySource, navigation]);

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

  const closeChangePassword = () => {
    setChangePasswordVisible(false);
    if (returnToSecurityAfterPassword) {
      setReturnToSecurityAfterPassword(false);
      setSecurityCenterVisible(true);
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

  const convertAssetToDataUri = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
    if (asset.base64) {
      return asset.base64.startsWith('data:')
        ? asset.base64
        : `data:image/jpeg;base64,${asset.base64}`;
    }
    try {
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            resolve(asset.uri);
          }
        };
        reader.onerror = () => resolve(asset.uri);
        reader.readAsDataURL(blob);
      });
    } catch {
      return asset.uri;
    }
  };

  const handleSaveAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      // 1. Chuyển đổi sang Base64 Data URI ngay lập tức (không lưu blob: để F5 trên Web không bao giờ bị mất)
      const dataUri = await convertAssetToDataUri(asset);

      // 2. Cập nhật state hiển thị ngay và lưu vào Zustand storage
      setAvatarUri(dataUri);
      setAvatar(dataUri);

      // 3. Upload lên backend FastAPI để lưu vào cơ sở dữ liệu PostgreSQL (users.avatar_url)
      let uploadRes;
      try {
        uploadRes = await usersApi.uploadAvatarBase64(dataUri);
      } catch (uploadErr) {
        console.warn('[ProfileScreen] uploadAvatarBase64 error, attempting updateMe fallback:', uploadErr);
        try {
          uploadRes = await usersApi.updateMe({ avatar_url: dataUri });
        } catch (updateErr) {
          console.warn('[ProfileScreen] updateMe fallback failed:', updateErr);
        }
      }

      const returnedAvatarUrl = uploadRes?.data?.avatar_url;
      if (returnedAvatarUrl) {
        const resolvedServerUrl = resolveAvatarUrl(returnedAvatarUrl);
        if (resolvedServerUrl) {
          setAvatarUri(resolvedServerUrl);
          setAvatar(resolvedServerUrl);
        }
        setProfile({ avatar_url: returnedAvatarUrl });
      } else {
        setProfile({ avatar_url: dataUri });
      }
    } catch (error) {
      console.warn('[ProfileScreen] Không thể lưu avatar:', error);
    }
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
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      void handleSaveAvatar(result.assets[0]);
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
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      void handleSaveAvatar(result.assets[0]);
    }
  };

  const handleDeleteAvatar = async () => {
    setAvatarPickerVisible(false);
    setAvatarUri(null);
    setAvatar(null);
    try {
      await usersApi.deleteAvatar();
    } catch (err) {
      console.warn('[ProfileScreen] Lỗi khi xóa avatar:', err);
    }
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

  const callCustomerSupportService = async () => {
    try {
      await launchSupportCall('Hỗ trợ kết nối camera, vòng tay, hub AI');
    } catch (error) {
      console.warn('[ProfileScreen] Could not open customer support dialer:', error);
      Alert.alert('Không thể mở cuộc gọi', `Vui lòng gọi tổng đài hỗ trợ ${SUPPORT_HOTLINE_NUMBER} trực tiếp.`);
    }
  };

  const resolvedDisplayName = profileName || full_name || userName || 'Người giám sát';

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

      {/* Modal Hồ sơ cá nhân người giám sát */}
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

              <Text style={[styles.profileNameText, isDarkMode && { color: '#F8FAFC' }]}>{resolvedDisplayName}</Text>
            </View>

            <View style={[styles.profileInfoListCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TouchableOpacity style={[styles.infoRow, isDarkMode && { borderBottomColor: '#334155' }]} activeOpacity={0.8} onPress={() => openFieldEditor('name')}>
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="person-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Họ và tên</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={[styles.infoValue, isDarkMode && { color: '#94A3B8' }]}>{resolvedDisplayName}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.infoRow, isDarkMode && { borderBottomColor: '#334155' }]} activeOpacity={0.8}>
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="call-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Số điện thoại</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={[styles.infoValue, isDarkMode && { color: '#94A3B8' }]}>{profilePhone || 'Chưa cập nhật'}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.infoRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.8}
                onPress={() => setChangePasswordVisible(true)}
              >
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="lock-closed-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Thay đổi mật khẩu</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} activeOpacity={0.9} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Đăng xuất</Text>
            </TouchableOpacity>

            {/* Modal chỉnh sửa họ tên */}
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal CSKH Hotline 24/7 */}
      <Modal
        transparent
        visible={isCustomerSupportVisible}
        animationType="fade"
        onRequestClose={() => setCustomerSupportVisible(false)}
      >
        <Pressable style={styles.customerSupportOverlay} onPress={() => setCustomerSupportVisible(false)}>
          <Pressable style={[styles.customerSupportDialog, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]} onPress={() => {}}>
            <Ionicons name="headset" size={28} color="#2563EB" />
            <Text style={[styles.customerSupportTitle, isDarkMode && { color: '#F8FAFC' }]}>
              Tổng đài hỗ trợ kỹ thuật CSKH 24/7
            </Text>
            <Text style={[styles.customerSupportMessage, isDarkMode && { color: '#94A3B8' }]}>
              {`Kết nối trực tiếp tổng đài hỗ trợ kết nối camera, vòng tay, hub AI qua số ${SUPPORT_HOTLINE_NUMBER}?`}
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
                style={[styles.customerSupportCallButton, { backgroundColor: Colors.primary }]}
                onPress={() => {
                  setCustomerSupportVisible(false);
                  void callCustomerSupportService();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={17} color="#FFFFFF" />
                <Text style={styles.customerSupportCallText}>{`Gọi ${SUPPORT_HOTLINE_NUMBER}`}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chọn ảnh đại diện */}
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
                <Text style={[styles.avatarPickerText, isDarkMode && { color: '#F8FAFC' }]}>Chọn từ Thư viện</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Đổi mật khẩu */}
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
                            : '#B91C1C',
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
                <Text style={[styles.passwordRequirementsTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Yêu cầu mật khẩu:
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

      {/* Modal Kích thước phông chữ */}
      <Modal
        transparent
        visible={isFontSizeVisible}
        animationType="slide"
        onRequestClose={() => setFontSizeVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => setFontSizeVisible(false)}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => setFontSizeVisible(false)}
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
                onPress={() => applyFontScaleMode('system')}
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
                <View
                  style={[
                    styles.customFontSliderPanel,
                    isDarkMode && {
                      backgroundColor: '#1E293B',
                      borderColor: '#334155',
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 16,
                    },
                  ]}
                >
                  <Text style={[styles.customFontSliderTitle, isDarkMode && { color: '#F8FAFC' }]}>
                    Xem trước cỡ chữ
                  </Text>
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
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Thiết lập thông báo */}
      <Modal
        transparent
        visible={isNotificationSettingsVisible}
        animationType="slide"
        onRequestClose={() => setNotificationSettingsVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => setNotificationSettingsVisible(false)}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => setNotificationSettingsVisible(false)}
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

              <View
                style={[
                  styles.notificationSettingsCard,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
              >
                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>
                      Thông báo cảnh báo
                    </Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>
                      Nhận cảnh báo sức khỏe mới
                    </Text>
                  </View>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={(val) => void handleToggleNotification('notifications_enabled', val)}
                    trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                    thumbColor={notificationsEnabled ? Colors.primary : '#FFFFFF'}
                  />
                </View>
                <View style={[styles.notificationSettingDivider, isDarkMode && { backgroundColor: '#334155' }]} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>
                      Âm thanh cảnh báo
                    </Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>
                      Phát âm thanh khi có cảnh báo
                    </Text>
                  </View>
                  <Switch
                    value={alertSoundEnabled}
                    onValueChange={(val) => void handleToggleNotification('alert_sound_enabled', val)}
                    trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                    thumbColor={alertSoundEnabled ? Colors.primary : '#FFFFFF'}
                  />
                </View>
                <View style={[styles.notificationSettingDivider, isDarkMode && { backgroundColor: '#334155' }]} />

                <View style={styles.notificationSettingRow}>
                  <View style={styles.notificationSettingText}>
                    <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>
                      Cảnh báo khẩn cấp
                    </Text>
                    <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>
                      Luôn ưu tiên cảnh báo nguy hiểm
                    </Text>
                  </View>
                  <Switch
                    value={criticalAlertEnabled}
                    onValueChange={(val) => void handleToggleNotification('critical_alert_enabled', val)}
                    trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#FDBA74' }}
                    thumbColor={criticalAlertEnabled ? Colors.primary : '#FFFFFF'}
                  />
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Vẻ bề ngoài / Chế độ tối */}
      <Modal
        transparent
        visible={isAppearanceVisible}
        animationType="slide"
        onRequestClose={() => setAppearanceVisible(false)}
      >
        <Pressable
          style={[styles.appearanceOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => setAppearanceVisible(false)}
        >
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={[
                  styles.appearanceCloseButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
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
                  isDarkMode
                    ? { backgroundColor: '#1E293B', borderBottomColor: '#334155' }
                    : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB' },
                  !isDarkMode && styles.appearanceOptionRowSelected,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setDarkMode(false);
                  setAppearanceVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>Màu sáng</Text>
                {!isDarkMode && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  isDarkMode
                    ? { backgroundColor: '#1E293B', borderBottomColor: '#334155', borderBottomWidth: 0 }
                    : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 0 },
                  isDarkMode && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setDarkMode(true);
                  setAppearanceVisible(false);
                }}
              >
                <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>Tối</Text>
                {isDarkMode && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>
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
        <SafeAreaView style={[styles.securityDetailScreen, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
          <View style={[styles.securityDetailHeader, isDarkMode && { backgroundColor: '#0F172A', borderBottomColor: '#1E293B' }]}>
            <TouchableOpacity
              style={[styles.securityNavBackButton, isDarkMode && { backgroundColor: '#1E293B' }]}
              onPress={() => {
                setSecurityDetail(null);
                setSecurityCenterVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
            </TouchableOpacity>
            <Text style={[styles.securityDetailTitle, isDarkMode && { color: '#F8FAFC' }]} numberOfLines={1}>
              {securityDetail === 'twoFactor'
                ? 'Xác minh hai bước'
                : securityDetail === 'devices'
                  ? 'Quản lý đầu cuối'
                  : securityDetail === 'logins'
                    ? 'Nhật ký đăng nhập'
                    : 'Hướng dẫn bảo mật'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.securityDetailContent} showsVerticalScrollIndicator={false}>
            {securityDetail === 'twoFactor' && (
              <View style={[styles.securityDetailCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <View style={styles.securityDetailHeroBadge}>
                  <View style={[styles.securityTileIconSquircle, { backgroundColor: '#ECFDF5', width: 56, height: 56, borderRadius: 18 }]}>
                    <Ionicons name="shield-checkmark" size={32} color="#059669" />
                  </View>
                </View>
                <View style={styles.securityDetailRowHeader}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.securityDetailCardTitle, isDarkMode && { color: '#F8FAFC' }]}>
                      Xác thực qua mã SMS
                    </Text>
                    <Text style={[styles.securityDetailSubText, isDarkMode && { color: '#94A3B8' }]}>
                      {twoFactorEnabled ? 'Trạng thái: Đang bảo vệ' : 'Trạng thái: Chưa kích hoạt'}
                    </Text>
                  </View>
                  <Switch
                    value={twoFactorEnabled}
                    onValueChange={setTwoFactorEnabled}
                    trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
                    thumbColor={twoFactorEnabled ? '#0284C7' : '#FFFFFF'}
                  />
                </View>
                <Text style={[styles.securityDetailDescription, isDarkMode && { color: '#94A3B8' }]}>
                  Để giữ an toàn tuyệt đối cho tài khoản giám sát người cao tuổi, hệ thống sẽ yêu cầu nhập mã OTP gửi về tin nhắn SMS khi bạn đăng nhập trên thiết bị mới hoặc thực hiện thao tác nhạy cảm.
                </Text>
                <View style={[styles.securityInfoBanner, isDarkMode && { backgroundColor: 'rgba(2,132,199,0.12)', borderColor: 'rgba(2,132,199,0.3)' }]}>
                  <Ionicons name="information-circle" size={22} color="#0284C7" />
                  <Text style={[styles.securityInfoText, isDarkMode && { color: '#38BDF8' }]}>
                    {twoFactorEnabled
                      ? 'Tính năng xác thực 2 lớp đang kích hoạt trên số điện thoại đăng ký của bạn.'
                      : 'Khuyến khích bật xác thực 2 bước để phòng ngừa truy cập trái phép.'}
                  </Text>
                </View>
              </View>
            )}

            {securityDetail === 'devices' && (
              <View style={[styles.securityDetailCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <Text style={[styles.securityDetailCardTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Thiết bị đáng tin cậy: 1
                </Text>
                <View style={[styles.securityDeviceItem, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
                  <View style={styles.securityDeviceIcon}>
                    <Ionicons name="phone-portrait" size={22} color="#0284C7" />
                  </View>
                  <View style={styles.securityDeviceCopy}>
                    <Text style={[styles.securityDeviceName, isDarkMode && { color: '#F8FAFC' }]}>Thiết bị này</Text>
                    <Text style={[styles.securityDeviceMeta, isDarkMode && { color: '#94A3B8' }]}>Android App · Đang hoạt động</Text>
                    <Text style={[styles.securityDeviceMeta, isDarkMode && { color: '#94A3B8' }]}>Đăng nhập gần nhất: Hôm nay 20:41</Text>
                  </View>
                  <View style={styles.securityActiveBadge}>
                    <Text style={styles.securityActiveBadgeText}>Hiện tại</Text>
                  </View>
                </View>
                <Text style={[styles.securityDetailDescription, isDarkMode && { color: '#94A3B8' }]}>
                  Nếu bạn thấy bất kỳ thiết bị lạ nào đăng nhập vào hệ thống, hãy đổi mật khẩu ngay lập tức. Các thiết bị không hoạt động trong 3 tháng sẽ tự động bị ngắt kết nối.
                </Text>
              </View>
            )}

            {securityDetail === 'logins' && (
              <View style={[styles.securityDetailCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <Text style={[styles.securityDetailCardTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Lịch sử đăng nhập gần đây
                </Text>
                {['Hôm nay · 20:41', '09-14 · 21:20', '09-14 · 21:08', '09-12 · 00:07'].map((loginItem, idx) => (
                  <View
                    key={loginItem}
                    style={[
                      styles.securityLoginItem,
                      isDarkMode && { borderBottomColor: '#334155' },
                      idx === 3 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.securityTimelineDot} />
                    <View style={styles.securityDeviceCopy}>
                      <Text style={[styles.securityLoginName, isDarkMode && { color: '#F8FAFC' }]}>Đăng nhập ứng dụng</Text>
                      <Text style={[styles.securityDeviceMeta, isDarkMode && { color: '#94A3B8' }]}>Thiết bị chính · Thành công</Text>
                    </View>
                    <Text style={[styles.securityLoginTime, isDarkMode && { color: '#94A3B8' }]}>{loginItem}</Text>
                  </View>
                ))}
              </View>
            )}

            {securityDetail === 'question' && (
              <View style={[styles.securityDetailCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <View style={[styles.securityTileIconSquircle, { backgroundColor: '#EFF6FF', marginBottom: 16 }]}>
                  <Ionicons name="help-circle" size={24} color="#0284C7" />
                </View>
                <Text style={[styles.securityQuestionDetailTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  {selectedSecurityQuestion}
                </Text>
                <View style={[styles.securityFaqDivider, { marginVertical: 14, marginLeft: 0 }, isDarkMode && { backgroundColor: '#334155' }]} />
                <Text style={[styles.securityQuestionDetailDescription, isDarkMode && { color: '#CBD5E1' }]}>
                  {selectedSecurityQuestion === 'Mật khẩu mã hóa thiết bị là gì?'
                    ? 'Mật khẩu mã hóa thiết bị là một mật khẩu đối xứng được sử dụng để mã hóa luồng video camera và dữ liệu cảm biến của thiết bị, với giá trị mặc định theo mã xác thực thiết bị. Bạn nên thay đổi mật khẩu mặc định thành một mật khẩu an toàn sau khi liên kết thiết bị lần đầu tiên. Mật khẩu mã hóa là chìa khóa bảo mật được cung cấp bởi Smart Elderly Care AI. Hệ thống hoàn toàn không ghi lại hoặc lưu trữ mật khẩu mã hóa trên máy chủ trung tâm. Mật khẩu chỉ được mã hóa lưu trữ trực tiếp trên thiết bị giám sát và ứng dụng di động của bạn. Đội ngũ kỹ thuật Smart Elderly Care AI không có khả năng lấy lại, đặt lại hoặc khôi phục mật khẩu mã hóa nhằm đảm bảo quyền riêng tư tuyệt đối cho gia đình bạn.'
                    : selectedSecurityQuestion === 'Có ràng buộc một thiết bị an toàn không?'
                      ? 'Để kết nối một thiết bị vào hệ thống Smart Elderly Care AI, ba điều kiện sau phải được đáp ứng đồng thời:\n\n1. Biết mã định danh (Serial) và mã xác thực an toàn của thiết bị;\n\n2. Thiết bị giám sát đang trực tuyến;\n\n3. Thiết bị chưa bị ràng buộc bởi một tài khoản quản trị khác;\n\nNếu một thiết bị đã được kết nối bởi chủ hộ gia đình, người khác tuyệt đối không thể kết nối hoặc xem trộm ngay cả khi biết mã serial. Chỉ có tài khoản chủ hộ đã liên kết thiết bị mới có quyền chia sẻ hoặc hủy liên kết. Smart Elderly Care AI khuyến nghị bạn cấu hình bảo mật thiết bị ngay sau khi hoàn tất kết nối mạng.'
                      : selectedSecurityQuestion === 'Việc sử dụng mã xác minh qua tin nhắn SMS'
                        ? 'Mã xác minh SMS (OTP) là lớp bảo mật hai bước nâng cao được cung cấp bởi Smart Elderly Care AI, vượt trội hơn so với việc chỉ dùng mật khẩu thông thường. Khi người dùng thực hiện các thao tác nhạy cảm (như đăng nhập trên thiết bị mới, thay đổi cấu hình cảnh báo SOS khẩn cấp, chia sẻ quyền giám sát, v.v.), hệ thống sẽ gửi mã SMS OTP để xác thực danh tính chính chủ. Điều này giúp ngăn chặn tối đa nguy cơ tài khoản bị xâm nhập trái phép. Hãy lưu ý không bao giờ tiết lộ mã OTP cho bất kỳ ai.'
                        : 'Hệ thống Smart Elderly Care AI sử dụng nhiều lớp bảo vệ tài khoản, xác minh thiết bị và mã xác thực để hạn chế truy cập trái phép. Bạn nên bật xác minh hai bước và thường xuyên kiểm tra lịch sử đăng nhập.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isSecurityCenterVisible}
        animationType="slide"
        onRequestClose={() => setSecurityCenterVisible(false)}
      >
        <SafeAreaView style={[styles.securityScreen, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
          {/* Header Bar */}
          <View style={[styles.securityTopNav, isDarkMode && { backgroundColor: '#0F172A', borderBottomColor: '#1E293B' }]}>
            <TouchableOpacity
              style={[styles.securityNavBackButton, isDarkMode && { backgroundColor: '#1E293B' }]}
              onPress={() => setSecurityCenterVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
            </TouchableOpacity>
            <View style={styles.securityNavTitleBox}>
              <Text style={[styles.securityNavTitle, isDarkMode && { color: '#F8FAFC' }]}>Trung tâm bảo mật</Text>
              <Text style={styles.securityNavSubTitle}>Smart Elderly Care AI</Text>
            </View>
            <View style={styles.securityStatusPill}>
              <View style={styles.securityStatusDot} />
              <Text style={styles.securityStatusPillText}>An toàn</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.securityScrollContent}>
            {/* HERO SCORE CARD */}
            <View style={[styles.securityHeroModern, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <View style={styles.securityHeroLeft}>
                <View style={styles.securityBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#0284C7" />
                  <Text style={styles.securityBadgeText}>MỨC ĐỘ BẢO VỆ: TỐT</Text>
                </View>
                <Text style={[styles.securityHeroScoreTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  96<Text style={styles.securityHeroScoreSub}>/100</Text>
                </Text>
                <Text style={[styles.securityHeroDesc, isDarkMode && { color: '#94A3B8' }]}>
                  Hệ thống bảo vệ tài khoản và thiết bị giám sát người cao tuổi đang hoạt động an toàn.
                </Text>
                <TouchableOpacity
                  style={styles.securityActionPill}
                  activeOpacity={0.8}
                  onPress={() => openSecurityDetail('twoFactor')}
                >
                  <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                  <Text style={styles.securityActionPillText}>Cải thiện ngay (2 mục)</Text>
                  <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.securityHeroRight}>
                <View style={styles.securityShieldOuter}>
                  <View style={styles.securityShieldInner}>
                    <Ionicons name="shield-checkmark" size={50} color="#0284C7" />
                  </View>
                </View>
              </View>
            </View>

            {/* QUICK STATS ROW */}
            <View style={[styles.securityStatsRow, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <View style={styles.securityStatItem}>
                <View style={[styles.securityStatIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="key-outline" size={18} color="#2563EB" />
                </View>
                <Text style={[styles.securityStatLabel, isDarkMode && { color: '#94A3B8' }]}>Mật khẩu</Text>
                <Text style={styles.securityStatValueSuccess}>Độ mạnh cao</Text>
              </View>
              <View style={[styles.securityStatDivider, isDarkMode && { backgroundColor: '#334155' }]} />
              <View style={styles.securityStatItem}>
                <View style={[styles.securityStatIconBadge, { backgroundColor: twoFactorEnabled ? '#ECFDF5' : '#FFFBEB' }]}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={twoFactorEnabled ? '#059669' : '#D97706'}
                  />
                </View>
                <Text style={[styles.securityStatLabel, isDarkMode && { color: '#94A3B8' }]}>Xác thực 2FA</Text>
                <Text style={twoFactorEnabled ? styles.securityStatValueSuccess : styles.securityStatValueWarning}>
                  {twoFactorEnabled ? 'Đã bật' : 'Chưa bật'}
                </Text>
              </View>
              <View style={[styles.securityStatDivider, isDarkMode && { backgroundColor: '#334155' }]} />
              <View style={styles.securityStatItem}>
                <View style={[styles.securityStatIconBadge, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={[styles.securityStatLabel, isDarkMode && { color: '#94A3B8' }]}>Thiết bị</Text>
                <Text style={styles.securityStatValueSuccess}>1 tin cậy</Text>
              </View>
            </View>

            {/* 4 ACCOUNT SECURITY TILES */}
            <View style={styles.securitySectionHeaderBox}>
              <Text style={[styles.securitySectionHeaderTitle, isDarkMode && { color: '#F8FAFC' }]}>
                Bảo mật tài khoản
              </Text>
              <Text style={styles.securitySectionHeaderBadge}>4 thiết lập</Text>
            </View>

            <View style={styles.securityGridModern}>
              {/* Tile 1: Đổi mật khẩu */}
              <TouchableOpacity
                style={[styles.securityCardTile, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => {
                  setReturnToSecurityAfterPassword(true);
                  setSecurityCenterVisible(false);
                  setChangePasswordVisible(true);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.securityTileHeader}>
                  <View style={[styles.securityTileIconSquircle, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="key" size={22} color="#2563EB" />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                </View>
                <Text style={[styles.securityTileModernTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Đổi mật khẩu
                </Text>
                <Text style={[styles.securityTileModernSub, isDarkMode && { color: '#94A3B8' }]}>
                  Cập nhật định kỳ
                </Text>
                <View style={styles.securityTileTag}>
                  <View style={styles.securityDotGreen} />
                  <Text style={styles.securityTagTextGreen}>Bảo vệ tốt</Text>
                </View>
              </TouchableOpacity>

              {/* Tile 2: Xác minh 2 bước */}
              <TouchableOpacity
                style={[styles.securityCardTile, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => openSecurityDetail('twoFactor')}
                activeOpacity={0.75}
              >
                <View style={styles.securityTileHeader}>
                  <View style={[styles.securityTileIconSquircle, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="shield-checkmark" size={22} color="#059669" />
                  </View>
                  <Switch
                    value={twoFactorEnabled}
                    onValueChange={setTwoFactorEnabled}
                    trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
                    thumbColor={twoFactorEnabled ? '#0284C7' : '#FFFFFF'}
                    style={{ transform: [{ scale: 0.8 }] }}
                  />
                </View>
                <Text style={[styles.securityTileModernTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Xác minh 2 bước
                </Text>
                <Text style={[styles.securityTileModernSub, isDarkMode && { color: '#94A3B8' }]}>
                  {twoFactorEnabled ? 'Đang bật qua SMS' : 'Chưa kích hoạt'}
                </Text>
                <View style={styles.securityTileTag}>
                  <View style={twoFactorEnabled ? styles.securityDotGreen : styles.securityDotOrange} />
                  <Text style={twoFactorEnabled ? styles.securityTagTextGreen : styles.securityTagTextOrange}>
                    {twoFactorEnabled ? 'Đã bật SMS' : 'Khuyên dùng'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Tile 3: Quản lý thiết bị */}
              <TouchableOpacity
                style={[styles.securityCardTile, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => openSecurityDetail('devices')}
                activeOpacity={0.75}
              >
                <View style={styles.securityTileHeader}>
                  <View style={[styles.securityTileIconSquircle, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="phone-portrait" size={22} color="#7C3AED" />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                </View>
                <Text style={[styles.securityTileModernTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Quản lý đầu cuối
                </Text>
                <Text style={[styles.securityTileModernSub, isDarkMode && { color: '#94A3B8' }]}>
                  1 thiết bị tin cậy
                </Text>
                <View style={styles.securityTileTag}>
                  <View style={styles.securityDotGreen} />
                  <Text style={styles.securityTagTextGreen}>Android · Hiện tại</Text>
                </View>
              </TouchableOpacity>

              {/* Tile 4: Lịch sử đăng nhập */}
              <TouchableOpacity
                style={[styles.securityCardTile, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                onPress={() => openSecurityDetail('logins')}
                activeOpacity={0.75}
              >
                <View style={styles.securityTileHeader}>
                  <View style={[styles.securityTileIconSquircle, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="time" size={22} color="#D97706" />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                </View>
                <Text style={[styles.securityTileModernTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Nhật ký đăng nhập
                </Text>
                <Text style={[styles.securityTileModernSub, isDarkMode && { color: '#94A3B8' }]}>
                  Xem các phiên truy cập
                </Text>
                <View style={styles.securityTileTag}>
                  <View style={styles.securityDotBlue} />
                  <Text style={styles.securityTagTextBlue}>4 phiên gần đây</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* AI CARE ADVISORY CARD */}
            <View style={[styles.securityAdvisoryCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <View style={styles.securityAdvisoryIconBox}>
                <Ionicons name="bulb-outline" size={24} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.securityAdvisoryTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  Mẹo an toàn từ Trợ lý Care AI
                </Text>
                <Text style={[styles.securityAdvisoryText, isDarkMode && { color: '#94A3B8' }]}>
                  Không chia sẻ mật khẩu hay mã OTP SMS cho người khác. Hãy luôn bật xác thực hai bước để bảo vệ hình ảnh camera và dữ liệu sức khỏe của gia đình.
                </Text>
              </View>
            </View>

            {/* FAQ SECTION */}
            <View style={[styles.securityFaqCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <View style={styles.securityFaqHeader}>
                <View style={styles.securityFaqHeaderLeft}>
                  <Ionicons name="help-circle-outline" size={22} color={Colors.primary} />
                  <Text style={[styles.securityFaqHeaderTitle, isDarkMode && { color: '#F8FAFC' }]}>
                    Bạn cũng có thể hỏi
                  </Text>
                </View>
                <Text style={styles.securityFaqCount}>4 câu hỏi</Text>
              </View>

              {[
                { q: 'Mật khẩu mã hóa thiết bị là gì?', icon: 'lock-closed-outline' },
                { q: 'Có ràng buộc một thiết bị an toàn không?', icon: 'link-outline' },
                { q: 'Bảo vệ quyền riêng tư của người dùng', icon: 'shield-outline' },
                { q: 'Việc sử dụng mã xác minh qua tin nhắn SMS', icon: 'chatbox-ellipses-outline' },
              ].map((item, index) => (
                <React.Fragment key={item.q}>
                  {index > 0 && (
                    <View style={[styles.securityFaqDivider, isDarkMode && { backgroundColor: '#334155' }]} />
                  )}
                  <TouchableOpacity
                    style={styles.securityFaqRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedSecurityQuestion(item.q);
                      openSecurityDetail('question');
                    }}
                  >
                    <View style={[styles.securityFaqIconBox, isDarkMode && { backgroundColor: '#0F172A' }]}>
                      <Ionicons name={item.icon as any} size={18} color="#0284C7" />
                    </View>
                    <Text style={[styles.securityFaqQuestionText, isDarkMode && { color: '#E2E8F0' }]}>
                      {item.q}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Màn hình chính Menu / Cá nhân */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isDarkMode && { backgroundColor: colors.background }]}
      >
        {/* HEADER: TITLE "Menu" & CÀI ĐẶT NHANH */}
        <View style={styles.fbHeaderRow}>
          <Text style={[styles.fbHeaderTitle, isDarkMode && { color: colors.textPrimary }]}>Menu</Text>
          <View style={styles.fbHeaderActionIcons}>
            <TouchableOpacity
              style={[styles.fbHeaderCircleBtn, isDarkMode && { backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={20} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fbHeaderCircleBtn, isDarkMode && { backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-sharp" size={20} color={isDarkMode ? colors.textPrimary : '#1E293B'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* THẺ THÔNG TIN TÀI KHOẢN NGƯỜI GIÁM SÁT */}
        <View style={[styles.fbProfileCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
              <Text style={[styles.fbProfileName, isDarkMode && { color: colors.textPrimary }]}>
                {resolvedDisplayName}
              </Text>
            </View>
            <View style={styles.fbProfileRightBadge}>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </View>
          </TouchableOpacity>

          <View style={[styles.fbCardDivider, isDarkMode && { backgroundColor: colors.border }]} />

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

        {/* LƯỚI TÍNH NĂNG CHÍNH CỦA HỆ THỐNG */}
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
              Bệnh nền, nhóm máu & đơn thuốc
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
              Thành viên: {house.membersCount || 1} • Quản lý phòng
            </Text>
          </TouchableOpacity>

          {/* Ô 4: Thiết bị kết nối */}
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

          {/* Ô 5: Cấu hình AI & Ngưỡng cảnh báo */}
          <TouchableOpacity
            style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AlgoConfig')}
          >
            <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? '#3B1D54' : '#F5F3FF' }]}>
              <Ionicons name="color-wand-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Cấu hình AI
            </Text>
            <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>
              Độ nhạy té ngã, ngưỡng nhịp tim & SpO2
            </Text>
          </TouchableOpacity>

          {/* Ô 6: Báo cáo sức khỏe */}
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

          {/* Ô 7: Lịch nhắc thuốc */}
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

          {/* Ô 8: Nhật ký cảnh báo */}
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

          {/* HIỂN THỊ THÊM */}
          {showMoreGrid && (
            <>
              {/* Ô 9: Trợ lý Bác sĩ AI */}
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

              {/* Ô 10: Multi-View Camera */}
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


            </>
          )}
        </View>

        {/* NÚT XEM THÊM / THU GỌN */}
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

        {/* ACCORDION 1: TRỢ GIÚP VÀ HỖ TRỢ */}
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

              {/* Dịch vụ CSKH 24/7 */}
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

              {/* Hướng dẫn sử dụng & Giới thiệu đồ án */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AppInfo')}
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

        {/* ACCORDION 2: CÀI ĐẶT VÀ QUYỀN RIÊNG TƯ */}
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

              {/* Trung tâm bảo mật */}
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => setSecurityCenterVisible(true)}
              >
                <View style={[styles.fbSubIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>
                    Trung tâm bảo mật
                  </Text>
                  <Text style={styles.fbSubRowSub}>Xác thực 2 bước, quản lý thiết bị & đăng nhập</Text>
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

        {/* NÚT ĐĂNG XUẤT */}
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...Shadows.soft,
  },
  userMenuBackButton: {
    marginLeft: -20,
  },
  userMenuSheet: {
    position: 'relative',
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 26,
    paddingTop: 10,
    paddingBottom: 28,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  infoRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
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

  // Name Editor
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

  // Avatar Picker
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
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
  },

  // Change Password
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

  // Customer Support Dialog
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

  // Logout Confirm Modal
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

  // Header
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
    padding: 4,
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

  // Settings Sub-Modals (Thông báo, Cỡ chữ, Vẻ bề ngoài)
  settingsOverlay: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'flex-start',
  },
  settingsSheet: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
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
  settingsBackButton: {
    position: 'absolute',
    left: 0,
    top: 0,
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
  appearanceOverlay: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'flex-start',
  },
  appearanceSheet: {
    width: '100%',
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 12,
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
  // --- MODERN SECURITY CENTER STYLES ---
  securityScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  securityTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  securityNavBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityNavTitleBox: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  securityNavTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityNavSubTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
    marginTop: 1,
  },
  securityStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  securityStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  securityStatusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  securityScrollContent: {
    paddingBottom: 40,
  },
  securityHeroModern: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  securityHeroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    gap: 5,
  },
  securityBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  securityHeroScoreTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 36,
  },
  securityHeroScoreSub: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  securityHeroDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 12,
  },
  securityActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0284C7',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    ...Shadows.soft,
  },
  securityActionPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  securityHeroRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityShieldOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  securityShieldInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  securityStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  securityStatIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  securityStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  securityStatValueSuccess: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  securityStatValueWarning: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  securityStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#F1F5F9',
  },
  securitySectionHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 12,
  },
  securitySectionHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  securitySectionHeaderBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  securityGridModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    rowGap: 12,
  },
  securityCardTile: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
    minHeight: 140,
    ...Shadows.card,
  },
  securityTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  securityTileIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTileModernTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  securityTileModernSub: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 10,
  },
  securityTileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
  },
  securityDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  securityDotOrange: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  securityDotBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  securityTagTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  securityTagTextOrange: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  securityTagTextBlue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  securityAdvisoryCard: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  securityAdvisoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  securityAdvisoryTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0369A1',
    marginBottom: 3,
  },
  securityAdvisoryText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
  },
  securityFaqCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    ...Shadows.card,
  },
  securityFaqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  securityFaqHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityFaqHeaderTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityFaqCount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  securityFaqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  securityFaqIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityFaqQuestionText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 19,
  },
  securityFaqDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 46,
  },
  securityDetailScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  securityDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  securityDetailTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
  },
  securityDetailContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 36,
  },
  securityDetailHeroBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  securityDetailCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  securityDetailRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  securityDetailCardTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityDetailSubText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  securityDetailDescription: {
    fontSize: 13.5,
    lineHeight: 22,
    color: '#475569',
    marginTop: 10,
  },
  securityInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 10,
  },
  securityInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#0369A1',
    fontWeight: '600',
  },
  securityDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  securityDeviceIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  securityDeviceCopy: {
    flex: 1,
    marginHorizontal: 12,
  },
  securityDeviceName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityDeviceMeta: {
    marginTop: 2,
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  securityActiveBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  securityActiveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  securityLoginItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  securityTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284C7',
    marginRight: 12,
  },
  securityLoginName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  securityLoginTime: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
  },
  securityQuestionDetailTitle: {
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityQuestionDetailDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: '#334155',
  },
});

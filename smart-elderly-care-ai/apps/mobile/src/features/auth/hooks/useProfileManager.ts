import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../../store/useAuthStore';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { LocalizedAlert as Alert } from '../../../i18n/LocalizedComponents';
import api, { usersApi, BASE_URL } from '../../../services/api';
import {
  launchEmergencyCall,
  launchSupportCall,
  SUPPORT_HOTLINE_NUMBER,
} from '../../../services/emergency';

export const resolveAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const hostOrigin = BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${hostOrigin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
};

export const FONT_SCALE_LEVELS = [0.85, 1, 1.15, 1.3, 1.5];

export function useProfileManager(navigation: any, route: any) {
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
    setFontScale,
    fontSizeMode: storeFontSizeMode,
    setFontSizeMode: setStoreFontSizeMode,
  } = useTheme();

  const [profileName, setProfileName] = useState(full_name || userName || '');
  const [profilePhone, setProfilePhone] = useState(phone_number || userPhone || '');
  const [showMoreGrid, setShowMoreGrid] = useState(false);
  const [isHelpExpanded, setIsHelpExpanded] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  // Modal Visibility States
  const [isUserMenuVisible, setUserMenuVisible] = useState(false);
  const [isAvatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [isLogoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [isChangePasswordVisible, setChangePasswordVisible] = useState(false);
  const [isCustomerSupportVisible, setCustomerSupportVisible] = useState(false);
  const [isSecurityCenterVisible, setSecurityCenterVisible] = useState(false);
  const [isFontSizeVisible, setFontSizeVisible] = useState(false);
  const [isNotificationSettingsVisible, setNotificationSettingsVisible] = useState(false);
  const [isAppearanceVisible, setAppearanceVisible] = useState(false);

  // Settings States
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(true);
  const [criticalAlertEnabled, setCriticalAlertEnabled] = useState(true);
  const [fontSizeMode, setFontSizeMode] = useState<'system' | 'custom'>(
    storeFontSizeMode || 'system',
  );
  const [customFontScale, setCustomFontScale] = useState(1);
  const [avatarUri, setAvatarUri] = useState<string | null>(() => {
    const raw = avatarUrl || avatar_url;
    if (raw && !raw.startsWith('blob:')) {
      return resolveAvatarUrl(raw);
    }
    return null;
  });

  useEffect(() => {
    if (full_name || userName) {
      setProfileName(full_name || userName || '');
    }
    if (phone_number || userPhone) {
      setProfilePhone(phone_number || userPhone || '');
    }
  }, [userName, full_name, userPhone, phone_number]);

  useEffect(() => {
    const raw = avatarUrl || avatar_url;
    if (raw && !raw.startsWith('blob:')) {
      setAvatarUri(resolveAvatarUrl(raw));
    }
  }, [avatarUrl, avatar_url]);

  useEffect(() => {
    if (route?.params?.openUserMenu) {
      setUserMenuVisible(true);
      navigation?.setParams?.({ openUserMenu: undefined });
    }
  }, [route?.params?.openUserMenu, navigation]);

  useEffect(() => {
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
          if (
            Number.isInteger(res.data.custom_font_scale) &&
            res.data.custom_font_scale >= 0 &&
            res.data.custom_font_scale <= 4
          ) {
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

  const performLogout = async () => {
    setLogoutConfirmVisible(false);
    setUserMenuVisible(false);
    logout();
    await useAuthStore.persist.clearStorage();

    if (Platform.OS !== 'web') {
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const handleSaveName = async (newName: string): Promise<boolean> => {
    try {
      const res = await usersApi.updateMe({ full_name: newName });
      const savedName =
        typeof res?.data?.full_name === 'string' && res.data.full_name.trim()
          ? res.data.full_name.trim()
          : newName;
      const resolvedId = String(
        res?.data?.id || res?.data?.user_id || userId || 'demo-user-001',
      );

      setProfileName(savedName);
      updateUserName(resolvedId, savedName);
      setProfile({
        user_id: res?.data?.id || res?.data?.user_id || userId || undefined,
        full_name: savedName,
      });
      return true;
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Không thể lưu tên vào cơ sở dữ liệu. Vui lòng thử lại.';
      throw new Error(
        typeof detail === 'string' ? detail : 'Không thể lưu tên vào cơ sở dữ liệu.',
      );
    }
  };

  const handleSavePhone = async (newPhone: string, otpCode: string): Promise<boolean> => {
    try {
      const res = await usersApi.updateMe({ phone: newPhone, otp_code: otpCode });
      const savedPhone =
        typeof res?.data?.phone === 'string' && res.data.phone.trim()
          ? res.data.phone.trim()
          : newPhone;

      setProfilePhone(savedPhone);
      setProfile({
        user_id: res?.data?.id || res?.data?.user_id || userId || undefined,
        phone_number: savedPhone,
      });
      return true;
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Không thể cập nhật số điện thoại. Vui lòng thử lại.';
      throw new Error(
        typeof detail === 'string' ? detail : 'Không thể cập nhật số điện thoại.',
      );
    }
  };

  const handleChangePassword = async (
    currPass: string,
    newPass: string,
    confPass: string,
  ): Promise<boolean> => {
    await usersApi.changePassword({
      current_password: currPass,
      new_password: newPass,
      confirm_new_password: confPass,
    });
    return true;
  };

  const convertAssetToDataUri = async (
    asset: ImagePicker.ImagePickerAsset,
  ): Promise<string> => {
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
      const dataUri = await convertAssetToDataUri(asset);
      setAvatarUri(dataUri);
      setAvatar(dataUri);

      let uploadRes;
      try {
        uploadRes = await usersApi.uploadAvatarBase64(dataUri);
      } catch (uploadErr) {
        console.warn(
          '[ProfileScreen] uploadAvatarBase64 error, attempting updateMe fallback:',
          uploadErr,
        );
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
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Quyền bị từ chối',
          'Bạn cần cho phép truy cập máy ảnh để chụp ảnh.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: Platform.OS !== 'web',
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        void handleSaveAvatar(result.assets[0]);
      }
    } catch (err: any) {
      console.warn('[ProfileScreen] pickAvatarFromCamera error:', err);
      Alert.alert('Lỗi', 'Không thể mở máy ảnh. Vui lòng thử lại.');
    }
  };

  const pickAvatarFromLibrary = async () => {
    setAvatarPickerVisible(false);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Quyền bị từ chối',
            'Bạn cần cho phép truy cập thư viện ảnh để chọn ảnh.',
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: Platform.OS !== 'web',
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        void handleSaveAvatar(result.assets[0]);
      }
    } catch (err: any) {
      console.warn('[ProfileScreen] pickAvatarFromLibrary error:', err);
      Alert.alert('Lỗi', 'Không thể mở thư viện ảnh. Vui lòng thử lại.');
    }
  };

  const handleAvatarPress = async () => {
    if (Platform.OS === 'web') {
      await pickAvatarFromLibrary();
      return;
    }

    Alert.alert(
      'Thay đổi ảnh đại diện',
      'Chọn phương thức chụp hoặc tải ảnh:',
      [
        {
          text: 'Chụp ảnh mới',
          onPress: () => void pickAvatarFromCamera(),
        },
        {
          text: 'Chọn từ Thư viện',
          onPress: () => void pickAvatarFromLibrary(),
        },
        {
          text: 'Hủy',
          style: 'cancel',
        },
      ]
    );
  };

  const saveFontPreferences = useCallback(
    async (mode: 'system' | 'custom', scale: number) => {
      try {
        await usersApi.updateFontPreferences(mode, scale);
      } catch (err) {
        console.warn('[ProfileScreen] Could not save font-size preferences:', err);
      }
    },
    [],
  );

  const applyFontScaleMode = (mode: 'system' | 'custom') => {
    setFontSizeMode(mode);
    setStoreFontSizeMode(mode);
    setFontScale(mode === 'custom' ? FONT_SCALE_LEVELS[customFontScale] : 1);
    void saveFontPreferences(mode, customFontScale);
  };

  const handleUpdateFontScale = (scaleIndex: number) => {
    setCustomFontScale(scaleIndex);
    setFontScale(FONT_SCALE_LEVELS[scaleIndex]);
    void saveFontPreferences('custom', scaleIndex);
  };

  const handleToggleNotification = async (
    key:
      | 'notifications_enabled'
      | 'alert_sound_enabled'
      | 'critical_alert_enabled',
    value: boolean,
  ) => {
    if (key === 'notifications_enabled') setNotificationsEnabled(value);
    if (key === 'alert_sound_enabled') setAlertSoundEnabled(value);
    if (key === 'critical_alert_enabled') setCriticalAlertEnabled(value);

    try {
      await usersApi.updateNotificationPreferences({ [key]: value });
    } catch (err) {
      console.warn('[ProfileScreen] Không thể lưu cài đặt thông báo:', err);
    }
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
      Alert.alert(
        'Không thể mở cuộc gọi',
        `Vui lòng gọi tổng đài hỗ trợ ${SUPPORT_HOTLINE_NUMBER} trực tiếp.`,
      );
    }
  };

  const resolvedDisplayName =
    profileName || full_name || userName || 'Người giám sát';

  return {
    isDarkMode,
    colors,
    setDarkMode,
    house,
    resolvedDisplayName,
    profilePhone,
    avatarUri,
    showMoreGrid,
    setShowMoreGrid,
    isHelpExpanded,
    setIsHelpExpanded,
    isSettingsExpanded,
    setIsSettingsExpanded,
    isUserMenuVisible,
    setUserMenuVisible,
    isAvatarPickerVisible,
    setAvatarPickerVisible,
    isLogoutConfirmVisible,
    setLogoutConfirmVisible,
    isChangePasswordVisible,
    setChangePasswordVisible,
    isCustomerSupportVisible,
    setCustomerSupportVisible,
    isSecurityCenterVisible,
    setSecurityCenterVisible,
    isFontSizeVisible,
    setFontSizeVisible,
    isNotificationSettingsVisible,
    setNotificationSettingsVisible,
    isAppearanceVisible,
    setAppearanceVisible,
    fontSizeMode,
    customFontScale,
    notificationsEnabled,
    alertSoundEnabled,
    criticalAlertEnabled,
    toggleViewRole,
    performLogout,
    handleSaveName,
    handleSavePhone,
    handleChangePassword,
    handleAvatarPress,
    handleAvatarPress,
    pickAvatarFromCamera,
    pickAvatarFromLibrary,
    applyFontScaleMode,
    handleUpdateFontScale,
    handleToggleNotification,
    callEmergencyService,
    callCustomerSupportService,
  };
}


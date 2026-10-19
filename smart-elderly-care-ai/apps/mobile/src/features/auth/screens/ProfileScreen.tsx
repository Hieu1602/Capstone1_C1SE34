// ==============================================================================
// TỆP: ProfileScreen.tsx
// PHÂN HỆ: Màn hình Cá nhân, Tiện ích Mở rộng & Cài đặt Hệ thống
// MÔ TẢ CHỨC NĂNG:
//   1. Quản lý thông tin tài khoản người dùng (Tên, SĐT, Vai trò, Ảnh đại diện, Đổi mật khẩu).
//   2. Lối tắt nhanh & Lưới tính năng 2 cột điều hướng tới Bệnh án, Nhà của tôi, Thiết bị, AI, Báo cáo.
//   3. Cài đặt hệ thống: Ngôn ngữ (Việt/Anh), Giao diện (Sáng/Tối), Cỡ chữ trợ năng, Rung & Thông báo.
//   4. Định vị địa lý (OpenStreetMap), Trung tâm bảo mật 2FA và Hỗ trợ khẩn cấp 115.
// ==============================================================================

import React from 'react';
import * as Location from 'expo-location';
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
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Shadows } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import i18n from '../../../i18n/config';
import {
  LocalizedAlert as Alert,
  LocalizedText,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from '../../../i18n/LocalizedComponents';
import api, { usersApi } from '../../../services/api';

const FONT_SCALE_LEVELS = [0.8, 1, 1.2, 1.5, 1.8] as const;

const SECURITY_FAQ: Record<string, string> = {
  'Mật khẩu mã hóa thiết bị là gì?':
    'Mật khẩu mã hóa thiết bị là một mật khẩu đối xứng được sử dụng để mã hóa luồng video và hình ảnh của thiết bị, với giá trị mặc định giống với mã xác minh thiết bị. Đề nghị thay đổi mật khẩu mặc định thành một mật khẩu an toàn sau khi liên kết thiết bị lần đầu tiên.',
  'Có ràng buộc một thiết bị an toàn không?':
    'Để kết nối một thiết bị, ba điều kiện sau phải được đáp ứng đồng thời:\n\n1. Biết số serial của thiết bị và mã xác thực tương ứng;\n2. Thiết bị đang trực tuyến;\n3. Thiết bị chưa được ràng buộc bởi tài khoản khác.\n\nChỉ tài khoản chủ sở hữu đã liên kết thiết bị mới có quyền hủy kết nối.',
  'Việc sử dụng mã xác minh qua tin nhắn SMS':
    'Mã xác minh SMS là lớp bảo mật bổ sung ngoài tên người dùng và mật khẩu. Khi thực hiện các thao tác nhạy cảm (như đăng nhập trên thiết bị mới hoặc đổi mật khẩu), hệ thống yêu cầu mã OTP qua SMS để bảo vệ tài khoản.',
};

function formatAddress(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .filter((part) => {
      const key = part.trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

async function reverseGeocodeWithOpenStreetMap(latitude: number, longitude: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': i18n.language === 'en' ? 'en' : 'vi',
      lat: String(latitude),
      lon: String(longitude),
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OSM reverse geocoding failed: ${response.status}`);

    const result = await response.json();
    const address = result?.address;
    if (!address) return '';

    const street = address.road || address.pedestrian;
    const streetAddress = street ? [street, address.house_number].filter(Boolean).join(' ') : undefined;
    return formatAddress([
      streetAddress,
      address.quarter,
      address.neighbourhood,
      address.hamlet,
      address.isolated_dwelling,
      address.residential,
      address.suburb,
      address.city_district,
      address.district,
      address.city || address.town || address.village || address.municipality,
      address.state_district,
      address.county,
      address.state,
      address.country,
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export default function ProfileScreen({ navigation }: any) {
  const { userId, userName, full_name, userPhone, phone_number, role, logout, updateUserName, toggleViewRole, setProfile } =
    useAuthStore();
  const { house, patientRecord, incidents } = useVitalStore();
  const { isDarkMode, colors, setDarkMode, setFontScale, fontSizeMode, setFontSizeMode } = useTheme();

  // Dữ liệu người dùng thực tế từ Store & API (không dùng dữ liệu mẫu)
  const [profileName, setProfileName] = React.useState(full_name || userName || '--');
  const [profilePhone, setProfilePhone] = React.useState(phone_number || userPhone || '--');
  const [profileRole, setProfileRole] = React.useState(role || '--');
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);

  // Trạng thái mở rộng UI trên màn hình chính
  const [showMoreGrid, setShowMoreGrid] = React.useState(false);
  const [isHelpExpanded, setIsHelpExpanded] = React.useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = React.useState(false);

  // Trạng thái các Modal chức năng
  const [editingField, setEditingField] = React.useState<'name' | null>(null);
  const [draftValue, setDraftValue] = React.useState('');
  const [isUserMenuVisible, setUserMenuVisible] = React.useState(false);
  const [isAvatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [isLogoutConfirmVisible, setLogoutConfirmVisible] = React.useState(false);
  const [isCustomerSupportVisible, setCustomerSupportVisible] = React.useState(false);

  // Định vị địa lý
  const [isLocationVisible, setLocationVisible] = React.useState(false);
  const [locationAddress, setLocationAddress] = React.useState('');
  const [locationCoords, setLocationCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocationLoading, setLocationLoading] = React.useState(false);

  // Cài đặt & Trợ năng
  const [isSettingsVisible, setSettingsVisible] = React.useState(false);
  const [accountEntrySource, setAccountEntrySource] = React.useState<'main' | 'settings'>('main');
  const [isNotificationSettingsVisible, setNotificationSettingsVisible] = React.useState(false);
  const [isVibrationDetailVisible, setVibrationDetailVisible] = React.useState(false);
  const [isAboutInfoVisible, setAboutInfoVisible] = React.useState(false);
  const [infoDetail, setInfoDetail] = React.useState<'terms' | 'app' | null>(null);
  const [isGeneralSettingsVisible, setGeneralSettingsVisible] = React.useState(false);
  const [isLanguageVisible, setLanguageVisible] = React.useState(false);
  const [languageMode, setLanguageMode] = React.useState<'vi' | 'en'>(i18n.language === 'en' ? 'en' : 'vi');
  const [customFontScale, setCustomFontScale] = React.useState(2);
  const [isAccessibilityVisible, setAccessibilityVisible] = React.useState(false);
  const [isFontSizeVisible, setFontSizeVisible] = React.useState(false);
  const [isAppearanceVisible, setAppearanceVisible] = React.useState(false);
  const [appearanceMode, setAppearanceMode] = React.useState<'light' | 'dark'>(isDarkMode ? 'dark' : 'light');
  const [highContrastEnabled, setHighContrastEnabled] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [alertSoundEnabled, setAlertSoundEnabled] = React.useState(true);
  const [vibrationEnabled, setVibrationEnabled] = React.useState(true);
  const [criticalAlertEnabled, setCriticalAlertEnabled] = React.useState(true);

  // Đổi mật khẩu & Bảo mật
  const [isChangePasswordVisible, setChangePasswordVisible] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordChangeFeedback, setPasswordChangeFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isSecurityCenterVisible, setSecurityCenterVisible] = React.useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [securityDetail, setSecurityDetail] = React.useState<'twoFactor' | 'devices' | 'logins' | 'question' | null>(null);
  const [selectedSecurityQuestion, setSelectedSecurityQuestion] = React.useState('');
  const [returnToSecurityAfterPassword, setReturnToSecurityAfterPassword] = React.useState(false);

  // Thanh trượt cỡ chữ
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const sliderTrackPosition = React.useRef(0);

  // Đồng bộ ngôn ngữ, cỡ chữ và thông tin tài khoản từ Backend
  React.useEffect(() => {
    if (i18n.language === 'en' || i18n.language === 'vi') {
      setLanguageMode(i18n.language as 'vi' | 'en');
    }
    usersApi
      .getMe()
      .then((res: any) => {
        const data = res?.data;
        if (!data) return;
        const backendLang = data.preferred_language || data.language;
        if (backendLang === 'vi' || backendLang === 'en') {
          setLanguageMode(backendLang);
          if (i18n.language !== backendLang) {
            void i18n.changeLanguage(backendLang);
            void AsyncStorage.setItem('smartcare-user-language', backendLang);
          }
        }
        const backendFontScale = data.custom_font_scale;
        if (Number.isInteger(backendFontScale) && backendFontScale >= 0 && backendFontScale <= 4) {
          setCustomFontScale(backendFontScale);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    setAppearanceMode(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  React.useEffect(() => {
    if (isChangePasswordVisible) setPasswordChangeFeedback(null);
  }, [isChangePasswordVisible]);

  React.useEffect(() => {
    if (full_name || userName) setProfileName(full_name || userName || '--');
    if (phone_number || userPhone) setProfilePhone(phone_number || userPhone || '--');
    if (role) setProfileRole(role);

    const activePhone = phone_number || userPhone;
    api
      .get('/users/me', { params: activePhone ? { phone: activePhone } : undefined })
      .then((res) => {
        if (!res.data) return;
        if (res.data.full_name) setProfileName(res.data.full_name);
        if (res.data.phone_number || res.data.phone) setProfilePhone(res.data.phone_number || res.data.phone);
        if (res.data.role) setProfileRole(res.data.role);
        setProfile?.({
          user_id: res.data.user_id || res.data.id,
          full_name: res.data.full_name,
          phone_number: res.data.phone_number || res.data.phone,
          role: res.data.role,
          household_id: res.data.household_id,
        });
      })
      .catch(() => {});
  }, [userName, full_name, userPhone, phone_number, role]);

  const handleLanguageChange = async (lang: 'vi' | 'en') => {
    try {
      setLanguageMode(lang);
      await i18n.changeLanguage(lang);
      await AsyncStorage.setItem('smartcare-user-language', lang);
      setLanguageVisible(false);
      try {
        await usersApi.updateLanguage(lang);
      } catch {
        await usersApi.updateMe({ preferred_language: lang, language: lang });
      }
    } catch (err) {
      console.warn('[ProfileScreen] Error changing language:', err);
      setLanguageVisible(false);
    }
  };

  const saveFontPreferences = React.useCallback(async (mode: 'system' | 'custom', scale: number) => {
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
        onPanResponderGrant: (_, g) => updateFontScaleFromPosition(g.x0 - sliderTrackPosition.current),
        onPanResponderMove: (_, g) => updateFontScaleFromPosition(g.moveX - sliderTrackPosition.current),
        onPanResponderRelease: (_, g) => {
          if (sliderWidth <= 0) return;
          const rawRatio = Math.min(Math.max((g.moveX - sliderTrackPosition.current) / sliderWidth, 0), 1);
          const nextScale = Math.round(rawRatio * 4);
          setCustomFontScale(nextScale);
          setFontScale(FONT_SCALE_LEVELS[nextScale]);
          void saveFontPreferences('custom', nextScale);
        },
      }),
    [saveFontPreferences, setFontScale, sliderWidth, updateFontScaleFromPosition]
  );

  const openSecurityDetail = (detail: 'twoFactor' | 'devices' | 'logins' | 'question') => {
    setSecurityCenterVisible(false);
    setTimeout(() => setSecurityDetail(detail), 220);
  };

  const closeChangePassword = () => {
    setChangePasswordVisible(false);
    if (returnToSecurityAfterPassword) {
      setReturnToSecurityAfterPassword(false);
      setSecurityCenterVisible(true);
    }
  };

  const handleVibrationToggle = (value: boolean) => {
    setVibrationEnabled(value);
    if (value) Vibration.vibrate(80);
    else Vibration.cancel();
  };

  const closeUserMenu = React.useCallback(() => {
    setUserMenuVisible(false);
    setSettingsVisible(accountEntrySource === 'settings');
  }, [accountEntrySource]);

  const performLogout = async () => {
    setLogoutConfirmVisible(false);
    logout();
    await useAuthStore.persist.clearStorage();
    setUserMenuVisible(false);
    if (Platform.OS !== 'web') {
      navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  const saveEditedField = () => {
    if (!editingField) return;
    const trimmed = draftValue.trim();
    if (!trimmed) {
      Alert.alert('Lỗi', 'Tên không được để trống.');
      return;
    }
    setProfileName(trimmed);
    if (userId) updateUserName(userId, trimmed);
    setEditingField(null);
    setDraftValue('');
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

  const pickAvatar = async (useCamera: boolean) => {
    setAvatarPickerVisible(false);
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Quyền bị từ chối',
        useCamera ? 'Bạn cần cho phép truy cập máy ảnh để chụp ảnh.' : 'Bạn cần cho phép truy cập thư viện ảnh để chọn ảnh.'
      );
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền bị từ chối', 'Bạn cần cho phép truy cập vị trí để sử dụng định vị địa lý.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      setLocationCoords({ latitude, longitude });
      let address = '';
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        const place = places[0];
        address = formatAddress([place?.street, place?.district, place?.subregion, place?.city, place?.region, place?.country]);
      } catch (error) {
        console.warn('[ProfileScreen] Device reverse geocoding failed:', error);
      }
      try {
        address = (await reverseGeocodeWithOpenStreetMap(latitude, longitude)) || address;
      } catch (error) {
        console.warn('[ProfileScreen] OpenStreetMap address lookup failed:', error);
      }
      setLocationAddress(address);
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

  const locationMapUrl = locationCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${locationCoords.longitude - 0.01}%2C${locationCoords.latitude - 0.01}%2C${locationCoords.longitude + 0.01}%2C${locationCoords.latitude + 0.01}&layer=mapnik&marker=${locationCoords.latitude}%2C${locationCoords.longitude}`
    : '';

  const unreadAlertsCount = incidents.filter((inc) => !inc.is_acknowledged).length;
  const elderlyDisplayName = patientRecord?.name || 'Hồ sơ bệnh án';

  // Danh sách lối tắt ngang
  const shortcuts = [
    {
      key: 'record',
      label: elderlyDisplayName,
      icon: 'heart',
      badgeColor: '#EF4444',
      thumbBg: '#FEE2E2',
      onPress: () => navigation.navigate('PatientMedicalRecord'),
    },
    {
      key: 'camera',
      label: 'Camera PK',
      icon: 'videocam',
      badgeColor: '#0284C7',
      thumbBg: '#E0F2FE',
      onPress: () => navigation.navigate('CameraDetail', { deviceId: 'SECA_001', name: 'Camera AI Phòng Khách' }),
    },
    {
      key: 'ble',
      label: 'Vòng tay BLE',
      icon: 'pulse',
      badgeColor: '#FF7A00',
      thumbBg: '#FFF7ED',
      onPress: () => navigation.navigate('SmartbandDetail'),
    },
    {
      key: 'meds',
      label: 'Nhắc thuốc',
      icon: 'medkit',
      badgeColor: '#10B981',
      thumbBg: '#ECFDF5',
      onPress: () => navigation.navigate('MedicationReminder'),
    },
    {
      key: 'report',
      label: 'Báo cáo y tế',
      icon: 'document-text',
      badgeColor: '#8B5CF6',
      thumbBg: '#F3E8FF',
      onPress: () => navigation.navigate('MedicalReport'),
    },
    {
      key: 'house',
      label: house.name || 'Nhà của tôi',
      icon: 'home',
      badgeColor: '#0EA5E9',
      thumbBg: '#EFF6FF',
      onPress: () => navigation.navigate('HouseDetail'),
    },
  ];

  // Danh sách ô tính năng 2 cột
  const primaryGridItems = [
    {
      key: 'supervisor',
      icon: 'person-circle-outline',
      iconColor: '#6366F1',
      bgLight: '#EEF2FF',
      bgDark: '#1E1B4B',
      title: 'Hồ sơ giám sát',
      sub: 'Tài khoản người thân & SĐT khẩn cấp',
      onPress: () => {
        setAccountEntrySource('main');
        setUserMenuVisible(true);
      },
    },
    {
      key: 'medicalRecord',
      icon: 'medkit-outline',
      iconColor: '#0EA5E9',
      bgLight: '#E0F2FE',
      bgDark: '#082F49',
      badge: 'AES-256',
      title: 'Hồ sơ bệnh án',
      sub: 'Thông tin bệnh nền, nhóm máu & đơn thuốc',
      onPress: () => navigation.navigate('PatientMedicalRecord'),
    },
    {
      key: 'house',
      icon: 'home-outline',
      iconColor: '#10B981',
      bgLight: '#ECFDF5',
      bgDark: '#064E3B',
      title: house.name || 'Nhà của tôi',
      sub: `Thành viên: ${house.membersCount || 0} • Quản lý phòng`,
      onPress: () => navigation.navigate('HouseDetail'),
    },
    {
      key: 'devices',
      icon: 'hardware-chip-outline',
      iconColor: '#FF7A00',
      bgLight: '#FFF7ED',
      bgDark: '#451A03',
      title: 'Thiết bị kết nối',
      sub: 'Camera AI, Vòng BLE & Cảm biến',
      onPress: () => navigation.navigate('Devices'),
    },
    {
      key: 'algo',
      icon: 'color-wand-outline',
      iconColor: '#8B5CF6',
      bgLight: '#F5F3FF',
      bgDark: '#3B1D54',
      title: 'Cấu hình AI & Ngưỡng',
      sub: 'Độ nhạy té ngã, ngưỡng nhịp tim & SpO2',
      onPress: () => navigation.navigate('AlgoConfig'),
    },
    {
      key: 'report',
      icon: 'document-text-outline',
      iconColor: '#2563EB',
      bgLight: '#EFF6FF',
      bgDark: '#1E293B',
      title: 'Báo cáo sức khỏe',
      sub: 'Xuất file PDF & Excel gửi bác sĩ',
      onPress: () => navigation.navigate('MedicalReport'),
    },
    {
      key: 'location',
      icon: 'location-outline',
      iconColor: '#F43F5E',
      bgLight: '#FFF1F2',
      bgDark: '#4C0519',
      title: 'Định vị & Vùng an toàn',
      sub: 'GPS định vị & Geofencing nhà an toàn',
      onPress: () => setLocationVisible(true),
    },
    {
      key: 'security',
      icon: 'shield-checkmark-outline',
      iconColor: '#0D9488',
      bgLight: '#F0FDFA',
      bgDark: '#133E3B',
      title: 'Trung tâm bảo mật',
      sub: 'Xác thực 2FA & Quản lý phiên đăng nhập',
      onPress: () => setSecurityCenterVisible(true),
    },
  ];

  const extraGridItems = [
    {
      key: 'medReminder',
      icon: 'calendar-outline',
      iconColor: '#D97706',
      bgLight: '#FEF3C7',
      bgDark: '#451A03',
      title: 'Lịch nhắc thuốc',
      sub: 'Đơn thuốc & Lịch tái khám bác sĩ',
      onPress: () => navigation.navigate('MedicationReminder'),
    },
    {
      key: 'alerts',
      icon: 'notifications-outline',
      iconColor: '#EF4444',
      bgLight: '#FEE2E2',
      bgDark: '#450A0A',
      title: 'Nhật ký cảnh báo',
      sub: 'Sự kiện té ngã & Sinh hiệu bất thường',
      onPress: () => navigation.navigate('Alerts'),
    },
    {
      key: 'aiAssistant',
      icon: 'chatbubble-ellipses-outline',
      iconColor: '#06B6D4',
      bgLight: '#ECFEFF',
      bgDark: '#164E63',
      title: 'Trợ lý Bác sĩ AI',
      sub: 'Tư vấn dinh dưỡng & Vận động 24/7',
      onPress: () => navigation.navigate('AIAssistant'),
    },
    {
      key: 'multiView',
      icon: 'grid-outline',
      iconColor: '#7C3AED',
      bgLight: '#F3E8FF',
      bgDark: '#2E1065',
      title: 'Multi-View Camera',
      sub: 'Xem nhiều góc quay camera cùng lúc',
      onPress: () => navigation.navigate('MultiView'),
    },
    {
      key: 'doctorMode',
      icon: 'medical-outline',
      iconColor: '#0284C7',
      bgLight: '#E0F2FE',
      bgDark: '#082F49',
      title: 'Chế độ Bác sĩ',
      sub: 'Bệnh án, Kê đơn & Báo cáo y tế',
      onPress: () =>
        Alert.alert(
          'Chuyển sang Chế độ Bác sĩ',
          'Bạn muốn chuyển sang giao diện chuyên môn của Bác sĩ gia đình (Danh sách bệnh nhân, Kê đơn thuốc, Báo cáo y tế)?',
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Chuyển ngay', onPress: () => toggleViewRole() },
          ]
        ),
    },
  ];

  const visibleGridItems = showMoreGrid ? [...primaryGridItems, ...extraGridItems] : primaryGridItems;

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top']}>
      {/* Modal xác nhận đăng xuất */}
      <Modal transparent visible={isLogoutConfirmVisible} animationType="fade" onRequestClose={() => setLogoutConfirmVisible(false)}>
        <Pressable style={styles.confirmModalOverlay} onPress={() => setLogoutConfirmVisible(false)}>
          <Pressable
            style={[styles.confirmModalCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
            onPress={() => {}}
          >
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
              <TouchableOpacity style={styles.confirmModalLogoutBtn} onPress={performLogout} activeOpacity={0.8}>
                <Text style={styles.confirmModalLogoutText}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Thông tin tài khoản người giám sát */}
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
              style={[
                styles.backButton,
                styles.userMenuBackButton,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
              ]}
              onPress={closeUserMenu}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.avatarContainerLarge}>
              <TouchableOpacity
                style={[styles.avatarCircleLarge, isDarkMode && { backgroundColor: '#1E293B' }]}
                activeOpacity={0.8}
                onPress={() => setAvatarPickerVisible(true)}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImageLarge} />
                ) : (
                  <Ionicons name="person" size={42} color={isDarkMode ? '#64748B' : '#E8EEF5'} />
                )}
              </TouchableOpacity>
              <Text style={[styles.profileNameText, isDarkMode && { color: '#F8FAFC' }]}>{profileName}</Text>
            </View>

            <View style={[styles.profileInfoListCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              <TouchableOpacity
                style={[styles.infoRow, isDarkMode && { borderBottomColor: '#334155' }]}
                activeOpacity={0.8}
                onPress={() => {
                  setDraftValue(profileName !== '--' ? profileName : '');
                  setEditingField('name');
                }}
              >
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="person-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Tên</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={[styles.infoValue, isDarkMode && { color: '#94A3B8' }]}>{profileName}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <View style={[styles.infoRow, isDarkMode && { borderBottomColor: '#334155' }]}>
                <View style={styles.infoLeftWrap}>
                  <Ionicons name="call-outline" size={22} color={isDarkMode ? '#94A3B8' : '#1F2937'} />
                  <Text style={[styles.infoLabel, isDarkMode && { color: '#F8FAFC' }]}>Số điện thoại</Text>
                </View>
                <View style={styles.infoRightWrap}>
                  <Text style={[styles.infoValue, isDarkMode && { color: '#94A3B8' }]}>{profilePhone}</Text>
                </View>
              </View>

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

            <TouchableOpacity style={styles.logoutButton} activeOpacity={0.9} onPress={() => setLogoutConfirmVisible(true)}>
              <Text style={styles.logoutButtonText}>Đăng xuất</Text>
            </TouchableOpacity>

            {/* Modal chỉnh sửa tên */}
            <Modal transparent visible={editingField !== null} animationType="fade" onRequestClose={() => setEditingField(null)}>
              <Pressable style={styles.editorOverlay} onPress={() => setEditingField(null)}>
                <Pressable
                  style={[styles.editorSheet, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
                  onPress={() => {}}
                >
                  <View style={styles.editorHeader}>
                    <TouchableOpacity
                      style={[styles.editorBackButton, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                      onPress={() => setEditingField(null)}
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
                  />

                  <View style={styles.editorActions}>
                    <TouchableOpacity
                      style={[styles.editorCancel, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                      onPress={() => setEditingField(null)}
                    >
                      <Text style={[styles.editorCancelText, isDarkMode && { color: '#94A3B8' }]}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editorSave} onPress={saveEditedField}>
                      <Text style={styles.editorSaveText}>Lưu</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chi tiết Bảo mật */}
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
                    <Text style={styles.securityDeviceMeta}>
                      {Platform.OS === 'web' ? 'Web Browser' : Platform.OS === 'ios' ? 'iOS' : 'Android'} · Đang hoạt động
                    </Text>
                  </View>
                  <Text style={styles.securityCurrentLabel}>Hiện tại</Text>
                </View>
                <Text style={styles.securityDetailDescription}>
                  Thiết bị không hoạt động trong 3 tháng sẽ được đề xuất loại bỏ tự động.
                </Text>
              </View>
            )}

            {securityDetail === 'logins' && (
              <View style={styles.securityDetailCard}>
                <Text style={styles.securityDetailCardTitle}>Phiên đăng nhập hoạt động</Text>
                <View style={[styles.securityLoginItem, { borderBottomWidth: 0 }]}>
                  <View style={styles.securityTimelineDot} />
                  <View style={styles.securityDeviceCopy}>
                    <Text style={styles.securityLoginName}>{profileName}</Text>
                    <Text style={styles.securityDeviceMeta}>
                      {profilePhone} · {Platform.OS === 'web' ? 'Trình duyệt Web' : 'Ứng dụng Di động'}
                    </Text>
                  </View>
                  <Text style={styles.securityLoginTime}>Đang hoạt động</Text>
                </View>
              </View>
            )}

            {securityDetail === 'question' && (
              <View style={styles.securityQuestionDetail}>
                <Text style={styles.securityQuestionDetailTitle}>{selectedSecurityQuestion}</Text>
                <Text style={styles.securityQuestionDetailDescription}>
                  {SECURITY_FAQ[selectedSecurityQuestion] ||
                    'Hệ thống sử dụng các lớp bảo vệ tài khoản, xác minh thiết bị và mã xác thực để hạn chế truy cập trái phép. Bạn nên bật xác minh hai bước và thường xuyên kiểm tra phiên đăng nhập.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Hỗ trợ khẩn cấp 115 */}
      <Modal
        transparent
        visible={isCustomerSupportVisible}
        animationType="fade"
        onRequestClose={() => setCustomerSupportVisible(false)}
      >
        <Pressable style={styles.customerSupportOverlay} onPress={() => setCustomerSupportVisible(false)}>
          <Pressable
            style={[styles.customerSupportDialog, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
            onPress={() => {}}
          >
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
                  navigation.navigate('SendEmergencyLocation');
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

      {/* Modal Trung tâm Bảo mật */}
      <Modal visible={isSecurityCenterVisible} animationType="slide" onRequestClose={() => setSecurityCenterVisible(false)}>
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
              <Text style={[styles.securityHeroDescription, isDarkMode && { color: '#E2E8F0' }]}>Bảo vệ đa lớp AES-256</Text>
              <TouchableOpacity
                style={styles.securityImproveButton}
                activeOpacity={0.8}
                onPress={() => openSecurityDetail('twoFactor')}
              >
                <Text style={[styles.securityImproveText, isDarkMode && { color: '#F8FAFC' }]}>Kiểm tra bảo mật ngay</Text>
                <Ionicons name="chevron-forward" size={23} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.securitySectionCard,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 },
              ]}
            >
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

            <View
              style={[
                styles.securitySectionCard,
                isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 },
              ]}
            >
              <View style={styles.securitySectionHeader}>
                <Text style={[styles.securitySectionTitle, isDarkMode && { color: '#F8FAFC' }]}>Bạn cũng có thể hỏi</Text>
                <Ionicons name="ellipsis-vertical" size={22} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
              </View>
              {[
                'Mật khẩu mã hóa thiết bị là gì?',
                'Có ràng buộc một thiết bị an toàn không?',
                'Bảo vệ quyền riêng tư của người dùng',
                'Việc sử dụng mã xác minh qua tin nhắn SMS',
              ].map((question) => (
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

      {/* Modal Định vị địa lý */}
      <Modal transparent visible={isLocationVisible} animationType="slide" onRequestClose={() => setLocationVisible(false)}>
        <Pressable style={styles.locationOverlay} onPress={() => setLocationVisible(false)}>
          <Pressable style={[styles.locationSheet, isDarkMode && { backgroundColor: '#1E293B' }]} onPress={() => {}}>
            <View style={styles.locationHeader}>
              <View style={styles.locationHeaderIcon}>
                <Ionicons name="navigate" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.locationTitle, isDarkMode && { color: '#F8FAFC' }]}>Định vị địa lý</LocalizedText>
                <LocalizedText style={[styles.locationDescription, isDarkMode && { color: '#94A3B8' }]}>
                  Xác định vị trí hiện tại của thiết bị
                </LocalizedText>
              </View>
              <TouchableOpacity style={styles.locationCloseIcon} onPress={() => setLocationVisible(false)} activeOpacity={0.8}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#F8FAFC' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.locationMapFrame, isDarkMode && { borderColor: '#334155', backgroundColor: '#0F172A' }]}>
              {locationCoords ? (
                Platform.OS === 'web' ? (
                  React.createElement('iframe', {
                    title: 'Bản đồ vị trí hiện tại',
                    src: locationMapUrl,
                    loading: 'lazy',
                    style: { width: '100%', height: '100%', border: 0 },
                  })
                ) : (
                  <WebView source={{ uri: locationMapUrl }} style={{ flex: 1 }} scrollEnabled={false} />
                )
              ) : (
                <View style={styles.locationMapLoading}>
                  <Ionicons name="navigate-outline" size={30} color="#2563EB" />
                  <LocalizedText style={[styles.locationMapLoadingText, isDarkMode && { color: '#94A3B8' }]}>
                    {isLocationLoading ? 'Đang lấy vị trí hiện tại...' : 'Chưa có dữ liệu bản đồ'}
                  </LocalizedText>
                </View>
              )}
              <View style={[styles.locationMapBadge, isDarkMode && { backgroundColor: 'rgba(15, 23, 42, 0.9)' }]}>
                <View style={styles.locationMapBadgeDot} />
                <LocalizedText style={[styles.locationMapBadgeText, isDarkMode && { color: '#F8FAFC' }]}>Vị trí của bạn</LocalizedText>
              </View>
            </View>

            <View style={[styles.locationResultBox, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
              <View style={styles.locationResultIcon}>
                <Ionicons name="location" size={19} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.locationStatusRow}>
                  <LocalizedText style={[styles.locationResultLabel, isDarkMode && { color: '#94A3B8' }]}>Vị trí hiện tại</LocalizedText>
                  <View style={[styles.locationStatusBadge, locationAddress ? styles.locationStatusBadgeActive : null]}>
                    <View style={[styles.locationStatusDot, locationAddress ? styles.locationStatusDotActive : null]} />
                    <LocalizedText style={[styles.locationStatusText, locationCoords ? styles.locationStatusTextActive : null]}>
                      {locationCoords ? 'Đã cập nhật' : 'Chưa cập nhật'}
                    </LocalizedText>
                  </View>
                </View>
                <LocalizedText style={[styles.locationResultText, isDarkMode && { color: '#F8FAFC' }]}>
                  {locationAddress || 'Nhấn nút bên dưới để lấy địa chỉ hiện tại'}
                </LocalizedText>
                {locationCoords && (
                  <LocalizedText style={[styles.locationCoordinatesText, isDarkMode && { color: '#94A3B8' }]}>
                    Tọa độ: {locationCoords.latitude.toFixed(6)}, {locationCoords.longitude.toFixed(6)}
                  </LocalizedText>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.locationButton} onPress={handleGetCurrentLocation} activeOpacity={0.85}>
              <Ionicons name={isLocationLoading ? 'sync-outline' : 'locate-outline'} size={20} color="#FFFFFF" />
              <LocalizedText style={styles.locationButtonText}>
                {isLocationLoading ? 'Đang định vị...' : 'Cập nhật vị trí'}
              </LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.locationCloseButton} onPress={() => setLocationVisible(false)} activeOpacity={0.8}>
              <LocalizedText style={[styles.locationCloseText, isDarkMode && { color: '#94A3B8' }]}>Để sau</LocalizedText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chọn ảnh đại diện */}
      <Modal transparent visible={isAvatarPickerVisible} animationType="fade" onRequestClose={() => setAvatarPickerVisible(false)}>
        <Pressable style={styles.avatarPickerOverlay} onPress={() => setAvatarPickerVisible(false)}>
          <Pressable
            style={[styles.avatarPickerSheet, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
            onPress={() => {}}
          >
            <TouchableOpacity
              style={[styles.avatarPickerRow, isDarkMode && { borderBottomColor: '#334155', backgroundColor: '#1E293B' }]}
              activeOpacity={0.8}
              onPress={() => pickAvatar(true)}
            >
              <Ionicons name="camera-outline" size={24} color={isDarkMode ? '#F8FAFC' : '#111827'} />
              <Text style={[styles.avatarPickerText, isDarkMode && { color: '#F8FAFC' }]}>Chụp ảnh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.avatarPickerRow, { borderBottomWidth: 0 }, isDarkMode && { backgroundColor: '#1E293B' }]}
              activeOpacity={0.8}
              onPress={() => pickAvatar(false)}
            >
              <Ionicons name="images-outline" size={24} color={isDarkMode ? '#F8FAFC' : '#111827'} />
              <Text style={[styles.avatarPickerText, isDarkMode && { color: '#F8FAFC' }]}>Chọn từ Hình ảnh</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Đổi mật khẩu */}
      <Modal visible={isChangePasswordVisible} animationType="slide" onRequestClose={closeChangePassword}>
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

          <ScrollView contentContainerStyle={styles.changePasswordContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.changePasswordIntro, isDarkMode && { color: '#94A3B8' }]}>
              Tạo mật khẩu mới để bảo vệ tài khoản của bạn.
            </Text>

            {passwordChangeFeedback && (
              <View
                accessibilityRole="alert"
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: 12,
                  marginBottom: 16,
                  borderRadius: 10,
                  backgroundColor:
                    passwordChangeFeedback.type === 'success'
                      ? isDarkMode
                        ? '#064E3B'
                        : '#DCFCE7'
                      : isDarkMode
                        ? '#7F1D1D'
                        : '#FEE2E2',
                }}
              >
                <Ionicons
                  name={passwordChangeFeedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={20}
                  color={passwordChangeFeedback.type === 'success' ? '#16A34A' : '#DC2626'}
                />
                <Text
                  style={{
                    flex: 1,
                    color:
                      passwordChangeFeedback.type === 'success'
                        ? isDarkMode
                          ? '#BBF7D0'
                          : '#166534'
                        : isDarkMode
                          ? '#FECACA'
                          : '#991B1B',
                  }}
                >
                  {passwordChangeFeedback.message}
                </Text>
              </View>
            )}

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
              style={[styles.changePasswordButton, isChangingPassword && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              activeOpacity={0.85}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.changePasswordButtonText}>Cập nhật mật khẩu</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Cài đặt chính */}
      <Modal transparent visible={isSettingsVisible} animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setSettingsVisible(false)}>
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
                onPress={() => setSettingsVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài đặt</Text>
            </View>

            <View style={styles.settingsList}>
              <View
                style={[
                  styles.settingsGroupCard,
                  isDarkMode ? { backgroundColor: '#1E293B', borderColor: '#334155' } : { backgroundColor: '#FFFFFF', borderColor: '#F1F5F9' },
                ]}
              >
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
                    <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' }]}>
                      <Ionicons name="person-circle-outline" size={20} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingsLabel, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Hồ sơ người giám sát</Text>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Tài khoản người thân theo dõi, SĐT liên hệ khẩn cấp
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsItem, styles.settingsItemLast]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSettingsVisible(false);
                    navigation.navigate('PatientMedicalRecord');
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View style={[styles.settingsIconWrap, { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' }]}>
                      <Ionicons name="medkit-outline" size={20} color="#0EA5E9" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.settingsLabel, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Hồ sơ bệnh án người cao tuổi</Text>
                        <View style={styles.profileAesBadge}>
                          <Text style={styles.profileAesBadgeText}>Bảo mật AES-256</Text>
                        </View>
                      </View>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Thông tin cụ, bệnh nền, nhóm máu & đơn thuốc
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.settingsGroupCard,
                  isDarkMode ? { backgroundColor: '#1E293B', borderColor: '#334155' } : { backgroundColor: '#FFFFFF', borderColor: '#F1F5F9' },
                ]}
              >
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
                    <Text style={[styles.settingsLabel, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Cài đặt chung</Text>
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
                    <Text style={[styles.settingsLabel, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Khả năng tiếp cận</Text>
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
                    <Text style={[styles.settingsLabel, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Thông tin</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.settingsGroupCard,
                  isDarkMode ? { backgroundColor: '#1E293B', borderColor: '#334155' } : { backgroundColor: '#FFFFFF', borderColor: '#F1F5F9' },
                ]}
              >
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
                    <Text style={[styles.settingsLabel, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Thiết lập thông báo</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
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
                    <Text style={[styles.settingsLabel, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Rung</Text>
                  </View>
                  <View style={styles.settingsRightStatus}>
                    <Text style={[styles.settingsValueText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {vibrationEnabled ? 'Mở' : 'Tắt'}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Khả năng tiếp cận */}
      <Modal transparent visible={isAccessibilityVisible} animationType="slide" onRequestClose={() => setAccessibilityVisible(false)}>
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
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
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
                  <Text style={[styles.accessibilityValue, isDarkMode && { color: '#94A3B8' }]}>
                    {fontSizeMode === 'system' ? 'Theo hệ thống' : 'Tùy chỉnh'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              <View style={[styles.accessibilityRow, { borderBottomWidth: 0 }]}>
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

      {/* Modal Kích thước phông chữ */}
      <Modal transparent visible={isFontSizeVisible} animationType="slide" onRequestClose={() => setFontSizeVisible(false)}>
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
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
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

            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.fontSizeOption, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                activeOpacity={0.8}
                onPress={() => applyFontScaleMode('system')}
              >
                <Text style={[styles.fontSizeOptionText, isDarkMode && { color: '#F8FAFC' }]}>Theo hệ thống</Text>
                {fontSizeMode === 'system' && <Ionicons name="checkmark" size={22} color="#1D9BF0" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fontSizeOption, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                activeOpacity={0.8}
                onPress={() => applyFontScaleMode('custom')}
              >
                <Text style={[styles.fontSizeOptionText, isDarkMode && { color: '#F8FAFC' }]}>Tùy chỉnh</Text>
                {fontSizeMode === 'custom' && <Ionicons name="checkmark" size={22} color="#1D9BF0" />}
              </TouchableOpacity>

              {fontSizeMode === 'custom' && (
                <View
                  style={[
                    styles.customFontSliderPanel,
                    isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18, padding: 16 },
                  ]}
                >
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
                            style={[styles.customFontTick, customFontScale === value && styles.customFontTickSelected]}
                          />
                        ))}
                        <View style={[styles.customFontThumb, { left: `${(customFontScale / 4) * 100}%` }]} />
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

      {/* Modal Thông tin & Điều khoản */}
      <Modal transparent visible={isAboutInfoVisible} animationType="slide" onRequestClose={() => setAboutInfoVisible(false)}>
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            setAboutInfoVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
                onPress={() => {
                  if (infoDetail) setInfoDetail(null);
                  else {
                    setAboutInfoVisible(false);
                    setSettingsVisible(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>
                {infoDetail === 'terms' ? 'Điều khoản sử dụng' : infoDetail === 'app' ? 'Thông tin ứng dụng' : 'Thông tin'}
              </Text>
            </View>

            {infoDetail === null ? (
              <View style={[styles.accessibilityList, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <TouchableOpacity
                  style={[styles.accessibilityRow, isDarkMode && { borderBottomColor: '#334155' }]}
                  activeOpacity={0.8}
                  onPress={() => setInfoDetail('terms')}
                >
                  <Text style={[styles.accessibilityLabel, isDarkMode && { color: '#F8FAFC' }]}>Điều khoản sử dụng</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessibilityRow, { borderBottomWidth: 0 }]}
                  activeOpacity={0.8}
                  onPress={() => setInfoDetail('app')}
                >
                  <Text style={[styles.accessibilityLabel, isDarkMode && { color: '#F8FAFC' }]}>Thông tin ứng dụng</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.infoDetailContent}>
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

      {/* Modal Cài đặt Rung */}
      <Modal transparent visible={isVibrationDetailVisible} animationType="slide" onRequestClose={() => setVibrationDetailVisible(false)}>
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => {
            setVibrationDetailVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
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
              Khi được bật, điện thoại sẽ rung phản hồi khi có cảnh báo khẩn cấp hoặc thao tác quan trọng.
            </Text>
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
          onPress={() => {
            setNotificationSettingsVisible(false);
            setSettingsVisible(true);
          }}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
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
                {[
                  {
                    title: 'Thông báo cảnh báo',
                    desc: 'Nhận cảnh báo sức khỏe mới',
                    val: notificationsEnabled,
                    onChange: setNotificationsEnabled,
                  },
                  {
                    title: 'Âm thanh cảnh báo',
                    desc: 'Phát âm thanh khi có cảnh báo',
                    val: alertSoundEnabled,
                    onChange: setAlertSoundEnabled,
                  },
                  {
                    title: 'Cảnh báo khẩn cấp',
                    desc: 'Luôn ưu tiên cảnh báo nguy hiểm',
                    val: criticalAlertEnabled,
                    onChange: setCriticalAlertEnabled,
                  },
                ].map((item, idx) => (
                  <React.Fragment key={item.title}>
                    {idx > 0 && <View style={[styles.notificationSettingDivider, isDarkMode && { backgroundColor: '#334155' }]} />}
                    <View style={styles.notificationSettingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notificationSettingTitle, isDarkMode && { color: '#F8FAFC' }]}>{item.title}</Text>
                        <Text style={[styles.notificationSettingDescription, isDarkMode && { color: '#94A3B8' }]}>{item.desc}</Text>
                      </View>
                      <Switch value={item.val} onValueChange={item.onChange} />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Cài đặt chung */}
      <Modal transparent visible={isGeneralSettingsVisible} animationType="slide" onRequestClose={() => setGeneralSettingsVisible(false)}>
        <Pressable style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setGeneralSettingsVisible(false)}>
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
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

            <View style={[styles.accessibilityList, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
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
                  <Text style={[styles.generalRowValue, isDarkMode && { color: '#94A3B8' }]}>
                    {languageMode === 'vi' ? 'Việt Nam' : 'English'}
                  </Text>
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
                  <Text style={[styles.generalRowValue, isDarkMode && { color: '#94A3B8' }]}>
                    {appearanceMode === 'light' ? 'Màu sáng' : 'Tối'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chọn ngôn ngữ */}
      <Modal transparent visible={isLanguageVisible} animationType="slide" onRequestClose={() => setLanguageVisible(false)}>
        <Pressable style={[styles.appearanceOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setLanguageVisible(false)}>
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={[
                  styles.appearanceCloseButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
                ]}
                onPress={() => setLanguageVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : '#111827'} />
              </TouchableOpacity>
              <Text style={[styles.appearanceTitle, isDarkMode && { color: '#F8FAFC' }]}>Ngôn ngữ</Text>
              <View style={styles.appearanceHeaderSpacer} />
            </View>

            <View style={[styles.appearanceCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
              {[
                { key: 'vi' as const, label: 'Việt Nam' },
                { key: 'en' as const, label: 'English' },
              ].map((opt, idx) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.appearanceOptionRow,
                    isDarkMode
                      ? { backgroundColor: '#1E293B', borderBottomColor: '#334155' }
                      : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB' },
                    idx === 1 && { borderBottomWidth: 0 },
                    languageMode === opt.key && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleLanguageChange(opt.key)}
                >
                  <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>{opt.label}</Text>
                  {languageMode === opt.key && <Ionicons name="checkmark" size={22} color="#1D9BF0" />}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Giao diện Sáng / Tối */}
      <Modal transparent visible={isAppearanceVisible} animationType="slide" onRequestClose={() => setAppearanceVisible(false)}>
        <Pressable style={[styles.appearanceOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => setAppearanceVisible(false)}>
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={[
                  styles.appearanceCloseButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 18 },
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
              {[
                { key: 'light' as const, label: 'Màu sáng', darkVal: false },
                { key: 'dark' as const, label: 'Tối', darkVal: true },
              ].map((opt, idx) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.appearanceOptionRow,
                    isDarkMode
                      ? { backgroundColor: '#1E293B', borderBottomColor: '#334155' }
                      : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB' },
                    idx === 1 && { borderBottomWidth: 0 },
                    appearanceMode === opt.key && (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setAppearanceMode(opt.key);
                    setDarkMode(opt.darkVal);
                    setAppearanceVisible(false);
                  }}
                >
                  <Text style={[styles.appearanceOptionLabel, isDarkMode && { color: '#F8FAFC' }]}>{opt.label}</Text>
                  {appearanceMode === opt.key && <Ionicons name="checkmark" size={22} color="#1D9BF0" />}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================================================================= */}
      {/* NỘI DUNG CHÍNH MÀN HÌNH CÁ NHÂN (MENU)                            */}
      {/* ================================================================= */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isDarkMode && { backgroundColor: colors.background }]}
      >
        {/* Header: Tiêu đề "Menu" & Nút Cài đặt */}
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

        {/* Thẻ Thông tin Người dùng */}
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
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.fbProfileName, isDarkMode && { color: colors.textPrimary }]}>{profileName}</Text>
              <Text style={[styles.fbProfileRole, isDarkMode && { color: colors.textSecondary }]}>
                {profilePhone} • {profileRole}
              </Text>
            </View>
            <View style={styles.fbProfileRightBadge}>
              <Ionicons name="chevron-down-circle" size={24} color="#64748B" />
              {unreadAlertsCount > 0 && (
                <View style={styles.fbNotiCountBadge}>
                  <Text style={styles.fbNotiCountText}>{unreadAlertsCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={[styles.fbCardDivider, isDarkMode && { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.fbSubActionRow} activeOpacity={0.7} onPress={() => navigation.navigate('HouseDetail')}>
            <View style={styles.fbPlusCircleBtn}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </View>
            <Text style={[styles.fbSubActionText, isDarkMode && { color: colors.textPrimary }]}>
              Thêm thành viên gia đình & Cụ cần chăm sóc
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lối tắt của bạn (Carousel ngang) */}
        <View style={styles.fbShortcutsSection}>
          <Text style={[styles.fbSectionTitle, isDarkMode && { color: colors.textPrimary }]}>Lối tắt của bạn</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fbShortcutsScroll}>
            {shortcuts.map((sc) => (
              <TouchableOpacity key={sc.key} style={styles.fbShortcutItem} activeOpacity={0.8} onPress={sc.onPress}>
                <View style={[styles.fbShortcutThumbWrap, { backgroundColor: isDarkMode ? '#1E293B' : sc.thumbBg }]}>
                  <View style={styles.fbShortcutCenterIcon}>
                    <Ionicons name={sc.icon as any} size={28} color={sc.badgeColor} />
                  </View>
                  <View style={[styles.fbShortcutBadge, { backgroundColor: sc.badgeColor }]}>
                    <Ionicons name={sc.icon as any} size={10} color="#FFFFFF" />
                  </View>
                </View>
                <Text numberOfLines={1} style={[styles.fbShortcutLabel, isDarkMode && { color: colors.textSecondary }]}>
                  {sc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Lưới tính năng 2 cột */}
        <View style={styles.fbGridContainer}>
          {visibleGridItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.fbGridCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={item.onPress}
            >
              <View style={styles.fbGridCardTopRow}>
                <View style={[styles.fbGridIconBox, { backgroundColor: isDarkMode ? item.bgDark : item.bgLight }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.iconColor} />
                </View>
                {'badge' in item && item.badge ? (
                  <View style={styles.fbAesBadge}>
                    <Text style={styles.fbAesBadgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.fbGridCardTitle, isDarkMode && { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.fbGridCardSub, isDarkMode && { color: colors.textSecondary }]}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nút Xem thêm / Ẩn bớt */}
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

        {/* Accordion 1: Trợ giúp và hỗ trợ */}
        <View style={[styles.fbAccordionCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.fbAccordionHeader}
            activeOpacity={0.7}
            onPress={() => setIsHelpExpanded(!isHelpExpanded)}
          >
            <View style={styles.fbAccordionHeaderLeft}>
              <Ionicons name="help-circle-outline" size={24} color={isDarkMode ? colors.textPrimary : '#0F172A'} />
              <Text style={[styles.fbAccordionTitle, isDarkMode && { color: colors.textPrimary }]}>Trợ giúp và hỗ trợ</Text>
            </View>
            <Ionicons name={isHelpExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#64748B" />
          </TouchableOpacity>

          {isHelpExpanded && (
            <View style={styles.fbAccordionBody}>
              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('SendEmergencyLocation')}
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

              <TouchableOpacity
                style={styles.fbAccordionSubRow}
                activeOpacity={0.7}
                onPress={() => setCustomerSupportVisible(true)}
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

        {/* Accordion 2: Cài đặt và quyền riêng tư */}
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
            <Ionicons name={isSettingsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#64748B" />
          </TouchableOpacity>

          {isSettingsExpanded && (
            <View style={styles.fbAccordionBody}>
              {[
                {
                  icon: 'notifications-outline',
                  iconColor: '#D97706',
                  bg: '#FEF3C7',
                  title: 'Cài đặt thông báo & Âm thanh báo động',
                  sub: 'Chuông còi hú, rung, thông báo đẩy',
                  onPress: () => setNotificationSettingsVisible(true),
                },
                {
                  icon: 'text-outline',
                  iconColor: '#10B981',
                  bg: '#ECFDF5',
                  title: 'Cỡ chữ lớn (Dành cho người cao tuổi)',
                  sub: 'Điều chỉnh độ phóng to chữ đọc dễ dàng',
                  onPress: () => setFontSizeVisible(true),
                },
                {
                  icon: 'contrast-outline',
                  iconColor: '#475569',
                  bg: '#F1F5F9',
                  title: 'Chế độ giao diện Sáng / Tối',
                  sub: isDarkMode ? 'Đang dùng Giao diện Tối' : 'Đang dùng Giao diện Sáng',
                  onPress: () => setAppearanceVisible(true),
                },
                {
                  icon: 'lock-closed-outline',
                  iconColor: '#EF4444',
                  bg: '#FEE2E2',
                  title: 'Đổi mật khẩu tài khoản',
                  sub: 'Cập nhật mã bảo mật đăng nhập',
                  onPress: () => setChangePasswordVisible(true),
                },
              ].map((row, idx) => (
                <React.Fragment key={row.title}>
                  {idx > 0 && <View style={[styles.fbSubDivider, isDarkMode && { backgroundColor: colors.border }]} />}
                  <TouchableOpacity style={styles.fbAccordionSubRow} activeOpacity={0.7} onPress={row.onPress}>
                    <View style={[styles.fbSubIconBox, { backgroundColor: row.bg }]}>
                      <Ionicons name={row.icon as any} size={18} color={row.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fbSubRowTitle, isDarkMode && { color: colors.textPrimary }]}>{row.title}</Text>
                      <Text style={styles.fbSubRowSub}>{row.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Nút Đăng xuất */}
        <TouchableOpacity
          style={[styles.fbLogoutBtn, isDarkMode && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}
          activeOpacity={0.8}
          onPress={() => setLogoutConfirmVisible(true)}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.fbLogoutBtnText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 30, paddingBottom: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#F8FAFC' },

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
  customerSupportTitle: { marginTop: 12, fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  customerSupportMessage: { marginTop: 8, fontSize: 15, lineHeight: 22, textAlign: 'center', color: '#64748B' },
  customerSupportActions: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 22 },
  customerSupportCancelButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 11, backgroundColor: '#E2E8F0' },
  customerSupportCancelText: { fontSize: 15, fontWeight: '700', color: '#475569' },
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
  customerSupportCallText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  securityScreen: { flex: 1, backgroundColor: '#F6F8F8' },
  securityScrollContent: { paddingBottom: 28 },
  securityHero: {
    position: 'relative',
    minHeight: 324,
    paddingHorizontal: 22,
    paddingTop: 8,
    backgroundColor: '#5ADCE5',
    overflow: 'hidden',
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
  securityHeroShield: { position: 'absolute', right: 18, top: 90, opacity: 0.9 },
  securityHeroStatus: { marginTop: 56, fontSize: 34, fontWeight: '800', color: '#0F172A' },
  securityHeroDescription: { marginTop: 14, fontSize: 17, fontWeight: '600', color: '#0F172A' },
  securityImproveButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 30 },
  securityImproveText: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  securitySectionCard: { marginHorizontal: 14, marginTop: 10, padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF' },
  securitySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  securitySectionTitle: { fontSize: 19, fontWeight: '800', color: '#2F3338' },
  securityTileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 10, rowGap: 14 },
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
  securityTileTitle: { maxWidth: '92%', fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#30343A' },
  securityTileIcon: { alignSelf: 'flex-end', marginTop: 6 },
  securityTileSwitch: { position: 'absolute', right: 9, bottom: 9, transform: [{ scale: 0.8 }] },
  securityQuestionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 62, borderTopWidth: 1, borderTopColor: '#F1F3F5' },
  securityQuestionText: { flex: 1, paddingRight: 12, fontSize: 15, lineHeight: 21, color: '#3C4045' },

  securityDetailScreen: { flex: 1, backgroundColor: '#F6F8F8' },
  securityDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#F6F8F8',
  },
  securityDetailTitle: { flex: 1, marginRight: 36, fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#0F172A' },
  securityDetailContent: { paddingHorizontal: 26, paddingTop: 24, paddingBottom: 32 },
  securityQuestionDetail: { backgroundColor: 'transparent' },
  securityQuestionDetailTitle: { marginBottom: 32, fontSize: 25, lineHeight: 34, fontWeight: '400', color: '#303236' },
  securityQuestionDetailDescription: { fontSize: 16, lineHeight: 27, fontWeight: '400', color: '#4B4D50' },
  securityDetailCard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    ...Shadows.soft,
  },
  securityDetailRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  securityDetailCardTitle: { flex: 1, marginBottom: 12, fontSize: 18, fontWeight: '800', color: '#1F2937' },
  securityDetailDescription: { marginTop: 18, fontSize: 15, lineHeight: 24, color: '#475569' },
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
  securityInfoText: { flex: 1, marginLeft: 8, fontSize: 13, lineHeight: 19, color: '#1D4ED8', fontWeight: '600' },
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
  securityDeviceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#DBEAFE' },
  securityDeviceCopy: { flex: 1, marginHorizontal: 10, minWidth: 0 },
  securityDeviceName: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: '#111827' },
  securityLoginName: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: '#111827' },
  securityDeviceMeta: { marginTop: 2, fontSize: 11, color: '#64748B', fontWeight: '500' },
  securityCurrentLabel: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  securityLoginItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  securityTimelineDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#5B8DEF', marginRight: 12, marginTop: 2 },
  securityLoginTime: { marginLeft: 8, fontSize: 11, fontWeight: '600', color: '#10B981', textAlign: 'right' },

  avatarPickerOverlay: { flex: 1, backgroundColor: 'rgba(148, 163, 184, 0.55)', justifyContent: 'center', alignItems: 'center' },
  avatarPickerSheet: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    ...Shadows.card,
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
  avatarPickerText: { fontSize: 18, fontWeight: '500', color: '#111827' },

  locationOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.42)' },
  locationSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  locationHeaderIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRadius: 15, backgroundColor: '#DBEAFE' },
  locationTitle: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  locationDescription: { marginTop: 3, fontSize: 12, lineHeight: 17, color: '#64748B' },
  locationCloseIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#F1F5F9' },
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
  locationMapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2F8' },
  locationMapLoadingText: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#42617E' },
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
  locationMapBadgeDot: { width: 7, height: 7, marginRight: 5, borderRadius: 4, backgroundColor: '#2563EB' },
  locationMapBadgeText: { fontSize: 10, fontWeight: '800', color: '#1E3A8A' },
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
  locationResultIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderRadius: 12, backgroundColor: '#DBEAFE' },
  locationStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationResultLabel: { fontSize: 13, fontWeight: '800', color: '#1E3A8A' },
  locationStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: '#E2E8F0' },
  locationStatusBadgeActive: { backgroundColor: '#DCFCE7' },
  locationStatusDot: { width: 6, height: 6, marginRight: 4, borderRadius: 3, backgroundColor: '#94A3B8' },
  locationStatusDotActive: { backgroundColor: '#16A34A' },
  locationStatusText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  locationStatusTextActive: { color: '#15803D' },
  locationResultText: { marginTop: 8, fontSize: 13, lineHeight: 19, color: '#315A9A' },
  locationCoordinatesText: { marginTop: 4, fontSize: 11, lineHeight: 16, color: '#64748B', fontVariant: ['tabular-nums'] },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
  },
  locationButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  locationCloseButton: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  locationCloseText: { fontSize: 15, fontWeight: '600', color: '#64748B' },

  userMenuSheet: { position: 'relative', flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 26, paddingTop: 10, paddingBottom: 28 },
  settingsOverlay: { flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'flex-start' },
  settingsSheet: { flex: 1, width: '100%', backgroundColor: '#F3F4F6', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
  settingsHeaderRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 10,
    paddingVertical: 6,
    minHeight: 44,
  },
  settingsTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, position: 'absolute', left: 0, right: 0, textAlign: 'center' },

  infoDetailContent: { paddingTop: 8, paddingBottom: 32 },
  infoDetailHeading: { marginBottom: 18, fontSize: 22, fontWeight: '800', color: '#111827' },
  infoDetailText: { marginBottom: 18, fontSize: 15, lineHeight: 24, color: '#475569' },
  appInfoPanel: { alignItems: 'center', paddingTop: 20 },
  appInfoIcon: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderRadius: 20, backgroundColor: '#2563EB' },
  appInfoVersion: { marginBottom: 24, fontSize: 14, color: '#64748B' },
  appInfoCopyright: { marginTop: 6, fontSize: 13, color: '#94A3B8' },

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
  accessibilityLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  accessibilityValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  accessibilityValue: { fontSize: 16, fontWeight: '500', color: '#64748B' },

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
  fontSizeOptionText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  customFontSliderPanel: { marginTop: 18, marginBottom: 10, paddingTop: 6 },
  customFontSliderTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 14, marginLeft: 6 },
  customFontSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  customFontSmall: { fontSize: 18, fontWeight: '500', color: '#3F3F46', marginRight: 4 },
  customFontLarge: { fontSize: 30, fontWeight: '500', color: '#3F3F46', marginLeft: 4 },
  customFontTrackWrap: { flex: 1, height: 36, justifyContent: 'center', marginHorizontal: 4 },
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
  customFontTick: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#D1D5DB' },
  customFontTickSelected: { backgroundColor: '#1D9BF0', borderColor: '#1D9BF0' },
  customFontThumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1D9BF0',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ translateX: -10 }],
  },
  fontSizeNote: { fontSize: 15, lineHeight: 24, color: '#64748B', marginTop: 8, marginBottom: 10 },
  fontSizeLink: { fontSize: 16, fontWeight: '500', color: '#1D9BF0', textDecorationLine: 'underline' },

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
  generalRowLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  generalRowValue: { fontSize: 15, color: '#64748B', fontWeight: '500' },
  generalValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  appearanceOverlay: { flex: 1, backgroundColor: '#E5E7EB', justifyContent: 'flex-start' },
  appearanceSheet: { width: '100%', flex: 1, backgroundColor: '#F3F4F6', paddingTop: 12, paddingBottom: 18 },
  appearanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 18, marginBottom: 6 },
  appearanceHeaderSpacer: { width: 36, height: 36 },
  appearanceCloseButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  appearanceTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  appearanceCard: { marginTop: 8, marginHorizontal: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, overflow: 'hidden' },
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
  appearanceOptionRowSelected: { backgroundColor: '#F8FAFC' },
  appearanceOptionLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },

  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8, zIndex: 2 },
  settingsBackButton: { position: 'absolute', left: 0, top: 0 },
  userMenuBackButton: { marginLeft: -20 },

  changePasswordScreen: { flex: 1, backgroundColor: '#F8FAFC' },
  changePasswordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  changePasswordBackButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  changePasswordHeaderRight: { width: 36, height: 36 },
  changePasswordTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  changePasswordContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 20 },
  changePasswordIntro: { marginBottom: 20, fontSize: 14, lineHeight: 20, color: '#64748B' },
  passwordLabel: { marginBottom: 7, fontSize: 15, fontWeight: '700', color: '#111827' },
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
  passwordInput: { flex: 1, paddingVertical: 11, paddingRight: 8, fontSize: 14, color: '#0F172A' },
  passwordRequirements: {
    marginBottom: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...Shadows.soft,
  },
  passwordRequirementsTitle: { marginBottom: 6, fontSize: 14, color: '#64748B' },
  passwordRequirement: { fontSize: 13, lineHeight: 20, color: '#64748B' },
  changePasswordButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 49,
    marginTop: 13,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    width: '100%',
  },
  changePasswordButtonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  notificationSettingsContent: { flex: 1, paddingHorizontal: 10, paddingTop: 18 },
  notificationSettingsIntro: { marginBottom: 16, fontSize: 15, lineHeight: 22, color: '#64748B' },
  notificationSettingsCard: {
    borderWidth: 1,
    borderColor: '#E5EAF1',
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    ...Shadows.soft,
  },
  notificationSettingRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14 },
  notificationSettingTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  notificationSettingDescription: { marginTop: 3, fontSize: 12, color: '#64748B' },
  notificationSettingDivider: { height: 1, backgroundColor: '#EDF1F5' },

  avatarContainerLarge: { alignItems: 'center', justifyContent: 'center', marginBottom: 22, marginTop: 10 },
  avatarCircleLarge: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#D5D7DB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImageLarge: { width: '100%', height: '100%' },
  profileNameText: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  profileInfoListCard: { backgroundColor: '#F3F4F6', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', marginTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  infoLeftWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoLabel: { fontSize: 18, fontWeight: '500', color: '#111827' },
  infoRightWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoValue: { fontSize: 16, color: '#475569', fontWeight: '500' },

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
  logoutButtonText: { fontSize: 17, fontWeight: '700', color: '#EF4444' },

  editorOverlay: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'flex-start' },
  editorSheet: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 42, marginBottom: 12 },
  editorBackButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginLeft: -8, marginRight: 4 },
  editorTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: '#0F172A' },
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
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 4 },
  editorCancel: { minWidth: 78, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  editorCancelText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  editorSave: { minWidth: 80, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center' },
  editorSaveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  settingsList: { gap: 12 },
  settingsGroupCard: { borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden', ...Shadows.soft },
  settingsItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  settingsItemLast: { borderBottomWidth: 0 },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingsIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  settingsLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  settingsRightStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 32 },
  settingsValueText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  settingsItemSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  profileAesBadge: { backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  profileAesBadgeText: { fontSize: 10, fontWeight: '700', color: '#0284C7' },

  vibrationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  vibrationDetailLabel: { fontSize: 18, fontWeight: '600', color: '#111827' },
  vibrationDetailDescription: { marginTop: 16, fontSize: 15, lineHeight: 24, color: '#64748B' },

  confirmModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmModalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', ...Shadows.card },
  confirmModalIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  confirmModalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  confirmModalMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  confirmModalButtonRow: { flexDirection: 'row', width: '100%', gap: 12 },
  confirmModalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  confirmModalCancelText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  confirmModalLogoutBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  confirmModalLogoutText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Màn hình Menu chính
  fbHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 16, marginTop: 4 },
  fbHeaderTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  fbHeaderActionIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fbHeaderCircleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E4E6EB', alignItems: 'center', justifyContent: 'center' },

  fbProfileCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', ...Shadows.soft },
  fbProfileInfoRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  fbAvatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fbAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  fbProfileName: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  fbProfileRole: { fontSize: 12, color: '#64748B', marginTop: 3 },
  fbProfileRightBadge: { position: 'relative', padding: 4 },
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
  fbNotiCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  fbCardDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 10 },
  fbSubActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  fbPlusCircleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  fbSubActionText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },

  fbShortcutsSection: { marginBottom: 20 },
  fbSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12, paddingHorizontal: 2 },
  fbShortcutsScroll: { gap: 12, paddingHorizontal: 2, paddingBottom: 4 },
  fbShortcutItem: { alignItems: 'center', width: 76 },
  fbShortcutThumbWrap: { width: 68, height: 68, borderRadius: 16, position: 'relative', marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  fbShortcutCenterIcon: { alignItems: 'center', justifyContent: 'center' },
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
  fbShortcutLabel: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign: 'center' },

  fbGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  fbGridCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 120,
    justifyContent: 'space-between',
    ...Shadows.soft,
  },
  fbGridCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fbGridIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  fbAesBadge: { backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#BAE6FD' },
  fbAesBadgeText: { fontSize: 9, fontWeight: '700', color: '#0284C7' },
  fbGridCardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4, lineHeight: 20 },
  fbGridCardSub: { fontSize: 11, color: '#64748B', lineHeight: 15 },

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
  fbViewMoreText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },

  fbAccordionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  fbAccordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  fbAccordionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fbAccordionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  fbAccordionBody: { paddingHorizontal: 16, paddingBottom: 12 },
  fbAccordionSubRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  fbSubIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fbSubRowTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  fbSubRowSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  fbSubDivider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 46 },

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
  fbLogoutBtnText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});

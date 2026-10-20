// ============================================================================
// MÀN HÌNH CÀI ĐẶT HỆ THỐNG (SETTINGS SCREEN)
// Hệ thống: Smart Elderly Care AI (SECA)
// Giao diện: Đồng bộ tông cam chủ đạo (Colors.primary) & hỗ trợ Sáng / Tối
// Chức năng:
//   - Quản trị hồ sơ người giám sát & Hồ sơ bệnh án người cao tuổi (Bảo mật AES-256)
//   - Cài đặt chung (Vùng, Ngôn ngữ Tiếng Việt / Tiếng Anh, Chế độ Sáng / Tối)
//   - Khả năng tiếp cận (Kích thước phông chữ tùy chỉnh & Độ tương phản hiển thị)
//   - Thông tin (Điều khoản sử dụng & Phiên bản ứng dụng)
//   - Thiết lập thông báo & Phản hồi rung khi có cảnh báo hệ thống
// ============================================================================

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Switch,
  Vibration,
  PanResponder,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Shadows } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import i18n from '../../../i18n/config';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { usersApi, supportApi } from '../../../services/api';

const FONT_SCALE_LEVELS = [0.8, 1, 1.2, 1.5, 1.8] as const;

export default function SettingsScreen({ navigation, route }: any) {
  const {
    isDarkMode,
    setDarkMode,
    fontScale,
    fontSizeMode: storeFontSizeMode,
    setFontScale,
    setFontSizeMode: setStoreFontSizeMode,
  } = useTheme();

  const [isNotificationSettingsVisible, setNotificationSettingsVisible] = React.useState(false);
  const [isVibrationDetailVisible, setVibrationDetailVisible] = React.useState(false);
  const [isAboutInfoVisible, setAboutInfoVisible] = React.useState(false);
  const [infoDetail, setInfoDetail] = React.useState<'terms' | 'app' | null>(null);
  const [isGeneralSettingsVisible, setGeneralSettingsVisible] = React.useState(false);
  const [isLanguageVisible, setLanguageVisible] = React.useState(false);
  const [languageMode, setLanguageMode] = React.useState<'vi' | 'en'>(
    (i18n.language === 'en' ? 'en' : 'vi') as 'vi' | 'en'
  );
  const [fontSizeMode, setFontSizeMode] = React.useState<'system' | 'custom'>(storeFontSizeMode || 'system');
  const [customFontScale, setCustomFontScale] = React.useState(() => {
    const idx = FONT_SCALE_LEVELS.indexOf(fontScale as any);
    return idx >= 0 ? idx : 2;
  });
  const [isAccessibilityVisible, setAccessibilityVisible] = React.useState(false);
  const [isFontSizeVisible, setFontSizeVisible] = React.useState(false);
  const [isAppearanceVisible, setAppearanceVisible] = React.useState(false);
  const [appearanceMode, setAppearanceMode] = React.useState<'light' | 'dark'>(
    isDarkMode ? 'dark' : 'light'
  );
  const [highContrastEnabled, setHighContrastEnabled] = React.useState(false);
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const sliderTrackPosition = React.useRef(0);

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [alertSoundEnabled, setAlertSoundEnabled] = React.useState(true);
  const [vibrationEnabled, setVibrationEnabled] = React.useState(true);
  const [criticalAlertEnabled, setCriticalAlertEnabled] = React.useState(true);

  React.useEffect(() => {
    setAppearanceMode(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

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
        const backendFontScale = res?.data?.custom_font_scale;
        if (Number.isInteger(backendFontScale) && backendFontScale >= 0 && backendFontScale <= 4) {
          setCustomFontScale(backendFontScale);
        }
      })
      .catch(() => {});
  }, []);

  const isFromProfileRef = React.useRef(false);

  React.useEffect(() => {
    const initialModal = route?.params?.initialModal;
    if (route?.params?.fromProfile || initialModal) {
      isFromProfileRef.current = true;
    }
    if (!initialModal) return;

    if (initialModal === 'appInfo') {
      setInfoDetail('app');
      setAboutInfoVisible(true);
    } else if (initialModal === 'notifications') {
      setNotificationSettingsVisible(true);
    } else if (initialModal === 'fontSize') {
      setFontSizeVisible(true);
    } else if (initialModal === 'appearance') {
      setAppearanceVisible(true);
    }
    navigation?.setParams?.({ initialModal: undefined, fromProfile: undefined });
  }, [route?.params?.initialModal, route?.params?.fromProfile, navigation]);

  const closeWithProfileReturn = React.useCallback((closeFn?: () => void) => {
    if (closeFn) closeFn();
    if (isFromProfileRef.current) {
      isFromProfileRef.current = false;
      navigation?.goBack?.();
    }
  }, [navigation]);

  const [docData, setDocData] = React.useState<any>(null);

  React.useEffect(() => {
    if (infoDetail === 'app' && !docData) {
      supportApi.getDocumentation()
        .then((res) => {
          if (res?.data) {
            setDocData(res.data);
          }
        })
        .catch((err) => {
          console.warn('[SettingsScreen] Không thể tải tài liệu hướng dẫn:', err);
        });
    }
  }, [infoDetail, docData]);

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
      console.warn('[SettingsScreen] Error changing language:', err);
      setLanguageVisible(false);
    }
  };

  const saveFontPreferences = React.useCallback(async (mode: 'system' | 'custom', scale: number) => {
    try {
      await usersApi.updateFontPreferences(mode, scale);
    } catch (err) {
      console.warn('[SettingsScreen] Could not save font-size preferences:', err);
    }
  }, []);

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

  const handleVibrationToggle = (value: boolean) => {
    setVibrationEnabled(value);

    if (value) {
      Vibration.vibrate(80);
      return;
    }

    Vibration.cancel();
  };

  return (
    <SafeAreaView
      style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
      edges={['top']}
    >
      <View style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]}>
        <View style={styles.settingsHeaderRow}>
          <TouchableOpacity
            style={[
              styles.backButton,
              styles.settingsBackButton,
              isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
            ]}
            onPress={() => navigation?.goBack?.()}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back-outline"
              size={24}
              color={isDarkMode ? '#F8FAFC' : Colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài đặt</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.settingsCard}>
            <View style={styles.settingsList}>
              {/* Khối 1: Hồ sơ người giám sát & Hồ sơ bệnh án người cao tuổi */}
              <View
                style={[
                  styles.settingsGroupCard,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
              >
                {/* Mục 1: Hồ sơ người giám sát */}
                <TouchableOpacity
                  style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    navigation.navigate('Main', {
                      screen: 'Profile',
                      params: { openUserMenu: true },
                    });
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View
                      style={[
                        styles.settingsIconWrap,
                        { backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.16)' : Colors.primaryLight },
                      ]}
                    >
                      <Ionicons name="person-circle-outline" size={22} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>
                        Hồ sơ người giám sát
                      </Text>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Tài khoản người thân theo dõi, SĐT liên hệ khẩn cấp
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>

                {/* Mục 2: Hồ sơ bệnh án người cao tuổi */}
                <TouchableOpacity
                  style={[
                    styles.settingsItem,
                    styles.settingsItemLast,
                    isDarkMode && { borderBottomColor: '#334155' },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('PatientMedicalRecord')}
                >
                  <View style={styles.settingsLeft}>
                    <View
                      style={[
                        styles.settingsIconWrap,
                        { backgroundColor: isDarkMode ? '#082F49' : '#E0F2FE' },
                      ]}
                    >
                      <Ionicons name="medkit-outline" size={21} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>
                          Hồ sơ bệnh án người cao tuổi
                        </Text>
                        <View
                          style={[
                            styles.profileAesBadge,
                            isDarkMode && { backgroundColor: 'rgba(255, 122, 0, 0.16)' },
                          ]}
                        >
                          <Text style={[styles.profileAesBadgeText, isDarkMode && { color: Colors.primary }]}>
                            Bảo mật AES-256
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Thông tin cụ, bệnh nền, nhóm máu &amp; đơn thuốc
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Khối 2: Nhóm 3 mục */}
              <View
                style={[
                  styles.settingsGroupCard,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
              >
                <TouchableOpacity
                  style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                  activeOpacity={0.8}
                  onPress={() => setGeneralSettingsVisible(true)}
                >
                  <View style={styles.settingsLeft}>
                    <View
                      style={[
                        styles.settingsIconWrap,
                        { backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.16)' : Colors.primaryLight },
                      ]}
                    >
                      <Ionicons name="settings-outline" size={21} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>
                        Cài đặt chung
                      </Text>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Vùng, ngôn ngữ giao diện &amp; chế độ Sáng / Tối
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                  activeOpacity={0.8}
                  onPress={() => setAccessibilityVisible(true)}
                >
                  <View style={styles.settingsLeft}>
                    <View
                      style={[
                        styles.settingsIconWrap,
                        { backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5' },
                      ]}
                    >
                      <Ionicons name="accessibility-outline" size={21} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>
                        Khả năng tiếp cận
                      </Text>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Kích thước phông chữ &amp; độ tương phản hiển thị
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsItem, styles.settingsItemLast]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setInfoDetail(null);
                    setAboutInfoVisible(true);
                  }}
                >
                  <View style={styles.settingsLeft}>
                    <View
                      style={[
                        styles.settingsIconWrap,
                        { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' },
                      ]}
                    >
                      <Ionicons name="information-circle-outline" size={21} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>
                        Thông tin
                      </Text>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Điều khoản sử dụng &amp; phiên bản ứng dụng
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Khối 3: Nhóm 2 mục */}
              <View
                style={[
                  styles.settingsGroupCard,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
              >
                <TouchableOpacity
                  style={[styles.settingsItem, isDarkMode && { borderBottomColor: '#334155' }]}
                  activeOpacity={0.8}
                  onPress={() => setNotificationSettingsVisible(true)}
                >
                  <View style={styles.settingsLeft}>
                    <View
                      style={[
                        styles.settingsIconWrap,
                        { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7' },
                      ]}
                    >
                      <Ionicons name="notifications-outline" size={21} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>
                        Thiết lập thông báo
                      </Text>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Cảnh báo sức khỏe, âm thanh &amp; trường hợp khẩn cấp
                      </Text>
                    </View>
                  </View>
                  <View style={styles.settingsRightStatus}>
                    <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsItem, styles.settingsItemLast]}
                  activeOpacity={0.8}
                  onPress={() => setVibrationDetailVisible(true)}
                >
                  <View style={styles.settingsLeft}>
                    <View
                      style={[
                        styles.settingsIconWrap,
                        { backgroundColor: isDarkMode ? 'rgba(255, 122, 0, 0.16)' : Colors.primaryLight },
                      ]}
                    >
                      <Ionicons name="phone-portrait-outline" size={21} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingsLabel, isDarkMode ? { color: '#F8FAFC' } : { color: '#0F172A' }]}>
                        Rung
                      </Text>
                      <Text style={[styles.settingsItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        Phản hồi rung khi có cảnh báo hệ thống
                      </Text>
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
      </View>

      {/* Modal Khả năng tiếp cận */}
      <Modal
        transparent
        visible={isAccessibilityVisible}
        animationType="slide"
        onRequestClose={() => setAccessibilityVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => setAccessibilityVisible(false)}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => setAccessibilityVisible(false)}
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
                  <Text style={[styles.accessibilityValue, { color: Colors.primary, fontWeight: '600', fontSize: 15 }]}>
                    {fontSizeMode === 'system' ? 'Theo hệ thống' : 'Tùy chỉnh'}
                  </Text>
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

      {/* Modal Kích thước phông chữ */}
      <Modal
        transparent
        visible={isFontSizeVisible}
        animationType="slide"
        onRequestClose={() => closeWithProfileReturn(() => setFontSizeVisible(false))}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => closeWithProfileReturn(() => setFontSizeVisible(false))}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => closeWithProfileReturn(() => setFontSizeVisible(false))}
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

              <Text style={[styles.fontSizeLink, { color: Colors.primary }]}>Cách sử dụng tính năng Zoom</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Thông tin */}
      <Modal
        transparent
        visible={isAboutInfoVisible}
        animationType="slide"
        onRequestClose={() => closeWithProfileReturn(() => { setAboutInfoVisible(false); setInfoDetail(null); })}
      >
        <Pressable
          style={[styles.infoOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => closeWithProfileReturn(() => { setAboutInfoVisible(false); setInfoDetail(null); })}
        >
          <Pressable style={[styles.infoScreen, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.infoHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.infoBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => {
                  closeWithProfileReturn(() => {
                    setAboutInfoVisible(false);
                    setInfoDetail(null);
                  });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.infoTitle, isDarkMode && { color: '#F8FAFC' }]}>
                {infoDetail === 'terms'
                  ? 'Điều khoản sử dụng'
                  : infoDetail === 'app'
                    ? 'Thông tin ứng dụng'
                    : 'Thông tin'}
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
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.infoDetailContent}>
                {infoDetail === 'terms' ? (
                  <>
                    <Text style={[styles.infoDetailHeading, isDarkMode && { color: '#F8FAFC' }]}>
                      Điều khoản sử dụng
                    </Text>
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
                    <View style={[styles.appInfoIcon, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                      <Image
                        source={require('../../../../assets/logo.png')}
                        style={styles.appInfoLogo}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={[styles.infoDetailHeading, isDarkMode && { color: '#F8FAFC' }]}>
                      {docData?.project_name || 'Smart Elderly Care AI'}
                    </Text>
                    <Text style={[styles.appInfoVersion, isDarkMode && { color: '#94A3B8' }]}>
                      {docData ? `${docData.project_code} • Phiên bản ${docData.version}` : 'C1SE.34 • Phiên bản 1.0.0'}
                    </Text>
                    <Text style={[styles.infoDetailText, isDarkMode && { color: '#94A3B8' }]}>
                      {docData?.description || 'Hệ thống giám sát thông minh giúp gia đình theo dõi sức khỏe, thiết bị và nhận cảnh báo kịp thời.'}
                    </Text>

                    {/* Khối Tổng đài CSKH 24/7 */}
                    <View style={[styles.docHotlineCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                      <View style={[styles.docHotlineIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="headset" size={24} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.docHotlineTitle, isDarkMode && { color: '#F8FAFC' }]}>
                          Tổng đài hỗ trợ kỹ thuật CSKH 24/7
                        </Text>
                        <Text style={styles.docHotlineSub}>
                          Hỗ trợ kết nối camera, vòng tay, hub AI
                        </Text>
                        <TouchableOpacity
                          style={styles.docHotlineButton}
                          activeOpacity={0.8}
                          onPress={() => Linking.openURL('tel:0898230852')}
                        >
                          <Ionicons name="call" size={15} color="#FFFFFF" />
                          <Text style={styles.docHotlineButtonText}>Gọi ngay: 0898230852</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Danh mục Hướng dẫn sử dụng chi tiết từ Backend */}
                    <Text style={[styles.docSectionTitle, isDarkMode && { color: '#F8FAFC' }]}>
                      📖 Hướng dẫn sử dụng thiết bị
                    </Text>

                    {(docData?.user_guides || [
                      {
                        id: 'smartband',
                        title: 'Kết nối Vòng đeo tay thông minh (BLE Band)',
                        icon: 'watch-outline',
                        badge: 'BLE 5.0',
                        description: 'Đo nhịp tim, SpO2, bước chân và thân nhiệt liên tục theo thời gian thực.',
                        steps: [
                          'Bước 1: Bật Bluetooth trên điện thoại hoặc đặt vòng tay gần Edge Hub.',
                          'Bước 2: Mở ứng dụng, chọn Thiết bị -> (+) Thêm thiết bị.',
                          'Bước 3: Chọn vòng tay đo sinh hiệu và nhấn Ghép nối.',
                        ],
                      },
                      {
                        id: 'camera',
                        title: 'Cài đặt Camera AI phát hiện té ngã',
                        icon: 'videocam-outline',
                        badge: 'YOLOv8 AI',
                        description: 'Phát hiện sự cố ngã tức thời bằng mô hình nhận diện tư thế trên Edge Hub.',
                        steps: [
                          'Bước 1: Lắp camera ở độ cao 2m - 2.5m bao quát phòng khách / phòng ngủ.',
                          'Bước 2: Kết nối camera vào cùng mạng WiFi với Edge Hub AI.',
                          'Bước 3: Quét mã QR hoặc nhập luồng RTSP camera vào ứng dụng.',
                        ],
                      },
                      {
                        id: 'hub',
                        title: 'Thiết lập bộ Hub AI trung tâm (Edge Hub)',
                        icon: 'hardware-chip-outline',
                        badge: 'Edge Hub',
                        description: 'Xử lý hình ảnh AI cục bộ, còi báo động tại chỗ và kết nối đám mây.',
                        steps: [
                          'Bước 1: Cắm nguồn Type-C và kết nối dây mạng LAN hoặc WiFi cho Hub.',
                          'Bước 2: Mở app và quét mã QR ở mặt đáy Edge Hub để gán vào nhà.',
                        ],
                      },
                    ]).map((guide: any) => (
                      <View
                        key={guide.id}
                        style={[
                          styles.docGuideCard,
                          isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                        ]}
                      >
                        <View style={styles.docGuideHeader}>
                          <View style={styles.docGuideIconBox}>
                            <Ionicons name={guide.icon || 'book-outline'} size={18} color={Colors.primary} />
                          </View>
                          <Text style={[styles.docGuideTitle, isDarkMode && { color: '#F8FAFC' }]}>
                            {guide.title}
                          </Text>
                          <View style={styles.docGuideBadge}>
                            <Text style={styles.docGuideBadgeText}>{guide.badge}</Text>
                          </View>
                        </View>
                        <Text style={[styles.docGuideDesc, isDarkMode && { color: '#94A3B8' }]}>
                          {guide.description}
                        </Text>
                        <View style={styles.docGuideStepsWrap}>
                          {guide.steps?.map((step: string, sIdx: number) => (
                            <Text key={sIdx} style={[styles.docGuideStep, isDarkMode && { color: '#CBD5E1' }]}>
                              {step}
                            </Text>
                          ))}
                        </View>
                      </View>
                    ))}

                    <Text style={[styles.appInfoCopyright, isDarkMode && { color: '#64748B' }]}>
                      © 2026 Smart Elderly Care AI • Đồ án tốt nghiệp C1SE.34
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Rung */}
      <Modal
        transparent
        visible={isVibrationDetailVisible}
        animationType="slide"
        onRequestClose={() => setVibrationDetailVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => setVibrationDetailVisible(false)}
        >
          <Pressable style={[styles.vibrationDetailSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => setVibrationDetailVisible(false)}
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

      {/* Modal Thiết lập thông báo */}
      <Modal
        transparent
        visible={isNotificationSettingsVisible}
        animationType="slide"
        onRequestClose={() => closeWithProfileReturn(() => setNotificationSettingsVisible(false))}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => closeWithProfileReturn(() => setNotificationSettingsVisible(false))}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => closeWithProfileReturn(() => setNotificationSettingsVisible(false))}
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
                    onValueChange={setNotificationsEnabled}
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
                    onValueChange={setAlertSoundEnabled}
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

      {/* Modal Cài đặt chung */}
      <Modal
        transparent
        visible={isGeneralSettingsVisible}
        animationType="slide"
        onRequestClose={() => setGeneralSettingsVisible(false)}
      >
        <Pressable
          style={[styles.settingsOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => setGeneralSettingsVisible(false)}
        >
          <Pressable style={[styles.settingsSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.settingsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  styles.settingsBackButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => setGeneralSettingsVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.settingsTitle, isDarkMode && { color: '#F8FAFC' }]}>Cài đặt chung</Text>
            </View>

            <View
              style={[
                styles.generalSettingsList,
                isDarkMode && {
                  backgroundColor: '#1E293B',
                  borderColor: '#334155',
                  borderWidth: 1,
                  borderRadius: 18,
                  overflow: 'hidden',
                },
              ]}
            >
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
                  <Text style={[styles.generalRowValue, { color: Colors.primary, fontWeight: '600' }]}>
                    {languageMode === 'vi' ? 'Việt Nam' : 'English'}
                  </Text>
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
                  <Text style={[styles.generalRowValue, { color: Colors.primary, fontWeight: '600' }]}>
                    {appearanceMode === 'light' ? 'Màu sáng' : 'Tối'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Ngôn ngữ */}
      <Modal
        transparent
        visible={isLanguageVisible}
        animationType="slide"
        onRequestClose={() => setLanguageVisible(false)}
      >
        <Pressable
          style={[styles.appearanceOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => setLanguageVisible(false)}
        >
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={[
                  styles.appearanceCloseButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
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
              <TouchableOpacity
                style={[
                  styles.appearanceOptionRow,
                  isDarkMode
                    ? { backgroundColor: '#1E293B', borderBottomColor: '#334155' }
                    : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB' },
                  languageMode === 'vi' &&
                    (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
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
                  isDarkMode
                    ? { backgroundColor: '#1E293B', borderBottomColor: '#334155', borderBottomWidth: 0 }
                    : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 0 },
                  languageMode === 'en' &&
                    (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
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

      {/* Modal Vẻ bề ngoài / Chế độ tối */}
      <Modal
        transparent
        visible={isAppearanceVisible}
        animationType="slide"
        onRequestClose={() => closeWithProfileReturn(() => setAppearanceVisible(false))}
      >
        <Pressable
          style={[styles.appearanceOverlay, isDarkMode && { backgroundColor: '#0B0F19' }]}
          onPress={() => closeWithProfileReturn(() => setAppearanceVisible(false))}
        >
          <Pressable style={[styles.appearanceSheet, isDarkMode && { backgroundColor: '#0B0F19' }]} onPress={() => {}}>
            <View style={styles.appearanceHeader}>
              <TouchableOpacity
                style={[
                  styles.appearanceCloseButton,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => closeWithProfileReturn(() => setAppearanceVisible(false))}
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
                  appearanceMode === 'light' &&
                    (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setAppearanceMode('light');
                  setDarkMode(false);
                  closeWithProfileReturn(() => setAppearanceVisible(false));
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
                  isDarkMode
                    ? { backgroundColor: '#1E293B', borderBottomColor: '#334155', borderBottomWidth: 0 }
                    : { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 0 },
                  appearanceMode === 'dark' &&
                    (isDarkMode ? { backgroundColor: '#0F172A' } : styles.appearanceOptionRowSelected),
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setAppearanceMode('dark');
                  setDarkMode(true);
                  closeWithProfileReturn(() => setAppearanceVisible(false));
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    padding: 8,
  },
  appInfoLogo: {
    width: '100%',
    height: '100%',
  },
  appInfoVersion: {
    marginBottom: 24,
    fontSize: 14,
    color: '#64748B',
  },
  appInfoCopyright: {
    marginTop: 18,
    marginBottom: 24,
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  docHotlineCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docHotlineIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docHotlineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  docHotlineSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 8,
  },
  docHotlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  docHotlineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  docSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    width: '100%',
    textAlign: 'left',
    marginBottom: 12,
  },
  docGuideCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  docGuideIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docGuideTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  docGuideBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  docGuideBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  docGuideDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  docGuideStepsWrap: {
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  docGuideStep: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  generalSettingsList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
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
});

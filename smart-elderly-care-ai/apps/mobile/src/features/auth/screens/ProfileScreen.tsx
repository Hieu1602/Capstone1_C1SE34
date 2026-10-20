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
import api, { usersApi } from '../../../services/api';
import {
  launchEmergencyCall,
  launchSupportCall,
  SUPPORT_HOTLINE_NUMBER,
} from '../../../services/emergency';

export default function ProfileScreen({ navigation, route }: any) {
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
  const { isDarkMode, colors } = useTheme();

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
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [isCustomerSupportVisible, setCustomerSupportVisible] = React.useState(false);

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
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.fbProfileName, isDarkMode && { color: colors.textPrimary }]}>
                {resolvedDisplayName}
              </Text>
              <Text style={[styles.fbProfileRole, isDarkMode && { color: colors.textSecondary }]}>
                {profilePhone ? `SĐT: ${profilePhone}` : 'Tài khoản người giám sát'}
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

              {/* Ô 11: Chuyển vai trò Bác sĩ */}
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
                onPress={() => navigation.navigate('Settings', { initialModal: 'appInfo' })}
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
                onPress={() => navigation.navigate('Settings', { initialModal: 'notifications' })}
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
                onPress={() => navigation.navigate('Settings', { initialModal: 'fontSize' })}
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
                onPress={() => navigation.navigate('Settings', { initialModal: 'appearance' })}
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
});

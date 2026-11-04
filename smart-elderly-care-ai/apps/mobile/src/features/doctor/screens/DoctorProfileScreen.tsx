// DoctorProfileScreen.tsx
// Hồ sơ Bác sĩ chuyên môn, đổi ảnh đại diện, giao diện & tài khoản

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { doctorApi, usersApi } from '../../../services/api';
import { resolveAvatarUrl } from '../../auth/hooks/useProfileManager';
import { ViewAvatarModal } from '../../auth/components/profile';
import {
  DoctorProfileInfo,
  DoctorProfileCard,
  DoctorProfileSettings,
  DoctorEditProfileModal,
  DoctorChangePasswordModal,
  DoctorLogoutModal,
} from '../components';

export type { DoctorProfileInfo };

export default function DoctorProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const { userName, userPhone, avatarUrl, avatar_url, setAvatar, setProfile, logout } = useAuthStore();

  const [docInfo, setDocInfo] = useState<DoctorProfileInfo>({
    name: userName || 'Bác sĩ',
    degree: 'Bác sĩ chuyên khoa',
    specialty: 'Y học Gia đình & Lão khoa',
    hospital: 'Hệ thống Smart Elderly Care AI',
    department: 'Khoa Chăm sóc Người cao tuổi',
    phone: userPhone || '',
    cchn_number: '028491/BYT-CCHN',
  });

  const [patientCount, setPatientCount] = useState<number>(0);
  const [appointmentCount, setAppointmentCount] = useState<number>(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(() => {
    const raw = avatarUrl || avatar_url;
    return raw && !raw.startsWith('blob:') ? resolveAvatarUrl(raw) : null;
  });

  // Modals state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(docInfo.name);
  const [editDegree, setEditDegree] = useState(docInfo.degree);
  const [editSpecialty, setEditSpecialty] = useState(docInfo.specialty);
  const [editHospital, setEditHospital] = useState(docInfo.hospital);
  const [editDepartment, setEditDepartment] = useState(docInfo.department);
  const [editPhone, setEditPhone] = useState(docInfo.phone);
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(avatarUri);
  const [isViewingAvatar, setIsViewingAvatar] = useState(false);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const fetchDoctorStats = useCallback(async () => {
    try {
      const [patientsRes, appointmentsRes] = await Promise.allSettled([
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
      ]);
      if (patientsRes.status === 'fulfilled' && Array.isArray(patientsRes.value.data)) {
        setPatientCount(patientsRes.value.data.length);
      }
      if (appointmentsRes.status === 'fulfilled' && Array.isArray(appointmentsRes.value.data)) {
        setAppointmentCount(appointmentsRes.value.data.length);
      }
    } catch {
      // Giữ số liệu hiện tại
    }
  }, []);

  useEffect(() => {
    fetchDoctorStats();
  }, [fetchDoctorStats]);

  useFocusEffect(
    useCallback(() => {
      fetchDoctorStats();
    }, [fetchDoctorStats])
  );

  useEffect(() => {
    const raw = avatarUrl || avatar_url;
    if (raw && !raw.startsWith('blob:')) {
      const resolved = resolveAvatarUrl(raw);
      if (resolved) {
        setAvatarUri(resolved);
      }
    }
  }, [avatarUrl, avatar_url]);

  useEffect(() => {
    const loadSavedProfile = async () => {
      try {
        const raw = await AsyncStorage.getItem('doctor_profile_custom');
        if (raw) {
          const parsed = JSON.parse(raw);
          setDocInfo((prev) => ({
            ...prev,
            ...parsed,
            name: parsed.name || userName || 'Bác sĩ',
            phone: parsed.phone || userPhone || '',
          }));
          if (parsed.avatarUri) {
            setAvatarUri(parsed.avatarUri);
          }
        }
      } catch {}
    };
    loadSavedProfile();
  }, [userName, userPhone]);

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Quyền bị từ chối', 'Ứng dụng cần quyền truy cập thư viện để chọn ảnh đại diện.');
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
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const selectedUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setEditAvatarUri(selectedUri);
        setAvatarUri(selectedUri);
        setAvatar(selectedUri);
        setProfile({ avatar_url: selectedUri });
        if (selectedUri.startsWith('data:image')) {
          try {
            await usersApi.uploadAvatarBase64(selectedUri);
          } catch {
            try {
              await usersApi.updateMe({ avatar_url: selectedUri });
            } catch {}
          }
        }
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện.');
    }
  };

  const handleOpenEditModal = () => {
    setEditName(docInfo.name);
    setEditDegree(docInfo.degree);
    setEditSpecialty(docInfo.specialty);
    setEditHospital(docInfo.hospital);
    setEditDepartment(docInfo.department);
    setEditPhone(docInfo.phone);
    setEditAvatarUri(avatarUri);
    setEditModalVisible(true);
  };

  const executeSaveProfile = async () => {
    const updated: DoctorProfileInfo = {
      name: editName.trim(),
      degree: editDegree.trim(),
      specialty: editSpecialty.trim(),
      hospital: editHospital.trim(),
      department: editDepartment.trim(),
      phone: editPhone.trim(),
      avatarUri: editAvatarUri,
    };
    setDocInfo(updated);
    if (editAvatarUri) {
      setAvatarUri(editAvatarUri);
      setAvatar(editAvatarUri);
      setProfile({ avatar_url: editAvatarUri });
      // Đồng bộ ảnh đại diện lên backend
      if (editAvatarUri.startsWith('data:image')) {
        try {
          await usersApi.uploadAvatarBase64(editAvatarUri);
        } catch {
          try {
            await usersApi.updateMe({ avatar_url: editAvatarUri });
          } catch {}
        }
      }
    }
    try {
      await AsyncStorage.setItem('doctor_profile_custom', JSON.stringify(updated));
    } catch {}
    setEditModalVisible(false);
    Alert.alert('Thành công', 'Đã cập nhật hồ sơ chuyên môn Bác sĩ thành công.');
  };

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ tên bác sĩ.');
      return;
    }
    executeSaveProfile();
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
  };

  const executeSavePassword = async () => {
    try {
      setIsChangingPassword(true);
      await usersApi.changePassword({
        current_password: oldPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });

      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Thành công 🎉', 'Đã thay đổi mật khẩu tài khoản Bác sĩ thành công.');
    } catch (err: any) {
      let errorMsg = 'Không thể thay đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.';
      if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail) && detail[0]?.msg) {
          errorMsg = String(detail[0].msg).replace(/^Value error,\s*/i, '');
        }
      } else if (err?.message) {
        errorMsg = err.message;
      }
      Alert.alert('Đổi mật khẩu thất bại', errorMsg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePassword = () => {
    if (!oldPassword.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 16) {
      Alert.alert('Mật khẩu không hợp lệ', 'Mật khẩu mới phải từ 8 đến 16 ký tự.');
      return;
    }
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      Alert.alert(
        'Mật khẩu chưa đủ mạnh',
        'Mật khẩu mới phải bao gồm đầy đủ: chữ hoa, chữ thường, chữ số và ký tự đặc biệt (!@#$%^&*...).'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Mật khẩu xác nhận không trùng khớp với mật khẩu mới.');
      return;
    }
    if (oldPassword === newPassword) {
      Alert.alert('Mật khẩu trùng lặp', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    // Thực hiện lưu trực tiếp, không dùng Alert.alert lồng xác nhận (vốn bị nuốt callback trên Expo Web)
    executeSavePassword();
  };

  const handleClosePasswordModal = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalVisible(false);
  };

  const performLogout = async () => {
    try {
      setLogoutModalVisible(false);
      logout();
      await useAuthStore.persist?.clearStorage?.();
      await AsyncStorage.multiRemove([
        'auth-storage',
        'auth_token',
        'token',
        'user_role',
        'user_info',
      ]);
    } catch (e) {
      console.warn('Lỗi khi đăng xuất tài khoản Bác sĩ:', e);
    }

    try {
      if (navigation?.getParent()) {
        navigation.getParent()?.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (navigation?.navigate) {
        navigation.navigate('Login');
      }
    } catch (err) {
      console.warn('Lỗi điều hướng sau đăng xuất:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Hồ Sơ Bác Sĩ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* PROFILE CARD */}
        <DoctorProfileCard
          info={docInfo}
          avatarUri={avatarUri}
          patientCount={patientCount}
          appointmentCount={appointmentCount}
          onPickImage={pickImage}
          onViewAvatar={() => setIsViewingAvatar(true)}
          onEditProfile={handleOpenEditModal}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* TIỆN ÍCH LÂM SÀNG, BẢN QUYỀN & NÚT ĐĂNG XUẤT */}
        <DoctorProfileSettings
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          onOpenPasswordModal={() => setPasswordModalVisible(true)}
          onOpenLogoutModal={() => setLogoutModalVisible(true)}
          colors={colors}
        />
      </ScrollView>

      {/* MODAL 1: CHỈNH SỬA THÔNG TIN */}
      <DoctorEditProfileModal
        visible={editModalVisible}
        editName={editName}
        editDegree={editDegree}
        editSpecialty={editSpecialty}
        editHospital={editHospital}
        editDepartment={editDepartment}
        editPhone={editPhone}
        editAvatarUri={editAvatarUri}
        onChangeName={setEditName}
        onChangeDegree={setEditDegree}
        onChangeSpecialty={setEditSpecialty}
        onChangeHospital={setEditHospital}
        onChangeDepartment={setEditDepartment}
        onChangePhone={setEditPhone}
        onPickImage={pickImage}
        onSave={handleSaveProfile}
        onClose={handleCloseEditModal}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* MODAL 2: ĐỔI MẬT KHẨU */}
      <DoctorChangePasswordModal
        visible={passwordModalVisible}
        oldPassword={oldPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onChangeOldPassword={setOldPassword}
        onChangeNewPassword={setNewPassword}
        onChangeConfirmPassword={setConfirmPassword}
        onSave={handleSavePassword}
        onClose={handleClosePasswordModal}
        isDarkMode={isDarkMode}
        colors={colors}
        isSubmitting={isChangingPassword}
      />

      {/* MODAL 3: XÁC NHẬN ĐĂNG XUẤT */}
      <DoctorLogoutModal
        visible={logoutModalVisible}
        onConfirm={performLogout}
        onClose={() => setLogoutModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* MODAL 4: XEM AVATAR BÁC SĨ (CHẾ ĐỘ XEM, CÓ NÚT ĐỔI RIÊNG) */}
      <ViewAvatarModal
        visible={isViewingAvatar}
        avatarUri={avatarUri}
        displayName={docInfo.name || 'Bác sĩ'}
        isDarkMode={isDarkMode}
        onClose={() => setIsViewingAvatar(false)}
        onEditAvatar={pickImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editHeaderBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0284C7',
  },
  scrollContent: { padding: 16, paddingBottom: 120 },
});

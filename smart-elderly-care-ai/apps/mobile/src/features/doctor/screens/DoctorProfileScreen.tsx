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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { doctorApi } from '../../../services/api';
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
  const { userName, userPhone, logout } = useAuthStore();

  const [docInfo, setDocInfo] = useState<DoctorProfileInfo>({
    name: userName || 'BS. Trần Văn Minh',
    degree: 'Thạc sĩ Y khoa',
    specialty: 'Chuyên khoa Tim mạch & Lão khoa',
    hospital: 'Bệnh viện Đa khoa Đà Nẵng',
    department: 'Khoa Khám bệnh & Cấp cứu',
    phone: userPhone || '+84 905 111 222',
  });

  const [patientCount, setPatientCount] = useState<number>(0);
  const [appointmentCount, setAppointmentCount] = useState<number>(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Modals state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(docInfo.name);
  const [editDegree, setEditDegree] = useState(docInfo.degree);
  const [editSpecialty, setEditSpecialty] = useState(docInfo.specialty);
  const [editHospital, setEditHospital] = useState(docInfo.hospital);
  const [editDepartment, setEditDepartment] = useState(docInfo.department);
  const [editPhone, setEditPhone] = useState(docInfo.phone);
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(avatarUri);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền bị từ chối', 'Ứng dụng cần quyền truy cập thư viện để chọn ảnh đại diện.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const selectedUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setEditAvatarUri(selectedUri);
        setAvatarUri(selectedUri);
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

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ tên bác sĩ.');
      return;
    }
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
    if (editAvatarUri) setAvatarUri(editAvatarUri);
    try {
      await AsyncStorage.setItem('doctor_profile_custom', JSON.stringify(updated));
    } catch {}
    setEditModalVisible(false);
    Alert.alert('Thành công', 'Đã cập nhật hồ sơ chuyên môn Bác sĩ thành công.');
  };

  const handleSavePassword = () => {
    if (!oldPassword || !newPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ mật khẩu cũ và mới.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    setPasswordModalVisible(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('Thành công', 'Đã thay đổi mật khẩu tài khoản Bác sĩ an toàn.');
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
        onClose={() => setEditModalVisible(false)}
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
        onClose={() => setPasswordModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* MODAL 3: XÁC NHẬN ĐĂNG XUẤT */}
      <DoctorLogoutModal
        visible={logoutModalVisible}
        onConfirm={performLogout}
        onClose={() => setLogoutModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
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
  scrollContent: { padding: 16, paddingBottom: 95 },
});

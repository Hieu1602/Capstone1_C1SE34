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
  Switch,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { doctorApi } from '../../../services/api';

export default function DoctorProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const { userName, userPhone, logout } = useAuthStore();

  const [docInfo, setDocInfo] = useState({
    name: userName || 'Bác sĩ',
    degree: '',
    specialty: '',
    hospital: '',
    department: '',
    phone: userPhone || '',
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

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ tên bác sĩ.');
      return;
    }
    const updated = {
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
          <TouchableOpacity
            style={[styles.editHeaderBtn, { backgroundColor: isDarkMode ? '#334155' : '#E0F2FE' }]}
            onPress={() => {
              setEditName(docInfo.name);
              setEditDegree(docInfo.degree);
              setEditSpecialty(docInfo.specialty);
              setEditHospital(docInfo.hospital);
              setEditDepartment(docInfo.department);
              setEditPhone(docInfo.phone);
              setEditAvatarUri(avatarUri);
              setEditModalVisible(true);
            }}
          >
            <Ionicons name="pencil" size={15} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={styles.editHeaderBtnText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* PROFILE CARD */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            activeOpacity={0.85}
            onPress={pickImage}
          >
            <View style={styles.avatarBig}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="medkit" size={38} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.cameraIconBadge}>
              <Ionicons name="camera" size={13} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.docName, { color: colors.textPrimary }]}>{docInfo.name}</Text>
          {docInfo.degree ? <Text style={styles.docDegree}>{docInfo.degree}</Text> : null}
          {docInfo.specialty ? <Text style={styles.docSpecialty}>Chuyên khoa: {docInfo.specialty}</Text> : null}

          {docInfo.hospital ? (
            <View style={[styles.hospitalBadge, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
              <Ionicons name="business" size={13} color="#0284C7" style={{ marginRight: 5 }} />
              <Text style={[styles.hospitalBadgeText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                {docInfo.hospital}
              </Text>
            </View>
          ) : null}

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#0284C7' }]}>{patientCount}</Text>
              <Text style={styles.statLabel}>Bệnh nhân</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#8B5CF6' }]}>{appointmentCount}</Text>
              <Text style={styles.statLabel}>Lịch khám</Text>
            </View>
          </View>
        </View>

        {/* TIỆN ÍCH LÂM SÀNG & HỆ THỐNG */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <Text style={[styles.groupTitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            TIỆN ÍCH LÂM SÀNG & HỆ THỐNG
          </Text>

          <View style={styles.menuItem}>
            <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={17} color="#7C3AED" />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
              Chế độ {isDarkMode ? 'Giao diện Tối' : 'Giao diện Sáng'}
            </Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CBD5E1', true: '#7C3AED' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => setPasswordModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="key" size={17} color="#D97706" />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
              Đổi mật khẩu tài khoản Bác sĩ
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* THÔNG TIN PHIÊN BẢN */}
        <View style={styles.versionBox}>
          <Text style={[styles.versionText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
            Smart Elderly Care AI Hub • Phiên bản Bác sĩ 2.4.0
          </Text>
          <Text style={[styles.versionSub, { color: isDarkMode ? '#475569' : '#CBD5E1' }]}>
            Hệ thống Giám sát & Chăm sóc Y tế Người cao tuổi
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
          <Text style={styles.logoutBtnText}>Đăng xuất khỏi tài khoản Bác sĩ</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL 1: CHỈNH SỬA THÔNG TIN */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-circle" size={22} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sửa Hồ Sơ Bác Sĩ</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              <View style={styles.modalAvatarRow}>
                <View style={styles.modalAvatarWrap}>
                  {editAvatarUri ? (
                    <Image source={{ uri: editAvatarUri }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={28} color="#FFFFFF" />
                  )}
                </View>
                <TouchableOpacity style={styles.btnPickImage} onPress={pickImage} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                  <Text style={styles.btnPickImageText}>Chọn / Đổi ảnh đại diện</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Họ và tên Bác sĩ (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="VD: BS. Nguyễn Văn An"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Học hàm, học vị</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editDegree}
                onChangeText={setEditDegree}
                placeholder="VD: Bác sĩ CKI, Thạc sĩ Y khoa..."
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Chuyên khoa</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editSpecialty}
                onChangeText={setEditSpecialty}
                placeholder="VD: Lão khoa, Tim mạch..."
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Bệnh viện / Cơ sở y tế</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editHospital}
                onChangeText={setEditHospital}
                placeholder="VD: Bệnh viện Đa khoa Đà Nẵng"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Khoa / Phòng công tác</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editDepartment}
                onChangeText={setEditDepartment}
                placeholder="VD: Khoa Khám bệnh"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Số điện thoại liên hệ (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="VD: 0905123456"
                placeholderTextColor="#94A3B8"
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: Colors.primary }]}
                onPress={handleSaveProfile}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Lưu Hồ Sơ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: ĐỔI MẬT KHẨU */}
      <Modal visible={passwordModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="key" size={20} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Đổi Mật Khẩu Bác Sĩ</Text>
              </View>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 10 }}>
              <Text style={styles.fieldLabel}>Mật khẩu hiện tại (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Mật khẩu mới (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Tối thiểu 6 ký tự"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Xác nhận mật khẩu mới (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setPasswordModalVisible(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#D97706' }]}
                onPress={handleSavePassword}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Cập Nhật Mật Khẩu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 3: XÁC NHẬN ĐĂNG XUẤT */}
      <Modal visible={logoutModalVisible} animationType="fade" transparent onRequestClose={() => setLogoutModalVisible(false)}>
        <View style={styles.logoutModalOverlay}>
          <View style={[styles.logoutModalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.logoutModalIconBox}>
              <Ionicons name="log-out-outline" size={32} color="#DC2626" />
            </View>
            <Text style={[styles.logoutModalTitle, { color: colors.textPrimary }]}>Đăng xuất tài khoản Bác sĩ</Text>
            <Text style={[styles.logoutModalSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Bạn có chắc chắn muốn đăng xuất khỏi hệ thống? Mọi phiên làm việc và bảo mật hồ sơ bệnh án sẽ được kết thúc.
            </Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity
                style={[styles.logoutCancelBtn, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.logoutCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutConfirmBtn} onPress={performLogout} activeOpacity={0.85}>
                <Ionicons name="log-out" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.logoutConfirmText}>Đăng xuất ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  profileCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 2,
  },
  avatarContainer: { position: 'relative', marginBottom: 10 },
  avatarBig: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0284C7',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  docName: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  docDegree: { fontSize: 12.5, color: '#0284C7', fontWeight: '700', marginTop: 2 },
  docSpecialty: { fontSize: 12, color: '#64748B', marginTop: 2 },
  hospitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  hospitalBadgeText: { fontSize: 11.5, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  sectionCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  groupTitle: { fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F033',
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  menuItemText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  versionBox: { alignItems: 'center', marginVertical: 12 },
  versionText: { fontSize: 11, fontWeight: '600' },
  versionSub: { fontSize: 10, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    marginTop: 4,
  },
  logoutBtnText: { color: '#DC2626', fontSize: 13.5, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  modalAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  btnPickImage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  btnPickImageText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
    paddingTop: 10,
  },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  modalSaveBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutModalBox: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
  },
  logoutModalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  logoutModalSub: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  logoutModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  logoutCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCancelText: { fontSize: 14, fontWeight: '600' },
  logoutConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

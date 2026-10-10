// DoctorProfileScreen.tsx
// Hồ sơ Bác sĩ gia đình, thông tin chuyên môn, đổi ảnh đại diện & đổi mật khẩu

import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';

export default function DoctorProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const { userName, userPhone, logout, toggleViewRole } = useAuthStore();

  // Thông tin chuyên môn bác sĩ
  const [docInfo, setDocInfo] = useState({
    name: userName || 'BS. Trần Văn Minh',
    degree: 'Thạc sĩ, Bác sĩ Chuyên khoa II',
    specialty: 'Tim mạch Can thiệp & Lão khoa',
    hospital: 'Bệnh viện Đa khoa Đà Nẵng',
    department: 'Khoa Hồi sức Tim mạch & Lão khoa',
    phone: userPhone || '0905 111 222',
  });

  // Ảnh đại diện bác sĩ
  const [avatarUri, setAvatarUri] = useState<string | null>(
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80'
  );

  // Modal 1: Sửa thông tin bác sĩ
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(docInfo.name);
  const [editDegree, setEditDegree] = useState(docInfo.degree);
  const [editSpecialty, setEditSpecialty] = useState(docInfo.specialty);
  const [editHospital, setEditHospital] = useState(docInfo.hospital);
  const [editDepartment, setEditDepartment] = useState(docInfo.department);
  const [editPhone, setEditPhone] = useState(docInfo.phone);
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(avatarUri);

  // Modal 2: Đổi mật khẩu
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Modal 3: Xác nhận đăng xuất
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Hàm chọn ảnh từ thư viện thiết bị
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
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const selectedUri = result.assets[0].uri;
        setEditAvatarUri(selectedUri);
        setAvatarUri(selectedUri);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện.');
    }
  };

  // Lưu sửa thông tin
  const handleSaveProfile = () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ tên bác sĩ.');
      return;
    }
    setDocInfo({
      name: editName.trim(),
      degree: editDegree.trim(),
      specialty: editSpecialty.trim(),
      hospital: editHospital.trim(),
      department: editDepartment.trim(),
      phone: editPhone.trim(),
    });
    if (editAvatarUri) {
      setAvatarUri(editAvatarUri);
    }
    setEditModalVisible(false);
    Alert.alert('Thành công', 'Đã cập nhật hồ sơ chuyên môn Bác sĩ thành công.');
  };

  // Lưu đổi mật khẩu
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

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const performLogout = async () => {
    setLogoutModalVisible(false);
    logout();
    try {
      await useAuthStore.persist?.clearStorage?.();
    } catch (e) {
      console.error('Error clearing auth storage:', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
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
        {/* DOCTOR HERO CARD */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          {/* Avatar Bác sĩ có thể chạm để đổi ảnh */}
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
          <Text style={styles.docDegree}>{docInfo.degree}</Text>
          <Text style={styles.docSpecialty}>Khoa: {docInfo.specialty}</Text>

          <View style={[styles.hospitalBadge, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
            <Ionicons name="business" size={13} color="#0284C7" style={{ marginRight: 5 }} />
            <Text style={[styles.hospitalBadgeText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
              {docInfo.hospital}
            </Text>
          </View>

          {/* 2 HỘP CHỈ SỐ HOẠT ĐỘNG Y KHOA (ĐÃ BỎ 18 ĐÃ XỬ TRÍ VÀ 98.5% TUÂN THỦ) */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#0284C7' }]}>5</Text>
              <Text style={styles.statLabel}>Bệnh nhân</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#8B5CF6' }]}>3</Text>
              <Text style={styles.statLabel}>Lịch khám</Text>
            </View>
          </View>
        </View>

        {/* TIỆN ÍCH LÂM SÀNG & HỆ THỐNG (ĐÃ BỎ PROTOCOL 115) */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border },
          ]}
        >
          <Text style={[styles.groupTitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            TIỆN ÍCH LÂM SÀNG & HỆ THỐNG
          </Text>

          {/* Chế độ Sáng / Tối */}
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

          {/* Đổi mật khẩu */}
          <TouchableOpacity
            style={styles.menuItem}
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

          {/* Chuyển sang Giao diện Người thân */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={toggleViewRole}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="swap-horizontal" size={17} color="#0284C7" />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
              Chuyển sang Giao diện Người thân
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

        {/* Nút Đăng xuất */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
          <Text style={styles.logoutBtnText}>Đăng xuất khỏi tài khoản Bác sĩ</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* =================================================================== */}
      {/* MODAL 1: CHỈNH SỬA THÔNG TIN BÁC SĨ (CÓ ĐỔI ẢNH, ĐÃ BỎ EMAIL)      */}
      {/* =================================================================== */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-circle" size={22} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Sửa Hồ Sơ Bác Sĩ
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              {/* KHU VỰC ĐỔI ẢNH ĐẠI DIỆN TRONG MODAL */}
              <View style={styles.modalAvatarRow}>
                <View style={styles.modalAvatarWrap}>
                  {editAvatarUri ? (
                    <Image source={{ uri: editAvatarUri }} style={styles.modalAvatarImage} />
                  ) : (
                    <View style={styles.modalAvatarPlaceholder}>
                      <Ionicons name="person" size={28} color="#FFFFFF" />
                    </View>
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
                placeholder="VD: BS. Trần Văn Minh"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Học hàm, học vị (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editDegree}
                onChangeText={setEditDegree}
                placeholder="VD: Thạc sĩ, Bác sĩ CKI..."
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Chuyên khoa</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editSpecialty}
                onChangeText={setEditSpecialty}
                placeholder="VD: Tim mạch Can thiệp & Lão khoa"
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
                placeholder="VD: Khoa Hồi sức Tim mạch"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Số điện thoại liên hệ (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="VD: 0905 111 222"
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

      {/* =================================================================== */}
      {/* MODAL 2: ĐỔI MẬT KHẨU TÀI KHOẢN BÁC SĨ                             */}
      {/* =================================================================== */}
      <Modal visible={passwordModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="key" size={20} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Đổi Mật Khẩu Bác Sĩ
                </Text>
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

      {/* =================================================================== */}
      {/* MODAL 3: XÁC NHẬN ĐĂNG XUẤT TÀI KHOẢN BÁC SĨ                       */}
      {/* =================================================================== */}
      <Modal
        visible={logoutModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.logoutModalBox,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={styles.logoutIconBox}>
                <Ionicons name="log-out" size={22} color="#DC2626" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginLeft: 10, fontSize: 17 }]}>
                Xác nhận Đăng xuất
              </Text>
            </View>

            <Text style={[styles.logoutModalDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Bác sĩ? Phiên làm việc hiện tại sẽ kết thúc và quay về màn hình đăng nhập.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: isDarkMode ? '#475569' : '#CBD5E1' }]}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#DC2626' }]}
                onPress={performLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  Đăng xuất
                </Text>
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
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
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

  versionBox: {
    alignItems: 'center',
    marginVertical: 12,
  },
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

  logoutModalBox: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  // Modal styles
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
  modalAvatarImage: {
    width: '100%',
    height: '100%',
  },
  modalAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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
  btnPickImageText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0284C7',
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
    marginBottom: 4,
  },
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
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});

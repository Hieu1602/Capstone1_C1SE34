// DoctorProfileScreen.tsx
// Hồ sơ Bác sĩ gia đình, thông tin chuyên môn, chứng chỉ hành nghề, cấu hình trực cấp cứu & tiện ích y khoa

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
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../../theme/colors';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';

export default function DoctorProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const { userName, userPhone, logout } = useAuthStore();

  // Thông tin chuyên môn bác sĩ
  const [docInfo, setDocInfo] = useState({
    name: userName || 'BS. Trần Văn Minh',
    degree: 'Thạc sĩ, Bác sĩ Chuyên khoa II',
    specialty: 'Tim mạch Can thiệp & Lão khoa',
    hospital: 'Bệnh viện Đa khoa Đà Nẵng',
    department: 'Khoa Hồi sức Tim mạch & Lão khoa',
    cchn: '014285/BYT-CCHN (Bộ Y tế cấp)',
    phone: userPhone || '0905 111 222',
    email: 'dr.tranvanminh@dananghospital.vn',
  });

  // Modal 1: Sửa thông tin bác sĩ
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(docInfo.name);
  const [editDegree, setEditDegree] = useState(docInfo.degree);
  const [editSpecialty, setEditSpecialty] = useState(docInfo.specialty);
  const [editHospital, setEditHospital] = useState(docInfo.hospital);
  const [editDepartment, setEditDepartment] = useState(docInfo.department);
  const [editPhone, setEditPhone] = useState(docInfo.phone);
  const [editEmail, setEditEmail] = useState(docInfo.email);

  // Modal 2: Protocol cấp cứu 115
  const [protocolModalVisible, setProtocolModalVisible] = useState(false);

  // Modal 3: Đổi mật khẩu
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
      email: editEmail.trim(),
      cchn: docInfo.cchn,
    });
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
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Bác sĩ?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleCall115 = () => {
    const url = 'tel:115';
    if (Platform.OS === 'web') {
      Alert.alert('Cuộc gọi Cấp cứu 115', 'Đang kết nối Tổng đài Cấp cứu 115...');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert('Lỗi', 'Không thể khởi chạy cuộc gọi trên thiết bị này.');
      });
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
              setEditEmail(docInfo.email);
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
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBig}>
              <Ionicons name="medkit" size={38} color="#FFFFFF" />
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            </View>
          </View>

          <Text style={[styles.docName, { color: colors.textPrimary }]}>{docInfo.name}</Text>
          <Text style={styles.docDegree}>{docInfo.degree}</Text>
          <Text style={styles.docSpecialty}>Khoa: {docInfo.specialty}</Text>

          <View style={[styles.hospitalBadge, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
            <Ionicons name="business" size={13} color="#0284C7" style={{ marginRight: 5 }} />
            <Text style={[styles.hospitalBadgeText, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
              {docInfo.hospital}
            </Text>
          </View>

          {/* 4 HỘP CHỈ SỐ HOẠT ĐỘNG Y KHOA */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#0284C7' }]}>5</Text>
              <Text style={styles.statLabel}>Bệnh nhân</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#8B5CF6' }]}>3</Text>
              <Text style={styles.statLabel}>Lịch khám</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#10B981' }]}>18</Text>
              <Text style={styles.statLabel}>Đã xử trí</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.statNum, { color: '#F59E0B' }]}>98.5%</Text>
              <Text style={styles.statLabel}>Tuân thủ</Text>
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

          {/* Xem Protocol 115 */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setProtocolModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="call" size={17} color="#DC2626" />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
              Protocol Cấp cứu 115 & Chấn thương
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>

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
      {/* MODAL 1: CHỈNH SỬA THÔNG TIN BÁC SĨ                                */}
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

              <Text style={styles.fieldLabel}>Email y tế</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                placeholder="VD: dr.minh@dananghospital.vn"
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
      {/* MODAL 2: PROTOCOL CẤP CỨU 115 & CHẤN THƯƠNG                        */}
      {/* =================================================================== */}
      <Modal visible={protocolModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="warning" size={22} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Quy Trình Cấp Cứu 115
                </Text>
              </View>
              <TouchableOpacity onPress={() => setProtocolModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              <View style={styles.protocolStepCard}>
                <Text style={styles.protocolStepNum}>BƯỚC 1</Text>
                <Text style={styles.protocolStepTitle}>Khảo sát hiện trường & Mức độ tri giác (AVPU)</Text>
                <Text style={styles.protocolStepBody}>
                  - Mở camera kiểm tra tư thế ngã của cụ.{'\n'}
                  - Gọi to kiểm tra phản ứng: Tỉnh táo (Alert), Đáp ứng tiếng gọi (Voice), Đáp ứng đau (Pain), hay Bất tỉnh (Unresponsive).
                </Text>
              </View>

              <View style={styles.protocolStepCard}>
                <Text style={styles.protocolStepNum}>BƯỚC 2</Text>
                <Text style={styles.protocolStepTitle}>Bất động cột sống cổ & Chấn thương sọ não</Text>
                <Text style={styles.protocolStepBody}>
                  - TUYỆT ĐỐI KHÔNG bế thốc hoặc di chuyển người cao tuổi nếu nghi ngờ chấn thương cột sống cổ/lưng.{'\n'}
                  - Đặt bệnh nhân nằm nghiêng an toàn nếu có nôn ói để tránh sặc đường thở.
                </Text>
              </View>

              <View style={styles.protocolStepCard}>
                <Text style={styles.protocolStepNum}>BƯỚC 3</Text>
                <Text style={styles.protocolStepTitle}>Kích hoạt Cấp cứu 115 & Báo người nhà</Text>
                <Text style={styles.protocolStepBody}>
                  - Bấm nút gọi Tổng đài 115 ngay bên dưới.{'\n'}
                  - Cung cấp chính xác địa chỉ nhà, tình trạng sinh hiệu (nhịp tim, SpO2) trích xuất từ Smartband.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setProtocolModalVisible(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#DC2626' }]}
                onPress={handleCall115}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>GỌI 115 NGAY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 3: ĐỔI MẬT KHẨU TÀI KHOẢN BÁC SĨ                             */}
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  docName: { fontSize: 20, fontWeight: '800' },
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
    gap: 8,
    marginTop: 16,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  statNum: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10.5, color: '#94A3B8', marginTop: 2, fontWeight: '600' },

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

  protocolStepCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  protocolStepNum: { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  protocolStepTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2, marginBottom: 4 },
  protocolStepBody: { fontSize: 11.5, color: '#475569', lineHeight: 17 },
});

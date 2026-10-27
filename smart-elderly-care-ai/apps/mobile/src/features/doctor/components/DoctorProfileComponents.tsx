// DoctorProfileComponents.tsx
// Tập hợp các component cho màn hình Hồ Sơ Bác Sĩ (Profile & Settings):
// 1. DoctorProfileCard: Card Header thông tin bác sĩ, số liệu thống kê & thông tin CCHN
// 2. DoctorProfileSettings: Danh mục cài đặt bảo mật, thông báo ca trực, điều khoản HL7 & nút đăng xuất
// 3. DoctorEditProfileModal: Modal chỉnh sửa thông tin cá nhân bác sĩ
// 4. DoctorChangePasswordModal: Modal thay đổi mật khẩu
// 5. DoctorLogoutModal: Modal xác nhận đăng xuất tài khoản

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { DoctorProfileInfo } from './types';

// =============================================================
// 1. CARD HỒ SƠ & THỐNG KÊ BÁC SĨ (PROFILE CARD)
// =============================================================
export interface DoctorProfileCardProps {
  info: DoctorProfileInfo;
  avatarUri: string | null;
  patientCount: number;
  appointmentCount: number;
  onPickImage: () => void;
  onEditProfile: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorProfileCard: React.FC<DoctorProfileCardProps> = ({
  info,
  avatarUri,
  patientCount,
  appointmentCount,
  onPickImage,
  onEditProfile,
  isDarkMode,
  colors,
}) => {
  const doctorInitial = (info.name || 'Bác sĩ').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'M';
  const displayPatients = patientCount;
  const completedVisits = appointmentCount;

  return (
    <View style={{ marginBottom: 12 }}>
      {/* 1. Header thông tin cá nhân: Card nền xanh nhẹ */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#F0F9FF',
            borderColor: isDarkMode ? '#334155' : '#BAE6FD',
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.editBtnCorner, { backgroundColor: isDarkMode ? '#334155' : '#EFF6FF' }]}
          onPress={onEditProfile}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={styles.editBtnText}>Chỉnh sửa</Text>
        </TouchableOpacity>

        {/* Avatar tròn đồng bộ Trang chủ */}
        <View style={styles.avatarWrapper}>
          <TouchableOpacity style={{ position: 'relative' }} activeOpacity={0.88} onPress={onPickImage}>
            <View style={styles.avatarBig}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarLetter}>{doctorInitial}</Text>
              )}
            </View>
            <View style={styles.onlineBadge} />
          </TouchableOpacity>

          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#059669" style={{ marginRight: 4 }} />
            <Text style={styles.verifiedBadgeText}>Đã xác minh CCHN</Text>
          </View>
        </View>

        {/* Họ và tên & Chuyên khoa */}
        <Text style={[styles.docName, { color: colors.textPrimary }]} numberOfLines={1}>
          {info.name || 'Bác sĩ'}
        </Text>
        <Text style={[styles.docSpecialty, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
          {[info.degree, info.specialty].filter(Boolean).join(' • ') || 'Bác sĩ chuyên khoa'}
        </Text>

        {/* Nơi công tác */}
        <View style={[styles.hospitalBadge, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' }]}>
          <Ionicons name="business" size={13} color="#2563EB" style={{ marginRight: 5 }} />
          <Text style={[styles.hospitalText, { color: isDarkMode ? '#60A5FA' : '#1D4ED8' }]} numberOfLines={1}>
            {info.hospital || 'Chưa cập nhật nơi công tác'}
          </Text>
        </View>
      </View>

      {/* 2. Thống kê hoạt động (Cả 3 số cùng màu #2563EB) */}
      <View
        style={[
          styles.statsContainer,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.statCol}>
          <Text style={[styles.statNumber, { color: '#2563EB' }]}>{displayPatients}</Text>
          <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Bệnh nhân phụ trách</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />
        <View style={styles.statCol}>
          <Text style={[styles.statNumber, { color: '#2563EB' }]}>{completedVisits}</Text>
          <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Ca khám hoàn thành</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />
        <View style={styles.statCol}>
          <Text style={[styles.statNumber, { color: '#2563EB' }]}>--</Text>
          <Text style={[styles.statLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Năm kinh nghiệm</Text>
        </View>
      </View>

      {/* 3. Chứng chỉ hành nghề y tế */}
      <View
        style={[
          styles.licenseCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.licenseHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.ribbonIconCircle, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
              <Ionicons name="ribbon-outline" size={16} color="#2563EB" />
            </View>
            <Text style={[styles.licenseSectionTitle, { color: colors.textPrimary }]}>THÔNG TIN HÀNH NGHỀ & CHỨNG CHỈ</Text>
          </View>
          <View style={[styles.verifiedTag, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
            <Text style={[styles.verifiedTagText, { color: '#2563EB' }]}>BỘ Y TẾ CẤP</Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={styles.licenseRow}>
            <Text style={[styles.licenseLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Số CCHN:</Text>
            <View style={[styles.cchnBadge, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
              <Text style={[styles.cchnBadgeText, { color: '#2563EB' }]}>{info.cchn_number || 'Chưa cập nhật'}</Text>
            </View>
          </View>
          <View style={styles.licenseRow}>
            <Text style={[styles.licenseLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Khoa / Phòng:</Text>
            <Text style={[styles.licenseValue, { color: colors.textPrimary }]}>{info.department || 'Chưa cập nhật'}</Text>
          </View>
          <View style={[styles.licenseRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.licenseLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>SĐT liên hệ trực:</Text>
            <Text style={[styles.licenseValue, { color: '#2563EB', fontWeight: '700' }]}>{info.phone || 'Chưa cập nhật'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// =============================================================
// 2. DANH MỤC CÀI ĐẶT & TIỆN ÍCH (SETTINGS MENU)
// =============================================================
export interface DoctorProfileSettingsProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  onOpenPasswordModal: () => void;
  onOpenLogoutModal: () => void;
  colors: any;
}

export const DoctorProfileSettings: React.FC<DoctorProfileSettingsProps> = ({
  isDarkMode,
  toggleTheme,
  onOpenPasswordModal,
  onOpenLogoutModal,
  colors,
}) => {
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notifyShift, setNotifyShift] = useState(true);
  const [notifyAppointment, setNotifyAppointment] = useState(true);
  const [notifyEmergency, setNotifyEmergency] = useState(true);
  const [notifySound, setNotifySound] = useState(true);
  const [complianceModalVisible, setComplianceModalVisible] = useState(false);

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>CÀI ĐẶT & BẢO MẬT HỆ THỐNG</Text>

      <View
        style={[
          styles.menuCardContainer,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity style={styles.menuItemRow} activeOpacity={0.75} onPress={onOpenPasswordModal}>
          <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
            <Ionicons name="lock-closed" size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>Đổi mật khẩu & Bảo mật 2 lớp</Text>
            <Text style={[styles.menuItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Quản lý mã khóa bảo vệ tài khoản y tế</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={isDarkMode ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemRow} activeOpacity={0.75} onPress={() => setNotificationModalVisible(true)}>
          <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
            <Ionicons name="notifications" size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>Cài đặt thông báo ca trực & Lịch khám</Text>
            <Text style={[styles.menuItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Nhắc nhở lịch hẹn và chuông báo động</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={isDarkMode ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemRow} activeOpacity={0.75} onPress={() => setComplianceModalVisible(true)}>
          <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
            <Ionicons name="document-text" size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>Điều khoản y tế & Bảo mật HL7/FHIR</Text>
            <Text style={[styles.menuItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Tiêu chuẩn an toàn dữ liệu bệnh nhân quốc tế</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={isDarkMode ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>

        <View style={[styles.menuItemRow, { borderBottomWidth: 0 }]}>
          <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
            <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
              {isDarkMode ? 'Giao diện Tối (Dark Mode)' : 'Giao diện Sáng (Light Mode)'}
            </Text>
            <Text style={[styles.menuItemSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Bảo vệ thị lực khi làm ca đêm</Text>
          </View>
          <Switch value={isDarkMode} onValueChange={toggleTheme} trackColor={{ false: '#CBD5E1', true: '#2563EB' }} thumbColor="#FFFFFF" />
        </View>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 18, paddingHorizontal: 12 }}>
        <Text style={[styles.versionTitle, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
          Smart Elderly Care AI • Phiên bản Bác sĩ 2.4.0 (Build 2026)
        </Text>
        <Text style={[styles.versionSub, { color: isDarkMode ? '#475569' : '#CBD5E1' }]}>
          Hệ thống Quản lý Y tế & Giám sát Sức khỏe Người cao tuổi Toàn diện
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.logoutButton,
          {
            backgroundColor: isDarkMode ? '#450A0A55' : '#FEF2F2',
            borderColor: isDarkMode ? '#7F1D1D' : '#FCA5A5',
          },
        ]}
        onPress={onOpenLogoutModal}
        activeOpacity={0.85}
      >
        <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
        <Text style={styles.logoutButtonText}>Đăng xuất khỏi tài khoản Bác sĩ</Text>
      </TouchableOpacity>

      {/* Modal Cài đặt thông báo */}
      <Modal visible={notificationModalVisible} transparent animationType="fade" onRequestClose={() => setNotificationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
                  <Ionicons name="notifications" size={18} color="#2563EB" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cài đặt thông báo y tế</Text>
              </View>
              <TouchableOpacity onPress={() => setNotificationModalVisible(false)}>
                <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              {[
                { title: 'Thông báo bắt đầu ca trực', sub: 'Nhắc nhở trước 15 phút khi bắt đầu ca trực', val: notifyShift, setVal: setNotifyShift },
                { title: 'Nhắc nhở lịch khám sắp tới', sub: 'Thông báo trước các lịch tái khám định kỳ của cụ', val: notifyAppointment, setVal: setNotifyAppointment },
                { title: 'Cảnh báo sinh hiệu khẩn cấp', sub: 'Rung và phát chuông to khi phát hiện té ngã hoặc suy hô hấp', val: notifyEmergency, setVal: setNotifyEmergency, isRed: true },
                { title: 'Âm thanh chuông báo y tế', sub: 'Phát chuông âm lượng cao ngay cả khi máy ở chế độ im lặng', val: notifySound, setVal: setNotifySound },
              ].map((item, idx) => (
                <View key={idx} style={[styles.switchRow, idx === 3 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.switchTitle, { color: item.isRed ? '#DC2626' : colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={item.val}
                    onValueChange={item.setVal}
                    trackColor={{ false: '#CBD5E1', true: item.isRed ? '#DC2626' : '#2563EB' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => setNotificationModalVisible(false)}>
              <Text style={styles.btnPrimaryText}>Lưu cấu hình thông báo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Điều khoản HL7/FHIR */}
      <Modal visible={complianceModalVisible} transparent animationType="fade" onRequestClose={() => setComplianceModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border, maxHeight: '80%' }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#2563EB" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Trách nhiệm bảo mật HL7/FHIR</Text>
              </View>
              <TouchableOpacity onPress={() => setComplianceModalVisible(false)}>
                <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {[
                { title: '1. Tiêu chuẩn dữ liệu Y tế HL7 & FHIR Release 4', desc: 'Hệ thống Smart Elderly Care AI tuân thủ nghiêm ngặt các quy chuẩn truyền nhận và lưu trữ thông tin bệnh án điện tử quốc tế HL7/FHIR. Dữ liệu sinh hiệu (Vital Signs), đơn thuốc (MedicationRequest) và tiền sử bệnh lý (Condition) đều được mã hóa đầu cuối bằng thuật toán AES-256.' },
                { title: '2. Cam kết bảo mật thông tin Bệnh nhân của Bác sĩ', desc: 'Bác sĩ gia đình có nghĩa vụ bảo mật toàn diện thông tin cá nhân, hồ sơ bệnh án và hình ảnh camera của người cao tuổi. Mọi hành vi chụp màn hình hoặc chia sẻ thông tin bệnh án ra bên ngoài mà không có sự đồng ý của gia đình đều vi phạm Luật Khám chữa bệnh.' },
                { title: '3. Nhật ký kiểm toán bảo mật (Audit Trails)', desc: 'Mọi thao tác tra cứu, chỉnh sửa đơn thuốc, cập nhật chỉ số đều được ghi nhận vĩnh viễn trên hệ thống Audit Log phục vụ công tác thanh tra y tế định kỳ.' },
              ].map((p, idx) => (
                <View key={idx} style={{ marginBottom: 12 }}>
                  <Text style={[styles.complianceSectionTitle, { color: colors.textPrimary }]}>{p.title}</Text>
                  <Text style={[styles.complianceParagraph, { color: isDarkMode ? '#CBD5E1' : '#475569' }]}>{p.desc}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => setComplianceModalVisible(false)}>
              <Text style={styles.btnPrimaryText}>Tôi đã hiểu & Cam kết tuân thủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// =============================================================
// 3. MODAL SỬA THÔNG TIN BÁC SĨ
// =============================================================
export interface DoctorEditProfileModalProps {
  visible: boolean;
  editName: string;
  editDegree: string;
  editSpecialty: string;
  editHospital: string;
  editDepartment: string;
  editPhone: string;
  editAvatarUri: string | null;
  onChangeName: (val: string) => void;
  onChangeDegree: (val: string) => void;
  onChangeSpecialty: (val: string) => void;
  onChangeHospital: (val: string) => void;
  onChangeDepartment: (val: string) => void;
  onChangePhone: (val: string) => void;
  onPickImage: () => void;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorEditProfileModal: React.FC<DoctorEditProfileModalProps> = ({
  visible,
  editName,
  editDegree,
  editSpecialty,
  editHospital,
  editDepartment,
  editPhone,
  editAvatarUri,
  onChangeName,
  onChangeDegree,
  onChangeSpecialty,
  onChangeHospital,
  onChangeDepartment,
  onChangePhone,
  onPickImage,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
      <View style={[styles.formModalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.formModalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="person-circle" size={22} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sửa Hồ Sơ Bác Sĩ</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
          <View style={[styles.modalAvatarRow, { backgroundColor: isDarkMode ? '#334155' : '#F8FAFC' }]}>
            <View style={styles.modalAvatarWrap}>
              {editAvatarUri ? (
                <Image source={{ uri: editAvatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={28} color="#FFFFFF" />
              )}
            </View>
            <TouchableOpacity style={styles.btnPickImage} onPress={onPickImage} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={styles.btnPickImageText}>Chọn / Đổi ảnh đại diện</Text>
            </TouchableOpacity>
          </View>

          {[
            { label: 'Họ và tên Bác sĩ (*)', val: editName, setVal: onChangeName, placeholder: 'VD: BS. Nguyễn Văn An' },
            { label: 'Học hàm, học vị', val: editDegree, setVal: onChangeDegree, placeholder: 'VD: Bác sĩ CKI, Thạc sĩ Y khoa...' },
            { label: 'Chuyên khoa', val: editSpecialty, setVal: onChangeSpecialty, placeholder: 'VD: Lão khoa, Tim mạch...' },
            { label: 'Bệnh viện / Cơ sở y tế', val: editHospital, setVal: onChangeHospital, placeholder: 'VD: Bệnh viện Đa khoa Đà Nẵng' },
            { label: 'Khoa / Phòng công tác', val: editDepartment, setVal: onChangeDepartment, placeholder: 'VD: Khoa Khám bệnh' },
            { label: 'Số điện thoại liên hệ (*)', val: editPhone, setVal: onChangePhone, placeholder: 'VD: 0905123456', keyboard: 'phone-pad' as const },
          ].map((f, idx) => (
            <View key={idx}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                value={f.val}
                onChangeText={f.setVal}
                keyboardType={f.keyboard}
                placeholder={f.placeholder}
                placeholderTextColor="#94A3B8"
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.modalBtnRow}>
          <TouchableOpacity style={[styles.btnCancel, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnSave, { backgroundColor: Colors.primary }]} onPress={onSave}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Lưu Hồ Sơ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// =============================================================
// 4. MODAL ĐỔI MẬT KHẨU BÁC SĨ
// =============================================================
export interface DoctorChangePasswordModalProps {
  visible: boolean;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  onChangeOldPassword: (val: string) => void;
  onChangeNewPassword: (val: string) => void;
  onChangeConfirmPassword: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorChangePasswordModal: React.FC<DoctorChangePasswordModalProps> = ({
  visible,
  oldPassword,
  newPassword,
  confirmPassword,
  onChangeOldPassword,
  onChangeNewPassword,
  onChangeConfirmPassword,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
      <View style={[styles.formModalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.formModalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="key" size={20} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Đổi Mật Khẩu Bác Sĩ</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={{ marginVertical: 10 }}>
          {[
            { label: 'Mật khẩu hiện tại (*)', val: oldPassword, setVal: onChangeOldPassword, placeholder: 'Nhập mật khẩu hiện tại' },
            { label: 'Mật khẩu mới (*)', val: newPassword, setVal: onChangeNewPassword, placeholder: 'Tối thiểu 6 ký tự' },
            { label: 'Xác nhận mật khẩu mới (*)', val: confirmPassword, setVal: onChangeConfirmPassword, placeholder: 'Nhập lại mật khẩu mới' },
          ].map((f, idx) => (
            <View key={idx}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                secureTextEntry
                value={f.val}
                onChangeText={f.setVal}
                placeholder={f.placeholder}
                placeholderTextColor="#94A3B8"
              />
            </View>
          ))}
        </View>

        <View style={styles.modalBtnRow}>
          <TouchableOpacity style={[styles.btnCancel, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnSave, { backgroundColor: '#2563EB' }]} onPress={onSave}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Cập Nhật Mật Khẩu</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// =============================================================
// 5. MODAL XÁC NHẬN ĐĂNG XUẤT
// =============================================================
export interface DoctorLogoutModalProps {
  visible: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorLogoutModal: React.FC<DoctorLogoutModalProps> = ({
  visible,
  onConfirm,
  onClose,
  isDarkMode,
  colors,
}) => (
  <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={[styles.dialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', alignItems: 'center' }]}>
        <View style={styles.logoutIconBox}>
          <Ionicons name="log-out-outline" size={32} color="#DC2626" />
        </View>
        <Text style={[styles.logoutTitle, { color: colors.textPrimary }]}>Đăng xuất tài khoản Bác sĩ</Text>
        <Text style={[styles.logoutSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
          Bạn có chắc chắn muốn đăng xuất khỏi hệ thống? Mọi phiên làm việc và bảo mật hồ sơ bệnh án sẽ được kết thúc.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
          <TouchableOpacity
            style={[styles.btnCancel, { flex: 1, paddingVertical: 12, borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
            onPress={onClose}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy bỏ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnLogoutConfirm} onPress={onConfirm} activeOpacity={0.85}>
            <Ionicons name="log-out" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Đăng xuất ngay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  /* Header Card */
  headerCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  editBtnCorner: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  avatarWrapper: { alignItems: 'center', marginTop: 4, marginBottom: 12 },
  avatarBig: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
  avatarImage: { width: '100%', height: '100%' },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  docName: { fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  docSpecialty: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: 10 },
  hospitalBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  hospitalText: { fontSize: 12.5, fontWeight: '600' },

  /* Stats Container */
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800', marginBottom: 3 },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, height: 34 },

  /* License & CCHN Card */
  licenseCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  licenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E155',
  },
  ribbonIconCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  licenseSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  verifiedTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  verifiedTagText: { fontSize: 10, fontWeight: '800' },
  licenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  licenseLabel: { fontSize: 12.5, fontWeight: '500' },
  licenseValue: { fontSize: 13, fontWeight: '600' },
  cchnBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cchnBadgeText: { fontSize: 12.5, fontWeight: '700' },

  /* Settings Menu */
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 10, paddingHorizontal: 4 },
  menuCardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E144',
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuItemTitle: { fontSize: 14.5, fontWeight: '700', marginBottom: 2 },
  menuItemSub: { fontSize: 11.5 },
  versionTitle: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  versionSub: { fontSize: 11, textAlign: 'center', marginTop: 3 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 1,
  },
  logoutButtonText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },

  /* Common Modal Overlays & Cards */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  dialogCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    elevation: 6,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E155',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E133',
  },
  switchTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 2 },
  switchSub: { fontSize: 11.5 },
  btnPrimary: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  complianceSectionTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 4 },
  complianceParagraph: { fontSize: 12.5, lineHeight: 18 },

  /* Form Modals (Edit, Password) */
  formModalBox: { borderRadius: 16, padding: 16, maxHeight: '90%' },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 10,
  },
  modalAvatarRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, padding: 10, borderRadius: 10 },
  modalAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#2563EB',
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  btnPickImageText: { fontSize: 12.5, fontWeight: '700', color: '#2563EB' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
    paddingTop: 10,
  },
  btnCancel: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSave: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* Logout Dialog */
  logoutIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoutTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  logoutSub: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  btnLogoutConfirm: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

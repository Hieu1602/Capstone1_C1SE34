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
  onViewAvatar?: () => void;
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
  onViewAvatar,
  onEditProfile,
  isDarkMode,
  colors,
}) => {
  const doctorInitial = (info.name || 'Bác sĩ').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'B';
  const displayPatients = patientCount;
  const completedVisits = appointmentCount;

  return (
    <View style={{ marginBottom: 16 }}>
      {/* 1. HERO PROFILE CARD: Bố cục ngang chuẩn Bác sĩ Lão khoa & Gia đình */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          {/* Avatar Bác sĩ có nút Camera trực quan */}
          <TouchableOpacity
            style={styles.heroAvatarContainer}
            activeOpacity={0.88}
            onPress={onPickImage}
          >
            <View style={styles.heroAvatarBox}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.heroAvatarLetter}>{doctorInitial}</Text>
              )}
            </View>
            <View style={styles.heroOnlineBadge} />
            <View
              style={[
                styles.heroCameraBadge,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                },
              ]}
            >
              <Ionicons name="camera" size={11} color="#0284C7" />
            </View>
          </TouchableOpacity>

          {/* Thông tin Bác sĩ bên phải */}
          <View style={styles.heroInfoCol}>
            <View style={styles.verifiedRow}>
              <View
                style={[
                  styles.verifiedBadge,
                  {
                    backgroundColor: isDarkMode ? '#064E3B44' : '#ECFDF5',
                    borderColor: isDarkMode ? '#059669' : '#A7F3D0',
                  },
                ]}
              >
                <Ionicons name="shield-checkmark" size={12} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.verifiedBadgeText}>Đã xác minh CCHN</Text>
              </View>
            </View>

            <Text style={[styles.heroDocName, { color: colors.textPrimary }]} numberOfLines={1}>
              {info.name || 'Bác sĩ'}
            </Text>

            <Text style={[styles.heroDocDegree, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]} numberOfLines={1}>
              {info.degree || 'Bác sĩ chuyên khoa'}
            </Text>

            <Text style={[styles.heroDocSpecialty, { color: isDarkMode ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              {info.specialty || 'Y học Gia đình & Lão khoa'}
            </Text>
          </View>
        </View>

        {/* Nơi công tác */}
        <View
          style={[
            styles.heroHospitalBanner,
            {
              backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Ionicons name="business-outline" size={15} color="#0284C7" style={{ marginRight: 8 }} />
          <Text style={[styles.heroHospitalText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]} numberOfLines={1}>
            {info.hospital || 'Hệ thống Smart Elderly Care AI'}
          </Text>
        </View>

        {/* Nút hành động Chỉnh sửa Hồ Sơ: Đầy đủ chiều ngang, tactile button */}
        <TouchableOpacity
          style={[
            styles.heroEditButton,
            {
              backgroundColor: isDarkMode ? '#0C4A6E44' : '#EFF6FF',
              borderColor: isDarkMode ? '#0284C7' : '#BAE6FD',
            },
          ]}
          onPress={onEditProfile}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={17} color={isDarkMode ? '#38BDF8' : '#0284C7'} style={{ marginRight: 6 }} />
          <Text style={[styles.heroEditButtonText, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]}>
            Chỉnh sửa thông tin bác sĩ
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. CHỈ SỐ CÔNG VIỆC LÂM SÀNG: 2 CỘT RÕ RÀNG (HOÀN TOÀN BỎ ĐÁNH GIÁ Y ĐỨC) */}
      <View style={styles.statsTwoColRow}>
        {/* Cột 1: Bệnh nhân phụ trách */}
        <View
          style={[
            styles.statCardTwoCol,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.statCardHeader}>
            <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? '#0C4A6E44' : '#EFF6FF' }]}>
              <Ionicons name="people" size={17} color="#0284C7" />
            </View>
            <Text style={[styles.statCardHeading, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Bệnh nhân</Text>
          </View>
          <Text style={[styles.statCardValue, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]}>{displayPatients}</Text>
          <Text style={[styles.statCardSub, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>Theo dõi sức khỏe</Text>
        </View>

        {/* Cột 2: Lịch khám phụ trách */}
        <View
          style={[
            styles.statCardTwoCol,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.statCardHeader}>
            <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? '#134E4A44' : '#F0FDFA' }]}>
              <Ionicons name="calendar" size={17} color="#0D9488" />
            </View>
            <Text style={[styles.statCardHeading, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Lịch khám</Text>
          </View>
          <Text style={[styles.statCardValue, { color: isDarkMode ? '#2DD4BF' : '#0D9488' }]}>{completedVisits}</Text>
          <Text style={[styles.statCardSub, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>Ca khám & Tái khám</Text>
        </View>
      </View>

      {/* 3. THÔNG TIN HÀNH NGHỀ & CHỨNG CHỈ */}
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
              <Ionicons name="ribbon-outline" size={16} color="#0284C7" />
            </View>
            <Text style={[styles.licenseSectionTitle, { color: colors.textPrimary }]}>THÔNG TIN HÀNH NGHỀ & PHÁP LÝ</Text>
          </View>
          <View
            style={[
              styles.verifiedTag,
              {
                backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF',
                borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.verifiedTagText, { color: '#0284C7' }]}>BỘ Y TẾ CẤP</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View style={styles.licenseRow}>
            <Text style={[styles.licenseLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Số CCHN:</Text>
            <View
              style={[
                styles.cchnBadge,
                {
                  backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF',
                  borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.cchnBadgeText, { color: '#0284C7' }]}>{info.cchn_number || '028491/BYT-CCHN'}</Text>
            </View>
          </View>
          <View style={styles.licenseRow}>
            <Text style={[styles.licenseLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Khoa / Phòng:</Text>
            <Text style={[styles.licenseValue, { color: colors.textPrimary }]}>{info.department || 'Khoa Chăm sóc Người cao tuổi'}</Text>
          </View>
          <View style={[styles.licenseRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.licenseLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>SĐT liên hệ trực:</Text>
            <Text style={[styles.licenseValue, { color: '#0284C7', fontWeight: '700' }]}>{info.phone || 'Chưa cập nhật'}</Text>
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
  const [notifyAppointment, setNotifyAppointment] = useState(true);
  const [notifyEmergency, setNotifyEmergency] = useState(true);
  const [complianceModalVisible, setComplianceModalVisible] = useState(false);

  return (
    <View style={{ marginBottom: 28 }}>
      {/* CÀI ĐẶT HỆ THỐNG & BẢO MẬT */}
      <Text style={[styles.groupTitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
        CÀI ĐẶT HỆ THỐNG
      </Text>

      <View
        style={[
          styles.settingsCardGroup,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        {/* 1. Đổi mật khẩu */}
        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7} onPress={onOpenPasswordModal}>
          <View style={[styles.settingsIconCircle, { backgroundColor: '#0284C7' }]}>
            <Ionicons name="key" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.settingsRowContent}>
            <Text style={[styles.settingsRowTitle, { color: colors.textPrimary }]}>Đổi mật khẩu</Text>
            <Text style={[styles.settingsRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Bảo mật tài khoản đăng nhập
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

        {/* 2. Cài đặt thông báo */}
        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7} onPress={() => setNotificationModalVisible(true)}>
          <View style={[styles.settingsIconCircle, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="notifications" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.settingsRowContent}>
            <Text style={[styles.settingsRowTitle, { color: colors.textPrimary }]}>Cài đặt thông báo ca trực</Text>
            <Text style={[styles.settingsRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Chuông cảnh báo sinh hiệu & nhắc lịch
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

        {/* 3. Chính sách bảo mật y tế */}
        <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7} onPress={() => setComplianceModalVisible(true)}>
          <View style={[styles.settingsIconCircle, { backgroundColor: '#10B981' }]}>
            <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.settingsRowContent}>
            <Text style={[styles.settingsRowTitle, { color: colors.textPrimary }]}>Chính sách & Bảo mật dữ liệu</Text>
            <Text style={[styles.settingsRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Tiêu chuẩn an toàn hồ sơ bệnh án
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

        {/* 4. Chế độ nền tối (Dark Mode) */}
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconCircle, { backgroundColor: '#6366F1' }]}>
            <Ionicons name="moon" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.settingsRowContent}>
            <Text style={[styles.settingsRowTitle, { color: colors.textPrimary }]}>Chế độ nền tối</Text>
            <Text style={[styles.settingsRowSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Tối ưu thị giác khi trực ca đêm
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: '#CBD5E1', true: '#6366F1' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* NÚT ĐĂNG XUẤT CHUẨN IOS/MATERIAL NATIVE */}
      <View style={{ marginTop: 20 }}>
        <TouchableOpacity
          style={[
            styles.nativeLogoutCard,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
          onPress={onOpenLogoutModal}
          activeOpacity={0.75}
        >
          <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.nativeLogoutText}>Đăng xuất khỏi tài khoản</Text>
        </TouchableOpacity>
      </View>

      {/* FOOTER PHIÊN BẢN HỆ THỐNG */}
      <View style={styles.appFooter}>
        <Text style={[styles.appFooterVersion, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
          Phiên bản Bác sĩ 2.4.0 • Build 2026
        </Text>
        <Text style={[styles.appFooterOrg, { color: isDarkMode ? '#475569' : '#CBD5E1' }]}>
          Smart Elderly Care AI Platform
        </Text>
      </View>

      {/* MODAL CÀI ĐẶT THÔNG BÁO: TỐI GIẢN, CHUẨN MỰC, XÓA CÁC CÁI THỪA */}
      <Modal visible={notificationModalVisible} transparent animationType="fade" onRequestClose={() => setNotificationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.settingsIconCircle, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="notifications" size={18} color="#FFFFFF" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cài đặt thông báo</Text>
              </View>
              <TouchableOpacity onPress={() => setNotificationModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 18 }}>
              {/* 1. Cảnh báo khẩn cấp */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Cảnh báo sinh hiệu nguy cấp</Text>
                  <Text style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Tự động phát chuông to khi phát hiện cụ bị té ngã hoặc suy hô hấp
                  </Text>
                </View>
                <Switch
                  value={notifyEmergency}
                  onValueChange={setNotifyEmergency}
                  trackColor={{ false: '#CBD5E1', true: '#DC2626' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* 2. Nhắc nhở lịch khám */}
              <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Nhắc nhở ca trực & Lịch khám</Text>
                  <Text style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Thông báo trước giờ thăm khám định kỳ của bệnh nhân
                  </Text>
                </View>
                <Switch
                  value={notifyAppointment}
                  onValueChange={setNotifyAppointment}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => setNotificationModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Lưu cài đặt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Điều khoản HL7/FHIR */}
      <Modal visible={complianceModalVisible} transparent animationType="fade" onRequestClose={() => setComplianceModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border, maxHeight: '80%' }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.settingsIconCircle, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Chính sách bảo mật dữ liệu</Text>
              </View>
              <TouchableOpacity onPress={() => setComplianceModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {[
                { title: '1. Tiêu chuẩn dữ liệu Y tế HL7 & FHIR Release 4', desc: 'Hệ thống Smart Elderly Care AI tuân thủ nghiêm ngặt các quy chuẩn truyền nhận và lưu trữ thông tin bệnh án điện tử quốc tế HL7/FHIR. Dữ liệu sinh hiệu (Vital Signs), đơn thuốc (MedicationRequest) và tiền sử bệnh lý (Condition) đều được mã hóa đầu cuối bằng thuật toán AES-256.' },
                { title: '2. Cam kết bảo mật thông tin Bệnh nhân của Bác sĩ', desc: 'Bác sĩ gia đình có nghĩa vụ bảo mật toàn diện thông tin cá nhân, hồ sơ bệnh án và hình ảnh camera của người cao tuổi. Mọi hành vi chụp màn hình hoặc chia sẻ thông tin bệnh án ra bên ngoài mà không có sự đồng ý của gia đình đều vi phạm Luật Khám chữa bệnh.' },
                { title: '3. Nhật ký kiểm toán bảo mật (Audit Trails)', desc: 'Mọi thao tác tra cứu, chỉnh sửa đơn thuốc, cập nhật chỉ số đều được ghi nhận vĩnh viễn trên hệ thống Audit Log phục vụ công tác thanh tra y tế định kỳ.' },
              ].map((item, idx) => (
                <View key={idx} style={{ marginBottom: 14 }}>
                  <Text style={[styles.complianceSectionTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.complianceParagraph, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>{item.desc}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => setComplianceModalVisible(false)}>
              <Text style={styles.btnPrimaryText}>Đã hiểu & Đồng ý</Text>
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
            { label: 'Họ và tên Bác sĩ (*)', val: editName, setVal: onChangeName, placeholder: 'Nhập họ và tên bác sĩ' },
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
  isSubmitting?: boolean;
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
  isSubmitting = false,
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
            { label: 'Mật khẩu mới (*)', val: newPassword, setVal: onChangeNewPassword, placeholder: '8 - 16 ký tự (Hoa, thường, số, đặc biệt)' },
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
          <TouchableOpacity
            style={[styles.btnSave, { backgroundColor: '#2563EB', opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={onSave}
            disabled={isSubmitting}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
              {isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
            </Text>
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
  /* Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  heroAvatarBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  heroAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  heroOnlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroCameraBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  heroInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  heroDocName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  heroDocDegree: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  heroDocSpecialty: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  heroHospitalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  heroHospitalText: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  heroEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroEditButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  avatarImage: { width: '100%', height: '100%' },

  /* Two Column Clinical Workload Stats */
  statsTwoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCardTwoCol: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statCardHeading: {
    fontSize: 12,
    fontWeight: '700',
  },
  statCardValue: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 2,
  },
  statCardSub: {
    fontSize: 11,
    fontWeight: '500',
  },

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

  /* Settings Menu Groups */
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  settingsCardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingsRowContent: {
    flex: 1,
    paddingRight: 8,
  },
  settingsRowTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingsRowSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  rowDivider: {
    height: 1,
    marginLeft: 66,
  },
  nativeLogoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  nativeLogoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  appFooter: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  appFooterVersion: {
    fontSize: 12,
    fontWeight: '600',
  },
  appFooterOrg: {
    fontSize: 11,
    marginTop: 3,
  },

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
  btnCancel: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSave: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

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

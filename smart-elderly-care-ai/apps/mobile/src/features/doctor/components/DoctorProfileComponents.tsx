// DoctorProfileComponents.tsx
// Tập hợp các component cho màn hình Hồ Sơ Bác Sĩ (Profile & Settings)

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Switch,
  Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { DoctorProfileInfo } from './types';

const maskPhone = (phone?: string) => {
  const c = phone?.trim() || '';
  return !c ? 'Chưa cập nhật' : c.length <= 4 ? '***' : `${c.slice(0, 3)}****${c.slice(-3)}`;
};

interface ThemeProps { isDarkMode: boolean; colors: any; }

// =============================================================
// SHARED MODAL SHELLS
// =============================================================
const DialogShell: React.FC<ThemeProps & {
  visible: boolean; onClose: () => void; icon?: any; iconBg?: string;
  title?: string; maxHeight?: any; center?: boolean; children: React.ReactNode;
}> = ({ visible, onClose, icon, iconBg, title, maxHeight, center, isDarkMode, colors, children }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={[styles.dialogCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: colors.border }, maxHeight && { maxHeight }, center && { alignItems: 'center' }]}>
        {title && (
          <View style={styles.dialogHeader}>
            <View style={[styles.rowCenter, { gap: 10 }]}>
              <View style={[styles.settingsIconCircle, { backgroundColor: iconBg, marginRight: 0 }]}>
                <Ionicons name={icon} size={18} color="#FFFFFF" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>
        )}
        {children}
      </View>
    </View>
  </Modal>
);

const FormShell: React.FC<ThemeProps & {
  visible: boolean; onClose: () => void; onSave: () => void;
  icon: any; iconColor: string; title: string; saveLabel: string;
  saveBg?: string; disabled?: boolean; children: React.ReactNode;
}> = ({ visible, onClose, onSave, icon, iconColor, title, saveLabel, saveBg = Colors.primary, disabled, isDarkMode, colors, children }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
      <View style={[styles.formModalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.formModalHeader}>
          <View style={styles.rowCenter}>
            <Ionicons name={icon} size={21} color={iconColor} style={{ marginRight: 6 }} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        {children}
        <View style={styles.modalBtnRow}>
          <TouchableOpacity style={[styles.btnCancel, { borderColor: colors.border }]} onPress={onClose} disabled={disabled}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnSave, { backgroundColor: saveBg, opacity: disabled ? 0.7 : 1 }]} onPress={onSave} disabled={disabled}>
            <Text style={styles.btnWhite13}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// =============================================================
// 1. CARD HỒ SƠ & THỐNG KÊ BÁC SĨ (PROFILE CARD)
// =============================================================
export interface DoctorProfileCardProps extends ThemeProps {
  info: DoctorProfileInfo; avatarUri: string | null;
  patientCount: number; appointmentCount: number;
  onPickImage: () => void; onViewAvatar?: () => void; onEditProfile: () => void;
}

export const DoctorProfileCard: React.FC<DoctorProfileCardProps> = ({
  info, avatarUri, patientCount, appointmentCount, onPickImage, onEditProfile, isDarkMode, colors,
}) => {
  const doctorInitial = (info.name || 'Bác sĩ').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || 'B';
  const cardSurface = { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' };
  const mutedText = isDarkMode ? '#94A3B8' : '#64748B';
  const blueBadgeStyle = { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF', borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE', borderWidth: 1 };

  const stats = [
    { icon: 'people' as const, bg: isDarkMode ? '#0C4A6E44' : '#EFF6FF', color: '#0284C7', valColor: isDarkMode ? '#38BDF8' : '#0284C7', heading: 'Bệnh nhân', value: patientCount, sub: 'Theo dõi sức khỏe' },
    { icon: 'calendar' as const, bg: isDarkMode ? '#134E4A44' : '#F0FDFA', color: '#0D9488', valColor: isDarkMode ? '#2DD4BF' : '#0D9488', heading: 'Lịch khám', value: appointmentCount, sub: 'Ca khám & Tái khám' },
  ];

  const licenseRows = [
    { label: 'Số CCHN:', badge: info.cchn_number || '028491/BYT-CCHN' },
    { label: 'Khoa / Phòng:', val: info.department || 'Khoa Chăm sóc Người cao tuổi', color: colors.textPrimary },
    { label: 'SĐT liên hệ trực:', val: maskPhone(info.phone), color: '#0284C7', bold: true },
  ];

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.heroCard, cardSurface]}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.heroAvatarContainer} activeOpacity={0.88} onPress={onPickImage}>
            <View style={styles.heroAvatarBox}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.heroAvatarLetter}>{doctorInitial}</Text>}
            </View>
            <View style={styles.heroOnlineBadge} />
            <View style={[styles.heroCameraBadge, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#CBD5E1' }]}>
              <Ionicons name="camera" size={11} color="#0284C7" />
            </View>
          </TouchableOpacity>

          <View style={styles.heroInfoCol}>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <View style={[styles.verifiedBadge, { backgroundColor: isDarkMode ? '#064E3B44' : '#ECFDF5', borderColor: isDarkMode ? '#059669' : '#A7F3D0' }]}>
                <Ionicons name="shield-checkmark" size={12} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.verifiedBadgeText}>Đã xác minh CCHN</Text>
              </View>
            </View>
            <Text style={[styles.heroDocName, { color: colors.textPrimary }]} numberOfLines={1}>{info.name || 'Bác sĩ'}</Text>
            <Text style={[styles.heroDocDegree, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]} numberOfLines={1}>{info.degree || 'Bác sĩ chuyên khoa'}</Text>
            <Text style={[styles.heroDocSpecialty, { color: mutedText }]} numberOfLines={1}>{info.specialty || 'Y học Gia đình & Lão khoa'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.heroEditButton, { backgroundColor: isDarkMode ? '#0C4A6E44' : '#EFF6FF', borderColor: isDarkMode ? '#0284C7' : '#BAE6FD' }]}
          onPress={onEditProfile}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={17} color={isDarkMode ? '#38BDF8' : '#0284C7'} style={{ marginRight: 6 }} />
          <Text style={[styles.heroEditButtonText, { color: isDarkMode ? '#38BDF8' : '#0284C7' }]}>Chỉnh sửa thông tin bác sĩ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsTwoColRow}>
        {stats.map((s) => (
          <View key={s.heading} style={[styles.statCardTwoCol, cardSurface]}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={17} color={s.color} />
              </View>
              <Text style={[styles.statCardHeading, { color: mutedText }]}>{s.heading}</Text>
            </View>
            <Text style={[styles.statCardValue, { color: s.valColor }]}>{s.value}</Text>
            <Text style={[styles.statCardSub, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>{s.sub}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.licenseCard, cardSurface]}>
        <View style={styles.licenseHeader}>
          <View style={[styles.rowCenter, { gap: 8 }]}>
            <View style={[styles.ribbonIconCircle, { backgroundColor: isDarkMode ? '#1E3A8A33' : '#EFF6FF' }]}>
              <Ionicons name="ribbon-outline" size={16} color="#0284C7" />
            </View>
            <Text style={[styles.licenseSectionTitle, { color: colors.textPrimary }]}>THÔNG TIN HÀNH NGHỀ & PHÁP LÝ</Text>
          </View>
          <View style={[styles.verifiedTag, blueBadgeStyle]}>
            <Text style={styles.verifiedTagText}>BỘ Y TẾ CẤP</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {licenseRows.map((r) => (
            <View key={r.label} style={styles.licenseRow}>
              <Text style={[styles.licenseLabel, { color: mutedText }]}>{r.label}</Text>
              {r.badge ? (
                <View style={[styles.verifiedTag, blueBadgeStyle]}>
                  <Text style={styles.cchnBadgeText}>{r.badge}</Text>
                </View>
              ) : (
                <Text style={[styles.licenseValue, { color: r.color }, r.bold && { fontWeight: '700' }]}>{r.val}</Text>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// =============================================================
// 2. DANH MỤC CÀI ĐẶT & TIỆN ÍCH (SETTINGS MENU)
// =============================================================
export interface DoctorProfileSettingsProps extends ThemeProps {
  toggleTheme: () => void; onOpenPasswordModal: () => void; onOpenLogoutModal: () => void;
}

const COMPLIANCE_SECTIONS = [
  {
    title: '1. Tiêu chuẩn Dữ liệu Y tế Quốc tế & Bảo mật Đa lớp',
    desc: 'Hệ thống Smart Elderly Care AI tuân thủ nghiêm ngặt các quy chuẩn truyền nhận và lưu trữ bệnh án điện tử quốc tế. Dữ liệu chỉ số sinh hiệu, đơn thuốc điều trị và tiền sử bệnh lý của người cao tuổi đều được mã hóa đầu cuối bảo mật tuyệt đối bằng thuật toán chuẩn AES-256.',
  },
  {
    title: '2. Cam kết Bảo mật Thông tin Bệnh nhân của Bác sĩ',
    desc: 'Bác sĩ gia đình có nghĩa vụ bảo mật toàn diện thông tin cá nhân, hồ sơ bệnh án và hình ảnh giám sát của người cao tuổi. Mọi hành vi sao chép, chụp màn hình hoặc chia sẻ dữ liệu y tế ra bên ngoài khi chưa có sự đồng ý của gia đình đều vi phạm Luật Khám bệnh, chữa bệnh.',
  },
  {
    title: '3. Nhật ký Kiểm toán & Giám sát Truy cập An toàn',
    desc: 'Mọi thao tác tra cứu hồ sơ, kê đơn thuốc, cập nhật chỉ số sức khỏe của Bác sĩ đều được hệ thống ghi nhận lịch sử kiểm toán tự động, phục vụ công tác thanh tra chuyên môn y tế và đối soát định kỳ.',
  },
];

export const DoctorProfileSettings: React.FC<DoctorProfileSettingsProps> = ({
  isDarkMode, toggleTheme, onOpenPasswordModal, onOpenLogoutModal, colors,
}) => {
  const [notifVisible, setNotifVisible] = useState(false);
  const [notifyAppt, setNotifyAppt] = useState(true);
  const [notifyEmergency, setNotifyEmergency] = useState(true);
  const [complianceVisible, setComplianceVisible] = useState(false);

  const cardSurface = { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' };
  const mutedText = isDarkMode ? '#94A3B8' : '#64748B';
  const dividerColor = isDarkMode ? '#334155' : '#F1F5F9';

  const menuActions = [
    { icon: 'key' as const, bg: '#0284C7', title: 'Đổi mật khẩu', sub: 'Bảo mật tài khoản đăng nhập', onPress: onOpenPasswordModal },
    { icon: 'notifications' as const, bg: '#F59E0B', title: 'Cài đặt thông báo ca trực', sub: 'Chuông cảnh báo sinh hiệu & nhắc lịch', onPress: () => setNotifVisible(true) },
    { icon: 'shield-checkmark' as const, bg: '#10B981', title: 'Chính sách & Bảo mật dữ liệu', sub: 'Tiêu chuẩn an toàn hồ sơ bệnh án', onPress: () => setComplianceVisible(true) },
  ];

  const switches = [
    { title: 'Cảnh báo sinh hiệu nguy cấp', sub: 'Tự động phát chuông to khi phát hiện cụ bị té ngã hoặc suy hô hấp', val: notifyEmergency, onChange: setNotifyEmergency },
    { title: 'Nhắc nhở ca trực & Lịch khám', sub: 'Thông báo trước giờ thăm khám định kỳ của bệnh nhân', val: notifyAppt, onChange: setNotifyAppt, noBorder: true },
  ];

  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={[styles.groupTitle, { color: mutedText }]}>CÀI ĐẶT HỆ THỐNG</Text>

      <View style={[styles.settingsCardGroup, cardSurface]}>
        {menuActions.map((item) => (
          <React.Fragment key={item.title}>
            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7} onPress={item.onPress}>
              <View style={[styles.settingsIconCircle, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={17} color="#FFFFFF" />
              </View>
              <View style={styles.settingsRowContent}>
                <Text style={[styles.settingsRowTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.settingsRowSub, { color: mutedText }]}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#94A3B8'} />
            </TouchableOpacity>
            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
          </React.Fragment>
        ))}

        <View style={styles.settingsRow}>
          <View style={[styles.settingsIconCircle, { backgroundColor: '#2563EB' }]}>
            <Ionicons name="moon" size={17} color="#FFFFFF" />
          </View>
          <View style={styles.settingsRowContent}>
            <Text style={[styles.settingsRowTitle, { color: colors.textPrimary }]}>Chế độ nền tối</Text>
            <Text style={[styles.settingsRowSub, { color: mutedText }]}>Tối ưu thị giác khi trực ca đêm</Text>
          </View>
          <Switch value={isDarkMode} onValueChange={toggleTheme} trackColor={{ false: isDarkMode ? '#334155' : '#CBD5E1', true: '#2563EB' }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF', activeTrackColor: '#2563EB' } as any)} />
        </View>
      </View>

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity style={[styles.nativeLogoutCard, cardSurface]} onPress={onOpenLogoutModal} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.nativeLogoutText}>Đăng xuất khỏi tài khoản</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.appFooter}>
        <Text style={[styles.appFooterVersion, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>Phiên bản Bác sĩ 2.4.0 • Build 2026</Text>
        <Text style={[styles.appFooterOrg, { color: isDarkMode ? '#475569' : '#CBD5E1' }]}>Smart Elderly Care AI Platform</Text>
      </View>

      <DialogShell visible={notifVisible} onClose={() => setNotifVisible(false)} icon="notifications" iconBg="#F59E0B" title="Cài đặt thông báo" isDarkMode={isDarkMode} colors={colors}>
        <View style={{ marginBottom: 18 }}>
          {switches.map((sw) => (
            <View key={sw.title} style={[styles.switchRow, sw.noBorder && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>{sw.title}</Text>
                <Text style={[styles.switchSub, { color: mutedText }]}>{sw.sub}</Text>
              </View>
              <Switch value={sw.val} onValueChange={sw.onChange} trackColor={{ false: '#CBD5E1', true: '#2563EB' }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF', activeTrackColor: '#2563EB' } as any)} />
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setNotifVisible(false)} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryText}>Lưu cài đặt</Text>
        </TouchableOpacity>
      </DialogShell>

      <DialogShell visible={complianceVisible} onClose={() => setComplianceVisible(false)} icon="shield-checkmark" iconBg="#10B981" title="Chính sách bảo mật dữ liệu" maxHeight="80%" isDarkMode={isDarkMode} colors={colors}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {COMPLIANCE_SECTIONS.map((item, idx) => (
            <View key={idx} style={{ marginBottom: 14 }}>
              <Text style={[styles.complianceSectionTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.complianceParagraph, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>{item.desc}</Text>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setComplianceVisible(false)}>
          <Text style={styles.btnPrimaryText}>Đã hiểu & Đồng ý</Text>
        </TouchableOpacity>
      </DialogShell>
    </View>
  );
};

// =============================================================
// 3. MODAL SỬA THÔNG TIN BÁC SĨ
// =============================================================
export interface DoctorEditProfileModalProps extends ThemeProps {
  visible: boolean; editName: string; editDegree: string; editSpecialty: string;
  editHospital: string; editDepartment: string; editPhone: string; editAvatarUri: string | null;
  onChangeName: (val: string) => void; onChangeDegree: (val: string) => void;
  onChangeSpecialty: (val: string) => void; onChangeHospital: (val: string) => void;
  onChangeDepartment: (val: string) => void; onChangePhone: (val: string) => void;
  onPickImage: () => void; onSave: () => void; onClose: () => void;
}

export const DoctorEditProfileModal: React.FC<DoctorEditProfileModalProps> = ({
  visible, editName, editDegree, editSpecialty, editHospital, editDepartment, editPhone,
  editAvatarUri, onChangeName, onChangeDegree, onChangeSpecialty, onChangeHospital,
  onChangeDepartment, onChangePhone, onPickImage, onSave, onClose, isDarkMode, colors,
}) => {
  const fields = [
    { label: 'Họ và tên Bác sĩ (*)', val: editName, setVal: onChangeName, placeholder: 'Nhập họ và tên bác sĩ' },
    { label: 'Học hàm, học vị', val: editDegree, setVal: onChangeDegree, placeholder: 'VD: Bác sĩ CKI, Thạc sĩ Y khoa...' },
    { label: 'Chuyên khoa', val: editSpecialty, setVal: onChangeSpecialty, placeholder: 'VD: Lão khoa, Tim mạch...' },
    { label: 'Bệnh viện / Cơ sở y tế', val: editHospital, setVal: onChangeHospital, placeholder: 'VD: Bệnh viện Đa khoa Đà Nẵng' },
    { label: 'Khoa / Phòng công tác', val: editDepartment, setVal: onChangeDepartment, placeholder: 'VD: Khoa Khám bệnh' },
    { label: 'Số điện thoại liên hệ (*)', val: editPhone, setVal: onChangePhone, placeholder: 'VD: 0905123456', keyboard: 'phone-pad' as const },
  ];

  return (
    <FormShell visible={visible} onClose={onClose} onSave={onSave} icon="person-circle" iconColor={Colors.primary} title="Sửa Hồ Sơ Bác Sĩ" saveLabel="Lưu Hồ Sơ" isDarkMode={isDarkMode} colors={colors}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
        <View style={[styles.modalAvatarRow, { backgroundColor: isDarkMode ? '#334155' : '#F8FAFC' }]}>
          <View style={styles.modalAvatarWrap}>
            {editAvatarUri ? <Image source={{ uri: editAvatarUri }} style={styles.avatarImage} /> : <Ionicons name="person" size={28} color="#FFFFFF" />}
          </View>
          <TouchableOpacity style={styles.btnPickImage} onPress={onPickImage} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={styles.btnPickImageText}>Chọn / Đổi ảnh đại diện</Text>
          </TouchableOpacity>
        </View>

        {fields.map((f, idx) => (
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
    </FormShell>
  );
};

// =============================================================
// 4. MODAL ĐỔI MẬT KHẨU BÁC SĨ
// =============================================================
export interface DoctorChangePasswordModalProps extends ThemeProps {
  visible: boolean; oldPassword: string; newPassword: string; confirmPassword: string;
  onChangeOldPassword: (val: string) => void; onChangeNewPassword: (val: string) => void;
  onChangeConfirmPassword: (val: string) => void; onSave: () => void; onClose: () => void;
  isSubmitting?: boolean;
}

export const DoctorChangePasswordModal: React.FC<DoctorChangePasswordModalProps> = ({
  visible, oldPassword, newPassword, confirmPassword, onChangeOldPassword, onChangeNewPassword,
  onChangeConfirmPassword, onSave, onClose, isDarkMode, colors, isSubmitting = false,
}) => {
  const [show, setShow] = useState({ old: false, new: false, confirm: false });
  const isMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const inputBg = isDarkMode ? '#0F172A' : '#F8FAFC';

  const rules = [
    { valid: newPassword.length >= 8 && newPassword.length <= 16, text: 'Độ dài 8 - 16 ký tự' },
    { valid: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword), text: 'Chữ hoa & chữ thường' },
    { valid: /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword), text: 'Có số & ký tự đặc biệt (!@#$)' },
  ];

  const renderPwdField = (
    key: 'old' | 'new' | 'confirm', label: string, val: string,
    onChange: (v: string) => void, placeholder: string, borderColor = colors.border, marginTop = 0,
  ) => (
    <View style={marginTop ? { marginTop } : undefined}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.passwordInputWrap, { borderColor, backgroundColor: inputBg }]}>
        <TextInput
          style={[styles.passwordInput, { color: colors.textPrimary }]}
          secureTextEntry={!show[key]}
          value={val}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow((s) => ({ ...s, [key]: !s[key] }))} hitSlop={8}>
          <Ionicons name={show[key] ? 'eye-off-outline' : 'eye-outline'} size={19} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <FormShell
      visible={visible} onClose={onClose} onSave={onSave} icon="key" iconColor="#2563EB"
      title="Đổi Mật Khẩu Bác Sĩ" saveLabel={isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
      saveBg="#2563EB" disabled={isSubmitting} isDarkMode={isDarkMode} colors={colors}
    >
      <View style={{ marginVertical: 10 }}>
        {renderPwdField('old', 'Mật khẩu hiện tại (*)', oldPassword, onChangeOldPassword, 'Nhập mật khẩu hiện tại (mặc định: 12345678)')}
        {renderPwdField('new', 'Mật khẩu mới (*)', newPassword, onChangeNewPassword, '8 - 16 ký tự (Hoa, thường, số, đặc biệt)', colors.border, 8)}

        {newPassword.length > 0 && (
          <View style={[styles.passwordRuleBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' }]}>
            {rules.map((r) => (
              <View key={r.text} style={styles.ruleItem}>
                <Ionicons name={r.valid ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={r.valid ? '#10B981' : '#94A3B8'} />
                <Text style={[styles.ruleText, { color: r.valid ? '#10B981' : '#64748B' }]}>{r.text}</Text>
              </View>
            ))}
          </View>
        )}

        {renderPwdField('confirm', 'Xác nhận mật khẩu mới (*)', confirmPassword, onChangeConfirmPassword, 'Nhập lại mật khẩu mới', confirmPassword.length > 0 ? (isMatch ? '#10B981' : '#EF4444') : colors.border, 8)}
        {confirmPassword.length > 0 && (
          <Text style={{ fontSize: 11, marginTop: 4, color: isMatch ? '#10B981' : '#EF4444', fontWeight: '600' }}>
            {isMatch ? '✓ Mật khẩu xác nhận khớp' : '✗ Mật khẩu xác nhận chưa khớp'}
          </Text>
        )}
      </View>
    </FormShell>
  );
};

// =============================================================
// 5. MODAL XÁC NHẬN ĐĂNG XUẤT
// =============================================================
export interface DoctorLogoutModalProps extends ThemeProps {
  visible: boolean; onConfirm: () => void; onClose: () => void;
}

export const DoctorLogoutModal: React.FC<DoctorLogoutModalProps> = ({ visible, onConfirm, onClose, isDarkMode, colors }) => (
  <DialogShell visible={visible} onClose={onClose} center isDarkMode={isDarkMode} colors={colors}>
    <View style={styles.logoutIconBox}>
      <Ionicons name="log-out-outline" size={32} color="#DC2626" />
    </View>
    <Text style={[styles.logoutTitle, { color: colors.textPrimary }]}>Đăng xuất tài khoản Bác sĩ</Text>
    <Text style={[styles.logoutSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
      Bạn có chắc chắn muốn đăng xuất khỏi hệ thống? Mọi phiên làm việc và bảo mật hồ sơ bệnh án sẽ được kết thúc.
    </Text>
    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
      <TouchableOpacity style={[styles.btnCancel, { flex: 1, paddingVertical: 12, borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]} onPress={onClose}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy bỏ</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnLogoutConfirm} onPress={onConfirm} activeOpacity={0.85}>
        <Ionicons name="log-out" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.btnPrimaryText}>Đăng xuất ngay</Text>
      </TouchableOpacity>
    </View>
  </DialogShell>
);

const styles = StyleSheet.create({
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  heroCard: { borderRadius: 20, padding: 16, borderWidth: 1, marginBottom: 14, elevation: 2 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroAvatarContainer: { position: 'relative', marginRight: 14 },
  heroAvatarBox: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#0284C7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2.5, borderColor: '#FFFFFF', elevation: 3 },
  heroAvatarLetter: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  heroOnlineBadge: { position: 'absolute', bottom: 2, right: 2, width: 15, height: 15, borderRadius: 7.5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF' },
  heroCameraBadge: { position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  heroInfoCol: { flex: 1, justifyContent: 'center' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  heroDocName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  heroDocDegree: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  heroDocSpecialty: { fontSize: 12.5, fontWeight: '500' },
  heroEditButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, borderWidth: 1 },
  heroEditButtonText: { fontSize: 13.5, fontWeight: '700' },
  avatarImage: { width: '100%', height: '100%' },
  statsTwoColRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statCardTwoCol: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, elevation: 1 },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statIconBox: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  statCardHeading: { fontSize: 12, fontWeight: '700' },
  statCardValue: { fontSize: 26, fontWeight: '800', lineHeight: 32, marginBottom: 2 },
  statCardSub: { fontSize: 11, fontWeight: '500' },
  licenseCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 14, elevation: 1 },
  licenseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E155' },
  ribbonIconCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  licenseSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  verifiedTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  verifiedTagText: { fontSize: 10, fontWeight: '800', color: '#0284C7' },
  licenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  licenseLabel: { fontSize: 12.5, fontWeight: '500' },
  licenseValue: { fontSize: 13, fontWeight: '600' },
  cchnBadgeText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 4 },
  settingsCardGroup: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', elevation: 1 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  settingsIconCircle: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingsRowContent: { flex: 1, paddingRight: 8 },
  settingsRowTitle: { fontSize: 14.5, fontWeight: '600', marginBottom: 2 },
  settingsRowSub: { fontSize: 11.5, lineHeight: 16 },
  rowDivider: { height: 1, marginLeft: 66 },
  nativeLogoutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 14, borderWidth: 1, elevation: 1 },
  nativeLogoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  appFooter: { alignItems: 'center', marginTop: 24, marginBottom: 8 },
  appFooterVersion: { fontSize: 12, fontWeight: '600' },
  appFooterOrg: { fontSize: 11, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', padding: 16 },
  dialogCard: { width: '100%', borderRadius: 20, padding: 20, borderWidth: 1, elevation: 6 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E155', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E133' },
  switchTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 2 },
  switchSub: { fontSize: 11.5 },
  btnPrimary: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnWhite13: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  complianceSectionTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 4 },
  complianceParagraph: { fontSize: 12.5, lineHeight: 18 },
  formModalBox: { borderRadius: 16, padding: 16, maxHeight: '90%' },
  formModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1', paddingBottom: 10 },
  modalAvatarRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, padding: 10, borderRadius: 10 },
  modalAvatarWrap: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  btnPickImage: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  btnPickImageText: { fontSize: 12.5, fontWeight: '700', color: '#2563EB' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  passwordInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4 },
  passwordInput: { flex: 1, fontSize: 13, paddingVertical: 6 },
  passwordRuleBox: { marginTop: 8, padding: 8, borderRadius: 8, gap: 4 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: 11.5 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1', paddingTop: 10 },
  btnCancel: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSave: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoutIconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(220, 38, 38, 0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoutTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  logoutSub: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  btnLogoutConfirm: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
});

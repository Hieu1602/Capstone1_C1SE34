// PatientDetailModals.tsx
// Tập hợp các Modal nghiệp vụ cho màn hình Chi tiết Bệnh nhân:
// 1. DoctorNotesModal: Lời dặn dò y khoa & lịch tái khám tiếp theo
// 2. ConditionFormModal: Thêm / Sửa bệnh lý nền & mức độ nguy cơ
// 3. AllergiesDietModal: Dị ứng thuốc, thực phẩm & chế độ dinh dưỡng
// 4. ThresholdsConfigModal: Cấu hình ngưỡng cảnh báo nhịp tim & SpO2
// 5. PrescriptionFormModal: Kê đơn thuốc / Cập nhật đơn thuốc

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { SeverityType } from './types';

// Wrapper dùng chung cho các Modal chi tiết bệnh nhân giúp loại bỏ boilerplate
const BaseModal: React.FC<{
  visible: boolean;
  title: string;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
  children: React.ReactNode;
}> = ({ visible, title, onClose, isDarkMode, colors, children }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
      <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// Nút submit dùng chung
const SubmitBtn: React.FC<{
  title: string;
  onPress: () => void;
  loading?: boolean;
}> = ({ title, onPress, loading }) => (
  <TouchableOpacity style={styles.modalSubmitBtn} onPress={onPress} disabled={loading} activeOpacity={0.85}>
    {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalSubmitBtnText}>{title}</Text>}
  </TouchableOpacity>
);

// =============================================================
// 1. MODAL GHI CHÚ BÁC SĨ & LỊCH TÁI KHÁM
// =============================================================
export interface DoctorNotesModalProps {
  visible: boolean;
  notes: string;
  nextAppt: string;
  onChangeNotes: (val: string) => void;
  onChangeNextAppt: (val: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorNotesModal: React.FC<DoctorNotesModalProps> = ({
  visible,
  notes,
  nextAppt,
  onChangeNotes,
  onChangeNextAppt,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <BaseModal visible={visible} title="Ghi Chú & Lịch Tái Khám" onClose={onClose} isDarkMode={isDarkMode} colors={colors}>
    <Text style={styles.fieldLabel}>Lời dặn dò y khoa</Text>
    <TextInput
      style={[styles.inputField, { height: 80, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
      multiline
      placeholder="Nhập ghi chú / tiến triển lâm sàng..."
      placeholderTextColor="#94A3B8"
      value={notes}
      onChangeText={onChangeNotes}
    />

    <Text style={styles.fieldLabel}>Lịch hẹn tái khám tiếp theo</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="VD: 15/10/2026 - 08:30"
      placeholderTextColor="#94A3B8"
      value={nextAppt}
      onChangeText={onChangeNextAppt}
    />

    <SubmitBtn title="Lưu Thay Đổi" onPress={onSave} loading={isSaving} />
  </BaseModal>
);

// =============================================================
// 2. MODAL THÊM / SỬA BỆNH LÝ NỀN
// =============================================================
export interface ConditionFormModalProps {
  visible: boolean;
  isEditing: boolean;
  name: string;
  severity: SeverityType;
  note: string;
  onChangeName: (val: string) => void;
  onChangeSeverity: (val: SeverityType) => void;
  onChangeNote: (val: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const ConditionFormModal: React.FC<ConditionFormModalProps> = ({
  visible,
  isEditing,
  name,
  severity,
  note,
  onChangeName,
  onChangeSeverity,
  onChangeNote,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <BaseModal
    visible={visible}
    title={isEditing ? 'Sửa Chẩn Đoán Bệnh Lý' : 'Thêm Bệnh Lý Nền Mới'}
    onClose={onClose}
    isDarkMode={isDarkMode}
    colors={colors}
  >
    <Text style={styles.fieldLabel}>Tên bệnh lý / chẩn đoán (*)</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="VD: Tăng huyết áp, Đái tháo đường..."
      placeholderTextColor="#94A3B8"
      value={name}
      onChangeText={onChangeName}
    />

    <Text style={styles.fieldLabel}>Mức độ nghiêm trọng</Text>
    <View style={styles.severityPickerRow}>
      {[
        { key: 'danger' as const, label: 'Nguy cơ cao', color: '#EF4444', bg: '#FEE2E2' },
        { key: 'warning' as const, label: 'Cần theo dõi', color: '#F59E0B', bg: '#FEF3C7' },
        { key: 'info' as const, label: 'Ổn định', color: '#0284C7', bg: '#E0F2FE' },
      ].map((s) => {
        const isSelected = severity === s.key;
        return (
          <TouchableOpacity
            key={s.key}
            style={[styles.severityOptionBtn, isSelected ? { borderColor: s.color, backgroundColor: s.bg } : { borderColor: colors.border }]}
            onPress={() => onChangeSeverity(s.key)}
          >
            <Text style={[styles.severityOptionText, { color: isSelected ? s.color : isDarkMode ? '#CBD5E1' : '#64748B' }]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <Text style={styles.fieldLabel}>Ghi chú lâm sàng</Text>
    <TextInput
      style={[styles.inputField, { height: 70, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
      multiline
      placeholder="Dặn dò cụ thể..."
      placeholderTextColor="#94A3B8"
      value={note}
      onChangeText={onChangeNote}
    />

    <SubmitBtn title="Lưu Bệnh Lý" onPress={onSave} loading={isSaving} />
  </BaseModal>
);

// =============================================================
// 3. MODAL DỊ ỨNG & DINH DƯỠNG
// =============================================================
export interface AllergiesDietModalProps {
  visible: boolean;
  drugAllergies: string;
  foodAllergies: string;
  dietaryNotes: string;
  onChangeDrugAllergies: (val: string) => void;
  onChangeFoodAllergies: (val: string) => void;
  onChangeDietaryNotes: (val: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const AllergiesDietModal: React.FC<AllergiesDietModalProps> = ({
  visible,
  drugAllergies,
  foodAllergies,
  dietaryNotes,
  onChangeDrugAllergies,
  onChangeFoodAllergies,
  onChangeDietaryNotes,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <BaseModal visible={visible} title="Dị Ứng & Dinh Dưỡng" onClose={onClose} isDarkMode={isDarkMode} colors={colors}>
    <Text style={styles.fieldLabel}>Dị ứng thuốc</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="VD: Penicillin, Aspirin..."
      placeholderTextColor="#94A3B8"
      value={drugAllergies}
      onChangeText={onChangeDrugAllergies}
    />

    <Text style={styles.fieldLabel}>Dị ứng thực phẩm</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="VD: Hải sản, đậu phộng..."
      placeholderTextColor="#94A3B8"
      value={foodAllergies}
      onChangeText={onChangeFoodAllergies}
    />

    <Text style={styles.fieldLabel}>Chế độ ăn khuyến nghị</Text>
    <TextInput
      style={[styles.inputField, { height: 75, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border }]}
      multiline
      placeholder="VD: Ăn nhạt, giảm muối..."
      placeholderTextColor="#94A3B8"
      value={dietaryNotes}
      onChangeText={onChangeDietaryNotes}
    />

    <SubmitBtn title="Lưu Dinh Dưỡng" onPress={onSave} loading={isSaving} />
  </BaseModal>
);

// =============================================================
// 4. MODAL CẤU HÌNH NGƯỠNG SINH HIỆU
// =============================================================
export interface ThresholdsConfigModalProps {
  visible: boolean;
  hrHigh: string;
  hrLow: string;
  spo2Low: string;
  onChangeHrHigh: (val: string) => void;
  onChangeHrLow: (val: string) => void;
  onChangeSpo2Low: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const ThresholdsConfigModal: React.FC<ThresholdsConfigModalProps> = ({
  visible,
  hrHigh,
  hrLow,
  spo2Low,
  onChangeHrHigh,
  onChangeHrLow,
  onChangeSpo2Low,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => (
  <BaseModal visible={visible} title="Cấu Hình Ngưỡng Y Tế" onClose={onClose} isDarkMode={isDarkMode} colors={colors}>
    <Text style={styles.fieldLabel}>Nhịp tim tối đa (bpm)</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      keyboardType="numeric"
      value={hrHigh}
      onChangeText={onChangeHrHigh}
    />

    <Text style={styles.fieldLabel}>Nhịp tim tối thiểu (bpm)</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      keyboardType="numeric"
      value={hrLow}
      onChangeText={onChangeHrLow}
    />

    <Text style={styles.fieldLabel}>SpO₂ tối thiểu (%)</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      keyboardType="numeric"
      value={spo2Low}
      onChangeText={onChangeSpo2Low}
    />

    <SubmitBtn title="Lưu Cấu Hình" onPress={onSave} />
  </BaseModal>
);

// =============================================================
// 5. MODAL KÊ ĐƠN THUỐC / SỬA ĐƠN THUỐC
// =============================================================
export interface PrescriptionFormModalProps {
  visible: boolean;
  isEditing: boolean;
  medName: string;
  dosage: string;
  frequency: string;
  scheduleTimes: string;
  instructions: string;
  enableSpeaker: boolean;
  onChangeMedName: (val: string) => void;
  onChangeDosage: (val: string) => void;
  onChangeFrequency: (val: string) => void;
  onChangeScheduleTimes: (val: string) => void;
  onChangeInstructions: (val: string) => void;
  onToggleEnableSpeaker: (val: boolean) => void;
  isSubmitting: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
  patientName?: string;
  customTitle?: string;
  customSubmitText?: string;
}

export const PrescriptionFormModal: React.FC<PrescriptionFormModalProps> = ({
  visible,
  isEditing,
  medName,
  dosage,
  frequency,
  scheduleTimes,
  instructions,
  enableSpeaker,
  onChangeMedName,
  onChangeDosage,
  onChangeFrequency,
  onChangeScheduleTimes,
  onChangeInstructions,
  onToggleEnableSpeaker,
  isSubmitting,
  onSave,
  onClose,
  isDarkMode,
  colors,
  patientName,
  customTitle,
  customSubmitText,
}) => (
  <BaseModal
    visible={visible}
    title={customTitle || (isEditing ? 'Sửa Đơn Thuốc' : 'Kê Đơn Thuốc Mới')}
    onClose={onClose}
    isDarkMode={isDarkMode}
    colors={colors}
  >
    {patientName ? (
      <>
        <Text style={styles.fieldLabel}>Bệnh nhân tiếp nhận</Text>
        <View style={[styles.patientSelector, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
          <Text style={[styles.patientSelectorText, { color: colors.textPrimary }]}>👤 {patientName}</Text>
        </View>
      </>
    ) : null}

    <Text style={styles.fieldLabel}>Tên thuốc (*)</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="VD: Amlodipine 5mg..."
      placeholderTextColor="#94A3B8"
      value={medName}
      onChangeText={onChangeMedName}
    />

    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>Liều dùng (*)</Text>
        <TextInput
          style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="VD: 1 viên"
          placeholderTextColor="#94A3B8"
          value={dosage}
          onChangeText={onChangeDosage}
        />
      </View>
      <View style={{ flex: 1.2 }}>
        <Text style={styles.fieldLabel}>Tần suất</Text>
        <TextInput
          style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="VD: Hàng ngày"
          placeholderTextColor="#94A3B8"
          value={frequency}
          onChangeText={onChangeFrequency}
        />
      </View>
    </View>

    <Text style={styles.fieldLabel}>Giờ uống thuốc (cách nhau bởi dấu phẩy)</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="VD: 08:00, 19:30"
      placeholderTextColor="#94A3B8"
      value={scheduleTimes}
      onChangeText={onChangeScheduleTimes}
    />

    <Text style={styles.fieldLabel}>Dặn dò cách uống</Text>
    <TextInput
      style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
      placeholder="VD: Uống sau ăn 15 phút..."
      placeholderTextColor="#94A3B8"
      value={instructions}
      onChangeText={onChangeInstructions}
    />

    <View style={styles.switchRow}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Nhắc nhở qua Loa Hub AI</Text>
        <Text style={styles.switchSub}>Tự động phát lời nhắc uống thuốc cho bệnh nhân</Text>
      </View>
      <Switch value={enableSpeaker} onValueChange={onToggleEnableSpeaker} trackColor={{ false: '#94A3B8', true: Colors.primary }} />
    </View>

    <SubmitBtn title={customSubmitText || (isEditing ? 'Cập Nhật Đơn Thuốc' : 'Lưu Đơn Thuốc')} onPress={onSave} loading={isSubmitting} />
  </BaseModal>
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    borderRadius: 14,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
    marginBottom: 4,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  patientSelector: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  patientSelectorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingVertical: 6,
  },
  switchTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 10.5,
    color: '#64748B',
  },
  severityPickerRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  severityOptionBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  severityOptionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

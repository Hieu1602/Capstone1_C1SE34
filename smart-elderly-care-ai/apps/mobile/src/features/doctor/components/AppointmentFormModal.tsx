import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';

interface AppointmentFormModalProps {
  visible: boolean;
  isEditing: boolean;
  patientName: string;
  scheduledAt: string;
  examType: string;
  location: string;
  instructions: string;
  enableSpeaker: boolean;
  isSubmitting: boolean;
  onChangePatientName: (val: string) => void;
  onChangeScheduledAt: (val: string) => void;
  onChangeExamType: (val: string) => void;
  onChangeLocation: (val: string) => void;
  onChangeInstructions: (val: string) => void;
  onToggleEnableSpeaker: (val: boolean) => void;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentFormModal: React.FC<AppointmentFormModalProps> = ({
  visible,
  isEditing,
  patientName,
  scheduledAt,
  examType,
  location,
  instructions,
  enableSpeaker,
  isSubmitting,
  onChangePatientName,
  onChangeScheduledAt,
  onChangeExamType,
  onChangeLocation,
  onChangeInstructions,
  onToggleEnableSpeaker,
  onSave,
  onClose,
  isDarkMode,
  colors,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {isEditing ? 'Chỉnh Sửa Lịch Khám' : 'Đặt Lịch Tái Khám Mới'}
            </LocalizedText>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <LocalizedText style={styles.fieldLabel}>Bệnh nhân (*)</LocalizedText>
            <LocalizedTextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={patientName}
              onChangeText={onChangePatientName}
              placeholder="VD: Cụ Nguyễn Văn An"
              placeholderTextColor="#94A3B8"
            />

            <LocalizedText style={styles.fieldLabel}>Ngày & Giờ tái khám (*)</LocalizedText>
            <LocalizedTextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={scheduledAt}
              onChangeText={onChangeScheduledAt}
              placeholder="VD: 15/10/2026 - 08:30"
              placeholderTextColor="#94A3B8"
            />

            <LocalizedText style={styles.fieldLabel}>Chuyên khoa / Mục đích khám (*)</LocalizedText>
            <LocalizedTextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={examType}
              onChangeText={onChangeExamType}
              placeholder="VD: Tái khám tim mạch & huyết áp"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.quickTypeRow}>
              {['Tái khám tim mạch', 'Đo điện tâm đồ (ECG)', 'Xét nghiệm máu', 'Khám tổng quát'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.quickTypePill}
                  onPress={() => onChangeExamType(item)}
                >
                  <LocalizedText style={styles.quickTypePillText}>{item}</LocalizedText>
                </TouchableOpacity>
              ))}
            </View>

            <LocalizedText style={styles.fieldLabel}>Địa điểm khám</LocalizedText>
            <LocalizedTextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={location}
              onChangeText={onChangeLocation}
              placeholder="VD: Tại nhà (Khám tại gia)"
              placeholderTextColor="#94A3B8"
            />

            <LocalizedText style={styles.fieldLabel}>Dặn dò người nhà & bệnh nhân</LocalizedText>
            <LocalizedTextInput
              style={[
                styles.inputField,
                { height: 70, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
              ]}
              multiline
              value={instructions}
              onChangeText={onChangeInstructions}
              placeholder="VD: Đo huyết áp 3 ngày trước khám. Nhịn ăn sáng để xét nghiệm..."
              placeholderTextColor="#94A3B8"
            />

            {/* Bật / Tắt phát loa nhắc */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <LocalizedText style={[styles.switchTitle, { color: colors.textPrimary }]}>
                  Phát loa nhắc nhở qua Hub AI
                </LocalizedText>
                <LocalizedText style={[styles.switchSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Tự động phát giọng nói nhắc cụ và người nhà trước ngày khám
                </LocalizedText>
              </View>
              <Switch
                value={enableSpeaker}
                onValueChange={onToggleEnableSpeaker}
                trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.btnCancel, { borderColor: colors.border }]}
                onPress={onClose}
              >
                <LocalizedText style={[styles.btnCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                  Hủy
                </LocalizedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSave} onPress={onSave} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <LocalizedText style={styles.btnSaveText}>Lưu lịch hẹn</LocalizedText>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: { borderRadius: 14, padding: 18, maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16.5, fontWeight: '800' },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  quickTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  quickTypePill: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  quickTypePillText: { fontSize: 11, color: '#0284C7', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F066',
  },
  switchTitle: { fontSize: 12.5, fontWeight: '700' },
  switchSub: { fontSize: 10.5, marginTop: 1 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  btnCancel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  btnCancelText: { fontSize: 12.5, fontWeight: '700' },
  btnSave: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary },
  btnSaveText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
});

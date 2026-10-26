import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, LocalizedTextInput } from '../../../i18n/LocalizedComponents';
import { AppointmentItem } from './types';

interface AppointmentCancelModalProps {
  visible: boolean;
  appointment: AppointmentItem | null;
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentCancelModal: React.FC<AppointmentCancelModalProps> = ({
  visible,
  appointment,
  isSubmitting,
  onConfirm,
  onClose,
  isDarkMode,
  colors,
}) => {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErrorMsg('Vui lòng nhập lý do hủy lịch khám (tối thiểu 3 ký tự).');
      return;
    }
    setErrorMsg('');
    onConfirm(trimmed);
  };

  const handleClose = () => {
    setReason('');
    setErrorMsg('');
    onClose();
  };

  if (!appointment) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.iconCircle}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </View>
              <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Hủy Lịch Hẹn Khám
              </LocalizedText>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Appointment brief info */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC', borderColor: colors.border },
            ]}
          >
            <LocalizedText style={[styles.infoPatient, { color: colors.textPrimary }]}>
              {appointment.patient_name}
            </LocalizedText>
            <LocalizedText style={[styles.infoTime, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              📅 {appointment.scheduled_at} • 🩺 {appointment.exam_type || appointment.visit_type || 'Khám bệnh'}
            </LocalizedText>
          </View>

          <LocalizedText style={styles.fieldLabel}>Lý do hủy lịch (*) :</LocalizedText>
          <LocalizedTextInput
            style={[
              styles.inputReason,
              {
                color: colors.textPrimary,
                borderColor: errorMsg ? '#EF4444' : colors.border,
                backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
              },
            ]}
            multiline
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="VD: Bệnh nhân có việc gia đình đột xuất / Đã nhập viện điều trị..."
            placeholderTextColor="#94A3B8"
          />

          {/* Gợi ý lý do hủy nhanh */}
          <View style={styles.quickSuggestionsRow}>
            {[
              'Bệnh nhân có việc đột xuất',
              'Bác sĩ có ca mổ khẩn cấp',
              'Chuyển viện điều trị chuyên khoa',
              'Sức khỏe ổn định, hoãn tái khám',
            ].map((sug) => (
              <TouchableOpacity
                key={sug}
                style={[
                  styles.quickPill,
                  {
                    backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
                    borderColor: reason === sug ? '#EF4444' : (isDarkMode ? '#475569' : '#CBD5E1'),
                  },
                ]}
                onPress={() => {
                  setReason(sug);
                  if (errorMsg) setErrorMsg('');
                }}
              >
                <LocalizedText
                  style={[
                    styles.quickPillText,
                    { color: reason === sug ? '#DC2626' : (isDarkMode ? '#CBD5E1' : '#475569') },
                  ]}
                >
                  {sug}
                </LocalizedText>
              </TouchableOpacity>
            ))}
          </View>

          {errorMsg ? (
            <LocalizedText style={styles.errorText}>{errorMsg}</LocalizedText>
          ) : null}

          <LocalizedText style={[styles.noticeText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            ℹ️ Việc hủy lịch sẽ tự động hủy các chuông/thông báo nhắc nhở đã lên lịch cho người nhà bệnh nhân.
          </LocalizedText>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnCancel, { borderColor: colors.border }]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <LocalizedText style={[styles.btnCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                Quay lại
              </LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnConfirmCancel}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <LocalizedText style={styles.btnConfirmCancelText}>Xác nhận hủy</LocalizedText>
              )}
            </TouchableOpacity>
          </View>
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
    padding: 20,
  },
  modalBox: {
    borderRadius: 14,
    padding: 18,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  infoPatient: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoTime: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  inputReason: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    height: 75,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: '600',
  },
  noticeText: {
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  btnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnCancelText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  btnConfirmCancel: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  btnConfirmCancelText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  quickSuggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

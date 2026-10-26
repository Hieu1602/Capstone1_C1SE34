import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { AppointmentItem } from './types';

interface AppointmentCompleteModalProps {
  visible: boolean;
  appointment: AppointmentItem | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const AppointmentCompleteModal: React.FC<AppointmentCompleteModalProps> = ({
  visible,
  appointment,
  isSubmitting,
  onConfirm,
  onClose,
  isDarkMode,
  colors,
}) => {
  if (!appointment) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
              </View>
              <LocalizedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Xác Nhận Đã Khám Xong
              </LocalizedText>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Details */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC', borderColor: colors.border },
            ]}
          >
            <LocalizedText style={[styles.infoPatient, { color: colors.textPrimary }]}>
              {appointment.patient_name}
            </LocalizedText>
            <LocalizedText style={[styles.infoMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              📅 Thời gian: {appointment.scheduled_at}
            </LocalizedText>
            <LocalizedText style={[styles.infoMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              🩺 Chuyên khoa: {appointment.exam_type || appointment.visit_type || 'Khám bệnh'}
            </LocalizedText>
            {appointment.location ? (
              <LocalizedText style={[styles.infoMeta, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                📍 Địa điểm: {appointment.location}
              </LocalizedText>
            ) : null}
          </View>

          <LocalizedText style={[styles.confirmPrompt, { color: colors.textPrimary }]}>
            Bác sĩ xác nhận đã hoàn tất khám cho bệnh nhân?
          </LocalizedText>
          <LocalizedText style={[styles.confirmDesc, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Trạng thái lịch hẹn sẽ được chuyển sang "ĐÃ KHÁM XONG" và đóng tất cả nhắc nhở còn lại.
          </LocalizedText>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnCancel, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <LocalizedText style={[styles.btnCancelText, { color: isDarkMode ? '#CBD5E1' : '#64748B' }]}>
                Quay lại
              </LocalizedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnConfirm}
              onPress={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <LocalizedText style={styles.btnConfirmText}>Xác nhận hoàn tất</LocalizedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    backgroundColor: '#D1FAE5',
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
    padding: 12,
    marginBottom: 12,
  },
  infoPatient: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmPrompt: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 4,
  },
  confirmDesc: {
    fontSize: 11.5,
    marginTop: 4,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
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
  btnConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

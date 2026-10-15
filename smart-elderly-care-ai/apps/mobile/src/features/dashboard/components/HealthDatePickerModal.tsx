// HealthDatePickerModal.tsx
// Modal chọn ngày kiểm tra trên lịch hoặc phím tắt cho ứng dụng mobile

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';

interface HealthDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  draftDate: string;
  setDraftDate: (val: string) => void;
  onConfirmDate: (val: string) => void;
  todayStr: string;
  yesterdayStr: string;
  twoDaysAgoStr: string;
  threeDaysAgoStr: string;
  isDarkMode: boolean;
  colors: any;
}

export const HealthDatePickerModal: React.FC<HealthDatePickerModalProps> = ({
  visible,
  onClose,
  draftDate,
  setDraftDate,
  onConfirmDate,
  todayStr,
  yesterdayStr,
  twoDaysAgoStr,
  threeDaysAgoStr,
  isDarkMode,
  colors,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalIconBox}>
              <Ionicons name="calendar" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, isDarkMode && { color: colors.textPrimary }]}>
                Chọn ngày kiểm tra
              </Text>
              <Text style={[styles.modalSub, isDarkMode && { color: colors.textSecondary }]}>
                Chọn ngày để tra cứu chỉ số sinh tồn & nhật ký
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalInputLabel, isDarkMode && { color: colors.textSecondary }]}>
            Nhập ngày cần tra cứu (định dạng YYYY-MM-DD):
          </Text>
          <TextInput
            style={[
              styles.modalDateInput,
              isDarkMode && { backgroundColor: colors.surfaceSubtle, color: colors.textPrimary, borderColor: colors.border },
            ]}
            value={draftDate}
            onChangeText={setDraftDate}
            placeholder="Ví dụ: 2026-09-28"
            placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
          />

          {/* Phím chọn nhanh trong popup */}
          <Text style={[styles.modalInputLabel, { marginTop: 10, marginBottom: 8 }, isDarkMode && { color: colors.textSecondary }]}>
            Hoặc chọn ngày nhanh:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {[
              { label: 'Hôm nay', val: todayStr },
              { label: 'Hôm qua', val: yesterdayStr },
              { label: '2 ngày trước', val: twoDaysAgoStr },
              { label: '3 ngày trước', val: threeDaysAgoStr },
            ].map((item) => (
              <TouchableOpacity
                key={item.val}
                style={[
                  styles.modalQuickChip,
                  draftDate === item.val && styles.modalQuickChipActive,
                  isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                ]}
                onPress={() => setDraftDate(item.val)}
              >
                <Text
                  style={[
                    styles.modalQuickChipText,
                    draftDate === item.val && { color: '#2563EB', fontWeight: '700' },
                    isDarkMode && { color: colors.textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, isDarkMode && { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.modalCancelBtnText, isDarkMode && { color: colors.textSecondary }]}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => {
                const trimmed = draftDate.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                  onConfirmDate(trimmed);
                  onClose();
                } else {
                  Alert.alert('Định dạng chưa đúng', 'Vui lòng nhập ngày theo định dạng YYYY-MM-DD (Ví dụ: 2026-09-28)');
                }
              }}
            >
              <Ionicons name="search" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.modalConfirmBtnText}>Xem dữ liệu</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalDateInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    color: Colors.textPrimary,
  },
  modalQuickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalQuickChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  modalQuickChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default HealthDatePickerModal;

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../../theme/colors';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import { IoTDeviceItem } from '../../../../store/useVitalStore';

export interface DeleteDeviceConfirmModalProps {
  visible: boolean;
  device: IoTDeviceItem | null;
  onClose: () => void;
  onConfirmDelete: () => void;
  isDarkMode?: boolean;
  colors?: any;
}

export const DeleteDeviceConfirmModal: React.FC<DeleteDeviceConfirmModalProps> = ({
  visible,
  device,
  onClose,
  onConfirmDelete,
  isDarkMode = false,
  colors = {},
}) => {
  if (!device) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.confirmModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.confirmModalCard, isDarkMode && { backgroundColor: colors.card }]}>
              <View style={styles.confirmModalIconRing}>
                <Ionicons name="trash" size={32} color="#EF4444" />
              </View>

              <LocalizedText style={[styles.confirmModalTitle, isDarkMode && { color: colors.textPrimary }]}>
                Xác Nhận Xóa Thiết Bị?
              </LocalizedText>

              <LocalizedText style={[styles.confirmModalDesc, isDarkMode && { color: colors.textSecondary }]}>
                Bạn có chắc chắn muốn xóa thiết bị{' '}
                <LocalizedText style={{ fontWeight: '800', color: isDarkMode ? '#F87171' : '#DC2626' }}>
                  "{device.name}"
                </LocalizedText>
                {'\n'}
                ({device.sub}) khỏi hệ thống không?
              </LocalizedText>

              <View style={styles.confirmModalActions}>
                <TouchableOpacity
                  style={[styles.confirmModalCancelBtn, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <LocalizedText style={[styles.confirmModalCancelBtnText, isDarkMode && { color: colors.textSecondary }]}>
                    Hủy bỏ
                  </LocalizedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmModalDeleteBtn}
                  onPress={onConfirmDelete}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color="#FFF" />
                  <LocalizedText style={styles.confirmModalDeleteBtnText}>Xóa thiết bị</LocalizedText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  confirmModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    ...Shadows.card,
  },
  confirmModalIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmModalDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmModalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  confirmModalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmModalDeleteBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmModalDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});


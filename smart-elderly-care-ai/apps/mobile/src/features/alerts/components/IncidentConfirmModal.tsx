import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IncidentConfirmModalProps {
  confirmModal: 'ACK' | 'REOPEN' | null;
  isDarkMode: boolean;
  onClose: () => void;
  onConfirmAck: () => void;
  onConfirmReopen: () => void;
}

export const IncidentConfirmModal: React.FC<IncidentConfirmModalProps> = ({
  confirmModal,
  isDarkMode,
  onClose,
  onConfirmAck,
  onConfirmReopen,
}) => {
  const isReopen = confirmModal === 'REOPEN';

  return (
    <Modal transparent visible={confirmModal !== null} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
          onPress={() => {}}
        >
          <View
            style={[
              styles.modalIconWrap,
              {
                backgroundColor: isReopen
                  ? isDarkMode ? '#7C2D1240' : '#FFF7ED'
                  : isDarkMode ? '#064E3B40' : '#ECFDF5',
              },
            ]}
          >
            <Ionicons
              name={isReopen ? 'warning' : 'shield-checkmark'}
              size={30}
              color={isReopen ? '#EA580C' : '#16A34A'}
            />
          </View>

          <Text style={[styles.modalTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
            {isReopen ? 'Mở lại cảnh báo khẩn cấp?' : 'Xác nhận an toàn?'}
          </Text>

          <Text style={[styles.modalBody, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
            {isReopen
              ? 'Hệ thống sẽ kích hoạt lại còi báo động tại nhà và gửi thông báo ứng cứu cho gia đình.'
              : 'Xác nhận người cao tuổi đã an toàn, tắt còi báo động và lưu trạng thái xử lý.'}
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalCancelText, { color: isDarkMode ? '#E2E8F0' : '#475569' }]}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: isReopen ? '#DC2626' : '#16A34A' }]}
              onPress={() => {
                onClose();
                if (isReopen) onConfirmReopen();
                else if (confirmModal === 'ACK') onConfirmAck();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmText}>
                {isReopen ? 'Xác nhận mở lại' : 'Xác nhận an toàn'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrap: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  modalBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 22 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalConfirmBtn: { flex: 1.2, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

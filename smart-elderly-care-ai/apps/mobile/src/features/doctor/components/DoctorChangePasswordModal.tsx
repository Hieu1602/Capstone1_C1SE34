import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DoctorChangePasswordModalProps {
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
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="key" size={20} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Đổi Mật Khẩu Bác Sĩ</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={{ marginVertical: 10 }}>
            <Text style={styles.fieldLabel}>Mật khẩu hiện tại (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              secureTextEntry
              value={oldPassword}
              onChangeText={onChangeOldPassword}
              placeholder="Nhập mật khẩu hiện tại"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Mật khẩu mới (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              secureTextEntry
              value={newPassword}
              onChangeText={onChangeNewPassword}
              placeholder="Tối thiểu 6 ký tự"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Xác nhận mật khẩu mới (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              secureTextEntry
              value={confirmPassword}
              onChangeText={onChangeConfirmPassword}
              placeholder="Nhập lại mật khẩu mới"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: '#D97706' }]}
              onPress={onSave}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Cập Nhật Mật Khẩu</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
    paddingTop: 10,
  },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  modalSaveBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

interface DoctorNotesModalProps {
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
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ghi Chú & Lịch Tái Khám</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Lời dặn dò y khoa</Text>
          <TextInput
            style={[
              styles.inputField,
              { height: 80, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
            ]}
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

          <TouchableOpacity style={styles.modalSubmitBtn} onPress={onSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.modalSubmitBtnText}>Lưu Thay Đổi</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalBox: { borderRadius: 14, padding: 18, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  fieldLabel: { fontSize: 11.5, fontWeight: '700', color: '#64748B', marginTop: 8, marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  modalSubmitBtn: { backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

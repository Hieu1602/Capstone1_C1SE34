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
import { Colors } from '../../../theme/colors';

interface ThresholdsConfigModalProps {
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
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cấu Hình Ngưỡng Y Tế</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

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

          <TouchableOpacity style={styles.modalSubmitBtn} onPress={onSave}>
            <Text style={styles.modalSubmitBtnText}>Lưu Cấu Hình</Text>
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

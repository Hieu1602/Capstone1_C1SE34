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
import { SeverityType } from './types';

interface ConditionFormModalProps {
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
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {isEditing ? 'Sửa Chẩn Đoán Bệnh Lý' : 'Thêm Bệnh Lý Nền Mới'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

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
                  style={[
                    styles.severityOptionBtn,
                    isSelected ? { borderColor: s.color, backgroundColor: s.bg } : { borderColor: colors.border },
                  ]}
                  onPress={() => onChangeSeverity(s.key)}
                >
                  <Text
                    style={[
                      styles.severityOptionText,
                      { color: isSelected ? s.color : isDarkMode ? '#CBD5E1' : '#64748B' },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Ghi chú lâm sàng</Text>
          <TextInput
            style={[
              styles.inputField,
              { height: 70, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border },
            ]}
            multiline
            placeholder="Dặn dò cụ thể..."
            placeholderTextColor="#94A3B8"
            value={note}
            onChangeText={onChangeNote}
          />

          <TouchableOpacity style={styles.modalSubmitBtn} onPress={onSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.modalSubmitBtnText}>Lưu Bệnh Lý</Text>
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
  severityPickerRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  severityOptionBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6, borderWidth: 1 },
  severityOptionText: { fontSize: 11, fontWeight: '700' },
  modalSubmitBtn: { backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

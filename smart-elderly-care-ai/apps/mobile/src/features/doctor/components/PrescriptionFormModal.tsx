import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

interface PrescriptionFormModalProps {
  visible: boolean;
  isEditing: boolean;
  medName: string;
  dosage: string;
  frequency: string;
  scheduleTimes: string;
  instructions: string;
  enableSpeaker: boolean;
  onChangeMedName: (val: string) => void;
  onChangeDosage: (val: string) => void;
  onChangeFrequency: (val: string) => void;
  onChangeScheduleTimes: (val: string) => void;
  onChangeInstructions: (val: string) => void;
  onToggleEnableSpeaker: (val: boolean) => void;
  isSubmitting: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
  patientName?: string;
  customTitle?: string;
  customSubmitText?: string;
}

export const PrescriptionFormModal: React.FC<PrescriptionFormModalProps> = ({
  visible,
  isEditing,
  medName,
  dosage,
  frequency,
  scheduleTimes,
  instructions,
  enableSpeaker,
  onChangeMedName,
  onChangeDosage,
  onChangeFrequency,
  onChangeScheduleTimes,
  onChangeInstructions,
  onToggleEnableSpeaker,
  isSubmitting,
  onSave,
  onClose,
  isDarkMode,
  colors,
  patientName,
  customTitle,
  customSubmitText,
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
              {customTitle || (isEditing ? 'Sửa Đơn Thuốc' : 'Kê Đơn Thuốc Mới')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {patientName ? (
            <>
              <Text style={styles.fieldLabel}>Bệnh nhân tiếp nhận</Text>
              <View style={[styles.patientSelector, { backgroundColor: isDarkMode ? '#334155' : '#EEF2F6' }]}>
                <Text style={[styles.patientSelectorText, { color: colors.textPrimary }]}>
                  👤 {patientName}
                </Text>
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Tên thuốc (*)</Text>
          <TextInput
            style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="VD: Amlodipine 5mg..."
            placeholderTextColor="#94A3B8"
            value={medName}
            onChangeText={onChangeMedName}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Liều dùng (*)</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="VD: 1 viên"
                placeholderTextColor="#94A3B8"
                value={dosage}
                onChangeText={onChangeDosage}
              />
            </View>
            <View style={{ flex: 1.2 }}>
              <Text style={styles.fieldLabel}>Tần suất</Text>
              <TextInput
                style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="VD: Hàng ngày"
                placeholderTextColor="#94A3B8"
                value={frequency}
                onChangeText={onChangeFrequency}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Giờ uống thuốc (cách nhau bởi dấu phẩy)</Text>
          <TextInput
            style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="VD: 08:00, 19:30"
            placeholderTextColor="#94A3B8"
            value={scheduleTimes}
            onChangeText={onChangeScheduleTimes}
          />

          <Text style={styles.fieldLabel}>Dặn dò cách uống</Text>
          <TextInput
            style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="VD: Uống sau ăn 15 phút..."
            placeholderTextColor="#94A3B8"
            value={instructions}
            onChangeText={onChangeInstructions}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Nhắc nhở qua Loa Hub AI</Text>
              <Text style={styles.switchSub}>Tự động phát lời nhắc uống thuốc cho bệnh nhân</Text>
            </View>
            <Switch
              value={enableSpeaker}
              onValueChange={onToggleEnableSpeaker}
              trackColor={{ false: '#94A3B8', true: Colors.primary }}
            />
          </View>

          <TouchableOpacity style={styles.modalSubmitBtn} onPress={onSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.modalSubmitBtnText}>
                {customSubmitText || (isEditing ? 'Cập Nhật Đơn Thuốc' : 'Lưu Đơn Thuốc')}
              </Text>
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
  patientSelector: { padding: 10, borderRadius: 8, marginBottom: 4 },
  patientSelectorText: { fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingVertical: 6 },
  switchTitle: { fontSize: 12.5, fontWeight: '700' },
  switchSub: { fontSize: 10.5, color: '#64748B' },
  modalSubmitBtn: { backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

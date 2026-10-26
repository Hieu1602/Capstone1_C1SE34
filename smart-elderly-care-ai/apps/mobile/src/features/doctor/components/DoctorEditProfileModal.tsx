import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

interface DoctorEditProfileModalProps {
  visible: boolean;
  editName: string;
  editDegree: string;
  editSpecialty: string;
  editHospital: string;
  editDepartment: string;
  editPhone: string;
  editAvatarUri: string | null;
  onChangeName: (val: string) => void;
  onChangeDegree: (val: string) => void;
  onChangeSpecialty: (val: string) => void;
  onChangeHospital: (val: string) => void;
  onChangeDepartment: (val: string) => void;
  onChangePhone: (val: string) => void;
  onPickImage: () => void;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}

export const DoctorEditProfileModal: React.FC<DoctorEditProfileModalProps> = ({
  visible,
  editName,
  editDegree,
  editSpecialty,
  editHospital,
  editDepartment,
  editPhone,
  editAvatarUri,
  onChangeName,
  onChangeDegree,
  onChangeSpecialty,
  onChangeHospital,
  onChangeDepartment,
  onChangePhone,
  onPickImage,
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
              <Ionicons name="person-circle" size={22} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sửa Hồ Sơ Bác Sĩ</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
            <View style={[styles.modalAvatarRow, { backgroundColor: isDarkMode ? '#334155' : '#F8FAFC' }]}>
              <View style={styles.modalAvatarWrap}>
                {editAvatarUri ? (
                  <Image source={{ uri: editAvatarUri }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={28} color="#FFFFFF" />
                )}
              </View>
              <TouchableOpacity style={styles.btnPickImage} onPress={onPickImage} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={styles.btnPickImageText}>Chọn / Đổi ảnh đại diện</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Họ và tên Bác sĩ (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editName}
              onChangeText={onChangeName}
              placeholder="VD: BS. Nguyễn Văn An"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Học hàm, học vị</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editDegree}
              onChangeText={onChangeDegree}
              placeholder="VD: Bác sĩ CKI, Thạc sĩ Y khoa..."
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Chuyên khoa</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editSpecialty}
              onChangeText={onChangeSpecialty}
              placeholder="VD: Lão khoa, Tim mạch..."
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Bệnh viện / Cơ sở y tế</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editHospital}
              onChangeText={onChangeHospital}
              placeholder="VD: Bệnh viện Đa khoa Đà Nẵng"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Khoa / Phòng công tác</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editDepartment}
              onChangeText={onChangeDepartment}
              placeholder="VD: Khoa Khám bệnh"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Số điện thoại liên hệ (*)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editPhone}
              onChangeText={onChangePhone}
              keyboardType="phone-pad"
              placeholder="VD: 0905123456"
              placeholderTextColor="#94A3B8"
            />
          </ScrollView>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#CBD5E1' : '#64748B' }}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: Colors.primary }]}
              onPress={onSave}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Lưu Hồ Sơ</Text>
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
  modalAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    borderRadius: 10,
  },
  modalAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: { width: '100%', height: '100%' },
  btnPickImage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  btnPickImageText: { fontSize: 12.5, fontWeight: '700', color: '#0284C7' },
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

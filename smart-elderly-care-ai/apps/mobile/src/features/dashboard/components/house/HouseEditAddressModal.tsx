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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';

interface HouseEditAddressModalProps {
  visible: boolean;
  address: string;
  setAddress: (val: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: {
    bgCard: string;
    borderCol: string;
    textTitle: string;
    textSub: string;
  };
}

export const HouseEditAddressModal: React.FC<HouseEditAddressModalProps> = ({
  visible,
  address,
  setAddress,
  isSaving,
  onSave,
  onClose,
  isDarkMode,
  colors: { bgCard, borderCol, textTitle, textSub },
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: bgCard,
              borderColor: borderCol,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <Text style={[styles.modalTitle, { color: textTitle }]}>Địa chỉ nhà thực tế</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={textSub} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: textSub, marginBottom: 14 }]}>
              Nhập địa chỉ vị trí thực tế của căn hộ / gia đình để thuận tiện khi có cảnh báo khẩn cấp hoặc hỗ trợ y tế.
            </Text>

            <TextInput
              style={[
                styles.addressInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderColor: borderCol,
                  color: textTitle,
                  minHeight: 46,
                },
              ]}
              value={address}
              onChangeText={setAddress}
              placeholder="VD: Số 123 Đường ABC, Quận XYZ, TP. Đà Nẵng"
              placeholderTextColor="#94A3B8"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSave}
            />

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: borderCol }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { opacity: isSaving ? 0.7 : 1 }]}
                onPress={onSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Lưu lại</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
  },
  scrollContent: {
    flexGrow: 0,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    marginTop: 2,
  },
  addressInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingTop: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F97316',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});


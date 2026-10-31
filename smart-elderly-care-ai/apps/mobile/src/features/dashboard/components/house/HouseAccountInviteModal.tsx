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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HouseAccountInviteModalProps {
  visible: boolean;
  selectedInviteRole: 'MEMBER' | 'ADMIN';
  newMemberName: string;
  setNewMemberName: (val: string) => void;
  newMemberPhone: string;
  setNewMemberPhone: (val: string) => void;
  newCanViewCamera: boolean;
  setNewCanViewCamera: (val: boolean) => void;
  newCanViewHealth: boolean;
  setNewCanViewHealth: (val: boolean) => void;
  newCanManageDevices: boolean;
  setNewCanManageDevices: (val: boolean) => void;
  newCanManageRecords: boolean;
  setNewCanManageRecords: (val: boolean) => void;
  isAddingMember?: boolean;
  onAddMember: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: {
    bgCard: string;
    borderCol: string;
    textTitle: string;
    textSub: string;
  };
}

export const HouseAccountInviteModal: React.FC<HouseAccountInviteModalProps> = ({
  visible,
  selectedInviteRole,
  newMemberName,
  setNewMemberName,
  newMemberPhone,
  setNewMemberPhone,
  newCanViewCamera,
  setNewCanViewCamera,
  newCanViewHealth,
  setNewCanViewHealth,
  newCanManageDevices,
  setNewCanManageDevices,
  newCanManageRecords,
  setNewCanManageRecords,
  isAddingMember = false,
  onAddMember,
  onClose,
  isDarkMode,
  colors: { bgCard, borderCol, textTitle, textSub },
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <Text style={[styles.modalTitle, { color: textTitle }]}>Mời qua Tài khoản</Text>
          <View
            style={[
              styles.inviteRoleBadgeContainer,
              { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' },
            ]}
          >
            <Text style={[styles.inviteRoleBadgeText, { color: '#2563EB' }]}>
              👤 Vai trò: Thành viên
            </Text>
          </View>
          <Text style={[styles.modalSub, { color: textSub, marginTop: 4 }]}>
            Nhập số điện thoại để mời tài khoản vào căn nhà.
          </Text>

          <TextInput
            style={[
              styles.addressInput,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: borderCol,
                color: textTitle,
                marginTop: 12,
              },
            ]}
            value={newMemberPhone}
            onChangeText={setNewMemberPhone}
            placeholder="Nhập số điện thoại (ví dụ: 0912 345 678)"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
          />

          {/* Thông báo quyền hạn thành viên */}
          <View
            style={[
              styles.memberNoticeBox,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#F0FDF4',
                borderColor: isDarkMode ? '#334155' : '#BBF7D0',
              },
            ]}
          >
            <Ionicons name="information-circle" size={20} color="#16A34A" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={[styles.memberNoticeText, { color: isDarkMode ? '#86EFAC' : '#15803D' }]}>
              Thành viên được thêm có quyền xem camera, theo dõi sức khỏe và nhận cảnh báo khẩn cấp (chỉ xem, không có quyền xóa hoặc thay đổi cấu hình).
            </Text>
          </View>

          <View style={styles.modalActionButtons}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0', borderColor: borderCol },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isAddingMember && { opacity: 0.7 }]}
              onPress={onAddMember}
              disabled={isAddingMember}
              activeOpacity={0.8}
            >
              {isAddingMember ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Thêm thành viên</Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    marginTop: 2,
  },
  inviteRoleBadgeContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  inviteRoleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addressInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginTop: 12,
  },
  adminNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    gap: 8,
  },
  adminNoticeText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  permCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  permCheckLabel: {
    fontSize: 13,
    fontWeight: '600',
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
  memberNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  memberNoticeText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
});


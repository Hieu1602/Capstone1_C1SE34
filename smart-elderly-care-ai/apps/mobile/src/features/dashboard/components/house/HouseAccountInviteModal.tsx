import React, { useState } from 'react';
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
  selectedInviteRole?: 'MEMBER' | 'ADMIN';
  inviteRoleType?: 'MEMBER' | 'DOCTOR';
  setInviteRoleType?: (role: 'MEMBER' | 'DOCTOR') => void;
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
  toastInfo?: { message: string; type?: 'success' | 'error' } | null;
}

export const HouseAccountInviteModal: React.FC<HouseAccountInviteModalProps> = ({
  visible,
  selectedInviteRole,
  inviteRoleType,
  setInviteRoleType,
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
  toastInfo,
}) => {
  const [internalRoleType, setInternalRoleType] = useState<'MEMBER' | 'DOCTOR'>('MEMBER');
  const roleType = inviteRoleType || internalRoleType;
  const updateRoleType = setInviteRoleType || setInternalRoleType;
  const isDoctor = roleType === 'DOCTOR';

  return (
    <Modal visible={visible} transparent animationType="slide">
      {toastInfo && (
        <View style={styles.modalToastContainer} pointerEvents="none">
          <View
            style={[
              styles.modalToastCard,
              toastInfo.type === 'error' && styles.modalToastCardError,
            ]}
          >
            <Ionicons
              name={toastInfo.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.modalToastText}>{toastInfo.message}</Text>
          </View>
        </View>
      )}
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <Text style={[styles.modalTitle, { color: textTitle }]}>Mời vào Căn nhà</Text>

          {/* Chọn vai trò: Thành viên gia đình vs Bác sĩ gia đình */}
          <View style={styles.roleSelectorRow}>
            <TouchableOpacity
              style={[
                styles.roleSelectBtn,
                !isDoctor && styles.roleSelectBtnActiveMember,
                {
                  backgroundColor: !isDoctor ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : (isDarkMode ? '#0F172A' : '#F8FAFC'),
                  borderColor: !isDoctor ? '#3B82F6' : borderCol,
                },
              ]}
              onPress={() => updateRoleType('MEMBER')}
              activeOpacity={0.7}
            >
              <Ionicons name="person" size={16} color={!isDoctor ? '#2563EB' : textSub} />
              <Text style={[styles.roleSelectBtnText, { color: !isDoctor ? '#2563EB' : textSub, fontWeight: !isDoctor ? '700' : '500' }]}>
                Thành viên
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleSelectBtn,
                isDoctor && styles.roleSelectBtnActiveDoctor,
                {
                  backgroundColor: isDoctor ? (isDarkMode ? '#064E3B' : '#ECFDF5') : (isDarkMode ? '#0F172A' : '#F8FAFC'),
                  borderColor: isDoctor ? '#10B981' : borderCol,
                },
              ]}
              onPress={() => updateRoleType('DOCTOR')}
              activeOpacity={0.7}
            >
              <Ionicons name="medkit" size={16} color={isDoctor ? '#059669' : textSub} />
              <Text style={[styles.roleSelectBtnText, { color: isDoctor ? '#059669' : textSub, fontWeight: isDoctor ? '700' : '500' }]}>
                Bác sĩ gia đình
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.inviteRoleBadgeContainer,
              { backgroundColor: isDoctor ? (isDarkMode ? '#064E3B' : '#ECFDF5') : (isDarkMode ? '#1E293B' : '#EFF6FF') },
            ]}
          >
            <Text style={[styles.inviteRoleBadgeText, { color: isDoctor ? '#059669' : '#2563EB' }]}>
              {isDoctor ? '🩺 Vai trò: Bác sĩ gia đình' : '👤 Vai trò: Thành viên gia đình'}
            </Text>
          </View>
          <Text style={[styles.modalSub, { color: textSub, marginTop: 4 }]}>
            {isDoctor
              ? 'Nhập số điện thoại của Bác sĩ. Bác sĩ cần xác nhận đồng ý trên ứng dụng mới được vào nhà.'
              : 'Nhập số điện thoại để mời tài khoản vào căn nhà.'}
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
            placeholder={isDoctor ? 'Nhập số điện thoại Bác sĩ (ví dụ: 0912 345 678)' : 'Nhập số điện thoại (ví dụ: 0912 345 678)'}
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
          />

          {/* Thông báo quyền hạn và quy trình phê duyệt */}
          <View
            style={[
              styles.memberNoticeBox,
              {
                backgroundColor: isDoctor
                  ? (isDarkMode ? '#064E3B22' : '#F0FDF4')
                  : (isDarkMode ? '#1E293B' : '#F0FDF4'),
                borderColor: isDoctor
                  ? (isDarkMode ? '#059669' : '#BBF7D0')
                  : (isDarkMode ? '#334155' : '#BBF7D0'),
              },
            ]}
          >
            <Ionicons
              name={isDoctor ? 'medkit' : 'information-circle'}
              size={20}
              color={isDoctor ? '#059669' : '#16A34A'}
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <Text style={[styles.memberNoticeText, { color: isDoctor ? (isDarkMode ? '#6EE7B7' : '#065F46') : (isDarkMode ? '#86EFAC' : '#15803D') }]}>
              {isDoctor
                ? 'Bác sĩ sau khi được mời sẽ nhận thông báo xác nhận. Chỉ khi Bác sĩ đồng ý, họ mới chính thức vào nhà và được phép theo dõi hồ sơ bệnh án người cao tuổi.'
                : 'Thành viên sau khi được mời sẽ nhận thông báo xác nhận. Chỉ khi thành viên đồng ý, họ mới chính thức vào nhà để xem camera và nhận cảnh báo khẩn cấp.'}
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
              style={[styles.saveBtn, isDoctor && { backgroundColor: '#10B981' }, isAddingMember && { opacity: 0.7 }]}
              onPress={onAddMember}
              disabled={isAddingMember}
              activeOpacity={0.8}
            >
              {isAddingMember ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{isDoctor ? 'Mời Bác sĩ gia đình' : 'Thêm thành viên'}</Text>
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
  roleSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  roleSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  roleSelectBtnActiveMember: {
    borderColor: '#3B82F6',
  },
  roleSelectBtnActiveDoctor: {
    borderColor: '#10B981',
  },
  roleSelectBtnText: {
    fontSize: 12.5,
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
  modalToastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  modalToastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    maxWidth: '92%',
  },
  modalToastCardError: {
    backgroundColor: '#DC2626',
  },
  modalToastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
});


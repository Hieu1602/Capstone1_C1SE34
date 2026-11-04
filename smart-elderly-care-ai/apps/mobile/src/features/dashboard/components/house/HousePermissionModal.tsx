import { maskPhoneNumber } from '../../../auth/utils/phoneValidation';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HousePermissionModalProps {
  visible: boolean;
  member: any;
  isConfirmingDelete: boolean;
  setIsConfirmingDelete: (val: boolean) => void;
  isDeletingMember: boolean;
  isSavingPermissions: boolean;
  editRoleInHouse: string;
  setEditRoleInHouse: (role: string) => void;
  editCanViewHealth: boolean;
  setEditCanViewHealth: (val: boolean) => void;
  editCanViewCamera: boolean;
  setEditCanViewCamera: (val: boolean) => void;
  editCanHandleEmergency: boolean;
  setEditCanHandleEmergency: (val: boolean) => void;
  editCanManageDevices: boolean;
  setEditCanManageDevices: (val: boolean) => void;
  editCanManageRecords: boolean;
  setEditCanManageRecords: (val: boolean) => void;
  onExecuteDelete: (member: any) => void;
  onRemoveMember: (member: any) => void;
  onSavePermissions: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  colors: {
    bgCard: string;
    borderCol: string;
    textTitle: string;
    textSub: string;
  };
}

export const HousePermissionModal: React.FC<HousePermissionModalProps> = ({
  visible,
  member,
  isConfirmingDelete,
  setIsConfirmingDelete,
  isDeletingMember,
  isSavingPermissions,
  editRoleInHouse,
  setEditRoleInHouse,
  editCanViewHealth,
  setEditCanViewHealth,
  editCanViewCamera,
  setEditCanViewCamera,
  editCanHandleEmergency,
  setEditCanHandleEmergency,
  editCanManageDevices,
  setEditCanManageDevices,
  editCanManageRecords,
  setEditCanManageRecords,
  onExecuteDelete,
  onRemoveMember,
  onSavePermissions,
  onClose,
  isDarkMode,
  colors: { bgCard, borderCol, textTitle, textSub },
}) => {
  const isOwner = Boolean(member?.is_owner || member?.role_in_house === 'OWNER');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
          {/* Modal Header */}
          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={[styles.modalTitle, { color: textTitle }]}>
                {isOwner ? 'Thông tin chủ hộ' : 'Xác nhận xóa thành viên'}
              </Text>
              <Text style={[styles.modalSub, { color: textSub }]}>
                {member?.full_name} ({maskPhoneNumber(member?.phone_number, '--')})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setIsConfirmingDelete(false);
                onClose();
              }}
              style={styles.modalCloseBtn}
              disabled={isDeletingMember}
            >
              <Ionicons name="close" size={22} color={textSub} />
            </TouchableOpacity>
          </View>

          {isOwner ? (
            /* Trường hợp là Chủ sở hữu */
            <View style={styles.ownerNoticeBox}>
              <Ionicons name="ribbon" size={28} color="#F59E0B" />
              <Text style={styles.ownerNoticeTitle}>Chủ sở hữu hệ thống (Owner)</Text>
              <Text style={styles.ownerNoticeText}>
                Tài khoản này là Chủ nhà, sở hữu toàn quyền quản trị căn nhà và thành viên. Không thể xóa Chủ hộ.
              </Text>
            </View>
          ) : (
            /* GIAO DIỆN XÁC NHẬN XÓA THÀNH VIÊN */
            <View style={styles.confirmDeleteContent}>
              <View style={styles.confirmDeleteIconCircle}>
                <Ionicons name="trash-outline" size={36} color="#EF4444" />
              </View>
              <Text style={[styles.confirmDeleteHeading, { color: textTitle }]}>
                Bạn có chắc muốn xóa thành viên này?
              </Text>
              <Text style={[styles.confirmDeleteDescription, { color: textSub }]}>
                Tài khoản <Text style={{ fontWeight: '700', color: textTitle }}>{member?.full_name}</Text> ({maskPhoneNumber(member?.phone_number, '--')}) sẽ bị xóa khỏi căn nhà và mất quyền truy cập dữ liệu căn nhà này.
              </Text>

              <View style={styles.confirmActionButtons}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol },
                  ]}
                  onPress={onClose}
                  disabled={isDeletingMember}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy bỏ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmExecuteDeleteBtn, isDeletingMember && { opacity: 0.7 }]}
                  onPress={() => onExecuteDelete(member)}
                  disabled={isDeletingMember}
                  activeOpacity={0.8}
                >
                  {isDeletingMember ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="trash" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmExecuteDeleteBtnText}>Xóa thành viên</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    marginTop: 2,
  },
  permSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  roleOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  roleOptionActive: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  roleOptionTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  permSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  permSwitchTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  permSwitchDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingTop: 10,
  },
  removeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FEF2F2',
  },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
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
  ownerNoticeBox: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginVertical: 10,
  },
  ownerNoticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 10,
    marginBottom: 6,
  },
  ownerNoticeText: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmDeleteContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  confirmDeleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmDeleteHeading: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmDeleteDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  confirmActionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmExecuteDeleteBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
  },
  confirmExecuteDeleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});


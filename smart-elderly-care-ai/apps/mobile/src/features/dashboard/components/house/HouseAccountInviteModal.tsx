import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
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
              { backgroundColor: selectedInviteRole === 'ADMIN' ? '#FEF3C7' : '#EFF6FF' },
            ]}
          >
            <Text
              style={[
                styles.inviteRoleBadgeText,
                { color: selectedInviteRole === 'ADMIN' ? '#B45309' : '#2563EB' },
              ]}
            >
              Vai trò: {selectedInviteRole === 'ADMIN' ? '👑 Quản trị viên' : '👤 Thành viên'}
            </Text>
          </View>
          <Text style={[styles.modalSub, { color: textSub, marginTop: 4 }]}>
            Nhập số điện thoại để liên kết tài khoản vào nhà và phân quyền truy cập.
          </Text>

          <TextInput
            style={[
              styles.addressInput,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: borderCol,
                color: textTitle,
              },
            ]}
            value={newMemberName}
            onChangeText={setNewMemberName}
            placeholder="Họ và tên người thân (ví dụ: Anh Ba, Con gái...)"
            placeholderTextColor="#94A3B8"
          />

          <TextInput
            style={[
              styles.addressInput,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: borderCol,
                color: textTitle,
                marginTop: 10,
              },
            ]}
            value={newMemberPhone}
            onChangeText={setNewMemberPhone}
            placeholder="Nhập số điện thoại (ví dụ: 0912 345 678)"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
          />

          {/* Chi tiết quyền hạn */}
          {selectedInviteRole === 'ADMIN' ? (
            <View style={[styles.adminNoticeBox, { backgroundColor: isDarkMode ? '#1E293B' : '#FEF3C7' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#D97706" />
              <Text style={styles.adminNoticeText}>
                Quản trị viên được trao toàn quyền quản lý thiết bị, cấu hình thuật toán và giám sát người thân.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <View style={[styles.permCheckRow, { borderColor: borderCol }]}>
                <Text style={[styles.permCheckLabel, { color: textTitle }]}>👁️ Xem camera an ninh AI</Text>
                <Switch
                  value={newCanViewCamera}
                  onValueChange={setNewCanViewCamera}
                  trackColor={{ false: '#94A3B8', true: '#A7F3D0' }}
                  thumbColor={newCanViewCamera ? '#059669' : '#F1F5F9'}
                />
              </View>

              <View style={[styles.permCheckRow, { borderColor: borderCol }]}>
                <Text style={[styles.permCheckLabel, { color: textTitle }]}>🩺 Theo dõi nhịp tim & SpO2</Text>
                <Switch
                  value={newCanViewHealth}
                  onValueChange={setNewCanViewHealth}
                  trackColor={{ false: '#94A3B8', true: '#BFDBFE' }}
                  thumbColor={newCanViewHealth ? '#2563EB' : '#F1F5F9'}
                />
              </View>

              <View style={[styles.permCheckRow, { borderColor: borderCol }]}>
                <Text style={[styles.permCheckLabel, { color: textTitle }]}>⚙️ Cấu hình thiết bị & Tham số AI</Text>
                <Switch
                  value={newCanManageDevices}
                  onValueChange={setNewCanManageDevices}
                  trackColor={{ false: '#94A3B8', true: '#FED7AA' }}
                  thumbColor={newCanManageDevices ? '#F97316' : '#F1F5F9'}
                />
              </View>

              <View style={[styles.permCheckRow, { borderColor: borderCol }]}>
                <Text style={[styles.permCheckLabel, { color: textTitle }]}>💊 Quản lý Lịch thuốc & Bệnh án</Text>
                <Switch
                  value={newCanManageRecords}
                  onValueChange={setNewCanManageRecords}
                  trackColor={{ false: '#94A3B8', true: '#DDD6FE' }}
                  thumbColor={newCanManageRecords ? '#7C3AED' : '#F1F5F9'}
                />
              </View>
            </View>
          )}

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
            <TouchableOpacity style={styles.saveBtn} onPress={onAddMember}>
              <Text style={styles.saveBtnText}>Gửi lời mời & Cấp quyền</Text>
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
});


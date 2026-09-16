// HouseDetailScreen.tsx
// Màn hình Quản lý Nhà & Phân quyền khớp chính xác Hình 3 (House Detail & Member Management)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity, 
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

export default function HouseDetailScreen({ navigation }: any) {
  const { house } = useVitalStore();
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'CAREGIVER' | 'DOCTOR'>('CAREGIVER');


  const handleAddMember = () => {
    if (!newMemberPhone.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại người thân hoặc bác sĩ.');
      return;
    }
    setAddMemberModalVisible(false);
    setNewMemberPhone('');
    Alert.alert(
      'Đã gửi lời mời',
      `Đã gửi liên kết tham gia giám sát đến số điện thoại ${newMemberPhone} với vai trò ${
        newMemberRole === 'DOCTOR' ? 'Bác sĩ gia đình' : 'Người chăm sóc'
      }. (FR01 RBAC)`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header: Back Arrow, Title "Nhà của tôi" */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitleText}>Nhà của tôi</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Section: Thành viên */}
        <Text style={styles.sectionLabel}>Thành viên</Text>
        <View style={styles.cardContainer}>
          {/* Member Row: 1057(Me) - Người sở hữu */}
          <TouchableOpacity
            style={styles.memberRow}
            onPress={() => Alert.alert('Thông tin thành viên', 'Tài khoản: 1057(Me)\nVai trò: Người sở hữu (Primary Caregiver)\nQuyền hạn: Toàn quyền cấu hình AI và còi báo động.')}
            activeOpacity={0.7}
          >
            <View style={styles.memberAvatarCircle}>
              <Ionicons name="person" size={24} color="#CBD5E1" />
            </View>
            <Text style={styles.memberNameText}>1057(Me)</Text>
            <Text style={styles.ownerBadgeText}>Người sở hữu</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Add Member Button: + Thêm người */}
          <TouchableOpacity
            style={styles.addMemberRow}
            onPress={() => setAddMemberModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.orangePlusCircle}>
              <Ionicons name="add" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.addMemberText}>Thêm người</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Section: Quản lý Nhà */}
        <Text style={styles.sectionLabel}>Quản lý Nhà</Text>
        <View style={styles.cardContainer}>
          {/* Quản lý nhóm (Rooms) */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('Quản lý nhóm phòng', 'Hiện có 3 khu vực giám sát:\n- Phòng khách (Camera Ranger 2C + Cảm biến nhiệt)\n- Phòng ngủ (Cảm biến nhiệt AMG8833)\n- Nhà vệ sinh (Cảm biến âm thanh YAMNet & Còi hú)')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowTitleText}>Quản lý nhóm</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Thêm người (Phân quyền RBAC FR01) */}
      <Modal visible={addMemberModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thêm người chăm sóc / Bác sĩ</Text>
            <Text style={styles.modalSub}>
              Mời người thân hoặc bác sĩ gia đình cùng theo dõi sinh hiệu và nhận thông báo khẩn cấp bằng số điện thoại (FR01).
            </Text>
              <TextInput
              style={styles.addressInput}
                value={newMemberPhone}
                onChangeText={setNewMemberPhone}
                placeholder="Nhập số điện thoại (ví dụ: 0912 345 678)"
                keyboardType="phone-pad"
            />
            <View style={styles.rolePickerRow}>
              <TouchableOpacity
                style={[
                  styles.roleOptionBtn,
                  newMemberRole === 'CAREGIVER' && styles.roleOptionActive,
                ]}
                onPress={() => setNewMemberRole('CAREGIVER')}
              >
                <Text style={[styles.roleOptionText, newMemberRole === 'CAREGIVER' && styles.roleOptionTextActive]}>
                  Người chăm sóc
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleOptionBtn,
                  newMemberRole === 'DOCTOR' && styles.roleOptionActive,
                ]}
                onPress={() => setNewMemberRole('DOCTOR')}
              >
                <Text style={[styles.roleOptionText, newMemberRole === 'DOCTOR' && styles.roleOptionTextActive]}>
                  Bác sĩ gia đình
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddMemberModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddMember}
              >
                <Text style={styles.saveBtnText}>Gửi lời mời</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitleText: {
    fontSize: 27,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 10,
    marginBottom: 10,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  memberAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginRight: 10,
  },
  ownerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  orangePlusCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  addMemberText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusSettingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  currentAddressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currentAddressText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    ...Shadows.card,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  addressInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 54,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
  },
  currentLocationButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  roleOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});

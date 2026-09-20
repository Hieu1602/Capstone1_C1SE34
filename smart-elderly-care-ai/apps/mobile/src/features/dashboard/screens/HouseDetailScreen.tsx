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
import { useTheme } from '../../../store/useThemeStore';

export default function HouseDetailScreen({ navigation }: any) {
  const { house } = useVitalStore();
  const { isDarkMode } = useTheme();
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
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0B0F19' }]} edges={['top']}>
      {/* 1. Header: Back Arrow, Title "Nhà của tôi" */}
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: '#0B0F19' }]}>
        <TouchableOpacity
          style={[styles.backBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#F8FAFC' : Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitleText, isDarkMode && { color: '#F8FAFC' }]}>Nhà của tôi</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. Section: Thành viên */}
        <Text style={[styles.sectionLabel, isDarkMode && { color: '#94A3B8' }]}>Thành viên</Text>
        <View style={[styles.cardContainer, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
          {/* Member Row: 1057(Me) - Người sở hữu */}
          <TouchableOpacity
            style={styles.memberRow}
            onPress={() => Alert.alert('Thông tin thành viên', 'Tài khoản: 1057(Me)\nVai trò: Người sở hữu (Primary Caregiver)\nQuyền hạn: Toàn quyền cấu hình AI và còi báo động.')}
            activeOpacity={0.7}
          >
            <View style={[styles.memberAvatarCircle, isDarkMode && { backgroundColor: '#0F172A' }]}>
              <Ionicons name="person" size={24} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
            </View>
            <Text style={[styles.memberNameText, isDarkMode && { color: '#F8FAFC' }]}>1057(Me)</Text>
            <Text style={styles.ownerBadgeText}>Người sở hữu</Text>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
          </TouchableOpacity>

          <View style={[styles.divider, isDarkMode && { backgroundColor: '#334155' }]} />

          {/* Add Member Button: + Thêm người */}
          <TouchableOpacity
            style={styles.addMemberRow}
            onPress={() => setAddMemberModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.orangePlusCircle, isDarkMode && { backgroundColor: '#4A2810', borderColor: '#7C2D12' }]}>
              <Ionicons name="add" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.addMemberText}>Thêm người</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Section: Quản lý Nhà */}
        <Text style={[styles.sectionLabel, isDarkMode && { color: '#94A3B8' }]}>Quản lý Nhà</Text>
        <View style={[styles.cardContainer, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
          {/* Quản lý nhóm (Rooms) */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('Quản lý nhóm phòng', 'Hiện có 3 khu vực giám sát:\n- Phòng khách (Camera Ranger 2C + Cảm biến nhiệt)\n- Phòng ngủ (Cảm biến nhiệt AMG8833)\n- Nhà vệ sinh (Cảm biến âm thanh YAMNet & Còi hú)')}
            activeOpacity={0.7}
          >
            <Text style={[styles.rowTitleText, isDarkMode && { color: '#F8FAFC' }]}>Quản lý nhóm</Text>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Thêm người (Phân quyền RBAC FR01) */}
      <Modal visible={addMemberModalVisible} transparent animationType="slide">
        <View style={[styles.modalOverlay, isDarkMode && { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={[styles.modalCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#F8FAFC' }]}>Thêm người chăm sóc / Bác sĩ</Text>
            <Text style={[styles.modalSub, isDarkMode && { color: '#94A3B8' }]}>
              Mời người thân hoặc bác sĩ gia đình cùng theo dõi sức khoẻ và nhận thông báo khẩn cấp bằng số điện thoại (FR01).
            </Text>
              <TextInput
              style={[styles.addressInput, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
                value={newMemberPhone}
                onChangeText={setNewMemberPhone}
                placeholder="Nhập số điện thoại (ví dụ: 0912 345 678)"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
            />
            <View style={styles.rolePickerRow}>
              <TouchableOpacity
                style={[
                  styles.roleOptionBtn,
                  isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                  newMemberRole === 'CAREGIVER' && styles.roleOptionActive,
                ]}
                onPress={() => setNewMemberRole('CAREGIVER')}
              >
                <Text style={[styles.roleOptionText, isDarkMode && { color: '#CBD5E1' }, newMemberRole === 'CAREGIVER' && styles.roleOptionTextActive]}>
                  Người chăm sóc
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleOptionBtn,
                  isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                  newMemberRole === 'DOCTOR' && styles.roleOptionActive,
                ]}
                onPress={() => setNewMemberRole('DOCTOR')}
              >
                <Text style={[styles.roleOptionText, isDarkMode && { color: '#CBD5E1' }, newMemberRole === 'DOCTOR' && styles.roleOptionTextActive]}>
                  Bác sĩ gia đình
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1 }]}
                onPress={() => setAddMemberModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, isDarkMode && { color: '#94A3B8' }]}>Hủy</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  modalSub: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 16,
  },
  addressInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#D7DEE7',
    minHeight: 52,
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
    marginTop: 16,
  },
  roleOptionBtn: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F59E0B',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  roleOptionTextActive: {
    color: '#F97316',
    fontWeight: '800',
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

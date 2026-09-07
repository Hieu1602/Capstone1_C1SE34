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
  const { house, updateHouseAddress } = useVitalStore();
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressInput, setAddressInput] = useState(house.address);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'CAREGIVER' | 'DOCTOR'>('CAREGIVER');

  const handleSaveAddress = () => {
    updateHouseAddress(addressInput);
    setAddressModalVisible(false);
    Alert.alert('Thành công', 'Đã cập nhật vị trí nhà người cao tuổi. Địa chỉ này sẽ được tự động sao chép khi kích hoạt SOS 115.');
  };

  const handleAddMember = () => {
    if (!newMemberEmail) {
      Alert.alert('Lỗi', 'Vui lòng nhập email người thân hoặc bác sĩ.');
      return;
    }
    setAddMemberModalVisible(false);
    setNewMemberEmail('');
    Alert.alert(
      'Đã gửi lời mời',
      `Đã gửi liên kết tham gia giám sát đến ${newMemberEmail} với vai trò ${
        newMemberRole === 'DOCTOR' ? 'Bác sĩ gia đình' : 'Người chăm sóc'
      }. (FR01 RBAC)`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header: Back Arrow, Title "Nhà của tôi", Edit Pencil in Orange */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.titleWithIcon}>
          <Text style={styles.headerTitleText}>{house.name}</Text>
          <TouchableOpacity
            style={styles.pencilBtn}
            onPress={() => Alert.alert('Đổi tên nhà', 'Nhập tên mới cho ngôi nhà của bạn.')}
          >
            <Ionicons name="pencil" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
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
          {/* Vị trí */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setAddressModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.rowTitleText}>Vị trí</Text>
            <View style={styles.rowRightInfo}>
              <Text style={styles.statusSettingText} numberOfLines={1}>
                {house.address ? 'Cài Đặt' : 'Chưa đặt'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </View>
          </TouchableOpacity>

          {/* Hiển thị địa chỉ chi tiết dưới hàng vị trí nếu có */}
          {house.address ? (
            <View style={styles.currentAddressBox}>
              <Ionicons name="location-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.currentAddressText} numberOfLines={2}>
                {house.address}
              </Text>
            </View>
          ) : null}

          <View style={styles.divider} />

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

        {/* 4. Section: Chế độ tại nhà */}
        <Text style={styles.sectionLabel}>Chế độ tại nhà</Text>
        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('Cài đặt Chế độ Tại nhà', '1. Tự động bật vùng cấm ngã từ 22:00 đến 06:00.\n2. Cảnh báo rung & còi âm lượng tối đa ghi đè chế độ im lặng khi nhịp tim < 50 bpm hoặc > 120 bpm (FR07).\n3. Nhắc nhở giọng nói tiếng Việt nếu rời khỏi giường mà không đeo vòng (FR12).')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowTitleText}>Cài đặt Chế độ Tại nhà</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Cài đặt Vị trí */}
      <Modal visible={addressModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cài đặt vị trí nhà</Text>
            <Text style={styles.modalSub}>
              Địa chỉ này sẽ được tự động sao chép vào clipboard khi bạn nhấn nút SOS 115 cấp cứu để báo ngay vị trí cho y bác sĩ.
            </Text>
            <TextInput
              style={styles.addressInput}
              value={addressInput}
              onChangeText={setAddressInput}
              placeholder="Nhập địa chỉ nhà người cao tuổi..."
              multiline
            />
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddressModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveAddress}
              >
                <Text style={styles.saveBtnText}>Lưu vị trí</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Thêm người (Phân quyền RBAC FR01) */}
      <Modal visible={addMemberModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thêm người chăm sóc / Bác sĩ</Text>
            <Text style={styles.modalSub}>
              Mời người thân hoặc bác sĩ gia đình cùng theo dõi sinh hiệu và nhận thông báo khẩn cấp (FR01).
            </Text>
            <TextInput
              style={styles.addressInput}
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
              placeholder="Nhập email (ví dụ: doctor@clinic.vn)"
              keyboardType="email-address"
              autoCapitalize="none"
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
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  pencilBtn: {
    marginLeft: 8,
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 18,
    marginBottom: 8,
  },
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    ...Shadows.card,
  },
  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  memberAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberNameText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  ownerBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
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

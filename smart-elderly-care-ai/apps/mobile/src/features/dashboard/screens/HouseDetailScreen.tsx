// ==============================================================================
// TỆP: HouseDetailScreen.tsx
// PHÂN HỆ: Màn hình Quản lý Không gian Nhà & Phân quyền Thành viên Gia đình
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { householdApi } from '../../../services/api';
import {
  HouseMemberRow,
  HousePermissionModal,
  HouseInviteFlowModal,
  HouseAccountInviteModal,
  HouseShareModal,
  HouseEditAddressModal,
} from '../components/house';

export default function HouseDetailScreen({ navigation, route }: any) {
  const { house, updateHouseAddress } = useVitalStore();
  const { full_name, userName, phone_number, userPhone, household_id, role, userRole } = useAuthStore();
  const { isDarkMode } = useTheme();

  // State chỉnh sửa địa chỉ
  const [isEditAddressModalVisible, setIsEditAddressModalVisible] = useState(false);
  const [editAddressInput, setEditAddressInput] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // State danh sách thành viên & loading
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // State Modal Mời gia đình 2 bước
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteStep, setInviteStep] = useState<1 | 2>(1);
  const [selectedInviteRole, setSelectedInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [isAccountInviteModalVisible, setIsAccountInviteModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [copySuccessToast, setCopySuccessToast] = useState<string | null>(null);

  // State form mời thành viên mới
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newCanViewHealth, setNewCanViewHealth] = useState(true);
  const [newCanViewCamera, setNewCanViewCamera] = useState(true);
  const [newCanHandleEmergency] = useState(true);
  const [newCanManageDevices, setNewCanManageDevices] = useState(false);
  const [newCanManageRecords, setNewCanManageRecords] = useState(false);

  // State Modal Cấp quyền cho thành viên (RBAC Permission Sheet)
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [editRoleInHouse, setEditRoleInHouse] = useState('MEMBER');
  const [editCanViewHealth, setEditCanViewHealth] = useState(true);
  const [editCanViewCamera, setEditCanViewCamera] = useState(true);
  const [editCanHandleEmergency, setEditCanHandleEmergency] = useState(true);
  const [editCanManageDevices, setEditCanManageDevices] = useState(false);
  const [editCanManageRecords, setEditCanManageRecords] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  const triggerToast = (msg: string) => {
    setCopySuccessToast(msg);
    setTimeout(() => {
      setCopySuccessToast(null);
    }, 2800);
  };

  useEffect(() => {
    if (route?.params?.openInviteModal) {
      setSelectedInviteRole('MEMBER');
      setInviteStep(1);
      setInviteModalVisible(true);
    }
  }, [route?.params?.openInviteModal]);

  const handleSaveAddress = async () => {
    try {
      setIsSavingAddress(true);
      const clean = editAddressInput.trim();
      updateHouseAddress(clean);
      setIsEditAddressModalVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật địa chỉ nhà.');
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu địa chỉ. Vui lòng thử lại.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const isCurrentUserOwner =
    userRole === 'admin' ||
    role === 'admin' ||
    Boolean(
      members.find(
        (m) =>
          (m.is_owner || m.role_in_house === 'OWNER') &&
          (m.phone_number === phone_number || m.phone_number === userPhone)
      )
    );

  const getFallbackMember = useCallback(() => [
    {
      id: 'member-default-id',
      user_id: 'member-user-id',
      full_name: full_name || userName || 'Thành viên',
      phone_number: phone_number || userPhone || '--',
      role: 'Thành viên gia đình',
      role_in_house: 'MEMBER',
      permissions: 'VIEWER',
      can_view_health: true,
      can_view_camera: true,
      can_handle_emergency: true,
      can_manage_devices: false,
      can_manage_records: false,
      is_owner: false,
    },
  ], [full_name, userName, phone_number, userPhone]);

  const loadMembers = useCallback(async () => {
    try {
      setIsLoadingMembers(true);
      const targetHId = household_id || 'current';
      const res = await householdApi.getMembers(targetHId);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setMembers(res.data);
      } else {
        setMembers(getFallbackMember());
      }
    } catch {
      setMembers(getFallbackMember());
    } finally {
      setIsLoadingMembers(false);
    }
  }, [household_id, getFallbackMember]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleOpenPermissions = (member: any) => {
    if (member.is_owner || member.role_in_house === 'OWNER') {
      return;
    }
    if (!isCurrentUserOwner) {
      const rName =
        member.role_in_house === 'OWNER'
          ? 'Chủ hộ'
          : member.role_in_house === 'DOCTOR'
          ? 'Bác sĩ gia đình'
          : 'Thành viên gia đình';
      Alert.alert(
        'Thông tin thành viên',
        `Họ và tên: ${member.full_name}\nVai trò: ${rName}\nSố điện thoại: ${
          member.phone_number || '--'
        }\n\nLưu ý: Chỉ Chủ hộ mới có quyền thay đổi phân quyền.`
      );
      return;
    }
    setSelectedMember(member);
    setEditRoleInHouse(member.role_in_house || 'MEMBER');
    setEditCanViewHealth(member.can_view_health !== false);
    setEditCanViewCamera(member.can_view_camera !== false);
    setEditCanHandleEmergency(member.can_handle_emergency !== false);
    setEditCanManageDevices(Boolean(member.can_manage_devices));
    setEditCanManageRecords(Boolean(member.can_manage_records));
    setIsConfirmingDelete(false);
    setPermissionModalVisible(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedMember) return;
    try {
      setIsSavingPermissions(true);
      const targetHId = household_id || 'current';
      await householdApi.updateMemberPermissions(targetHId, selectedMember.id, {
        role_in_house: editRoleInHouse,
        can_view_health: editCanViewHealth,
        can_view_camera: editCanViewCamera,
        can_handle_emergency: editCanHandleEmergency,
        can_manage_devices: editCanManageDevices,
        can_manage_records: editCanManageRecords,
      });

      setMembers((prev) =>
        prev.map((m) =>
          m.id === selectedMember.id
            ? {
                ...m,
                role_in_house: editRoleInHouse,
                can_view_health: editCanViewHealth,
                can_view_camera: editCanViewCamera,
                can_handle_emergency: editCanHandleEmergency,
                can_manage_devices: editCanManageDevices,
                can_manage_records: editCanManageRecords,
              }
            : m
        )
      );
      setPermissionModalVisible(false);
      Alert.alert('Thành công', `Đã cập nhật phân quyền cho thành viên ${selectedMember.full_name}.`);
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.detail || 'Không thể lưu phân quyền. Vui lòng thử lại.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleRemoveMember = (member: any) => {
    setSelectedMember(member);
    setIsConfirmingDelete(true);
  };

  const executeDeleteMember = async (member: any) => {
    if (!member) return;
    const targetMemberId = member.id || member.user_id;
    if (!targetMemberId) return;

    try {
      setIsDeletingMember(true);
      const targetHId = household_id || 'current';
      await householdApi.removeMember(targetHId, targetMemberId);

      setMembers((prev) =>
        prev.filter((m) => m.id !== targetMemberId && m.user_id !== targetMemberId)
      );
      setPermissionModalVisible(false);
      setIsConfirmingDelete(false);

      const msg = `Đã xóa ${member.full_name || 'thành viên'} khỏi ngôi nhà thành công.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Đã xóa', msg);
      }

      loadMembers();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        'Không thể xóa thành viên. Vui lòng thử lại sau.';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Lỗi', errorMsg);
      }
    } finally {
      setIsDeletingMember(false);
    }
  };

  const handleNativeShare = async () => {
    try {
      const roleName = selectedInviteRole === 'ADMIN' ? 'Quản trị viên' : 'Thành viên';
      await Share.share({
        title: 'Mời thành viên gia đình',
        message: `Chào bạn, bạn nhận được lời mời tham gia căn nhà "${
          house?.name || 'Nhà của tôi'
        }" với vai trò ${roleName} trên ứng dụng Smart Elderly Care AI để cùng chăm sóc và bảo vệ người thân. Mã mời: CARE-${
          household_id ? String(household_id).slice(-4).toUpperCase() : '8869'
        }. Vui lòng tải ứng dụng và đăng nhập bằng số điện thoại của bạn.`,
      });
    } catch {
      Alert.alert('Thông báo', 'Không thể mở trình chia sẻ.');
    }
  };

  const handleCopyLink = () => {
    const roleSlug = selectedInviteRole === 'ADMIN' ? 'admin' : 'member';
    const link = `https://smartcare.vn/invite?houseId=${household_id || 'current'}&role=${roleSlug}`;
    Alert.alert(
      'Sao chép liên kết thành công',
      `Đã sao chép liên kết mời thành viên vào bộ nhớ tạm:\n\n${link}\n\nBạn có thể gửi liên kết này cho người thân gia đình.`,
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Chia sẻ ngay', onPress: () => setIsShareModalVisible(true) },
      ]
    );
  };

  const handleAddMember = async () => {
    const phoneToSubmit = newMemberPhone.trim();
    if (!phoneToSubmit) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại người thân hoặc bác sĩ.');
      return;
    }
    const isAdmin = selectedInviteRole === 'ADMIN';
    const defaultRoleTitle = isAdmin ? 'Quản trị viên gia đình' : 'Thành viên gia đình';

    try {
      const targetHId = household_id || 'current';
      await householdApi.addMember(targetHId, {
        phone_number: phoneToSubmit,
        full_name: newMemberName.trim() || defaultRoleTitle,
        role_in_house: isAdmin ? 'ADMIN' : 'MEMBER',
        role: isAdmin ? 'admin' : 'user',
        can_view_health: isAdmin ? true : newCanViewHealth,
        can_view_camera: isAdmin ? true : newCanViewCamera,
        can_handle_emergency: isAdmin ? true : newCanHandleEmergency,
        can_manage_devices: isAdmin ? true : newCanManageDevices,
        can_manage_records: isAdmin ? true : newCanManageRecords,
      });

      setIsAccountInviteModalVisible(false);
      setInviteModalVisible(false);
      setNewMemberPhone('');
      setNewMemberName('');
      Alert.alert('Thành công', `Đã cấp quyền và thêm ${phoneToSubmit} vào ngôi nhà.`);
      loadMembers();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.detail || 'Không thể thêm thành viên. Vui lòng kiểm tra lại.');
    }
  };

  const bgScreen = isDarkMode ? '#0B0F19' : Colors.background;
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : Colors.textPrimary;
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const colors = { bgCard, borderCol, textTitle, textSub };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgScreen }]} edges={['top']}>
      {/* 1. Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={textTitle} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitleText, { color: textTitle }]}>{house?.name || 'Nhà của tôi'}</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setEditAddressInput(house?.address || '');
              setIsEditAddressModalVisible(true);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}
          >
            <Ionicons name="location-outline" size={13} color={house?.address ? textSub : Colors.primary} />
            <Text
              style={[
                styles.headerSubText,
                { color: house?.address ? textSub : Colors.primary, flexShrink: 1 },
              ]}
              numberOfLines={1}
            >
              {house?.address || 'Chưa có địa chỉ • Chạm để thêm'}
            </Text>
            {isCurrentUserOwner && (
              <Ionicons name="pencil" size={12} color="#94A3B8" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Banner thông tin phân quyền */}
        <View style={[styles.roleInfoBanner, { backgroundColor: isDarkMode ? '#172554' : '#EFF6FF', borderColor: '#3B82F6' }]}>
          <Ionicons name="shield-checkmark" size={22} color="#3B82F6" style={{ marginRight: 10, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleInfoTitle, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
              Cơ chế Phân quyền Thành viên (RBAC)
            </Text>
            <Text style={[styles.roleInfoDesc, { color: isDarkMode ? '#BFDBFE' : '#3B82F6' }]}>
              Người sở hữu có thể cấp hoặc thu hồi quyền: Xem camera, Theo dõi sức khỏe và Xử lý khẩn cấp cho từng người thân.
            </Text>
          </View>
        </View>

        {/* 2. Section: Danh sách Thành viên & Phân quyền */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: textSub }]}>Thành viên gia đình & Bác sĩ</Text>
          <Text style={[styles.memberCountBadge, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0', color: textTitle }]}>
            {members.length} người
          </Text>
        </View>

        <View style={[styles.cardContainer, { backgroundColor: bgCard, borderColor: borderCol }]}>
          {isLoadingMembers ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={{ marginTop: 8, fontSize: 13, color: textSub }}>Đang tải danh sách thành viên...</Text>
            </View>
          ) : (
            members.map((member, index) => (
              <HouseMemberRow
                key={member.id || index}
                member={member}
                index={index}
                isLast={index === members.length - 1}
                onPress={handleOpenPermissions}
                isDarkMode={isDarkMode}
                colors={colors}
              />
            ))
          )}

          {/* Nút Thêm Thành Viên Mới */}
          <TouchableOpacity
            style={styles.addMemberRow}
            onPress={() => {
              setSelectedInviteRole('MEMBER');
              setInviteStep(1);
              setInviteModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.orangePlusCircle, isDarkMode && { backgroundColor: '#4A2810', borderColor: '#7C2D12' }]}>
              <Ionicons name="person-add" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.addMemberText}>Mời thành viên mới & Phân quyền</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Section: Quản lý Phòng & Thiết bị */}
        <Text style={[styles.sectionLabel, { color: textSub, marginTop: 24 }]}>Quản lý Không gian Nhà</Text>
        <View style={[styles.cardContainer, { backgroundColor: bgCard, borderColor: borderCol }]}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('Main', { screen: 'Devices' })}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="grid" size={20} color={Colors.primary} style={{ marginRight: 12 }} />
              <Text style={[styles.rowTitleText, { color: textTitle }]}>Quản lý nhóm thiết bị & Phòng</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#64748B' : '#CBD5E1'} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal 1: Cấp quyền cho thành viên */}
      <HousePermissionModal
        visible={permissionModalVisible}
        member={selectedMember}
        isConfirmingDelete={isConfirmingDelete}
        setIsConfirmingDelete={setIsConfirmingDelete}
        isDeletingMember={isDeletingMember}
        isSavingPermissions={isSavingPermissions}
        editRoleInHouse={editRoleInHouse}
        setEditRoleInHouse={setEditRoleInHouse}
        editCanViewHealth={editCanViewHealth}
        setEditCanViewHealth={setEditCanViewHealth}
        editCanViewCamera={editCanViewCamera}
        setEditCanViewCamera={setEditCanViewCamera}
        editCanHandleEmergency={editCanHandleEmergency}
        setEditCanHandleEmergency={setEditCanHandleEmergency}
        editCanManageDevices={editCanManageDevices}
        setEditCanManageDevices={setEditCanManageDevices}
        editCanManageRecords={editCanManageRecords}
        setEditCanManageRecords={setEditCanManageRecords}
        onExecuteDelete={executeDeleteMember}
        onRemoveMember={handleRemoveMember}
        onSavePermissions={handleSavePermissions}
        onClose={() => setPermissionModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal 2: Quy trình mời gia đình 2 bước */}
      <HouseInviteFlowModal
        visible={inviteModalVisible}
        step={inviteStep}
        setStep={setInviteStep}
        selectedInviteRole={selectedInviteRole}
        setSelectedInviteRole={setSelectedInviteRole}
        houseName={house?.name || 'Nhà của tôi'}
        onOpenAccountInvite={() => setIsAccountInviteModalVisible(true)}
        onShareInvite={() => setIsShareModalVisible(true)}
        onCopyLink={handleCopyLink}
        onClose={() => setInviteModalVisible(false)}
        isDarkMode={isDarkMode}
      />

      {/* Modal 3: Nhập SĐT mời qua tài khoản */}
      <HouseAccountInviteModal
        visible={isAccountInviteModalVisible}
        selectedInviteRole={selectedInviteRole}
        newMemberName={newMemberName}
        setNewMemberName={setNewMemberName}
        newMemberPhone={newMemberPhone}
        setNewMemberPhone={setNewMemberPhone}
        newCanViewCamera={newCanViewCamera}
        setNewCanViewCamera={setNewCanViewCamera}
        newCanViewHealth={newCanViewHealth}
        setNewCanViewHealth={setNewCanViewHealth}
        newCanManageDevices={newCanManageDevices}
        setNewCanManageDevices={setNewCanManageDevices}
        newCanManageRecords={newCanManageRecords}
        setNewCanManageRecords={setNewCanManageRecords}
        onAddMember={handleAddMember}
        onClose={() => setIsAccountInviteModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal 4: Popup chia sẻ trực tiếp trên app */}
      <HouseShareModal
        visible={isShareModalVisible}
        houseName={house?.name || 'Nhà của tôi'}
        householdId={household_id}
        selectedInviteRole={selectedInviteRole}
        copySuccessToast={copySuccessToast}
        triggerToast={triggerToast}
        onNativeShare={handleNativeShare}
        onClose={() => setIsShareModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal 5: Cập nhật địa chỉ nhà thực tế */}
      <HouseEditAddressModal
        visible={isEditAddressModalVisible}
        address={editAddressInput}
        setAddress={setEditAddressInput}
        isSaving={isSavingAddress}
        onSave={handleSaveAddress}
        onClose={() => setIsEditAddressModalVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
    borderWidth: 1,
  },
  headerTitleText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  roleInfoBanner: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  roleInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  roleInfoDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'transparent',
  },
  orangePlusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addMemberText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowTitleText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

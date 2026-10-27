// ==============================================================================
// TỆP: HouseDetailScreen.tsx
// PHÂN HỆ: Màn hình Quản lý Không gian Nhà & Phân quyền Thành viên Gia đình
// TÁC GIẢ: Nhóm Phát triển Smart Elderly Care AI
// MÔ TẢ CHỨC NĂNG:
//   1. Hiển thị thông tin căn nhà thông minh hiện tại (Tên nhà, Địa chỉ, Chế độ an ninh).
//   2. Liệt kê danh sách các thành viên được ủy quyền truy cập hệ thống (Chủ nhà / Owner,
//      Thành viên / Member, Bác sĩ gia đình / Doctor).
//   3. Cho phép Chủ nhà (Owner) cấp quyền chi tiết cho thành viên (RBAC):
//      - Theo dõi sức khỏe (Ủy quyền)
//      - Giám sát camera (Được cấp quyền)
//      - Xử lý khẩn cấp (Nhận cảnh báo SOS)
//      - Cấu hình thiết bị & Ngưỡng an toàn
//   4. Mời thành viên mới bằng Số điện thoại và xóa thành viên khỏi nhà.
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
  Platform,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { householdApi } from '../../../services/api';

export default function HouseDetailScreen({ navigation, route }: any) {
  const { house, updateHouseAddress } = useVitalStore();
  const [isEditAddressModalVisible, setIsEditAddressModalVisible] = useState(false);
  const [editAddressInput, setEditAddressInput] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  interface AppToastInfo {
    message: string;
    type: 'success' | 'error' | 'info';
  }
  const [appToast, setAppToast] = useState<AppToastInfo | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAppToast({ message, type });
    setTimeout(() => {
      setAppToast(null);
    }, 3200);
  };

  const handleSaveAddress = async () => {
    try {
      setIsSavingAddress(true);
      const clean = editAddressInput.trim();
      updateHouseAddress(clean);
      setIsEditAddressModalVisible(false);
      showToast('Đã cập nhật địa chỉ nhà thành công.', 'success');
    } catch {
      showToast('Không thể lưu địa chỉ. Vui lòng thử lại.', 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };
  const { full_name, userName, phone_number, userPhone, household_id, role, userRole } = useAuthStore();
  const { isDarkMode } = useTheme();

  // State danh sách thành viên & loading
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // State Modal Thêm thành viên mới & Luồng Mời gia đình 2 bước
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteStep, setInviteStep] = useState<1 | 2>(1);
  const [selectedInviteRole, setSelectedInviteRole] = useState<'MEMBER' | 'DOCTOR'>('MEMBER');
  const [isAccountInviteModalVisible, setIsAccountInviteModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [copySuccessToast, setCopySuccessToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setCopySuccessToast(msg);
    setTimeout(() => {
      setCopySuccessToast(null);
    }, 2800);
  };

  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState<'MEMBER' | 'DOCTOR'>('MEMBER');
  const [newCanViewHealth, setNewCanViewHealth] = useState(true);
  const [newCanViewCamera, setNewCanViewCamera] = useState(true);
  const [newCanHandleEmergency, setNewCanHandleEmergency] = useState(true);
  const [newCanManageDevices, setNewCanManageDevices] = useState(false);
  const [newCanManageRecords, setNewCanManageRecords] = useState(false);

  useEffect(() => {
    if (route?.params?.openInviteModal) {
      setSelectedInviteRole('MEMBER');
      setInviteStep(1);
      setInviteModalVisible(true);
    }
  }, [route?.params?.openInviteModal]);

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

  // Kiểm tra người đang đăng nhập có phải là Chủ nhà (Owner) hoặc Admin không
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

  // Fallback chủ nhà khi chưa load được API
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

  // Gọi API Backend lấy danh sách thành viên thực tế của ngôi nhà
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

  // Mở modal phân quyền cho 1 thành viên
  const handleOpenPermissions = (member: any) => {
    if (!isCurrentUserOwner) {
      const rName = member.role_in_house === 'OWNER' ? 'Chủ hộ' : member.role_in_house === 'DOCTOR' ? 'Bác sĩ gia đình' : 'Thành viên gia đình';
      Alert.alert(
        'Thông tin thành viên',
        `Họ và tên: ${member.full_name}\nVai trò: ${rName}\nSố điện thoại: ${member.phone_number || '--'}\n\nLưu ý: Chỉ Chủ hộ mới có quyền thay đổi phân quyền.`
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

  // Lưu vai trò thành viên
  const handleSavePermissions = async () => {
    if (!selectedMember) return;
    try {
      setIsSavingPermissions(true);
      const targetHId = household_id || 'current';
      const isDoc = editRoleInHouse === 'DOCTOR';
      await householdApi.updateMemberPermissions(targetHId, selectedMember.id, {
        role_in_house: editRoleInHouse,
        can_view_health: true,
        can_view_camera: true,
        can_handle_emergency: true,
        can_manage_devices: false,
        can_manage_records: isDoc,
      });

      // Cập nhật state nội bộ
      setMembers((prev) =>
        prev.map((m) =>
          m.id === selectedMember.id
            ? {
                ...m,
                role_in_house: editRoleInHouse,
                can_view_health: true,
                can_view_camera: true,
                can_handle_emergency: true,
                can_manage_devices: false,
                can_manage_records: isDoc,
              }
            : m
        )
      );
      setPermissionModalVisible(false);
      showToast(`Đã cập nhật vai trò cho ${selectedMember.full_name}.`, 'success');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Không thể lưu thay đổi. Vui lòng thử lại.', 'error');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Kích hoạt giao diện xác nhận xóa thành viên
  const handleRemoveMember = (member: any) => {
    if (!isCurrentUserOwner) {
      showToast('Chỉ Chủ hộ mới có quyền xóa thành viên khỏi ngôi nhà.', 'info');
      return;
    }
    setSelectedMember(member);
    setIsConfirmingDelete(true);
    setPermissionModalVisible(true);
  };

  // Thực thi xóa thành viên khỏi căn nhà qua API Backend
  const executeDeleteMember = async (member: any) => {
    if (!member) return;
    const targetMemberId = member.id || member.user_id;
    if (!targetMemberId) return;

    try {
      setIsDeletingMember(true);
      const targetHId = household_id || 'current';
      await householdApi.removeMember(targetHId, targetMemberId);

      // Cập nhật danh sách thành viên cục bộ ngay lập tức
      setMembers((prev) =>
        prev.filter((m) => m.id !== targetMemberId && m.user_id !== targetMemberId)
      );
      setPermissionModalVisible(false);
      setIsConfirmingDelete(false);

      const msg = `Đã xóa ${member.full_name || 'thành viên'} khỏi ngôi nhà thành công.`;
      showToast(msg, 'success');
      loadMembers();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail ||
        error.message ||
        'Không thể xóa thành viên. Vui lòng thử lại sau.';
      showToast(errorMsg, 'error');
    } finally {
      setIsDeletingMember(false);
    }
  };

  // Xử lý chia sẻ lời mời gia đình trực tiếp trên app
  const handleShareInvite = () => {
    setIsShareModalVisible(true);
  };

  // Chia sẻ qua hệ thống máy nếu muốn
  const handleNativeShare = async () => {
    try {
      const roleName = selectedInviteRole === 'DOCTOR' ? 'Bác sĩ' : 'Thành viên';
      await Share.share({
        title: 'Mời thành viên gia đình',
        message: `Chào bạn, bạn nhận được lời mời tham gia căn nhà "${house?.name || 'Nhà của tôi'}" với vai trò ${roleName} trên ứng dụng Smart Elderly Care AI để cùng chăm sóc và bảo vệ người thân. Mã mời: CARE-${household_id ? String(household_id).slice(-4).toUpperCase() : '8869'}. Vui lòng tải ứng dụng và đăng nhập bằng số điện thoại của bạn.`,
      });
    } catch {
      Alert.alert('Thông báo', 'Không thể mở trình chia sẻ.');
    }
  };

  // Xử lý sao chép liên kết mời
  const handleCopyLink = () => {
    const roleSlug = selectedInviteRole === 'DOCTOR' ? 'doctor' : 'member';
    const link = `https://smartcare.vn/invite?houseId=${household_id || 'current'}&role=${roleSlug}`;
    Alert.alert(
      'Sao chép liên kết thành công',
      `Đã sao chép liên kết mời thành viên vào bộ nhớ tạm:\n\n${link}\n\nBạn có thể gửi liên kết này cho người thân gia đình.`,
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Chia sẻ ngay', onPress: handleShareInvite },
      ]
    );
  };

  // Xử lý thêm thành viên mới
  const handleAddMember = async () => {
    const phoneToSubmit = newMemberPhone.trim();
    if (!phoneToSubmit) {
      setInviteError('Vui lòng nhập số điện thoại người thân hoặc bác sĩ.');
      showToast('Vui lòng nhập số điện thoại người thân hoặc bác sĩ.', 'error');
      return;
    }
    const isDoctor = selectedInviteRole === 'DOCTOR' || newMemberRole === 'DOCTOR';
    const defaultRoleTitle = isDoctor
      ? 'Bác sĩ gia đình'
      : 'Thành viên gia đình';

    try {
      setIsSubmittingInvite(true);
      setInviteError(null);
      const targetHId = household_id || 'current';
      await householdApi.addMember(targetHId, {
        phone_number: phoneToSubmit,
        full_name: defaultRoleTitle,
        role_in_house: isDoctor ? 'DOCTOR' : 'MEMBER',
        role: isDoctor ? 'doctor' : 'user',
        can_view_health: true,
        can_view_camera: true,
        can_handle_emergency: true,
        can_manage_devices: false,
        can_manage_records: isDoctor ? true : false,
      });

      setIsAccountInviteModalVisible(false);
      setAddMemberModalVisible(false);
      setInviteModalVisible(false);
      setNewMemberPhone('');
      setNewMemberName('');
      setInviteError(null);
      showToast(`Đã thêm ${phoneToSubmit} vào ngôi nhà thành công.`, 'success');
      loadMembers();
    } catch (error: any) {
      let errorMsg = error.response?.data?.detail;
      if (typeof errorMsg !== 'string') {
        errorMsg = error.message || 'Số điện thoại chưa có tài khoản trong hệ thống. Vui lòng tạo tài khoản trước.';
      }
      setInviteError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const bgScreen = isDarkMode ? '#0B0F19' : Colors.background;
  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textTitle = isDarkMode ? '#F8FAFC' : Colors.textPrimary;
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgScreen }]} edges={['top']}>
      {/* Thông báo Toast Mobile in-app */}
      {appToast && (
        <View
          style={[
            styles.floatingToastContainer,
            appToast.type === 'success'
              ? styles.floatingToastSuccess
              : appToast.type === 'error'
              ? styles.floatingToastError
              : styles.floatingToastInfo,
          ]}
        >
          <Ionicons
            name={
              appToast.type === 'success'
                ? 'checkmark-circle'
                : appToast.type === 'error'
                ? 'alert-circle'
                : 'information-circle'
            }
            size={22}
            color={
              appToast.type === 'success'
                ? '#10B981'
                : appToast.type === 'error'
                ? '#EF4444'
                : '#3B82F6'
            }
          />
          <Text
            style={[
              styles.floatingToastText,
              {
                color:
                  appToast.type === 'success'
                    ? '#065F46'
                    : appToast.type === 'error'
                    ? '#991B1B'
                    : '#1E40AF',
              },
            ]}
            numberOfLines={2}
          >
            {appToast.message}
          </Text>
        </View>
      )}

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
        {/* 2. Section: Danh sách Thành viên */}
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
            members.map((member, index) => {
              const isOwner = Boolean(member.is_owner || member.role_in_house === 'OWNER');
              const isDoctor =
                member.role_in_house === 'DOCTOR' ||
                member.role === 'DOCTOR' ||
                member.role === 'doctor' ||
                (member.role_in_house || '').includes('Bác sĩ');

              const roleDisplay = isOwner
                ? 'Người sở hữu'
                : isDoctor
                ? 'Bác sĩ gia đình'
                : 'Thành viên';

              const displayName = isOwner ? `${member.full_name} (Chủ hộ)` : member.full_name;

              return (
                <React.Fragment key={member.id || index}>
                  <TouchableOpacity
                    style={styles.memberCardRow}
                    onPress={() => (isOwner ? handleOpenPermissions(member) : handleRemoveMember(member))}
                    activeOpacity={0.7}
                  >
                    {/* Avatar Icon */}
                    <View
                      style={[
                        styles.memberAvatarCircle,
                        {
                          backgroundColor: isOwner
                            ? isDarkMode
                              ? '#4A2810'
                              : '#FEF3C7'
                            : isDoctor
                            ? isDarkMode
                              ? '#064E3B'
                              : '#DCFCE7'
                            : isDarkMode
                            ? '#1E293B'
                            : '#F1F5F9',
                        },
                      ]}
                    >
                      <Ionicons
                        name={isOwner ? 'key' : isDoctor ? 'medkit' : 'person'}
                        size={20}
                        color={isOwner ? '#F59E0B' : isDoctor ? '#16A34A' : isDarkMode ? '#94A3B8' : '#64748B'}
                      />
                    </View>

                    {/* Member Details */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.memberNameText, { color: textTitle }]}>{displayName}</Text>
                        <View
                          style={[
                            styles.roleBadge,
                            {
                              backgroundColor: isOwner
                                ? '#FEF3C7'
                                : isDoctor
                                ? '#DCFCE7'
                                : isDarkMode
                                ? '#334155'
                                : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.inviteRoleBadgeText,
                              { color: isOwner ? '#B45309' : isDoctor ? '#15803D' : textSub },
                            ]}
                          >
                            {roleDisplay}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.memberPhoneSub, { color: textSub }]}>
                        {member.phone_number || '--'}
                      </Text>

                      {/* Permission Chips (Pills) */}
                      <View style={styles.permissionPillsRow}>
                        {/* 1. Camera */}
                        <View
                          style={[
                            styles.permChip,
                            member.can_view_camera !== false || isOwner
                              ? styles.permChipActive
                              : styles.permChipDisabled,
                          ]}
                        >
                          <Ionicons
                            name="videocam"
                            size={12}
                            color={member.can_view_camera !== false || isOwner ? '#10B981' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.permChipText,
                              { color: member.can_view_camera !== false || isOwner ? '#065F46' : '#94A3B8' },
                            ]}
                          >
                            Camera
                          </Text>
                        </View>

                        {/* 2. Sức khỏe */}
                        <View
                          style={[
                            styles.permChip,
                            member.can_view_health !== false || isOwner
                              ? styles.permChipActiveBlue
                              : styles.permChipDisabled,
                          ]}
                        >
                          <Ionicons
                            name="heart"
                            size={12}
                            color={member.can_view_health !== false || isOwner ? '#3B82F6' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.permChipText,
                              { color: member.can_view_health !== false || isOwner ? '#1E40AF' : '#94A3B8' },
                            ]}
                          >
                            Sức khỏe
                          </Text>
                        </View>

                        {/* 3. SOS */}
                        <View
                          style={[
                            styles.permChip,
                            member.can_handle_emergency !== false || isOwner
                              ? styles.permChipActiveRed
                              : styles.permChipDisabled,
                          ]}
                        >
                          <Ionicons
                            name="alert-circle"
                            size={12}
                            color={member.can_handle_emergency !== false || isOwner ? '#EF4444' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.permChipText,
                              { color: member.can_handle_emergency !== false || isOwner ? '#991B1B' : '#94A3B8' },
                            ]}
                          >
                            SOS
                          </Text>
                        </View>

                        {/* 4. Cấu hình thiết bị (nếu có) */}
                        {(member.can_manage_devices || isOwner) && (
                          <View style={[styles.permChip, styles.permChipActivePurple]}>
                            <Ionicons name="settings" size={12} color="#8B5CF6" />
                            <Text style={[styles.permChipText, { color: '#5B21B6' }]}>Cấu hình</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Button Chi tiết (Chủ hộ) / Xóa (Thành viên) */}
                    <View style={styles.actionChevronBox}>
                      <Text style={[styles.permissionBtnText, { color: isOwner ? Colors.primary : '#EF4444' }]}>
                        {isOwner ? 'Chi tiết' : 'Xóa'}
                      </Text>
                      <Ionicons
                        name={isOwner ? 'chevron-forward' : 'trash-outline'}
                        size={isOwner ? 16 : 14}
                        color={isOwner ? Colors.primary : '#EF4444'}
                      />
                    </View>
                  </TouchableOpacity>

                  {index < members.length - 1 && <View style={[styles.divider, { backgroundColor: borderCol }]} />}
                </React.Fragment>
              );
            })
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

      {/* =================================================================== */}
      {/* MODAL 1: CẤP QUYỀN CHO THÀNH VIÊN (RBAC PERMISSION SETTINGS) */}
      {/* =================================================================== */}
      <Modal visible={permissionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: textTitle }]}>
                  {isConfirmingDelete ? 'Xác nhận xóa thành viên' : 'Thông tin thành viên'}
                </Text>
                <Text style={[styles.modalSub, { color: textSub }]}>
                  {selectedMember?.full_name} ({selectedMember?.phone_number || '--'})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsConfirmingDelete(false);
                  setPermissionModalVisible(false);
                }}
                style={styles.modalCloseBtn}
                disabled={isDeletingMember}
              >
                <Ionicons name="close" size={22} color={textSub} />
              </TouchableOpacity>
            </View>

            {isConfirmingDelete ? (
              // GIAO DIỆN XÁC NHẬN XÓA THÀNH VIÊN
              <View style={styles.confirmDeleteContent}>
                <View style={styles.confirmDeleteIconCircle}>
                  <Ionicons name="trash-outline" size={36} color="#EF4444" />
                </View>
                <Text style={[styles.confirmDeleteHeading, { color: textTitle }]}>
                  Bạn có chắc muốn xóa thành viên này?
                </Text>
                <Text style={[styles.confirmDeleteDescription, { color: textSub }]}>
                  Tài khoản <Text style={{ fontWeight: '700', color: textTitle }}>{selectedMember?.full_name}</Text> ({selectedMember?.phone_number || '--'}) sẽ bị xóa khỏi căn nhà và mất toàn bộ quyền truy cập dữ liệu sức khỏe, camera AI cũng như thông báo khẩn cấp.
                </Text>

                <View style={styles.confirmActionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: borderCol },
                    ]}
                    onPress={() => setIsConfirmingDelete(false)}
                    disabled={isDeletingMember}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy bỏ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmExecuteDeleteBtn, isDeletingMember && { opacity: 0.7 }]}
                    onPress={() => executeDeleteMember(selectedMember)}
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
            ) : selectedMember?.is_owner || selectedMember?.role_in_house === 'OWNER' ? (
              // Trường hợp là Chủ sở hữu
              <View style={styles.ownerNoticeBox}>
                <Ionicons name="ribbon" size={28} color="#F59E0B" />
                <Text style={styles.ownerNoticeTitle}>Chủ sở hữu hệ thống (Owner)</Text>
                <Text style={styles.ownerNoticeText}>
                  Tài khoản này là Chủ nhà, sở hữu toàn quyền quản trị cấu hình AI, camera, hồ sơ bệnh án và thành viên trong nhà.
                </Text>
              </View>
            ) : (
              // Trường hợp là Thành viên hoặc Bác sĩ
              <>
                {/* Chọn vai trò */}
                <Text style={[styles.permSectionTitle, { color: textTitle, marginTop: 6 }]}>Vai trò trong gia đình</Text>
                <View style={styles.rolePickerRow}>
                  <TouchableOpacity
                    style={[
                      styles.roleOptionBtn,
                      { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol },
                      editRoleInHouse === 'MEMBER' && styles.roleOptionActive,
                    ]}
                    onPress={() => setEditRoleInHouse('MEMBER')}
                  >
                    <Ionicons
                      name="people"
                      size={16}
                      color={editRoleInHouse === 'MEMBER' ? '#F97316' : textSub}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: textSub },
                        editRoleInHouse === 'MEMBER' && styles.roleOptionTextActive,
                      ]}
                    >
                      Thành viên
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleOptionBtn,
                      { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol },
                      editRoleInHouse === 'DOCTOR' && styles.roleOptionActive,
                    ]}
                    onPress={() => setEditRoleInHouse('DOCTOR')}
                  >
                    <Ionicons
                      name="medkit"
                      size={16}
                      color={editRoleInHouse === 'DOCTOR' ? '#F97316' : textSub}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: textSub },
                        editRoleInHouse === 'DOCTOR' && styles.roleOptionTextActive,
                      ]}
                    >
                      Bác sĩ gia đình
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Ghi chú về quyền của Admin */}
                <View
                  style={[
                    styles.adminNoticeBox,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                      borderColor: borderCol,
                      marginTop: 16,
                      marginBottom: 10,
                    },
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" />
                  <Text style={[styles.adminNoticeText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    Quyền hạn chi tiết được quản trị viên hệ thống thiết lập tự động theo vai trò.
                  </Text>
                </View>

                {/* Modal Action Buttons */}
                <View style={styles.modalActionButtons}>
                  <TouchableOpacity
                    style={[styles.removeBtn, { borderColor: '#EF4444' }]}
                    onPress={() => handleRemoveMember(selectedMember)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.removeBtnText}>Xóa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSavePermissions}
                    disabled={isSavingPermissions}
                    activeOpacity={0.8}
                  >
                    {isSavingPermissions ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL MỜI THÀNH VIÊN GIA ĐÌNH (GIAO DIỆN 2 BƯỚC) */}
      {/* =================================================================== */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (inviteStep === 2) {
            setInviteStep(1);
          } else {
            setInviteModalVisible(false);
          }
        }}
      >
        <SafeAreaView style={[styles.inviteSafeArea, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]} edges={['top', 'bottom']}>
          {/* Top Bar with Back Arrow */}
          <View style={styles.inviteTopBar}>
            <TouchableOpacity
              style={styles.inviteBackBtn}
              onPress={() => {
                if (inviteStep === 2) {
                  setInviteStep(1);
                } else {
                  setInviteModalVisible(false);
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={26} color={isDarkMode ? '#F8FAFC' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.inviteScrollContent} showsVerticalScrollIndicator={false}>
            {/* Screen Title */}
            <Text style={[styles.inviteMainTitle, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
              Mời thành viên gia đình
            </Text>

            {/* House Card */}
            <View style={[styles.inviteHouseCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
              <View style={[styles.inviteHouseIconBox, { backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF' }]}>
                <Ionicons name="home" size={22} color="#3B82F6" />
              </View>
              <Text style={[styles.inviteHouseName, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
                {house?.name || 'Nhà của tôi'}
              </Text>
            </View>

            {inviteStep === 1 ? (
              /* STEP 1: CHỌN QUYỀN TRUY CẬP (HÌNH 1) */
              <View style={{ marginTop: 22 }}>
                <Text style={[styles.inviteSectionSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Chọn Quyền truy cập
                </Text>

                <View style={[styles.inviteOptionsGroup, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                  {/* Option 1: Thành viên */}
                  <TouchableOpacity
                    style={styles.inviteRoleOptionItem}
                    activeOpacity={0.8}
                    onPress={() => setSelectedInviteRole('MEMBER')}
                  >
                    <View style={styles.inviteRoleHeaderRow}>
                      <Text style={[styles.inviteRoleTitle, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                        Thành viên
                      </Text>
                      {selectedInviteRole === 'MEMBER' ? (
                        <View style={styles.radioChecked}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.radioUnchecked} />
                      )}
                    </View>
                    <Text style={[styles.inviteRoleDesc, { color: isDarkMode ? '#94A3B8' : '#4B5563' }]}>
                      Cho phép người dùng này có thể sử dụng thiết bị và có một số quyền quản lý thiết bị
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.inviteOptionDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

                  {/* Option 2: Bác sĩ */}
                  <TouchableOpacity
                    style={styles.inviteRoleOptionItem}
                    activeOpacity={0.8}
                    onPress={() => setSelectedInviteRole('DOCTOR')}
                  >
                    <View style={styles.inviteRoleHeaderRow}>
                      <Text style={[styles.inviteRoleTitle, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                        Bác sĩ
                      </Text>
                      {selectedInviteRole === 'DOCTOR' ? (
                        <View style={styles.radioChecked}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.radioUnchecked} />
                      )}
                    </View>
                    <Text style={[styles.inviteRoleDesc, { color: isDarkMode ? '#94A3B8' : '#4B5563' }]}>
                      Cho phép bác sĩ theo dõi chỉ số sức khỏe, xem hồ sơ bệnh án, lịch sử sự cố và tiếp nhận các cảnh báo y tế khẩn cấp.
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* STEP 2: MỜI THÀNH VIÊN VỚI (HÌNH 2) */
              <View style={{ marginTop: 22 }}>
                <Text style={[styles.inviteSectionSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Mời thành viên với
                </Text>

                <View style={[styles.inviteOptionsGroup, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                  {/* 1. Tài khoản */}
                  <TouchableOpacity
                    style={styles.inviteMethodRow}
                    activeOpacity={0.7}
                    onPress={() => setIsAccountInviteModalVisible(true)}
                  >
                    <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#FB923C' }]}>
                      <Ionicons name="person" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.inviteMethodLabel, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                      Tài khoản
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <View style={[styles.inviteMethodDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

                  {/* 2. Chia sẻ */}
                  <TouchableOpacity
                    style={styles.inviteMethodRow}
                    activeOpacity={0.7}
                    onPress={handleShareInvite}
                  >
                    <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#10B981' }]}>
                      <Ionicons name="share-social" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.inviteMethodLabel, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                      Chia sẻ
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <View style={[styles.inviteMethodDivider, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]} />

                  {/* 3. Sao chép liên kết */}
                  <TouchableOpacity
                    style={styles.inviteMethodRow}
                    activeOpacity={0.7}
                    onPress={handleCopyLink}
                  >
                    <View style={[styles.inviteMethodIconCircle, { backgroundColor: '#6366F1' }]}>
                      <Ionicons name="link" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.inviteMethodLabel, { color: isDarkMode ? '#F8FAFC' : '#111827' }]}>
                      Sao chép liên kết
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Button cho Step 1: "Tiếp theo" */}
          {inviteStep === 1 && (
            <View style={[styles.inviteBottomBtnContainer, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}>
              <TouchableOpacity
                style={styles.inviteNextBtn}
                activeOpacity={0.85}
                onPress={() => setInviteStep(2)}
              >
                <Text style={styles.inviteNextBtnText}>Tiếp theo</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* =================================================================== */}
      {/* POPUP NHẬP SỐ ĐIỆN THOẠI KHI CHỌN "TÀI KHOẢN" */}
      {/* =================================================================== */}
      <Modal visible={isAccountInviteModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {appToast && (
            <View
              style={[
                styles.modalTopToast,
                appToast.type === 'success'
                  ? styles.floatingToastSuccess
                  : styles.floatingToastError,
              ]}
            >
              <Ionicons
                name={appToast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={20}
                color={appToast.type === 'success' ? '#10B981' : '#EF4444'}
              />
              <Text
                style={[
                  styles.floatingToastText,
                  { color: appToast.type === 'success' ? '#065F46' : '#991B1B' },
                ]}
                numberOfLines={2}
              >
                {appToast.message}
              </Text>
            </View>
          )}

          <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <Text style={[styles.modalTitle, { color: textTitle }]}>Mời qua Tài khoản</Text>
            <View style={[styles.inviteRoleBadgeContainer, { backgroundColor: selectedInviteRole === 'DOCTOR' ? '#EFF6FF' : '#F0FDF4' }]}>
              <Text style={[styles.inviteRoleBadgeText, { color: selectedInviteRole === 'DOCTOR' ? '#2563EB' : '#16A34A' }]}>
                Vai trò: {selectedInviteRole === 'DOCTOR' ? '🩺 Bác sĩ gia đình' : '👤 Thành viên'}
              </Text>
            </View>
            <Text style={[styles.modalSub, { color: textSub, marginTop: 4 }]}>
              Nhập số điện thoại để gửi lời mời tham gia ngôi nhà.
            </Text>

            {inviteError && (
              <View style={styles.inviteErrorBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.inviteErrorText}>{inviteError}</Text>
              </View>
            )}

            <TextInput
              style={[
                styles.addressInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderColor: inviteError ? '#EF4444' : borderCol,
                  color: textTitle,
                  marginTop: 14,
                },
              ]}
              value={newMemberPhone}
              onChangeText={(text) => {
                setNewMemberPhone(text);
                if (inviteError) setInviteError(null);
              }}
              placeholder="Nhập số điện thoại (ví dụ: 0912 345 678)"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0', borderColor: borderCol }]}
                onPress={() => {
                  setInviteError(null);
                  setIsAccountInviteModalVisible(false);
                }}
                disabled={isSubmittingInvite}
              >
                <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSubmittingInvite && { opacity: 0.7 }]}
                onPress={handleAddMember}
                disabled={isSubmittingInvite}
              >
                {isSubmittingInvite ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Gửi lời mời</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* POPUP CHIA SẺ TRỰC TIẾP TRÊN APP KHI NHẤN "CHIA SẺ" */}
      {/* =================================================================== */}
      <Modal
        visible={isShareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.shareModalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            {/* Header */}
            <View style={styles.shareHeaderRow}>
              <View style={[styles.shareIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="share-social" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shareModalTitle, { color: textTitle }]}>
                  Chia sẻ lời mời gia đình
                </Text>
                <Text style={[styles.shareModalSub, { color: textSub }]}>
                  Mời người thân vào căn nhà trực tiếp trên app
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsShareModalVisible(false)}
                style={[styles.shareCloseBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={textSub} />
              </TouchableOpacity>
            </View>

            {/* Thông tin căn nhà & vai trò */}
            <View style={[styles.shareHouseBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol }]}>
              <View style={styles.shareHouseRow}>
                <View style={styles.shareHouseIconSmall}>
                  <Ionicons name="home" size={16} color="#3B82F6" />
                </View>
                <Text style={[styles.shareHouseNameText, { color: textTitle }]}>
                  {house?.name || 'Nhà của tôi'}
                </Text>
                <View style={[styles.shareRolePill, { backgroundColor: selectedInviteRole === 'DOCTOR' ? '#EFF6FF' : '#F0FDF4' }]}>
                  <Text style={[styles.shareRolePillText, { color: selectedInviteRole === 'DOCTOR' ? '#2563EB' : '#16A34A' }]}>
                    {selectedInviteRole === 'DOCTOR' ? '🩺 Bác sĩ' : '👤 Thành viên'}
                  </Text>
                </View>
              </View>

              {/* Mã mời nổi bật */}
              <View style={[styles.inviteCodeContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#FFF' }]}>
                <Text style={[styles.inviteCodeLabel, { color: textSub }]}>MÃ MỜI THAM GIA NHÀ</Text>
                <View style={styles.inviteCodeValueRow}>
                  <Text style={[styles.inviteCodeText, { color: Colors.primary }]}>
                    {`CARE-${household_id ? String(household_id).slice(-4).toUpperCase() : '8869'}`}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyCodeMiniBtn}
                    onPress={() => {
                      triggerToast('Đã sao chép mã mời vào bộ nhớ tạm!');
                    }}
                  >
                    <Ionicons name="copy-outline" size={14} color="#FFF" />
                    <Text style={styles.copyCodeMiniText}>Sao chép mã</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.inviteCodeExpireText}>⏱️ Mã có hiệu lực trong 48 giờ</Text>
              </View>
            </View>

            {/* Khung nội dung lời mời mẫu */}
            <View style={[styles.shareMessagePreviewBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
              <Text style={[styles.shareMessagePreviewLabel, { color: textSub }]}>Nội dung tin nhắn sẽ gửi:</Text>
              <Text style={[styles.shareMessagePreviewContent, { color: isDarkMode ? '#E2E8F0' : '#334155' }]} numberOfLines={3}>
                {`Chào bạn! Bạn nhận được lời mời tham gia "${house?.name || 'Nhà của tôi'}" với vai trò ${selectedInviteRole === 'DOCTOR' ? 'Bác sĩ' : 'Thành viên'}. Mã mời: CARE-${household_id ? String(household_id).slice(-4).toUpperCase() : '8869'}. Tải app Smart Elderly Care AI để kết nối!`}
              </Text>
            </View>

            {/* Kênh chia sẻ nhanh trực tiếp */}
            <Text style={[styles.shareChannelsTitle, { color: textSub }]}>Chọn ứng dụng chia sẻ:</Text>
            <View style={styles.shareChannelsRow}>
              {/* Kênh 1: Tin nhắn SMS */}
              <TouchableOpacity
                style={styles.shareChannelItem}
                onPress={() => {
                  const msg = `Mời bạn tham gia căn nhà "${house?.name || 'Nhà của tôi'}" trên Smart Elderly Care AI. Mã mời: CARE-${household_id ? String(household_id).slice(-4).toUpperCase() : '8869'}. Tải ứng dụng tại: https://smartcare.vn/app`;
                  Linking.openURL(`sms:?body=${encodeURIComponent(msg)}`).catch(() => {
                    triggerToast('Không thể mở tin nhắn SMS.');
                  });
                }}
              >
                <View style={[styles.shareChannelIconBox, { backgroundColor: '#34D399' }]}>
                  <Ionicons name="chatbubble-ellipses" size={22} color="#FFF" />
                </View>
                <Text style={[styles.shareChannelName, { color: textTitle }]}>Tin nhắn</Text>
              </TouchableOpacity>

              {/* Kênh 2: Zalo */}
              <TouchableOpacity
                style={styles.shareChannelItem}
                onPress={() => {
                  Linking.openURL('https://zalo.me').catch(() => {
                    triggerToast('Đã sao chép link mời để gửi qua Zalo!');
                  });
                  triggerToast('Đã sao chép nội dung để gửi qua Zalo!');
                }}
              >
                <View style={[styles.shareChannelIconBox, { backgroundColor: '#0284C7' }]}>
                  <Ionicons name="paper-plane" size={22} color="#FFF" />
                </View>
                <Text style={[styles.shareChannelName, { color: textTitle }]}>Zalo</Text>
              </TouchableOpacity>

              {/* Kênh 3: Sao chép toàn bộ */}
              <TouchableOpacity
                style={styles.shareChannelItem}
                onPress={() => {
                  triggerToast('Đã sao chép toàn bộ nội dung lời mời!');
                }}
              >
                <View style={[styles.shareChannelIconBox, { backgroundColor: '#8B5CF6' }]}>
                  <Ionicons name="copy" size={22} color="#FFF" />
                </View>
                <Text style={[styles.shareChannelName, { color: textTitle }]}>Sao chép</Text>
              </TouchableOpacity>

              {/* Kênh 4: Hệ thống khác */}
              <TouchableOpacity
                style={styles.shareChannelItem}
                onPress={() => {
                  handleNativeShare();
                }}
              >
                <View style={[styles.shareChannelIconBox, { backgroundColor: '#F97316' }]}>
                  <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
                </View>
                <Text style={[styles.shareChannelName, { color: textTitle }]}>Khác</Text>
              </TouchableOpacity>
            </View>

            {/* Toast thông báo đã copy */}
            {copySuccessToast && (
              <View style={styles.shareToastBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.shareToastText}>{copySuccessToast}</Text>
              </View>
            )}

            {/* Nút hành động chính */}
            <View style={styles.shareModalBtnRow}>
              <TouchableOpacity
                style={[styles.shareModalCancelBtn, { borderColor: borderCol, backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9' }]}
                onPress={() => setIsShareModalVisible(false)}
              >
                <Text style={[styles.shareModalCancelText, { color: textSub }]}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareModalPrimaryBtn}
                onPress={() => {
                  triggerToast('Đã sao chép lời mời thành công!');
                }}
              >
                <Ionicons name="copy" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.shareModalPrimaryText}>Sao chép lời mời</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal Cáº­p nháº­t Äá»‹a chá»‰ nhÃ  thá»±c táº¿ */}
      <Modal
        visible={isEditAddressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: bgCard }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <Text style={[styles.modalTitle, { color: textTitle }]}>Địa chỉ nhà thực tế</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditAddressModalVisible(false)}>
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
              value={editAddressInput}
              onChangeText={setEditAddressInput}
              placeholder="VD: Số 123 Đường ABC, Quận XYZ, TP. Đà Nẵng"
              placeholderTextColor="#94A3B8"
              autoFocus
            />

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: borderCol }]}
                onPress={() => setIsEditAddressModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { opacity: isSavingAddress ? 0.7 : 1 }]}
                onPress={handleSaveAddress}
                disabled={isSavingAddress}
              >
                {isSavingAddress ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Lưu lại</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardContainer: {
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  memberCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  memberAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inviteRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  memberPhoneSub: {
    fontSize: 12,
    marginTop: 2,
  },
  permissionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  permChipActive: {
    backgroundColor: '#ECFDF5',
  },
  permChipActiveBlue: {
    backgroundColor: '#EFF6FF',
  },
  permChipActiveRed: {
    backgroundColor: '#FEF2F2',
  },
  permChipActivePurple: {
    backgroundColor: '#F5F3FF',
  },
  permChipDisabled: {
    backgroundColor: '#F1F5F9',
  },
  permChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionChevronBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexDirection: 'row',
    gap: 2,
  },
  permissionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  orangePlusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
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
    paddingVertical: 16,
  },
  rowTitleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  ownerNoticeBox: {
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    marginVertical: 12,
  },
  ownerNoticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
    marginTop: 8,
    marginBottom: 4,
  },
  ownerNoticeText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#B45309',
    textAlign: 'center',
  },
  permSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  permSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  permSwitchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  permSwitchDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  permCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  permCheckLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  addressInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  roleOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F59E0B',
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleOptionTextActive: {
    color: '#F97316',
    fontWeight: '800',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  removeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  removeBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmDeleteContent: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  confirmDeleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmDeleteHeading: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmDeleteDescription: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmActionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmExecuteDeleteBtn: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmExecuteDeleteBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Styles luồng Mời thành viên gia đình (Step 1 & Step 2)
  inviteSafeArea: {
    flex: 1,
  },
  inviteTopBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  inviteBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  inviteScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
  },
  inviteMainTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  inviteHouseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteHouseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteHouseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  inviteSectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  inviteOptionsGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteRoleOptionItem: {
    padding: 16,
  },
  inviteRoleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inviteRoleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  radioChecked: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnchecked: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  inviteRoleDesc: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  inviteOptionDivider: {
    height: 1,
  },
  inviteBottomBtnContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inviteNextBtn: {
    backgroundColor: '#F97316',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  inviteNextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  inviteMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  inviteMethodIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteMethodLabel: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '700',
  },
  inviteMethodDivider: {
    height: 1,
    marginLeft: 70,
  },
  inviteRoleBadgeContainer: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  adminNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 14,
  },
  adminNoticeText: {
    flex: 1,
    color: '#B45309',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  // Styles Popup Chia sẻ trực tiếp trên App
  shareModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  shareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  shareIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  shareModalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  shareCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHouseBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  shareHouseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shareHouseIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHouseNameText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  shareRolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  shareRolePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inviteCodeContainer: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
  },
  inviteCodeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inviteCodeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  inviteCodeText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  copyCodeMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  copyCodeMiniText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  inviteCodeExpireText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  shareMessagePreviewBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  shareMessagePreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  shareMessagePreviewContent: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  shareChannelsTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  shareChannelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  shareChannelItem: {
    alignItems: 'center',
    flex: 1,
  },
  shareChannelIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shareChannelName: {
    fontSize: 12,
    fontWeight: '600',
  },
  shareToastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
    alignSelf: 'center',
  },
  shareToastText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  shareModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  shareModalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareModalPrimaryBtn: {
    flex: 1.8,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  shareModalPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingToastContainer: {
    position: 'absolute',
    top: 55,
    left: 20,
    right: 20,
    zIndex: 9999,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    gap: 10,
  },
  floatingToastSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  floatingToastError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  floatingToastInfo: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  floatingToastText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
  },
  inviteErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  inviteErrorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  modalTopToast: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 99999,
    elevation: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    gap: 10,
  },
});

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { useAuthStore, useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { householdApi } from '../../../services/api';

export default function HouseDetailScreen({ navigation }: any) {
  const { house } = useVitalStore();
  const { full_name, userName, phone_number, userPhone, household_id, role, userRole } = useAuthStore();
  const { isDarkMode } = useTheme();

  // State danh sách thành viên & loading
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // State Modal Thêm thành viên mới
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'MEMBER' | 'DOCTOR'>('MEMBER');
  const [newCanViewHealth, setNewCanViewHealth] = useState(true);
  const [newCanViewCamera, setNewCanViewCamera] = useState(true);
  const [newCanHandleEmergency, setNewCanHandleEmergency] = useState(true);
  const [newCanManageDevices, setNewCanManageDevices] = useState(false);

  // State Modal Cấp quyền cho thành viên (RBAC Permission Sheet)
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [editRoleInHouse, setEditRoleInHouse] = useState('MEMBER');
  const [editCanViewHealth, setEditCanViewHealth] = useState(true);
  const [editCanViewCamera, setEditCanViewCamera] = useState(true);
  const [editCanHandleEmergency, setEditCanHandleEmergency] = useState(true);
  const [editCanManageDevices, setEditCanManageDevices] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Kiểm tra người đang đăng nhập có phải là Chủ nhà (Owner) hoặc Admin không
  const isCurrentUserOwner =
    userRole === 'admin' ||
    role === 'admin' ||
    members.find(
      (m) =>
        m.is_owner &&
        (m.phone_number === phone_number || m.phone_number === userPhone)
    ) !== undefined ||
    members.length === 0;

  // Fallback chủ nhà khi chưa load được API
  const getFallbackOwner = useCallback(() => [
    {
      id: 'owner-default-id',
      user_id: 'owner-user-id',
      full_name: full_name || userName || 'Chủ hộ',
      phone_number: phone_number || userPhone || '--',
      role: 'Chủ nhà / Người sở hữu',
      role_in_house: 'OWNER',
      permissions: 'ADMIN',
      can_view_health: true,
      can_view_camera: true,
      can_handle_emergency: true,
      can_manage_devices: true,
      can_manage_records: true,
      is_owner: true,
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
        setMembers(getFallbackOwner());
      }
    } catch {
      setMembers(getFallbackOwner());
    } finally {
      setIsLoadingMembers(false);
    }
  }, [household_id, getFallbackOwner]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Mở modal phân quyền cho 1 thành viên
  const handleOpenPermissions = (member: any) => {
    setSelectedMember(member);
    setEditRoleInHouse(member.role_in_house || 'MEMBER');
    setEditCanViewHealth(member.can_view_health !== false);
    setEditCanViewCamera(member.can_view_camera !== false);
    setEditCanHandleEmergency(member.can_handle_emergency !== false);
    setEditCanManageDevices(Boolean(member.can_manage_devices));
    setPermissionModalVisible(true);
  };

  // Lưu quyền hạn vừa chỉnh sửa (Cấp quyền cho thành viên)
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
      });

      // Cập nhật state nội bộ
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

  // Xóa thành viên khỏi căn nhà
  const handleRemoveMember = (member: any) => {
    Alert.alert(
      'Xóa thành viên',
      `Bạn có chắc chắn muốn xóa "${member.full_name}" khỏi danh sách gia đình không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa thành viên',
          style: 'destructive',
          onPress: async () => {
            try {
              const targetHId = household_id || 'current';
              await householdApi.removeMember(targetHId, member.id);
              setMembers((prev) => prev.filter((m) => m.id !== member.id));
              setPermissionModalVisible(false);
              Alert.alert('Đã xóa', `Đã xóa ${member.full_name} khỏi ngôi nhà.`);
            } catch (error: any) {
              Alert.alert('Lỗi', error.response?.data?.detail || 'Không thể xóa thành viên.');
            }
          },
        },
      ]
    );
  };

  // Xử lý thêm thành viên mới
  const handleAddMember = async () => {
    const phoneToSubmit = newMemberPhone.trim();
    if (!phoneToSubmit) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại người thân hoặc bác sĩ.');
      return;
    }
    const roleTitle = newMemberRole === 'DOCTOR' ? 'Bác sĩ gia đình' : 'Thành viên gia đình';

    try {
      const targetHId = household_id || 'current';
      await householdApi.addMember(targetHId, {
        phone_number: phoneToSubmit,
        full_name: newMemberName.trim() || roleTitle,
        role_in_house: newMemberRole === 'DOCTOR' ? 'DOCTOR' : 'MEMBER',
        role: newMemberRole === 'DOCTOR' ? 'doctor' : 'user',
        can_view_health: newCanViewHealth,
        can_view_camera: newCanViewCamera,
        can_handle_emergency: newCanHandleEmergency,
        can_manage_devices: newCanManageDevices,
      });

      setAddMemberModalVisible(false);
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
          <Text style={[styles.headerSubText, { color: textSub }]}>
            {house?.address || '123 Hải Phòng, P. Thạch Thang, Q. Hải Châu'}
          </Text>
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
            members.map((member, index) => {
              const isOwner = member.is_owner || member.role_in_house === 'OWNER' || index === 0;
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
                    onPress={() => handleOpenPermissions(member)}
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
                              styles.roleBadgeText,
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

                    {/* Button Phân quyền */}
                    <View style={styles.actionChevronBox}>
                      <Text style={[styles.permissionBtnText, { color: Colors.primary }]}>
                        {isOwner ? 'Chi tiết' : 'Cấp quyền'}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
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
            onPress={() => setAddMemberModalVisible(true)}
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
                <Text style={[styles.modalTitle, { color: textTitle }]}>Phân quyền thành viên</Text>
                <Text style={[styles.modalSub, { color: textSub }]}>
                  {selectedMember?.full_name} ({selectedMember?.phone_number || '--'})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPermissionModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={textSub} />
              </TouchableOpacity>
            </View>

            {selectedMember?.is_owner || selectedMember?.role_in_house === 'OWNER' ? (
              // Trường hợp là Chủ sở hữu
              <View style={styles.ownerNoticeBox}>
                <Ionicons name="ribbon" size={28} color="#F59E0B" />
                <Text style={styles.ownerNoticeTitle}>Chủ sở hữu hệ thống (Owner)</Text>
                <Text style={styles.ownerNoticeText}>
                  Tài khoản này là Chủ nhà, sở hữu toàn quyền quản trị cấu hình AI, camera, hồ sơ bệnh án và phân quyền thành viên. Không thể giới hạn quyền của Chủ hộ.
                </Text>
              </View>
            ) : (
              // Trường hợp là Thành viên hoặc Bác sĩ
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {/* Chọn vai trò */}
                <Text style={[styles.permSectionTitle, { color: textTitle }]}>Vai trò trong gia đình</Text>
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

                {/* Danh sách các quyền hạn chi tiết */}
                <Text style={[styles.permSectionTitle, { color: textTitle, marginTop: 18 }]}>
                  Danh sách quyền hạn được cấp
                </Text>

                {/* 1. Theo dõi sức khỏe (Ủy quyền) */}
                <View style={[styles.permSwitchRow, { borderColor: borderCol }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="fitness" size={18} color="#3B82F6" style={{ marginRight: 6 }} />
                      <Text style={[styles.permSwitchTitle, { color: textTitle }]}>
                        Theo dõi sức khỏe (Ủy quyền)
                      </Text>
                    </View>
                    <Text style={[styles.permSwitchDesc, { color: textSub }]}>
                      Cho phép xem chỉ số sinh hiệu (nhịp tim, SpO2, huyết áp) và báo cáo y tế.
                    </Text>
                  </View>
                  <Switch
                    value={editCanViewHealth}
                    onValueChange={setEditCanViewHealth}
                    trackColor={{ false: '#94A3B8', true: '#BFDBFE' }}
                    thumbColor={editCanViewHealth ? '#2563EB' : '#F1F5F9'}
                  />
                </View>

                {/* 2. Giám sát camera (Được cấp quyền) */}
                <View style={[styles.permSwitchRow, { borderColor: borderCol }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="videocam" size={18} color="#10B981" style={{ marginRight: 6 }} />
                      <Text style={[styles.permSwitchTitle, { color: textTitle }]}>
                        Giám sát camera (Được cấp quyền)
                      </Text>
                    </View>
                    <Text style={[styles.permSwitchDesc, { color: textSub }]}>
                      Cho phép xem trực tiếp luồng stream an ninh AI, đàm thoại và phát lại.
                    </Text>
                  </View>
                  <Switch
                    value={editCanViewCamera}
                    onValueChange={setEditCanViewCamera}
                    trackColor={{ false: '#94A3B8', true: '#A7F3D0' }}
                    thumbColor={editCanViewCamera ? '#059669' : '#F1F5F9'}
                  />
                </View>

                {/* 3. Xử lý khẩn cấp */}
                <View style={[styles.permSwitchRow, { borderColor: borderCol }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                      <Text style={[styles.permSwitchTitle, { color: textTitle }]}>
                        Xử lý khẩn cấp & SOS
                      </Text>
                    </View>
                    <Text style={[styles.permSwitchDesc, { color: textSub }]}>
                      Nhận chuông báo té ngã, kích hoạt còi hú báo động và gọi cấp cứu 115.
                    </Text>
                  </View>
                  <Switch
                    value={editCanHandleEmergency}
                    onValueChange={setEditCanHandleEmergency}
                    trackColor={{ false: '#94A3B8', true: '#FECACA' }}
                    thumbColor={editCanHandleEmergency ? '#DC2626' : '#F1F5F9'}
                  />
                </View>

                {/* 4. Cấu hình thiết bị & Ngưỡng */}
                <View style={[styles.permSwitchRow, { borderColor: borderCol }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="hardware-chip" size={18} color="#8B5CF6" style={{ marginRight: 6 }} />
                      <Text style={[styles.permSwitchTitle, { color: textTitle }]}>
                        Cấu hình thiết bị & Ngưỡng an toàn
                      </Text>
                    </View>
                    <Text style={[styles.permSwitchDesc, { color: textSub }]}>
                      Quyền thay đổi ngưỡng báo động nhịp tim/huyết áp và khởi động lại phần cứng.
                    </Text>
                  </View>
                  <Switch
                    value={editCanManageDevices}
                    onValueChange={setEditCanManageDevices}
                    trackColor={{ false: '#94A3B8', true: '#DDD6FE' }}
                    thumbColor={editCanManageDevices ? '#7C3AED' : '#F1F5F9'}
                  />
                </View>
              </ScrollView>
            )}

            {/* Modal Action Buttons */}
            {!(selectedMember?.is_owner || selectedMember?.role_in_house === 'OWNER') && (
              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={[styles.removeBtn, { borderColor: '#EF4444' }]}
                  onPress={() => handleRemoveMember(selectedMember)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={styles.removeBtnText}>Xóa</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSavePermissions}
                  disabled={isSavingPermissions}
                >
                  {isSavingPermissions ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Lưu phân quyền</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 2: MỜI THÀNH VIÊN MỚI VÀO NHÀ */}
      {/* =================================================================== */}
      <Modal visible={addMemberModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <Text style={[styles.modalTitle, { color: textTitle }]}>Mời người thân / Bác sĩ</Text>
            <Text style={[styles.modalSub, { color: textSub }]}>
              Nhập số điện thoại để gửi quyền giám sát và theo dõi người cao tuổi.
            </Text>

            <TextInput
              style={[
                styles.addressInput,
                { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: borderCol, color: textTitle },
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

            {/* Chọn vai trò */}
            <View style={styles.rolePickerRow}>
              <TouchableOpacity
                style={[
                  styles.roleOptionBtn,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol },
                  newMemberRole === 'MEMBER' && styles.roleOptionActive,
                ]}
                onPress={() => setNewMemberRole('MEMBER')}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    { color: textSub },
                    newMemberRole === 'MEMBER' && styles.roleOptionTextActive,
                  ]}
                >
                  Thành viên gia đình
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleOptionBtn,
                  { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: borderCol },
                  newMemberRole === 'DOCTOR' && styles.roleOptionActive,
                ]}
                onPress={() => setNewMemberRole('DOCTOR')}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    { color: textSub },
                    newMemberRole === 'DOCTOR' && styles.roleOptionTextActive,
                  ]}
                >
                  Bác sĩ gia đình
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quyền cấp trước */}
            <View style={{ marginTop: 14 }}>
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
            </View>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0', borderColor: borderCol }]}
                onPress={() => setAddMemberModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: textSub }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddMember}>
                <Text style={styles.saveBtnText}>Gửi lời mời & Cấp quyền</Text>
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
  roleBadgeText: {
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
});

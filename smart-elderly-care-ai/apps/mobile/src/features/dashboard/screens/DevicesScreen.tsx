/**
 * DevicesScreen.tsx
 * Màn hình Quản lý phần cứng và Thiết bị IoT (Tab 2 - Thiết bị)
 * Nghiệp vụ: Quản lý danh mục thiết bị ngoại vi (Camera AI, Vòng đeo tay BLE, Edge Hub),
 * hỗ trợ phân vùng phòng, ghép nối nhanh qua QR Code và điều phối nhóm giám sát an toàn.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Text, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore, IoTDeviceItem } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { LocalizedAlert, LocalizedText } from '../../../i18n/LocalizedComponents';
import { DeviceQrScannerModal } from '../components/devices/DeviceQrScannerModal';
import { GroupActionModal } from '../components/devices/GroupActionModal';
import { DeleteGroupConfirmModal } from '../components/devices/DeleteGroupConfirmModal';
import { DeleteDeviceConfirmModal } from '../components/devices/DeleteDeviceConfirmModal';
import { EditGroupModal } from '../components/devices/EditGroupModal';
import { DeviceAddMenuModal } from '../components/devices/DeviceAddMenuModal';
import { DeviceCardItem } from '../components/devices/DeviceCardItem';
import { DeviceGroupCard } from '../components/devices/DeviceGroupCard';

export default function DevicesScreen({ navigation }: any) {
  const { isDarkMode, colors } = useTheme();
  const { userRole, role, userPhone, phone_number, permissions } = useAuthStore();
  const {
    house,
    iotDevices,
    addIoTDevice,
    removeIoTDevice,
    deviceGroups,
    updateDeviceGroup,
    removeDeviceGroup,
    syncAllWithBackend,
  } = useVitalStore();
  const groups = deviceGroups || [];

  const hasLinkedHouse = Boolean(house?.id && house?.hasHouse !== false && house?.name && house.name.trim() !== '');
  const isOwnerOrAdmin = hasLinkedHouse && (userRole === 'admin' || role === 'admin' || permissions?.is_owner === true || permissions?.role_in_house === 'OWNER');
  const isMember = !isOwnerOrAdmin && (userRole === 'member' || !userRole || userRole === 'user' || userRole === 'caregiver');
  const isUserEmptyMember = isMember && (!hasLinkedHouse || (iotDevices.length === 0 && !permissions?.can_manage_devices));

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Đồng bộ danh sách thiết bị và nhóm từ Backend mỗi khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      syncAllWithBackend?.();
    }, [])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncAllWithBackend?.();
    } finally {
      setIsRefreshing(false);
    }
  };

  // State menu thả xuống khi bấm dấu cộng (+)
  const [showAddMenu, setShowAddMenu] = useState(false);

  // State Modal Quét mã QR
  const [showQrModal, setShowQrModal] = useState(false);

  // State Action Menu cho Nhóm (Nút 3 chấm)
  const [selectedGroupForAction, setSelectedGroupForAction] = useState<string | null>(null);
  const [showGroupActionModal, setShowGroupActionModal] = useState<boolean>(false);

  // State Modal Xác nhận Xóa Thiết Bị
  const [deviceToDelete, setDeviceToDelete] = useState<IoTDeviceItem | null>(null);

  // State Modal Xác nhận Xóa Nhóm
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);

  // State Modal Chỉnh Sửa Nhóm
  const [showEditGroupModal, setShowEditGroupModal] = useState<boolean>(false);
  const [editOldGroupName, setEditOldGroupName] = useState<string>('');
  const [editNewGroupName, setEditNewGroupName] = useState<string>('');
  const [editSelectedDeviceIds, setEditSelectedDeviceIds] = useState<string[]>([]);
  const [editDeviceFilter, setEditDeviceFilter] = useState<'Tất cả' | 'Camera' | 'Đồng hồ'>('Tất cả');
  const [editAttempted, setEditAttempted] = useState<boolean>(false);

  // State 4 Tab Bộ lọc: Tất cả, Camera, Đồng hồ, Nhóm
  type FilterTab = 'Tất cả' | 'Camera' | 'Đồng hồ' | 'Nhóm';
  const filterTabs: FilterTab[] = ['Tất cả', 'Camera', 'Đồng hồ', 'Nhóm'];
  const [activeTab, setActiveTab] = useState<FilterTab>('Tất cả');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('Tất cả');

  // Helper phân loại thiết bị ngoại vi
  const checkIsCamera = (dev: IoTDeviceItem) =>
    dev.type === 'camera' ||
    dev.name.toLowerCase().includes('camera') ||
    dev.name.includes('SECA') ||
    dev.name.includes('Ranger');

  const checkIsWatch = (dev: IoTDeviceItem) =>
    dev.type === 'band' ||
    dev.type === 'watch' ||
    dev.name.toLowerCase().includes('smartband') ||
    dev.name.toLowerCase().includes('đồng hồ');

  // Giả lập quét thành công mã QR
  const handleSimulateQrScan = (type: 'camera' | 'watch') => {
    setShowQrModal(false);
    if (type === 'camera') {
      const newCam: IoTDeviceItem = {
        id: 'cam-qr-' + Date.now(),
        name: 'SECA_001 (QR Config)',
        sub: 'Camera an ninh AI • Quét QR nhanh • 1080p FHD',
        type: 'camera',
        status: 'Trực tuyến • Đang ghi hình',
        isOnline: true,
        icon: 'videocam',
        color: '#EA580C',
        location: 'Phòng khách',
      };
      addIoTDevice(newCam);
      LocalizedAlert.alert(
        'Quét QR Thành Công',
        'Đã nhận diện thiết bị Camera SECA_001 và kích hoạt kết nối nhanh!'
      );
    } else {
      const newWatch: IoTDeviceItem = {
        id: 'watch-qr-' + Date.now(),
        name: 'Vòng đeo tay BLE Smartband',
        sub: 'Bluetooth BLE • Nhịp tim & SpO2 • MPU6050',
        type: 'band',
        status: 'Trực tuyến • Pin 98%',
        isOnline: true,
        icon: 'watch',
        color: '#10B981',
        location: 'Cụ Ông',
      };
      addIoTDevice(newWatch);
      LocalizedAlert.alert(
        'Quét QR Thành Công',
        'Đã nhận diện Vòng đeo tay thông minh BLE và hoàn tất ghép đôi!'
      );
    }
  };

  // Lọc danh sách thiết bị theo tab
  const filteredDevices = iotDevices.filter((dev) => {
    if (activeTab === 'Camera') return checkIsCamera(dev);
    if (activeTab === 'Đồng hồ') return checkIsWatch(dev);
    return true;
  });

  // Xóa thiết bị khỏi hệ thống
  const handleDeleteDevice = (device: IoTDeviceItem) => {
    setDeviceToDelete(device);
  };

  const handleConfirmDeleteDevice = () => {
    if (!deviceToDelete) return;
    const target = deviceToDelete;
    removeIoTDevice(target.id);
    setDeviceToDelete(null);
  };

  // Xử lý điều hướng khi nhấn vào thiết bị
  const handleDevicePress = (dev: IoTDeviceItem) => {
    if (checkIsCamera(dev)) {
      navigation.navigate('CameraDetail', {
        cameraId: dev.id,
        cameraName: dev.name,
        room: dev.location || dev.sub,
        streamUrl: dev.streamUrl,
      });
      return;
    }

    if (checkIsWatch(dev)) {
      navigation.navigate('SmartbandDetail', { device: dev });
      return;
    }

    LocalizedAlert.alert(dev.name, `${dev.sub}\nTrạng thái: ${dev.status}`);
  };

  // Lọc thiết bị cho modal chỉnh sửa
  const filteredEditDevices = iotDevices.filter((dev) => {
    if (editDeviceFilter === 'Camera') return checkIsCamera(dev);
    if (editDeviceFilter === 'Đồng hồ') return checkIsWatch(dev);
    return true;
  });

  const currentTabEditDeviceIds = filteredEditDevices.map((d) => d.id);
  const isAllEditTabSelected =
    currentTabEditDeviceIds.length > 0 &&
    currentTabEditDeviceIds.every((id) => editSelectedDeviceIds.includes(id));

  const toggleEditDeviceSelection = (id: string) => {
    setEditSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleEditSelectAll = () => {
    if (isAllEditTabSelected) {
      setEditSelectedDeviceIds((prev) =>
        prev.filter((id) => !currentTabEditDeviceIds.includes(id))
      );
    } else {
      setEditSelectedDeviceIds((prev) =>
        Array.from(new Set([...prev, ...currentTabEditDeviceIds]))
      );
    }
  };

  // Validation form Chỉnh sửa
  const trimmedEditName = editNewGroupName.trim();
  const isEditNameEmpty = trimmedEditName.length === 0;
  const isEditNameDuplicate =
    !isEditNameEmpty &&
    groups.some(
      (g) =>
        g.toLowerCase() !== editOldGroupName.toLowerCase() &&
        g.toLowerCase() === trimmedEditName.toLowerCase()
    );
  const isEditNameValid = !isEditNameEmpty && !isEditNameDuplicate;
  const hasEditDevices = editSelectedDeviceIds.length >= 1;
  const isEditFormValid = isEditNameValid && hasEditDevices;

  // Xử lý khi nhấn nút 3 chấm ở góc phải thẻ nhóm
  const handleOpenGroupActionMenu = (groupName: string) => {
    setSelectedGroupForAction(groupName);
    setShowGroupActionModal(true);
  };

  // Mở modal Chỉnh sửa nhóm
  const handleStartEditGroup = () => {
    if (!selectedGroupForAction) return;
    const target = selectedGroupForAction;
    setShowGroupActionModal(false);
    setEditOldGroupName(target);
    setEditNewGroupName(target);

    const devIdsInGroup = iotDevices
      .filter((d) => d.location?.toLowerCase() === target.toLowerCase())
      .map((d) => d.id);
    setEditSelectedDeviceIds(devIdsInGroup);
    setEditDeviceFilter('Tất cả');
    setEditAttempted(false);
    setShowEditGroupModal(true);
  };

  // Mở modal xác nhận Xóa nhóm
  const handlePromptDeleteGroup = () => {
    setShowGroupActionModal(false);
    setShowDeleteConfirmModal(true);
  };

  // Xác nhận Xóa nhóm
  const handleConfirmDeleteGroup = () => {
    if (!selectedGroupForAction) return;
    const targetGroup = selectedGroupForAction;
    removeDeviceGroup(targetGroup);
    if (selectedGroupFilter === targetGroup) {
      setSelectedGroupFilter('Tất cả');
    }
    setShowDeleteConfirmModal(false);
    setSelectedGroupForAction(null);
    LocalizedAlert.alert('Thành công', `Đã xóa nhóm "${targetGroup}" thành công.`);
  };

  // Lưu chỉnh sửa nhóm
  const executeSaveEditGroup = () => {
    updateDeviceGroup(editOldGroupName, trimmedEditName, editSelectedDeviceIds);
    if (selectedGroupFilter === editOldGroupName) {
      setSelectedGroupFilter(trimmedEditName);
    }
    setShowEditGroupModal(false);
    setSelectedGroupForAction(null);
    LocalizedAlert.alert('Thành công', `Đã cập nhật nhóm "${trimmedEditName}" thành công.`);
  };

  const handleSaveEditGroup = () => {
    setEditAttempted(true);
    if (isEditNameEmpty) {
      LocalizedAlert.alert('Thông báo', 'Tên nhóm không được để trống.');
      return;
    }
    if (isEditNameDuplicate) {
      LocalizedAlert.alert(
        'Thông báo',
        `Tên nhóm "${trimmedEditName}" đã tồn tại. Tên nhóm mới phải là duy nhất.`
      );
      return;
    }
    if (!hasEditDevices) {
      LocalizedAlert.alert('Thông báo', 'Cần chọn ít nhất 1 thiết bị để duy trì nhóm.');
      return;
    }

    LocalizedAlert.alert(
      'Xác nhận cập nhật',
      `Bạn có chắc chắn muốn lưu các thay đổi cho nhóm "${trimmedEditName}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Lưu thay đổi', onPress: executeSaveEditGroup },
      ]
    );
  };

  const handleCloseEditGroup = () => {
    const isDirty = trimmedEditName !== editOldGroupName;
    if (isDirty) {
      LocalizedAlert.alert(
        'Thay đổi chưa lưu',
        'Tên hoặc danh sách thiết bị đã được chỉnh sửa. Bạn có muốn lưu trước khi đóng không?',
        [
          { text: 'Tiếp tục sửa', style: 'cancel' },
          {
            text: 'Không lưu',
            style: 'destructive',
            onPress: () => {
              setShowEditGroupModal(false);
              setSelectedGroupForAction(null);
            },
          },
          { text: 'Lưu thay đổi', onPress: executeSaveEditGroup },
        ]
      );
    } else {
      setShowEditGroupModal(false);
      setSelectedGroupForAction(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, isDarkMode && { backgroundColor: colors.background }]}>
        <View>
          <LocalizedText style={[styles.headerTitle, isDarkMode && { color: colors.textPrimary }]}>Thiết bị</LocalizedText>
          <LocalizedText style={[styles.headerSubtitleTop, isDarkMode && { color: colors.textSecondary }]}>
            {iotDevices.length} thiết bị đang kết nối
          </LocalizedText>
        </View>

        <View style={styles.headerRightActions}>
          {/* Nút dấu cộng (+) */}
          <TouchableOpacity
            style={[styles.addBtn, showAddMenu && styles.addBtnActive]}
            onPress={() => setShowAddMenu(!showAddMenu)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showAddMenu ? 'close' : 'add'}
              size={24}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4 Tabs Phân Loại */}
      <View style={styles.tabContainer}>
        {filterTabs.map((tab) => {
          const isActive = activeTab === tab;
          let count = 0;
          if (tab === 'Tất cả') count = iotDevices.length;
          else if (tab === 'Camera') count = iotDevices.filter(checkIsCamera).length;
          else if (tab === 'Đồng hồ') count = iotDevices.filter(checkIsWatch).length;
          else if (tab === 'Nhóm') count = groups.length;

          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                isActive && styles.tabButtonActive,
                isActive && isDarkMode && { backgroundColor: colors.primary },
                !isActive && isDarkMode && { backgroundColor: colors.surfaceSubtle },
              ]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <LocalizedText
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                  !isActive && isDarkMode && { color: colors.textSecondary },
                ]}
              >
                {tab}
              </LocalizedText>
              <View
                style={[
                  styles.tabBadge,
                  isActive && styles.tabBadgeActive,
                  !isActive && isDarkMode && { backgroundColor: 'rgba(255,255,255,0.08)' },
                ]}
              >
                <LocalizedText
                  style={[
                    styles.tabBadgeText,
                    isActive && styles.tabBadgeTextActive,
                    !isActive && isDarkMode && { color: colors.textSecondary },
                  ]}
                >
                  {count}
                </LocalizedText>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Danh Sách Cuộn */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#0284C7']}
            tintColor={isDarkMode ? '#38BDF8' : '#0284C7'}
          />
        }
      >
        <LocalizedText style={[styles.sectionSubtitle, isDarkMode && { color: colors.textSecondary }]}>
          {activeTab === 'Nhóm'
            ? 'Danh sách các khu vực và phòng được thiết lập'
            : `Danh sách các thiết bị ${activeTab.toLowerCase()} đã ghép nối`}
        </LocalizedText>

        {isUserEmptyMember ? (
          <View style={styles.emptyMemberContainer}>
            <View style={[styles.emptyIconCircle, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Ionicons name="hardware-chip-outline" size={54} color={isDarkMode ? '#64748B' : '#94A3B8'} />
            </View>
            <Text style={[styles.emptyMemberTitle, { color: colors.textPrimary }]}>
              Chưa có thiết bị theo dõi
            </Text>
            <Text style={[styles.emptyMemberSubtitle, { color: colors.textSecondary }]}>
              Tài khoản thành viên mới chưa được liên kết với bất kỳ căn nhà hay thiết bị theo dõi nào. Sau khi được Chủ hộ thêm số điện thoại ({userPhone || phone_number || 'của bạn'}) vào nhà, các thiết bị giám sát (Camera AI, Vòng đeo tay...) sẽ tự động xuất hiện tại đây.
            </Text>
            <TouchableOpacity
              style={styles.refreshMemberBtn}
              onPress={() => syncAllWithBackend?.()}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.refreshMemberBtnText}>Kiểm tra & Làm mới</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'Nhóm' ? (
          <View style={styles.groupViewSection}>
            <View style={[styles.groupHeaderBar, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.groupHeaderLeft}>
                <LocalizedText style={[styles.groupHeaderTitle, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
                  Phân vùng theo nhóm
                </LocalizedText>
                <LocalizedText style={[styles.groupHeaderSub, isDarkMode && { color: colors.textSecondary }]} numberOfLines={1}>
                  {groups.length} nhóm khu vực trong nhà
                </LocalizedText>
              </View>
              <TouchableOpacity
                style={styles.createGroupHeaderBtn}
                onPress={() => navigation.navigate('CreateGroup')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFF" />
                <LocalizedText style={styles.createGroupHeaderBtnText}>Tạo nhóm mới</LocalizedText>
              </TouchableOpacity>
            </View>

            {/* Thanh lọc các nhóm đã lập */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subGroupChipsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.subGroupChip,
                  isDarkMode && selectedGroupFilter !== 'Tất cả' && { backgroundColor: colors.card, borderColor: colors.border },
                  selectedGroupFilter === 'Tất cả' && styles.subGroupChipActive,
                ]}
                onPress={() => setSelectedGroupFilter('Tất cả')}
                activeOpacity={0.8}
              >
                <LocalizedText
                  style={[
                    styles.subGroupChipText,
                    isDarkMode && selectedGroupFilter !== 'Tất cả' && { color: '#C084FC' },
                    selectedGroupFilter === 'Tất cả' && styles.subGroupChipTextActive,
                  ]}
                >
                  Tất cả nhóm ({groups.length})
                </LocalizedText>
              </TouchableOpacity>

              {groups.map((g) => {
                const count = iotDevices.filter(
                  (d) => d.location?.toLowerCase() === g.toLowerCase()
                ).length;
                const isSelected = selectedGroupFilter === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.subGroupChip,
                      isDarkMode && !isSelected && { backgroundColor: colors.card, borderColor: colors.border },
                      isSelected && styles.subGroupChipActive,
                    ]}
                    onPress={() => setSelectedGroupFilter(g)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="folder-outline"
                      size={13}
                      color={isSelected ? '#FFF' : '#7C3AED'}
                      style={{ marginRight: 4 }}
                    />
                    <LocalizedText
                      style={[
                        styles.subGroupChipText,
                        isDarkMode && !isSelected && { color: '#C084FC' },
                        isSelected && styles.subGroupChipTextActive,
                      ]}
                    >
                      {g} ({count})
                    </LocalizedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Hiển thị các nhóm thiết bị đã lập */}
            {(selectedGroupFilter === 'Tất cả'
              ? groups
              : groups.filter((g) => g === selectedGroupFilter)
            ).map((groupName) => {
              const devicesInGroup = iotDevices.filter(
                (dev) => dev.location?.toLowerCase() === groupName.toLowerCase()
              );

              return (
                <DeviceGroupCard
                  key={groupName}
                  groupName={groupName}
                  devicesInGroup={devicesInGroup}
                  onDevicePress={handleDevicePress}
                  onDeviceDelete={handleDeleteDevice}
                  onOpenGroupActionMenu={handleOpenGroupActionMenu}
                  isDarkMode={isDarkMode}
                  colors={colors}
                />
              );
            })}
          </View>
        ) : (
          <>
            {filteredDevices.map((dev) => (
              <DeviceCardItem
                key={dev.id}
                device={dev}
                onPress={handleDevicePress}
                onDelete={handleDeleteDevice}
                isDarkMode={isDarkMode}
                colors={colors}
              />
            ))}

            {filteredDevices.length === 0 && (
              <View style={styles.emptyGroupContainer}>
                <Ionicons name="layers-outline" size={44} color={isDarkMode ? '#475569' : '#CBD5E1'} />
                <LocalizedText style={[styles.emptyGroupTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Không có thiết bị trong nhóm này
                </LocalizedText>
                <LocalizedText style={[styles.emptyGroupDesc, isDarkMode && { color: colors.textSecondary }]}>
                  Bấm nút (+) ở góc trên để thêm thiết bị mới vào danh mục "{activeTab}".
                </LocalizedText>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Menu thả xuống khi bấm dấu cộng (+) */}
      <DeviceAddMenuModal
        visible={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onSelectManual={() => {
          setShowAddMenu(false);
          navigation.navigate('AddDevice');
        }}
        onSelectQr={() => {
          setShowAddMenu(false);
          setShowQrModal(true);
        }}
        onSelectGroup={() => {
          setShowAddMenu(false);
          navigation.navigate('CreateGroup');
        }}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal 2: Quét mã QR */}
      <DeviceQrScannerModal
        visible={showQrModal}
        onClose={() => setShowQrModal(false)}
        onSimulateScan={handleSimulateQrScan}
      />

      {/* Modal 3: Menu Tùy chọn Nhóm (3 chấm) */}
      <GroupActionModal
        visible={showGroupActionModal}
        groupName={selectedGroupForAction}
        onClose={() => setShowGroupActionModal(false)}
        onEdit={handleStartEditGroup}
        onDelete={handlePromptDeleteGroup}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal 4: Xác nhận Xóa Nhóm */}
      <DeleteGroupConfirmModal
        visible={showDeleteConfirmModal}
        groupName={selectedGroupForAction}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirmDelete={handleConfirmDeleteGroup}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal 4B: Xác nhận Xóa Thiết Bị */}
      <DeleteDeviceConfirmModal
        visible={!!deviceToDelete}
        device={deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        onConfirmDelete={handleConfirmDeleteDevice}
        isDarkMode={isDarkMode}
        colors={colors}
      />

      {/* Modal 5: Chỉnh sửa Nhóm */}
      <EditGroupModal
        visible={showEditGroupModal}
        editOldGroupName={editOldGroupName}
        editNewGroupName={editNewGroupName}
        setEditNewGroupName={setEditNewGroupName}
        isEditNameEmpty={isEditNameEmpty}
        isEditNameDuplicate={isEditNameDuplicate}
        isEditNameValid={isEditNameValid}
        editAttempted={editAttempted}
        editDeviceFilter={editDeviceFilter}
        setEditDeviceFilter={setEditDeviceFilter}
        allDevicesCount={iotDevices.length}
        filteredEditDevices={filteredEditDevices}
        editSelectedDeviceIds={editSelectedDeviceIds}
        isAllEditTabSelected={isAllEditTabSelected}
        onToggleSelectAll={handleToggleEditSelectAll}
        onToggleDevice={toggleEditDeviceSelection}
        onClose={handleCloseEditGroup}
        onSave={handleSaveEditGroup}
        isEditFormValid={isEditFormValid}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitleTop: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  addBtnActive: {
    backgroundColor: '#0F172A',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  scrollList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    marginTop: 4,
  },
  groupViewSection: {
    marginTop: 2,
  },
  groupHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    marginBottom: 12,
    ...Shadows.sm,
  },
  groupHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  groupHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  groupHeaderSub: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
  },
  createGroupHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...Shadows.sm,
  },
  createGroupHeaderBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  subGroupChipsScroll: {
    paddingBottom: 14,
    gap: 8,
  },
  subGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    ...Shadows.sm,
  },
  subGroupChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  subGroupChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
  },
  subGroupChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyGroupContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 12,
  },
  emptyGroupDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  emptyMemberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyMemberTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyMemberSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    ...Shadows.sm,
  },
  refreshMemberBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

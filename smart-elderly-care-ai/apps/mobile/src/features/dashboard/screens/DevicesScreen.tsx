// DevicesScreen.tsx
// Màn hình Quản lý phần cứng và Thiết bị IoT (Tab 2 - Thiết bị)
// Thể hiện toàn bộ danh mục phần cứng trong Proposal Capstone 1 (Orange Pi 5, AMG8833, BLE Band, Camera)
// Hỗ trợ Menu 3 lựa chọn khi nhấn nút (+): Thêm thủ công, Quét mã QR, Nhóm thiết bị

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Animated,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore, IoTDeviceItem } from '../../../store/useVitalStore';

export default function DevicesScreen({ navigation }: any) {
  const {
    iotDevices,
    addIoTDevice,
    deviceGroups,
    updateDeviceGroup,
    removeDeviceGroup,
  } = useVitalStore();
  const groups = deviceGroups || ['Phòng khách', 'Phòng ngủ', 'Nhà tắm & Cửa'];

  // State menu thả xuống khi bấm dấu cộng (+)
  const [showAddMenu, setShowAddMenu] = useState(false);

  // State Modal Quét mã QR
  const [showQrModal, setShowQrModal] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const laserAnim = useRef(new Animated.Value(0)).current;

  // State Action Menu cho Nhóm (Nút 3 chấm)
  const [selectedGroupForAction, setSelectedGroupForAction] = useState<string | null>(null);
  const [showGroupActionModal, setShowGroupActionModal] = useState<boolean>(false);

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

  // Animation tia laser quét QR
  useEffect(() => {
    if (showQrModal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 220,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [showQrModal]);

  // Helper phân loại thiết bị
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
      Alert.alert(
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
      Alert.alert(
        'Quét QR Thành Công',
        'Đã nhận diện Vòng đeo tay thông minh BLE và hoàn tất ghép đôi!'
      );
    }
  };

  // Lọc danh sách thiết bị theo 4 tab: Tất cả, Camera, Đồng hồ, Nhóm
  const filteredDevices = iotDevices.filter((dev) => {
    if (activeTab === 'Tất cả') return true;
    if (activeTab === 'Camera') return checkIsCamera(dev);
    if (activeTab === 'Đồng hồ') return checkIsWatch(dev);
    // Tab 'Nhóm': Hiển thị tất cả nhưng có phân vùng nhóm
    return true;
  });

  // Xử lý khi nhấn vào thẻ thiết bị (Camera -> CameraDetail, Đồng hồ -> SmartbandDetail)
  const handleDevicePress = (dev: IoTDeviceItem) => {
    if (checkIsCamera(dev)) {
      navigation.navigate('CameraDetail');
    } else if (checkIsWatch(dev)) {
      navigation.navigate('SmartbandDetail', { device: dev });
    } else {
      Alert.alert(dev.name, `${dev.sub}\nTrạng thái: ${dev.status}`);
    }
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
    Alert.alert('Thành công', `Đã xóa nhóm "${targetGroup}" thành công.`);
  };

  // Lưu chỉnh sửa nhóm
  const handleSaveEditGroup = () => {
    setEditAttempted(true);
    if (isEditNameEmpty) {
      Alert.alert('Thông báo', 'Tên nhóm không được để trống.');
      return;
    }
    if (isEditNameDuplicate) {
      Alert.alert(
        'Thông báo',
        `Tên nhóm "${trimmedEditName}" đã tồn tại. Tên nhóm mới phải là duy nhất.`
      );
      return;
    }
    if (!hasEditDevices) {
      Alert.alert('Thông báo', 'Cần chọn ít nhất 1 thiết bị để duy trì nhóm.');
      return;
    }

    updateDeviceGroup(editOldGroupName, trimmedEditName, editSelectedDeviceIds);
    if (selectedGroupFilter === editOldGroupName) {
      setSelectedGroupFilter(trimmedEditName);
    }
    setShowEditGroupModal(false);
    setSelectedGroupForAction(null);
    Alert.alert('Thành công', `Đã cập nhật nhóm "${trimmedEditName}" thành công.`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Thiết bị</Text>
          <Text style={styles.headerSubtitleTop}>
            {iotDevices.length} thiết bị đang kết nối
          </Text>
        </View>

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

      {/* Thanh tab bộ lọc 4 mục: Tất cả, Camera, Đồng hồ, Nhóm */}
      <View style={styles.groupTabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupTabsContainer}
        >
          {filterTabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.groupChip,
                activeTab === tab && styles.groupChipActive,
              ]}
              onPress={() => {
                setActiveTab(tab);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.groupChipText,
                  activeTab === tab && styles.groupChipTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionSubtitle}>
          {activeTab === 'Nhóm'
            ? 'Danh sách các nhóm khu vực đã thiết lập trong nhà'
            : 'Hệ sinh thái giám sát đa phương thức (Multimodal Sensor Fusion)'}
        </Text>

        {activeTab === 'Nhóm' ? (
          <View style={styles.groupViewSection}>
            {/* Thanh tiêu đề & nút tạo nhóm mới */}
            <View style={styles.groupHeaderBar}>
              <View>
                <Text style={styles.groupHeaderTitle}>Phân vùng thiết bị theo nhóm</Text>
                <Text style={styles.groupHeaderSub}>{groups.length} nhóm khu vực trong nhà</Text>
              </View>
              <TouchableOpacity
                style={styles.createGroupHeaderBtn}
                onPress={() => navigation.navigate('CreateGroup')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={styles.createGroupHeaderBtnText}>Tạo nhóm mới</Text>
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
                  selectedGroupFilter === 'Tất cả' && styles.subGroupChipActive,
                ]}
                onPress={() => setSelectedGroupFilter('Tất cả')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.subGroupChipText,
                    selectedGroupFilter === 'Tất cả' && styles.subGroupChipTextActive,
                  ]}
                >
                  Tất cả nhóm ({groups.length})
                </Text>
              </TouchableOpacity>

              {groups.map((g) => {
                const count = iotDevices.filter(
                  (d) => d.location?.toLowerCase() === g.toLowerCase()
                ).length;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.subGroupChip,
                      selectedGroupFilter === g && styles.subGroupChipActive,
                    ]}
                    onPress={() => setSelectedGroupFilter(g)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="folder-outline"
                      size={13}
                      color={selectedGroupFilter === g ? '#FFF' : '#7C3AED'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.subGroupChipText,
                        selectedGroupFilter === g && styles.subGroupChipTextActive,
                      ]}
                    >
                      {g} ({count})
                    </Text>
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
              const onlineCount = devicesInGroup.filter((d) => d.isOnline).length;

              return (
                <View key={groupName} style={styles.groupCardWrapper}>
                  {/* Tiêu đề nhóm */}
                  <View style={styles.groupCardHeader}>
                    <View style={styles.groupCardHeaderLeft}>
                      <View style={styles.groupFolderIconBox}>
                        <Ionicons name="folder" size={18} color="#7C3AED" />
                      </View>
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.groupCardName}>{groupName}</Text>
                        <Text style={styles.groupCardMeta}>
                          {devicesInGroup.length} thiết bị • {onlineCount} trực tuyến
                        </Text>
                      </View>
                    </View>

                    <View style={styles.groupCardHeaderRight}>
                      <View style={styles.groupCountBadge}>
                        <Text style={styles.groupCountBadgeText}>
                          {devicesInGroup.length} thiết bị
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.groupMoreBtn}
                        onPress={() => handleOpenGroupActionMenu(groupName)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Danh sách thiết bị trong nhóm */}
                  {devicesInGroup.length > 0 ? (
                    <View style={styles.groupDeviceList}>
                      {devicesInGroup.map((dev, idx) => (
                        <TouchableOpacity
                          key={dev.id}
                          style={[
                            styles.deviceItemInGroup,
                            idx > 0 && styles.deviceItemInGroupDivider,
                          ]}
                          onPress={() => handleDevicePress(dev)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.iconBoxSmall,
                              { backgroundColor: `${dev.color}18` },
                            ]}
                          >
                            <Ionicons
                              name={dev.icon as any}
                              size={20}
                              color={dev.color}
                            />
                          </View>

                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.deviceNameText}>{dev.name}</Text>
                            <Text
                              style={styles.deviceSubText}
                              numberOfLines={1}
                            >
                              {dev.sub}
                            </Text>
                            <View style={styles.statusRow}>
                              <View
                                style={[
                                  styles.statusDot,
                                  {
                                    backgroundColor: dev.isOnline
                                      ? Colors.success
                                      : Colors.danger,
                                  },
                                ]}
                              />
                              <Text style={styles.statusText}>{dev.status}</Text>
                            </View>
                          </View>

                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#CBD5E1"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyGroupContent}>
                      <Ionicons name="cube-outline" size={24} color="#94A3B8" />
                      <Text style={styles.emptyGroupContentText}>
                        Chưa có thiết bị nào trong nhóm "{groupName}"
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <>
            {filteredDevices.map((dev) => (
              <TouchableOpacity
                key={dev.id}
                style={styles.deviceCard}
                onPress={() => handleDevicePress(dev)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: `${dev.color}18` }]}>
                  <Ionicons name={dev.icon as any} size={24} color={dev.color} />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.deviceNameText}>{dev.name}</Text>
                  <Text style={styles.deviceSubText} numberOfLines={2}>
                    {dev.sub}
                  </Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: dev.isOnline ? Colors.success : Colors.danger },
                      ]}
                    />
                    <Text style={styles.statusText}>{dev.status}</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            ))}

            {filteredDevices.length === 0 && (
              <View style={styles.emptyGroupContainer}>
                <Ionicons name="layers-outline" size={44} color="#CBD5E1" />
                <Text style={styles.emptyGroupTitle}>Không có thiết bị trong nhóm này</Text>
                <Text style={styles.emptyGroupDesc}>
                  Bấm nút (+) ở góc trên để thêm thiết bị mới vào danh mục "{activeTab}".
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ============================================================== */}
      {/* Ô NHỎ THẢ XUỐNG KHI BẤM DẤU CỘNG (+) GỒM 3 LỰA CHỌN           */}
      {/* 1. Thêm thủ công, 2. Quét mã QR, 3. Nhóm                      */}
      {/* ============================================================== */}
      {showAddMenu && (
        <TouchableWithoutFeedback onPress={() => setShowAddMenu(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.floatingMenuCard}>
                <View style={styles.menuHeaderIndicator}>
                  <Text style={styles.menuHeaderLabel}>Tùy chọn thiết bị</Text>
                </View>

                {/* 1. Thêm thủ công */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowAddMenu(false);
                    navigation.navigate('AddDevice');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuItemIconBox, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name="construct-outline" size={20} color="#EA580C" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemTitle}>Thêm thủ công</Text>
                    <Text style={styles.menuItemDesc}>Camera Wi-Fi, Đồng hồ BLE, IoT Hub</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                {/* 2. Quét mã QR */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowAddMenu(false);
                    setShowQrModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuItemIconBox, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="qr-code-outline" size={20} color="#0284C7" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemTitle}>Quét mã QR</Text>
                    <Text style={styles.menuItemDesc}>Quét tem QR trên thân camera/vòng tay</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                {/* 3. Nhóm */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowAddMenu(false);
                    navigation.navigate('CreateGroup');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuItemIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="layers-outline" size={20} color="#7C3AED" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemTitle}>Nhóm thiết bị</Text>
                    <Text style={styles.menuItemDesc}>Tạo & quản lý nhóm phòng, người đeo</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: Quét mã QR (QR Code Scanner)                          */}
      {/* ============================================================== */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.qrModalContainer}>
          <SafeAreaView style={styles.qrModalSafeArea}>
            {/* Header Scanner */}
            <View style={styles.qrHeader}>
              <TouchableOpacity
                style={styles.qrCloseBtn}
                onPress={() => setShowQrModal(false)}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.qrHeaderTitle}>Quét Mã QR Thiết Bị</Text>
              <TouchableOpacity
                style={styles.qrFlashBtn}
                onPress={() => setIsFlashOn(!isFlashOn)}
              >
                <Ionicons
                  name={isFlashOn ? 'flash' : 'flash-off'}
                  size={20}
                  color={isFlashOn ? '#FBBF24' : '#FFF'}
                />
              </TouchableOpacity>
            </View>

            {/* Viewfinder Khung quét */}
            <View style={styles.qrViewfinderWrapper}>
              <View style={styles.qrViewfinder}>
                {/* 4 Góc khung quét */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Tia laser chạy lên xuống */}
                <Animated.View
                  style={[
                    styles.qrLaserLine,
                    {
                      transform: [{ translateY: laserAnim }],
                    },
                  ]}
                />

                <Ionicons name="scan-outline" size={80} color="rgba(255,255,255,0.2)" />
              </View>

              <Text style={styles.qrGuideText}>
                Căn chỉnh mã QR ở mặt đáy Camera{' '}
                <Text style={{ fontWeight: 'bold', color: '#38BDF8' }}>SECA_001</Text> hoặc mặt sau{' '}
                <Text style={{ fontWeight: 'bold', color: '#34D399' }}>Vòng đeo tay BLE</Text> vào trong khung hình.
              </Text>
            </View>

            {/* Các nút bấm mô phỏng kiểm thử nhanh */}
            <View style={styles.qrBottomBar}>
              <Text style={styles.qrSimLabel}>Hoặc chọn mô phỏng quét thực tế:</Text>
              <View style={styles.qrSimRow}>
                <TouchableOpacity
                  style={[styles.qrSimBtn, { backgroundColor: '#EA580C' }]}
                  onPress={() => handleSimulateQrScan('camera')}
                >
                  <Ionicons name="videocam" size={18} color="#FFF" />
                  <Text style={styles.qrSimBtnText}>Quét Camera SECA_001</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.qrSimBtn, { backgroundColor: '#059669' }]}
                  onPress={() => handleSimulateQrScan('watch')}
                >
                  <Ionicons name="watch" size={18} color="#FFF" />
                  <Text style={styles.qrSimBtnText}>Quét Vòng Tay BLE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: Menu Tùy chọn Nhóm (Chỉnh sửa / Xóa)                  */}
      {/* ============================================================== */}
      <Modal
        visible={showGroupActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupActionModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowGroupActionModal(false)}>
          <View style={styles.actionModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.actionModalCard}>
                {/* Header action modal */}
                <View style={styles.actionModalHeader}>
                  <View style={styles.actionModalIconBox}>
                    <Ionicons name="folder" size={22} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionModalSubtitle}>TÙY CHỌN NHÓM THIẾT BỊ</Text>
                    <Text style={styles.actionModalTitle}>{selectedGroupForAction}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.actionModalCloseBtn}
                    onPress={() => setShowGroupActionModal(false)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.actionMenuDivider} />

                {/* Option 1: Chỉnh sửa */}
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={handleStartEditGroup}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionMenuIconCircle, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="create-outline" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.actionMenuText}>Chỉnh sửa</Text>
                    <Text style={styles.actionMenuSub}>
                      Đổi tên nhóm hoặc thay đổi các thiết bị thuộc nhóm
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>

                <View style={styles.actionMenuDivider} />

                {/* Option 2: Xóa */}
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={handlePromptDeleteGroup}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionMenuIconCircle, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.actionMenuText, { color: '#DC2626' }]}>
                      Xóa
                    </Text>
                    <Text style={styles.actionMenuSub}>
                      Xóa nhóm này, thiết bị sẽ chuyển về trạng thái Chưa nhóm
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>

                <View style={styles.actionMenuDivider} />

                {/* Nút Đóng */}
                <TouchableOpacity
                  style={styles.actionCancelBtn}
                  onPress={() => setShowGroupActionModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionCancelBtnText}>Hủy bỏ</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 4: Xác nhận Xóa Nhóm                                    */}
      {/* ============================================================== */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDeleteConfirmModal(false)}>
          <View style={styles.confirmModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.confirmModalCard}>
                <View style={styles.confirmModalIconRing}>
                  <Ionicons name="trash" size={32} color="#EF4444" />
                </View>
                <Text style={styles.confirmModalTitle}>Xác Nhận Xóa Nhóm?</Text>
                <Text style={styles.confirmModalDesc}>
                  Bạn có chắc chắn muốn xóa nhóm{' '}
                  <Text style={{ fontWeight: '800', color: '#1E1B4B' }}>
                    "{selectedGroupForAction}"
                  </Text>
                  ?{'\n\n'}
                  Các thiết bị trong nhóm sẽ{' '}
                  <Text style={{ fontWeight: '700', color: '#16A34A' }}>không bị xóa</Text> mà
                  được tự động chuyển về trạng thái{' '}
                  <Text style={{ fontWeight: '700', color: '#7C3AED' }}>"Chưa nhóm"</Text>.
                </Text>

                <View style={styles.confirmModalActions}>
                  <TouchableOpacity
                    style={styles.confirmModalCancelBtn}
                    onPress={() => setShowDeleteConfirmModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmModalCancelBtnText}>Hủy bỏ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmModalDeleteBtn}
                    onPress={handleConfirmDeleteGroup}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FFF" />
                    <Text style={styles.confirmModalDeleteBtnText}>Xóa nhóm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 5: Chỉnh sửa Nhóm (Đổi tên & Quản lý thiết bị)           */}
      {/* ============================================================== */}
      <Modal
        visible={showEditGroupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditGroupModal(false)}
      >
        <SafeAreaView style={styles.editModalSafeArea}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity
              style={styles.editModalCloseBtn}
              onPress={() => setShowEditGroupModal(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.editModalTitle}>Chỉnh Sửa Nhóm</Text>
              <Text style={styles.editModalSubtitle}>
                Đổi tên và phân công thiết bị cho nhóm
              </Text>
            </View>
          </View>

          <ScrollView style={styles.editModalBody} showsVerticalScrollIndicator={false}>
            {/* Card 1: Tên nhóm */}
            <View style={styles.editSectionCard}>
              <View style={styles.editSectionHeader}>
                <View style={[styles.editIconBox, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="folder-outline" size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.editSectionTitle}>1. Tên nhóm *</Text>
                  <Text style={styles.editSectionSub}>
                    Duy nhất và không được để trống
                  </Text>
                </View>
                {isEditNameValid && (
                  <View style={styles.editValidBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.editValidBadgeText}>Hợp lệ</Text>
                  </View>
                )}
              </View>

              <TextInput
                style={[
                  styles.editTextInput,
                  isEditNameDuplicate || (editAttempted && isEditNameEmpty)
                    ? styles.editTextInputError
                    : isEditNameValid
                    ? styles.editTextInputValid
                    : null,
                ]}
                value={editNewGroupName}
                onChangeText={(t) => {
                  setEditNewGroupName(t);
                  if (editAttempted) setEditAttempted(false);
                }}
                placeholder="Nhập tên nhóm..."
                placeholderTextColor="#94A3B8"
              />

              {isEditNameDuplicate && (
                <View style={styles.editFeedbackRow}>
                  <Ionicons name="close-circle" size={15} color="#DC2626" />
                  <Text style={styles.editFeedbackError}>
                    Tên nhóm "{trimmedEditName}" đã tồn tại. Tên nhóm phải là duy nhất!
                  </Text>
                </View>
              )}
              {editAttempted && isEditNameEmpty && (
                <View style={styles.editFeedbackRow}>
                  <Ionicons name="alert-circle" size={15} color="#DC2626" />
                  <Text style={styles.editFeedbackError}>
                    Tên nhóm không được để trống!
                  </Text>
                </View>
              )}
            </View>

            {/* Card 2: Thiết bị trong nhóm */}
            <View style={styles.editSectionCard}>
              <View style={styles.editSectionHeader}>
                <View style={[styles.editIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="hardware-chip-outline" size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.editSectionTitle}>2. Thiết bị thuộc nhóm *</Text>
                  <Text
                    style={[
                      styles.editSectionSub,
                      !hasEditDevices && editAttempted && styles.editSectionSubError,
                    ]}
                  >
                    {!hasEditDevices
                      ? 'Cần ít nhất 1 thiết bị để duy trì nhóm'
                      : `Đã chọn ${editSelectedDeviceIds.length} / ${iotDevices.length} thiết bị`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editSelectAllBtn}
                  onPress={handleToggleEditSelectAll}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editSelectAllBtnText}>
                    {isAllEditTabSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Warning banner nếu 0 thiết bị */}
              {!hasEditDevices && editAttempted && (
                <View style={styles.editWarningBanner}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.editWarningText}>
                    Cần có ít nhất 1 thiết bị mới duy trì nhóm được. Vui lòng chọn thiết bị!
                  </Text>
                </View>
              )}

              {/* 3 Tab lọc thiết bị */}
              <View style={styles.editFilterTabsRow}>
                {(['Tất cả', 'Camera', 'Đồng hồ'] as const).map((tab) => {
                  const isActive = editDeviceFilter === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.editFilterTab, isActive && styles.editFilterTabActive]}
                      onPress={() => setEditDeviceFilter(tab)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.editFilterTabText,
                          isActive && styles.editFilterTabTextActive,
                        ]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Danh sách thiết bị */}
              <View style={styles.editDeviceList}>
                {filteredEditDevices.map((dev) => {
                  const isSelected = editSelectedDeviceIds.includes(dev.id);
                  return (
                    <TouchableOpacity
                      key={dev.id}
                      style={[
                        styles.editDeviceCard,
                        isSelected && styles.editDeviceCardSelected,
                      ]}
                      onPress={() => toggleEditDeviceSelection(dev.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isSelected ? '#7C3AED' : '#94A3B8'}
                        style={{ marginRight: 10 }}
                      />
                      <View
                        style={[
                          styles.iconBoxSmall,
                          { backgroundColor: `${dev.color}18` },
                        ]}
                      >
                        <Ionicons name={dev.icon as any} size={18} color={dev.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.editDeviceName} numberOfLines={1}>
                          {dev.name}
                        </Text>
                        <Text style={styles.editDeviceSub} numberOfLines={1}>
                          Vị trí hiện tại:{' '}
                          <Text style={{ fontWeight: '700', color: '#475569' }}>
                            {dev.location || 'Chưa nhóm'}
                          </Text>
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: dev.isOnline ? Colors.success : '#CBD5E1' },
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.editModalFooter}>
            <TouchableOpacity
              style={styles.editModalCancelBtn}
              onPress={() => setShowEditGroupModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.editModalCancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.editModalSaveBtn,
                !isEditFormValid && styles.editModalSaveBtnDisabled,
              ]}
              onPress={handleSaveEditGroup}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={18} color="#FFF" />
              <Text style={styles.editModalSaveBtnText}>Lưu Thay Đổi</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  headerSubtitleTop: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  addBtnActive: {
    backgroundColor: '#0F172A',
  },

  // Group Tabs Bar
  groupTabsWrapper: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  groupTabsContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  groupChipActive: {
    backgroundColor: '#EA580C',
  },
  groupChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  groupChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  addGroupIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    gap: 4,
  },
  addGroupIconText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },

  // Main scroll list
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...Shadows.card,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  deviceSubText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptyGroupContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptyGroupDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // =========================================================
  // Floating Dropdown Menu (Ô nhỏ 3 lựa chọn)
  // =========================================================
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    zIndex: 999,
  },
  floatingMenuCard: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 270,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuHeaderIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  menuHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  menuItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 10,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuItemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 8,
  },

  // =========================================================
  // QR Scanner Modal
  // =========================================================
  qrModalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  qrModalSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  qrCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHeaderTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  qrFlashBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrViewfinderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  qrViewfinder: {
    width: 240,
    height: 240,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  qrLaserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  qrGuideText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  qrBottomBar: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  qrSimLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  qrSimRow: {
    flexDirection: 'row',
    gap: 10,
  },
  qrSimBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  qrSimBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // =========================================================
  // Group Header Bar (Tab "Nhóm")
  // =========================================================
  groupHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    ...Shadows.card,
  },
  groupHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  createGroupHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  createGroupHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },

  // =========================================================
  // Group View (Tab "Nhóm") Styles
  // =========================================================
  groupViewSection: {
    gap: 12,
  },
  subGroupChipsScroll: {
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
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
    color: '#FFF',
    fontWeight: '700',
  },
  groupCardWrapper: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 14,
    ...Shadows.card,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAF5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8FF',
  },
  groupCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupFolderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  groupCardMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  groupCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
  },
  groupCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  groupDeviceList: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  deviceItemInGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  deviceItemInGroupDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  iconBoxSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGroupContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyGroupContentText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    fontStyle: 'italic',
  },

  groupCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupMoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },

  // Action Modal (3 chấm)
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  actionModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    ...Shadows.card,
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionModalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionModalSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  actionModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionMenuIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  actionMenuSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionCancelBtn: {
    marginTop: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionCancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },

  // Confirm Delete Modal
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...Shadows.card,
  },
  confirmModalIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 8,
  },
  confirmModalDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  confirmModalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmModalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmModalDeleteBtn: {
    flex: 1.2,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 6,
  },
  confirmModalDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },

  // Edit Modal
  editModalSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editModalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  editModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  editModalBody: {
    flex: 1,
    padding: 16,
  },
  editSectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...Shadows.card,
  },
  editSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  editIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  editSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  editSectionSubError: {
    color: '#DC2626',
    fontWeight: '700',
  },
  editValidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  editValidBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  editTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  editTextInputValid: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  editTextInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  editFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  editFeedbackError: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  editSelectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
  },
  editSelectAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  editWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  editWarningText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
  },
  editFilterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  editFilterTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  editFilterTabActive: {
    backgroundColor: '#7C3AED',
  },
  editFilterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  editFilterTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  editDeviceList: {
    gap: 8,
  },
  editDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  editDeviceCardSelected: {
    borderColor: '#DDD6FE',
    backgroundColor: '#FAF5FF',
  },
  editDeviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  editDeviceSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  editModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  editModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  editModalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  editModalSaveBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    gap: 6,
    ...Shadows.card,
  },
  editModalSaveBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.85,
  },
  editModalSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

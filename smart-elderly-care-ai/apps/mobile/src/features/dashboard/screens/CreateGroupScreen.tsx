// CreateGroupScreen.tsx
// Màn hình Quản lý & Tạo Nhóm Thiết Bị dạng nhiều trang (Full Screen Multi-Step Flow)
// Tương tự AddDeviceScreen (Thêm thủ công): SELECT -> REVIEW -> CONFIRM -> SUCCESS

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore, IoTDeviceItem } from '../../../store/useVitalStore';

type GroupStep = 'SELECT' | 'REVIEW' | 'CONFIRM' | 'SUCCESS';
type GroupDeviceFilter = 'Tất cả' | 'Camera' | 'Đồng hồ';

export default function CreateGroupScreen({ navigation }: any) {
  const { iotDevices, deviceGroups, addDeviceGroup, assignDevicesToGroup } = useVitalStore();

  const [currentStep, setCurrentStep] = useState<GroupStep>('SELECT');
  const [groupName, setGroupName] = useState<string>('');
  const [deviceFilter, setDeviceFilter] = useState<GroupDeviceFilter>('Tất cả');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [createdGroupName, setCreatedGroupName] = useState<string>('');
  const [hasAttemptedProceed, setHasAttemptedProceed] = useState<boolean>(false);

  // Danh sách tất cả các nhóm hiện có (cả từ store và từ location của thiết bị)
  const existingGroups = Array.from(
    new Set([
      ...(deviceGroups || []),
      ...iotDevices.map((d) => d.location).filter((loc): loc is string => Boolean(loc)),
    ])
  );

  // Kiểm tra 3 điều kiện:
  // 1. Không được bỏ trống
  // 2. Tên nhóm mới là duy nhất (không phân biệt chữ hoa/thường)
  // 3. Có ít nhất 1 thiết bị mới thành lập nhóm
  const trimmedName = groupName.trim();
  const isNameEmpty = trimmedName.length === 0;
  const isDuplicateName =
    !isNameEmpty &&
    existingGroups.some((g) => g.trim().toLowerCase() === trimmedName.toLowerCase());
  const isNameValid = !isNameEmpty && !isDuplicateName;
  const hasSelectedDevices = selectedDeviceIds.length >= 1;
  const isFormValid = isNameValid && hasSelectedDevices;

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

  // Lọc thiết bị hiển thị theo Tab
  const filteredDevices = iotDevices.filter((dev) => {
    if (deviceFilter === 'Camera') return checkIsCamera(dev);
    if (deviceFilter === 'Đồng hồ') return checkIsWatch(dev);
    return true;
  });

  const totalCount = iotDevices.length;
  const cameraCount = iotDevices.filter(checkIsCamera).length;
  const watchCount = iotDevices.filter(checkIsWatch).length;

  // Danh sách các thiết bị đã chọn
  const selectedDevicesList = iotDevices.filter((dev) =>
    selectedDeviceIds.includes(dev.id)
  );
  const selectedCamCount = selectedDevicesList.filter(checkIsCamera).length;
  const selectedWatchCount = selectedDevicesList.filter(checkIsWatch).length;

  // Kiểm tra chọn tất cả theo tab đang lọc
  const currentTabDeviceIds = filteredDevices.map((d) => d.id);
  const isAllCurrentTabSelected =
    currentTabDeviceIds.length > 0 &&
    currentTabDeviceIds.every((id) => selectedDeviceIds.includes(id));

  const toggleDeviceSelection = (id: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllCurrentTabSelected) {
      setSelectedDeviceIds((prev) =>
        prev.filter((id) => !currentTabDeviceIds.includes(id))
      );
    } else {
      setSelectedDeviceIds((prev) =>
        Array.from(new Set([...prev, ...currentTabDeviceIds]))
      );
    }
  };

  // Điều hướng quay lại
  const handleBack = () => {
    switch (currentStep) {
      case 'SELECT':
        navigation.goBack();
        break;
      case 'REVIEW':
        setCurrentStep('SELECT');
        break;
      case 'CONFIRM':
        setCurrentStep('REVIEW');
        break;
      case 'SUCCESS':
        navigation.navigate('Devices');
        break;
    }
  };

  // Bước 1 -> Bước 2: Kiểm tra hợp lệ và chuyển sang Tổng quan
  const handleProceedToReview = () => {
    setHasAttemptedProceed(true);

    // Điều kiện 1: Tên nhóm không được bỏ trống
    if (isNameEmpty) {
      Alert.alert(
        'Tên nhóm không được để trống',
        'Vui lòng nhập tên cho nhóm thiết bị mới để tiếp tục.'
      );
      return;
    }

    // Điều kiện 2: Tên nhóm mới phải là duy nhất
    if (isDuplicateName) {
      Alert.alert(
        'Tên nhóm đã tồn tại',
        `Nhóm "${trimmedName}" đã có trong hệ thống. Tên nhóm mới phải là duy nhất, vui lòng đặt tên khác.`
      );
      return;
    }

    // Điều kiện 3: Có ít nhất 1 thiết bị mới thành lập nhóm
    if (!hasSelectedDevices) {
      Alert.alert(
        'Chưa chọn thiết bị',
        'Cần có ít nhất 1 thiết bị mới thành lập nhóm. Vui lòng chọn ít nhất một thiết bị trong danh sách bên dưới.'
      );
      return;
    }

    setCurrentStep('REVIEW');
  };

  // Bước 2 -> Bước 3: Chuyển sang Xác nhận
  const handleProceedToConfirm = () => {
    if (isNameEmpty || isDuplicateName || !hasSelectedDevices) {
      Alert.alert('Thông báo', 'Dữ liệu nhóm không hợp lệ, vui lòng kiểm tra lại');
      setCurrentStep('SELECT');
      return;
    }
    setCurrentStep('CONFIRM');
  };

  // Bước 3 -> Hoàn tất tạo nhóm
  const handleConfirmCreate = () => {
    if (isNameEmpty || isDuplicateName || !hasSelectedDevices) {
      Alert.alert(
        'Không thể tạo nhóm',
        'Tên nhóm phải là duy nhất, không được bỏ trống và cần có ít nhất 1 thiết bị.'
      );
      setCurrentStep('SELECT');
      return;
    }

    setCreatedGroupName(trimmedName);

    // 1. Thêm nhóm vào store
    addDeviceGroup(trimmedName);

    // 2. Gán các thiết bị đã chọn vào nhóm mới
    assignDevicesToGroup(selectedDeviceIds, trimmedName);

    // 3. Chuyển sang màn hình thành công
    setCurrentStep('SUCCESS');
  };

  // Tạo thêm nhóm mới
  const handleResetCreateAnother = () => {
    setGroupName('');
    setSelectedDeviceIds([]);
    setDeviceFilter('Tất cả');
    setHasAttemptedProceed(false);
    setCurrentStep('SELECT');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header Điều Hướng */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Tạo Nhóm Thiết Bị</Text>
          <Text style={styles.headerSubtitle}>
            {currentStep === 'SELECT' && 'Bước 1/3: Đặt tên & chọn thiết bị'}
            {currentStep === 'REVIEW' && 'Bước 2/3: Bản thể hiện tổng quan nhóm'}
            {currentStep === 'CONFIRM' && 'Bước 3/3: Bảng thông báo xác nhận'}
            {currentStep === 'SUCCESS' && 'Hoàn tất: Đã tạo nhóm thành công'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* ============================================================== */}
      {/* TRANG 1: SELECT - Đặt tên nhóm, Lọc & Chọn thiết bị            */}
      {/* ============================================================== */}
      {currentStep === 'SELECT' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Card 1: Nhập tên nhóm mới */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="folder-outline" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.sectionTitle}>1. Đặt tên nhóm mới *</Text>
                  <Text style={styles.sectionSub}>
                    Tên nhóm là duy nhất và không được để trống
                  </Text>
                </View>
                {isNameValid && (
                  <View style={styles.validStatusBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.validStatusBadgeText}>Hợp lệ</Text>
                  </View>
                )}
              </View>

              <TextInput
                style={[
                  styles.groupTextInput,
                  isDuplicateName || (hasAttemptedProceed && isNameEmpty)
                    ? styles.groupTextInputError
                    : isNameValid
                    ? styles.groupTextInputValid
                    : null,
                ]}
                value={groupName}
                onChangeText={(text) => {
                  setGroupName(text);
                  if (hasAttemptedProceed) setHasAttemptedProceed(false);
                }}
                placeholder="Ví dụ: Tầng 2, Phòng Khách, Cụ Bà..."
                placeholderTextColor="#94A3B8"
              />

              {/* Thông báo kiểm tra tính duy nhất & không để trống */}
              {isDuplicateName && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="close-circle" size={16} color="#DC2626" />
                  <Text style={styles.feedbackErrorText}>
                    Tên nhóm "{trimmedName}" đã tồn tại. Tên nhóm mới phải là duy nhất!
                  </Text>
                </View>
              )}
              {hasAttemptedProceed && isNameEmpty && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.feedbackErrorText}>
                    Tên nhóm không được để trống. Vui lòng nhập tên nhóm!
                  </Text>
                </View>
              )}
              {isNameValid && (
                <View style={styles.feedbackRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                  <Text style={styles.feedbackSuccessText}>
                    Tên nhóm hợp lệ và khả dụng.
                  </Text>
                </View>
              )}
            </View>

            {/* Card 2: Chọn thiết bị gom vào nhóm */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="hardware-chip-outline" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.sectionTitle}>2. Chọn thiết bị đưa vào nhóm *</Text>
                  <Text
                    style={[
                      styles.sectionSub,
                      !hasSelectedDevices && hasAttemptedProceed && styles.sectionSubError,
                    ]}
                  >
                    {!hasSelectedDevices
                      ? 'Cần ít nhất 1 thiết bị để thành lập nhóm'
                      : `Đã chọn ${selectedDeviceIds.length} / ${totalCount} thiết bị`}
                  </Text>
                </View>
                {hasSelectedDevices ? (
                  <View style={styles.validStatusBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.validStatusBadgeText}>
                      {selectedDeviceIds.length} thiết bị
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.selectAllBtn}
                    onPress={handleToggleSelectAll}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectAllBtnText}>
                      {isAllCurrentTabSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Cảnh báo chưa chọn thiết bị nếu cố gắng Tiếp tục */}
              {!hasSelectedDevices && hasAttemptedProceed && (
                <View style={styles.deviceWarningBanner}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.deviceWarningText}>
                    Cần có ít nhất 1 thiết bị mới thành lập nhóm. Vui lòng chọn thiết bị bên dưới!
                  </Text>
                </View>
              )}

              {/* 3 Tab Bộ Lọc: Tất cả, Camera, Đồng hồ */}
              <View style={styles.filterTabsRow}>
                {(['Tất cả', 'Camera', 'Đồng hồ'] as GroupDeviceFilter[]).map((tab) => {
                  const isActive = deviceFilter === tab;
                  const count =
                    tab === 'Tất cả'
                      ? totalCount
                      : tab === 'Camera'
                      ? cameraCount
                      : watchCount;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.filterTab, isActive && styles.filterTabActive]}
                      onPress={() => setDeviceFilter(tab)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          tab === 'Tất cả'
                            ? 'grid-outline'
                            : tab === 'Camera'
                            ? 'videocam-outline'
                            : 'watch-outline'
                        }
                        size={14}
                        color={isActive ? '#FFF' : '#64748B'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.filterTabText,
                          isActive && styles.filterTabTextActive,
                        ]}
                      >
                        {tab} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Danh sách thiết bị */}
              <View style={styles.deviceListContainer}>
                {filteredDevices.length === 0 ? (
                  <View style={styles.emptyDeviceBox}>
                    <Ionicons name="cube-outline" size={36} color="#CBD5E1" />
                    <Text style={styles.emptyDeviceText}>
                      Không có thiết bị thuộc danh mục này
                    </Text>
                  </View>
                ) : (
                  filteredDevices.map((dev) => {
                    const isSelected = selectedDeviceIds.includes(dev.id);
                    return (
                      <TouchableOpacity
                        key={dev.id}
                        style={[
                          styles.deviceCard,
                          isSelected && styles.deviceCardSelected,
                        ]}
                        onPress={() => toggleDeviceSelection(dev.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? '#7C3AED' : '#94A3B8'}
                          style={{ marginRight: 12 }}
                        />
                        <View
                          style={[
                            styles.deviceIconBox,
                            { backgroundColor: `${dev.color}15` },
                          ]}
                        >
                          <Ionicons
                            name={dev.icon as any}
                            size={20}
                            color={dev.color}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text
                            style={[
                              styles.deviceName,
                              isSelected && styles.deviceNameSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {dev.name}
                          </Text>
                          <Text style={styles.deviceSub} numberOfLines={1}>
                            Vị trí hiện tại:{' '}
                            <Text style={{ fontWeight: '700', color: '#475569' }}>
                              {dev.location || 'Chưa nhóm'}
                            </Text>
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: dev.isOnline
                                ? '#10B981'
                                : '#CBD5E1',
                            },
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                !isFormValid && styles.primaryBtnDisabled,
              ]}
              onPress={handleProceedToReview}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>
                Tiếp tục {selectedDeviceIds.length > 0 ? `(${selectedDeviceIds.length})` : ''}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================== */}
      {/* TRANG 2: REVIEW - Bản thể hiện tổng quan nhóm đã tạo          */}
      {/* ============================================================== */}
      {currentStep === 'REVIEW' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Banner tổng quan */}
            <View style={styles.overviewHeroCard}>
              <View style={styles.overviewHeaderRow}>
                <View style={styles.overviewFolderCircle}>
                  <Ionicons name="folder" size={28} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.overviewBadge}>NHÓM THIẾT BỊ MỚI</Text>
                  <Text style={styles.overviewGroupName}>{groupName.trim()}</Text>
                </View>
                <View style={styles.overviewCountBadge}>
                  <Text style={styles.overviewCountBadgeText}>
                    {selectedDeviceIds.length} thiết bị
                  </Text>
                </View>
              </View>

              {/* Thống kê phân loại */}
              <View style={styles.overviewStatsGrid}>
                <View style={styles.overviewStatCol}>
                  <Ionicons name="videocam" size={18} color="#7C3AED" />
                  <Text style={styles.overviewStatVal}>{selectedCamCount}</Text>
                  <Text style={styles.overviewStatLbl}>Camera AI</Text>
                </View>
                <View style={styles.overviewStatDivider} />
                <View style={styles.overviewStatCol}>
                  <Ionicons name="watch" size={18} color="#10B981" />
                  <Text style={styles.overviewStatVal}>{selectedWatchCount}</Text>
                  <Text style={styles.overviewStatLbl}>Đồng hồ BLE</Text>
                </View>
                <View style={styles.overviewStatDivider} />
                <View style={styles.overviewStatCol}>
                  <Ionicons name="shield-checkmark" size={18} color="#3B82F6" />
                  <Text style={styles.overviewStatVal}>24/7</Text>
                  <Text style={styles.overviewStatLbl}>Giám sát</Text>
                </View>
              </View>
            </View>

            {/* Danh sách chi tiết các thiết bị và vị trí mới */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="list" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.sectionTitle}>
                    Danh sách thiết bị gom vào nhóm ({selectedDevicesList.length})
                  </Text>
                  <Text style={styles.sectionSub}>
                    Các thiết bị sẽ được gán sang phân vùng "{groupName.trim()}"
                  </Text>
                </View>
              </View>

              <View style={styles.reviewDeviceList}>
                {selectedDevicesList.map((dev) => (
                  <View key={dev.id} style={styles.reviewDeviceCard}>
                    <View
                      style={[
                        styles.deviceIconBox,
                        { backgroundColor: `${dev.color}15` },
                      ]}
                    >
                      <Ionicons
                        name={dev.icon as any}
                        size={20}
                        color={dev.color}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.reviewDeviceName} numberOfLines={1}>
                        {dev.name}
                      </Text>
                      <View style={styles.reviewLocationChangeRow}>
                        <Text style={styles.reviewLocOld} numberOfLines={1}>
                          {dev.location || 'Chưa nhóm'}
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color="#7C3AED"
                          style={{ marginHorizontal: 6 }}
                        />
                        <Text style={styles.reviewLocNew} numberOfLines={1}>
                          {groupName.trim()}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: dev.isOnline ? '#10B981' : '#CBD5E1',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCurrentStep('SELECT')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-back"
                size={16}
                color="#64748B"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.cancelBtnText}>Quay lại</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleProceedToConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Tiếp tục tạo</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================== */}
      {/* TRANG 3: CONFIRM - Bảng thông báo xác nhận                     */}
      {/* ============================================================== */}
      {currentStep === 'CONFIRM' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.confirmCard}>
              <View style={styles.confirmIconRing}>
                <Ionicons name="help-circle" size={56} color="#7C3AED" />
              </View>

              <Text style={styles.confirmHeading}>Xác Nhận Tạo Nhóm?</Text>
              <Text style={styles.confirmDesc}>
                Bạn có chắc chắn muốn tạo nhóm{' '}
                <Text style={{ fontWeight: '800', color: '#1E1B4B' }}>
                  "{groupName.trim()}"
                </Text>{' '}
                và gán{' '}
                <Text style={{ fontWeight: '800', color: '#7C3AED' }}>
                  {selectedDeviceIds.length} thiết bị
                </Text>{' '}
                đã chọn vào nhóm này không?
              </Text>

              {/* Bảng thông số chi tiết */}
              <View style={styles.confirmTable}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Tên nhóm mới:</Text>
                  <Text style={styles.confirmValue}>{groupName.trim()}</Text>
                </View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Số lượng thiết bị:</Text>
                  <Text style={styles.confirmValue}>
                    {selectedDeviceIds.length} thiết bị
                  </Text>
                </View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Phân loại chi tiết:</Text>
                  <Text style={styles.confirmValue}>
                    {selectedCamCount} Camera • {selectedWatchCount} Đồng hồ
                  </Text>
                </View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Vị trí áp dụng:</Text>
                  <Text style={styles.confirmValue}>
                    Cập nhật đồng bộ vào hệ thống
                  </Text>
                </View>
              </View>

              {/* Thông báo chú thích */}
              <View style={styles.confirmNoteBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#1E40AF"
                />
                <Text style={styles.confirmNoteText}>
                  Vị trí của {selectedDeviceIds.length} thiết bị này sẽ lập tức được cập nhật sang "{groupName.trim()}". Bạn có thể thay đổi lại cấu hình bất kỳ lúc nào.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCurrentStep('REVIEW')}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Quay lại xem</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmActionBtn}
              onPress={handleConfirmCreate}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#FFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.confirmActionBtnText}>Xác Nhận Tạo Nhóm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================== */}
      {/* TRANG 4: SUCCESS - Hoàn tất thành công                          */}
      {/* ============================================================== */}
      {currentStep === 'SUCCESS' && (
        <View style={styles.successContainer}>
          <View style={styles.successCenter}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={60} color="#FFF" />
            </View>
            <Text style={styles.successTitle}>Tạo Nhóm Thành Công!</Text>
            <Text style={styles.successDesc}>
              Nhóm{' '}
              <Text style={{ fontWeight: '800', color: '#1E1B4B' }}>
                "{createdGroupName}"
              </Text>{' '}
              đã được tạo với{' '}
              <Text style={{ fontWeight: '800', color: '#7C3AED' }}>
                {selectedDeviceIds.length} thiết bị
              </Text>{' '}
              được liên kết thành công.
            </Text>

            {/* Thẻ tóm tắt thành công */}
            <View style={styles.successCard}>
              <View style={styles.successCardRow}>
                <Ionicons name="folder-open" size={20} color="#7C3AED" />
                <Text style={styles.successCardGroupName}>{createdGroupName}</Text>
              </View>
              <Text style={styles.successCardMeta}>
                Bao gồm: {selectedCamCount} Camera • {selectedWatchCount} Đồng hồ BLE
              </Text>
            </View>
          </View>

          {/* Nút hành động thành công */}
          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Devices')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="list"
                size={18}
                color="#FFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.primaryBtnText}>Xem danh sách nhóm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.anotherBtn}
              onPress={handleResetCreateAnother}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color="#7C3AED"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.anotherBtnText}>Tạo thêm nhóm khác</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },



  // Scroll Content
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },

  // Section Cards
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  groupTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  groupTextInputValid: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  groupTextInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  validStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  validStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  feedbackErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  feedbackSuccessText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    flex: 1,
  },
  sectionSubError: {
    color: '#DC2626',
    fontWeight: '700',
  },
  deviceWarningBanner: {
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
  deviceWarningText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  primaryBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.85,
  },

  // Select All Button
  selectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // Filter Tabs
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  // Device List
  deviceListContainer: {
    gap: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  deviceCardSelected: {
    borderColor: '#DDD6FE',
    backgroundColor: '#FAF5FF',
  },
  deviceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  deviceNameSelected: {
    color: '#6D28D9',
  },
  deviceSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  emptyDeviceBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDeviceText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Step 2: Overview Hero Card
  overviewHeroCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    padding: 16,
    ...Shadows.card,
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewFolderCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  overviewGroupName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
    marginTop: 2,
  },
  overviewCountBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  overviewCountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  overviewStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  overviewStatCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewStatVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 4,
  },
  overviewStatLbl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  overviewStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },

  // Step 2: Review Device List
  reviewDeviceList: {
    gap: 8,
  },
  reviewDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewDeviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  reviewLocationChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  reviewLocOld: {
    fontSize: 12,
    color: '#64748B',
    maxWidth: 110,
  },
  reviewLocNew: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
    maxWidth: 130,
  },

  // Step 3: Confirm Card
  confirmCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  confirmIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#EDE9FE',
  },
  confirmHeading: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  confirmTable: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  confirmLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  confirmValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '700',
  },
  confirmDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  confirmNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    width: '100%',
  },
  confirmNoteText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 16,
  },

  // Step 4: Success View
  successContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  successCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Shadows.card,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    padding: 16,
    alignItems: 'center',
  },
  successCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  successCardGroupName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  successCardMeta: {
    fontSize: 12,
    color: '#6D28D9',
    fontWeight: '600',
  },
  successActions: {
    gap: 12,
  },
  anotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  anotherBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // Footer Actions
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  primaryBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    gap: 6,
    ...Shadows.card,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmActionBtn: {
    flex: 1.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    gap: 6,
    ...Shadows.card,
  },
  confirmActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

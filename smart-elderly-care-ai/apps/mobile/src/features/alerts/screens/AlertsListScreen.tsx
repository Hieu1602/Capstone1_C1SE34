// ==============================================================================
// TỆP: AlertsListScreen.tsx
// PHÂN HỆ: Màn hình Danh sách Cảnh báo & Thông báo Sự kiện Khẩn cấp
// TÁC GIẢ: Phan Nguyễn Giáng My
// ==============================================================================

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useAlertStore } from '../../../store';
import { usePatientStore, ReminderItem } from '../../../store/usePatientStore';
import { useTheme } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDeviceStore } from '../../../store/useDeviceStore';
import { useVitalStore } from '../../../store/useVitalStore';
import { FamilyAppointmentsModal } from '../../dashboard/components/FamilyAppointmentsModal';
import { incidentsApi, householdApi } from '../../../services/api';
import { AlertDetailModal } from '../components/AlertDetailModal';
import { MedicationAlertCard } from '../components/MedicationAlertCard';
import { IncidentAlertCard } from '../components/IncidentAlertCard';
import { HouseActionModal, HouseModalMode } from '../components/HouseActionModal';
import { AlertsEmptyState } from '../components/AlertsEmptyState';
import { notificationService } from '../../../services/notificationService';

type FilterType = 'ALL' | 'CRITICAL' | 'VITAL' | 'MEDICATION' | 'APPOINTMENT';

const extractTagId = (notes: string | null | undefined, tag: 'MEMBER_ID' | 'HOUSE_ID'): string | null => {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${tag}:([0-9a-fA-F-]+)`));
  return match ? match[1] : null;
};

export default function AlertsListScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const { isDarkMode, colors } = useTheme();

  const { incidents, setIncidents, fetchNotifications, acknowledgeIncident, acknowledgeAll } = useAlertStore();
  const { patientRecord, activePatientId, patientsList, fetchPatientsList, todayReminders, markMedicationTaken, snoozeMedication, fetchReminders } = usePatientStore();
  const { userName, userId, userRole, role, permissions, fetchMyPermissions } = useAuthStore();
  const { house, iotDevices, fetchHouseFromBackend, fetchDevicesFromBackend } = useDeviceStore();

  const isOwnerOrAdmin =
    userRole === 'admin' ||
    role === 'admin' ||
    userRole === 'owner' ||
    role === 'owner' ||
    permissions?.is_owner === true ||
    permissions?.role_in_house === 'OWNER';
  const canViewCamera = isOwnerOrAdmin || Boolean(permissions?.can_view_camera);
  const hasLinkedHouse = Boolean(
    (house?.id && house?.hasHouse !== false && house?.name && house.name.trim() !== '') ||
    (permissions?.role_in_house && permissions?.role_in_house !== 'NEW_USER' && permissions?.role_in_house !== 'NONE')
  );
  const isUnassignedAccount = !hasLinkedHouse;

  const [loading, setLoading] = useState(incidents.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [familyAppointmentsModalVisible, setFamilyAppointmentsModalVisible] = useState(false);
  const [selectedAppointmentPatientId, setSelectedAppointmentPatientId] = useState<string | number | null>(null);
  const [selectedAppointmentPatientName, setSelectedAppointmentPatientName] = useState<string | null>(null);
  const initialFilterParam = route?.params?.initialFilter || route?.params?.filter;
  const [filterType, setFilterType] = useState<FilterType>(
    initialFilterParam && ['ALL', 'CRITICAL', 'VITAL', 'MEDICATION', 'APPOINTMENT'].includes(initialFilterParam)
      ? initialFilterParam
      : 'ALL'
  );
  const [houseActionModal, setHouseActionModal] = useState<{ item: any; mode: HouseModalMode } | null>(null);
  const [selectedAlertDetailItem, setSelectedAlertDetailItem] = useState<any>(null);
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    const nextFilter = route?.params?.initialFilter || route?.params?.filter;
    if (nextFilter && ['ALL', 'CRITICAL', 'VITAL', 'MEDICATION', 'APPOINTMENT'].includes(nextFilter)) {
      setFilterType(nextFilter);
    }
  }, [route?.params?.initialFilter, route?.params?.filter]);

  const isFetchingRef = useRef(false);

  const loadData = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isInitial && incidents.length === 0) setLoading(true);
    try {
      const tasks: Array<Promise<any>> = [
        fetchNotifications(),
        fetchReminders(),
      ];
      if (isInitial) {
        if (fetchPatientsList) tasks.push(fetchPatientsList());
        if (fetchMyPermissions) tasks.push(fetchMyPermissions());
        if (fetchHouseFromBackend) tasks.push(fetchHouseFromBackend());
        if (fetchDevicesFromBackend) tasks.push(fetchDevicesFromBackend());
      }
      await Promise.allSettled(tasks);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [fetchNotifications, fetchReminders, fetchPatientsList, fetchMyPermissions, fetchHouseFromBackend, fetchDevicesFromBackend, incidents.length]);

  useEffect(() => {
    loadData(true);
    const unsub = navigation?.addListener?.('focus', () => {
      loadData(false);
    });
    return unsub;
  }, [navigation, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchNotifications(),
        fetchReminders(),
        fetchPatientsList?.(),
        fetchMyPermissions?.(),
        fetchHouseFromBackend?.(),
        fetchDevicesFromBackend?.(),
      ]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const medications: ReminderItem[] = isUnassignedAccount ? [] : todayReminders?.medications || [];
  const pendingMedCount = medications.filter((m) => !m.taken).length;
  const currentUid = (userId || (useAuthStore.getState().user_id ? String(useAuthStore.getState().user_id) : ''))?.toLowerCase();

  const myDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    (iotDevices || []).forEach((d: any) => {
      if (d.id) ids.add(String(d.id).toLowerCase());
      if (d.device_id) ids.add(String(d.device_id).toLowerCase());
    });
    (patientsList || []).forEach((p: any) => {
      (p.devices || []).forEach((d: any) => {
        if (d.id) ids.add(String(d.id).toLowerCase());
        if (d.device_id) ids.add(String(d.device_id).toLowerCase());
      });
    });
    return ids;
  }, [iotDevices, patientsList]);

  const validIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (isOwnerOrAdmin && item.alert_type === 'HOUSE_INVITE_PENDING') return false;

      const noteStr = typeof item.notes === 'string' ? item.notes : typeof item.note === 'string' ? item.note : '';
      const userMatch = noteStr.match(/USER:([0-9a-fA-F-]+)/);
      if (userMatch && currentUid && userMatch[1].toLowerCase() !== currentUid) return false;

      if (isUnassignedAccount) {
        return (
          item.alert_type === 'HOUSE_MEMBER_ADDED' ||
          item.alert_type === 'MEMBER_ADDED' ||
          item.alert_type === 'HOUSE_INVITE_PENDING' ||
          item.alert_type === 'HOUSE_JOIN_REQUEST' ||
          item.alert_type === 'HOUSE_JOIN_APPROVED' ||
          item.alert_type === 'HOUSE_JOIN_REJECTED' ||
          noteStr.includes('USER:')
        );
      }

      if (myDeviceIds.size > 0 && item.device_id) {
        const itemDev = String(item.device_id).toLowerCase();
        if (itemDev !== 'system' && !myDeviceIds.has(itemDev)) {
          return false;
        }
      }

      return true;
    });
  }, [isUnassignedAccount, isOwnerOrAdmin, currentUid, incidents, myDeviceIds]);

  const unreadIncidentsCount = validIncidents.filter((item) => !item.is_acknowledged).length;
  const unreadCount = unreadIncidentsCount + pendingMedCount;

  const handleConfirmMedication = async (med: ReminderItem) => {
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const targetPatientId = activePatientId || patientsList?.[0]?.id || patientsList?.[0]?.elderly_id || undefined;
    try {
      await markMedicationTaken(med.id, true, timeStr, targetPatientId);
      Alert.alert(
        'Xác nhận thành công',
        `Đã ghi nhận người cao tuổi đã uống thuốc "${med.name}" lúc ${timeStr}. Trạng thái đã được đồng bộ toàn hệ thống.`
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể đồng bộ trạng thái đã uống lên máy chủ. Vui lòng thử lại.');
    }
  };

  const handleSnoozeMedication = (med: ReminderItem) => {
    snoozeMedication(med.id, 15);
    Alert.alert('Đã hoãn nhắc nhở', `Hệ thống sẽ phát loa Hub và nhắc lại cữ "${med.name}" sau 15 phút nữa.`);
  };

  const handleReplaySpeakerMedication = (med: ReminderItem) => {
    Alert.alert(
      'Loa Hub đã phát lời nhắc',
      `📢 "Đã đến giờ uống thuốc: ${med.name}. Liều dùng: ${med.dose}. Cụ nhớ uống thuốc cùng một cốc nước ấm nhé!"`
    );
  };

  const filteredIncidents = validIncidents.filter((item) => {
    if (filterType === 'CRITICAL') {
      const lvl = (item.alert_level || '').toUpperCase();
      const aType = (item.alert_type || '').toUpperCase();
      return (
        lvl === 'CRITICAL' ||
        lvl === 'EMERGENCY' ||
        aType === 'FALL_DETECTED' ||
        aType === 'ACOUSTIC_DISTRESS' ||
        aType === 'CRITICAL_TRIAD' ||
        aType === 'DEVICE_BATTERY_DEAD' ||
        aType === 'SOS_EMERGENCY' ||
        aType.includes('CRITICAL')
      );
    }
    if (filterType === 'VITAL') {
      return (
        item.alert_type.includes('HEART') ||
        item.alert_type.includes('SPO2') ||
        item.alert_type.includes('TEMP') ||
        item.alert_type.includes('ARRHYTHMIA')
      );
    }
    if (filterType === 'APPOINTMENT') {
      return ['APPOINTMENT_SCHEDULED', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_COMPLETED'].includes(item.alert_type);
    }
    return true;
  });

  type ListItem =
    | { itemType: 'MEDICATION'; id: string; data: ReminderItem }
    | { itemType: 'INCIDENT'; id: string; data: any };

  const listData: ListItem[] = useMemo(() => {
    const medItems: ListItem[] = medications.map((med) => ({ itemType: 'MEDICATION', id: `med-${med.id}`, data: med }));
    const incItems: ListItem[] = filteredIncidents.map((inc) => ({ itemType: 'INCIDENT', id: `inc-${inc.id}`, data: inc }));
    if (filterType === 'MEDICATION') return medItems;
    if (filterType !== 'ALL') return incItems;
    return [...medItems, ...incItems];
  }, [filterType, medications, filteredIncidents]);

  const applyOptimisticAck = (itemId: string, handler: string, notes?: string) => {
    const nowIso = new Date().toISOString();
    const updated = incidents.map((i) =>
      i.id === itemId
        ? {
            ...i,
            is_acknowledged: true,
            acknowledged_by: handler,
            acknowledged_by_name: handler,
            acknowledged_at: nowIso,
            ...(notes ? { notes } : {}),
          }
        : i
    );
    setIncidents(updated);
    return updated;
  };

  const handleMarkAllAsRead = async () => {
    notificationService.stopEmergencyAlarm();
    if (unreadIncidentsCount === 0) {
      Alert.alert('Thông báo', 'Tất cả sự kiện đều đã được đánh dấu đọc.');
      return;
    }
    const handler = userName || 'Người chăm sóc';
    const nowIso = new Date().toISOString();
    setIncidents(
      incidents.map((i) => ({
        ...i,
        is_acknowledged: true,
        acknowledged_by: handler,
        acknowledged_by_name: handler,
        acknowledged_at: nowIso,
      }))
    );

    try {
      await acknowledgeAll();
      fetchNotifications();
    } catch {}

    Alert.alert('Thành công', 'Đã đánh dấu đã đọc tất cả thông báo.');
  };

  const handleQuickAcknowledge = async (item: any, e?: any) => {
    e?.stopPropagation?.();
    // Tắt ngay chuông báo động và ngắt rung tức thời khi người dùng bấm Đã xử lý
    notificationService.stopEmergencyAlarm();

    const handler = userName || 'Người chăm sóc';
    const updated = applyOptimisticAck(item.id, handler);
    acknowledgeIncident(item.id, 'Đã kiểm tra an toàn từ danh sách sự kiện', handler);

    const remainingCritical = updated.some(
      (i) => !i.is_acknowledged && (i.alert_level === 'CRITICAL' || i.alert_type === 'FALL_DETECTED')
    );
    if (!remainingCritical) {
      try {
        useVitalStore.getState().setVitals({ fall_detected: false, acoustic_status: 'Bình thường' });
      } catch {}
    }
  };

  const handleRespondInvite = async (item: any, action: 'accept' | 'reject') => {
    if (!item) return;
    const noteContent = item.notes || item.note || '';
    const memberId = extractTagId(noteContent, 'MEMBER_ID') || item.device_id || item.id;
    const fallbackHouseId = extractTagId(noteContent, 'HOUSE_ID');
    try {
      setIsResponding(true);
      const handler = userName || 'Người dùng';
      const noteText = action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà';
      applyOptimisticAck(item.id, handler, noteText);
      useAlertStore.getState().acknowledgeIncident(item.id, noteText, handler);

      const res = await householdApi.respondHouseInvite(memberId, action);
      setHouseActionModal(null);

      if (action === 'accept') {
        const houseData = res.data?.house;
        const permsData = res.data?.permissions;
        const finalHouseId = houseData?.id || fallbackHouseId;
        const finalHouseName = houseData?.name || 'Nhà của tôi';

        useAuthStore.getState().setJoinedHouseData(finalHouseId, finalHouseName, permsData);
        useDeviceStore.getState().setHouseInfo?.({
          id: String(finalHouseId),
          name: finalHouseName,
          address: houseData?.address || '',
          currentMode: houseData?.current_mode || 'HOME',
          hasHouse: true,
        });

        navigation.navigate('Main', { screen: 'Home' });

        Promise.allSettled([
          useDeviceStore.getState().fetchDevicesFromBackend?.(),
          fetchNotifications(),
        ]).catch(() => {});
      } else {
        fetchNotifications().catch(() => {});
        Alert.alert('Đã từ chối', 'Bạn đã từ chối lời mời tham gia căn nhà.');
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.response?.data?.detail || 'Không thể thực hiện thao tác. Vui lòng thử lại.');
      fetchNotifications().catch(() => {});
    } finally {
      setIsResponding(false);
    }
  };

  const handleRespondJoinRequest = async (item: any, action: 'accept' | 'reject') => {
    if (!item) return;
    const memberId = extractTagId(item.notes || item.note, 'MEMBER_ID') || item.device_id || item.id;
    try {
      setIsResponding(true);
      const handler = userName || 'Chủ hộ';
      const noteText = action === 'accept' ? 'Chủ hộ đã duyệt vào nhà' : 'Chủ hộ đã từ chối vào nhà';
      applyOptimisticAck(item.id, handler, noteText);
      useAlertStore.getState().acknowledgeIncident(item.id, noteText, handler);

      await householdApi.respondJoinRequest(memberId, action);
      await incidentsApi.acknowledge(item.id, noteText).catch(() => {});
      setHouseActionModal(null);

      if (action === 'accept') {
        await Promise.allSettled([
          useDeviceStore.getState().fetchHouseFromBackend(),
          useDeviceStore.getState().syncAllWithBackend?.(),
          useVitalStore.getState().fetchHouseFromBackend?.(),
          fetchNotifications(),
        ]);
        Alert.alert('Đã phê duyệt', '✓ Đã đồng ý cho thành viên gia nhập căn nhà!');
      } else {
        await fetchNotifications();
        Alert.alert('Đã từ chối', 'Đã từ chối yêu cầu tham gia căn nhà.');
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.response?.data?.detail || 'Không thể thực hiện thao tác. Vui lòng thử lại.');
      await fetchNotifications();
    } finally {
      setIsResponding(false);
    }
  };

  const handleConfirmAlertAction = async (item: any) => {
    if (!item) return;
    setIsResponding(true);
    try {
      await handleQuickAcknowledge(item);
      const handler = userName || 'Người chăm sóc';
      const nowIso = new Date().toISOString();
      setSelectedAlertDetailItem((prev: any) =>
        prev
          ? {
              ...prev,
              is_acknowledged: true,
              acknowledged_by: handler,
              acknowledged_by_name: handler,
              acknowledged_at: nowIso,
            }
          : null
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể xác nhận xử lý lúc này.');
    } finally {
      setIsResponding(false);
    }
  };

  const handlePressCard = (item: any) => {
    if (item.alert_type === 'HOUSE_INVITE_PENDING') {
      if (!item.is_acknowledged) setHouseActionModal({ item, mode: 'invite' });
      return;
    }
    if (item.alert_type === 'HOUSE_JOIN_REQUEST') {
      if (!item.is_acknowledged) setHouseActionModal({ item, mode: 'join_request' });
      return;
    }
    if (item.alert_type === 'HOUSE_MEMBER_ADDED' || item.alert_type === 'MEMBER_ADDED') {
      navigation.navigate('HouseDetail');
      return;
    }
    if (['APPOINTMENT_SCHEDULED', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_COMPLETED'].includes(item.alert_type)) {
      let pid: any = null;
      let pname: string | null = null;

      if (item.notes?.includes('PATIENT:')) {
        pid = item.notes.split('PATIENT:')[1].split('|')[0].trim();
      }
      if (item.notes?.includes('NAME:')) {
        pname = item.notes.split('NAME:')[1].split('|')[0].trim();
      }
      if (!pname && item.message) {
        const match = item.message.match(/cho\s+([^,]+?)\s+vào\s+/i);
        if (match && match[1]) pname = match[1].trim();
      }

      const pList = (patientsList && patientsList.length > 0) ? patientsList : (usePatientStore.getState().patientsList || []);
      if (pname && !pid) {
        const found = pList.find((p: any) => (p.name || p.full_name)?.toLowerCase().trim() === pname?.toLowerCase().trim());
        if (found) pid = found.id || found.elderly_id;
      }
      if (pid && !pname) {
        const found = pList.find((p: any) => p.id === pid || p.elderly_id === pid);
        if (found) pname = found.name || found.full_name;
      }

      const fallbackPid = patientRecord?.id || activePatientId || pList[0]?.id || pList[0]?.elderly_id || '';
      const finalPid = pid || fallbackPid;
      const finalPname = pname || (pid && pList.find((p: any) => p.id === pid || p.elderly_id === pid)?.name) || patientRecord?.name || 'Bệnh nhân';

      setSelectedAppointmentPatientId(finalPid);
      setSelectedAppointmentPatientName(finalPname);
      setFamilyAppointmentsModalVisible(true);
      return;
    }
    if (item.alert_type === 'PRESCRIPTION_CREATED' || item.alert_type === 'PRESCRIPTION_UPDATED' || item.alert_type === 'MEDICATION_REMINDER') {
      navigation.navigate('MedicationReminder');
      return;
    }
    setSelectedAlertDetailItem(item);
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header */}
      <View style={[styles.topHeader, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeftRow}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              Thông Báo &amp; Sự Kiện
            </Text>
            <Text style={[styles.headerSubtitle, isDarkMode && { color: colors.textSecondary }]} numberOfLines={1}>
              {unreadCount > 0
                ? t('{{count}} thông báo mới chưa đọc', { count: unreadCount })
                : isUnassignedAccount
                ? 'Chưa liên kết ngôi nhà'
                : 'Tất cả đã được xử lý'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.markAllReadBtn, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleMarkAllAsRead}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-done" size={15} color={unreadIncidentsCount > 0 ? '#EA580C' : '#94A3B8'} />
            <Text style={[styles.markAllReadText, unreadIncidentsCount === 0 && { color: '#94A3B8' }]}>Đã đọc</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cameraQuickBtn}
            onPress={() => {
              if (isUnassignedAccount) {
                Alert.alert('Chưa liên kết ngôi nhà', 'Tài khoản chưa được thêm vào căn nhà nào. Hãy nhắc Chủ hộ thêm số điện thoại của bạn vào nhà nhé!');
                return;
              }
              if (!canViewCamera) {
                Alert.alert('Chưa có quyền xem camera', 'Bạn chưa được cấp quyền xem camera an ninh. Hãy liên hệ Chủ hộ để được cấp quyền.');
                return;
              }
              navigation.navigate('CameraDetail');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam" size={15} color="#FFF" />
            <Text style={styles.cameraQuickText}>Camera</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Thanh bộ lọc phân loại */}
      {!isUnassignedAccount && (
        <View style={[styles.filterBarContainer, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarScroll}>
            {[
              { key: 'ALL', label: t('Tất cả ({{count}})', { count: incidents.length + medications.length }), activePill: styles.filterPillActive, darkBg: 'rgba(255, 107, 0, 0.15)', darkBorder: '#FF6B00', activeColor: undefined },
              { key: 'MEDICATION', label: `💊 ${t('Uống thuốc')}${pendingMedCount > 0 ? ` (${pendingMedCount})` : ''}`, activePill: styles.filterPillActiveMed, darkBg: 'rgba(16, 185, 129, 0.15)', darkBorder: '#10B981', activeColor: '#059669' },
              { key: 'CRITICAL', label: `🚨 ${t('Nguy kịch')}`, activePill: styles.filterPillActive, darkBg: 'rgba(255, 107, 0, 0.15)', darkBorder: '#FF6B00', activeColor: undefined },
              { key: 'VITAL', label: t('Sức khoẻ'), activePill: styles.filterPillActive, darkBg: 'rgba(255, 107, 0, 0.15)', darkBorder: '#FF6B00', activeColor: undefined },
              { key: 'APPOINTMENT', label: `🗓️ ${t('Lịch khám')}`, activePill: styles.filterPillActive, darkBg: 'rgba(217, 119, 6, 0.15)', darkBorder: '#D97706', activeColor: '#D97706' },
            ].map((tab) => {
              const isActive = filterType === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterPill,
                    isDarkMode && !isActive && { backgroundColor: colors.card, borderColor: colors.border },
                    isActive && tab.activePill,
                    isActive && isDarkMode && { backgroundColor: tab.darkBg, borderColor: tab.darkBorder },
                  ]}
                  onPress={() => setFilterType(tab.key as FilterType)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isDarkMode && !isActive && { color: colors.textSecondary },
                      isActive && (tab.activeColor ? { color: tab.activeColor, fontWeight: '700' } : styles.filterTextActive),
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 3. Danh sách thông báo */}
      <FlatList
        data={listData}
        keyExtractor={(item) =>
          item.itemType === 'INCIDENT'
            ? `${item.id}_${item.data.is_acknowledged ? 'handled' : 'unread'}_${item.data.acknowledged_at || ''}`
            : `${item.id}_${item.data.taken ? 'taken' : 'pending'}`
        }
        extraData={[incidents, filterType]}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          ) : undefined
        }
        renderItem={({ item }) =>
          item.itemType === 'MEDICATION' ? (
            <MedicationAlertCard
              item={item.data}
              isDarkMode={isDarkMode}
              colors={colors}
              onPress={() => navigation.navigate('MedicationReminder')}
              onConfirm={handleConfirmMedication}
              onSnooze={handleSnoozeMedication}
              onReplaySpeaker={handleReplaySpeakerMedication}
            />
          ) : (
            <IncidentAlertCard
              inc={item.data}
              isDarkMode={isDarkMode}
              colors={colors}
              onPress={handlePressCard}
              onQuickAcknowledge={handleQuickAcknowledge}
              onRespondInvite={handleRespondInvite}
              onRespondJoinRequest={handleRespondJoinRequest}
            />
          )
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <AlertsEmptyState
            loading={loading}
            isUnassignedAccount={isUnassignedAccount}
            filterType={filterType}
            isDarkMode={isDarkMode}
            colors={colors}
            onRefresh={handleRefresh}
          />
        }
      />

      <HouseActionModal
        visible={Boolean(houseActionModal)}
        mode={houseActionModal?.mode || 'invite'}
        item={houseActionModal?.item}
        isResponding={isResponding}
        isDarkMode={isDarkMode}
        colors={colors}
        onClose={() => setHouseActionModal(null)}
        onRespond={(item, action) =>
          houseActionModal?.mode === 'join_request'
            ? handleRespondJoinRequest(item, action)
            : handleRespondInvite(item, action)
        }
      />

      <AlertDetailModal
        visible={Boolean(selectedAlertDetailItem)}
        item={selectedAlertDetailItem}
        onClose={() => setSelectedAlertDetailItem(null)}
        onConfirmHandled={handleConfirmAlertAction}
        isResponding={isResponding}
        isDarkMode={isDarkMode}
        colors={colors}
        navigation={navigation}
      />

      <FamilyAppointmentsModal
        visible={familyAppointmentsModalVisible}
        patientId={selectedAppointmentPatientId || patientRecord?.id || activePatientId || patientsList?.[0]?.id || ''}
        patientName={selectedAppointmentPatientName || patientRecord?.name}
        onClose={() => {
          setFamilyAppointmentsModalVisible(false);
          setSelectedAppointmentPatientName(null);
          fetchNotifications();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    ...Shadows.soft,
  },
  headerTitleCol: { flex: 1, marginRight: 4 },
  headerTitle: { fontSize: 16.5, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  markAllReadText: { fontSize: 11, fontWeight: '700', color: '#EA580C' },
  cameraQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  cameraQuickText: { color: '#FFF', fontSize: 11.5, fontWeight: '700' },
  filterBarContainer: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterBarScroll: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: { backgroundColor: '#FFF4EC', borderColor: '#FF6B00', borderWidth: 1.5 },
  filterPillActiveMed: { backgroundColor: '#ECFDF5', borderColor: '#10B981', borderWidth: 1.5 },
  filterText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterTextActive: { color: '#FF6B00', fontWeight: '700' },
  listContainer: { padding: 16, gap: 12, paddingBottom: 40 },
});

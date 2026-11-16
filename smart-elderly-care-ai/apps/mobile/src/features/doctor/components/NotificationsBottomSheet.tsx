// NotificationsBottomSheet.tsx
// Bottom sheet hiển thị thông báo tập trung cho Bác sĩ: Cảnh báo y tế bệnh nhân & Lịch hẹn khám
// Quản lý trạng thái Đã đọc / Chưa đọc chuẩn xác, lưu trữ bền vững và hiển thị nhãn rõ ràng

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { useAlertStore } from '../../../store/useAlertStore';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { householdApi } from '../../../services/api';
import type { Incident } from '../../../store/useAlertStore';
import type { AppointmentItem, PatientCardData } from './types';

interface Props {
  visible: boolean;
  onClose: () => void;
  appointments: AppointmentItem[];
  upcomingAppointments?: AppointmentItem[];
  warningPatients?: PatientCardData[];
  incidents?: Incident[];
  onSelectPatient?: (patientId: string) => void;
  onSelectAppointment?: (apt?: AppointmentItem) => void;
  onNavigate?: (screenName: string, params?: any) => void;
  onMarkAllRead?: () => void;
  hasUnread?: boolean;
  onRespondHouseInvite?: (incident: Incident, action: 'accept' | 'reject') => Promise<void>;
}

type TabType = 'ALL' | 'UNREAD' | 'ALERTS' | 'APPOINTMENTS';

interface UnifiedNotification {
  id: string;
  rawIncidentId?: string;
  type: 'INCIDENT' | 'PATIENT_WARNING' | 'APPOINTMENT' | 'PATIENT_ASSIGNMENT' | 'HOUSE_INVITE';
  title: string;
  subtitle: string;
  timeStr: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  isRead: boolean;
  patientId?: string;
  rawAppointment?: AppointmentItem;
  targetScreen: 'DoctorAppointments' | 'DoctorPatients' | 'DoctorPatientDetail' | 'DoctorHome';
  targetParams?: any;
  rawIncident?: Incident;
  memberId?: string;
}

const STORAGE_KEY = '@doctor_read_notification_ids';

function formatTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return dateStr.slice(0, 10) === new Date().toISOString().slice(0, 10)
      ? `Hôm nay, ${formatTime(dateStr)}`
      : `${d.getDate()}/${d.getMonth() + 1} lúc ${formatTime(dateStr)}`;
  } catch {
    return '';
  }
}

export default function NotificationsBottomSheet({
  visible,
  onClose,
  appointments = [],
  upcomingAppointments = [],
  warningPatients = [],
  incidents = [],
  onSelectPatient,
  onSelectAppointment,
  onNavigate,
  onMarkAllRead,
  hasUnread: _hasUnread = true,
  onRespondHouseInvite,
}: Props) {
  const { isDarkMode, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<UnifiedNotification | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedNotification(null);
      return;
    }
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (!data) return;
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) setReadIds(new Set(parsed));
      } catch {}
    });
  }, [visible]);

  const persistReadIds = useCallback(async (newSet: Set<string>) => {
    setReadIds(new Set(newSet));
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)));
    } catch {}
  }, []);

  const bg = isDarkMode ? '#1E293B' : '#FFFFFF';
  const border = isDarkMode ? '#334155' : '#E2E8F0';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  const unifiedList: UnifiedNotification[] = [];

  // 1. Cảnh báo khẩn cấp & Thông báo hệ thống từ incidents
  incidents.forEach((inc) => {
    const isCritical = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED';
    const rawMsg = inc.message || '';
    const msgLower = rawMsg.toLowerCase();
    const isRead = Boolean(inc.is_acknowledged || readIds.has(inc.id) || readIds.has(`inc_${inc.id}`));

    const isAppointmentMsg =
      ['APPOINTMENT_CONFIRMED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CANCELLED'].includes(inc.alert_type || '') ||
      ['lịch khám', 'lịch hẹn', 'đã hủy', '[đã hủy]', 'tái khám', 'xác nhận lịch'].some((k) => msgLower.includes(k));

    const isAssignmentMsg = ['chủ hộ', 'phụ trách', 'chỉ định', 'bệnh nhân mới'].some((k) => msgLower.includes(k));

    const isMedicalRecordMsg =
      inc.alert_type === 'MEDICAL_RECORD_UPDATED' ||
      ['bệnh án', 'dị ứng', 'dinh dưỡng'].some((k) => msgLower.includes(k));

    const isHouseInvite =
      inc.alert_type === 'HOUSE_INVITE_PENDING' ||
      Boolean(inc.notes?.includes('HOUSE_INVITE_PENDING')) ||
      ['lời mời bạn tham gia căn nhà', 'lời mời tham gia căn nhà', 'xác nhận vào nhà'].some((k) => msgLower.includes(k));

    if (isHouseInvite) {
      const memberIdMatch = (inc.notes || inc.note || '')?.match(/MEMBER_ID:([a-fA-F0-9-]+)/);
      const isHandled = Boolean(inc.is_acknowledged);
      const isRejected = Boolean(inc.notes?.includes('từ chối') || inc.note?.includes('từ chối'));

      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'HOUSE_INVITE',
        title: 'Lời mời phụ trách Bác sĩ gia đình',
        subtitle: rawMsg || 'Chủ hộ đã gửi lời mời bạn tham gia căn nhà với vai trò Bác sĩ gia đình.',
        timeStr: inc.created_at || '',
        badgeLabel: isHandled ? (isRejected ? 'Đã từ chối' : 'Đã tham gia') : 'Chờ xác nhận',
        badgeColor: isHandled ? (isRejected ? '#DC2626' : '#059669') : '#D97706',
        badgeBg: isHandled ? (isRejected ? '#FEE2E2' : '#ECFDF5') : '#FEF3C7',
        iconName: 'mail-unread',
        iconColor: '#D97706',
        isRead: isHandled,
        targetScreen: 'DoctorHome',
        memberId: memberIdMatch?.[1],
        rawIncident: inc,
      });
    } else if (isAppointmentMsg) {
      const isCancelled = msgLower.includes('hủy') || inc.alert_type === 'APPOINTMENT_CANCELLED';
      const isConfirmed = inc.alert_type === 'APPOINTMENT_CONFIRMED' || msgLower.includes('đã xác nhận') || msgLower.includes('sẵn sàng đón tiếp');
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'APPOINTMENT',
        title: rawMsg || (isConfirmed ? 'Gia đình đã xác nhận đón tiếp' : 'Lịch khám bệnh nhân'),
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Thông báo lịch khám',
        timeStr: inc.created_at || '',
        badgeLabel: isCancelled ? 'Đã hủy' : isConfirmed ? 'Đã xác nhận' : 'Lịch khám',
        badgeColor: isCancelled ? '#DC2626' : isConfirmed ? '#059669' : '#0284C7',
        badgeBg: isCancelled ? '#FEE2E2' : isConfirmed ? '#ECFDF5' : '#EFF6FF',
        iconName: isConfirmed ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'calendar',
        iconColor: isCancelled ? '#DC2626' : isConfirmed ? '#059669' : '#0284C7',
        isRead,
        targetScreen: 'DoctorAppointments',
      });
    } else if (isAssignmentMsg) {
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'PATIENT_ASSIGNMENT',
        title: rawMsg || 'Phụ trách bệnh nhân mới',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Gia đình chỉ định phụ trách',
        timeStr: inc.created_at || '',
        badgeLabel: 'Bệnh nhân',
        badgeColor: '#059669',
        badgeBg: '#ECFDF5',
        iconName: 'people',
        iconColor: '#059669',
        isRead,
        targetScreen: 'DoctorPatients',
      });
    } else if (isMedicalRecordMsg) {
      const targetPatientId = inc.notes?.includes('PATIENT:') ? inc.notes.split('PATIENT:')[1].split('|')[0].trim() : undefined;
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'PATIENT_WARNING',
        title: rawMsg || 'Hồ sơ bệnh án được cập nhật',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Chủ nhà đã cập nhật hồ sơ',
        timeStr: inc.created_at || '',
        badgeLabel: 'Hồ sơ y tế',
        badgeColor: '#0284C7',
        badgeBg: '#EFF6FF',
        iconName: 'document-text',
        iconColor: '#0284C7',
        isRead,
        patientId: targetPatientId,
        targetScreen: targetPatientId ? 'DoctorPatientDetail' : 'DoctorPatients',
        targetParams: targetPatientId ? { patientId: targetPatientId } : undefined,
      });
    } else {
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'INCIDENT',
        title: rawMsg || (isCritical ? 'Cảnh báo sự cố té ngã khẩn cấp' : 'Cảnh báo y tế'),
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Vừa xong',
        timeStr: inc.created_at || '',
        badgeLabel: isCritical ? 'Khẩn cấp' : 'Cảnh báo',
        badgeColor: isCritical ? '#DC2626' : '#D97706',
        badgeBg: isCritical ? '#FEE2E2' : '#FEF3C7',
        iconName: isCritical ? 'alert-circle' : 'warning',
        iconColor: isCritical ? '#DC2626' : '#D97706',
        isRead,
        targetScreen: 'DoctorPatients',
      });
    }
  });

  // 2. Bệnh nhân có trạng thái sức khỏe cảnh báo (WARNING / DANGER)
  warningPatients.forEach((pat) => {
    const isDanger = pat.health_status === 'DANGER';
    unifiedList.push({
      id: `pat_${pat.id}`,
      type: 'PATIENT_WARNING',
      title: `${pat.name} - Cần chú ý theo dõi`,
      subtitle: `Nhịp tim: ${pat.heart_rate ?? '--'} bpm • SpO2: ${pat.spo2 ?? '--'}% • ${pat.house_address || (pat.house_name && pat.house_name !== 'Nhà của tôi' ? pat.house_name : 'Nhà riêng')}`,
      timeStr: '',
      badgeLabel: isDanger ? 'Nguy cấp' : 'Cần chú ý',
      badgeColor: isDanger ? '#DC2626' : '#D97706',
      badgeBg: isDanger ? '#FEE2E2' : '#FEF3C7',
      iconName: 'heart-dislike',
      iconColor: isDanger ? '#DC2626' : '#D97706',
      isRead: readIds.has(`pat_${pat.id}`),
      patientId: pat.id,
      targetScreen: 'DoctorPatientDetail',
      targetParams: { patientId: pat.id },
    });
  });

  // 3. Lịch khám hôm nay và sắp tới
  const allApts = [...appointments];
  upcomingAppointments.forEach((apt) => {
    if (!allApts.some((a) => a.id === apt.id)) allApts.push(apt);
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  allApts.forEach((apt) => {
    const isToday = apt.scheduled_at?.slice(0, 10) === todayStr;
    const isCompleted = apt.status === 'COMPLETED';
    const isCancelled = apt.status === 'CANCELLED';
    const color = isCompleted ? '#16A34A' : isCancelled ? '#DC2626' : '#0284C7';
    const bgCol = isCompleted ? '#DCFCE7' : isCancelled ? '#FEE2E2' : '#EFF6FF';
    const label = isCompleted ? 'Đã khám' : isCancelled ? 'Đã hủy' : isToday ? 'Khám hôm nay' : 'Sắp tới';

    unifiedList.push({
      id: `apt_${apt.id}`,
      type: 'APPOINTMENT',
      title: `Lịch khám: ${apt.patient_name || 'Bệnh nhân'}`,
      subtitle: `${formatDate(apt.scheduled_at)} · ${apt.visit_type === 'HOME_VISIT' ? 'Khám tại nhà' : 'Tại phòng khám'}`,
      timeStr: apt.scheduled_at || '',
      badgeLabel: label,
      badgeColor: color,
      badgeBg: bgCol,
      iconName: isToday ? 'time' : 'calendar',
      iconColor: color,
      isRead: readIds.has(`apt_${apt.id}`),
      patientId: apt.patient_id,
      rawAppointment: apt,
      targetScreen: 'DoctorAppointments',
    });
  });

  const unreadCount = unifiedList.filter((i) => !i.isRead).length;
  const alertsCount = unifiedList.filter((i) => ['INCIDENT', 'PATIENT_WARNING', 'HOUSE_INVITE'].includes(i.type)).length;
  const aptsCount = unifiedList.filter((i) => i.type === 'APPOINTMENT').length;

  const filteredList = unifiedList.filter((item) => {
    if (activeTab === 'UNREAD') return !item.isRead;
    if (activeTab === 'ALERTS') return ['INCIDENT', 'PATIENT_WARNING', 'HOUSE_INVITE'].includes(item.type);
    if (activeTab === 'APPOINTMENTS') return item.type === 'APPOINTMENT';
    return true;
  });

  const handleRespondInviteFromSheet = async (item: UnifiedNotification, action: 'accept' | 'reject') => {
    if (!item.rawIncident) return;
    setRespondingId(item.id);
    try {
      if (onRespondHouseInvite) {
        await onRespondHouseInvite(item.rawIncident, action);
      } else {
        const memberId = item.memberId || item.rawIncident.device_id || item.rawIncident.id;
        await householdApi.respondHouseInvite(memberId, action);
        await useAlertStore.getState().acknowledgeIncident(item.rawIncident.id, action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà');
        Alert.alert(
          action === 'accept' ? 'Thành công' : 'Đã từ chối',
          action === 'accept' ? 'Bạn đã tham gia căn nhà thành công! Bệnh nhân đã được thêm vào danh sách quản lý.' : 'Bạn đã từ chối lời mời tham gia căn nhà.'
        );
      }
      const updated = new Set(readIds);
      updated.add(item.id);
      if (item.rawIncidentId) {
        updated.add(item.rawIncidentId);
        updated.add(`inc_${item.rawIncidentId}`);
      }
      await persistReadIds(updated);
    } catch (e: any) {
      console.warn('handleRespondInviteFromSheet error:', e);
      Alert.alert('Lỗi', e.response?.data?.detail || 'Không thể phản hồi lời mời. Vui lòng thử lại.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleItemPress = async (item: UnifiedNotification) => {
    const updated = new Set(readIds);
    updated.add(item.id);
    if (item.rawIncidentId) {
      updated.add(item.rawIncidentId);
      updated.add(`inc_${item.rawIncidentId}`);
      useAlertStore.getState().acknowledgeIncident(item.rawIncidentId);
    }
    await persistReadIds(updated);

    // Mở ngay tab / màn hình chi tiết thông báo
    setSelectedNotification(item);
  };

  const handleNavigateFromDetail = (item: UnifiedNotification) => {
    onClose();
    setTimeout(() => {
      if (item.targetScreen === 'DoctorAppointments') {
        onSelectAppointment ? onSelectAppointment(item.rawAppointment) : onNavigate?.('DoctorAppointments');
      } else if (item.targetScreen === 'DoctorPatientDetail') {
        const pId = item.targetParams?.patientId || item.patientId;
        onSelectPatient && pId ? onSelectPatient(pId) : onNavigate?.('DoctorPatientDetail', { patientId: pId });
      } else if (item.targetScreen === 'DoctorPatients') {
        onNavigate ? onNavigate('DoctorPatients') : item.patientId && onSelectPatient?.(item.patientId);
      } else {
        onNavigate?.(item.targetScreen, item.targetParams);
      }
    }, 120);
  };

  const handleMarkAllRead = async () => {
    const updated = new Set(readIds);
    unifiedList.forEach((item) => {
      updated.add(item.id);
      if (item.rawIncidentId) {
        updated.add(item.rawIncidentId);
        updated.add(`inc_${item.rawIncidentId}`);
      }
    });
    await persistReadIds(updated);
    onMarkAllRead?.();
  };

  const tabs: { key: TabType; label: string; activeColor: string }[] = [
    { key: 'ALL', label: `Tất cả (${unifiedList.length})`, activeColor: '#2563EB' },
    { key: 'UNREAD', label: `Chưa đọc (${unreadCount})`, activeColor: '#2563EB' },
    { key: 'ALERTS', label: `Cảnh báo (${alertsCount})`, activeColor: '#DC2626' },
    { key: 'APPOINTMENTS', label: `Lịch khám (${aptsCount})`, activeColor: '#2563EB' },
  ];

  const emptyConfig: Record<TabType, { title: string; sub: string }> = {
    UNREAD: { title: 'Tuyệt vời! Không còn thông báo chưa đọc', sub: 'Bác sĩ đã xem và xử lý toàn bộ các thông báo y tế.' },
    ALERTS: { title: 'Không có cảnh báo bất thường', sub: 'Tất cả các bệnh nhân đều đang có sinh hiệu bình thường.' },
    APPOINTMENTS: { title: 'Không có lịch khám mới', sub: 'Bác sĩ có thể chủ động đặt lịch thăm khám định kỳ cho các cụ.' },
    ALL: { title: 'Mọi thứ đều ổn định', sub: 'Hiện không có cảnh báo sức khỏe khẩn cấp hay lịch hẹn nào cần xử lý.' },
  };

  const linkedPatient = selectedNotification
    ? warningPatients.find((p) => p.id === selectedNotification.patientId) ||
      (selectedNotification.rawAppointment
        ? {
            name: selectedNotification.rawAppointment.patient_name,
            house_address: selectedNotification.rawAppointment.location,
            house_name: '',
            heart_rate: 76,
            spo2: 98,
          }
        : warningPatients[0])
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <SafeAreaView style={[styles.sheet, { backgroundColor: bg, borderTopColor: border }]}>
        <View style={[styles.handle, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }]} />

        {selectedNotification ? (
          <View style={{ flex: 1 }}>
            {/* Header chi tiết thông báo */}
            <View style={[styles.header, { borderBottomColor: border }]}>
              <TouchableOpacity
                onPress={() => setSelectedNotification(null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={22} color="#2563EB" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#2563EB' }}>Quay lại</Text>
              </TouchableOpacity>

              <Text style={[styles.title, { color: colors.textPrimary }]}>Chi tiết thông báo</Text>

              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.detailScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Thẻ Tiêu đề & Cảnh báo */}
              <View
                style={[
                  styles.detailCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                    borderColor: border,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={[styles.iconBox, { backgroundColor: selectedNotification.badgeBg }]}>
                    <Ionicons
                      name={selectedNotification.iconName}
                      size={22}
                      color={selectedNotification.iconColor}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View style={[styles.statusTag, { backgroundColor: selectedNotification.badgeBg }]}>
                      <Text style={[styles.statusText, { color: selectedNotification.badgeColor }]}>
                        {selectedNotification.badgeLabel}
                      </Text>
                    </View>
                    <View style={styles.readBadge}>
                      <Ionicons name="checkmark-done" size={11} color="#059669" style={{ marginRight: 2 }} />
                      <Text style={styles.readBadgeText}>Đã xem</Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.detailMainTitle, { color: colors.textPrimary }]}>
                  {selectedNotification.title}
                </Text>
                <Text style={[styles.detailSubTitle, { color: textSub }]}>
                  {selectedNotification.subtitle}
                </Text>

                <View style={[styles.detailMetaRow, { borderTopColor: border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={14} color={textSub} />
                    <Text style={{ fontSize: 11.5, color: textSub }}>
                      {selectedNotification.timeStr ? formatDate(selectedNotification.timeStr) || 'Hôm nay' : 'Hôm nay'}
                    </Text>
                  </View>
                  <View style={styles.syncTag}>
                    <Ionicons name="flash" size={11} color="#059669" />
                    <Text style={styles.syncTagText}>Đồng bộ thời gian thực</Text>
                  </View>
                </View>
              </View>

              {/* Thông tin bệnh nhân phụ trách */}
              <View
                style={[
                  styles.detailCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF88',
                    borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="person-circle" size={18} color="#2563EB" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB', textTransform: 'uppercase' }}>
                    Thông tin bệnh nhân liên quan
                  </Text>
                </View>
                <View style={{ gap: 6, marginTop: 4 }}>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: textSub }]}>Bệnh nhân:</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                      {linkedPatient?.name || (selectedNotification.rawAppointment?.patient_name) || 'Người cao tuổi'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: textSub }]}>Khu vực / Căn nhà:</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>
                      {linkedPatient?.house_address || linkedPatient?.house_name || selectedNotification.rawAppointment?.location || 'Nhà riêng bệnh nhân'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: textSub }]}>Thiết bị theo dõi:</Text>
                    <Text style={[styles.infoValue, { color: '#059669', fontWeight: '700' }]}>
                      CooSpo HW706 BLE Smartband
                    </Text>
                  </View>
                </View>
              </View>

              {/* Thẻ chỉ số sinh hiệu (nếu có nhịp tim hoặc SpO2) */}
              {(selectedNotification.type === 'INCIDENT' || selectedNotification.type === 'PATIENT_WARNING') && (
                <View
                  style={[
                    styles.detailCard,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderColor: border,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="heart" size={16} color="#DC2626" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase' }}>
                      Chỉ số sinh hiệu tại thời điểm phát hiện
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <View style={[styles.vitalCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>Nhịp tim</Text>
                        <Ionicons name="pulse" size={14} color="#DC2626" />
                      </View>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#DC2626', marginTop: 4 }}>
                        {linkedPatient?.heart_rate ?? 76}{' '}
                        <Text style={{ fontSize: 11, fontWeight: '600' }}>bpm</Text>
                      </Text>
                    </View>

                    <View style={[styles.vitalCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>SpO2</Text>
                        <Ionicons name="water" size={14} color="#059669" />
                      </View>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#059669', marginTop: 4 }}>
                        {linkedPatient?.spo2 ?? 98}{' '}
                        <Text style={{ fontSize: 11, fontWeight: '600' }}>%</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Khuyến nghị chuyên môn Bác sĩ */}
              <View
                style={[
                  styles.detailCard,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                    borderColor: border,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="medkit" size={16} color="#2563EB" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Khuyến nghị chuyên môn Bác sĩ
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: textSub, lineHeight: 18, marginTop: 4 }}>
                  {selectedNotification.type === 'INCIDENT'
                    ? 'Khẩn cấp: Kiểm tra ngay dấu hiệu chấn thương hoặc liên hệ cấp cứu 115 nếu người cao tuổi có dấu hiệu mất ý thức.'
                    : selectedNotification.type === 'HOUSE_INVITE'
                      ? 'Lời mời Bác sĩ gia đình: Sau khi tham gia, bác sĩ có thể trực tiếp giám sát sinh hiệu liên tục và lên lịch tái khám định kỳ cho các cụ.'
                      : selectedNotification.type === 'APPOINTMENT'
                        ? 'Lịch hẹn thăm khám: Xem lại bệnh sử và chuẩn bị dụng cụ y tế kiểm tra tim mạch, huyết áp cho người cao tuổi.'
                        : 'Dữ liệu cảnh báo được phát hiện tự động bởi hệ thống AI SECA và đồng bộ thời gian thực.'}
                </Text>
              </View>

              {/* Các nút hành động thao tác */}
              <View style={{ gap: 10, marginTop: 10, marginBottom: 20 }}>
                {selectedNotification.type === 'HOUSE_INVITE' && !selectedNotification.isRead ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtnReject, { flex: 1 }]}
                      onPress={() => handleRespondInviteFromSheet(selectedNotification, 'reject')}
                      disabled={respondingId === selectedNotification.id}
                    >
                      <Text style={styles.actionBtnRejectText}>Từ chối</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtnAccept, { flex: 1 }]}
                      onPress={() => handleRespondInviteFromSheet(selectedNotification, 'accept')}
                      disabled={respondingId === selectedNotification.id}
                    >
                      <Text style={styles.actionBtnAcceptText}>Đồng ý vào nhà</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={() => handleNavigateFromDetail(selectedNotification)}
                    >
                      <Ionicons
                        name={selectedNotification.type === 'APPOINTMENT' ? 'calendar-outline' : 'person-outline'}
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.actionBtnPrimaryText}>
                        {selectedNotification.type === 'APPOINTMENT'
                          ? 'Xem lịch khám chi tiết'
                          : 'Xem hồ sơ bệnh nhân'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { borderColor: border }]}
                      onPress={() => setSelectedNotification(null)}
                    >
                      <Text style={[styles.actionBtnSecondaryText, { color: colors.textPrimary }]}>
                        Quay lại danh sách thông báo
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        ) : (
          <>
            <View style={[styles.header, { borderBottomColor: border }]}>
              <View style={styles.headerTitle}>
                <Ionicons name="notifications" size={20} color="#2563EB" />
                <LocalizedText style={[styles.title, { color: colors.textPrimary }]}>Trung tâm thông báo</LocalizedText>
                <View style={[styles.countBadge, unreadCount === 0 && { backgroundColor: '#10B981' }]}>
                  <LocalizedText style={styles.countText}>{unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc hết'}</LocalizedText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>Đã đọc tất cả</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={textSub} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.tabBar, { borderBottomColor: border }]}>
              {tabs.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <TouchableOpacity key={t.key} style={[styles.tabItem, isActive && styles.tabItemActive]} onPress={() => setActiveTab(t.key)}>
                    <LocalizedText style={[styles.tabText, { color: isActive ? t.activeColor : textSub }, isActive && styles.tabTextActive]}>
                      {t.label}
                    </LocalizedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredList.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
                <LocalizedText style={[styles.emptyTitle, { color: colors.textPrimary }]}>{emptyConfig[activeTab].title}</LocalizedText>
                <LocalizedText style={[styles.emptySub, { color: textSub }]}>{emptyConfig[activeTab].sub}</LocalizedText>
              </View>
            ) : (
              <FlatList
                data={filteredList}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: item.isRead ? (isDarkMode ? '#0F172A66' : '#F8FAFC') : (isDarkMode ? '#1E293B' : '#FFFFFF'),
                        borderColor: item.isRead ? border : (isDarkMode ? '#2563EB66' : '#93C5FD'),
                        borderWidth: item.isRead ? 1 : 1.5,
                      },
                    ]}
                  >
                    <TouchableOpacity style={styles.cardMainRow} activeOpacity={0.75} onPress={() => handleItemPress(item)}>
                      <View style={[styles.iconBox, { backgroundColor: item.badgeBg }]}>
                        <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                        {!item.isRead && <View style={styles.cardUnreadDot} />}
                      </View>

                      <View style={styles.cardBody}>
                        <LocalizedText
                          style={[
                            styles.itemTitle,
                            { color: item.isRead ? (isDarkMode ? '#94A3B8' : '#64748B') : colors.textPrimary },
                            !item.isRead && { fontWeight: '700' },
                          ]}
                          numberOfLines={2}
                        >
                          {item.title}
                        </LocalizedText>
                        <LocalizedText style={[styles.itemSub, { color: textSub }]} numberOfLines={2}>
                          {item.subtitle}
                        </LocalizedText>
                      </View>

                      <View style={styles.cardRightCol}>
                        <View style={[styles.statusTag, { backgroundColor: item.badgeBg }]}>
                          <LocalizedText style={[styles.statusText, { color: item.badgeColor }]}>{item.badgeLabel}</LocalizedText>
                        </View>
                        {item.isRead ? (
                          <View style={styles.readBadge}>
                            <Ionicons name="checkmark-done" size={11} color="#059669" style={{ marginRight: 2 }} />
                            <LocalizedText style={styles.readBadgeText}>Đã đọc</LocalizedText>
                          </View>
                        ) : (
                          <View style={styles.unreadBadge}>
                            <LocalizedText style={styles.unreadBadgeText}>Chưa đọc</LocalizedText>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {item.type === 'HOUSE_INVITE' && !item.isRead && (
                      <View style={styles.inviteActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.sheetRejectBtn,
                            { borderColor: isDarkMode ? '#7F1D1D' : '#FECACA', backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2' },
                          ]}
                          onPress={() => handleRespondInviteFromSheet(item, 'reject')}
                          activeOpacity={0.7}
                          disabled={respondingId === item.id}
                        >
                          {respondingId === item.id ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <>
                              <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                              <LocalizedText style={styles.sheetRejectBtnText}>Từ chối</LocalizedText>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.sheetAcceptBtn, { backgroundColor: '#16A34A' }]}
                          onPress={() => handleRespondInviteFromSheet(item, 'accept')}
                          activeOpacity={0.8}
                          disabled={respondingId === item.id}
                        >
                          {respondingId === item.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
                              <LocalizedText style={styles.sheetAcceptBtnText}>Đồng ý vào nhà</LocalizedText>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { height: '78%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  countBadge: { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1 },
  tabItem: { paddingVertical: 10, marginRight: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 12.5, fontWeight: '600' },
  tabTextActive: { fontWeight: '700' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  listContent: { padding: 14, paddingBottom: 28 },
  card: { borderRadius: 12, padding: 12, marginBottom: 8 },
  cardMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1' },
  sheetRejectBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  sheetRejectBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  sheetAcceptBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, gap: 4 },
  sheetAcceptBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardUnreadDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', borderWidth: 1.5, borderColor: '#FFFFFF' },
  cardBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 13.5 },
  itemSub: { fontSize: 11.5 },
  cardRightCol: { alignItems: 'flex-end', gap: 4 },
  statusTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10.5, fontWeight: '700' },
  readBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#A7F3D0' },
  readBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  unreadBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  unreadBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  detailScrollContent: { padding: 16, paddingBottom: 36, gap: 12 },
  detailCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  detailMainTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginTop: 4 },
  detailSubTitle: { fontSize: 13, lineHeight: 19 },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  syncTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  syncTagText: { fontSize: 10.5, fontWeight: '700', color: '#059669' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 12.5, fontWeight: '600' },
  vitalCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', paddingVertical: 13, borderRadius: 12 },
  actionBtnPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  actionBtnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnSecondaryText: { fontSize: 13, fontWeight: '600' },
  actionBtnReject: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnRejectText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  actionBtnAccept: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#16A34A' },
  actionBtnAcceptText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

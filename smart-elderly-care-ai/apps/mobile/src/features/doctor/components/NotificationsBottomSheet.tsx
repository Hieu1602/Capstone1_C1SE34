// NotificationsBottomSheet.tsx
// Bottom sheet hiển thị thông báo tập trung cho Bác sĩ: Cảnh báo y tế bệnh nhân & Lịch hẹn khám

import React, { useState, useEffect, useCallback } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { useAlertStore, isUrgentIncident } from '../../../store/useAlertStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { adminBroadcastsApi, householdApi, incidentsApi, SystemAnnouncement } from '../../../services/api';
import { alertsWS } from '../../../services/websocket';
import type { Incident } from '../../../store/useAlertStore';
import type { AppointmentItem, PatientCardData } from './types';
import {
  TabType,
  UnifiedNotification,
  EMPTY_TAB_CONFIG,
  buildUnifiedNotifications,
} from './notifications/notificationHelpers';
import { NotificationDetailView } from './notifications/NotificationDetailView';
import { NotificationListItem } from './notifications/NotificationListItem';

interface Props {
  visible: boolean;
  onClose: () => void;
  appointments: AppointmentItem[];
  upcomingAppointments?: AppointmentItem[];
  patients?: PatientCardData[];
  warningPatients?: PatientCardData[];
  incidents?: Incident[];
  onSelectPatient?: (patientId: string) => void;
  onSelectAppointment?: (apt?: AppointmentItem) => void;
  onNavigate?: (screenName: string, params?: any) => void;
  onMarkAllRead?: () => void;
  onUnreadCountChange?: (count: number) => void;
  hasUnread?: boolean;
  onRespondHouseInvite?: (incident: Incident, action: 'accept' | 'reject') => Promise<void>;
}

const STORAGE_KEY = '@doctor_read_notification_ids';
/** Khóa lưu "đã đọc" theo từng tài khoản – tránh 2 bác sĩ dùng chung máy dùng chung trạng thái */
export const readIdsStorageKey = (userId?: string | null) => `${STORAGE_KEY}:${userId || 'anonymous'}`;

export default function NotificationsBottomSheet({
  visible,
  onClose,
  appointments = [],
  upcomingAppointments = [],
  patients = [],
  warningPatients = [],
  incidents = [],
  onSelectPatient,
  onSelectAppointment,
  onNavigate,
  onMarkAllRead,
  onUnreadCountChange,
  hasUnread: _hasUnread = true,
  onRespondHouseInvite,
}: Props) {
  const { isDarkMode, colors } = useTheme();
  const { userId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [adminBroadcasts, setAdminBroadcasts] = useState<SystemAnnouncement[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<UnifiedNotification | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedNotification(null);
      return;
    }
    AsyncStorage.getItem(readIdsStorageKey(userId)).then((data) => {
      if (!data) {
        setReadIds(new Set());
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) setReadIds(new Set(parsed));
      } catch {}
    });
    adminBroadcastsApi
      .getActive('doctors')
      .then((res) => {
        if (Array.isArray(res.data)) setAdminBroadcasts(res.data);
      })
      .catch(() => {});
    incidentsApi
      .getReadState()
      .then((res) => {
        const list = res.data?.read_ids;
        if (Array.isArray(list)) {
          const next = new Set<string>(list);
          setReadIds(next);
          AsyncStorage.setItem(readIdsStorageKey(userId), JSON.stringify(list)).catch(() => {});
        }
      })
      .catch(() => {});

    const unsub = alertsWS.subscribe((event: any) => {
      if (
        event?.type === 'NOTIFICATION_READ_STATE_UPDATED' &&
        (!event.user_id || !userId || String(event.user_id) === String(userId)) &&
        Array.isArray(event.read_ids)
      ) {
        const next = new Set<string>(event.read_ids);
        setReadIds(next);
        AsyncStorage.setItem(readIdsStorageKey(userId), JSON.stringify(event.read_ids)).catch(() => {});
      }
    });
    return () => unsub();
  }, [visible, userId]);

  const persistReadIds = useCallback(async (newSet: Set<string>) => {
    setReadIds(new Set(newSet));
    try {
      await AsyncStorage.setItem(readIdsStorageKey(userId), JSON.stringify(Array.from(newSet)));
    } catch {}
  }, [userId]);

  const bg = isDarkMode ? '#1E293B' : '#FFFFFF';
  const border = isDarkMode ? '#334155' : '#E2E8F0';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  const unifiedList = buildUnifiedNotifications({
    incidents,
    warningPatients,
    patients,
    appointments,
    upcomingAppointments,
    readIds,
    adminBroadcasts,
    doctorUserId: userId || undefined,
  });

  const unreadCount = unifiedList.filter((i) => !i.isRead).length;
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);
  const adminCount = unifiedList.filter((i) => i.type === 'ADMIN').length;
  const alertsCount = unifiedList.filter((i) => ['INCIDENT', 'PATIENT_WARNING', 'HOUSE_INVITE'].includes(i.type)).length;
  const aptsCount = unifiedList.filter((i) => i.type === 'APPOINTMENT').length;

  const filteredList = unifiedList.filter((item) => {
    if (activeTab === 'UNREAD') return !item.isRead;
    if (activeTab === 'ADMIN') return item.type === 'ADMIN';
    if (activeTab === 'ALERTS') return ['INCIDENT', 'PATIENT_WARNING', 'HOUSE_INVITE'].includes(item.type);
    if (activeTab === 'APPOINTMENTS') return item.type === 'APPOINTMENT';
    return true;
  });

  const collectItemIds = (item: UnifiedNotification): string[] => {
    const ids = [item.id];
    if (item.rawIncidentId) {
      ids.push(item.rawIncidentId, `inc_${item.rawIncidentId}`);
    }
    return ids;
  };

  const addReadId = (set: Set<string>, item: UnifiedNotification) => {
    collectItemIds(item).forEach((id) => set.add(id));
  };

  const handleRespondInviteFromSheet = async (item: UnifiedNotification, action: 'accept' | 'reject') => {
    if (!item.rawIncident) return;
    setRespondingId(item.id);
    try {
      if (onRespondHouseInvite) {
        await onRespondHouseInvite(item.rawIncident, action);
      } else {
        const memberId = item.memberId || item.rawIncident.device_id || item.rawIncident.id;
        await householdApi.respondHouseInvite(memberId, action);
        await useAlertStore.getState().acknowledgeIncident(
          item.rawIncident.id,
          action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà'
        );
        Alert.alert(
          action === 'accept' ? 'Thành công' : 'Đã từ chối',
          action === 'accept'
            ? 'Bạn đã tham gia căn nhà thành công! Bệnh nhân đã được thêm vào danh sách quản lý.'
            : 'Bạn đã từ chối lời mời tham gia căn nhà.'
        );
      }
      const updated = new Set(readIds);
      addReadId(updated, item);
      await persistReadIds(updated);
      incidentsApi.updateReadState(collectItemIds(item)).catch(() => {});
    } catch (e: any) {
      console.warn('handleRespondInviteFromSheet error:', e);
      Alert.alert('Lỗi', e.response?.data?.detail || 'Không thể phản hồi lời mời. Vui lòng thử lại.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleItemPress = async (item: UnifiedNotification) => {
    // Không tự động acknowledge lời mời tham gia nhà hoặc sự cố đã xử lý sẵn khi mới bấm xem chi tiết
    if (item.type !== 'HOUSE_INVITE') {
      const updated = new Set(readIds);
      addReadId(updated, item);
      // Mở xem = "đã đọc". Chỉ thông báo thường mới xác nhận lên server (đồng bộ web <-> app);
      // cảnh báo khẩn cấp phải bấm "Đã xử lý" rõ ràng, tránh tắt chuông & hủy gọi cấp cứu của gia đình
      if (
        item.rawIncidentId &&
        !item.isRead &&
        !item.rawIncident?.is_acknowledged &&
        !isUrgentIncident(item.rawIncident)
      ) {
        useAlertStore.getState().acknowledgeIncident(item.rawIncidentId);
      }
      await persistReadIds(updated);
      incidentsApi.updateReadState(collectItemIds(item)).catch(() => {});
    }
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
    const addedIds: string[] = [];
    unifiedList.forEach((item) => {
      if (item.type !== 'HOUSE_INVITE' || item.isRead) {
        addReadId(updated, item);
        addedIds.push(...collectItemIds(item));
      }
    });
    await persistReadIds(updated);
    incidentsApi.updateReadState(addedIds).catch(() => {});
    onMarkAllRead?.();
  };

  const tabs: { key: TabType; label: string; activeColor: string }[] = [
    { key: 'ALL', label: `Tất cả (${unifiedList.length})`, activeColor: '#2563EB' },
    { key: 'UNREAD', label: `Chưa đọc (${unreadCount})`, activeColor: '#2563EB' },
    { key: 'ADMIN', label: `Admin (${adminCount})`, activeColor: '#0284C7' },
    { key: 'ALERTS', label: `Cảnh báo (${alertsCount})`, activeColor: '#DC2626' },
    { key: 'APPOINTMENTS', label: `Lịch khám (${aptsCount})`, activeColor: '#2563EB' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <SafeAreaView style={[styles.sheet, { backgroundColor: bg, borderTopColor: border }]}>
        <View style={[styles.handle, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }]} />

        {selectedNotification ? (
          <NotificationDetailView
            item={selectedNotification}
            warningPatients={patients.length > 0 ? patients : warningPatients}
            respondingId={respondingId}
            isDarkMode={isDarkMode}
            colors={colors}
            border={border}
            textSub={textSub}
            onBack={() => setSelectedNotification(null)}
            onClose={onClose}
            onNavigate={handleNavigateFromDetail}
            onRespondInvite={handleRespondInviteFromSheet}
          />
        ) : (
          <>
            <View style={[styles.header, { borderBottomColor: border }]}>
              <View style={styles.headerTopRow}>
                <View style={styles.headerTitle}>
                  <View style={[styles.headerIconBox, { backgroundColor: isDarkMode ? '#1E3A8A55' : '#EFF6FF' }]}>
                    <Ionicons name="notifications" size={18} color="#2563EB" />
                  </View>
                  <LocalizedText style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    Trung tâm thông báo
                  </LocalizedText>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={18} color={textSub} />
                </TouchableOpacity>
              </View>

              <View style={styles.headerMetaRow}>
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor:
                        unreadCount > 0
                          ? (isDarkMode ? '#1E3A8A66' : '#EFF6FF')
                          : (isDarkMode ? '#064E3B66' : '#ECFDF5'),
                      borderColor:
                        unreadCount > 0
                          ? (isDarkMode ? '#3B82F644' : '#BFDBFE')
                          : (isDarkMode ? '#10B98144' : '#A7F3D0'),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.countDot,
                      { backgroundColor: unreadCount > 0 ? '#2563EB' : '#059669' },
                    ]}
                  />
                  <LocalizedText
                    style={[
                      styles.countText,
                      {
                        color:
                          unreadCount > 0
                            ? (isDarkMode ? '#93C5FD' : '#1D4ED8')
                            : (isDarkMode ? '#6EE7B7' : '#047857'),
                      },
                    ]}
                  >
                    {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc hết'}
                  </LocalizedText>
                </View>

                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={handleMarkAllRead}
                    style={[
                      styles.markAllBtn,
                      {
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderColor: isDarkMode ? '#334155' : '#DBEAFE',
                      },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="checkmark-done-outline" size={14} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                    <LocalizedText style={[styles.markAllText, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>
                      Đã đọc tất cả
                    </LocalizedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ borderBottomWidth: 1, borderBottomColor: border }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
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
              </ScrollView>
            </View>

            {filteredList.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
                <LocalizedText style={[styles.emptyTitle, { color: colors.textPrimary }]}>{EMPTY_TAB_CONFIG[activeTab].title}</LocalizedText>
                <LocalizedText style={[styles.emptySub, { color: textSub }]}>{EMPTY_TAB_CONFIG[activeTab].sub}</LocalizedText>
              </View>
            ) : (
              <FlatList
                data={filteredList}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <NotificationListItem
                    item={item}
                    respondingId={respondingId}
                    isDarkMode={isDarkMode}
                    colors={colors}
                    border={border}
                    textSub={textSub}
                    onPress={handleItemPress}
                    onRespondInvite={handleRespondInviteFromSheet}
                  />
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
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countDot: { width: 6, height: 6, borderRadius: 3 },
  countText: { fontSize: 12, fontWeight: '700' },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: 10,
    borderWidth: 1,
  },
  markAllText: { fontSize: 12, fontWeight: '700' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16 },
  tabItem: { paddingVertical: 11, marginRight: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 12.5, fontWeight: '600' },
  tabTextActive: { fontWeight: '700' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  listContent: { padding: 14, paddingBottom: 28 },
});

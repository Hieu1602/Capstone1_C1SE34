// NotificationsBottomSheet.tsx
// Bottom sheet hiển thị thông báo tập trung cho Bác sĩ: Cảnh báo y tế bệnh nhân & Lịch hẹn khám

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { useAlertStore } from '../../../store/useAlertStore';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { householdApi } from '../../../services/api';
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
  warningPatients?: PatientCardData[];
  incidents?: Incident[];
  onSelectPatient?: (patientId: string) => void;
  onSelectAppointment?: (apt?: AppointmentItem) => void;
  onNavigate?: (screenName: string, params?: any) => void;
  onMarkAllRead?: () => void;
  hasUnread?: boolean;
  onRespondHouseInvite?: (incident: Incident, action: 'accept' | 'reject') => Promise<void>;
}

const STORAGE_KEY = '@doctor_read_notification_ids';

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

  const unifiedList = buildUnifiedNotifications({
    incidents,
    warningPatients,
    appointments,
    upcomingAppointments,
    readIds,
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

  const addReadId = (set: Set<string>, item: UnifiedNotification) => {
    set.add(item.id);
    if (item.rawIncidentId) {
      set.add(item.rawIncidentId);
      set.add(`inc_${item.rawIncidentId}`);
    }
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
    } catch (e: any) {
      console.warn('handleRespondInviteFromSheet error:', e);
      Alert.alert('Lỗi', e.response?.data?.detail || 'Không thể phản hồi lời mời. Vui lòng thử lại.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleItemPress = async (item: UnifiedNotification) => {
    const updated = new Set(readIds);
    addReadId(updated, item);
    if (item.rawIncidentId) {
      useAlertStore.getState().acknowledgeIncident(item.rawIncidentId);
    }
    await persistReadIds(updated);
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
    unifiedList.forEach((item) => addReadId(updated, item));
    await persistReadIds(updated);
    onMarkAllRead?.();
  };

  const tabs: { key: TabType; label: string; activeColor: string }[] = [
    { key: 'ALL', label: `Tất cả (${unifiedList.length})`, activeColor: '#2563EB' },
    { key: 'UNREAD', label: `Chưa đọc (${unreadCount})`, activeColor: '#2563EB' },
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
            warningPatients={warningPatients}
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
});

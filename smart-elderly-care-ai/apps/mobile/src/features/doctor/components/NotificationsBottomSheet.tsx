// NotificationsBottomSheet.tsx
// Bottom sheet hiển thị thông báo tập trung cho Bác sĩ: Cảnh báo y tế bệnh nhân & Lịch hẹn khám

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
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
}

type TabType = 'ALL' | 'ALERTS' | 'APPOINTMENTS';

interface UnifiedNotification {
  id: string;
  type: 'INCIDENT' | 'PATIENT_WARNING' | 'APPOINTMENT' | 'PATIENT_ASSIGNMENT';
  title: string;
  subtitle: string;
  timeStr: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  patientId?: string;
  rawAppointment?: AppointmentItem;
  targetScreen: 'DoctorAppointments' | 'DoctorPatients' | 'DoctorPatientDetail';
  targetParams?: any;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const today = new Date().toISOString().slice(0, 10);
    const dateOnly = dateStr.slice(0, 10);
    if (dateOnly === today) return `Hôm nay, ${formatTime(dateStr)}`;
    return `${d.getDate()}/${d.getMonth() + 1} lúc ${formatTime(dateStr)}`;
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
  hasUnread = true,
}: Props) {
  const { isDarkMode, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('ALL');

  const bg = isDarkMode ? '#1E293B' : '#FFFFFF';
  const cardBg = isDarkMode ? '#0F172A' : '#F8FAFC';
  const border = isDarkMode ? '#334155' : '#E2E8F0';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  // Chuyển đổi các nguồn dữ liệu thành danh sách thông báo thống nhất
  const unifiedList: UnifiedNotification[] = [];

  // 1. Cảnh báo khẩn cấp & Thông báo hệ thống từ incidents
  incidents.forEach((inc) => {
    const isCritical = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED';
    const rawMsg = inc.message || '';
    const msgLower = rawMsg.toLowerCase();

    // 1.1 Thông báo liên quan đến lịch khám (Hủy, Dời lịch, Đặt lịch)
    const isAppointmentMsg =
      msgLower.includes('lịch khám') ||
      msgLower.includes('lịch hẹn') ||
      msgLower.includes('đã hủy') ||
      msgLower.includes('[đã hủy]') ||
      msgLower.includes('tái khám');

    // 1.2 Thông báo chỉ định / phụ trách bệnh nhân từ chủ hộ gia đình
    const isAssignmentMsg =
      msgLower.includes('chủ hộ') ||
      msgLower.includes('phụ trách') ||
      msgLower.includes('chỉ định') ||
      msgLower.includes('bệnh nhân mới');

    if (isAppointmentMsg) {
      const isCancelled = msgLower.includes('hủy');
      unifiedList.push({
        id: `inc_${inc.id}`,
        type: 'APPOINTMENT',
        title: rawMsg || 'Lịch khám bệnh nhân',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Thông báo lịch khám',
        timeStr: inc.created_at || '',
        badgeLabel: isCancelled ? 'Đã hủy' : 'Lịch khám',
        badgeColor: isCancelled ? '#DC2626' : '#0284C7',
        badgeBg: isCancelled ? '#FEE2E2' : '#EFF6FF',
        iconName: 'calendar',
        iconColor: isCancelled ? '#DC2626' : '#0284C7',
        targetScreen: 'DoctorAppointments',
      });
    } else if (isAssignmentMsg) {
      unifiedList.push({
        id: `inc_${inc.id}`,
        type: 'PATIENT_ASSIGNMENT',
        title: rawMsg || 'Phụ trách bệnh nhân mới',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Gia đình chỉ định phụ trách',
        timeStr: inc.created_at || '',
        badgeLabel: 'Bệnh nhân',
        badgeColor: '#059669',
        badgeBg: '#ECFDF5',
        iconName: 'people',
        iconColor: '#059669',
        targetScreen: 'DoctorPatients',
      });
    } else {
      unifiedList.push({
        id: `inc_${inc.id}`,
        type: 'INCIDENT',
        title: rawMsg || (isCritical ? 'Cảnh báo sự cố té ngã khẩn cấp' : 'Cảnh báo y tế'),
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Vừa xong',
        timeStr: inc.created_at || '',
        badgeLabel: isCritical ? 'Khẩn cấp' : 'Cảnh báo',
        badgeColor: isCritical ? '#DC2626' : '#D97706',
        badgeBg: isCritical ? '#FEE2E2' : '#FEF3C7',
        iconName: isCritical ? 'alert-circle' : 'warning',
        iconColor: isCritical ? '#DC2626' : '#D97706',
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
      subtitle: `Nhịp tim: ${pat.heart_rate ?? '--'} bpm • SpO2: ${pat.spo2 ?? '--'}% • ${pat.house_name || 'Nhà riêng'}`,
      timeStr: '',
      badgeLabel: isDanger ? 'Nguy cấp' : 'Cần chú ý',
      badgeColor: isDanger ? '#DC2626' : '#D97706',
      badgeBg: isDanger ? '#FEE2E2' : '#FEF3C7',
      iconName: 'heart-dislike',
      iconColor: isDanger ? '#DC2626' : '#D97706',
      patientId: pat.id,
      targetScreen: 'DoctorPatientDetail',
      targetParams: { patientId: pat.id },
    });
  });

  // 3. Lịch khám hôm nay và sắp tới
  const allApts = [...appointments];
  upcomingAppointments.forEach((apt) => {
    if (!allApts.some((a) => a.id === apt.id)) {
      allApts.push(apt);
    }
  });

  allApts.forEach((apt) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = apt.scheduled_at && apt.scheduled_at.slice(0, 10) === todayStr;
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
      patientId: apt.patient_id,
      rawAppointment: apt,
      targetScreen: 'DoctorAppointments',
    });
  });

  // Lọc theo Tab được chọn
  const filteredList = unifiedList.filter((item) => {
    if (activeTab === 'ALERTS') return item.type === 'INCIDENT' || item.type === 'PATIENT_WARNING';
    if (activeTab === 'APPOINTMENTS') return item.type === 'APPOINTMENT';
    return true;
  });

  const alertsCount = unifiedList.filter((i) => i.type === 'INCIDENT' || i.type === 'PATIENT_WARNING').length;
  const aptsCount = unifiedList.filter((i) => i.type === 'APPOINTMENT').length;

  // Điều hướng chính xác theo đúng từng loại thông báo
  const handleItemPress = (item: UnifiedNotification) => {
    onClose();
    if (onMarkAllRead) onMarkAllRead();
    setTimeout(() => {
      if (item.targetScreen === 'DoctorAppointments') {
        if (onSelectAppointment) {
          onSelectAppointment(item.rawAppointment);
        } else if (onNavigate) {
          onNavigate('DoctorAppointments');
        }
      } else if (item.targetScreen === 'DoctorPatientDetail') {
        const pId = item.targetParams?.patientId || item.patientId;
        if (onSelectPatient && pId) {
          onSelectPatient(pId);
        } else if (onNavigate) {
          onNavigate('DoctorPatientDetail', { patientId: pId });
        }
      } else if (item.targetScreen === 'DoctorPatients') {
        if (onNavigate) {
          onNavigate('DoctorPatients');
        } else if (onSelectPatient && item.patientId) {
          onSelectPatient(item.patientId);
        }
      } else if (onNavigate) {
        onNavigate(item.targetScreen, item.targetParams);
      }
    }, 120);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <SafeAreaView style={[styles.sheet, { backgroundColor: bg, borderTopColor: border }]}>
        {/* Thanh kéo handle */}
        <View style={[styles.handle, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <View style={styles.headerTitle}>
            <Ionicons name="notifications" size={20} color="#0284C7" />
            <LocalizedText style={[styles.title, { color: colors.textPrimary }]}>
              Trung tâm thông báo
            </LocalizedText>
            {hasUnread && unifiedList.length > 0 && (
              <View style={styles.countBadge}>
                <LocalizedText style={styles.countText}>{unifiedList.length}</LocalizedText>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                if (onMarkAllRead) onMarkAllRead();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0284C7' }}>Đã đọc tất cả</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={textSub} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: border }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'ALL' && styles.tabItemActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <LocalizedText
              style={[
                styles.tabText,
                { color: activeTab === 'ALL' ? '#2563EB' : textSub },
                activeTab === 'ALL' && styles.tabTextActive,
              ]}
            >
              Tất cả ({unifiedList.length})
            </LocalizedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'ALERTS' && styles.tabItemActive]}
            onPress={() => setActiveTab('ALERTS')}
          >
            <LocalizedText
              style={[
                styles.tabText,
                { color: activeTab === 'ALERTS' ? '#DC2626' : textSub },
                activeTab === 'ALERTS' && styles.tabTextActive,
              ]}
            >
              Cảnh báo ({alertsCount})
            </LocalizedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'APPOINTMENTS' && styles.tabItemActive]}
            onPress={() => setActiveTab('APPOINTMENTS')}
          >
            <LocalizedText
              style={[
                styles.tabText,
                { color: activeTab === 'APPOINTMENTS' ? '#2563EB' : textSub },
                activeTab === 'APPOINTMENTS' && styles.tabTextActive,
              ]}
            >
              Lịch khám ({aptsCount})
            </LocalizedText>
          </TouchableOpacity>
        </View>

        {/* Danh sách thông báo */}
        {filteredList.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
            <LocalizedText style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {activeTab === 'ALERTS'
                ? 'Không có cảnh báo bất thường'
                : activeTab === 'APPOINTMENTS'
                ? 'Không có lịch khám mới'
                : 'Mọi thứ đều ổn định'}
            </LocalizedText>
            <LocalizedText style={[styles.emptySub, { color: textSub }]}>
              {activeTab === 'ALERTS'
                ? 'Tất cả các bệnh nhân đều đang có sinh hiệu bình thường.'
                : activeTab === 'APPOINTMENTS'
                ? 'Bác sĩ có thể chủ động đặt lịch thăm khám định kỳ cho các cụ.'
                : 'Hiện không có cảnh báo sức khỏe khẩn cấp hay lịch hẹn nào cần xử lý.'}
            </LocalizedText>
          </View>
        ) : (
          <FlatList
            data={filteredList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
                activeOpacity={0.8}
                onPress={() => handleItemPress(item)}
              >
                <View style={[styles.iconBox, { backgroundColor: item.badgeBg }]}>
                  <Ionicons name={item.iconName} size={22} color={item.iconColor} />
                </View>
                <View style={styles.cardBody}>
                  <LocalizedText style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.title}
                  </LocalizedText>
                  <LocalizedText style={[styles.itemSub, { color: textSub }]} numberOfLines={1}>
                    {item.subtitle}
                  </LocalizedText>
                </View>
                <View style={[styles.statusTag, { backgroundColor: item.badgeBg }]}>
                  <LocalizedText style={[styles.statusText, { color: item.badgeColor }]}>
                    {item.badgeLabel}
                  </LocalizedText>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingVertical: 10,
    marginRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  listContent: {
    padding: 14,
    paddingBottom: 28,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: 12,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

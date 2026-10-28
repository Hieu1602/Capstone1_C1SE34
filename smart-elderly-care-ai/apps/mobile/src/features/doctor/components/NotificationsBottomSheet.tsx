// NotificationsBottomSheet.tsx
// Bottom sheet hiển thị thông báo lịch khám hôm nay cho Bác sĩ

import React from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../store/useThemeStore';
import { LocalizedText } from '../../../i18n/LocalizedComponents';
import { AppointmentItem } from './types';

interface Props {
  visible: boolean;
  onClose: () => void;
  appointments: AppointmentItem[];
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  UPCOMING: { icon: 'time-outline', color: '#2563EB', label: 'Sắp tới' },
  COMPLETED: { icon: 'checkmark-circle-outline', color: '#16A34A', label: 'Đã khám' },
  CANCELLED: { icon: 'close-circle-outline', color: '#DC2626', label: 'Đã hủy' },
};

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

export default function NotificationsBottomSheet({ visible, onClose, appointments }: Props) {
  const { isDarkMode, colors } = useTheme();
  const bg = isDarkMode ? '#1E293B' : '#FFFFFF';
  const cardBg = isDarkMode ? '#0F172A' : '#F8FAFC';
  const border = isDarkMode ? '#334155' : '#E2E8F0';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <SafeAreaView style={[styles.sheet, { backgroundColor: bg, borderTopColor: border }]}>
        {/* Handle bar */}
        <View style={[styles.handle, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <View style={styles.headerTitle}>
            <Ionicons name="notifications" size={20} color="#2563EB" />
            <LocalizedText style={[styles.title, { color: colors.textPrimary }]}>
              Thông báo hôm nay
            </LocalizedText>
            {appointments.length > 0 && (
              <View style={styles.countBadge}>
                <LocalizedText style={styles.countText}>{appointments.length}</LocalizedText>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={textSub} />
          </TouchableOpacity>
        </View>

        {/* List hoặc empty state */}
        {appointments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={48} color="#94A3B8" />
            <LocalizedText style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Không có thông báo mới
            </LocalizedText>
            <LocalizedText style={[styles.emptySub, { color: textSub }]}>
              Hôm nay chưa có lịch khám nào được lên lịch.
            </LocalizedText>
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.UPCOMING;
              return (
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                  <View style={[styles.iconBox, { backgroundColor: cfg.color + '18' }]}>
                    <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
                  </View>
                  <View style={styles.cardBody}>
                    <LocalizedText style={[styles.patientName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.patient_name || 'Bệnh nhân'}
                    </LocalizedText>
                    <LocalizedText style={[styles.aptInfo, { color: textSub }]} numberOfLines={1}>
                      {formatTime(item.scheduled_at)} · {item.visit_type === 'HOME_VISIT' ? 'Khám tại nhà' : 'Tại phòng khám'}
                    </LocalizedText>
                  </View>
                  <View style={[styles.statusTag, { backgroundColor: cfg.color + '18' }]}>
                    <LocalizedText style={[styles.statusText, { color: cfg.color }]}>
                      {cfg.label}
                    </LocalizedText>
                  </View>
                </View>
              );
            }}
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
    maxHeight: '70%',
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
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
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
    padding: 12,
    paddingBottom: 24,
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
  patientName: {
    fontSize: 14,
    fontWeight: '600',
  },
  aptInfo: {
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


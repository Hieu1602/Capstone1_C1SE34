import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';
import type { ReminderItem } from '../../../store/usePatientStore';

export const getMedicationStatus = (item: ReminderItem) => {
  if (item.taken) {
    return {
      state: 'TAKEN' as const,
      badgeText: `Đã uống lúc ${item.takenAt || item.time}`,
      badgeBg: '#DCFCE7',
      badgeColor: '#15803D',
      badgeBorder: '#86EFAC',
      iconName: 'checkmark-circle' as const,
      iconColor: '#16A34A',
      iconBg: '#DCFCE7',
    };
  }

  const [h, m] = item.time.split(':').map((v) => parseInt(v, 10) || 0);
  const medDate = new Date();
  medDate.setHours(h, m, 0, 0);
  const diffMin = Math.floor((Date.now() - medDate.getTime()) / 60000);

  if (diffMin > 15) {
    const lateStr = diffMin >= 60 ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}p` : `${diffMin} phút`;
    return {
      state: 'OVERDUE' as const,
      badgeText: `Chưa uống (Đã trễ ${lateStr})`,
      badgeBg: '#FEE2E2',
      badgeColor: '#DC2626',
      badgeBorder: '#FCA5A5',
      iconName: 'alert-circle' as const,
      iconColor: '#DC2626',
      iconBg: '#FEE2E2',
    };
  }

  const isNow = diffMin >= -15 && diffMin <= 15;
  return {
    state: 'UPCOMING' as const,
    badgeText: isNow ? 'Đúng giờ uống thuốc' : `Sắp đến giờ (${Math.abs(diffMin)} phút nữa)`,
    badgeBg: '#E0F2FE',
    badgeColor: '#0284C7',
    badgeBorder: '#BAE6FD',
    iconName: 'time' as const,
    iconColor: '#0284C7',
    iconBg: '#E0F2FE',
  };
};

interface MedicationAlertCardProps {
  item: ReminderItem;
  isDarkMode: boolean;
  colors: any;
  onPress: () => void;
  onConfirm: (med: ReminderItem) => void;
  onSnooze: (med: ReminderItem) => void;
  onReplaySpeaker: (med: ReminderItem) => void;
}

export const MedicationAlertCard: React.FC<MedicationAlertCardProps> = ({
  item,
  isDarkMode,
  colors,
  onPress,
  onConfirm,
  onSnooze,
  onReplaySpeaker,
}) => {
  const status = getMedicationStatus(item);
  const isOverdue = status.state === 'OVERDUE';
  const isTaken = status.state === 'TAKEN';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        styles.medCard,
        isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
        isOverdue && styles.medCardOverdue,
        isOverdue && isDarkMode && { backgroundColor: '#3F1219', borderColor: '#7F1D1D' },
        isTaken && styles.medCardTaken,
        isTaken && isDarkMode && { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: '#065F46' },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={[
            styles.categoryIconCircle,
            {
              backgroundColor: isDarkMode
                ? isOverdue
                  ? 'rgba(220, 38, 38, 0.25)'
                  : isTaken
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(2, 132, 199, 0.2)'
                : status.iconBg,
            },
          ]}
        >
          <Ionicons name={status.iconName} size={22} color={status.iconColor} />
        </View>

        <View style={styles.cardCenter}>
          <View style={styles.cardMetaRow}>
            <View style={[styles.typeBadge, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.typeBadgeText, { color: '#16A34A' }]}>💊 UỐNG THUỐC</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: status.badgeBg, borderWidth: 1, borderColor: status.badgeBorder }]}>
              <Text style={[styles.typeBadgeText, { color: status.badgeColor }]}>{status.badgeText}</Text>
            </View>
          </View>

          <Text
            style={[styles.cardTitle, isDarkMode && { color: colors.textPrimary }, isOverdue && { color: '#DC2626' }]}
            numberOfLines={2}
          >
            {item.name}
          </Text>

          <Text style={[styles.cardMsg, isDarkMode && { color: colors.textSecondary }]} numberOfLines={2}>
            Liều dùng: {item.dose} {item.purpose ? `• ${item.purpose}` : ''}
          </Text>

          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={isDarkMode ? '#64748B' : '#94A3B8'} />
            <Text style={[styles.cardTime, isDarkMode && { color: colors.textSecondary }]}>Lịch: {item.time} hôm nay</Text>
            <Text style={[styles.dotSeparator, isDarkMode && { color: colors.border }]}>•</Text>
            <Ionicons name="volume-medium-outline" size={12} color={Colors.primary} />
            <Text style={[styles.deviceLocationText, { color: Colors.primary, fontWeight: '600' }]}>Loa Edge Hub</Text>
          </View>
        </View>
      </View>

      {!item.taken ? (
        <View style={styles.medActionsRow}>
          <TouchableOpacity
            style={[styles.medConfirmBtn, isOverdue && { backgroundColor: '#EA580C' }]}
            onPress={() => onConfirm(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.medConfirmBtnText}>Xác nhận đã uống</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.medSnoozeBtn, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => onSnooze(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={15} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            <Text style={[styles.medSnoozeBtnText, isDarkMode && { color: colors.textSecondary }]}>
              Bỏ qua / Nhắc lại sau
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.medSpeakerBtn, isDarkMode && { backgroundColor: 'rgba(2, 132, 199, 0.2)' }]}
            onPress={() => onReplaySpeaker(item)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="volume-high" size={16} color="#0284C7" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.medCompletedRow}>
          <Ionicons name="checkmark-done-circle" size={16} color="#16A34A" />
          <Text style={[styles.medCompletedText, isDarkMode && { color: '#86EFAC' }]}>
            Đã hoàn thành cữ thuốc lúc {item.takenAt || item.time} • Dữ liệu đã lưu hồ sơ
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Shadows.soft,
  },
  medCard: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  medCardOverdue: { backgroundColor: '#FFF1F2', borderWidth: 1.5, borderColor: '#FECACA' },
  medCardTaken: { backgroundColor: '#F0FDF4', borderWidth: 1.2, borderColor: '#BBF7D0' },
  categoryIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cardCenter: { flex: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 9.5, fontWeight: '800' },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary, lineHeight: 19, marginBottom: 3 },
  cardMsg: { fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTime: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  dotSeparator: { fontSize: 10, color: '#CBD5E1', marginHorizontal: 2 },
  deviceLocationText: { fontSize: 11, color: '#94A3B8', fontWeight: '500', flexShrink: 1 },
  medActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  medConfirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  medConfirmBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  medSnoozeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  medSnoozeBtnText: { color: '#64748B', fontSize: 11.5, fontWeight: '600' },
  medSpeakerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  medCompletedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#DCFCE7' },
  medCompletedText: { fontSize: 12, color: '#15803D', fontWeight: '600' },
});

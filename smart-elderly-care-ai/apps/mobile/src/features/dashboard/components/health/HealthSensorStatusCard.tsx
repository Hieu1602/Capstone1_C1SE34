import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../../theme/colors';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';

interface HealthSensorStatusCardProps {
  batteryDisplay: string;
  acousticStatus: string;
  isDarkMode?: boolean;
  colors?: any;
}

export const HealthSensorStatusCard: React.FC<HealthSensorStatusCardProps> = ({
  batteryDisplay,
  acousticStatus,
  isDarkMode = false,
  colors = {},
}) => {
  const isDead = batteryDisplay === '0%' || batteryDisplay === '0';
  const isLow = !isDead && parseInt(batteryDisplay, 10) <= 20;

  return (
    <View
      style={[
        styles.statusSectionCard,
        isDarkMode && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionHeading, isDarkMode && { color: colors.textPrimary }]}>
        Trạng thái cảm biến & Môi trường
      </Text>

      <View style={styles.statusRowItem}>
        <View
          style={[
            styles.statusIconBox,
            isDead
              ? { backgroundColor: '#FEE2E2' }
              : isLow
                ? { backgroundColor: '#FEF3C7' }
                : isDarkMode
                  ? { backgroundColor: 'rgba(255, 122, 0, 0.15)' }
                  : undefined,
          ]}
        >
          <Ionicons
            name={isDead ? 'battery-dead' : isLow ? 'battery-half' : 'watch-outline'}
            size={20}
            color={isDead ? '#DC2626' : isLow ? '#D97706' : Colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusItemTitle, isDarkMode && { color: colors.textPrimary }]}>
            Vòng tay thông minh BLE
          </Text>
          <Text style={[styles.statusItemSub, isDarkMode && { color: colors.textSecondary }]}>
            Pin: {batteryDisplay} • {isDead ? 'Cạn pin ngắt kết nối' : isLow ? 'Sắp hết pin' : 'Kết nối liên tục'}
          </Text>
        </View>
        <View style={isDead ? styles.deadBadge : isLow ? styles.lowBadge : styles.onlineBadge}>
          <View style={isDead ? styles.deadDot : isLow ? styles.lowDot : styles.onlineDot} />
          <Text style={isDead ? styles.deadText : isLow ? styles.lowText : styles.onlineText}>
            {isDead ? 'Hết pin' : isLow ? 'Pin yếu' : 'Đang đo'}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, isDarkMode && { backgroundColor: colors.border }]} />

      <View style={styles.statusRowItem}>
        <View
          style={[
            styles.statusIconBox,
            { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' },
          ]}
        >
          <Ionicons name="mic-outline" size={20} color="#2563EB" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusItemTitle, isDarkMode && { color: colors.textPrimary }]}>
            Nhận diện âm thanh YAMNet
          </Text>
          <Text style={[styles.statusItemSub, isDarkMode && { color: colors.textSecondary }]}>
            Môi trường: {acousticStatus}
          </Text>
        </View>
        <View style={styles.safeBadge}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={styles.safeText}>An toàn</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statusSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...Shadows.soft,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  statusRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 4,
  },
  onlineText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  safeText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },
  deadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    marginRight: 4,
  },
  deadText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  lowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginRight: 4,
  },
  lowText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },
});


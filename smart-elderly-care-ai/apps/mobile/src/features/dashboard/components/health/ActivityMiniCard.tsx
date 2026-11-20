import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { healthTrendsStyles as styles } from './healthTrendsStyles';

interface ActivityMiniCardProps {
  isDarkMode: boolean;
  colors: any;
  hasAnyData: boolean;
  onPress: () => void;
}

const ACTIVITY_SEGMENTS = [
  { key: 'walk', label: 'Đi lại', percent: 25, color: '#10B981' },
  { key: 'sit', label: 'Ngồi', percent: 45, color: '#0284C7' },
  { key: 'rest', label: 'Nghỉ', percent: 30, color: '#8B5CF6' },
] as const;

export function ActivityMiniCard({
  isDarkMode,
  colors,
  hasAnyData,
  onPress,
}: ActivityMiniCardProps) {
  return (
    <TouchableOpacity
      style={[styles.miniChartCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.miniCardTop}>
        <Text style={[styles.miniCardTitle, isDarkMode && { color: colors.textPrimary }]}>
          Vận động &amp; Sinh hoạt
        </Text>
        <Ionicons name="body" size={15} color="#0284C7" />
      </View>

      {/* Stacked progress bar */}
      <View style={[styles.stackedBarTrack, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
        {hasAnyData ? (
          ACTIVITY_SEGMENTS.map((seg) => (
            <View
              key={seg.key}
              style={[styles.stackedSegment, { flex: seg.percent, backgroundColor: seg.color }]}
            />
          ))
        ) : (
          <View
            style={[
              styles.stackedSegment,
              { flex: 100, backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' },
            ]}
          />
        )}
      </View>

      {/* Chú thích stacked bar */}
      <View style={styles.stackedLegendGrid}>
        {ACTIVITY_SEGMENTS.map((seg) => (
          <View key={seg.key} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: hasAnyData ? seg.color : '#94A3B8' },
              ]}
            />
            <Text style={[styles.legendText, isDarkMode && { color: colors.textSecondary }]}>
              {hasAnyData ? `${seg.label} ${seg.percent}%` : `${seg.label} --`}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.activitySummaryCard, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
        <Text style={[styles.activitySummaryText, isDarkMode && { color: colors.textSecondary }]}>
          {hasAnyData ? (
            <>
              Vận động: <Text style={styles.boldGreen}>2.5h</Text> | Nghỉ:{' '}
              <Text style={styles.boldBlue}>6h</Text>
            </>
          ) : (
            'Chưa ghi nhận vận động'
          )}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// HealthChartSection.tsx
// Biểu đồ cột trực quan hiển thị dao động nhịp tim theo thời gian

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Shadows } from '../../../theme/colors';

interface ChartPoint {
  label: string;
  hr: number;
  id?: any;
  minute?: number;
}

interface HealthChartSectionProps {
  chartTitle: string;
  chartSubtitle: string;
  chartAvg: string;
  chartData: ChartPoint[];
  closestVital?: any;
  scrubberMinutes?: number;
  isDarkMode: boolean;
  colors: any;
}

export const HealthChartSection: React.FC<HealthChartSectionProps> = ({
  chartTitle,
  chartSubtitle,
  chartAvg,
  chartData,
  closestVital,
  scrubberMinutes,
  isDarkMode,
  colors,
}) => {
  return (
    <View style={[styles.chartCard, isDarkMode && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
      <View style={styles.chartCardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.chartCardTitle, isDarkMode && { color: colors.textPrimary }]}>{chartTitle}</Text>
          <Text style={[styles.chartCardSubtitle, isDarkMode && { color: colors.textSecondary }]}>{chartSubtitle}</Text>
        </View>
        <View style={styles.chartAvgBadge}>
          <Text style={styles.chartAvgText}>{chartAvg}</Text>
        </View>
      </View>

      {chartData && chartData.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barsScrollContainer}>
          <View style={styles.barsContainer}>
            {chartData.map((point: ChartPoint, idx: number) => {
              const barHeight = Math.max(28, ((point.hr - 50) / 45) * 90);
              const isClosest =
                closestVital &&
                scrubberMinutes !== undefined &&
                (point.id === closestVital.id || (point.minute !== undefined && Math.abs(point.minute - scrubberMinutes) < 45));

              return (
                <View key={`${point.label}-${idx}`} style={[styles.barCol, isClosest && styles.barColActive]}>
                  {isClosest ? (
                    <View style={styles.activePinBadge}>
                      <Text style={styles.activePinBadgeText}>📍 {point.hr}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.barValText, isDarkMode && { color: colors.textSecondary }]}>{point.hr}</Text>
                  )}

                  <View style={[styles.barTrack, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barHeight,
                          backgroundColor: isClosest ? '#2563EB' : '#38BDF8',
                        },
                      ]}
                    />
                  </View>

                  <Text
                    style={[
                      styles.barTimeText,
                      isDarkMode && { color: colors.textSecondary },
                      isClosest && styles.barTimeTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {point.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyChartBox}>
          <Ionicons name="bar-chart-outline" size={32} color={isDarkMode ? '#64748B' : '#94A3B8'} style={{ marginBottom: 6 }} />
          <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>
            Chưa có dữ liệu đo để vẽ biểu đồ
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chartCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  chartCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  chartAvgBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chartAvgText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  barsScrollContainer: {
    paddingVertical: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 16,
  },
  barCol: {
    alignItems: 'center',
    width: 44,
  },
  barColActive: {
    transform: [{ scale: 1.05 }],
  },
  activePinBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  activePinBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  barValText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barTimeText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
  },
  barTimeTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  emptyChartBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default HealthChartSection;

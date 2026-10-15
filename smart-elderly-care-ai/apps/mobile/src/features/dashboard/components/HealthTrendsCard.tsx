// HealthTrendsCard.tsx
// Khối "Xu hướng sức khoẻ hôm nay" (Health Trends Overview) – Mini bar chart, Stacked activity bar, SpO2 gauge ruler

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';

interface HealthTrendsCardProps {
  navigation: any;
  isDarkMode: boolean;
  colors: any;
}

export function HealthTrendsCard({
  navigation,
  isDarkMode,
  colors,
}: HealthTrendsCardProps) {
  return (
    <View style={styles.trendSectionContainer}>
      <View style={styles.trendSectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="stats-chart" size={17} color={Colors.primary} />
          <Text style={[styles.trendSectionTitle, isDarkMode && { color: colors.textPrimary }]}>
            Xu hướng sức khoẻ hôm nay
          </Text>
        </View>
        <View style={styles.trendStandardBadge}>
          <Ionicons name="checkmark-circle" size={13} color="#15803D" />
          <Text style={styles.trendStandardBadgeText}>Đạt chuẩn</Text>
        </View>
      </View>

      {/* Hàng 2 thẻ biểu đồ mini */}
      <View style={styles.miniChartsRow}>
        {/* Thẻ 1: Biểu đồ nhịp tim 12h qua */}
        <TouchableOpacity
          style={[styles.miniChartCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('HealthDetail', { metric: 'heartRate' })}
        >
          <View style={styles.miniCardTop}>
            <Text style={[styles.miniCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Nhịp tim 12h qua
            </Text>
            <View style={styles.miniCardBadge}>
              <Text style={styles.miniCardBadgeText}>TB 74</Text>
            </View>
          </View>

          {/* Mini bar chart */}
          <View style={styles.miniBarChartArea}>
            <View style={styles.miniDashedRefLine}>
              <View style={styles.miniDashedDash} />
              <Text style={[styles.miniRefLabel, isDarkMode && { color: colors.textSecondary }]}>74 bpm</Text>
            </View>

            <View style={styles.miniBarsRow}>
              {[
                { time: '06h', val: 70 },
                { time: '08h', val: 74 },
                { time: '10h', val: 82 },
                { time: '12h', val: 72 },
                { time: '14h', val: 76 },
                { time: '16h', val: 74 },
              ].map((col) => {
                const height = Math.max(14, ((col.val - 50) / 45) * 44);
                const isHigh = col.val >= 80;
                return (
                  <View key={col.time} style={styles.miniBarCol}>
                    <Text style={[styles.miniBarValText, isDarkMode && { color: colors.textSecondary }]}>{col.val}</Text>
                    <View style={[styles.miniBarTrack, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
                      <View
                        style={[
                          styles.miniBarFill,
                          {
                            height,
                            backgroundColor: isHigh ? '#F59E0B' : '#10B981',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.miniBarTimeText, isDarkMode && { color: colors.textSecondary }]}>{col.time}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.miniCardFooter, isDarkMode && { borderTopColor: colors.border }]}>
            <View style={styles.miniStatusDotGreen} />
            <Text style={[styles.miniStatusNote, isDarkMode && { color: colors.textSecondary }]}>Chuẩn 60-100 bpm</Text>
          </View>
        </TouchableOpacity>

        {/* Thẻ 2: Mức độ vận động & sinh hoạt */}
        <TouchableOpacity
          style={[styles.miniChartCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('HealthDetail', { metric: 'activity' })}
        >
          <View style={styles.miniCardTop}>
            <Text style={[styles.miniCardTitle, isDarkMode && { color: colors.textPrimary }]}>
              Vận động &amp; Sinh hoạt
            </Text>
            <Ionicons name="body" size={15} color="#0284C7" />
          </View>

          {/* Stacked progress bar (25% Xanh lá, 45% Xanh dương, 30% Tím) */}
          <View style={[styles.stackedBarTrack, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
            <View style={[styles.stackedSegment, { flex: 25, backgroundColor: '#10B981' }]} />
            <View style={[styles.stackedSegment, { flex: 45, backgroundColor: '#0284C7' }]} />
            <View style={[styles.stackedSegment, { flex: 30, backgroundColor: '#8B5CF6' }]} />
          </View>

          {/* Chú thích stacked bar */}
          <View style={styles.stackedLegendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.legendText, isDarkMode && { color: colors.textSecondary }]}>Đi lại 25%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
              <Text style={[styles.legendText, isDarkMode && { color: colors.textSecondary }]}>Ngồi 45%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={[styles.legendText, isDarkMode && { color: colors.textSecondary }]}>Nghỉ 30%</Text>
            </View>
          </View>

          <View style={[styles.activitySummaryCard, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={[styles.activitySummaryText, isDarkMode && { color: colors.textSecondary }]}>
              Vận động: <Text style={styles.boldGreen}>2.5h</Text> | Nghỉ: <Text style={styles.boldBlue}>6h</Text>
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Thẻ 3: Toàn chiều rộng bên dưới - Thước đo Oxy máu SpO2 */}
      <TouchableOpacity
        style={[styles.spo2GaugeCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('HealthDetail', { metric: 'spo2' })}
      >
        <View style={styles.spo2CardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.spo2IconCircle}>
              <Ionicons name="water" size={16} color="#0284C7" />
            </View>
            <Text style={[styles.spo2CardTitle, isDarkMode && { color: colors.textPrimary }]}>Chỉ số Oxy máu SpO₂</Text>
          </View>
          <View style={styles.spo2BadgeGreen}>
            <Ionicons name="checkmark-circle" size={13} color="#15803D" />
            <Text style={styles.spo2BadgeGreenText}>98% - Rất tốt</Text>
          </View>
        </View>

        {/* Thước đo ngang SpO2 từ 90% đến 100% */}
        <View style={styles.rulerContainer}>
          <View style={styles.rulerTrackBg}>
            <View style={styles.rulerZoneWarning} />
            <View style={styles.rulerZoneSafe} />
            <View style={[styles.rulerMarkerPin, { left: '80%' }]}>
              <View style={styles.rulerPointerArrow} />
              <View style={styles.rulerPointerDot} />
            </View>
          </View>

          {/* Các mốc số trên thước đo */}
          <View style={styles.rulerTicksRow}>
            <Text style={[styles.rulerTickText, isDarkMode && { color: colors.textSecondary }]}>90%</Text>
            <Text style={[styles.rulerTickText, isDarkMode && { color: colors.textSecondary }]}>92%</Text>
            <Text style={[styles.rulerTickText, { fontWeight: '700', color: Colors.primary }]}>95% (Chuẩn)</Text>
            <Text style={[styles.rulerTickText, { fontWeight: '800', color: '#15803D' }]}>98%</Text>
            <Text style={[styles.rulerTickText, isDarkMode && { color: colors.textSecondary }]}>100%</Text>
          </View>
        </View>

        <View style={styles.spo2FooterRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#15803D" />
          <Text style={[styles.spo2FooterNote, isDarkMode && { color: colors.textSecondary }]}>
            Ngưỡng an toàn ≥ 95% • Nồng độ oxy bão hoà duy trì tối ưu
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  trendSectionContainer: {
    marginTop: 18,
    marginBottom: 8,
  },
  trendSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trendSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  trendStandardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendStandardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  miniChartsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  miniChartCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Shadows.soft,
  },
  miniCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  miniCardBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  miniCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  miniBarChartArea: {
    height: 78,
    justifyContent: 'flex-end',
    position: 'relative',
    marginVertical: 4,
  },
  miniDashedRefLine: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  miniDashedDash: {
    flex: 1,
    height: 1,
    borderWidth: 0.8,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  miniRefLabel: {
    fontSize: 8,
    color: '#94A3B8',
    marginLeft: 3,
    fontWeight: '600',
  },
  miniBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 66,
  },
  miniBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  miniBarValText: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  miniBarTrack: {
    width: 8,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  miniBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  miniBarTimeText: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
  miniCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  miniStatusDotGreen: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  miniStatusNote: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  stackedBarTrack: {
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 8,
  },
  stackedSegment: {
    height: '100%',
  },
  stackedLegendGrid: {
    gap: 4,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activitySummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginTop: 'auto',
  },
  activitySummaryText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  boldGreen: {
    fontWeight: '700',
    color: '#10B981',
  },
  boldBlue: {
    fontWeight: '700',
    color: '#0284C7',
  },
  spo2GaugeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
    ...Shadows.soft,
  },
  spo2CardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  spo2IconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spo2CardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  spo2BadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spo2BadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  rulerContainer: {
    marginBottom: 10,
  },
  rulerTrackBg: {
    height: 14,
    flexDirection: 'row',
    borderRadius: 7,
    overflow: 'visible',
    position: 'relative',
    marginBottom: 6,
  },
  rulerZoneWarning: {
    flex: 50,
    height: 14,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
    backgroundColor: '#FED7AA',
  },
  rulerZoneSafe: {
    flex: 50,
    height: 14,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: '#86EFAC',
  },
  rulerMarkerPin: {
    position: 'absolute',
    top: -6,
    marginLeft: -7,
    alignItems: 'center',
    zIndex: 2,
  },
  rulerPointerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#15803D',
  },
  rulerPointerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#15803D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: 1,
    ...Shadows.soft,
  },
  rulerTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 8,
  },
  rulerTickText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  spo2FooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  spo2FooterNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});

export default HealthTrendsCard;

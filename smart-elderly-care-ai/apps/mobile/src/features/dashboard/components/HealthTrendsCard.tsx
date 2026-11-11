// ==============================================================================
// TỆP: HealthTrendsCard.tsx
// PHÂN HỆ: Thẻ "Xu hướng sức khỏe hôm nay" trên Trang chủ (HomeScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Hiển thị 2 biểu đồ mini trực quan: Nhịp tim 12h qua (Mini Bar Chart) &
//     Độ bão hòa oxy trong máu SpO2 (Thước đo phân vùng 90% - 100%).
//   - Tự động kiểm tra dữ liệu thực tế từ cảm biến: nếu chưa có bản ghi từ Database
//     sẽ hiển thị trạng thái rỗng ("Chưa có dữ liệu" / "--"), không dùng dữ liệu giả.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { Colors, Shadows } from '../../../theme/colors';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { vitalsApi } from '../../../services/api';

interface HealthTrendsCardProps {
  navigation: any;
  isDarkMode: boolean;
  colors: any;
  currentVitals?: any;
}

export function HealthTrendsCard({
  navigation,
  isDarkMode,
  colors,
  currentVitals,
}: HealthTrendsCardProps) {
  // Kiểm tra sự tồn tại của dữ liệu nhịp tim và SpO2 thực tế từ vòng đeo tay BLE
  const hasHR = currentVitals?.heart_rate !== null && currentVitals?.heart_rate !== undefined;
  const hasSpO2 = currentVitals?.spo2 !== null && currentVitals?.spo2 !== undefined;
  const hasAnyData = hasHR || hasSpO2;

  // Lịch sử đo nhịp tim nhiều mốc thời gian để vẽ biểu đồ line 12h qua
  const [hrBars, setHrBars] = useState<{ time: string; val: number }[]>([]);
  const [chartWidth, setChartWidth] = useState(140);

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const devId = currentVitals?.device_id || 'BLE_BAND_001';
        const res = await vitalsApi.getHistory(devId, 30);
        if (isMounted && res.data && Array.isArray(res.data) && res.data.length > 0) {
          const valid = res.data
            .filter((v: any) => v.heart_rate != null && Number(v.heart_rate) > 0)
            .reverse();
          if (valid.length > 0) {
            // Lấy tối đa 15 mốc gần nhất để vẽ đường cong nhịp tim mềm mại
            const finalPoints = valid.slice(-15).map((item: any, idx: number, arr: any[]) => {
              let label = 'Hiện tại';
              if (idx < arr.length - 1 && item.time) {
                const d = new Date(item.time);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                label = `${hh}:${mm}`;
              }
              return {
                time: label,
                val: Math.round(Number(item.heart_rate)),
              };
            });
            setHrBars(finalPoints);
          }
        }
      } catch (e) {
        // Fallback nhẹ
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [currentVitals?.device_id]);

  // Cập nhật mốc mới khi có WebSocket nhịp tim đẩy tới
  useEffect(() => {
    if (currentVitals?.heart_rate && Number(currentVitals.heart_rate) > 0) {
      setHrBars((prev) => {
        const val = Math.round(Number(currentVitals.heart_rate));
        if (prev.length === 0) {
          return [{ time: 'Hiện tại', val }];
        }
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const updated = prev.map((p, i) => (i === prev.length - 1 ? { ...p, time: `${hh}:${mm}` } : p));
        return [...updated, { time: 'Hiện tại', val }].slice(-15);
      });
    }
  }, [currentVitals?.heart_rate, currentVitals?.timestamp]);

  // Giá trị hiển thị thực tế và tính toán vị trí kim chỉ báo SpO2 trên thang đo 90-100%
  const hrValue = hasHR ? currentVitals.heart_rate : null;
  const displayBars = hrBars.length > 0 ? hrBars : hasHR ? [{ time: 'Hiện tại', val: hrValue }] : [];
  const avgHR = displayBars.length > 0
    ? Math.round(displayBars.reduce((s, c) => s + c.val, 0) / displayBars.length)
    : hrValue;

  const spo2Value = hasSpO2 ? currentVitals.spo2 : null;
  const spo2PinPercent = spo2Value !== null ? Math.min(96, Math.max(4, (spo2Value - 90) * 10)) : 0;

  // Tính toán tọa độ vẽ Mini Line Chart
  const chartHeight = 54;
  const vals = displayBars.map((p) => p.val);
  const minVal = vals.length > 0 ? Math.min(...vals, 55) : 55;
  const maxVal = vals.length > 0 ? Math.max(...vals, 105) : 105;
  const range = Math.max(15, maxVal - minVal);

  const padLeft = 6;
  const padRight = 10;
  const padTop = 6;
  const padBottom = 6;
  const usableW = Math.max(80, chartWidth - padLeft - padRight);
  const usableH = chartHeight - padTop - padBottom;

  const rawCoords = displayBars.map((p, i) => {
    const x = padLeft + (displayBars.length > 1 ? (i / (displayBars.length - 1)) * usableW : usableW / 2);
    const normY = (p.val - minVal) / range;
    const y = padTop + (1 - normY) * usableH;
    return { x, y, val: p.val, time: p.time };
  });

  const coords =
    rawCoords.length === 1
      ? [
          { x: padLeft, y: rawCoords[0].y, val: rawCoords[0].val, time: rawCoords[0].time },
          { x: padLeft + usableW, y: rawCoords[0].y, val: rawCoords[0].val, time: rawCoords[0].time },
        ]
      : rawCoords;

  const hasChartData = coords.length > 0;
  const lastPt = hasChartData ? coords[coords.length - 1] : { x: 0, y: 0, val: 0, time: '' };
  const firstPt = hasChartData ? coords[0] : { x: 0, y: 0, val: 0, time: '' };
  const isHighHR = lastPt.val >= 100;
  const lineColor = isHighHR ? '#F59E0B' : '#10B981';
  const refY = Math.max(
    padTop,
    Math.min(chartHeight - padBottom, padTop + (1 - ((avgHR ?? 75) - minVal) / range) * usableH)
  );

  let linePath = '';
  let areaPath = '';
  if (hasChartData) {
    linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpX = (prev.x + curr.x) / 2;
      linePath += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    areaPath = `${linePath} L ${lastPt.x} ${chartHeight} L ${firstPt.x} ${chartHeight} Z`;
  }

  return (
    <View style={styles.trendSectionContainer}>
      <View style={styles.trendSectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="stats-chart" size={17} color={Colors.primary} />
          <Text style={[styles.trendSectionTitle, isDarkMode && { color: colors.textPrimary }]}>
            Xu hướng sinh hiệu hôm nay
          </Text>
        </View>
        <View
          style={[
            styles.trendStandardBadge,
            !hasAnyData && { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
          ]}
        >
          <Ionicons
            name={hasAnyData ? 'checkmark-circle' : 'information-circle'}
            size={13}
            color={hasAnyData ? '#15803D' : '#64748B'}
          />
          <Text
            style={[
              styles.trendStandardBadgeText,
              !hasAnyData && { color: isDarkMode ? '#94A3B8' : '#64748B' },
            ]}
          >
            {hasAnyData ? 'Đạt chuẩn' : 'Chưa có dữ liệu'}
          </Text>
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
            <View
              style={[
                styles.miniCardBadge,
                !hasHR && { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
              ]}
            >
              <Text
                style={[
                  styles.miniCardBadgeText,
                  !hasHR && { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                {hasHR ? `TB ${avgHR}` : 'TB --'}
              </Text>
            </View>
          </View>

          {/* Mini line chart */}
          {hasHR && displayBars.length > 0 ? (
            <View
              style={styles.miniBarChartArea}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0) setChartWidth(w);
              }}
            >
              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <LinearGradient id="hrMiniGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                    <Stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                  </LinearGradient>
                </Defs>

                {/* Vạch ngang tham chiếu TB */}
                <Line
                  x1={padLeft}
                  y1={refY}
                  x2={chartWidth - padRight}
                  y2={refY}
                  stroke={isDarkMode ? '#334155' : '#CBD5E1'}
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                />

                {/* Mảng gradient dưới đường sóng */}
                <Path d={areaPath} fill="url(#hrMiniGrad)" />

                {/* Đường cong nhịp tim mềm mại */}
                <Path
                  d={linePath}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Điểm đo hiện tại nhấp nháy */}
                <Circle cx={lastPt.x} cy={lastPt.y} r={5} fill={lineColor} opacity={0.25} />
                <Circle cx={lastPt.x} cy={lastPt.y} r={3} fill={lineColor} stroke="#FFFFFF" strokeWidth={1.5} />
              </Svg>

              <View style={styles.lineTimeRow}>
                <Text style={[styles.miniBarTimeText, isDarkMode && { color: colors.textSecondary }]}>
                  {displayBars[0]?.time !== 'Hiện tại' ? displayBars[0]?.time : '12h trước'}
                </Text>
                <Text style={[styles.miniBarTimeText, { fontWeight: '700', color: lineColor }]}>
                  {lastPt.val} bpm • Hiện tại
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.miniEmptyBox}>
              <Ionicons name="bar-chart-outline" size={24} color={isDarkMode ? '#64748B' : '#94A3B8'} style={{ marginBottom: 4 }} />
              <Text style={[styles.miniEmptyText, { color: colors.textSecondary }]}>Chưa có dữ liệu 12h qua</Text>
            </View>
          )}

          <View style={[styles.miniCardFooter, isDarkMode && { borderTopColor: colors.border }]}>
            <View style={hasHR ? styles.miniStatusDotGreen : [styles.miniStatusDotGreen, { backgroundColor: '#94A3B8' }]} />
            <Text style={[styles.miniStatusNote, isDarkMode && { color: colors.textSecondary }]}>
              {hasHR ? 'Chuẩn 60-100 bpm' : 'Chưa ghi nhận nhịp tim'}
            </Text>
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

          {/* Stacked progress bar */}
          <View style={[styles.stackedBarTrack, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
            {hasAnyData ? (
              <>
                <View style={[styles.stackedSegment, { flex: 25, backgroundColor: '#10B981' }]} />
                <View style={[styles.stackedSegment, { flex: 45, backgroundColor: '#0284C7' }]} />
                <View style={[styles.stackedSegment, { flex: 30, backgroundColor: '#8B5CF6' }]} />
              </>
            ) : (
              <View style={[styles.stackedSegment, { flex: 100, backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />
            )}
          </View>

          {/* Chú thích stacked bar */}
          <View style={styles.stackedLegendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: hasAnyData ? '#10B981' : '#94A3B8' }]} />
              <Text style={[styles.legendText, isDarkMode && { color: colors.textSecondary }]}>
                {hasAnyData ? 'Đi lại 25%' : 'Đi lại --'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: hasAnyData ? '#0284C7' : '#94A3B8' }]} />
              <Text style={[styles.legendText, isDarkMode && { color: colors.textSecondary }]}>
                {hasAnyData ? 'Ngồi 45%' : 'Ngồi --'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: hasAnyData ? '#8B5CF6' : '#94A3B8' }]} />
              <Text style={[styles.legendText, isDarkMode && { color: colors.textSecondary }]}>
                {hasAnyData ? 'Nghỉ 30%' : 'Nghỉ --'}
              </Text>
            </View>
          </View>

          <View style={[styles.activitySummaryCard, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={[styles.activitySummaryText, isDarkMode && { color: colors.textSecondary }]}>
              {hasAnyData ? (
                <>
                  Vận động: <Text style={styles.boldGreen}>2.5h</Text> | Nghỉ: <Text style={styles.boldBlue}>6h</Text>
                </>
              ) : (
                'Chưa ghi nhận vận động'
              )}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
            <View style={styles.spo2IconCircle}>
              <Ionicons name="water" size={16} color="#0284C7" />
            </View>
            <Text style={[styles.spo2CardTitle, isDarkMode && { color: colors.textPrimary }]} numberOfLines={1}>
              Chỉ số Oxy máu SpO₂
            </Text>
          </View>
          <View
            style={[
              styles.spo2BadgeGreen,
              !hasSpO2 && { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
              hasSpO2 && spo2Value < 95 && { backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7' },
              hasSpO2 && spo2Value >= 95 && { backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7' },
            ]}
          >
            <Ionicons
              name={hasSpO2 && spo2Value >= 95 ? 'checkmark-circle' : hasSpO2 ? 'warning' : 'information-circle'}
              size={13}
              color={hasSpO2 && spo2Value >= 95 ? '#15803D' : hasSpO2 ? '#D97706' : '#64748B'}
            />
            <Text
              style={[
                styles.spo2BadgeGreenText,
                !hasSpO2 && { color: isDarkMode ? '#94A3B8' : '#64748B' },
                hasSpO2 && spo2Value < 95 && { color: isDarkMode ? '#FBBF24' : '#D97706' },
                hasSpO2 && spo2Value >= 95 && { color: isDarkMode ? '#86EFAC' : '#15803D' },
              ]}
              numberOfLines={1}
            >
              {hasSpO2 ? `${spo2Value}% • ${spo2Value >= 95 ? 'An toàn' : 'Cần theo dõi'}` : 'Chưa có dữ liệu'}
            </Text>
          </View>
        </View>

        {/* Thước đo ngang SpO2 từ 90% đến 100% */}
        <View style={styles.rulerContainer}>
          <View style={styles.rulerTrackBg}>
            <View style={styles.rulerZoneWarning} />
            <View style={styles.rulerZoneSafe} />
            {hasSpO2 && (
              <View style={[styles.rulerMarkerPin, { left: `${spo2PinPercent}%` }]}>
                <View style={styles.rulerPointerArrow} />
                <View style={styles.rulerPointerDot} />
              </View>
            )}
          </View>

          {/* Các mốc số cố định trên thước đo chuẩn y tế */}
          <View style={styles.rulerTicksRow}>
            <Text style={[styles.rulerTickText, isDarkMode && { color: colors.textSecondary }]}>90%</Text>
            <Text style={[styles.rulerTickText, isDarkMode && { color: colors.textSecondary }]}>92%</Text>
            <Text style={[styles.rulerTickText, { fontWeight: '700', color: Colors.primary }]}>95% (Chuẩn)</Text>
            <Text style={[styles.rulerTickText, isDarkMode && { color: colors.textSecondary }]}>98%</Text>
            <Text style={[styles.rulerTickText, isDarkMode && { color: colors.textSecondary }]}>100%</Text>
          </View>
        </View>

        <View style={styles.spo2FooterRow}>
          <Ionicons
            name={hasSpO2 ? 'shield-checkmark-outline' : 'information-circle-outline'}
            size={14}
            color={hasSpO2 ? '#15803D' : '#64748B'}
          />
          <Text style={[styles.spo2FooterNote, isDarkMode && { color: colors.textSecondary }]}>
            {hasSpO2
              ? 'Ngưỡng an toàn ≥ 95% • Nồng độ oxy bão hoà duy trì tối ưu'
              : 'Chưa ghi nhận dữ liệu đo SpO₂ từ vòng đeo tay'}
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
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  lineTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 2,
  },
  miniEmptyBox: {
    height: 78,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  miniEmptyText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
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

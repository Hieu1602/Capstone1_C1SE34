// ==============================================================================
// TỆP: HealthChartSection.tsx
// PHÂN HỆ: Biểu đồ Cột Nhịp tim Smartwatch Chuẩn Y Tế (HealthDetailScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My & C1SE34 Team
// MÔ TẢ CHỨC NĂNG:
//   - Tái hiện chính xác giao diện đồng hồ thông minh (Smartwatch Heart Rate Zone Bars):
//     + Biểu tượng trái tim đỏ cùng chỉ số nhịp tim nổi bật (Bold Metric).
//     + Đường đứt đoạn tham chiếu Min (48) và Max (186) chuẩn y tế.
//     + Các cột đo mật độ cao (Dense Bars) đổi màu theo 5 phân vùng nhịp tim:
//       * Xám (<65 bpm): Vùng nghỉ ngơi / baseline
//       * Xanh lam (65 - 84 bpm): Nhịp tim nhẹ / khởi động
//       * Xanh lục (85 - 99 bpm): Nhịp tim vừa / sinh hoạt bình thường
//       * Vàng (100 - 119 bpm): Vận động mạnh / nhịp tim tăng cao
//       * Đỏ (>= 120 bpm): Đỉnh gắng sức / cảnh báo nhịp tim nhanh
//     + Trục thời gian 0h - 24h (ngày khác) hoặc 0h - hiện tại (hôm nay).
// ==============================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Circle, Line, Text as SvgText } from 'react-native-svg';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Shadows } from '../../../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Hàm gán màu theo phân vùng nhịp tim (Heart Rate Zones) chuẩn y tế & smartwatch
export function getHeartRateZoneColor(hr: number): string {
  if (hr >= 120) return '#EF4444'; // Đỉnh / Cực đại (Red)
  if (hr >= 100) return '#F59E0B'; // Vận động mạnh (Amber/Yellow)
  if (hr >= 85) return '#10B981';  // Nhịp tim vừa / Khỏe mạnh (Emerald)
  if (hr >= 65) return '#0284C7';  // Nhẹ / Khởi động (Sky Blue)
  return '#64748B';                // Nghỉ ngơi / Baseline (Slate Grey)
}

export interface ChartPoint {
  label: string;
  hr: number;
  id?: any;
  minute?: number;
}

export interface HealthChartSectionProps {
  chartTitle: string;
  chartSubtitle: string;
  chartAvg: string;
  chartData: ChartPoint[];
  closestVital?: any;
  scrubberMinutes?: number;
  isDarkMode: boolean;
  colors: any;
  isToday?: boolean;
  selectedRange?: 'DAY' | 'WEEK' | 'MONTH';
}

export const HealthChartSection: React.FC<HealthChartSectionProps> = React.memo(({
  chartTitle,
  chartSubtitle,
  chartAvg,
  chartData,
  closestVital,
  scrubberMinutes,
  isDarkMode,
  colors,
  isToday = false,
  selectedRange = 'DAY',
}) => {
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 64);
  const scrollRef = useRef<any>(null);

  const chartHeight = 160;
  const isDayView = !selectedRange || selectedRange === 'DAY';

  const safeChartData = useMemo(
    () =>
      (chartData || []).filter(
        (p) => p && typeof p.hr === 'number' && Number.isFinite(p.hr) && p.hr > 0
      ),
    [chartData]
  );
  const hasData = safeChartData.length > 0;

  // Tính toán giới hạn thời gian (phút) cho trục hoành trong ngày
  // Nếu là hôm nay: chạy từ 0 đến phút hiện tại (now)
  // Nếu là ngày khác: chạy đủ 24 giờ (0 - 1440 phút)
  const maxMinutes = useMemo(() => {
    if (!isDayView) return 1440;
    if (isToday) {
      const now = new Date();
      const nowM = now.getHours() * 60 + now.getMinutes();
      return Math.max(60, nowM);
    }
    return 1440;
  }, [isDayView, isToday]);

  const padLeft = 32;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 26;

  // Chiều rộng tổng thể
  const totalHours = useMemo(() => {
    if (!isDayView) return 7;
    return isToday ? Math.max(1, Math.ceil(maxMinutes / 60)) : 24;
  }, [isDayView, isToday, maxMinutes]);

  const svgWidth = useMemo(() => {
    if (!hasData) return containerWidth;
    if (isDayView) {
      const calculatedW = totalHours * 44 + padLeft + padRight;
      return Math.max(containerWidth, calculatedW);
    }
    return Math.max(containerWidth, safeChartData.length * 36);
  }, [hasData, isDayView, totalHours, containerWidth, safeChartData.length, padLeft, padRight]);

  const usableW = Math.max(60, svgWidth - padLeft - padRight);
  const usableH = chartHeight - padTop - padBottom;
  const bottomY = chartHeight - padBottom;

  // Tự động cuộn đến điểm đo mới nhất (thời điểm hiện tại) khi mở biểu đồ ngày hôm nay
  useEffect(() => {
    if (isToday && hasData && scrollRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isToday, hasData]);

  // Thống kê Min / Max / Average của nhịp tim
  const { minHR, maxHR, avgHRNum } = useMemo(() => {
    if (!hasData) return { minHR: 48, maxHR: 100, avgHRNum: 75 };
    const hrs = safeChartData.map((p) => p.hr);
    const minVal = Math.min(...hrs);
    const maxVal = Math.max(...hrs);
    const avg = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
    return { minHR: minVal, maxHR: maxVal, avgHRNum: avg };
  }, [safeChartData, hasData]);

  // Tìm điểm đo gần nhất với thanh tua (scrubber)
  const closestIndex = useMemo(() => {
    if (!safeChartData || safeChartData.length === 0) return -1;
    if (closestVital?.id) {
      const match = safeChartData.findIndex((c) => c.id === closestVital.id);
      if (match !== -1) return match;
    }
    if (scrubberMinutes !== undefined) {
      let bestIdx = -1;
      let minDiff = 999999;
      for (let i = 0; i < safeChartData.length; i++) {
        const ptMin = safeChartData[i].minute;
        if (ptMin !== undefined && ptMin >= 0) {
          const diff = Math.abs(ptMin - scrubberMinutes);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
          }
        }
      }
      if (bestIdx !== -1) return bestIdx;
    }
    return safeChartData.length - 1;
  }, [closestVital, safeChartData, scrubberMinutes]);

  // Nhịp tim đang được chọn hiển thị số to trên đầu (tương tự 68 trên mặt smartwatch)
  const activePoint = useMemo(() => {
    if (!hasData) return null;
    if (closestIndex >= 0 && closestIndex < safeChartData.length) {
      return safeChartData[closestIndex];
    }
    return safeChartData[safeChartData.length - 1];
  }, [hasData, closestIndex, safeChartData]);

  const activeHR = activePoint ? activePoint.hr : (closestVital?.heart_rate ?? avgHRNum);
  const activeTimeLabel = activePoint?.label || (closestVital?.time ? closestVital.time.slice(11, 16) : 'Hiện tại');

  // Tính toán giới hạn trục Y
  const { yMinLimit, yMaxLimit, yRange, yUpperRef, yLowerRef } = useMemo(() => {
    const minScale = Math.max(30, minHR - 6);
    const maxScale = Math.max(minScale + 40, maxHR + 8);
    const range = Math.max(30, maxScale - minScale);

    const _yUpper = padTop + (1 - (maxHR - minScale) / range) * usableH;
    const _yLower = padTop + (1 - (minHR - minScale) / range) * usableH;

    return {
      yMinLimit: minScale,
      yMaxLimit: maxScale,
      yRange: range,
      yUpperRef: Number.isFinite(_yUpper) ? _yUpper : padTop + 10,
      yLowerRef: Number.isFinite(_yLower) ? _yLower : bottomY - 10,
    };
  }, [minHR, maxHR, padTop, usableH, bottomY]);

  // Mốc thời gian trục hoành từng giờ
  const hourTicks = useMemo(() => {
    if (!isDayView) return [];
    const ticks: { hour: number; x: number; label: string; isCurrent?: boolean }[] = [];
    const totalH = isToday ? Math.floor(maxMinutes / 60) : 24;
    for (let h = 0; h <= totalH; h++) {
      const m = h * 60;
      const x = padLeft + (m / maxMinutes) * usableW;
      const lbl = h < 10 ? `0${h}:00` : `${h}:00`;
      ticks.push({ hour: h, x, label: lbl });
    }
    if (isToday && maxMinutes % 60 >= 10) {
      const x = padLeft + usableW;
      const hh = Math.floor(maxMinutes / 60);
      const mm = maxMinutes % 60;
      const lbl = `${hh < 10 ? `0${hh}` : hh}:${mm < 10 ? `0${mm}` : mm}`;
      ticks.push({ hour: hh, x, label: lbl, isCurrent: true });
    }
    return ticks;
  }, [isDayView, isToday, maxMinutes, usableW, padLeft]);

  // Tính toán danh sách các cột nhịp tim (Bars)
  const barElements = useMemo(() => {
    if (!hasData) return [];
    const barWidth = 4.8;

    return safeChartData.map((pt, idx) => {
      let x: number;
      if (isDayView) {
        const ptMin = pt.minute !== undefined && pt.minute >= 0 ? pt.minute : 0;
        const ratio = Math.min(1, Math.max(0, ptMin / maxMinutes));
        x = padLeft + ratio * usableW;
      } else {
        x = padLeft + (safeChartData.length > 1 ? (idx / (safeChartData.length - 1)) * usableW : usableW / 2);
      }

      const norm = Math.min(1, Math.max(0.12, (pt.hr - yMinLimit) / yRange));
      const bHeight = norm * usableH;
      const bY = padTop + (1 - norm) * usableH;
      const color = getHeartRateZoneColor(pt.hr);
      const isClosest = idx === closestIndex;

      return {
        x,
        y: bY,
        width: barWidth,
        height: bHeight,
        color,
        hr: pt.hr,
        label: pt.label,
        isClosest,
      };
    });
  }, [safeChartData, hasData, isDayView, maxMinutes, usableW, padLeft, padTop, usableH, yMinLimit, yRange, closestIndex]);

  // Lọc nhãn trục X cho tuần/tháng
  const visibleWeekLabels = useMemo(() => {
    if (isDayView || !safeChartData || safeChartData.length === 0) return new Set<number>();
    const visible = new Set<number>();
    let lastX = -999;
    safeChartData.forEach((pt, idx) => {
      const x = padLeft + (safeChartData.length > 1 ? (idx / (safeChartData.length - 1)) * usableW : usableW / 2);
      if (idx === 0 || idx === safeChartData.length - 1 || x - lastX >= 48) {
        visible.add(idx);
        lastX = x;
      }
    });
    return visible;
  }, [isDayView, safeChartData, usableW, padLeft]);

  return (
    <View style={styles.watchContainerCard}>
      {/* 1. Header phong cách Smartwatch: Trái tim đỏ + Số nhịp tim to nổi bật */}
      <View style={styles.watchHeaderSection}>
        <View style={styles.watchHeartRow}>
          <Ionicons name="heart" size={24} color="#EF4444" style={styles.watchHeartIcon} />
          <Text style={styles.watchBigNumber}>{activeHR > 0 ? activeHR : '--'}</Text>
          <Text style={styles.watchBpmUnit}>BPM</Text>
        </View>

        <View style={styles.watchMetaRow}>
          <Text style={styles.watchTimeBadge}>
            {activePoint ? `Ghi nhận lúc: ${activeTimeLabel}` : chartTitle}
          </Text>
          <View style={styles.watchStatsPillGroup}>
            <View style={styles.watchStatItem}>
              <Text style={styles.watchStatLabel}>Tối đa: </Text>
              <Text style={[styles.watchStatValue, { color: '#EF4444' }]}>{maxHR} bpm</Text>
            </View>
            <View style={styles.watchStatDivider} />
            <View style={styles.watchStatItem}>
              <Text style={styles.watchStatLabel}>Tối thiểu: </Text>
              <Text style={[styles.watchStatValue, { color: '#38BDF8' }]}>{minHR} bpm</Text>
            </View>
            <View style={styles.watchStatDivider} />
            <View style={styles.watchStatItem}>
              <Text style={styles.watchStatLabel}>TB: </Text>
              <Text style={[styles.watchStatValue, { color: '#10B981' }]}>{chartAvg}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Khung biểu đồ cột dạng Smartwatch */}
      {hasData ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.watchScrollContent}
        >
          <View>
            <Svg width={svgWidth} height={chartHeight}>
              {/* Đường đứt đoạn tham chiếu Min & Max như trên Smartwatch */}
              {yUpperRef >= padTop && yUpperRef <= bottomY && (
                <>
                  <Line
                    x1={padLeft}
                    y1={yUpperRef}
                    x2={svgWidth - padRight}
                    y2={yUpperRef}
                    stroke="#475569"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.8}
                  />
                  {/* Nhãn Max HR như 186 trong ảnh */}
                  <SvgText
                    x={padLeft - 6}
                    y={yUpperRef + 4}
                    textAnchor="end"
                    fontSize={11}
                    fontWeight="800"
                    fill="#F1F5F9"
                  >
                    {maxHR}
                  </SvgText>
                </>
              )}

              {/* Đường đứt đoạn tham chiếu Min HR như 48 trong ảnh */}
              {yLowerRef >= padTop && yLowerRef <= bottomY && (
                <>
                  <Line
                    x1={padLeft}
                    y1={yLowerRef}
                    x2={svgWidth - padRight}
                    y2={yLowerRef}
                    stroke="#475569"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.8}
                  />
                  <SvgText
                    x={padLeft - 6}
                    y={yLowerRef + 4}
                    textAnchor="end"
                    fontSize={11}
                    fontWeight="800"
                    fill="#94A3B8"
                  >
                    {minHR}
                  </SvgText>
                </>
              )}

              {/* Lưới trục hoành hiển thị theo từng giờ */}
              {isDayView &&
                hourTicks.map((tick, idx) => (
                  <React.Fragment key={`htick_${idx}`}>
                    <Line
                      x1={tick.x}
                      y1={padTop}
                      x2={tick.x}
                      y2={bottomY}
                      stroke="#1E293B"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <SvgText
                      x={tick.x}
                      y={bottomY + 18}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={tick.isCurrent ? '700' : '500'}
                      fill={tick.isCurrent ? '#EF4444' : '#64748B'}
                    >
                      {tick.label}
                    </SvgText>
                  </React.Fragment>
                ))}

              {/* Nhãn ngày cho Tuần / Tháng */}
              {!isDayView &&
                safeChartData.map((pt, idx) => {
                  if (!visibleWeekLabels.has(idx)) return null;
                  const x = padLeft + (safeChartData.length > 1 ? (idx / (safeChartData.length - 1)) * usableW : usableW / 2);
                  return (
                    <SvgText
                      key={`wlbl_${idx}`}
                      x={x}
                      y={bottomY + 18}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight="500"
                      fill="#64748B"
                    >
                      {pt.label}
                    </SvgText>
                  );
                })}

              {/* Vạch nền nghỉ ngơi đáy (Resting baseline) */}
              <Line
                x1={padLeft}
                y1={bottomY}
                x2={svgWidth - padRight}
                y2={bottomY}
                stroke="#334155"
                strokeWidth={1.5}
              />

              {/* Các cột nhịp tim đa tầng màu (Heart Rate Zone Bars) */}
              {barElements.map((bar, idx) => (
                <React.Fragment key={`bar_${idx}`}>
                  {/* Cột nhịp tim chính với bo góc nhẹ */}
                  <Rect
                    x={bar.x - bar.width / 2}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    rx={1.8}
                    fill={bar.color}
                  />

                  {/* Hiệu ứng nổi bật cho cột đang được chọn/tua */}
                  {bar.isClosest && (
                    <>
                      <Line
                        x1={bar.x}
                        y1={padTop - 6}
                        x2={bar.x}
                        y2={bottomY}
                        stroke="#FFFFFF"
                        strokeWidth={1.2}
                        strokeDasharray="2 2"
                        opacity={0.8}
                      />
                      <Circle
                        cx={bar.x}
                        cy={bar.y}
                        r={3.8}
                        fill="#FFFFFF"
                      />
                      <SvgText
                        x={bar.x}
                        y={Math.max(padTop - 4, bar.y - 7)}
                        textAnchor="middle"
                        fontSize={10.5}
                        fontWeight="800"
                        fill="#FFFFFF"
                      >
                        {bar.hr}
                      </SvgText>
                    </>
                  )}
                </React.Fragment>
              ))}
            </Svg>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.watchEmptyBox}>
          <Ionicons name="stats-chart-outline" size={32} color="#64748B" style={{ marginBottom: 6 }} />
          <Text style={styles.watchEmptyText}>Chưa có dữ liệu nhịp tim trong ngày</Text>
        </View>
      )}

      {/* 3. Bảng phân vùng nhịp tim trực quan dưới chân thẻ */}
      <View style={styles.watchZoneLegendRow}>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#64748B' }]} />
          <Text style={styles.zoneLegendText}>&lt;65 Nghỉ</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#0284C7' }]} />
          <Text style={styles.zoneLegendText}>65-84 Nhẹ</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.zoneLegendText}>85-99 Vừa</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.zoneLegendText}>100-119 Cao</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.zoneLegendText}>≥120 Đỉnh</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  watchContainerCard: {
    backgroundColor: '#090D16',
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    ...Shadows.soft,
  },
  watchHeaderSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  watchHeartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  watchHeartIcon: {
    marginRight: 2,
  },
  watchBigNumber: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  watchBpmUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginLeft: 4,
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  watchMetaRow: {
    alignItems: 'center',
    marginTop: 2,
  },
  watchTimeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  watchStatsPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 8,
  },
  watchStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchStatLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  watchStatValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  watchStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#374151',
  },
  watchScrollContent: {
    paddingVertical: 4,
  },
  watchEmptyBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchEmptyText: {
    fontSize: 12,
    color: '#64748B',
  },
  watchZoneLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  zoneLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoneLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  zoneLegendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
});

export default HealthChartSection;

// ==============================================================================
// TỆP: HealthChartSection.tsx
// PHÂN HỆ: Biểu đồ Cột Nhịp tim Smartwatch Chuẩn Y Tế (HealthDetailScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My & C1SE34 Team
// MÔ TẢ CHỨC NĂNG:
//   - Tự động thích ứng màu Trắng / Đen theo giao diện người dùng (Light / Dark mode).
//   - Tái hiện chính xác phong cách Smartwatch (Heart Rate Zone Bars):
//     + Trái tim đỏ cùng chỉ số nhịp tim nổi bật (Bold Metric).
//     + Đường đứt đoạn tham chiếu Min và Max chuẩn y tế, KHÔNG ĐÈ LÊN NHAU.
//     + Các cột đo mật độ cao đổi màu theo 5 phân vùng nhịp tim:
//       * Xám (<65 bpm): Nghỉ ngơi / baseline
//       * Xanh lam (65 - 84 bpm): Nhịp tim nhẹ / khởi động
//       * Xanh lục (85 - 99 bpm): Nhịp tim vừa / bình thường
//       * Vàng (100 - 119 bpm): Vận động / gắng sức
//       * Đỏ (>= 120 bpm): Đỉnh cảnh báo nhịp tim nhanh
//     + Trục thời gian 0h - 24h (ngày khác) hoặc 0h - hiện tại (hôm nay).
//     + CHẾ ĐỘ TUẦN / THÁNG: Hiển thị ĐẦY ĐỦ TỪNG NGÀY THEO LỊCH (7 ngày cho Tuần,
//       30 ngày cho Tháng), các cột ngày phân bổ đều, không dính chùm hay đè nhau.
//   - Nạp và hiển thị đầy đủ và trung thực dữ liệu sinh hiệu thực tế từ CSDL.
// ==============================================================================

import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Circle, Line, Text as SvgText } from 'react-native-svg';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Shadows } from '../../../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Hàm gán màu theo 5 phân vùng nhịp tim (Heart Rate Zones) chuẩn y tế & smartwatch
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
  dateStr?: string;
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
  isDarkMode = false,
  isToday = false,
  selectedRange = 'DAY',
}) => {
  const containerWidth = SCREEN_WIDTH - 64;
  const scrollRef = useRef<any>(null);

  const chartHeight = 165;
  const isDayView = !selectedRange || selectedRange === 'DAY';

  // Dữ liệu an toàn:
  // - Theo Ngày: chỉ lấy các bản ghi có số đo hr > 0
  // - Theo Tuần/Tháng: giữ đầy đủ toàn bộ các ngày (kể cả hr = 0) để hiển thị trục ngày chuẩn
  const safeChartData = useMemo(() => {
    if (!chartData || !Array.isArray(chartData)) return [];
    if (isDayView) {
      return chartData.filter(
        (p) => p && typeof p.hr === 'number' && Number.isFinite(p.hr) && p.hr > 0
      );
    }
    return chartData.filter((p) => p && typeof p.label === 'string');
  }, [chartData, isDayView]);

  const hasData = useMemo(() => {
    if (isDayView) return safeChartData.length > 0;
    return safeChartData.some((p) => typeof p.hr === 'number' && p.hr > 0);
  }, [isDayView, safeChartData]);

  // Giới hạn thời gian (phút) cho trục hoành ngày
  const maxMinutes = useMemo(() => {
    if (!isDayView) return 1440;
    if (isToday) {
      const now = new Date();
      const nowM = now.getHours() * 60 + now.getMinutes();
      return Math.max(60, nowM);
    }
    return 1440;
  }, [isDayView, isToday]);

  const padLeft = 36;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 28;

  // Tính chiều rộng tổng thể của biểu đồ
  const totalHours = useMemo(() => {
    if (!isDayView) return safeChartData.length || 7;
    return isToday ? Math.max(1, Math.ceil(maxMinutes / 60)) : 24;
  }, [isDayView, isToday, maxMinutes, safeChartData.length]);

  const svgWidth = useMemo(() => {
    if (!hasData) return containerWidth;
    if (isDayView) {
      // Mỗi giờ được cấp 46px để cuộn mượt và thoáng chữ
      const calculatedW = totalHours * 46 + padLeft + padRight;
      return Math.max(containerWidth, calculatedW);
    }
    // Chế độ Tuần: 7 ngày hiển thị vừa vặn trong màn hình không cần cuộn
    if (selectedRange === 'WEEK') {
      return containerWidth;
    }
    // Chế độ Tháng: 30 ngày cho phép cuộn ngang thoải mái (mỗi ngày 22px)
    return Math.max(containerWidth, 30 * 22 + padLeft + padRight);
  }, [hasData, isDayView, selectedRange, totalHours, containerWidth, padLeft, padRight]);

  const usableW = Math.max(60, svgWidth - padLeft - padRight);
  const usableH = chartHeight - padTop - padBottom;
  const bottomY = chartHeight - padBottom;

  // Tự động cuộn đến điểm đo mới nhất (thời điểm hiện tại) khi mở biểu đồ hôm nay hoặc 30 ngày
  useEffect(() => {
    if ((isToday || selectedRange === 'MONTH') && hasData && scrollRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isToday, selectedRange, hasData]);

  // Thống kê Min / Max / Average của nhịp tim thực tế trong CSDL (chỉ tính mốc có hr > 0)
  const { minHR, maxHR, avgHRNum } = useMemo(() => {
    const validPoints = safeChartData.filter((p) => typeof p.hr === 'number' && p.hr > 0);
    if (validPoints.length === 0) return { minHR: 48, maxHR: 100, avgHRNum: 75 };
    const hrs = validPoints.map((p) => p.hr);
    const minVal = Math.min(...hrs);
    const maxVal = Math.max(...hrs);
    const avg = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
    return { minHR: minVal, maxHR: maxVal, avgHRNum: avg };
  }, [safeChartData]);

  // Tìm điểm đo đang được chọn / tua
  const closestIndex = useMemo(() => {
    if (!safeChartData || safeChartData.length === 0) return -1;
    if (closestVital?.id) {
      const match = safeChartData.findIndex((c) => c.id === closestVital.id);
      if (match !== -1) return match;
    }
    if (isDayView && scrubberMinutes !== undefined) {
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
    // Đối với tuần/tháng: mặc định chọn ngày cuối cùng (hôm nay)
    return safeChartData.length - 1;
  }, [closestVital, safeChartData, scrubberMinutes, isDayView]);

  // Điểm đo nhịp tim đang được chọn hiển thị số to trên đầu
  const activePoint = useMemo(() => {
    if (!safeChartData || safeChartData.length === 0) return null;
    if (closestIndex >= 0 && closestIndex < safeChartData.length) {
      const pt = safeChartData[closestIndex];
      if (pt && pt.hr > 0) return pt;
    }
    const withData = safeChartData.filter((p) => p.hr > 0);
    if (withData.length > 0) return withData[withData.length - 1];
    return safeChartData[safeChartData.length - 1];
  }, [safeChartData, closestIndex]);

  const activeHR = activePoint && activePoint.hr > 0 ? activePoint.hr : (closestVital?.heart_rate ?? avgHRNum);
  const activeTimeLabel = isDayView
    ? (activePoint ? `Ghi nhận lúc: ${activePoint.label}` : chartTitle)
    : (activePoint ? `Ngày: ${activePoint.label}` : chartTitle);

  // Giới hạn trục Y và ĐẢM BẢO ĐƯỜNG MAX VÀ MIN KHÔNG ĐÈ LÊN NHAU
  const { yMinLimit, yRange, yUpperRef, yLowerRef } = useMemo(() => {
    const minScale = Math.max(30, minHR - 6);
    const maxScale = Math.max(minScale + 40, maxHR + 8);
    const range = Math.max(30, maxScale - minScale);

    let _yUpper = padTop + (1 - (maxHR - minScale) / range) * usableH;
    let _yLower = padTop + (1 - (minHR - minScale) / range) * usableH;

    // Khóa khoảng cách tối thiểu 32px giữa Max và Min
    if (_yLower - _yUpper < 32) {
      const center = (_yUpper + _yLower) / 2;
      _yUpper = Math.max(padTop + 6, center - 16);
      _yLower = Math.min(bottomY - 6, center + 16);
    }

    return {
      yMinLimit: minScale,
      yRange: range,
      yUpperRef: _yUpper,
      yLowerRef: _yLower,
    };
  }, [minHR, maxHR, padTop, usableH, bottomY]);

  // Mốc giờ trục hoành cho chế độ Ngày
  const hourTicks = useMemo(() => {
    if (!isDayView) return [];
    const ticks: { hour: number; x: number; label: string; isCurrent?: boolean }[] = [];
    const totalH = isToday ? Math.floor(maxMinutes / 60) : 24;

    const pxPerHour = usableW / Math.max(1, totalH);
    let step = 1;
    if (pxPerHour < 24) {
      step = 4;
    } else if (pxPerHour < 40) {
      step = 2;
    } else {
      step = 1;
    }

    const currentX = padLeft + usableW;

    for (let h = 0; h <= totalH; h += step) {
      const m = h * 60;
      const x = padLeft + (m / maxMinutes) * usableW;
      if (isToday && Math.abs(currentX - x) < 38) {
        continue;
      }
      const lbl = h < 10 ? `0${h}:00` : `${h}:00`;
      ticks.push({ hour: h, x, label: lbl });
    }

    if (isToday) {
      const hh = Math.floor(maxMinutes / 60);
      const mm = maxMinutes % 60;
      const lbl = `${hh < 10 ? `0${hh}` : hh}:${mm < 10 ? `0${mm}` : mm}`;
      ticks.push({ hour: hh, x: currentX, label: lbl, isCurrent: true });
    }

    return ticks;
  }, [isDayView, isToday, maxMinutes, usableW, padLeft]);

  // CỘT BIỂU ĐỒ: Xử lý theo từng ngày cho Tuần / Tháng và theo slot cho Ngày
  const barElements = useMemo(() => {
    if (!hasData && isDayView) return [];

    if (!isDayView) {
      // Chế độ Tuần (7 ngày) hoặc Tháng (30 ngày):
      // Mỗi ngày là 1 cột đứng độc lập trên trục lịch, phân bổ đều từ ngày đầu đến hôm nay
      const totalDays = safeChartData.length;
      return safeChartData.map((pt, idx) => {
        const x = padLeft + (totalDays > 1 ? (idx / (totalDays - 1)) * usableW : usableW / 2);
        const hasDayData = typeof pt.hr === 'number' && pt.hr > 0;
        const norm = hasDayData ? Math.min(1, Math.max(0.12, (pt.hr - yMinLimit) / yRange)) : 0;
        const bHeight = hasDayData ? norm * usableH : 4.2;
        const bY = bottomY - bHeight;
        const color = hasDayData ? getHeartRateZoneColor(pt.hr) : (isDarkMode ? '#334155' : '#CBD5E1');
        const barW = totalDays <= 7 ? 14 : 5.2;

        return {
          x,
          y: bY,
          width: barW,
          height: bHeight,
          color,
          hr: pt.hr,
          label: pt.label,
          isClosest: idx === closestIndex,
          isBaseline: !hasDayData,
        };
      });
    }

    // Chế độ Ngày (0 - 24h hoặc 0 - hiện tại): Slotting theo các mốc 5-10 phút
    const slotMinutes = Math.max(5, Math.ceil(maxMinutes / 120));
    const numSlots = Math.ceil(maxMinutes / slotMinutes);
    const slotStepPx = usableW / numSlots;
    const barW = Math.max(3.2, Math.min(7.5, slotStepPx * 0.72));

    const bars: any[] = [];
    const nowMinutes = isToday ? maxMinutes : 1440;

    for (let s = 0; s < numSlots; s++) {
      const startM = s * slotMinutes;
      const endM = startM + slotMinutes;
      const midM = (startM + endM) / 2;
      const x = padLeft + (midM / maxMinutes) * usableW;

      const matches = safeChartData.filter(
        (p) => p.minute !== undefined && p.minute >= startM && p.minute < endM
      );

      if (matches.length > 0) {
        const peakHR = Math.max(...matches.map((m) => m.hr));
        const norm = Math.min(1, Math.max(0.12, (peakHR - yMinLimit) / yRange));
        const bHeight = norm * usableH;
        const bY = bottomY - bHeight;
        const color = getHeartRateZoneColor(peakHR);
        const isClosest = matches.some((m) => safeChartData.indexOf(m) === closestIndex);

        bars.push({
          x,
          y: bY,
          width: barW,
          height: bHeight,
          color,
          hr: peakHR,
          label: matches[0].label,
          isClosest,
          isBaseline: false,
        });
      } else if (startM <= nowMinutes) {
        const baseH = 4.2;
        const bY = bottomY - baseH;
        const baseColor = isDarkMode ? '#334155' : '#CBD5E1';

        bars.push({
          x,
          y: bY,
          width: barW,
          height: baseH,
          color: baseColor,
          hr: 0,
          label: '',
          isClosest: false,
          isBaseline: true,
        });
      }
    }

    return bars;
  }, [
    safeChartData,
    hasData,
    isDayView,
    maxMinutes,
    isToday,
    usableW,
    padLeft,
    usableH,
    bottomY,
    yMinLimit,
    yRange,
    closestIndex,
    isDarkMode,
  ]);

  // Bảng màu thích ứng động theo giao diện Trắng / Đen
  const cardBg = isDarkMode ? '#090D16' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1E293B' : '#E2E8F0';
  const bigNumColor = isDarkMode ? '#FFFFFF' : '#0F172A';
  const subTextColor = isDarkMode ? '#94A3B8' : '#64748B';
  const pillBg = isDarkMode ? '#111827' : '#F8FAFC';
  const pillBorder = isDarkMode ? '#1F2937' : '#E2E8F0';
  const pillDivider = isDarkMode ? '#374151' : '#E2E8F0';
  const refLineColor = isDarkMode ? '#475569' : '#CBD5E1';
  const maxLabelColor = isDarkMode ? '#F87171' : '#DC2626';
  const minLabelColor = isDarkMode ? '#38BDF8' : '#0284C7';
  const hourLineColor = isDarkMode ? '#1E293B' : '#F1F5F9';
  const baselineColor = isDarkMode ? '#334155' : '#E2E8F0';
  const activeCursorColor = isDarkMode ? '#FFFFFF' : '#0F172A';
  const legendBorderColor = isDarkMode ? '#1E293B' : '#F1F5F9';

  return (
    <View style={[styles.watchContainerCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* 1. Header Smartwatch: Trái tim đỏ + Số nhịp tim to thích ứng màu theme */}
      <View style={styles.watchHeaderSection}>
        <View style={styles.watchHeartRow}>
          <Ionicons name="heart" size={24} color="#EF4444" style={styles.watchHeartIcon} />
          <Text style={[styles.watchBigNumber, { color: bigNumColor }]}>{activeHR > 0 ? activeHR : '--'}</Text>
          <Text style={[styles.watchBpmUnit, { color: subTextColor }]}>BPM</Text>
        </View>

        <View style={styles.watchMetaRow}>
          <Text style={[styles.watchTimeBadge, { color: subTextColor }]}>
            {activeTimeLabel}
          </Text>
          <View style={[styles.watchStatsPillGroup, { backgroundColor: pillBg, borderColor: pillBorder }]}>
            <View style={styles.watchStatItem}>
              <Text style={[styles.watchStatLabel, { color: subTextColor }]}>Tối đa: </Text>
              <Text style={[styles.watchStatValue, { color: '#EF4444' }]}>{maxHR} bpm</Text>
            </View>
            <View style={[styles.watchStatDivider, { backgroundColor: pillDivider }]} />
            <View style={styles.watchStatItem}>
              <Text style={[styles.watchStatLabel, { color: subTextColor }]}>Tối thiểu: </Text>
              <Text style={[styles.watchStatValue, { color: '#0284C7' }]}>{minHR} bpm</Text>
            </View>
            <View style={[styles.watchStatDivider, { backgroundColor: pillDivider }]} />
            <View style={styles.watchStatItem}>
              <Text style={[styles.watchStatLabel, { color: subTextColor }]}>TB: </Text>
              <Text style={[styles.watchStatValue, { color: '#10B981' }]}>
                {String(chartAvg || '').replace('Trung bình: ', '')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Khung biểu đồ cột dạng Smartwatch: Không chồng đè đường line */}
      {hasData ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.watchScrollContent}
        >
          <View>
            <Svg width={svgWidth} height={chartHeight}>
              {/* Đường đứt đoạn tham chiếu Max HR */}
              {yUpperRef >= padTop && yUpperRef <= bottomY && (
                <>
                  <Line
                    x1={padLeft}
                    y1={yUpperRef}
                    x2={svgWidth - padRight}
                    y2={yUpperRef}
                    stroke={refLineColor}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.85}
                  />
                  <SvgText
                    x={padLeft - 6}
                    y={yUpperRef + 4}
                    textAnchor="end"
                    fontSize={11}
                    fontWeight="800"
                    fill={maxLabelColor}
                  >
                    {maxHR}
                  </SvgText>
                </>
              )}

              {/* Đường đứt đoạn tham chiếu Min HR */}
              {yLowerRef >= padTop && yLowerRef <= bottomY && (
                <>
                  <Line
                    x1={padLeft}
                    y1={yLowerRef}
                    x2={svgWidth - padRight}
                    y2={yLowerRef}
                    stroke={refLineColor}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.85}
                  />
                  <SvgText
                    x={padLeft - 6}
                    y={yLowerRef + 4}
                    textAnchor="end"
                    fontSize={11}
                    fontWeight="800"
                    fill={minLabelColor}
                  >
                    {minHR}
                  </SvgText>
                </>
              )}

              {/* Lưới trục hoành hiển thị theo giờ (chế độ Ngày) */}
              {isDayView &&
                hourTicks.map((tick, idx) => (
                  <React.Fragment key={`htick_${idx}`}>
                    <Line
                      x1={tick.x}
                      y1={padTop}
                      x2={tick.x}
                      y2={bottomY}
                      stroke={hourLineColor}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <SvgText
                      x={tick.x}
                      y={bottomY + 18}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={tick.isCurrent ? '700' : '500'}
                      fill={tick.isCurrent ? '#EF4444' : subTextColor}
                    >
                      {tick.label}
                    </SvgText>
                  </React.Fragment>
                ))}

              {/* Nhãn ngày cho Tuần (7 ngày đầy đủ) hoặc Tháng (30 ngày) */}
              {!isDayView &&
                safeChartData.map((pt, idx) => {
                  const totalDays = safeChartData.length;
                  // Nếu là tuần (7 ngày): hiện toàn bộ cả 7 ngày!
                  // Nếu là tháng (30 ngày): hiện cách nhau 5 ngày và ngày cuối cùng (hôm nay)
                  const shouldShow =
                    totalDays <= 7 || idx === 0 || idx === totalDays - 1 || idx % 5 === 0;
                  if (!shouldShow) return null;
                  const x = padLeft + (totalDays > 1 ? (idx / (totalDays - 1)) * usableW : usableW / 2);
                  const isCurrentDay = idx === totalDays - 1;
                  return (
                    <SvgText
                      key={`wlbl_${idx}`}
                      x={x}
                      y={bottomY + 18}
                      textAnchor="middle"
                      fontSize={totalDays <= 7 ? 10 : 9}
                      fontWeight={isCurrentDay ? '700' : '500'}
                      fill={isCurrentDay ? '#EF4444' : subTextColor}
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
                stroke={baselineColor}
                strokeWidth={1.5}
              />

              {/* Các cột nhịp tim đa tầng màu (Heart Rate Zone Bars) */}
              {barElements.map((bar, idx) => (
                <React.Fragment key={`bar_${idx}`}>
                  <Rect
                    x={bar.x - bar.width / 2}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    rx={1.6}
                    fill={bar.color}
                  />

                  {/* Hiệu ứng nổi bật cho cột đang được chọn */}
                  {bar.isClosest && !bar.isBaseline && (
                    <>
                      <Line
                        x1={bar.x}
                        y1={padTop - 6}
                        x2={bar.x}
                        y2={bottomY}
                        stroke={activeCursorColor}
                        strokeWidth={1.2}
                        strokeDasharray="2 2"
                        opacity={0.8}
                      />
                      <Circle
                        cx={bar.x}
                        cy={bar.y}
                        r={3.8}
                        fill={activeCursorColor}
                      />
                      <SvgText
                        x={bar.x}
                        y={Math.max(padTop - 4, bar.y - 7)}
                        textAnchor="middle"
                        fontSize={10.5}
                        fontWeight="800"
                        fill={activeCursorColor}
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
          <Ionicons name="stats-chart-outline" size={32} color={subTextColor} style={{ marginBottom: 6 }} />
          <Text style={[styles.watchEmptyText, { color: subTextColor }]}>
            Chưa có bản ghi nhịp tim trong {chartSubtitle || ''}
          </Text>
        </View>
      )}

      {/* 3. Bảng phân vùng nhịp tim trực quan dưới chân thẻ */}
      <View style={[styles.watchZoneLegendRow, { borderTopColor: legendBorderColor }]}>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#64748B' }]} />
          <Text style={[styles.zoneLegendText, { color: subTextColor }]}>&lt;65 Nghỉ</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#0284C7' }]} />
          <Text style={[styles.zoneLegendText, { color: subTextColor }]}>65-84 Nhẹ</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.zoneLegendText, { color: subTextColor }]}>85-99 Vừa</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.zoneLegendText, { color: subTextColor }]}>100-119 Cao</Text>
        </View>
        <View style={styles.zoneLegendItem}>
          <View style={[styles.zoneLegendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[styles.zoneLegendText, { color: subTextColor }]}>≥120 Đỉnh</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  watchContainerCard: {
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
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
    letterSpacing: -1,
  },
  watchBpmUnit: {
    fontSize: 13,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  watchStatsPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  watchStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchStatLabel: {
    fontSize: 11,
  },
  watchStatValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  watchStatDivider: {
    width: 1,
    height: 12,
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
  },
  watchZoneLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
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
  },
});

export default HealthChartSection;

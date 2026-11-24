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
//     + CÁC ĐƯỜNG LINE VÀ NHÃN THỜI GIAN ĐƯỢC PHÂN BỔ KHOẢNG CÁCH TOÁN HỌC,
//       TUYỆT ĐỐI KHÔNG BỊ ĐÈ CHỒNG LÊN NHAU.
//   - Nạp và hiển thị đầy đủ và trung thực dữ liệu sinh hiệu thực tế từ CSDL.
// ==============================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  colors = {},
  isToday = false,
  selectedRange = 'DAY',
}) => {
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 64);
  const scrollRef = useRef<any>(null);

  const chartHeight = 165;
  const isDayView = !selectedRange || selectedRange === 'DAY';

  const safeChartData = useMemo(
    () =>
      (chartData || []).filter(
        (p) => p && typeof p.hr === 'number' && Number.isFinite(p.hr) && p.hr > 0
      ),
    [chartData]
  );
  const hasData = safeChartData.length > 0;

  // Giới hạn thời gian (phút) cho trục hoành:
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

  const padLeft = 36;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 28;

  // Tính chiều rộng tổng thể của biểu đồ để đảm bảo cuộn mượt và không bị nén chữ
  const totalHours = useMemo(() => {
    if (!isDayView) return Math.max(7, safeChartData.length);
    return isToday ? Math.max(1, Math.ceil(maxMinutes / 60)) : 24;
  }, [isDayView, isToday, maxMinutes, safeChartData.length]);

  const svgWidth = useMemo(() => {
    if (!hasData) return containerWidth;
    if (isDayView) {
      // Mỗi giờ được cấp tối thiểu 46px để các cột và nhãn cách nhau thông thoáng
      const calculatedW = totalHours * 46 + padLeft + padRight;
      return Math.max(containerWidth, calculatedW);
    }
    return Math.max(containerWidth, safeChartData.length * 48);
  }, [hasData, isDayView, totalHours, containerWidth, safeChartData.length, padLeft, padRight]);

  const usableW = Math.max(60, svgWidth - padLeft - padRight);
  const usableH = chartHeight - padTop - padBottom;
  const bottomY = chartHeight - padBottom;

  // Tự động cuộn đến điểm đo mới nhất (thời điểm hiện tại) khi mở biểu đồ hôm nay
  useEffect(() => {
    if (isToday && hasData && scrollRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isToday, hasData]);

  // Thống kê Min / Max / Average của nhịp tim thực tế trong CSDL
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

  // Điểm đo nhịp tim đang được chọn hiển thị số to trên đầu
  const activePoint = useMemo(() => {
    if (!hasData) return null;
    if (closestIndex >= 0 && closestIndex < safeChartData.length) {
      return safeChartData[closestIndex];
    }
    return safeChartData[safeChartData.length - 1];
  }, [hasData, closestIndex, safeChartData]);

  const activeHR = activePoint ? activePoint.hr : (closestVital?.heart_rate ?? avgHRNum);
  const activeTimeLabel = activePoint?.label || (closestVital?.time ? closestVital.time.slice(11, 16) : 'Hiện tại');

  // Tính toán giới hạn trục Y và ĐẢM BẢO ĐƯỜNG MAX VÀ MIN KHÔNG ĐÈ LÊN NHAU
  const { yMinLimit, yMaxLimit, yRange, yUpperRef, yLowerRef } = useMemo(() => {
    const minScale = Math.max(30, minHR - 6);
    const maxScale = Math.max(minScale + 40, maxHR + 8);
    const range = Math.max(30, maxScale - minScale);

    let _yUpper = padTop + (1 - (maxHR - minScale) / range) * usableH;
    let _yLower = padTop + (1 - (minHR - minScale) / range) * usableH;

    // RÀNG BUỘC KHOẢNG CÁCH: Tuyệt đối không cho 2 đường tham chiếu đè lên nhau (tối thiểu 32px)
    if (_yLower - _yUpper < 32) {
      const center = (_yUpper + _yLower) / 2;
      _yUpper = Math.max(padTop + 6, center - 16);
      _yLower = Math.min(bottomY - 6, center + 16);
    }

    return {
      yMinLimit: minScale,
      yMaxLimit: maxScale,
      yRange: range,
      yUpperRef: _yUpper,
      yLowerRef: _yLower,
    };
  }, [minHR, maxHR, padTop, usableH, bottomY]);

  // PHÂN BỔ MỐC GIỜ THÔNG MINH: ĐẢM BẢO CÁC ĐƯỜNG LINE VÀ NHÃN GIỜ KHÔNG ĐÈ LÊN NHAU
  const hourTicks = useMemo(() => {
    if (!isDayView) return [];
    const ticks: { hour: number; x: number; label: string; isCurrent?: boolean }[] = [];
    const totalH = isToday ? Math.floor(maxMinutes / 60) : 24;

    // Tính bước nhảy giờ sao cho khoảng cách giữa 2 vạch trục X tối thiểu 48px
    const pxPerHour = usableW / Math.max(1, totalH);
    let step = 1;
    if (pxPerHour < 24) {
      step = 4; // Màn hình hẹp: hiển thị mỗi 4 giờ (0, 4, 8, 12, 16, 20...)
    } else if (pxPerHour < 40) {
      step = 2; // Hiển thị mỗi 2 giờ (0, 2, 4, 6, 8...)
    } else {
      step = 1; // Hiển thị từng giờ
    }

    const currentX = padLeft + usableW;

    for (let h = 0; h <= totalH; h += step) {
      const m = h * 60;
      const x = padLeft + (m / maxMinutes) * usableW;
      // Tránh để vạch giờ cuối cùng đè lên nhãn thời gian hiện tại
      if (isToday && Math.abs(currentX - x) < 38) {
        continue;
      }
      const lbl = h < 10 ? `0${h}:00` : `${h}:00`;
      ticks.push({ hour: h, x, label: lbl });
    }

    // Nhãn mốc thời gian hiện tại cho ngày hôm nay (màu đỏ nổi bật)
    if (isToday) {
      const hh = Math.floor(maxMinutes / 60);
      const mm = maxMinutes % 60;
      const lbl = `${hh < 10 ? `0${hh}` : hh}:${mm < 10 ? `0${mm}` : mm}`;
      ticks.push({ hour: hh, x: currentX, label: lbl, isCurrent: true });
    }

    return ticks;
  }, [isDayView, isToday, maxMinutes, usableW, padLeft]);

  // TỔNG HỢP CÁC CỘT THEO KHUNG THỜI GIAN (SLOTS): ĐẢM BẢO CÁC CỘT KHÔNG ĐÈ CHỒNG LÊN NHAU
  const barElements = useMemo(() => {
    if (!hasData) return [];

    if (!isDayView) {
      // Chế độ Tuần / Tháng: Mỗi ngày là 1 cột riêng biệt
      return safeChartData.map((pt, idx) => {
        const x = padLeft + (safeChartData.length > 1 ? (idx / (safeChartData.length - 1)) * usableW : usableW / 2);
        const norm = Math.min(1, Math.max(0.12, (pt.hr - yMinLimit) / yRange));
        const bHeight = norm * usableH;
        const bY = bottomY - bHeight;
        const color = getHeartRateZoneColor(pt.hr);
        return {
          x,
          y: bY,
          width: 8,
          height: bHeight,
          color,
          hr: pt.hr,
          label: pt.label,
          isClosest: idx === closestIndex,
          isBaseline: false,
        };
      });
    }

    // Chế độ Ngày (0 - 24h hoặc 0 - hiện tại):
    // Phân bổ thành các khoảng thời gian (slots) đều đặn (mỗi slot 5 - 10 phút)
    // để mỗi cột đứng ở vị trí độc lập, tuyệt đối không bị đè chồng lên nhau
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

      // Tìm tất cả các bản ghi nhịp tim trong CSDL rơi vào khoảng thời gian này
      const matches = safeChartData.filter(
        (p) => p.minute !== undefined && p.minute >= startM && p.minute < endM
      );

      if (matches.length > 0) {
        // Lấy nhịp tim đỉnh (peak) trong khung giờ này để làm nổi bật dao động y tế
        const peakHR = Math.max(...matches.map((m) => m.hr));
        const norm = Math.min(1, Math.max(0.12, (peakHR - yMinLimit) / yRange));
        const bHeight = norm * usableH;
        const bY = bottomY - bHeight;
        const color = getHeartRateZoneColor(peakHR);
        const isClosest = matches.some((m, mIdx) => safeChartData.indexOf(m) === closestIndex);

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
        // Khung thời gian đã qua chưa có đo đạc: hiển thị vạch resting baseline nhẹ ở đáy
        // tái hiện hoàn hảo phong cách smartwatch như trong hình ảnh người dùng yêu cầu
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

  // Lọc nhãn trục X cho Tuần / Tháng
  const visibleWeekLabels = useMemo(() => {
    if (isDayView || !safeChartData || safeChartData.length === 0) return new Set<number>();
    const visible = new Set<number>();
    let lastX = -999;
    safeChartData.forEach((pt, idx) => {
      const x = padLeft + (safeChartData.length > 1 ? (idx / (safeChartData.length - 1)) * usableW : usableW / 2);
      if (idx === 0 || idx === safeChartData.length - 1 || x - lastX >= 52) {
        visible.add(idx);
        lastX = x;
      }
    });
    return visible;
  }, [isDayView, safeChartData, usableW, padLeft]);

  // Bảng màu thích ứng động theo giao diện Trắng / Đen (Light Mode / Dark Mode)
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
            {activePoint ? `Ghi nhận lúc: ${activeTimeLabel}` : chartTitle}
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
              <Text style={[styles.watchStatValue, { color: '#10B981' }]}>{chartAvg}</Text>
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
              {/* Đường đứt đoạn tham chiếu Max HR chuẩn y tế */}
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
                  {/* Nhãn Max HR đặt sát lề trái, tuyệt đối không đè vạch Min */}
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

              {/* Đường đứt đoạn tham chiếu Min HR chuẩn y tế */}
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
                  {/* Nhãn Min HR */}
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

              {/* Lưới trục hoành hiển thị theo giờ có bước nhảy thông minh tránh đè line */}
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
                      fill={subTextColor}
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

              {/* Các cột nhịp tim đa tầng màu (Heart Rate Zone Bars) - vị trí độc lập không đè nhau */}
              {barElements.map((bar, idx) => (
                <React.Fragment key={`bar_${idx}`}>
                  {/* Cột nhịp tim chính với bo góc nhẹ */}
                  <Rect
                    x={bar.x - bar.width / 2}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    rx={1.6}
                    fill={bar.color}
                  />

                  {/* Hiệu ứng nổi bật cho cột đang được chọn/tua */}
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
            Chưa có bản ghi nhịp tim trong ngày {chartSubtitle || ''}
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

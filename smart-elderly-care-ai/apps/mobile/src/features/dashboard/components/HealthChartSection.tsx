// ==============================================================================
// TỆP: HealthChartSection.tsx
// PHÂN HỆ: Biểu đồ Đường Sóng Dao động Nhịp tim theo Thời gian (HealthDetailScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My & C1SE34 Team
// MÔ TẢ CHỨC NĂNG:
//   - Trực quan hóa dao động nhịp tim với tone màu ĐỎ y tế chuẩn (#EF4444 / #DC2626).
//   - Trục hoành phân bổ theo từng giờ:
//     + Ngày khác: Hiển thị liên tục 0h - 24h với mốc giờ rõ ràng.
//     + Ngày hiện tại (isToday): Hiển thị từ 0h tới thời điểm hiện tại (now).
//   - Tọa độ các điểm đo được map chính xác theo phút trong ngày (pt.minute / maxMinutes).
//   - Chống đè chữ: Chỉ hiển thị nhãn bpm tại điểm đo đang tua (active/closest point),
//     trục X hiển thị theo từng mốc giờ (00:00, 01:00, ...) có khoảng cách an toàn.
//   - Tự động cuộn đến thời điểm hiện tại khi mở màn hình ngày hôm nay.
// ==============================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Shadows } from '../../../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Cấu trúc một điểm dữ liệu trên biểu đồ nhịp tim
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

  const chartHeight = 150;
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
  // Nếu là ngày hôm nay: chạy từ 0 đến phút hiện tại
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

  const padLeft = 24;
  const padRight = 24;
  const padTop = 32;
  const padBottom = 28;

  // Tính toán chiều rộng đồ thị:
  // Trong Day View: Mỗi giờ chiếm 44px để hiển thị nhãn từng giờ (00:00, 01:00...) thông thoáng, không bị đè
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

  // Tự động cuộn đến cuối (thời điểm hiện tại) khi mở biểu đồ ngày hôm nay
  useEffect(() => {
    if (isToday && hasData && scrollRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isToday, hasData]);

  // Danh sách các mốc giờ trên trục hoành (hiển thị theo từng giờ từ 0h đến 24h hoặc tới hiện tại)
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
    // Nếu hôm nay và phút hiện tại lệch trên 10 phút so với giờ chẵn cuối
    if (isToday && maxMinutes % 60 >= 10) {
      const x = padLeft + usableW;
      const hh = Math.floor(maxMinutes / 60);
      const mm = maxMinutes % 60;
      const lbl = `${hh < 10 ? `0${hh}` : hh}:${mm < 10 ? `0${mm}` : mm}`;
      ticks.push({ hour: hh, x, label: lbl, isCurrent: true });
    }
    return ticks;
  }, [isDayView, isToday, maxMinutes, usableW, padLeft]);

  // Tính toán tọa độ các điểm đo và đường cong Bezier
  const { coords, linePath, areaPath, y60, y100 } = useMemo(() => {
    if (!hasData) {
      return { coords: [], linePath: '', areaPath: '', y60: 0, y100: 0 };
    }
    const hrs = safeChartData.map((p) => p.hr);
    const minVal = Math.max(30, Math.min(...hrs, 55) - 8);
    const maxVal = Math.min(180, Math.max(...hrs, 105) + 8);
    const range = Math.max(20, maxVal - minVal);

    const baseCoords = safeChartData.map((point, idx) => {
      let x: number;
      if (isDayView) {
        const ptMin = point.minute !== undefined && point.minute >= 0 ? point.minute : 0;
        const ratio = Math.min(1, Math.max(0, ptMin / maxMinutes));
        x = padLeft + ratio * usableW;
      } else {
        x = padLeft + (safeChartData.length > 1 ? (idx / (safeChartData.length - 1)) * usableW : usableW / 2);
      }
      const normY = (point.hr - minVal) / range;
      const y = padTop + (1 - normY) * usableH;
      return {
        x: Number.isFinite(x) ? x : padLeft,
        y: Number.isFinite(y) ? y : padTop + usableH / 2,
        hr: point.hr,
        label: point.label || '',
        id: point.id,
        minute: point.minute,
      };
    });

    // Sắp xếp các điểm theo thứ tự thời gian tăng dần dọc trục X
    baseCoords.sort((a, b) => a.x - b.x);

    let lPath = '';
    let aPath = '';
    if (baseCoords.length > 1) {
      lPath = `M ${baseCoords[0].x} ${baseCoords[0].y}`;
      for (let i = 1; i < baseCoords.length; i++) {
        const prev = baseCoords[i - 1];
        const curr = baseCoords[i];
        const cpX = (prev.x + curr.x) / 2;
        lPath += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
      }
      const lastX = baseCoords[baseCoords.length - 1].x;
      const firstX = baseCoords[0].x;
      aPath = `${lPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    } else if (baseCoords.length === 1) {
      lPath = `M ${padLeft} ${baseCoords[0].y} L ${padLeft + usableW} ${baseCoords[0].y}`;
      aPath = `${lPath} L ${padLeft + usableW} ${bottomY} L ${padLeft} ${bottomY} Z`;
    }

    const _y60 = padTop + (1 - (60 - minVal) / range) * usableH;
    const _y100 = padTop + (1 - (100 - minVal) / range) * usableH;

    return {
      coords: baseCoords,
      linePath: lPath,
      areaPath: aPath,
      y60: _y60,
      y100: _y100,
    };
  }, [safeChartData, hasData, isDayView, maxMinutes, usableW, usableH, bottomY, padLeft, padTop]);

  // Tìm DUY NHẤT 1 điểm gần nhất với thời gian đang chọn (scrubber) để làm mốc highlight
  const closestIndex = useMemo(() => {
    if (!coords || coords.length === 0) return -1;
    if (closestVital?.id) {
      const match = coords.findIndex((c) => c.id === closestVital.id);
      if (match !== -1) return match;
    }
    if (scrubberMinutes !== undefined) {
      let bestIdx = -1;
      let minDiff = 999999;
      for (let i = 0; i < coords.length; i++) {
        const ptMin = coords[i].minute;
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
    return coords.length - 1;
  }, [closestVital, coords, scrubberMinutes]);

  // Lọc nhãn trục X cho chế độ Tuần / Tháng (không phải Day view)
  const visibleWeekLabels = useMemo(() => {
    if (isDayView || !coords || coords.length === 0) return new Set<number>();
    const visible = new Set<number>();
    let lastX = -999;
    coords.forEach((pt, idx) => {
      if (idx === 0 || idx === coords.length - 1 || pt.x - lastX >= 48) {
        visible.add(idx);
        lastX = pt.x;
      }
    });
    return visible;
  }, [isDayView, coords]);

  return (
    <View
      style={[
        styles.chartCard,
        isDarkMode && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
      ]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - 32 - containerWidth) > 5) {
          setContainerWidth(w - 32);
        }
      }}
    >
      <View style={styles.chartCardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.chartCardTitle, isDarkMode && { color: colors.textPrimary }]}>
            {chartTitle}
          </Text>
          {chartSubtitle ? (
            <Text style={[styles.chartCardSubtitle, isDarkMode && { color: colors.textSecondary }]}>
              {chartSubtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.chartAvgBadge, isDarkMode && { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
          <Text style={[styles.chartAvgText, isDarkMode && { color: '#F87171' }]}>{chartAvg}</Text>
        </View>
      </View>

      {hasData ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barsScrollContainer}
        >
          <View>
            <Svg width={svgWidth} height={chartHeight}>
              <Defs>
                {/* Gradient màu đỏ chuẩn y tế cho nhịp tim */}
                <LinearGradient id="healthHeartRateGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#EF4444" stopOpacity={0.28} />
                  <Stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
                </LinearGradient>
              </Defs>

              {/* Đường tham chiếu ngưỡng bình thường 60 - 100 bpm */}
              {y100 >= padTop && y100 <= bottomY && (
                <Line
                  x1={padLeft}
                  y1={y100}
                  x2={svgWidth - padRight}
                  y2={y100}
                  stroke={isDarkMode ? '#334155' : '#E2E8F0'}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              )}
              {y60 >= padTop && y60 <= bottomY && (
                <Line
                  x1={padLeft}
                  y1={y60}
                  x2={svgWidth - padRight}
                  y2={y60}
                  stroke={isDarkMode ? '#334155' : '#E2E8F0'}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              )}

              {/* Lưới trục hoành hiển thị theo từng giờ */}
              {isDayView &&
                hourTicks.map((tick, idx) => (
                  <React.Fragment key={`tick_${idx}`}>
                    <Line
                      x1={tick.x}
                      y1={padTop}
                      x2={tick.x}
                      y2={bottomY}
                      stroke={isDarkMode ? '#1E293B' : '#F1F5F9'}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <SvgText
                      x={tick.x}
                      y={bottomY + 18}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={tick.isCurrent ? '700' : '500'}
                      fill={
                        tick.isCurrent
                          ? isDarkMode
                            ? '#F87171'
                            : '#DC2626'
                          : isDarkMode
                          ? '#64748B'
                          : '#94A3B8'
                      }
                    >
                      {tick.label}
                    </SvgText>
                  </React.Fragment>
                ))}

              {/* Nhãn ngày cho Tuần / Tháng */}
              {!isDayView &&
                coords.map((pt, idx) => {
                  if (!visibleWeekLabels.has(idx)) return null;
                  return (
                    <SvgText
                      key={`wlbl_${idx}`}
                      x={pt.x}
                      y={bottomY + 18}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight="500"
                      fill={isDarkMode ? '#64748B' : '#94A3B8'}
                    >
                      {pt.label}
                    </SvgText>
                  );
                })}

              {/* Vùng bóng mờ gradient màu đỏ dưới đường sóng */}
              <Path d={areaPath} fill="url(#healthHeartRateGrad)" />

              {/* Đường cong nhịp tim màu đỏ sắc nét */}
              <Path
                d={linePath}
                fill="none"
                stroke="#EF4444"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Các điểm đo trên đường sóng */}
              {coords.map((pt, idx) => {
                const isClosest = idx === closestIndex;

                return (
                  <React.Fragment key={`pt_${idx}`}>
                    {/* Chỉ vẽ đường gióng đứng cho DUY NHẤT điểm đang tua */}
                    {isClosest && (
                      <Line
                        x1={pt.x}
                        y1={padTop - 6}
                        x2={pt.x}
                        y2={bottomY}
                        stroke="#EF4444"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        opacity={0.65}
                      />
                    )}

                    {/* Chấm tròn biểu thị điểm đo */}
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isClosest ? 5.5 : 3.2}
                      fill={isClosest ? '#DC2626' : isDarkMode ? '#F87171' : '#EF4444'}
                      stroke="#FFFFFF"
                      strokeWidth={isClosest ? 2 : 1}
                    />

                    {/* Giá trị nhịp tim: CHỈ hiển thị trên điểm đang tua để tuyệt đối không va chạm chữ */}
                    {isClosest && (
                      <SvgText
                        x={pt.x}
                        y={Math.max(padTop - 6, pt.y - 10)}
                        textAnchor="middle"
                        fontSize={11.5}
                        fontWeight="800"
                        fill={isDarkMode ? '#FCA5A5' : '#DC2626'}
                      >
                        {pt.hr} bpm
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyChartBox}>
          <Ionicons
            name="stats-chart-outline"
            size={32}
            color={isDarkMode ? '#64748B' : '#94A3B8'}
            style={{ marginBottom: 6 }}
          />
          <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>
            Chưa có dữ liệu đo để vẽ biểu đồ
          </Text>
        </View>
      )}
    </View>
  );
});

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
    marginBottom: 10,
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
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chartAvgText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  barsScrollContainer: {
    paddingVertical: 4,
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

// ==============================================================================
// TỆP: HealthChartSection.tsx
// PHÂN HỆ: Biểu đồ Đường Sóng Dao động Nhịp tim theo Thời gian (HealthDetailScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Vẽ biểu đồ đường sóng (Line Chart) trực quan hóa biến thiên nhịp tim theo giờ/ngày.
//   - Tự động đánh dấu nổi bật (Highlight Pin 📍) điểm dữ liệu gần nhất với mốc thời gian
//     mà người dùng đang kéo trên Thanh tua dòng thời gian (Timeline Scrubber).
//   - Hiển thị màn hình Empty State khi ngày/tuần/tháng được chọn chưa có dữ liệu đo.
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Shadows } from '../../../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Cấu trúc một điểm dữ liệu trên biểu đồ nhịp tim
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

export const HealthChartSection: React.FC<HealthChartSectionProps> = React.memo(({
  chartTitle,
  chartSubtitle,
  chartAvg,
  chartData,
  closestVital,
  scrubberMinutes,
  isDarkMode,
  colors,
}) => {
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 64);

  const chartHeight = 150;
  const pointSpacing = 36;
  const safeChartData = useMemo(
    () =>
      (chartData || []).filter(
        (p) => p && typeof p.hr === 'number' && Number.isFinite(p.hr) && p.hr > 0
      ),
    [chartData]
  );
  const hasData = safeChartData.length > 0;
  const svgWidth = hasData
    ? Math.max(containerWidth, safeChartData.length * pointSpacing)
    : containerWidth;

  const padLeft = 24;
  const padRight = 24;
  const padTop = 32;
  const padBottom = 28;
  const usableW = Math.max(60, svgWidth - padLeft - padRight);
  const usableH = chartHeight - padTop - padBottom;
  const bottomY = chartHeight - padBottom;

  // Tối ưu hóa: Memoize việc tính toán đường cong SVG Bezier để không tính lại khi chỉ tua scrubber
  const { coords, linePath, areaPath, y60, y100 } = useMemo(() => {
    if (!hasData) {
      return { coords: [], linePath: '', areaPath: '', y60: 0, y100: 0 };
    }
    const hrs = safeChartData.map((p) => p.hr);
    const minVal = Math.max(30, Math.min(...hrs, 55) - 8);
    const maxVal = Math.min(180, Math.max(...hrs, 105) + 8);
    const range = Math.max(20, maxVal - minVal);

    const baseCoords = safeChartData.map((point, idx) => {
      const x = padLeft + (safeChartData.length > 1 ? (idx / (safeChartData.length - 1)) * usableW : usableW / 2);
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
  }, [safeChartData, hasData, usableW, usableH, bottomY]);

  // 1. Tìm DUY NHẤT 1 điểm gần nhất với mốc thời gian đang tua (active/closest)
  const closestIndex = useMemo(() => {
    if (!coords || coords.length === 0) return -1;
    // Khớp chính xác ID nếu có
    if (closestVital?.id) {
      const match = coords.findIndex((c) => c.id === closestVital.id);
      if (match !== -1) return match;
    }
    // Tìm điểm gần nhất với scrubberMinutes
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

  // 2. Lọc thông minh nhãn trục hoành (X-axis) để KHÔNG BAO GIỜ bị đè chữ
  const visibleXLabelIndices = useMemo(() => {
    if (!coords || coords.length === 0) return new Set<number>();
    const visible = new Set<number>();
    let lastX = -999;
    let lastLabel = '';
    const minGap = 56; // Tối thiểu 56px giữa 2 nhãn giờ

    coords.forEach((pt, idx) => {
      const isFirst = idx === 0;
      const isClosestPt = idx === closestIndex;
      const dist = pt.x - lastX;
      const labelChanged = pt.label !== lastLabel;

      if (isFirst || isClosestPt || (dist >= minGap && labelChanged)) {
        visible.add(idx);
        lastX = pt.x;
        lastLabel = pt.label;
      }
    });

    if (coords.length > 1) {
      const lastIdx = coords.length - 1;
      const lastPt = coords[lastIdx];
      if (lastPt.x - lastX >= 36) {
        visible.add(lastIdx);
      }
    }

    return visible;
  }, [coords, closestIndex]);

  return (
    <View
      style={[styles.chartCard, isDarkMode && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - 32 - containerWidth) > 5) {
          setContainerWidth(w - 32);
        }
      }}
    >
      <View style={styles.chartCardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.chartCardTitle, isDarkMode && { color: colors.textPrimary }]}>{chartTitle}</Text>
          {chartSubtitle ? (
            <Text style={[styles.chartCardSubtitle, isDarkMode && { color: colors.textSecondary }]}>{chartSubtitle}</Text>
          ) : null}
        </View>
        <View style={styles.chartAvgBadge}>
          <Text style={styles.chartAvgText}>{chartAvg}</Text>
        </View>
      </View>

      {hasData ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barsScrollContainer}
        >
          <View>
            <Svg width={svgWidth} height={chartHeight}>
              <Defs>
                <LinearGradient id="healthDetailGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#2563EB" stopOpacity={0.32} />
                  <Stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                </LinearGradient>
              </Defs>

              {/* Đường tham chiếu ngưỡng chuẩn 60 - 100 bpm */}
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

              {/* Vùng đổ màu gradient dưới đường cong */}
              <Path d={areaPath} fill="url(#healthDetailGrad)" />

              {/* Đường cong nhịp tim mềm mại */}
              <Path
                d={linePath}
                fill="none"
                stroke="#2563EB"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Các điểm đo và nhãn */}
              {coords.map((pt, idx) => {
                const isClosest = idx === closestIndex;
                const showXLabel = visibleXLabelIndices.has(idx) || isClosest;

                return (
                  <React.Fragment key={`pt_${idx}`}>
                    {/* Chỉ vẽ đường gióng đứng cho DUY NHẤT điểm đang tua */}
                    {isClosest && (
                      <Line
                        x1={pt.x}
                        y1={padTop - 6}
                        x2={pt.x}
                        y2={bottomY}
                        stroke="#2563EB"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        opacity={0.6}
                      />
                    )}

                    {/* Chấm tròn biểu thị điểm đo */}
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isClosest ? 5.5 : 3.2}
                      fill={isClosest ? '#2563EB' : isDarkMode ? '#38BDF8' : '#2563EB'}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />

                    {/* Giá trị nhịp tim: CHỈ hiển thị trên điểm đang tua (isClosest) để tránh chồng đè chữ */}
                    {isClosest && (
                      <SvgText
                        x={pt.x}
                        y={Math.max(padTop - 6, pt.y - 10)}
                        textAnchor="middle"
                        fontSize={11.5}
                        fontWeight="800"
                        fill={isDarkMode ? '#60A5FA' : '#1D4ED8'}
                      >
                        {pt.hr} bpm
                      </SvgText>
                    )}

                    {/* Nhãn mốc thời gian trục hoành: giãn cách tối thiểu 56px để chống va chạm */}
                    {showXLabel && (
                      <SvgText
                        x={pt.x}
                        y={bottomY + 18}
                        textAnchor="middle"
                        fontSize={9.5}
                        fontWeight={isClosest ? '800' : '500'}
                        fill={isClosest ? (isDarkMode ? '#60A5FA' : '#2563EB') : isDarkMode ? '#64748B' : '#94A3B8'}
                      >
                        {pt.label}
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
          <Ionicons name="stats-chart-outline" size={32} color={isDarkMode ? '#64748B' : '#94A3B8'} style={{ marginBottom: 6 }} />
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



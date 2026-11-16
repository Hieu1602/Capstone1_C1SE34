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
  const pointSpacing = 48;
  const hasData = Boolean(chartData && chartData.length > 0);
  const svgWidth = hasData ? Math.max(containerWidth, chartData.length * pointSpacing) : containerWidth;

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
    const hrs = chartData.map((p) => p.hr);
    const minVal = Math.max(30, Math.min(...hrs, 55) - 8);
    const maxVal = Math.min(180, Math.max(...hrs, 105) + 8);
    const range = Math.max(20, maxVal - minVal);

    const baseCoords = chartData.map((point, idx) => {
      const x = padLeft + (chartData.length > 1 ? (idx / (chartData.length - 1)) * usableW : usableW / 2);
      const normY = (point.hr - minVal) / range;
      const y = padTop + (1 - normY) * usableH;
      return {
        x,
        y,
        hr: point.hr,
        label: point.label,
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
  }, [chartData, hasData, usableW, usableH, bottomY]);

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

      {hasData ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barsScrollContainer}
        >
          <View
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setContainerWidth(w);
            }}
          >
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
                const isClosest = Boolean(
                  closestVital &&
                  scrubberMinutes !== undefined &&
                  (pt.id === closestVital.id ||
                    (pt.minute !== undefined && Math.abs(pt.minute - scrubberMinutes) < 45))
                );

                return (
                  <React.Fragment key={`pt_${idx}`}>
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

                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isClosest ? 5.5 : 3.5}
                      fill={isClosest ? '#2563EB' : isDarkMode ? '#38BDF8' : '#2563EB'}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />

                    {isClosest ? (
                      <SvgText
                        x={pt.x}
                        y={pt.y - 12}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight="800"
                        fill={isDarkMode ? '#60A5FA' : '#1D4ED8'}
                      >
                        📍 {pt.hr}
                      </SvgText>
                    ) : (
                    <SvgText
                      x={pt.x}
                      y={pt.y - 8}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight="600"
                      fill={isDarkMode ? '#94A3B8' : '#64748B'}
                    >
                      {pt.hr}
                    </SvgText>
                  )}

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



import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { LocalizedText as Text } from '../../../../i18n/LocalizedComponents';
import { HrPoint, MiniLineChartGeometry } from './healthTrendsHelpers';
import { healthTrendsStyles as styles } from './healthTrendsStyles';

interface HeartRateMiniCardProps {
  isDarkMode: boolean;
  colors: any;
  hasHR: boolean;
  avgHR: number | null;
  displayBars: HrPoint[];
  geometry: MiniLineChartGeometry;
  onPress: () => void;
  onChartWidthChange: (width: number) => void;
  chartWidth: number;
}

export function HeartRateMiniCard({
  isDarkMode,
  colors,
  hasHR,
  avgHR,
  displayBars,
  geometry,
  onPress,
  onChartWidthChange,
  chartWidth,
}: HeartRateMiniCardProps) {
  const {
    chartHeight,
    padLeft,
    padRight,
    lastPt,
    lineColor,
    refY,
    linePath,
    areaPath,
  } = geometry;

  return (
    <TouchableOpacity
      style={[styles.miniChartCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={onPress}
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

      {hasHR && displayBars.length > 0 ? (
        <View
          style={styles.miniBarChartArea}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) onChartWidthChange(w);
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
  );
}

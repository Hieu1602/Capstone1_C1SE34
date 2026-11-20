// ==============================================================================
// TỆP: HealthTrendsCard.tsx
// PHÂN HỆ: Thẻ "Xu hướng sức khỏe hôm nay" trên Trang chủ (HomeScreen)
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   - Hiển thị 2 biểu đồ mini trực quan: Nhịp tim 12h qua (Mini Line Chart) &
//     Độ bão hòa oxy trong máu SpO2 (Thước đo phân vùng 90% - 100%).
//   - Tự động kiểm tra dữ liệu thực tế từ cảm biến: nếu chưa có bản ghi từ Database
//     sẽ hiển thị trạng thái rỗng ("Chưa có dữ liệu" / "--"), không dùng dữ liệu giả.
// ==============================================================================

import React, { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';
import { LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import {
  checkIsLiveFresh,
  useHeartRateTrendHistory,
  buildMiniLineChartGeometry,
  getTrendStatusBadge,
} from './health/healthTrendsHelpers';
import { healthTrendsStyles as styles } from './health/healthTrendsStyles';
import { HeartRateMiniCard } from './health/HeartRateMiniCard';
import { ActivityMiniCard } from './health/ActivityMiniCard';
import { Spo2RulerCard } from './health/Spo2RulerCard';

interface HealthTrendsCardProps {
  navigation: any;
  isDarkMode: boolean;
  colors: any;
  currentVitals?: any;
  patient?: any;
  patientDevice?: any;
}

export function HealthTrendsCard({
  navigation,
  isDarkMode,
  colors,
  currentVitals,
  patientDevice,
}: HealthTrendsCardProps) {
  const isLiveFresh = checkIsLiveFresh(currentVitals);

  // Kiểm tra sự tồn tại của dữ liệu nhịp tim và SpO2 thực tế từ vòng đeo tay BLE
  // BẮT BUỘC: 1 đồng hồ chỉ kết nối với 1 cụ. Nếu cụ chưa gán đồng hồ -> không có dữ liệu nhịp tim & SpO2
  const hasHR = Boolean(
    patientDevice &&
      isLiveFresh &&
      currentVitals?.heart_rate !== null &&
      currentVitals?.heart_rate !== undefined
  );
  const hasSpO2 = Boolean(
    patientDevice &&
      isLiveFresh &&
      currentVitals?.spo2 !== null &&
      currentVitals?.spo2 !== undefined
  );
  const hasAnyData = hasHR || hasSpO2;

  const hrBars = useHeartRateTrendHistory(patientDevice, currentVitals, hasHR);
  const [chartWidth, setChartWidth] = useState(140);

  const hrValue = hasHR ? currentVitals.heart_rate : null;
  const displayBars = hrBars.length > 0 ? hrBars : hasHR ? [{ time: 'Hiện tại', val: hrValue }] : [];
  const avgHR =
    displayBars.length > 0
      ? Math.round(displayBars.reduce((s, c) => s + c.val, 0) / displayBars.length)
      : hrValue;

  const spo2Value = hasSpO2 ? currentVitals.spo2 : null;
  const spo2PinPercent = spo2Value !== null ? Math.min(96, Math.max(4, (spo2Value - 90) * 10)) : 0;

  const geometry = buildMiniLineChartGeometry(displayBars, chartWidth, avgHR);
  const statusBadge = getTrendStatusBadge(hasAnyData, geometry.lastPt.val, spo2Value, isDarkMode);

  return (
    <View style={styles.trendSectionContainer}>
      <View style={styles.trendSectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="stats-chart" size={17} color={Colors.primary} />
          <Text style={[styles.trendSectionTitle, isDarkMode && { color: colors.textPrimary }]}>
            Xu hướng sinh hiệu hôm nay
          </Text>
        </View>
        <View style={[styles.trendStandardBadge, { backgroundColor: statusBadge.bg }]}>
          <Ionicons name={statusBadge.icon} size={13} color={statusBadge.color} />
          <Text style={[styles.trendStandardBadgeText, { color: statusBadge.color }]}>
            {statusBadge.text}
          </Text>
        </View>
      </View>

      {/* Hàng 2 thẻ biểu đồ mini */}
      <View style={styles.miniChartsRow}>
        <HeartRateMiniCard
          isDarkMode={isDarkMode}
          colors={colors}
          hasHR={hasHR}
          avgHR={avgHR}
          displayBars={displayBars}
          geometry={geometry}
          chartWidth={chartWidth}
          onChartWidthChange={setChartWidth}
          onPress={() => navigation.navigate('HealthDetail', { metric: 'heartRate' })}
        />

        <ActivityMiniCard
          isDarkMode={isDarkMode}
          colors={colors}
          hasAnyData={hasAnyData}
          onPress={() => navigation.navigate('HealthDetail', { metric: 'activity' })}
        />
      </View>

      {/* Thẻ 3: Toàn chiều rộng bên dưới - Thước đo Oxy máu SpO2 */}
      <Spo2RulerCard
        isDarkMode={isDarkMode}
        colors={colors}
        hasSpO2={hasSpO2}
        spo2Value={spo2Value}
        spo2PinPercent={spo2PinPercent}
        onPress={() => navigation.navigate('HealthDetail', { metric: 'spo2' })}
      />
    </View>
  );
}

export default HealthTrendsCard;

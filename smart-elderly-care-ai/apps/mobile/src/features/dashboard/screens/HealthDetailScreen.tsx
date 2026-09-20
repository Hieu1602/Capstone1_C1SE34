// HealthDetailScreen.tsx
// Màn hình Chi tiết Tình trạng Sức khoẻ & Chỉ số Sinh hiệu người cao tuổi
// Hệ thống Smart Elderly Care AI – Tích hợp YOLOv8-Pose, YAMNet & BLE Band

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TimeRange = 'DAY' | 'WEEK' | 'MONTH';

export default function HealthDetailScreen({ navigation, route }: any) {
  const metric = (route?.params?.focusMetric ?? route?.params?.metric) as 'heartRate' | 'activity' | 'spo2' | undefined;
  const initialTab = route?.params?.initialTab as 'today' | 'week' | 'month' | undefined;
  const { currentVitals } = useVitalStore();
  const [selectedRange, setSelectedRange] = useState<TimeRange>(
    initialTab === 'week' ? 'WEEK' : initialTab === 'month' ? 'MONTH' : 'DAY'
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [highlightedMetric, setHighlightedMetric] = useState<string | null>(metric ?? null);
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    if (initialTab) {
      if (initialTab === 'today') setSelectedRange('DAY');
      else if (initialTab === 'week') setSelectedRange('WEEK');
      else if (initialTab === 'month') setSelectedRange('MONTH');
    }
    if (metric) {
      setHighlightedMetric(metric);
      const timer = setTimeout(() => {
        if (metric === 'heartRate') {
          scrollRef.current?.scrollTo({ y: 140, animated: true });
        } else if (metric === 'spo2') {
          scrollRef.current?.scrollTo({ y: 140, animated: true });
        } else if (metric === 'activity') {
          scrollRef.current?.scrollTo({ y: 220, animated: true });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [metric, initialTab]);

  const acousticStatus = currentVitals.acoustic_status ?? 'Bình thường';
  const battery = currentVitals.bracelet_battery ?? 88;
  const isFallDetected = currentVitals.fall_detected;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      Alert.alert('Đồng bộ thành công', 'Dữ liệu sức khoẻ từ Hub Orange Pi 5 và vòng đeo tay đã được làm mới.');
    }, 600);
  };

  // 1. Dữ liệu thay đổi tương ứng theo từng tab thời gian
  const getTabConfig = () => {
    switch (selectedRange) {
      case 'WEEK':
        return {
          bannerTitle: 'Xu hướng tuần ổn định',
          bannerSubtitle: 'Ghi nhận nhịp tim và oxy máu duy trì mức tốt, không có sự cố té ngã.',
          bannerIcon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
          bannerAlert: false,
          card1: {
            label: 'Nhịp tim TB',
            value: '76',
            unit: 'bpm',
            status: 'Chuẩn',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Dao động: 68 - 84 bpm',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'Nồng độ Oxy TB',
            value: '97',
            unit: '%',
            status: 'Tốt',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Mức thấp nhất: 96%',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Thân nhiệt TB',
            value: '36.7',
            unit: '°C',
            status: 'Bình thường',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Dao động: 36.5 - 37.0°C',
            icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          card4: {
            label: 'Sự cố té ngã',
            value: '0',
            unit: 'lần',
            status: 'An toàn tuyệt đối',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Không có cảnh báo ngã',
            icon: 'shield-checkmark' as keyof typeof Ionicons.glyphMap,
            iconColor: Colors.success,
            iconBg: '#DCFCE7',
          },
          chartTitle: 'Nhịp tim trung bình 7 ngày',
          chartSubtitle: 'Thống kê từ Thứ 2 đến Chủ Nhật',
          chartAvg: 'Trung bình: 76 bpm',
          chartData: [
            { label: 'T2', hr: 72 },
            { label: 'T3', hr: 75 },
            { label: 'T4', hr: 78 },
            { label: 'T5', hr: 74 },
            { label: 'T6', hr: 80 },
            { label: 'T7', hr: 76 },
            { label: 'CN', hr: 75 },
          ],
          aiAdvice:
            '• Tuần qua người cao tuổi có chất lượng giấc ngủ và nhịp tim phục hồi rất đều.\n• Không ghi nhận bất kỳ dấu hiệu mất thăng bằng hay trượt ngã nào.\n• Khuyến khích duy trì bài tập dưỡng sinh buổi sáng 15-20 phút.',
        };

      case 'MONTH':
        return {
          bannerTitle: 'Báo cáo 30 ngày',
          bannerSubtitle: 'Chỉ số sức khoẻ đều đặn, không có biến động bất thường.',
          bannerIcon: 'analytics' as keyof typeof Ionicons.glyphMap,
          bannerAlert: false,
          card1: {
            label: 'Dao động nhịp tim',
            value: '68 - 86',
            unit: 'bpm',
            status: 'Chuẩn',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Mức an toàn tối ưu',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'SpO₂ trung bình',
            value: '98',
            unit: '%',
            status: 'Tốt',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Chỉ số ổn định cao',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Nhiệt độ ổn định',
            value: '36.6',
            unit: '°C',
            status: 'Bình thường',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Mức nhiệt tiêu chuẩn',
            icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          card4: {
            label: 'Tần suất cảnh báo',
            value: '0',
            unit: 'sự cố',
            status: 'Tối ưu',
            statusColor: '#B45309',
            statusBg: '#FEF3C7',
            range: 'Tối ưu 100%',
            icon: 'sparkles' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          chartTitle: 'Dao động nhịp tim theo tuần (Tháng này)',
          chartSubtitle: 'Tổng hợp 4 tuần gần nhất',
          chartAvg: 'Trung bình: 75.5 bpm',
          chartData: [
            { label: 'Tuần 1', hr: 74 },
            { label: 'Tuần 2', hr: 76 },
            { label: 'Tuần 3', hr: 75 },
            { label: 'Tuần 4', hr: 77 },
          ],
          aiAdvice:
            '• Chỉ số sức khoẻ 30 ngày qua cho thấy thể trạng của cụ rất ổn định.\n• Các cảm biến Edge Hub và vòng tay duy trì hoạt động không gián đoạn.\n• Đề xuất hẹn lịch tái khám tim mạch định kỳ vào đầu tháng tới.',
        };

      case 'DAY':
      default:
        return {
          bannerTitle: isFallDetected ? 'Cảnh báo nguy cơ té ngã!' : 'Sức khoẻ ổn định',
          bannerSubtitle: isFallDetected
            ? 'Hệ thống AI vừa nhận thấy chuyển động ngã đột ngột trong phòng.'
            : 'Tất cả chỉ số sức khoẻ và âm thanh môi trường đều trong ngưỡng an toàn.',
          bannerIcon: (isFallDetected ? 'warning' : 'shield-checkmark') as keyof typeof Ionicons.glyphMap,
          bannerAlert: isFallDetected,
          card1: {
            label: 'Nhịp tim',
            value: '74',
            unit: 'bpm',
            status: 'Chuẩn',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Chuẩn: 60 - 100 bpm',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'Nồng độ Oxy (SpO₂)',
            value: '98',
            unit: '%',
            status: 'Tốt',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Chuẩn: ≥ 95%',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Nhiệt độ cơ thể',
            value: '36.8',
            unit: '°C',
            status: 'Bình thường',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Chuẩn: 36.0 - 37.2°C',
            icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          card4: {
            label: 'Trạng thái vận động',
            value: isFallDetected ? 'Nằm sàn' : 'Sinh hoạt',
            unit: '',
            status: isFallDetected ? 'Cảnh báo' : 'An toàn',
            statusColor: isFallDetected ? Colors.danger : '#15803D',
            statusBg: isFallDetected ? '#FEE2E2' : '#DCFCE7',
            range: 'Sinh hoạt & Đi lại',
            icon: 'body' as keyof typeof Ionicons.glyphMap,
            iconColor: '#9333EA',
            iconBg: '#F3E8FF',
          },
          chartTitle: 'Dao động nhịp tim',
          chartSubtitle: 'Ghi nhận từ vòng tay & Hub AI',
          chartAvg: 'Trung bình: 75 bpm',
          chartData: [
            { label: '06:00', hr: 68 },
            { label: '08:00', hr: 74 },
            { label: '10:00', hr: 82 },
            { label: '12:00', hr: 71 },
            { label: '14:00', hr: 74 },
            { label: '16:00', hr: 79 },
            { label: '18:00', hr: 74 },
          ],
          aiAdvice:
            '• Nhịp tim và nồng độ SpO₂ của cụ duy trì rất đều đặn trong ngày.\n• Nhiệt độ phòng đang ở mức lý tưởng (36.8°C).\n• Nhắc cụ uống thêm 1 cốc nước ấm vào buổi chiều và vận động nhẹ nhàng quanh phòng khách.',
        };
    }
  };

  const currentTabConfig = getTabConfig();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header có nút Back */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Tình trạng sức khoẻ</Text>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Banner Tình trạng Tổng quan */}
        <View
          style={[
            styles.overallCard,
            currentTabConfig.bannerAlert ? styles.overallCardAlert : styles.overallCardNormal,
          ]}
        >
          <View
            style={[
              styles.overallIconCircle,
              { backgroundColor: currentTabConfig.bannerAlert ? '#FEE2E2' : '#E8FDF3' },
            ]}
          >
            <Ionicons
              name={currentTabConfig.bannerIcon}
              size={28}
              color={currentTabConfig.bannerAlert ? Colors.danger : Colors.success}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.overallTitle,
                { color: currentTabConfig.bannerAlert ? Colors.danger : Colors.success },
              ]}
            >
              {currentTabConfig.bannerTitle}
            </Text>
            <Text style={styles.overallSubtitle}>
              {currentTabConfig.bannerSubtitle}
            </Text>
          </View>
        </View>

        {/* 3. Bộ lọc thời gian (Hôm nay / 7 ngày qua / 30 ngày) */}
        <View style={styles.rangeSelector}>
          {(['DAY', 'WEEK', 'MONTH'] as const).map((range) => {
            const isActive = selectedRange === range;
            const labels: Record<TimeRange, string> = {
              DAY: 'Hôm nay',
              WEEK: '7 ngày qua',
              MONTH: '30 ngày',
            };
            return (
              <TouchableOpacity
                key={range}
                style={[styles.rangePill, isActive && styles.rangePillActive]}
                onPress={() => setSelectedRange(range)}
                activeOpacity={0.8}
              >
                <Text style={[styles.rangePillText, isActive && styles.rangePillTextActive]}>
                  {labels[range]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. Lưới 4 Thẻ Chỉ Số Sức Khoẻ / Thống kê */}
        <View style={styles.vitalsGrid}>
          {/* Thẻ 1: Nhịp tim */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              highlightedMetric === 'heartRate' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'heartRate' ? null : 'heartRate')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card1.iconBg }]}>
                <Ionicons
                  name={currentTabConfig.card1.icon}
                  size={20}
                  color={currentTabConfig.card1.iconColor}
                />
              </View>
              <View
                style={[
                  styles.vitalStatusTag,
                  { backgroundColor: currentTabConfig.card1.statusBg },
                ]}
              >
                <Text
                  style={[
                    styles.vitalStatusText,
                    { color: currentTabConfig.card1.statusColor },
                  ]}
                >
                  {currentTabConfig.card1.status}
                </Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>{currentTabConfig.card1.label}</Text>
            <View style={styles.vitalValRow}>
              <Text style={[styles.vitalValNumber, currentTabConfig.card1.value.length > 4 && { fontSize: 20 }]}>
                {currentTabConfig.card1.value}
              </Text>
              {Boolean(currentTabConfig.card1.unit) && (
                <Text style={styles.vitalValUnit}>{currentTabConfig.card1.unit}</Text>
              )}
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card1.range}</Text>
          </TouchableOpacity>

          {/* Thẻ 2: SpO2 */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              highlightedMetric === 'spo2' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'spo2' ? null : 'spo2')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card2.iconBg }]}>
                <Ionicons
                  name={currentTabConfig.card2.icon}
                  size={20}
                  color={currentTabConfig.card2.iconColor}
                />
              </View>
              <View
                style={[
                  styles.vitalStatusTag,
                  { backgroundColor: currentTabConfig.card2.statusBg },
                ]}
              >
                <Text
                  style={[
                    styles.vitalStatusText,
                    { color: currentTabConfig.card2.statusColor },
                  ]}
                >
                  {currentTabConfig.card2.status}
                </Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>{currentTabConfig.card2.label}</Text>
            <View style={styles.vitalValRow}>
              <Text style={styles.vitalValNumber}>{currentTabConfig.card2.value}</Text>
              {Boolean(currentTabConfig.card2.unit) && (
                <Text style={styles.vitalValUnit}>{currentTabConfig.card2.unit}</Text>
              )}
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card2.range}</Text>
          </TouchableOpacity>

          {/* Thẻ 3: Nhiệt độ cơ thể */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              highlightedMetric === 'temp' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'temp' ? null : 'temp')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card3.iconBg }]}>
                <Ionicons
                  name={currentTabConfig.card3.icon}
                  size={20}
                  color={currentTabConfig.card3.iconColor}
                />
              </View>
              <View
                style={[
                  styles.vitalStatusTag,
                  { backgroundColor: currentTabConfig.card3.statusBg },
                ]}
              >
                <Text
                  style={[
                    styles.vitalStatusText,
                    { color: currentTabConfig.card3.statusColor },
                  ]}
                >
                  {currentTabConfig.card3.status}
                </Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>{currentTabConfig.card3.label}</Text>
            <View style={styles.vitalValRow}>
              <Text style={styles.vitalValNumber}>{currentTabConfig.card3.value}</Text>
              {Boolean(currentTabConfig.card3.unit) && (
                <Text style={styles.vitalValUnit}>{currentTabConfig.card3.unit}</Text>
              )}
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card3.range}</Text>
          </TouchableOpacity>

          {/* Thẻ 4: Trạng thái vận động */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              highlightedMetric === 'activity' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'activity' ? null : 'activity')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card4.iconBg }]}>
                <Ionicons
                  name={currentTabConfig.card4.icon}
                  size={20}
                  color={currentTabConfig.card4.iconColor}
                />
              </View>
              <View
                style={[
                  styles.vitalStatusTag,
                  { backgroundColor: currentTabConfig.card4.statusBg },
                ]}
              >
                <Text
                  style={[
                    styles.vitalStatusText,
                    { color: currentTabConfig.card4.statusColor },
                  ]}
                >
                  {currentTabConfig.card4.status}
                </Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>{currentTabConfig.card4.label}</Text>
            <View style={styles.vitalValRow}>
              <Text
                style={[
                  styles.vitalValNumber,
                  currentTabConfig.card4.value.length > 3 && { fontSize: 20 },
                ]}
              >
                {currentTabConfig.card4.value}
              </Text>
              {Boolean(currentTabConfig.card4.unit) && (
                <Text style={styles.vitalValUnit}>{currentTabConfig.card4.unit}</Text>
              )}
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card4.range}</Text>
          </TouchableOpacity>
        </View>

        {/* 5. Biểu đồ Dao động Nhịp tim */}
        <View style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.chartCardTitle}>{currentTabConfig.chartTitle}</Text>
              <Text style={styles.chartCardSubtitle}>{currentTabConfig.chartSubtitle}</Text>
            </View>
            <View style={styles.chartAvgBadge}>
              <Text style={styles.chartAvgText}>{currentTabConfig.chartAvg}</Text>
            </View>
          </View>

          {/* Visual Bar Chart */}
          <View style={styles.barsContainer}>
            {currentTabConfig.chartData.map((point, idx) => {
              const barHeight = Math.max(28, ((point.hr - 50) / 45) * 90);
              const isCurrent = idx === currentTabConfig.chartData.length - 1;
              return (
                <View key={point.label} style={styles.barCol}>
                  <Text style={styles.barValText}>{point.hr}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barHeight,
                          backgroundColor: isCurrent ? Colors.primary : '#38BDF8',
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barTimeText,
                      isCurrent && styles.barTimeTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {point.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 6. Trạng thái phần cứng & Âm thanh môi trường */}
        <View style={styles.statusSectionCard}>
          <Text style={styles.sectionHeading}>Trạng thái cảm biến & Môi trường</Text>

          <View style={styles.statusRowItem}>
            <View style={styles.statusIconBox}>
              <Ionicons name="watch-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusItemTitle}>Vòng tay thông minh BLE</Text>
              <Text style={styles.statusItemSub}>Pin: {battery}% • Kết nối liên tục</Text>
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Đang đo</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statusRowItem}>
            <View style={[styles.statusIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="mic-outline" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusItemTitle}>Nhận diện âm thanh YAMNet</Text>
              <Text style={styles.statusItemSub}>Môi trường: {acousticStatus}</Text>
            </View>
            <View style={styles.safeBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.safeText}>An toàn</Text>
            </View>
          </View>
        </View>

        {/* 7. Lời khuyên & Đánh giá của Trợ lý AI Bác Sĩ */}
        <View style={styles.aiAdviceCard}>
          <View style={styles.aiAdviceHeader}>
            <Ionicons name="sparkles" size={18} color="#D97706" />
            <Text style={styles.aiAdviceTitle}>Lời khuyên Bác sĩ AI</Text>
          </View>
          <Text style={styles.aiAdviceBody}>
            {currentTabConfig.aiAdvice}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  overallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    ...Shadows.soft,
  },
  overallCardNormal: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  overallCardAlert: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  overallIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  overallTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  overallSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  rangePillActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.soft,
  },
  rangePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  rangePillTextActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  vitalBox: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    ...Shadows.soft,
  },
  vitalBoxHighlighted: {
    borderColor: '#FF6B00',
    backgroundColor: '#FFFBF5',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  vitalBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  vitalIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vitalStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vitalBoxLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  vitalValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  vitalValNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginRight: 4,
  },
  vitalValUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  vitalNormalRange: {
    fontSize: 11,
    color: '#94A3B8',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Shadows.soft,
  },
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chartCardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chartAvgBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chartAvgText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barValText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  barTrack: {
    width: 14,
    height: 95,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barTimeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '500',
  },
  barTimeTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  statusSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Shadows.soft,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  statusRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusItemSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8FDF3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  safeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  aiAdviceCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  aiAdviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiAdviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
  },
  aiAdviceBody: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 20,
  },
});

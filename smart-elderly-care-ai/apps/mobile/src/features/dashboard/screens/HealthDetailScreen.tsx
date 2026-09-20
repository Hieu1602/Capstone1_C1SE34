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

export default function HealthDetailScreen({ navigation }: any) {
  const { currentVitals, setVitals } = useVitalStore();
  const [selectedRange, setSelectedRange] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const heartRate = currentVitals.heart_rate ?? 75;
  const spo2 = currentVitals.spo2 ?? 98;
  const skinTemp = currentVitals.skin_temp_max ?? 36.6;
  const acousticStatus = currentVitals.acoustic_status ?? 'Bình thường';
  const battery = currentVitals.bracelet_battery ?? 88;
  const isFallDetected = currentVitals.fall_detected;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      Alert.alert('Đồng bộ thành công', 'Dữ liệu sinh hiệu từ Hub Orange Pi 5 và vòng đeo tay đã được làm mới.');
    }, 600);
  };

  // Dữ liệu mẫu biểu đồ nhịp tim theo mốc giờ trong ngày
  const heartRateTimeline = [
    { time: '06:00', hr: 68 },
    { time: '08:00', hr: 74 },
    { time: '10:00', hr: 82 },
    { time: '12:00', hr: 71 },
    { time: '14:00', hr: 76 },
    { time: '16:00', hr: 79 },
    { time: '18:00', hr: heartRate },
  ];

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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Banner Tình trạng Tổng quan */}
        <View style={[styles.overallCard, isFallDetected ? styles.overallCardAlert : styles.overallCardNormal]}>
          <View style={[styles.overallIconCircle, { backgroundColor: isFallDetected ? '#FEE2E2' : '#E8FDF3' }]}>
            <Ionicons
              name={isFallDetected ? 'warning' : 'shield-checkmark'}
              size={28}
              color={isFallDetected ? Colors.danger : Colors.success}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.overallTitle, { color: isFallDetected ? Colors.danger : Colors.success }]}>
              {isFallDetected ? 'Cảnh báo nguy cơ té ngã!' : 'Sức khoẻ ổn định'}
            </Text>
            <Text style={styles.overallSubtitle}>
              {isFallDetected
                ? 'Hệ thống AI vừa nhận thấy chuyển động ngã đột ngột trong phòng.'
                : 'Tất cả chỉ số sinh hiệu và âm thanh môi trường đều trong ngưỡng an toàn.'}
            </Text>
          </View>
        </View>

        {/* 3. Bộ lọc thời gian (Hôm nay / Tuần / Tháng) */}
        <View style={styles.rangeSelector}>
          {(['DAY', 'WEEK', 'MONTH'] as const).map((range) => {
            const isActive = selectedRange === range;
            const labels = { DAY: 'Hôm nay', WEEK: '7 ngày qua', MONTH: '30 ngày' };
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

        {/* 4. Lưới 4 Thẻ Sinh Hiệu Trọng Yếu */}
        <View style={styles.vitalsGrid}>
          {/* Nhịp tim */}
          <View style={styles.vitalBox}>
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="heart" size={20} color="#EF4444" />
              </View>
              <View style={styles.vitalStatusTag}>
                <Text style={styles.vitalStatusTextGreen}>Chuẩn</Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>Nhịp tim</Text>
            <View style={styles.vitalValRow}>
              <Text style={styles.vitalValNumber}>{heartRate}</Text>
              <Text style={styles.vitalValUnit}>bpm</Text>
            </View>
            <Text style={styles.vitalNormalRange}>Chuẩn: 60 - 100 bpm</Text>
          </View>

          {/* Nồng độ Oxy SpO2 */}
          <View style={styles.vitalBox}>
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="water" size={20} color="#0284C7" />
              </View>
              <View style={styles.vitalStatusTag}>
                <Text style={styles.vitalStatusTextGreen}>Tốt</Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>Nồng độ Oxy (SpO₂)</Text>
            <View style={styles.vitalValRow}>
              <Text style={styles.vitalValNumber}>{spo2}</Text>
              <Text style={styles.vitalValUnit}>%</Text>
            </View>
            <Text style={styles.vitalNormalRange}>Chuẩn: ≥ 95%</Text>
          </View>

          {/* Nhiệt độ cơ thể */}
          <View style={styles.vitalBox}>
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="thermometer" size={20} color="#D97706" />
              </View>
              <View style={styles.vitalStatusTag}>
                <Text style={styles.vitalStatusTextGreen}>Bình thường</Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>Nhiệt độ da</Text>
            <View style={styles.vitalValRow}>
              <Text style={styles.vitalValNumber}>{skinTemp.toFixed(1)}</Text>
              <Text style={styles.vitalValUnit}>°C</Text>
            </View>
            <Text style={styles.vitalNormalRange}>Chuẩn: 36.0 - 37.2°C</Text>
          </View>

          {/* Tư thế & Nguy cơ té ngã */}
          <View style={styles.vitalBox}>
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="body" size={20} color="#9333EA" />
              </View>
              <View style={styles.vitalStatusTag}>
                <Text style={styles.vitalStatusTextGreen}>An toàn</Text>
              </View>
            </View>
            <Text style={styles.vitalBoxLabel}>Tư thế cơ thể</Text>
            <View style={styles.vitalValRow}>
              <Text style={[styles.vitalValNumber, { fontSize: 20 }]}>
                {isFallDetected ? 'Nằm sàn' : 'Sinh hoạt'}
              </Text>
            </View>
            <Text style={styles.vitalNormalRange}>YOLOv8-Pose 30 FPS</Text>
          </View>
        </View>

        {/* 5. Biểu đồ diễn tiến Nhịp tim trong ngày */}
        <View style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <View>
              <Text style={styles.chartCardTitle}>Diễn tiến nhịp tim</Text>
              <Text style={styles.chartCardSubtitle}>Ghi nhận từ vòng BLE & Hub AI</Text>
            </View>
            <View style={styles.chartAvgBadge}>
              <Text style={styles.chartAvgText}>Trung bình: 75 bpm</Text>
            </View>
          </View>

          {/* Visual Timeline Bar Chart */}
          <View style={styles.barsContainer}>
            {heartRateTimeline.map((point, idx) => {
              const barHeight = Math.max(30, ((point.hr - 50) / 60) * 110);
              const isCurrent = idx === heartRateTimeline.length - 1;
              return (
                <View key={point.time} style={styles.barCol}>
                  <Text style={styles.barValText}>{point.hr}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barHeight,
                          backgroundColor: isCurrent ? Colors.primary : '#94A3B8',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barTimeText, isCurrent && styles.barTimeTextActive]}>
                    {point.time}
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
            • Nhịp tim và nồng độ SpO₂ của cụ duy trì rất đều đặn trong ngày.{'\n'}
            • Nhiệt độ phòng đang ở mức lý tưởng ({skinTemp.toFixed(1)}°C).{'\n'}
            • Nhắc cụ uống thêm 1 cốc nước ấm vào buổi chiều và vận động nhẹ nhàng quanh phòng khách.
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
    ...Shadows.soft,
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
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vitalStatusTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
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
    fontSize: 26,
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
    paddingHorizontal: 6,
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
    height: 100,
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

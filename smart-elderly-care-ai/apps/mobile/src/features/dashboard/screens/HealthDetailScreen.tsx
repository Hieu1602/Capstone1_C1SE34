/**
 * HealthDetailScreen.tsx
 * Màn hình Chi tiết Tình trạng Sức khỏe & Chỉ số Sinh hiệu người cao tuổi
 * Hệ thống Smart Elderly Care AI – Tích hợp Lọc dữ liệu theo ngày & Tua dòng thời gian (Interactive Timeline)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTheme } from '../../../store/useThemeStore';
import { vitalsApi, patientApi } from '../../../services/api';

// Subcomponents đã được module hoá
import { HealthTimelineScrubber } from '../components/HealthTimelineScrubber';
import { HealthVitalsGrid } from '../components/HealthVitalsGrid';
import { HealthChartSection } from '../components/HealthChartSection';
import { HealthDatePickerModal } from '../components/HealthDatePickerModal';
import { HealthOverallBanner } from '../components/health/HealthOverallBanner';
import { HealthDateFilterBar } from '../components/health/HealthDateFilterBar';
import { HealthSensorStatusCard } from '../components/health/HealthSensorStatusCard';
import { HealthAiAdviceCard } from '../components/health/HealthAiAdviceCard';
import { HealthMedicalRecordLink } from '../components/health/HealthMedicalRecordLink';
import {
  TimeRange,
  formatDateYMD,
  formatDisplayDateVN,
  getTodayStr,
  getYesterdayStr,
  getDaysAgoStr,
  computeHealthTabConfig,
} from '../components/health/useHealthTabConfig';

export default function HealthDetailScreen({ navigation, route }: any) {
  const { isDarkMode, colors } = useTheme();
  const metric = (route?.params?.focusMetric ?? route?.params?.metric) as 'heartRate' | 'activity' | 'spo2' | undefined;
  const initialTab = route?.params?.initialTab as 'today' | 'week' | 'month' | undefined;
  const { currentVitals, fetchVitals } = useVitalStore();
  const { permissions, userRole, role } = useAuthStore();
  const isOwnerOrAdmin = userRole === 'admin' || role === 'admin' || permissions?.is_owner === true || permissions?.role_in_house === 'OWNER';
  const canViewHealth = isOwnerOrAdmin || Boolean(permissions?.can_view_health);

  useEffect(() => {
    if (!canViewHealth) {
      Alert.alert('Không có quyền truy cập', 'Chủ hộ đã tắt quyền xem chỉ số sức khỏe đối với tài khoản này.');
      navigation.goBack();
    }
  }, [canViewHealth, navigation]);

  const [selectedRange, setSelectedRange] = useState<TimeRange>(
    initialTab === 'week' ? 'WEEK' : initialTab === 'month' ? 'MONTH' : 'DAY'
  );
  const [highlightedMetric, setHighlightedMetric] = useState<string | null>(metric ?? null);
  const scrollRef = useRef<any>(null);

  // 1. Quản lý Lọc dữ liệu theo ngày (Date Filter)
  const dateOptions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const twoDaysAgo = new Date(Date.now() - 86400000 * 2);
    const threeDaysAgo = new Date(Date.now() - 86400000 * 3);

    return [
      { label: 'Hôm nay', sub: `${today.getDate()}/${today.getMonth() + 1}`, value: formatDateYMD(today) },
      { label: 'Hôm qua', sub: `${yesterday.getDate()}/${yesterday.getMonth() + 1}`, value: formatDateYMD(yesterday) },
      { label: '2 ngày trước', sub: `${twoDaysAgo.getDate()}/${twoDaysAgo.getMonth() + 1}`, value: formatDateYMD(twoDaysAgo) },
      { label: '3 ngày trước', sub: `${threeDaysAgo.getDate()}/${threeDaysAgo.getMonth() + 1}`, value: formatDateYMD(threeDaysAgo) },
    ];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateYMD(new Date()));
  const [dayVitals, setDayVitals] = useState<any[]>([]);
  const [rangeVitals, setRangeVitals] = useState<any[]>([]);
  const [isLoadingVitals, setIsLoadingVitals] = useState(false);
  const [isCalendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarInputDraft, setCalendarInputDraft] = useState(selectedDate);

  const isCustomDate = useMemo(() => {
    return !dateOptions.some((opt) => opt.value === selectedDate);
  }, [dateOptions, selectedDate]);

  // 2. Quản lý Tua dòng thời gian (Interactive Timeline Scrubber)
  const [scrubberMinutes, setScrubberMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Tải dữ liệu từ Backend khi chọn ngày
  const loadDateVitals = async (dateStr: string) => {
    setIsLoadingVitals(true);
    try {
      const res = await patientApi.getVitals(1, dateStr);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setDayVitals(res.data);
        const first = res.data[0];
        const rawDate = first?.recorded_at || first?.time || first?.created_at;
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            setScrubberMinutes(d.getHours() * 60 + d.getMinutes());
          }
        }
      } else {
        setDayVitals([]);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu sinh hiệu qua patientApi, thử fallback vitalsApi:', e);
      try {
        const fallbackRes = await vitalsApi.getHistory('BLE_BAND_001', 100, dateStr);
        if (fallbackRes.data && Array.isArray(fallbackRes.data)) {
          setDayVitals(fallbackRes.data);
        } else {
          setDayVitals([]);
        }
      } catch {
        setDayVitals([]);
      }
    } finally {
      setIsLoadingVitals(false);
    }
  };

  // Tải dữ liệu lịch sử cho Tuần / Tháng từ Backend
  const loadRangeVitals = async (limit: number) => {
    setIsLoadingVitals(true);
    try {
      const res = await vitalsApi.getHistory('BLE_BAND_001', limit);
      if (res.data && Array.isArray(res.data)) {
        setRangeVitals(res.data);
      } else {
        setRangeVitals([]);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu lịch sử tuần/tháng:', e);
      setRangeVitals([]);
    } finally {
      setIsLoadingVitals(false);
    }
  };

  useEffect(() => {
    fetchVitals();
  }, []);

  useEffect(() => {
    if (selectedRange === 'DAY') {
      loadDateVitals(selectedDate);
    } else {
      loadRangeVitals(selectedRange === 'WEEK' ? 50 : 100);
    }
  }, [selectedDate, selectedRange]);

  useEffect(() => {
    if (initialTab) {
      if (initialTab === 'today') setSelectedRange('DAY');
      else if (initialTab === 'week') setSelectedRange('WEEK');
      else if (initialTab === 'month') setSelectedRange('MONTH');
    }
    if (metric) {
      setHighlightedMetric(metric);
      const timer = setTimeout(() => {
        if (metric === 'heartRate' || metric === 'spo2') {
          scrollRef.current?.scrollTo({ y: 140, animated: true });
        } else if (metric === 'activity') {
          scrollRef.current?.scrollTo({ y: 220, animated: true });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [metric, initialTab]);

  const acousticStatus = currentVitals.acoustic_status ?? 'Bình thường';
  const batteryDisplay =
    currentVitals.bracelet_battery !== null && currentVitals.bracelet_battery !== undefined
      ? `${currentVitals.bracelet_battery}%`
      : 'Đang kết nối';
  const isFallDetected = Boolean(currentVitals.fall_detected);

  const handleRefresh = async () => {
    await fetchVitals();
    if (selectedRange === 'DAY') {
      await loadDateVitals(selectedDate);
    } else {
      await loadRangeVitals(selectedRange === 'WEEK' ? 50 : 100);
    }
    Alert.alert('Đồng bộ thành công', 'Dữ liệu sức khỏe từ Hub và vòng đeo tay đã được làm mới.');
  };

  // Tìm mốc đo gần nhất với giờ tua
  const closestVital = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return null;
    let best = dayVitals[0];
    let minDiff = 999999;
    for (const v of dayVitals) {
      const rawDate = v.recorded_at || v.time || v.created_at;
      const d = rawDate ? new Date(rawDate) : null;
      if (!d || isNaN(d.getTime())) continue;
      const vMinutes = d.getHours() * 60 + d.getMinutes();
      const diff = Math.abs(vMinutes - scrubberMinutes);
      if (diff < minDiff) {
        minDiff = diff;
        best = v;
      }
    }
    return best;
  }, [dayVitals, scrubberMinutes]);

  // Dữ liệu biểu đồ động theo ngày được chọn
  const chartDataForDay = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return [];
    return dayVitals.map((v) => {
      const rawDate = v.recorded_at || v.time || v.created_at;
      const d = rawDate ? new Date(rawDate) : null;
      const isValid = d && !isNaN(d.getTime());
      const label = isValid ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '--:--';
      return {
        id: v.id,
        label,
        hr: v.heart_rate,
        spo2: v.spo2,
        temp: v.body_temp ?? v.skin_temp_max,
        activity: v.activity || v.activity_state || 'Sinh hoạt',
        minute: isValid ? d.getHours() * 60 + d.getMinutes() : 0,
      };
    });
  }, [dayVitals]);

  // Nhịp tim trung bình trong ngày thực tế
  const dailyAvgHR = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return '--';
    const valid = dayVitals.filter((v) => typeof v.heart_rate === 'number');
    if (valid.length === 0) return '--';
    const sum = valid.reduce((acc, cur) => acc + cur.heart_rate, 0);
    return `${Math.round(sum / valid.length)} bpm`;
  }, [dayVitals]);

  // Dữ liệu biểu đồ và tính toán trung bình cho Tuần / Tháng
  const weekData = useMemo(() => {
    const list = rangeVitals && Array.isArray(rangeVitals) && rangeVitals.length > 0 ? rangeVitals : [];
    const validHR = list.filter((v) => typeof v.heart_rate === 'number');
    const validSpO2 = list.filter((v) => typeof v.spo2 === 'number');
    const validTemp = list.filter((v) => typeof (v.body_temp ?? v.skin_temp_max) === 'number');

    const avgHR = validHR.length > 0 ? (validHR.reduce((a, b) => a + b.heart_rate, 0) / validHR.length).toFixed(1) : '--';
    const avgSpO2 = validSpO2.length > 0 ? Math.round(validSpO2.reduce((a, b) => a + b.spo2, 0) / validSpO2.length).toString() : '--';
    const avgTemp = validTemp.length > 0 ? (validTemp.reduce((a, b) => a + (b.body_temp ?? b.skin_temp_max), 0) / validTemp.length).toFixed(1) : '--';

    const chart = list.length === 0 ? [] : list.slice(0, 7).reverse().map((v) => {
      const rawDate = v.recorded_at || v.time || v.created_at;
      const d = rawDate ? new Date(rawDate) : new Date();
      return {
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        hr: v.heart_rate ?? 0,
      };
    });

    return { avgHR, avgSpO2, avgTemp, chart };
  }, [rangeVitals]);

  // Cấu hình tab theo mốc thời gian được chọn
  const currentTabConfig = useMemo(() => {
    return computeHealthTabConfig({
      selectedRange,
      weekData,
      isFallDetected,
      dayVitals,
      closestVital,
      selectedDate,
      scrubberMinutes,
      dailyAvgHR,
      chartDataForDay,
    });
  }, [
    selectedRange,
    weekData,
    isFallDetected,
    dayVitals,
    closestVital,
    selectedDate,
    scrubberMinutes,
    dailyAvgHR,
    chartDataForDay,
  ]);

  const hasData = dayVitals && dayVitals.length > 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header có nút Back, Title & Nút Refresh */}
      <View style={[styles.headerBar, isDarkMode && { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={isDarkMode ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chỉ số sinh tồn & Bệnh án</Text>

        <TouchableOpacity
          style={[styles.refreshBtn, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Banner Tình trạng Tổng quan */}
        <HealthOverallBanner
          bannerAlert={currentTabConfig.bannerAlert}
          bannerIcon={currentTabConfig.bannerIcon}
          bannerTitle={currentTabConfig.bannerTitle}
          bannerSubtitle={currentTabConfig.bannerSubtitle}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 3. Bộ lọc dải thời gian (Theo ngày / 7 ngày qua / 30 ngày) */}
        <View style={[styles.rangeSelector, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
          {(['DAY', 'WEEK', 'MONTH'] as const).map((range) => {
            const isActive = selectedRange === range;
            const labels: Record<TimeRange, string> = {
              DAY: 'Theo ngày (Interactive)',
              WEEK: '7 ngày qua',
              MONTH: '30 ngày',
            };
            return (
              <TouchableOpacity
                key={range}
                style={[
                  styles.rangePill,
                  isActive && styles.rangePillActive,
                  isActive && isDarkMode && { backgroundColor: colors.card },
                ]}
                onPress={() => setSelectedRange(range)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.rangePillText,
                    isActive && styles.rangePillTextActive,
                    isActive && { color: colors.textPrimary },
                    !isActive && isDarkMode && { color: colors.textSecondary },
                  ]}
                >
                  {labels[range]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. Bộ chọn ngày */}
        {selectedRange === 'DAY' && (
          <HealthDateFilterBar
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            dateOptions={dateOptions}
            isCustomDate={isCustomDate}
            isLoadingVitals={isLoadingVitals}
            hasDayVitals={hasData}
            formatDisplayDateVN={formatDisplayDateVN}
            formatDateYMD={formatDateYMD}
            onOpenCalendarModal={() => {
              setCalendarInputDraft(selectedDate);
              setCalendarModalVisible(true);
            }}
            isDarkMode={isDarkMode}
            colors={colors}
          />
        )}

        {/* 5. Thanh tua dòng thời gian */}
        {selectedRange === 'DAY' && (
          <HealthTimelineScrubber
            scrubberMinutes={scrubberMinutes}
            setScrubberMinutes={setScrubberMinutes}
            closestVital={closestVital}
            isLoadingVitals={isLoadingVitals}
            hasData={hasData}
            selectedDate={selectedDate}
            isDarkMode={isDarkMode}
            colors={colors}
          />
        )}

        {/* 6. Lưới 4 thẻ chỉ số sinh hiệu */}
        <HealthVitalsGrid
          card1={currentTabConfig.card1}
          card2={currentTabConfig.card2}
          card3={currentTabConfig.card3}
          card4={currentTabConfig.card4}
          highlightedMetric={highlightedMetric}
          setHighlightedMetric={setHighlightedMetric}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 7. Biểu đồ dao động nhịp tim */}
        <HealthChartSection
          chartTitle={currentTabConfig.chartTitle}
          chartSubtitle={currentTabConfig.chartSubtitle}
          chartAvg={currentTabConfig.chartAvg}
          chartData={currentTabConfig.chartData}
          closestVital={closestVital}
          scrubberMinutes={scrubberMinutes}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 8. Link tới Hồ sơ Bệnh án Điện Tử */}
        <HealthMedicalRecordLink
          onPress={() => navigation.navigate('PatientMedicalRecord')}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 9. Trạng thái Cảm biến & Môi trường */}
        <HealthSensorStatusCard
          batteryDisplay={batteryDisplay}
          acousticStatus={acousticStatus}
          isDarkMode={isDarkMode}
          colors={colors}
        />

        {/* 10. Lời khuyên Bác sĩ AI */}
        <HealthAiAdviceCard
          aiAdvice={currentTabConfig.aiAdvice}
          isDarkMode={isDarkMode}
        />
      </ScrollView>

      {/* Modal chọn ngày trên lịch */}
      <HealthDatePickerModal
        visible={isCalendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        draftDate={calendarInputDraft}
        setDraftDate={setCalendarInputDraft}
        onConfirmDate={(val) => setSelectedDate(val)}
        todayStr={getTodayStr()}
        yesterdayStr={getYesterdayStr()}
        twoDaysAgoStr={getDaysAgoStr(2)}
        threeDaysAgoStr={getDaysAgoStr(3)}
        isDarkMode={isDarkMode}
        colors={colors}
      />
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  rangePillActive: {
    backgroundColor: '#FFFFFF',
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  rangePillTextActive: {
    fontWeight: '700',
    color: '#0F172A',
  },
});

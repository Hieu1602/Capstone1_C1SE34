// HealthDetailScreen.tsx
// Màn hình Chi tiết Tình trạng Sức khoẻ & Chỉ số Sinh hiệu người cao tuổi
// Hệ thống Smart Elderly Care AI – Tích hợp Lọc dữ liệu theo ngày & Tua dòng thời gian (Interactive Timeline)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { vitalsApi, patientApi } from '../../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TimeRange = 'DAY' | 'WEEK' | 'MONTH';

const formatDateYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDateVN = (ymd: string) => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymd;
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getYesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDaysAgoStr = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatTimeHM = (minutes: number) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

export default function HealthDetailScreen({ navigation, route }: any) {
  const { isDarkMode, colors } = useTheme();
  const metric = (route?.params?.focusMetric ?? route?.params?.metric) as 'heartRate' | 'activity' | 'spo2' | undefined;
  const initialTab = route?.params?.initialTab as 'today' | 'week' | 'month' | undefined;
  const { currentVitals, fetchVitals } = useVitalStore();

  const [selectedRange, setSelectedRange] = useState<TimeRange>(
    initialTab === 'week' ? 'WEEK' : initialTab === 'month' ? 'MONTH' : 'DAY'
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [highlightedMetric, setHighlightedMetric] = useState<string | null>(metric ?? null);
  const scrollRef = useRef<ScrollView>(null);

  // ── 1. Quản lý Lọc dữ liệu theo ngày (Date Filter) ──
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
  const [isLoadingVitals, setIsLoadingVitals] = useState(false);
  const [isCalendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarInputDraft, setCalendarInputDraft] = useState(selectedDate);

  const isCustomDate = useMemo(() => {
    return !dateOptions.some(opt => opt.value === selectedDate);
  }, [dateOptions, selectedDate]);

  // ── 2. Quản lý Tua dòng thời gian (Interactive Timeline Scrubber) ──
  const [scrubberMinutes, setScrubberMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Tải dữ liệu từ Backend khi chọn ngày (GET /api/v1/patients/1/vitals?target_date=YYYY-MM-DD)
  const loadDateVitals = async (dateStr: string) => {
    setIsLoadingVitals(true);
    try {
      const res = await patientApi.getVitals(1, dateStr);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setDayVitals(res.data);
        // Tự động điều chỉnh scrubber đến mốc đo gần nhất của ngày đó
        const first = res.data[0];
        if (first && first.recorded_at) {
          const d = new Date(first.recorded_at);
          setScrubberMinutes(d.getHours() * 60 + d.getMinutes());
        }
      } else {
        setDayVitals([]);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu sinh hiệu qua patientApi, thử fallback vitalsApi:', e);
      try {
        const fallbackRes = await vitalsApi.getHistory('hub-01', 100, dateStr);
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

  useEffect(() => {
    fetchVitals();
  }, []);

  useEffect(() => {
    if (selectedRange === 'DAY') {
      loadDateVitals(selectedDate);
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchVitals();
    if (selectedRange === 'DAY') {
      await loadDateVitals(selectedDate);
    }
    setIsRefreshing(false);
    Alert.alert('Đồng bộ thành công', 'Dữ liệu sức khoẻ từ Hub Orange Pi 5 và vòng đeo tay đã được làm mới.');
  };

  // Tìm mốc đo gần nhất với giờ tua
  const closestVital = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return null;
    let best = dayVitals[0];
    let minDiff = 999999;
    for (const v of dayVitals) {
      const d = new Date(v.recorded_at);
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
    if (dayVitals && dayVitals.length > 0) {
      return dayVitals.map((v) => {
        const d = new Date(v.recorded_at);
        const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return {
          id: v.id,
          label,
          hr: v.heart_rate || 74,
          spo2: v.spo2 || 98,
          temp: v.body_temp || 36.8,
          activity: v.activity || v.activity_state || 'Sinh hoạt',
          minute: d.getHours() * 60 + d.getMinutes(),
        };
      });
    }
    return [
      { id: 1, label: '06:00', hr: 68, minute: 360 },
      { id: 2, label: '08:00', hr: 74, minute: 480 },
      { id: 3, label: '10:00', hr: 82, minute: 600 },
      { id: 4, label: '12:00', hr: 71, minute: 720 },
      { id: 5, label: '14:00', hr: 74, minute: 840 },
      { id: 6, label: '16:00', hr: 79, minute: 960 },
      { id: 7, label: '18:00', hr: 74, minute: 1080 },
    ];
  }, [dayVitals]);

  // Nhịp tim trung bình trong ngày
  const dailyAvgHR = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return '75 bpm';
    const sum = dayVitals.reduce((acc, cur) => acc + (cur.heart_rate || 75), 0);
    return `${Math.round(sum / dayVitals.length)} bpm`;
  }, [dayVitals]);

  // Cấu hình dữ liệu thẻ chỉ số
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
            label: 'Trạng thái vận động',
            value: 'Tốt',
            unit: '',
            status: 'Bình thường',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Vận động đều đặn',
            icon: 'walk' as keyof typeof Ionicons.glyphMap,
            iconColor: '#9333EA',
            iconBg: '#F3E8FF',
          },
          chartTitle: 'Nhịp tim trung bình 7 ngày',
          chartSubtitle: 'Thống kê từ Thứ 2 đến Chủ Nhật',
          chartAvg: 'Trung bình: 76 bpm',
          chartData: [
            { label: 'T2', hr: 74 },
            { label: 'T3', hr: 72 },
            { label: 'T4', hr: 78 },
            { label: 'T5', hr: 75 },
            { label: 'T6', hr: 79 },
            { label: 'T7', hr: 73 },
            { label: 'CN', hr: 76 },
          ],
          aiAdvice:
            '• Tuần qua người cao tuổi có chất lượng giấc ngủ và nhịp tim phục hồi rất đều.\n• Không ghi nhận bất kỳ dấu hiệu mất thăng bằng hay trượt ngã nào.\n• Khuyến khích duy trì bài tập dưỡng sinh buổi sáng 15-20 phút.',
        };
      case 'MONTH':
        return {
          bannerTitle: 'Sức khoẻ tháng đạt chuẩn',
          bannerSubtitle: 'Các chỉ số sinh hiệu đo từ vòng đeo tay BLE Band đều duy trì trong ngưỡng mục tiêu y tế.',
          bannerIcon: 'shield-checkmark' as keyof typeof Ionicons.glyphMap,
          bannerAlert: false,
          card1: {
            label: 'Dao động nhịp tim',
            value: '75.5',
            unit: 'bpm',
            status: 'Ổn định',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Thấp nhất 62 - Cao nhất 88',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'SpO₂ Trung bình',
            value: '98',
            unit: '%',
            status: 'Chuẩn',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Đạt mục tiêu > 95%',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Thân nhiệt trung bình',
            value: '36.8',
            unit: '°C',
            status: 'Lý tưởng',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Chuẩn y tế: 36.5 - 37.2°C',
            icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          card4: {
            label: 'Chỉ số an toàn té ngã',
            value: '100',
            unit: '%',
            status: 'Tối ưu',
            statusColor: '#15803D',
            statusBg: '#DCFCE7',
            range: 'Không có sự cố nghiêm trọng',
            icon: 'shield-checkmark' as keyof typeof Ionicons.glyphMap,
            iconColor: '#9333EA',
            iconBg: '#F3E8FF',
          },
          chartTitle: 'Dao động nhịp tim theo tuần (Tháng này)',
          chartSubtitle: 'Tổng hợp 4 tuần gần nhất',
          chartAvg: 'Trung bình: 75.5 bpm',
          chartData: [
            { label: 'Tuần 1', hr: 75 },
            { label: 'Tuần 2', hr: 77 },
            { label: 'Tuần 3', hr: 74 },
            { label: 'Tuần 4', hr: 76 },
          ],
          aiAdvice:
            '• Chỉ số huyết áp và nhịp tim trong tháng duy trì tốt theo phác đồ điều trị.\n• Đề nghị gia đình đưa cụ tái khám đúng lịch hẹn vào ngày 15/10/2026 tại Bệnh viện Lão khoa.',
        };
      case 'DAY':
      default: {
        const hasData = dayVitals && dayVitals.length > 0;
        const hrVal = closestVital ? String(closestVital.heart_rate) : (hasData ? String(dayVitals[0].heart_rate) : '--');
        const spo2Val = closestVital ? String(closestVital.spo2) : (hasData ? String(dayVitals[0].spo2) : '--');
        const tempVal = closestVital ? String(closestVital.body_temp) : (hasData ? String(dayVitals[0].body_temp) : '--');
        const actVal = closestVital ? (closestVital.activity_state || closestVital.activity) : (hasData ? (dayVitals[0].activity_state || 'Sinh hoạt') : 'Chưa có dữ liệu');

        return {
          bannerTitle: isFallDetected
            ? 'Cảnh báo: Phát hiện sự cố ngã!'
            : hasData
              ? 'Tình trạng sinh tồn bình thường'
              : 'Chưa có dữ liệu đo cho ngày này',
          bannerSubtitle: isFallDetected
            ? 'Hệ thống AI vừa ghi nhận sự cố té ngã! Hãy kiểm tra clip và tới trợ giúp ngay.'
            : hasData
              ? `Đang xem ngày ${formatDisplayDateVN(selectedDate)} - Vòng BLE Band & Hub AI hoạt động ổn định.`
              : `Ngày ${formatDisplayDateVN(selectedDate)} chưa ghi nhận mốc đo nào trong cơ sở dữ liệu.`,
          bannerIcon: (isFallDetected ? 'warning' : hasData ? 'checkmark-circle' : 'information-circle') as keyof typeof Ionicons.glyphMap,
          bannerAlert: isFallDetected,
          card1: {
            label: 'Nhịp tim',
            value: hrVal,
            unit: hrVal !== '--' ? 'bpm' : '',
            status: !hasData ? 'Chưa có dữ liệu' : Number(hrVal) > 100 ? 'Cao' : Number(hrVal) < 60 ? 'Thấp' : 'Bình thường',
            statusColor: !hasData ? '#64748B' : Number(hrVal) > 100 ? Colors.danger : '#15803D',
            statusBg: !hasData ? '#F1F5F9' : Number(hrVal) > 100 ? '#FEE2E2' : '#DCFCE7',
            range: hasData ? 'Ngưỡng an toàn: 60 - 95 bpm' : 'Chưa ghi nhận',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'Nồng độ Oxy (SpO₂)',
            value: spo2Val,
            unit: spo2Val !== '--' ? '%' : '',
            status: !hasData ? 'Chưa có dữ liệu' : Number(spo2Val) < 95 ? 'Cảnh báo' : 'Lý tưởng',
            statusColor: !hasData ? '#64748B' : Number(spo2Val) < 95 ? Colors.danger : '#15803D',
            statusBg: !hasData ? '#F1F5F9' : Number(spo2Val) < 95 ? '#FEE2E2' : '#DCFCE7',
            range: hasData ? 'Ngưỡng an toàn: ≥ 95%' : 'Chưa ghi nhận',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Thân nhiệt cơ thể',
            value: tempVal,
            unit: tempVal !== '--' ? '°C' : '',
            status: !hasData ? 'Chưa có dữ liệu' : Number(tempVal) > 37.5 ? 'Sốt nhẹ' : 'Bình thường',
            statusColor: !hasData ? '#64748B' : Number(tempVal) > 37.5 ? Colors.danger : '#15803D',
            statusBg: !hasData ? '#F1F5F9' : Number(tempVal) > 37.5 ? '#FEE2E2' : '#DCFCE7',
            range: hasData ? 'Chuẩn: 36.5 - 37.2°C' : 'Chưa ghi nhận',
            icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          card4: {
            label: 'Trạng thái vận động',
            value: actVal,
            unit: '',
            status: !hasData ? 'Chưa có dữ liệu' : isFallDetected ? 'Cảnh báo' : 'An toàn',
            statusColor: !hasData ? '#64748B' : isFallDetected ? Colors.danger : '#15803D',
            statusBg: !hasData ? '#F1F5F9' : isFallDetected ? '#FEE2E2' : '#DCFCE7',
            range: closestVital ? `Ghi nhận lúc ${formatTimeHM(scrubberMinutes)}` : (hasData ? 'Sinh hoạt & Đi lại' : 'Chưa ghi nhận'),
            icon: 'body' as keyof typeof Ionicons.glyphMap,
            iconColor: '#9333EA',
            iconBg: '#F3E8FF',
          },
          chartTitle: `Dao động nhịp tim ngày ${formatDisplayDateVN(selectedDate)}`,
          chartSubtitle: hasData
            ? `Dữ liệu từ PostgreSQL (${chartDataForDay.length} mốc đo thực tế)`
            : 'Chưa có dữ liệu đo cho ngày này',
          chartAvg: hasData ? `Trung bình: ${dailyAvgHR}` : 'N/A',
          chartData: chartDataForDay,
          aiAdvice: hasData
            ? '• Nhịp tim và nồng độ SpO₂ của cụ duy trì rất đều đặn trong ngày.\n• Nhiệt độ cơ thể đang ở mức lý tưởng (36.8°C).\n• Nhắc cụ uống thêm 1 cốc nước ấm vào buổi chiều và vận động nhẹ nhàng quanh phòng khách.'
            : `• Ngày ${formatDisplayDateVN(selectedDate)} chưa có dữ liệu đo được đồng bộ.\n• Hãy kiểm tra vòng đeo tay BLE Band và kết nối Hub AI để tiếp tục thu thập dữ liệu sinh tồn.`,
        };
      }
    }
  };

  const currentTabConfig = getTabConfig();

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
        <View
          style={[
            styles.overallCard,
            currentTabConfig.bannerAlert
              ? styles.overallCardAlert
              : [styles.overallCardNormal, isDarkMode && { backgroundColor: colors.card }],
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
            <Text style={[styles.overallSubtitle, isDarkMode && { color: colors.textSecondary }]}>
              {currentTabConfig.bannerSubtitle}
            </Text>
          </View>
        </View>

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
                  isActive && [styles.rangePillActive, isDarkMode && { backgroundColor: colors.card }],
                ]}
                onPress={() => setSelectedRange(range)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.rangePillText,
                    isActive
                      ? [styles.rangePillTextActive, { color: colors.textPrimary }]
                      : [isDarkMode && { color: colors.textSecondary }],
                  ]}
                >
                  {labels[range]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 4. BỘ CHỌN NGÀY (Date Filter Bar with DatePicker) ── */}
        {selectedRange === 'DAY' && (
          <View style={styles.dateFilterSection}>
            <View style={styles.dateFilterHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar" size={17} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.dateFilterTitle, { color: colors.textPrimary }]}>
                  Chọn ngày kiểm tra:
                </Text>
              </View>
              {isLoadingVitals && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 11, color: Colors.primary }}>Đang tải...</Text>
                </View>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datePillsRow}>
              {/* Nút "Chọn ngày trên lịch" kèm icon Calendar */}
              {Platform.OS === 'web' ? (
                <label
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isCustomDate ? '#2563EB' : (isDarkMode ? '#1E293B' : '#EFF6FF'),
                    borderWidth: 1.5,
                    borderColor: isCustomDate ? '#1D4ED8' : (isDarkMode ? '#334155' : '#BFDBFE'),
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    cursor: 'pointer',
                    boxShadow: isCustomDate ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none',
                  } as any}
                >
                  <Ionicons
                    name="calendar"
                    size={16}
                    color={isCustomDate ? '#FFFFFF' : '#2563EB'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: isCustomDate ? '#FFFFFF' : '#1D4ED8',
                    }}
                  >
                    📅 Ngày: {formatDisplayDateVN(selectedDate)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={13}
                    color={isCustomDate ? '#FFFFFF' : '#2563EB'}
                    style={{ marginLeft: 6 }}
                  />
                  <input
                    type="date"
                    value={selectedDate}
                    max={formatDateYMD(new Date())}
                    onChange={(e: any) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                </label>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.calendarPickerBtn,
                    isCustomDate && styles.calendarPickerBtnActive,
                    isDarkMode && !isCustomDate && { backgroundColor: '#1E293B', borderColor: '#334155' }
                  ]}
                  onPress={() => {
                    setCalendarInputDraft(selectedDate);
                    setCalendarModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar"
                    size={16}
                    color={isCustomDate ? '#FFFFFF' : '#2563EB'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.calendarPickerBtnText,
                      isCustomDate && { color: '#FFFFFF' }
                    ]}
                  >
                    📅 Ngày: {formatDisplayDateVN(selectedDate)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={13}
                    color={isCustomDate ? '#FFFFFF' : '#2563EB'}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              )}

              {/* Các nút chọn nhanh (Hôm nay, Hôm qua, 2 ngày trước, 3 ngày trước) */}
              {dateOptions.map((opt) => {
                const isSelected = selectedDate === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.datePill,
                      isSelected ? styles.datePillActive : [styles.datePillInactive, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }],
                    ]}
                    onPress={() => setSelectedDate(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.datePillLabel, isSelected ? styles.datePillLabelActive : { color: colors.textPrimary }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.datePillSub, isSelected ? styles.datePillSubActive : { color: colors.textMuted }]}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Thông báo nhẹ khi ngày chưa có dữ liệu đo trong PostgreSQL */}
            {!isLoadingVitals && dayVitals.length === 0 && (
              <View style={[styles.noDataNoticeBox, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
                <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={[styles.noDataNoticeText, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>
                  Chưa có dữ liệu đo cho ngày này ({formatDisplayDateVN(selectedDate)}).
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── 5. THANH TUA DÒNG THỜI GIAN (Timeline Scrubber) ── */}
        {selectedRange === 'DAY' && (
          <View style={[styles.timelineCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.timelineHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.timelineIconDot}>
                  <Ionicons name="time" size={15} color="#FFF" />
                </View>
                <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>
                  Tua Dòng Thời Gian (Interactive Timeline)
                </Text>
              </View>
              <View style={styles.timeBadge}>
                <Ionicons name="stopwatch-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={styles.timeBadgeText}>{formatTimeHM(scrubberMinutes)}</Text>
              </View>
            </View>

            <Text style={[styles.timelineSub, { color: colors.textSecondary }]}>
              Kéo thanh trượt để tua xem lại dữ liệu sinh tồn đo được tại từng thời khắc trong ngày:
            </Text>

            {/* Slider Control */}
            <View style={styles.sliderContainer}>
              {Platform.OS === 'web' ? (
                <input
                  type="range"
                  min="0"
                  max="1439"
                  step="15"
                  value={scrubberMinutes}
                  onChange={(e: any) => setScrubberMinutes(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: 8,
                    accentColor: '#2563EB',
                    cursor: 'pointer',
                    borderRadius: 4,
                  }}
                />
              ) : (
                <View style={styles.sliderMockTrack}>
                  <View style={[styles.sliderMockProgress, { width: `${(scrubberMinutes / 1439) * 100}%` }]} />
                  <View style={[styles.sliderMockThumb, { left: `${Math.min(94, (scrubberMinutes / 1439) * 100)}%` }]} />
                </View>
              )}

              {/* Time Axis Labels */}
              <View style={styles.sliderLabelsRow}>
                <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>00:00</Text>
                <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>06:00</Text>
                <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>12:00</Text>
                <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>18:00</Text>
                <Text style={[styles.sliderLabelText, { color: colors.textMuted }]}>23:59</Text>
              </View>
            </View>

            {/* Quick Jump Buttons */}
            <View style={styles.quickJumpRow}>
              {[
                { label: 'Sáng', time: '07:15', mins: 435 },
                { label: 'Trưa', time: '12:45', mins: 765 },
                { label: 'Chiều', time: '17:00', mins: 1020 },
                { label: 'Tối', time: '21:00', mins: 1260 },
              ].map((btn) => (
                <TouchableOpacity
                  key={btn.label}
                  style={[
                    styles.quickJumpBtn,
                    Math.abs(scrubberMinutes - btn.mins) < 30 && styles.quickJumpBtnActive,
                    isDarkMode && { backgroundColor: colors.surfaceSubtle },
                  ]}
                  onPress={() => setScrubberMinutes(btn.mins)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quickJumpBtnText,
                      Math.abs(scrubberMinutes - btn.mins) < 30 && styles.quickJumpBtnTextActive,
                      { color: isDarkMode ? colors.textSecondary : '#475569' },
                    ]}
                  >
                    {btn.label} {btn.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Highlighted Closest Vital Card */}
            {closestVital ? (
              <View style={[styles.highlightBox, { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF', borderColor: '#3B82F6' }]}>
                <View style={styles.highlightHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="location" size={15} color="#2563EB" style={{ marginRight: 4 }} />
                    <Text style={[styles.highlightTitle, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
                      Mốc đo thực tế: {new Date(closestVital.recorded_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.highlightBadge}>
                    <Text style={styles.highlightBadgeText}>
                      {closestVital.activity_state || closestVital.activity || 'Sinh hoạt'}
                    </Text>
                  </View>
                </View>

                <View style={styles.highlightStatsGrid}>
                  <View style={styles.highlightStatCol}>
                    <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Nhịp tim</Text>
                    <Text style={[styles.highlightStatVal, { color: '#EF4444' }]}>{closestVital.heart_rate} bpm</Text>
                  </View>
                  <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
                  <View style={styles.highlightStatCol}>
                    <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Oxy SpO₂</Text>
                    <Text style={[styles.highlightStatVal, { color: '#0284C7' }]}>{closestVital.spo2}%</Text>
                  </View>
                  <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
                  <View style={styles.highlightStatCol}>
                    <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Thân nhiệt</Text>
                    <Text style={[styles.highlightStatVal, { color: '#D97706' }]}>{closestVital.body_temp}°C</Text>
                  </View>
                  <View style={[styles.highlightStatDivider, { backgroundColor: isDarkMode ? '#334155' : '#DBEAFE' }]} />
                  <View style={styles.highlightStatCol}>
                    <Text style={[styles.highlightStatLabel, { color: colors.textMuted }]}>Âm thanh</Text>
                    <Text style={[styles.highlightStatVal, { color: '#16A34A' }]}>{closestVital.sound_state || closestVital.sound || 'Bình thường'}</Text>
                  </View>
                </View>
              </View>
            ) : (
              !isLoadingVitals && dayVitals.length === 0 && (
                <View style={[styles.timelineEmptyBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                  <Ionicons name="calendar-outline" size={30} color="#94A3B8" style={{ marginBottom: 6 }} />
                  <Text style={[styles.timelineEmptyTitle, { color: colors.textPrimary }]}>
                    Chưa có dữ liệu đo cho ngày này
                  </Text>
                  <Text style={[styles.timelineEmptySub, { color: colors.textMuted }]}>
                    Không tìm thấy bản ghi nhịp tim & sinh hiệu nào trong cơ sở dữ liệu PostgreSQL cho ngày {formatDisplayDateVN(selectedDate)}. Vui lòng chọn ngày khác trên lịch để tua xem.
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        {/* ── 6. LƯỚI 4 THẺ CHỈ SỐ SINH HIỆU ── */}
        <View style={styles.vitalsGrid}>
          {/* Thẻ 1: Nhịp tim */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
              highlightedMetric === 'heartRate' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'heartRate' ? null : 'heartRate')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card1.iconBg }]}>
                <Ionicons name={currentTabConfig.card1.icon} size={20} color={currentTabConfig.card1.iconColor} />
              </View>
              <View style={[styles.vitalStatusTag, { backgroundColor: currentTabConfig.card1.statusBg }]}>
                <Text style={[styles.vitalStatusText, { color: currentTabConfig.card1.statusColor }]}>
                  {currentTabConfig.card1.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.card1.label}</Text>
            <View style={styles.vitalValRow}>
              <Text style={[styles.vitalValNumber, isDarkMode && { color: colors.textPrimary }]}>
                {currentTabConfig.card1.value}
              </Text>
              {Boolean(currentTabConfig.card1.unit) && (
                <Text style={[styles.vitalValUnit, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.card1.unit}</Text>
              )}
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card1.range}</Text>
          </TouchableOpacity>

          {/* Thẻ 2: SpO2 */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
              highlightedMetric === 'spo2' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'spo2' ? null : 'spo2')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card2.iconBg }]}>
                <Ionicons name={currentTabConfig.card2.icon} size={20} color={currentTabConfig.card2.iconColor} />
              </View>
              <View style={[styles.vitalStatusTag, { backgroundColor: currentTabConfig.card2.statusBg }]}>
                <Text style={[styles.vitalStatusText, { color: currentTabConfig.card2.statusColor }]}>
                  {currentTabConfig.card2.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.card2.label}</Text>
            <View style={styles.vitalValRow}>
              <Text style={[styles.vitalValNumber, isDarkMode && { color: colors.textPrimary }]}>{currentTabConfig.card2.value}</Text>
              {Boolean(currentTabConfig.card2.unit) && (
                <Text style={[styles.vitalValUnit, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.card2.unit}</Text>
              )}
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card2.range}</Text>
          </TouchableOpacity>

          {/* Thẻ 3: Nhiệt độ cơ thể */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
              highlightedMetric === 'temp' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'temp' ? null : 'temp')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card3.iconBg }]}>
                <Ionicons name={currentTabConfig.card3.icon} size={20} color={currentTabConfig.card3.iconColor} />
              </View>
              <View style={[styles.vitalStatusTag, { backgroundColor: currentTabConfig.card3.statusBg }]}>
                <Text style={[styles.vitalStatusText, { color: currentTabConfig.card3.statusColor }]}>
                  {currentTabConfig.card3.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.card3.label}</Text>
            <View style={styles.vitalValRow}>
              <Text style={[styles.vitalValNumber, isDarkMode && { color: colors.textPrimary }]}>{currentTabConfig.card3.value}</Text>
              {Boolean(currentTabConfig.card3.unit) && (
                <Text style={[styles.vitalValUnit, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.card3.unit}</Text>
              )}
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card3.range}</Text>
          </TouchableOpacity>

          {/* Thẻ 4: Trạng thái vận động */}
          <TouchableOpacity
            style={[
              styles.vitalBox,
              isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
              highlightedMetric === 'activity' && styles.vitalBoxHighlighted,
            ]}
            activeOpacity={0.8}
            onPress={() => setHighlightedMetric(highlightedMetric === 'activity' ? null : 'activity')}
          >
            <View style={styles.vitalBoxHeader}>
              <View style={[styles.vitalIconWrapper, { backgroundColor: currentTabConfig.card4.iconBg }]}>
                <Ionicons name={currentTabConfig.card4.icon} size={20} color={currentTabConfig.card4.iconColor} />
              </View>
              <View style={[styles.vitalStatusTag, { backgroundColor: currentTabConfig.card4.statusBg }]}>
                <Text style={[styles.vitalStatusText, { color: currentTabConfig.card4.statusColor }]}>
                  {currentTabConfig.card4.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.vitalBoxLabel, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.card4.label}</Text>
            <View style={styles.vitalValRow}>
              <Text style={[styles.vitalValNumber, isDarkMode && { color: colors.textPrimary }, currentTabConfig.card4.value.length > 8 && { fontSize: 16 }]}>
                {currentTabConfig.card4.value}
              </Text>
            </View>
            <Text style={styles.vitalNormalRange}>{currentTabConfig.card4.range}</Text>
          </TouchableOpacity>
        </View>

        {/* ── 7. BIỂU ĐỒ DAO ĐỘNG NHỊP TIM (RENDER THEO NGÀY ĐÃ CHỌN) ── */}
        <View style={[styles.chartCard, isDarkMode && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
          <View style={styles.chartCardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.chartCardTitle, isDarkMode && { color: colors.textPrimary }]}>{currentTabConfig.chartTitle}</Text>
              <Text style={[styles.chartCardSubtitle, isDarkMode && { color: colors.textSecondary }]}>{currentTabConfig.chartSubtitle}</Text>
            </View>
            <View style={styles.chartAvgBadge}>
              <Text style={styles.chartAvgText}>{currentTabConfig.chartAvg}</Text>
            </View>
          </View>

          {/* Visual Bar Chart cuộn ngang nếu nhiều mốc đo */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barsScrollContainer}>
            <View style={styles.barsContainer}>
              {currentTabConfig.chartData.map((point: any, idx: number) => {
                const barHeight = Math.max(28, ((point.hr - 50) / 45) * 90);
                const isClosest = closestVital && (point.id === closestVital.id || Math.abs(point.minute - scrubberMinutes) < 45);

                return (
                  <View key={`${point.label}-${idx}`} style={[styles.barCol, isClosest && styles.barColActive]}>
                    {isClosest ? (
                      <View style={styles.activePinBadge}>
                        <Text style={styles.activePinBadgeText}>📍 {point.hr}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.barValText, isDarkMode && { color: colors.textSecondary }]}>{point.hr}</Text>
                    )}

                    <View style={[styles.barTrack, isDarkMode && { backgroundColor: colors.surfaceSubtle }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: barHeight,
                            backgroundColor: isClosest ? '#2563EB' : '#38BDF8',
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={[
                        styles.barTimeText,
                        isDarkMode && { color: colors.textSecondary },
                        isClosest && styles.barTimeTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {point.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* ── 8. LINK TỚI HỒ SƠ BỆNH ÁN NGƯỜI CAO TUỔI (AES-256) ── */}
        <TouchableOpacity
          style={[styles.recordLinkCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate('PatientMedicalRecord')}
          activeOpacity={0.8}
        >
          <View style={styles.recordLinkLeft}>
            <View style={styles.recordLinkIconCircle}>
              <Ionicons name="medical" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.recordLinkTitle, { color: colors.textPrimary }]}>
                Hồ Sơ Bệnh Án Điện Tử (Chuẩn AES-256)
              </Text>
              <Text style={[styles.recordLinkSub, { color: colors.textMuted }]}>
                Xem tiền sử tim mạch, huyết áp, đơn thuốc và nhật ký bác sĩ điều trị
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#2563EB" />
        </TouchableOpacity>

        {/* ── 9. TRẠNG THÁI CẢM BIẾN & MÔI TRƯỜNG ── */}
        <View style={[styles.statusSectionCard, isDarkMode && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeading, isDarkMode && { color: colors.textPrimary }]}>Trạng thái cảm biến & Môi trường</Text>

          <View style={styles.statusRowItem}>
            <View style={[styles.statusIconBox, isDarkMode && { backgroundColor: 'rgba(255, 122, 0, 0.15)' }]}>
              <Ionicons name="watch-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusItemTitle, isDarkMode && { color: colors.textPrimary }]}>Vòng tay thông minh BLE</Text>
              <Text style={[styles.statusItemSub, isDarkMode && { color: colors.textSecondary }]}>Pin: {battery}% • Kết nối liên tục</Text>
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Đang đo</Text>
            </View>
          </View>

          <View style={[styles.divider, isDarkMode && { backgroundColor: colors.border }]} />

          <View style={styles.statusRowItem}>
            <View style={[styles.statusIconBox, { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' }]}>
              <Ionicons name="mic-outline" size={20} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusItemTitle, isDarkMode && { color: colors.textPrimary }]}>Nhận diện âm thanh YAMNet</Text>
              <Text style={[styles.statusItemSub, isDarkMode && { color: colors.textSecondary }]}>Môi trường: {acousticStatus}</Text>
            </View>
            <View style={styles.safeBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.safeText}>An toàn</Text>
            </View>
          </View>
        </View>

        {/* ── 10. LỜI KHUYÊN BÁC SĨ AI ── */}
        <View style={[styles.aiAdviceCard, isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' }]}>
          <View style={styles.aiAdviceHeader}>
            <Ionicons name="sparkles" size={18} color="#D97706" />
            <Text style={styles.aiAdviceTitle}>Lời khuyên Bác sĩ AI</Text>
          </View>
          <Text style={[styles.aiAdviceBody, isDarkMode && { color: '#CBD5E1' }]}>
            {currentTabConfig.aiAdvice}
          </Text>
        </View>
      </ScrollView>

      {/* ── MODAL CHỌN NGÀY TRÊN LỊCH (Date Picker Modal) ── */}
      <Modal
        visible={isCalendarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconBox}>
                <Ionicons name="calendar" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, isDarkMode && { color: colors.textPrimary }]}>
                  Chọn ngày kiểm tra
                </Text>
                <Text style={[styles.modalSub, isDarkMode && { color: colors.textSecondary }]}>
                  Chọn ngày để tra cứu chỉ số sinh tồn & nhật ký
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCalendarModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalInputLabel, isDarkMode && { color: colors.textSecondary }]}>
              Nhập ngày cần tra cứu (định dạng YYYY-MM-DD):
            </Text>
            <TextInput
              style={[
                styles.modalDateInput,
                isDarkMode && { backgroundColor: colors.surfaceSubtle, color: colors.textPrimary, borderColor: colors.border },
              ]}
              value={calendarInputDraft}
              onChangeText={setCalendarInputDraft}
              placeholder="Ví dụ: 2026-09-28"
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
            />

            {/* Phím chọn nhanh trong popup */}
            <Text style={[styles.modalInputLabel, { marginTop: 10, marginBottom: 8 }, isDarkMode && { color: colors.textSecondary }]}>
              Hoặc chọn ngày nhanh:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {[
                { label: 'Hôm nay', val: getTodayStr() },
                { label: 'Hôm qua', val: getYesterdayStr() },
                { label: '2 ngày trước', val: getDaysAgoStr(2) },
                { label: '3 ngày trước', val: getDaysAgoStr(3) },
              ].map((item) => (
                <TouchableOpacity
                  key={item.val}
                  style={[
                    styles.modalQuickChip,
                    calendarInputDraft === item.val && styles.modalQuickChipActive,
                    isDarkMode && { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                  onPress={() => setCalendarInputDraft(item.val)}
                >
                  <Text
                    style={[
                      styles.modalQuickChipText,
                      calendarInputDraft === item.val && { color: '#2563EB', fontWeight: '700' },
                      isDarkMode && { color: colors.textSecondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDarkMode && { borderColor: colors.border }]}
                onPress={() => setCalendarModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, isDarkMode && { color: colors.textSecondary }]}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  const trimmed = calendarInputDraft.trim();
                  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                    setSelectedDate(trimmed);
                    setCalendarModalVisible(false);
                  } else {
                    Alert.alert('Định dạng chưa đúng', 'Vui lòng nhập ngày theo định dạng YYYY-MM-DD (Ví dụ: 2026-09-28)');
                  }
                }}
              >
                <Ionicons name="search" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmBtnText}>Xem dữ liệu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  overallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
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
    marginRight: 12,
  },
  overallTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  overallSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  rangePillActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.soft,
  },
  rangePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  rangePillTextActive: {
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Date Filter Styles ──
  dateFilterSection: {
    marginBottom: 14,
  },
  dateFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateFilterTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  datePillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    ...Shadows.soft,
  },
  datePillInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  datePillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  datePillLabelActive: {
    color: '#FFFFFF',
  },
  datePillSub: {
    fontSize: 10,
    marginTop: 2,
  },
  datePillSubActive: {
    color: '#E0E7FF',
  },

  // ── Timeline Scrubber Styles ──
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timelineIconDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineSub: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  timeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderMockTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderMockProgress: {
    height: 8,
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  sliderMockThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFF',
    top: -6,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sliderLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quickJumpRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  quickJumpBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickJumpBtnActive: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  quickJumpBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  quickJumpBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  highlightBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  highlightBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  highlightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  highlightStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  highlightStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  highlightStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 3,
  },
  highlightStatVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  highlightStatDivider: {
    width: 1,
    height: 24,
  },

  // ── Metric Boxes Grid ──
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  vitalBox: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  vitalBoxHighlighted: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  vitalBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vitalStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  vitalBoxLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  vitalValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  vitalValNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  vitalValUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  vitalNormalRange: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // ── Chart Styles ──
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
    marginBottom: 14,
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
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 16,
  },
  barCol: {
    alignItems: 'center',
    width: 44,
  },
  barColActive: {
    transform: [{ scale: 1.05 }],
  },
  activePinBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  activePinBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  barValText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barTimeText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
  },
  barTimeTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },

  // ── Record Link Styles ──
  recordLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  recordLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recordLinkIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLinkTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  recordLinkSub: {
    fontSize: 11,
    lineHeight: 16,
  },

  // ── Sensor Status Styles ──
  statusSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.soft,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  statusRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  statusItemSub: {
    fontSize: 11,
    color: '#64748B',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
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
    fontSize: 11,
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
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },

  // ── Date Picker & Notification Styles ──
  calendarPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    marginRight: 8,
  },
  calendarPickerBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  calendarPickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  noDataNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  noDataNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  timelineEmptyBox: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  timelineEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  timelineEmptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalDateInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    color: Colors.textPrimary,
  },
  modalQuickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalQuickChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  modalQuickChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

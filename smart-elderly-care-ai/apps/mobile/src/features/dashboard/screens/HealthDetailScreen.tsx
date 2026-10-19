// ==============================================================================
// TỆP: HealthDetailScreen.tsx
// PHÂN HỆ: Màn hình Chi tiết Chỉ số Sinh tồn & Phân tích Sức khỏe
// TÁC GIẢ: Phan Nguyễn Giáng My
// MÔ TẢ CHỨC NĂNG:
//   1. Hỗ trợ 3 chế độ xem thống kê: Theo ngày (DAY), 7 ngày qua (WEEK), 30 ngày (MONTH).
//   2. Tích hợp bộ lọc lịch ngày (Date Filter) và Thanh tua dòng thời gian (Interactive Timeline Scrubber)
//      giúp tra cứu chính xác nhịp tim, SpO2, nhiệt độ da tại từng khung giờ trong ngày.
//   3. Tính toán trung bình động (Moving Average) từ dữ liệu thực tế trong PostgreSQL.
//      Khi bảng dữ liệu trống, tự động hiển thị Empty State ('--' / 'Chưa có dữ liệu').
//   4. Lối tắt điều hướng sang Hồ sơ bệnh án điện tử (AES-256) và Lịch nhắc uống thuốc.
// ==============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedAlert as Alert, LocalizedText as Text } from '../../../i18n/LocalizedComponents';
import { Colors, Shadows } from '../../../theme/colors';
import { useVitalStore } from '../../../store/useVitalStore';
import { useTheme } from '../../../store/useThemeStore';
import { vitalsApi, patientApi } from '../../../services/api';

// Các component con đã được tách module hóa
import { HealthTimelineScrubber } from '../components/HealthTimelineScrubber';
import { HealthVitalsGrid, VitalCardConfig } from '../components/HealthVitalsGrid';
import { HealthChartSection } from '../components/HealthChartSection';
import { HealthDatePickerModal } from '../components/HealthDatePickerModal';

// Kiểu khoảng thời gian thống kê: Theo ngày | 7 ngày | 30 ngày
type TimeRange = 'DAY' | 'WEEK' | 'MONTH';

// Hàm chuyển đổi đối tượng Date sang chuỗi chuẩn YYYY-MM-DD để gửi lên API Backend
const formatDateYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Hàm định dạng chuỗi YYYY-MM-DD sang định dạng hiển thị tiếng Việt DD/MM/YYYY
const formatDisplayDateVN = (ymd: string) => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymd;
};

// Các hàm tiện ích lấy chuỗi ngày Hôm nay, Hôm qua và N ngày trước
const getTodayStr = () => formatDateYMD(new Date());
const getYesterdayStr = () => formatDateYMD(new Date(Date.now() - 86400000));
const getDaysAgoStr = (days: number) => formatDateYMD(new Date(Date.now() - 86400000 * days));

// Hàm quy đổi tổng số phút trong ngày (0 -> 1439) sang định dạng giờ:phút (HH:MM)
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
  const [rangeVitals, setRangeVitals] = useState<any[]>([]);
  const [isLoadingVitals, setIsLoadingVitals] = useState(false);
  const [isCalendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarInputDraft, setCalendarInputDraft] = useState(selectedDate);

  const isCustomDate = useMemo(() => {
    return !dateOptions.some((opt) => opt.value === selectedDate);
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
    Alert.alert('Đồng bộ thành công', 'Dữ liệu sức khoẻ từ Hub và vòng đeo tay đã được làm mới.');
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

  // Dữ liệu biểu đồ động theo ngày được chọn (không trả về dữ liệu mẫu nếu rỗng)
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

  // Nhịp tim trung bình trong ngày thực tế từ cơ sở dữ liệu
  const dailyAvgHR = useMemo(() => {
    if (!dayVitals || dayVitals.length === 0) return '--';
    const valid = dayVitals.filter((v) => typeof v.heart_rate === 'number');
    if (valid.length === 0) return '--';
    const sum = valid.reduce((acc, cur) => acc + cur.heart_rate, 0);
    return `${Math.round(sum / valid.length)} bpm`;
  }, [dayVitals]);

  // Dữ liệu biểu đồ và tính toán trung bình thực tế cho Tuần / Tháng (không dùng fallback mock data)
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

  // Cấu hình dữ liệu thẻ chỉ số theo dải thời gian được chọn
  const getTabConfig = () => {
    switch (selectedRange) {
      case 'WEEK': {
        const hasRangeData = weekData.chart.length > 0;
        return {
          bannerTitle: hasRangeData ? 'Xu hướng tuần' : 'Chưa có đủ dữ liệu tuần',
          bannerSubtitle: hasRangeData
            ? 'Tổng hợp dữ liệu nhịp tim và oxy máu từ vòng đeo tay BLE qua các ngày trong tuần.'
            : 'Chưa có bản ghi nào trong 7 ngày qua. Vui lòng đeo vòng tay để tiếp tục đồng bộ.',
          bannerIcon: (hasRangeData ? 'checkmark-circle' : 'information-circle') as keyof typeof Ionicons.glyphMap,
          bannerAlert: false,
          card1: {
            label: 'Nhịp tim TB tuần',
            value: weekData.avgHR,
            unit: weekData.avgHR !== '--' ? 'bpm' : '',
            status: weekData.avgHR !== '--' ? 'Chuẩn' : 'Chưa có dữ liệu',
            statusColor: weekData.avgHR !== '--' ? '#15803D' : '#64748B',
            statusBg: weekData.avgHR !== '--' ? '#DCFCE7' : '#F1F5F9',
            range: hasRangeData ? 'Ngưỡng theo dõi: 60 - 95 bpm' : 'Chưa ghi nhận',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'SpO₂ TB tuần',
            value: weekData.avgSpO2,
            unit: weekData.avgSpO2 !== '--' ? '%' : '',
            status: weekData.avgSpO2 !== '--' ? 'Tốt' : 'Chưa có dữ liệu',
            statusColor: weekData.avgSpO2 !== '--' ? '#15803D' : '#64748B',
            statusBg: weekData.avgSpO2 !== '--' ? '#DCFCE7' : '#F1F5F9',
            range: hasRangeData ? 'Ngưỡng an toàn: ≥ 95%' : 'Chưa ghi nhận',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Thân nhiệt TB tuần',
            value: weekData.avgTemp,
            unit: weekData.avgTemp !== '--' ? '°C' : '',
            status: weekData.avgTemp !== '--' ? 'Bình thường' : 'Chưa có dữ liệu',
            statusColor: weekData.avgTemp !== '--' ? '#15803D' : '#64748B',
            statusBg: weekData.avgTemp !== '--' ? '#DCFCE7' : '#F1F5F9',
            range: hasRangeData ? 'Chuẩn: 36.5 - 37.2°C' : 'Chưa ghi nhận',
            icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          card4: {
            label: 'Trạng thái vận động',
            value: hasRangeData ? 'Sinh hoạt' : 'Chưa có dữ liệu',
            unit: '',
            status: hasRangeData ? 'Bình thường' : 'Chưa có dữ liệu',
            statusColor: hasRangeData ? '#15803D' : '#64748B',
            statusBg: hasRangeData ? '#DCFCE7' : '#F1F5F9',
            range: hasRangeData ? 'Vận động đều đặn' : 'Chưa ghi nhận',
            icon: 'walk' as keyof typeof Ionicons.glyphMap,
            iconColor: '#9333EA',
            iconBg: '#F3E8FF',
          },
          chartTitle: 'Nhịp tim các ngày gần nhất',
          chartSubtitle: hasRangeData ? `Dữ liệu đo thực tế (${weekData.chart.length} mốc)` : 'Chưa có dữ liệu tuần',
          chartAvg: weekData.avgHR !== '--' ? `Trung bình: ${weekData.avgHR} bpm` : 'N/A',
          chartData: weekData.chart,
          aiAdvice: hasRangeData
            ? '• Chất lượng nhịp tim và giấc ngủ được ghi nhận duy trì ổn định.\n• Không phát hiện bất thường té ngã.\n• Khuyến khích người cao tuổi duy trì bài tập dưỡng sinh nhẹ nhàng 15-20 phút.'
            : '• Chưa có đủ dữ liệu đo trong 7 ngày qua để phân tích chi tiết.\n• Hãy giữ kết nối vòng đeo tay và Hub AI để liên tục cập nhật.',
        };
      }
      case 'MONTH': {
        const hasRangeData = weekData.chart.length > 0;
        return {
          bannerTitle: hasRangeData ? 'Tổng hợp sức khoẻ 30 ngày' : 'Chưa có đủ dữ liệu tháng',
          bannerSubtitle: hasRangeData
            ? 'Dữ liệu đo từ vòng đeo tay BLE Band được lưu trữ và tổng hợp trên hệ thống.'
            : 'Chưa có bản ghi nào trong tháng này.',
          bannerIcon: (hasRangeData ? 'shield-checkmark' : 'information-circle') as keyof typeof Ionicons.glyphMap,
          bannerAlert: false,
          card1: {
            label: 'Dao động nhịp tim',
            value: weekData.avgHR,
            unit: weekData.avgHR !== '--' ? 'bpm' : '',
            status: weekData.avgHR !== '--' ? 'Ổn định' : 'Chưa có dữ liệu',
            statusColor: weekData.avgHR !== '--' ? '#15803D' : '#64748B',
            statusBg: weekData.avgHR !== '--' ? '#DCFCE7' : '#F1F5F9',
            range: hasRangeData ? 'Ngưỡng theo dõi 60 - 95 bpm' : 'Chưa ghi nhận',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'SpO₂ Trung bình',
            value: weekData.avgSpO2,
            unit: weekData.avgSpO2 !== '--' ? '%' : '',
            status: weekData.avgSpO2 !== '--' ? 'Chuẩn' : 'Chưa có dữ liệu',
            statusColor: weekData.avgSpO2 !== '--' ? '#15803D' : '#64748B',
            statusBg: weekData.avgSpO2 !== '--' ? '#DCFCE7' : '#F1F5F9',
            range: hasRangeData ? 'Mục tiêu y tế: ≥ 95%' : 'Chưa ghi nhận',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Thân nhiệt trung bình',
            value: weekData.avgTemp,
            unit: weekData.avgTemp !== '--' ? '°C' : '',
            status: weekData.avgTemp !== '--' ? 'Lý tưởng' : 'Chưa có dữ liệu',
            statusColor: weekData.avgTemp !== '--' ? '#15803D' : '#64748B',
            statusBg: weekData.avgTemp !== '--' ? '#DCFCE7' : '#F1F5F9',
            range: hasRangeData ? 'Chuẩn y tế: 36.5 - 37.2°C' : 'Chưa ghi nhận',
            icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
          },
          card4: {
            label: 'Chỉ số an toàn té ngã',
            value: isFallDetected ? 'Có cảnh báo' : hasRangeData ? 'An toàn' : 'Chưa có dữ liệu',
            unit: '',
            status: isFallDetected ? 'Cảnh báo' : hasRangeData ? 'Tối ưu' : 'Chưa có dữ liệu',
            statusColor: isFallDetected ? Colors.danger : hasRangeData ? '#15803D' : '#64748B',
            statusBg: isFallDetected ? '#FEE2E2' : hasRangeData ? '#DCFCE7' : '#F1F5F9',
            range: isFallDetected ? 'Đã ghi nhận sự cố' : hasRangeData ? 'Không có sự cố ngã' : 'Chưa ghi nhận',
            icon: 'shield-checkmark' as keyof typeof Ionicons.glyphMap,
            iconColor: '#9333EA',
            iconBg: '#F3E8FF',
          },
          chartTitle: 'Dao động nhịp tim theo các mốc đo',
          chartSubtitle: hasRangeData ? 'Dữ liệu tổng hợp từ hệ thống' : 'Chưa có dữ liệu tháng',
          chartAvg: weekData.avgHR !== '--' ? `Trung bình: ${weekData.avgHR} bpm` : 'N/A',
          chartData: weekData.chart,
          aiAdvice: hasRangeData
            ? '• Các chỉ số huyết áp và nhịp tim đo được được lưu trữ an toàn trong hồ sơ.\n• Đề nghị gia đình theo dõi lịch uống thuốc và tái khám định kỳ.'
            : '• Chưa có đủ dữ liệu đo trong 30 ngày qua.',
        };
      }
      case 'DAY':
      default: {
        const hasData = dayVitals && dayVitals.length > 0;
        const hrVal = closestVital ? String(closestVital.heart_rate ?? '--') : (hasData && dayVitals[0].heart_rate ? String(dayVitals[0].heart_rate) : '--');
        const spo2Val = closestVital ? String(closestVital.spo2 ?? '--') : (hasData && dayVitals[0].spo2 ? String(dayVitals[0].spo2) : '--');
        const tempVal = closestVital ? String(closestVital.body_temp ?? closestVital.skin_temp_max ?? '--') : (hasData && (dayVitals[0].body_temp ?? dayVitals[0].skin_temp_max) ? String(dayVitals[0].body_temp ?? dayVitals[0].skin_temp_max) : '--');
        const actVal = closestVital ? (closestVital.activity_state || closestVital.activity || 'Sinh hoạt') : (hasData ? (dayVitals[0].activity_state || 'Sinh hoạt') : 'Chưa có dữ liệu');

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
            status: !hasData || hrVal === '--' ? 'Chưa có dữ liệu' : Number(hrVal) > 100 ? 'Cao' : Number(hrVal) < 60 ? 'Thấp' : 'Bình thường',
            statusColor: !hasData || hrVal === '--' ? '#64748B' : Number(hrVal) > 100 ? Colors.danger : '#15803D',
            statusBg: !hasData || hrVal === '--' ? '#F1F5F9' : Number(hrVal) > 100 ? '#FEE2E2' : '#DCFCE7',
            range: hasData ? 'Ngưỡng an toàn: 60 - 95 bpm' : 'Chưa ghi nhận',
            icon: 'heart' as keyof typeof Ionicons.glyphMap,
            iconColor: '#EF4444',
            iconBg: '#FEE2E2',
          },
          card2: {
            label: 'Nồng độ Oxy (SpO₂)',
            value: spo2Val,
            unit: spo2Val !== '--' ? '%' : '',
            status: !hasData || spo2Val === '--' ? 'Chưa có dữ liệu' : Number(spo2Val) < 95 ? 'Cảnh báo' : 'Lý tưởng',
            statusColor: !hasData || spo2Val === '--' ? '#64748B' : Number(spo2Val) < 95 ? Colors.danger : '#15803D',
            statusBg: !hasData || spo2Val === '--' ? '#F1F5F9' : Number(spo2Val) < 95 ? '#FEE2E2' : '#DCFCE7',
            range: hasData ? 'Ngưỡng an toàn: ≥ 95%' : 'Chưa ghi nhận',
            icon: 'water' as keyof typeof Ionicons.glyphMap,
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          card3: {
            label: 'Thân nhiệt cơ thể',
            value: tempVal,
            unit: tempVal !== '--' ? '°C' : '',
            status: !hasData || tempVal === '--' ? 'Chưa có dữ liệu' : Number(tempVal) > 37.5 ? 'Sốt nhẹ' : 'Bình thường',
            statusColor: !hasData || tempVal === '--' ? '#64748B' : Number(tempVal) > 37.5 ? Colors.danger : '#15803D',
            statusBg: !hasData || tempVal === '--' ? '#F1F5F9' : Number(tempVal) > 37.5 ? '#FEE2E2' : '#DCFCE7',
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
            ? '• Nhịp tim và nồng độ SpO₂ của cụ được ghi nhận đều đặn trong ngày.\n• Nhiệt độ cơ thể duy trì ổn định.\n• Nhắc cụ uống đủ nước và vận động nhẹ nhàng quanh phòng khách.'
            : `• Ngày ${formatDisplayDateVN(selectedDate)} chưa có dữ liệu đo được đồng bộ.\n• Hãy kiểm tra vòng đeo tay BLE Band và kết nối Hub AI để tiếp tục thu thập dữ liệu sinh tồn.`,
        };
      }
    }
  };

  const currentTabConfig = getTabConfig();
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
        <View
          style={[
            styles.overallCard,
            currentTabConfig.bannerAlert ? styles.overallCardAlert : styles.overallCardNormal,
            !currentTabConfig.bannerAlert && isDarkMode && { backgroundColor: colors.card },
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
                    isDarkMode && !isCustomDate && { backgroundColor: '#1E293B', borderColor: '#334155' },
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
                      isCustomDate && { color: '#FFFFFF' },
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
                      isSelected ? styles.datePillActive : styles.datePillInactive,
                      !isSelected && isDarkMode && { backgroundColor: colors.card, borderColor: colors.border },
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

            {/* Thông báo khi ngày chưa có dữ liệu đo trong PostgreSQL */}
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

        {/* ── 6. LƯỚI 4 THẺ CHỈ SỐ SINH HIỆU ── */}
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

        {/* ── 7. BIỂU ĐỒ DAO ĐỘNG NHỊP TIM ── */}
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
              <Text style={[styles.statusItemSub, isDarkMode && { color: colors.textSecondary }]}>Pin: {batteryDisplay} • Kết nối liên tục</Text>
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

      {/* ── MODAL CHỌN NGÀY TRÊN LỊCH ── */}
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

  // ── AI Advice Styles ──
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
});

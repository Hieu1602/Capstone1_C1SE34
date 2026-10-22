import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../../theme/colors';
import { VitalCardConfig } from '../HealthVitalsGrid';

export type TimeRange = 'DAY' | 'WEEK' | 'MONTH';

export const formatDateYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDisplayDateVN = (ymd: string) => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymd;
};

export const getTodayStr = () => formatDateYMD(new Date());
export const getYesterdayStr = () => formatDateYMD(new Date(Date.now() - 86400000));
export const getDaysAgoStr = (days: number) => formatDateYMD(new Date(Date.now() - 86400000 * days));

export const formatTimeHM = (minutes: number) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

export interface HealthTabConfigResult {
  bannerTitle: string;
  bannerSubtitle: string;
  bannerIcon: keyof typeof Ionicons.glyphMap;
  bannerAlert: boolean;
  card1: VitalCardConfig;
  card2: VitalCardConfig;
  card3: VitalCardConfig;
  card4: VitalCardConfig;
  chartTitle: string;
  chartSubtitle: string;
  chartAvg: string;
  chartData: any[];
  aiAdvice: string;
}

interface ComputeTabConfigParams {
  selectedRange: TimeRange;
  weekData: {
    avgHR: string;
    avgSpO2: string;
    avgTemp: string;
    chart: any[];
  };
  isFallDetected: boolean;
  dayVitals: any[];
  closestVital: any;
  selectedDate: string;
  scrubberMinutes: number;
  dailyAvgHR: string;
  chartDataForDay: any[];
}

export function computeHealthTabConfig({
  selectedRange,
  weekData,
  isFallDetected,
  dayVitals,
  closestVital,
  selectedDate,
  scrubberMinutes,
  dailyAvgHR,
  chartDataForDay,
}: ComputeTabConfigParams): HealthTabConfigResult {
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
          status: weekData.avgSpO2 !== '--' ? 'Lý tưởng' : 'Chưa có dữ liệu',
          statusColor: weekData.avgSpO2 !== '--' ? '#15803D' : '#64748B',
          statusBg: weekData.avgSpO2 !== '--' ? '#DCFCE7' : '#F1F5F9',
          range: hasRangeData ? 'Chuẩn y tế: ≥ 95%' : 'Chưa ghi nhận',
          icon: 'water' as keyof typeof Ionicons.glyphMap,
          iconColor: '#0284C7',
          iconBg: '#E0F2FE',
        },
        card3: {
          label: 'Thân nhiệt TB tuần',
          value: weekData.avgTemp,
          unit: weekData.avgTemp !== '--' ? '°C' : '',
          status: weekData.avgTemp !== '--' ? 'Chuẩn' : 'Chưa có dữ liệu',
          statusColor: weekData.avgTemp !== '--' ? '#15803D' : '#64748B',
          statusBg: weekData.avgTemp !== '--' ? '#DCFCE7' : '#F1F5F9',
          range: hasRangeData ? 'Chuẩn y tế: 36.5 - 37.2°C' : 'Chưa ghi nhận',
          icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
          iconColor: '#D97706',
          iconBg: '#FEF3C7',
        },
        card4: {
          label: 'Trạng thái hoạt động tuần',
          value: hasRangeData ? 'Bình thường' : 'Chưa có dữ liệu',
          unit: '',
          status: hasRangeData ? 'Tốt' : 'Chưa có dữ liệu',
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
        bannerTitle: hasRangeData ? 'Tổng hợp sức khỏe 30 ngày' : 'Chưa có đủ dữ liệu tháng',
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
}


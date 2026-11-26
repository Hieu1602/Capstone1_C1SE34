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
    avgSteps?: string;
    avgTemp?: string;
    chart: any[];
  };
  isFallDetected: boolean;
  dayVitals: any[];
  closestVital: any;
  selectedDate: string;
  scrubberMinutes: number;
  dailyAvgHR: string;
  chartDataForDay: any[];
  dailySteps?: number | null;
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
  dailySteps,
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
          label: 'Bước chân TB tuần',
          value: (weekData.avgSteps && weekData.avgSteps !== '--') ? weekData.avgSteps : (closestVital?.steps ? `${closestVital.steps}` : '--'),
          unit: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? 'bước' : '',
          status: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? 'Duy trì tốt' : 'Chưa có dữ liệu',
          statusColor: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? '#15803D' : '#64748B',
          statusBg: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? '#DCFCE7' : '#F1F5F9',
          range: 'Mục tiêu: 3,000 - 5,000 bước/ngày',
          icon: 'footsteps' as keyof typeof Ionicons.glyphMap,
          iconColor: '#16A34A',
          iconBg: '#DCFCE7',
        },
        card4: {
          label: 'An toàn té ngã',
          value: isFallDetected ? 'Có cảnh báo' : hasRangeData ? 'An toàn' : 'Chưa có dữ liệu',
          unit: '',
          status: isFallDetected ? 'Cảnh báo' : hasRangeData ? 'Tốt' : 'Chưa có dữ liệu',
          statusColor: isFallDetected ? Colors.danger : '#15803D',
          statusBg: isFallDetected ? '#FEE2E2' : '#DCFCE7',
          range: isFallDetected ? 'Đã ghi nhận sự cố' : 'Không có sự cố ngã',
          icon: 'shield-checkmark' as keyof typeof Ionicons.glyphMap,
          iconColor: isFallDetected ? Colors.danger : '#0284C7',
          iconBg: isFallDetected ? '#FEE2E2' : '#E0F2FE',
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
          label: 'Bước chân TB tháng',
          value: (weekData.avgSteps && weekData.avgSteps !== '--') ? weekData.avgSteps : (closestVital?.steps ? `${closestVital.steps}` : '--'),
          unit: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? 'bước' : '',
          status: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? 'Duy trì tốt' : 'Chưa có dữ liệu',
          statusColor: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? '#15803D' : '#64748B',
          statusBg: ((weekData.avgSteps && weekData.avgSteps !== '--') || closestVital?.steps) ? '#DCFCE7' : '#F1F5F9',
          range: 'Mục tiêu: 3,000 - 5,000 bước/ngày',
          icon: 'footsteps' as keyof typeof Ionicons.glyphMap,
          iconColor: '#16A34A',
          iconBg: '#DCFCE7',
        },
        card4: {
          label: 'An toàn té ngã',
          value: isFallDetected ? 'Có cảnh báo' : hasRangeData ? 'An toàn' : 'Chưa có dữ liệu',
          unit: '',
          status: isFallDetected ? 'Cảnh báo' : hasRangeData ? 'Tối ưu' : 'Chưa có dữ liệu',
          statusColor: isFallDetected ? Colors.danger : hasRangeData ? '#15803D' : '#64748B',
          statusBg: isFallDetected ? '#FEE2E2' : hasRangeData ? '#DCFCE7' : '#F1F5F9',
          range: isFallDetected ? 'Đã ghi nhận sự cố' : hasRangeData ? 'Không có sự cố ngã' : 'Chưa ghi nhận',
          icon: 'shield-checkmark' as keyof typeof Ionicons.glyphMap,
          iconColor: isFallDetected ? Colors.danger : '#0284C7',
          iconBg: isFallDetected ? '#FEE2E2' : '#E0F2FE',
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
      const isToday = selectedDate === getTodayStr();
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const isFutureTime = isToday && scrubberMinutes > nowMinutes;

      // Chỉ lấy số liệu nếu có bản ghi thực tế closestVital trong phạm vi giờ tua
      const hrVal = closestVital ? String(closestVital.heart_rate ?? '--') : '--';
      const spo2Val = closestVital ? String(closestVital.spo2 ?? '--') : '--';
      const stepsVal = closestVital && typeof closestVital.steps === 'number' ? String(closestVital.steps) : '--';
      const actVal = closestVital
        ? (closestVital.activity_state || closestVital.activity || 'Sinh hoạt')
        : isFutureTime
          ? 'Chưa diễn ra'
          : hasData
            ? 'Không có số đo'
            : 'Chưa có dữ liệu';

      const vitalTime = closestVital?.recorded_at || closestVital?.time || closestVital?.created_at;
      const vitalHM = vitalTime ? (() => {
        const d = new Date(vitalTime);
        return !isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : formatTimeHM(scrubberMinutes);
      })() : formatTimeHM(scrubberMinutes);

      const statusNote = closestVital
        ? `Ghi nhận lúc ${vitalHM}`
        : isFutureTime
          ? 'Thời điểm tương lai'
          : hasData
            ? `Không có đo lúc ${formatTimeHM(scrubberMinutes)}`
            : 'Chưa ghi nhận';

      // Đánh giá chuyên sâu real-time theo dữ liệu sinh hiệu thực tế
      const numHR = closestVital && typeof closestVital.heart_rate === 'number' && closestVital.heart_rate > 0
        ? closestVital.heart_rate
        : (Number(hrVal) > 0 ? Number(hrVal) : null);
      const numSpO2 = closestVital && typeof closestVital.spo2 === 'number' && closestVital.spo2 > 0
        ? closestVital.spo2
        : (Number(spo2Val) > 0 ? Number(spo2Val) : null);

      let bannerTitle = 'Tình trạng sinh tồn bình thường';
      let bannerSubtitle = isToday
        ? 'Đang xem hôm nay - Vòng BLE Band & Hub AI hoạt động ổn định.'
        : `Đang xem ngày ${formatDisplayDateVN(selectedDate)} - Các chỉ số ổn định.`;
      let bannerIcon: keyof typeof Ionicons.glyphMap = 'checkmark-circle';
      let bannerAlert = false;
      let aiAdvice = '';

      if (isFallDetected || closestVital?.fall_detected) {
        bannerTitle = 'Cảnh báo: Phát hiện sự cố té ngã!';
        bannerSubtitle = 'Hệ thống AI vừa ghi nhận sự cố té ngã! Hãy kiểm tra clip và tới trợ giúp ngay.';
        bannerIcon = 'warning';
        bannerAlert = true;
        aiAdvice = '• CẢNH BÁO KHẨN CẤP: Hệ thống vừa ghi nhận sự cố té ngã của cụ! Cần kiểm tra ngay lập tức qua camera hoặc đến phòng của cụ.\n• Giữ cụ nằm yên nếu có chấn thương, kiểm tra mức độ tỉnh táo và liên hệ cấp cứu/bác sĩ phụ trách nếu cần thiết.';
      } else if (isFutureTime) {
        bannerTitle = 'Mốc thời gian tương lai (Chưa tới)';
        bannerSubtitle = `Hiện tại chưa đến ${formatTimeHM(scrubberMinutes)}. Hãy tua về trước ${formatTimeHM(nowMinutes)} để xem dữ liệu thực tế.`;
        bannerIcon = 'time-outline';
        bannerAlert = false;
        aiAdvice = `• Thời điểm ${formatTimeHM(scrubberMinutes)} chưa diễn ra.\n• Hãy kéo thanh tua thời gian về mốc hiện tại hoặc các giờ trước đó để xem phân tích dữ liệu thực tế từ Bác sĩ AI.`;
      } else if (!hasData) {
        bannerTitle = 'Chưa có dữ liệu đo cho ngày này';
        bannerSubtitle = `Ngày ${formatDisplayDateVN(selectedDate)} chưa ghi nhận mốc đo nào trong cơ sở dữ liệu.`;
        bannerIcon = 'information-circle';
        bannerAlert = false;
        aiAdvice = `• Ngày ${formatDisplayDateVN(selectedDate)} chưa có dữ liệu đo được đồng bộ.\n• Hãy kiểm tra vòng đeo tay BLE Band và kết nối Hub AI để tiếp tục thu thập dữ liệu sinh tồn cho cụ.`;
      } else if (!closestVital || hrVal === '--') {
        bannerTitle = `Không có số đo lúc ${formatTimeHM(scrubberMinutes)}`;
        bannerSubtitle = `Không có số đo trong khoảng ±90 phút quanh mốc này (thiết bị có thể đang sạc pin hoặc chưa đeo).`;
        bannerIcon = 'information-circle';
        bannerAlert = false;
        aiAdvice = `• Lúc ${formatTimeHM(scrubberMinutes)} không ghi nhận dữ liệu đo sinh tồn (thiết bị có thể đang sạc hoặc cụ chưa đeo vòng tay).\n• Hãy di chuyển thanh tua đến các mốc thời gian có số đo trên biểu đồ để xem lời khuyên y tế từ Bác sĩ AI.`;
      } else {
        const adviceLines: string[] = [];

        // 1. Phân tích nhịp tim real-time
        if (numHR !== null) {
          if (numHR >= 120) {
            bannerTitle = `Cảnh báo: Nhịp tim tăng cao (${numHR} bpm)!`;
            bannerSubtitle = `Mốc ${vitalHM}: Vượt ngưỡng an toàn 120 bpm (Nguy cơ nhịp tim nhanh).`;
            bannerIcon = 'warning';
            bannerAlert = true;
            adviceLines.push(`• CẢNH BÁO NHỊP TIM: Nhịp tim lúc ${vitalHM} tăng rất cao (${numHR} bpm), vượt xa ngưỡng an toàn tiêu chuẩn (60 - 100 bpm).`);
            adviceLines.push(`• HƯỚNG XỬ TRÍ: Nhắc cụ ngồi hoặc nằm nghỉ ngơi ngay tại chỗ, ngừng hoàn toàn đi lại/vận động mạnh, nới lỏng cổ áo và hít thở sâu, đều đặn.`);
            adviceLines.push(`• Uống từng ngụm nước ấm nhỏ. Nếu nhịp tim tiếp tục duy trì trên 120 bpm kéo dài quá 15 phút hoặc cụ có dấu hiệu tức ngực, khó thở, hãy nhấn "Gọi bác sĩ" ngay lập tức.`);
          } else if (numHR >= 100) {
            bannerTitle = `Chú ý: Nhịp tim hơi nhanh (${numHR} bpm)`;
            bannerSubtitle = `Mốc ${vitalHM}: Cao hơn mức bình thường của người cao tuổi.`;
            bannerIcon = 'alert-circle';
            bannerAlert = true;
            adviceLines.push(`• ĐÁNH GIÁ NHỊP TIM: Nhịp tim ghi nhận ${numHR} bpm tại thời điểm ${vitalHM}, đang cao hơn ngưỡng chuẩn sinh lý (60 - 95 bpm).`);
            adviceLines.push(`• Nhắc cụ ngồi nghỉ ngơi thư giãn ở không gian thoáng mát, tránh đi lại hay làm việc nhà, giữ tâm lý thoải mái.`);
            adviceLines.push(`• Tiếp tục theo dõi nhịp tim trên ứng dụng sau 10-15 phút để đảm bảo chỉ số hạ dần về mức bình thường.`);
          } else if (numHR < 50) {
            bannerTitle = `Cảnh báo: Nhịp tim tụt quá thấp (${numHR} bpm)!`;
            bannerSubtitle = `Mốc ${vitalHM}: Dưới 50 bpm. Nguy cơ nhịp tim chậm nguy hiểm.`;
            bannerIcon = 'warning';
            bannerAlert = true;
            adviceLines.push(`• CẢNH BÁO NGUY HIỂM: Nhịp tim của cụ chỉ đạt ${numHR} bpm lúc ${vitalHM}, dưới ngưỡng an toàn tối thiểu (50 bpm).`);
            adviceLines.push(`• Hãy kiểm tra ngay xem cụ có bị hoa mắt, chóng mặt, mệt lả hay lạnh đầu chi không.`);
            adviceLines.push(`• Cho cụ nằm nghỉ với tư thế nâng cao chân nhẹ nhàng, giữ ấm cơ thể và liên hệ ngay bác sĩ điều trị.`);
          } else if (numHR < 60) {
            bannerTitle = `Chú ý: Nhịp tim hơi chậm (${numHR} bpm)`;
            bannerSubtitle = `Mốc ${vitalHM}: Hơi thấp hơn mức tiêu chuẩn 60 bpm.`;
            bannerIcon = 'information-circle';
            adviceLines.push(`• Nhịp tim ghi nhận ${numHR} bpm lúc ${vitalHM}, hơi thấp hơn mức tiêu chuẩn 60 bpm.`);
            adviceLines.push(`• Nếu cụ đang ngủ hoặc nghỉ ngơi sâu thì đây là phản xạ sinh lý bình thường. Nếu cụ đang thức mà cảm thấy mệt, hãy cho cụ uống một ly nước ấm.`);
          } else {
            adviceLines.push(`• Nhịp tim của cụ lúc ${vitalHM} đạt ${numHR} bpm, duy trì rất tốt trong ngưỡng chuẩn an toàn (60 - 95 bpm).`);
          }
        }

        // 2. Phân tích nồng độ oxy SpO2 real-time
        if (numSpO2 !== null) {
          if (numSpO2 < 90) {
            bannerTitle = `Nguy cấp: Nồng độ Oxy SpO₂ tụt sâu (${numSpO2}%)!`;
            bannerSubtitle = `Mốc ${vitalHM}: Thiếu oxy máu nặng (dưới 90%).`;
            bannerIcon = 'warning';
            bannerAlert = true;
            adviceLines.push(`• NGUY CẤP: Nồng độ SpO₂ tụt xuống mức ${numSpO2}%, cơ thể cụ đang thiếu oxy nghiêm trọng!`);
            adviceLines.push(`• Đỡ cụ ngồi thẳng tựa lưng, mở cửa sổ phòng cho thoáng khí, nhắc cụ hít thở chậm và sâu.`);
            adviceLines.push(`• Chuẩn bị thiết bị hỗ trợ thở (nếu có) và liên hệ cơ sở y tế/bác sĩ phụ trách ngay.`);
          } else if (numSpO2 < 95) {
            if (!bannerAlert) {
              bannerTitle = `Chú ý: Nồng độ Oxy SpO₂ hơi thấp (${numSpO2}%)`;
              bannerSubtitle = `Mốc ${vitalHM}: Thấp hơn ngưỡng chuẩn y tế ≥ 95%.`;
              bannerIcon = 'alert-circle';
              bannerAlert = true;
            }
            adviceLines.push(`• Nồng độ oxy SpO₂ ghi nhận ${numSpO2}% lúc ${vitalHM}, hơi thấp hơn mức tối ưu.`);
            adviceLines.push(`• Nhắc cụ ngồi tựa lưng thoải mái, hít sâu thở chậm và kiểm tra lại vòng tay xem đã đeo áp sát cổ tay chưa.`);
          } else {
            adviceLines.push(`• Nồng độ oxy trong máu SpO₂ đạt ${numSpO2}%, phản ánh hệ hô hấp hoạt động tốt.`);
          }
        }

        // 3. Phân tích vận động & bước chân
        if (closestVital && typeof closestVital.steps === 'number' && closestVital.steps > 0) {
          adviceLines.push(`• Vận động trong ngày: Đã ghi nhận ${closestVital.steps.toLocaleString()} bước chân từ vòng đeo tay.`);
        }

        // Lời khuyên vận động chỉ khi sinh hiệu an toàn
        if (!bannerAlert) {
          adviceLines.push(`• Nhắc cụ tiếp tục uống đủ nước (khoảng 1.5 - 2 lít/ngày) và duy trì vận động nhẹ nhàng quanh phòng khách.`);
        }

        aiAdvice = adviceLines.join('\n');
      }

      return {
        bannerTitle,
        bannerSubtitle,
        bannerIcon,
        bannerAlert,
        card1: {
          label: 'Nhịp tim',
          value: hrVal,
          unit: hrVal !== '--' ? 'bpm' : '',
          status: !closestVital || hrVal === '--' ? (isFutureTime ? 'Chưa tới' : 'Chưa có dữ liệu') : Number(hrVal) >= 120 ? 'Nguy hiểm' : Number(hrVal) > 100 ? 'Cao' : Number(hrVal) < 60 ? 'Thấp' : 'Bình thường',
          statusColor: !closestVital || hrVal === '--' ? '#64748B' : Number(hrVal) > 100 ? Colors.danger : '#15803D',
          statusBg: !closestVital || hrVal === '--' ? '#F1F5F9' : Number(hrVal) > 100 ? '#FEE2E2' : '#DCFCE7',
          range: hasData ? 'Ngưỡng an toàn: 60 - 95 bpm' : 'Chưa ghi nhận',
          icon: 'heart' as keyof typeof Ionicons.glyphMap,
          iconColor: '#EF4444',
          iconBg: '#FEE2E2',
        },
        card2: {
          label: 'Nồng độ Oxy (SpO₂)',
          value: spo2Val,
          unit: spo2Val !== '--' ? '%' : '',
          status: !closestVital || spo2Val === '--' ? (isFutureTime ? 'Chưa tới' : 'Chưa có dữ liệu') : Number(spo2Val) < 90 ? 'Nguy cấp' : Number(spo2Val) < 95 ? 'Cần theo dõi' : 'Bình thường / An toàn',
          statusColor: !closestVital || spo2Val === '--' ? '#64748B' : Number(spo2Val) < 95 ? '#D97706' : '#15803D',
          statusBg: !closestVital || spo2Val === '--' ? '#F1F5F9' : Number(spo2Val) < 95 ? '#FEF3C7' : '#DCFCE7',
          range: hasData ? 'Ngưỡng an toàn: ≥ 95%' : 'Chưa ghi nhận',
          icon: 'water' as keyof typeof Ionicons.glyphMap,
          iconColor: '#0284C7',
          iconBg: '#E0F2FE',
        },
        card3: (() => {
          const dayStepsVal = typeof dailySteps === 'number' ? String(dailySteps) : stepsVal;
          const hasDaySteps = dayStepsVal !== '--';
          return {
            label: 'Bước chân trong ngày',
            value: dayStepsVal,
            unit: hasDaySteps ? 'bước' : '',
            status: !hasDaySteps ? (isFutureTime ? 'Chưa tới' : 'Chưa có dữ liệu') : Number(dayStepsVal) >= 3000 ? 'Đạt mục tiêu' : 'Tích cực',
            statusColor: !hasDaySteps ? '#64748B' : '#15803D',
            statusBg: !hasDaySteps ? '#F1F5F9' : '#DCFCE7',
            range: hasData || hasDaySteps ? 'Mục tiêu: 3,000 - 5,000 bước/ngày' : 'Chưa ghi nhận',
            icon: 'footsteps' as keyof typeof Ionicons.glyphMap,
            iconColor: '#16A34A',
            iconBg: '#DCFCE7',
          };
        })(),
        card4: {
          label: 'Tư thế & An toàn',
          value: actVal,
          unit: '',
          status: !closestVital ? (isFutureTime ? 'Chưa tới' : 'Không có đo') : isFallDetected ? 'Cảnh báo' : 'An toàn',
          statusColor: !closestVital ? '#64748B' : isFallDetected ? Colors.danger : '#15803D',
          statusBg: !closestVital ? '#F1F5F9' : isFallDetected ? '#FEE2E2' : '#DCFCE7',
          range: statusNote,
          icon: isFallDetected ? 'warning' : 'body',
          iconColor: isFallDetected ? Colors.danger : '#0284C7',
          iconBg: isFallDetected ? '#FEE2E2' : '#E0F2FE',
        },
        chartTitle: `Dao động nhịp tim ngày ${formatDisplayDateVN(selectedDate)}`,
        chartSubtitle: hasData ? '' : 'Chưa có dữ liệu đo cho ngày này',
        chartAvg: hasData ? `Trung bình: ${dailyAvgHR}` : 'N/A',
        chartData: chartDataForDay,
        aiAdvice,
      };
    }
  }
}


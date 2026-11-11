// alertConfig.ts
// Cấu hình nhãn, màu sắc, biểu tượng, đánh giá mức độ và bóc tách dữ liệu lâm sàng cho các loại thông báo / cảnh báo

import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../theme/colors';

export interface AlertConfig {
  title: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  isCritical: boolean;
}

export const ALERT_CONFIG_MAP: Record<string, AlertConfig> = {
  LOW_BATTERY: {
    title: 'Pin vòng đeo tay yếu (≤ 20%)',
    badgeText: 'Pin yếu',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
    iconName: 'battery-half',
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
    isCritical: false,
  },
  DEVICE_BATTERY_DEAD: {
    title: 'Vòng đeo tay đã hết pin (0%)',
    badgeText: 'Hết pin',
    badgeBg: '#FEE2E2',
    badgeColor: '#DC2626',
    iconName: 'battery-dead',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: true,
  },
  FALL_DETECTED: {
    title: 'CẢNH BÁO TÉ NGÃ KHẨN CẤP',
    badgeText: 'CỰC KỲ NGUY HIỂM',
    badgeBg: '#EF4444',
    badgeColor: '#FFFFFF',
    iconName: 'warning',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: true,
  },
  HIGH_HEART_RATE: {
    title: 'Nhịp tim tăng cao bất thường',
    badgeText: 'Cảnh báo tim',
    badgeBg: '#FFF7ED',
    badgeColor: '#EA580C',
    iconName: 'heart',
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
    isCritical: false,
  },
  ACOUSTIC_DISTRESS: {
    title: 'Phát hiện âm thanh kêu cứu',
    badgeText: 'Âm thanh YAMNet',
    badgeBg: '#F3E8FF',
    badgeColor: '#7C3AED',
    iconName: 'mic',
    iconColor: '#9333EA',
    iconBg: '#F3E8FF',
    isCritical: true,
  },
  PERSON_DETECTED: {
    title: 'Phát hiện chuyển động người',
    badgeText: 'Chuyển động',
    badgeBg: '#ECFDF5',
    badgeColor: '#059669',
    iconName: 'person',
    iconColor: '#10B981',
    iconBg: '#DCFCE7',
    isCritical: false,
  },
  APPOINTMENT_SCHEDULED: {
    title: 'Lịch khám mới từ Bác sĩ',
    badgeText: 'Chờ gia đình xác nhận',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
    iconName: 'calendar',
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
    isCritical: false,
  },
  APPOINTMENT_REQUESTED: {
    title: 'Yêu cầu lịch khám từ Gia đình',
    badgeText: 'Chờ Bác sĩ xác nhận',
    badgeBg: '#EFF6FF',
    badgeColor: '#2563EB',
    iconName: 'calendar',
    iconColor: '#2563EB',
    iconBg: '#DBEAFE',
    isCritical: false,
  },
  APPOINTMENT_CONFIRMED: {
    title: 'Lịch khám đã được xác nhận',
    badgeText: 'Đã xác nhận',
    badgeBg: '#DCFCE7',
    badgeColor: '#16A34A',
    iconName: 'checkmark-circle',
    iconColor: '#16A34A',
    iconBg: '#DCFCE7',
    isCritical: false,
  },
  APPOINTMENT_CANCELLED: {
    title: 'Lịch khám đã bị hủy',
    badgeText: 'Đã hủy',
    badgeBg: '#FEE2E2',
    badgeColor: '#DC2626',
    iconName: 'close-circle',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: false,
  },
  HOUSE_MEMBER_ADDED: {
    title: 'Đã được thêm vào căn nhà',
    badgeText: 'Thành viên mới',
    badgeBg: '#EFF6FF',
    badgeColor: '#2563EB',
    iconName: 'home',
    iconColor: '#2563EB',
    iconBg: '#DBEAFE',
    isCritical: false,
  },
  MEMBER_ADDED: {
    title: 'Thành viên mới gia nhập',
    badgeText: 'Thành viên mới',
    badgeBg: '#EFF6FF',
    badgeColor: '#2563EB',
    iconName: 'home',
    iconColor: '#2563EB',
    iconBg: '#DBEAFE',
    isCritical: false,
  },
  HOUSE_INVITE_PENDING: {
    title: 'Lời mời tham gia nhà',
    badgeText: 'Chờ bạn xác nhận',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
    iconName: 'mail-unread',
    iconColor: '#D97706',
    iconBg: '#FEF3C7',
    isCritical: false,
  },
  HOUSE_JOIN_REQUEST: {
    title: 'Yêu cầu vào nhà mới',
    badgeText: 'Cần duyệt',
    badgeBg: '#EFF6FF',
    badgeColor: '#2563EB',
    iconName: 'person-add',
    iconColor: '#2563EB',
    iconBg: '#DBEAFE',
    isCritical: false,
  },
  HOUSE_JOIN_APPROVED: {
    title: 'Đã duyệt vào nhà',
    badgeText: 'Đã duyệt',
    badgeBg: '#DCFCE7',
    badgeColor: '#16A34A',
    iconName: 'checkmark-circle',
    iconColor: '#16A34A',
    iconBg: '#DCFCE7',
    isCritical: false,
  },
  HOUSE_JOIN_REJECTED: {
    title: 'Yêu cầu vào nhà bị từ chối',
    badgeText: 'Từ chối',
    badgeBg: '#FEE2E2',
    badgeColor: '#DC2626',
    iconName: 'close-circle',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: false,
  },
  HOUSE_INVITE_REJECTED: {
    title: 'Lời mời vào nhà bị từ chối',
    badgeText: 'Từ chối',
    badgeBg: '#FEE2E2',
    badgeColor: '#DC2626',
    iconName: 'close-circle',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: false,
  },
  CRITICAL_TRIAD: {
    title: 'BÁO ĐỘNG ĐỎ: Tam chứng nguy kịch',
    badgeText: 'CỰC KỲ NGUY CẤP',
    badgeBg: '#EF4444',
    badgeColor: '#FFFFFF',
    iconName: 'alert-circle',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: true,
  },
  EXERTION_HYPOXIA: {
    title: 'Thiếu oxy gắng sức (Quá tải tim phổi)',
    badgeText: 'Cảnh báo hô hấp',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
    iconName: 'pulse',
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
    isCritical: false,
  },
  FEVER_TACHYCARDIA: {
    title: 'Sốt cao kèm nhịp tim nhanh',
    badgeText: 'Cảnh báo sốt tim',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
    iconName: 'thermometer',
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
    isCritical: false,
  },
  CARDIO_COLLAPSE: {
    title: 'Nguy cơ trụy tim mạch cấp',
    badgeText: 'CỰC KỲ NGUY HIỂM',
    badgeBg: '#EF4444',
    badgeColor: '#FFFFFF',
    iconName: 'heart-dislike',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: true,
  },
  LOW_SPO2: {
    title: 'Nồng độ Oxy trong máu giảm thấp',
    badgeText: 'Tụt SpO2',
    badgeBg: '#FEE2E2',
    badgeColor: '#DC2626',
    iconName: 'water',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: true,
  },
  BRADYCARDIA: {
    title: 'Nhịp tim chậm nguy hiểm (< 50 bpm)',
    badgeText: 'Nhịp tim chậm',
    badgeBg: '#FEE2E2',
    badgeColor: '#DC2626',
    iconName: 'heart-half',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: true,
  },
  HIGH_FEVER: {
    title: 'Thân nhiệt sốt cao bất thường',
    badgeText: 'Sốt cao',
    badgeBg: '#FEE2E2',
    badgeColor: '#DC2626',
    iconName: 'thermometer',
    iconColor: '#DC2626',
    iconBg: '#FEE2E2',
    isCritical: false,
  },
};

export interface AlertAssessment {
  severityLabel: string;
  severityColor: string;
  severityBg: string;
  metrics: { label: string; value: string; icon: string; status: 'danger' | 'warning' | 'normal' }[];
  rootCause: string;
  doctorAdvice: string;
}

export function analyzeAlertDetails(item: any): AlertAssessment {
  if (!item) {
    return {
      severityLabel: 'Thông tin',
      severityColor: '#2563EB',
      severityBg: '#EFF6FF',
      metrics: [],
      rootCause: 'Không có dữ liệu',
      doctorAdvice: 'Kiểm tra trạng thái thiết bị',
    };
  }

  const type = item.alert_type || '';
  const msg = item.message || '';
  const level = item.alert_level || 'MEDIUM';

  // 1. Phân loại mức độ
  let severityLabel = 'Theo dõi thường quy';
  let severityColor = '#2563EB';
  let severityBg = '#EFF6FF';

  if (level === 'CRITICAL' || type === 'FALL_DETECTED' || type === 'CRITICAL_TRIAD' || type === 'CARDIO_COLLAPSE') {
    severityLabel = 'Khẩn cấp - Cực kỳ nguy hiểm';
    severityColor = '#DC2626';
    severityBg = '#FEE2E2';
  } else if (level === 'HIGH' || type === 'HIGH_HEART_RATE' || type === 'LOW_SPO2' || type === 'ACOUSTIC_DISTRESS') {
    severityLabel = 'Cảnh báo mức độ cao';
    severityColor = '#EA580C';
    severityBg = '#FFF7ED';
  } else if (level === 'MEDIUM' || type === 'LOW_BATTERY') {
    severityLabel = 'Lưu ý cần kiểm tra';
    severityColor = '#D97706';
    severityBg = '#FEF3C7';
  }

  // 2. Trích xuất chỉ số sinh tồn từ message / item
  const hrMatch = msg.match(/(\d{2,3})\s*(?:bpm|nhịp\/phút)/i);
  const spo2Match = msg.match(/(\d{2,3})\s*%(?:\s*(?:SpO2|oxy))?/i);
  const tempMatch = msg.match(/(\d{2}(?:\.\d)?)\s*°?C/i);

  const metrics: { label: string; value: string; icon: string; status: 'danger' | 'warning' | 'normal' }[] = [];

  if (hrMatch) {
    const hrVal = parseInt(hrMatch[1], 10);
    metrics.push({
      label: 'Nhịp tim',
      value: `${hrVal} bpm`,
      icon: 'heart',
      status: hrVal >= 120 || hrVal < 50 ? 'danger' : hrVal > 100 ? 'warning' : 'normal',
    });
  }

  if (spo2Match) {
    const spo2Val = parseInt(spo2Match[1], 10);
    metrics.push({
      label: 'Oxy SpO2',
      value: `${spo2Val}%`,
      icon: 'water',
      status: spo2Val < 90 ? 'danger' : spo2Val < 95 ? 'warning' : 'normal',
    });
  }

  if (tempMatch) {
    const tempVal = parseFloat(tempMatch[1]);
    metrics.push({
      label: 'Thân nhiệt',
      value: `${tempVal}°C`,
      icon: 'thermometer',
      status: tempVal >= 38.5 ? 'danger' : tempVal >= 37.5 ? 'warning' : 'normal',
    });
  }

  if (type === 'FALL_DETECTED') {
    metrics.push({
      label: 'Gia tốc kế',
      value: 'Va đập mạnh',
      icon: 'warning',
      status: 'danger',
    });
  } else if (type === 'ACOUSTIC_DISTRESS') {
    metrics.push({
      label: 'AI YAMNet',
      value: 'Tiếng kêu cứu',
      icon: 'mic',
      status: 'danger',
    });
  } else if (type === 'LOW_BATTERY' || type === 'DEVICE_BATTERY_DEAD') {
    metrics.push({
      label: 'Pin đồng hồ',
      value: type === 'DEVICE_BATTERY_DEAD' ? '0% (Hết pin)' : '≤ 20% (Yếu)',
      icon: 'battery-dead',
      status: 'warning',
    });
  }

  // 3. Đánh giá nguyên nhân & Hướng dẫn bác sĩ AI
  let rootCause = 'Hệ thống nhận diện chỉ số hoặc sự kiện vượt ngưỡng sinh lý an toàn thiết lập.';
  let doctorAdvice = 'Liên hệ với người cao tuổi hoặc đến kiểm tra trực tiếp để đảm bảo an toàn.';

  if (type === 'CRITICAL_TRIAD') {
    rootCause = 'Hội chứng tam chứng nguy kịch: Thân nhiệt sốt cao kết hợp nhịp tim nhanh và độ bão hòa oxy máu SpO2 tụt thấp dưới 90%. Đây là dấu hiệu nghi ngờ nhiễm trùng cấp hoặc suy hô hấp tuần hoàn cấp.';
    doctorAdvice = 'GỌI CẤP CỨU 115 NGAY LẬP TỨC. Cho cụ nằm đầu cao 30-45 độ, nới rộng khuy áo, cho thở oxy nếu có sẵn tại nhà và chườm khăn ấm vào trán/nách/bẹn.';
  } else if (type === 'HIGH_HEART_RATE' || type === 'TACHYCARDIA') {
    rootCause = 'Nhịp tim đo được vượt ngưỡng bình thường (> 120 bpm) trong lúc người cao tuổi không vận động thể lực. Nguyên nhân có thể do sốt, lo âu căng thẳng, mất nước hoặc rối loạn dẫn truyền tim.';
    doctorAdvice = 'Cho cụ ngồi nghỉ tĩnh tại nơi thoáng khí, uống một ly nước ấm từng ngụm nhỏ, hướng dẫn hít thở sâu chậm. Nếu nhịp tim không giảm sau 15 phút, liên hệ bác sĩ tim mạch.';
  } else if (type === 'BRADYCARDIA') {
    rootCause = 'Nhịp tim giảm xuống dưới 50 bpm, làm giảm cung lượng tim và lưu lượng máu lên não. Nguy cơ choáng váng, ngất xỉu hoặc ngừng tim.';
    doctorAdvice = 'Đỡ cụ nằm nghỉ trên giường, kê cao chân nhẹ nhàng. Hỏi thăm tri giác, nếu cụ lơ mơ, khó thở hoặc tái nhợt thì cần gọi hỗ trợ y tế khẩn cấp.';
  } else if (type === 'LOW_SPO2' || type === 'HYPOXIA') {
    rootCause = 'Nồng độ oxy trong máu SpO2 dưới ngưỡng 90%. Thường do tắc nghẽn đường thở, co thắt phế quản, viêm phổi hoặc suy giảm thông khí.';
    doctorAdvice = 'Đỡ cụ ngồi thẳng lưng, kiểm tra đường thở xem có đờm nhớt hoặc dị vật không. Mở cửa sổ đón không khí sạch, cho thở oxy lưu lượng 2-3 lít/phút nếu có chỉ định.';
  } else if (type === 'EXERTION_HYPOXIA') {
    rootCause = 'Hiện tượng thiếu oxy khi gắng sức: Tim đập nhanh gắng sức (>100 bpm) kèm SpO2 giảm nhanh (<92%), chứng tỏ tim phổi không đáp ứng kịp nhu cầu oxy.';
    doctorAdvice = 'Yêu cầu cụ dừng ngay mọi hoạt động vận động, ngồi nghỉ ngơi có điểm tựa vững chắc, hít thở đều qua mũi và thở ra từ từ qua miệng.';
  } else if (type === 'FEVER_TACHYCARDIA') {
    rootCause = 'Thân nhiệt sốt kích ứng làm tăng tần số nhịp tim sinh lý. Cứ mỗi độ C tăng thêm, tim thường đập nhanh hơn 8-10 nhịp/phút.';
    doctorAdvice = 'Cho cụ uống nhiều nước (nước lọc, oresol hoặc nước cam), chườm ấm các vị trí mạch lớn, dùng thuốc hạ sốt theo chỉ định của bác sĩ gia đình.';
  } else if (type === 'CARDIO_COLLAPSE') {
    rootCause = 'Tụt nhịp tim kết hợp tụt oxy máu: Cảnh báo suy tuần hoàn hoặc trụy tim mạch nghiêm trọng.';
    doctorAdvice = 'CỰC KỲ KHẨN CẤP: Gọi xe cấp cứu 115 ngay. Kiểm tra mạch cảnh và nhịp thở của cụ. Sẵn sàng ép tim ngoài lồng ngực nếu cụ bất tỉnh mất mạch.';
  } else if (type === 'FALL_DETECTED') {
    rootCause = 'Cảm biến gia tốc vòng đeo tay ghi nhận gia tốc rơi tự do và lực va chạm mặt sàn đột ngột, theo sau bởi trạng thái bất động.';
    doctorAdvice = 'Đến kiểm tra ngay tại vị trí cụ ngã! Không vội vàng xốc nách đỡ cụ đứng dậy ngay nếu nghi ngờ gãy xương đùi hoặc chấn thương cổ/lưng.';
  } else if (type === 'ACOUSTIC_DISTRESS') {
    rootCause = 'Mô hình AI YAMNet phân tích và nhận diện tín hiệu âm thanh có tần số tương ứng tiếng kêu cứu, la hét hoặc rên rỉ đau đớn.';
    doctorAdvice = 'Bật camera giám sát ngay lập tức hoặc gọi điện thoại trực tiếp cho cụ hoặc người nhà ở gần để xác minh tình huống khẩn cấp.';
  } else if (type === 'LOW_BATTERY' || type === 'DEVICE_BATTERY_DEAD') {
    rootCause = 'Vòng đeo tay BLE thông minh sắp hoặc đã cạn kiệt dung lượng pin, có nguy cơ làm gián đoạn theo dõi sinh tồn liên tục.';
    doctorAdvice = 'Cắm sạc ngay cho vòng đeo tay để không bỏ sót các biến cố sức khỏe của cụ già.';
  }

  return {
    severityLabel,
    severityColor,
    severityBg,
    metrics,
    rootCause,
    doctorAdvice,
  };
}

export function getAlertConfig(alertType: string, notes?: string, message?: string): AlertConfig {
  if (
    alertType === 'APPOINTMENT_REQUESTED' ||
    (alertType === 'APPOINTMENT_SCHEDULED' &&
      (notes?.includes('APPOINTMENT_REQUESTED') || message?.includes('đã đặt lịch khám')))
  ) {
    return ALERT_CONFIG_MAP.APPOINTMENT_REQUESTED;
  }

  return (
    ALERT_CONFIG_MAP[alertType] || {
      title: alertType.replace(/_/g, ' '),
      badgeText: 'Thông báo',
      badgeBg: '#F1F5F9',
      badgeColor: '#64748B',
      iconName: 'notifications',
      iconColor: Colors.primary,
      iconBg: '#FFF4EC',
      isCritical: false,
    }
  );
}

export function formatFriendlyTime(dateStr: string, translate: (key: string, count?: number) => string) {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs <= 60 * 1000) return translate('Vừa xong');
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return translate('{{count}} phút trước', diffMin);
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return translate('{{count}} giờ trước', diffHour);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return translate('Hôm qua');
    if (diffDay < 7) return translate('{{count}} ngày trước', diffDay);

    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} • ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  } catch {
    return dateStr;
  }
}

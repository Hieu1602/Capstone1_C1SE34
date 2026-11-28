// Thống kê cảnh báo y tế theo ngày/tuần cho DoctorAlertsAreaChart (dùng chung Dashboard & hồ sơ bệnh nhân)
import { useMemo, useState } from 'react';
import type { AlertDayStat } from '../components/dashboard/DoctorAlertsAreaChart';

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function classifyAlertCategory(
  alertType?: string
): 'fall' | 'heart_alert' | 'spo2_alert' | 'sos_alert' | null {
  const type = (alertType || '').toUpperCase();
  if (!type) return null;
  if (
    type.startsWith('APPOINTMENT_') ||
    type.startsWith('HOUSE_INVITE') ||
    type.startsWith('PRESCRIPTION_') ||
    type.startsWith('MEDICAL_RECORD_') ||
    type.startsWith('DEVICE_') ||
    type.startsWith('BATTERY_') ||
    type.startsWith('CHARGER_') ||
    type === 'DOCTOR_ASSIGNED' ||
    type === 'INVITATION' ||
    type === 'BLE_DISCONNECTED' ||
    type === 'SENSOR_OFFLINE'
  ) {
    return null;
  }
  if (type.includes('FALL') || type.includes('TE_NGA')) return 'fall';
  if (type.includes('SOS') || type.includes('EMERGENCY_BUTTON')) return 'sos_alert';
  if (type.includes('SPO2') || type.includes('OXY') || type.includes('HYPOXIA')) return 'spo2_alert';
  if (
    type.includes('HEART') ||
    type.includes('NHIP_TIM') ||
    type.includes('_HR_') ||
    type.startsWith('HR_') ||
    type.includes('ARRHYTHMIA') ||
    type.includes('TACHYCARDIA') ||
    type.includes('BRADYCARDIA') ||
    type.includes('CARDIO')
  ) {
    return 'heart_alert';
  }
  return null;
}

export function computeAlertStats(incidents: any[], range: '7D' | '30D', anchorDate: Date): AlertDayStat[] {
  if (range === '30D') {
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();

    const weeks: AlertDayStat[] = [
      { label: 'Tuần 1', fullLabel: `Tuần 1 (01 - 07/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 2', fullLabel: `Tuần 2 (08 - 14/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 3', fullLabel: `Tuần 3 (15 - 21/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
      { label: 'Tuần 4', fullLabel: `Tuần 4 (22 - ${lastDay}/${m + 1})`, fall: 0, heart_alert: 0, spo2_alert: 0, sos_alert: 0, total: 0 },
    ];

    for (const inc of incidents || []) {
      const d = inc.created_at ? new Date(inc.created_at) : null;
      if (!d || isNaN(d.getTime())) continue;
      if (d.getFullYear() === y && d.getMonth() === m) {
        const category = classifyAlertCategory(inc.alert_type);
        if (!category) continue;
        const dayNum = d.getDate();
        const targetWeek = dayNum <= 7 ? 0 : dayNum <= 14 ? 1 : dayNum <= 21 ? 2 : 3;
        weeks[targetWeek][category]++;
        weeks[targetWeek].total++;
      }
    }

    return weeks;
  }

  // 7D: Tuần cụ thể (Thứ Hai -> Chủ Nhật)
  const monday = getMonday(anchorDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const fullNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
  const days: AlertDayStat[] = dayLabels.map((lbl, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      label: lbl,
      fullLabel: `${fullNames[idx]} (${dateFormatted})`,
      fall: 0,
      heart_alert: 0,
      spo2_alert: 0,
      sos_alert: 0,
      total: 0,
    };
  });

  for (const inc of incidents || []) {
    const d = inc.created_at ? new Date(inc.created_at) : null;
    if (!d || isNaN(d.getTime())) continue;
    if (d.getTime() >= monday.getTime() && d.getTime() <= sunday.getTime()) {
      const category = classifyAlertCategory(inc.alert_type);
      if (!category) continue;
      const dayOfWeek = d.getDay(); // 0 is CN, 1 is T2
      const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      days[dayIdx][category]++;
      days[dayIdx].total++;
    }
  }

  return days;
}

/** State điều hướng Tuần/Tháng cho biểu đồ cảnh báo (dùng chung Dashboard & hồ sơ bệnh nhân). */
export function useAlertChartPeriod() {
  const [chartRange, setChartRange] = useState<'7D' | '30D'>('7D');
  const [chartAnchorDate, setChartAnchorDate] = useState<Date>(() => new Date());

  const now = new Date();
  const currentMonday = getMonday(now);
  const selectedMonday = getMonday(chartAnchorDate);
  const selectedSunday = new Date(selectedMonday);
  selectedSunday.setDate(selectedMonday.getDate() + 6);

  const isCurrentWeek = selectedMonday.getTime() >= currentMonday.getTime();
  const isCurrentMonth =
    chartAnchorDate.getFullYear() === now.getFullYear() &&
    chartAnchorDate.getMonth() >= now.getMonth();

  const periodLabel = useMemo(() => {
    if (chartRange === '7D') {
      const startStr = `${String(selectedMonday.getDate()).padStart(2, '0')}/${String(selectedMonday.getMonth() + 1).padStart(2, '0')}`;
      const endStr = `${String(selectedSunday.getDate()).padStart(2, '0')}/${String(selectedSunday.getMonth() + 1).padStart(2, '0')}`;
      return `${startStr} - ${endStr}`;
    }
    return `Tháng ${chartAnchorDate.getMonth() + 1}/${chartAnchorDate.getFullYear()}`;
  }, [chartRange, selectedMonday, selectedSunday, chartAnchorDate]);

  const isNextDisabled = chartRange === '7D' ? isCurrentWeek : isCurrentMonth;
  const isCurrentPeriod = chartRange === '7D' ? isCurrentWeek : isCurrentMonth;

  const handlePrevChart = () => {
    setChartAnchorDate((prev) => {
      const d = new Date(prev);
      if (chartRange === '7D') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNextChart = () => {
    if (isNextDisabled) return;
    setChartAnchorDate((prev) => {
      const d = new Date(prev);
      if (chartRange === '7D') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleResetCurrentChart = () => {
    setChartAnchorDate(new Date());
  };

  const handleMonthSelect = (mStr: string) => {
    const [y, m] = mStr.split('-').map(Number);
    const nowDate = new Date();
    if (y === nowDate.getFullYear() && m - 1 === nowDate.getMonth()) {
      setChartAnchorDate(nowDate);
    } else {
      setChartAnchorDate(new Date(y, m - 1, 1));
    }
  };

  const selectedMonthStr = `${chartAnchorDate.getFullYear()}-${String(chartAnchorDate.getMonth() + 1).padStart(2, '0')}`;

  return {
    chartRange,
    setChartRange,
    chartAnchorDate,
    periodLabel,
    handlePrevChart,
    handleNextChart,
    isNextDisabled,
    handleResetCurrentChart,
    isCurrentPeriod,
    selectedMonthStr,
    handleMonthSelect,
  };
}

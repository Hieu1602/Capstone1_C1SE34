// src/utils/dateFilter.ts
// Bộ trợ giúp lọc và điều hướng ngày, tuần, tháng cho Đồ thị Sinh hiệu Bác sĩ

export type VitalRangeMode = 'DAY' | 'WEEK' | 'MONTH';

export interface VitalFilterState {
  mode: VitalRangeMode;
  selectedDate: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  titleOverride?: string;
  days?: number;
}

export const getTodayYMD = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseYMD = (s: string): Date => {
  const parts = s.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

export const formatYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDMY = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
};

export const formatDM = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}`;
};

export function computeVitalFilter(
  mode: VitalRangeMode,
  anchorDateStr: string
): VitalFilterState {
  const todayStr = getTodayYMD();
  let anchor = parseYMD(anchorDateStr);
  const today = parseYMD(todayStr);

  // Không cho chọn ngày trong tương lai
  if (anchor.getTime() > today.getTime()) {
    anchor = today;
  }
  const dateStr = formatYMD(anchor);

  if (mode === 'DAY') {
    const isToday = dateStr === todayStr;
    const titleOverride = isToday
      ? 'Xu hướng Sinh hiệu Hôm nay'
      : `Xu hướng Sinh hiệu ngày ${formatDMY(anchor)}`;
    return {
      mode: 'DAY',
      selectedDate: dateStr,
      startDate: dateStr,
      endDate: dateStr,
      days: 1,
      titleOverride,
    };
  }

  if (mode === 'WEEK') {
    // 7 ngày kết thúc vào anchor (nếu anchor là hôm nay thì là 7 ngày gần nhất)
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - 6);
    const startStr = formatYMD(start);
    const endStr = dateStr;
    const isCurrentWeek = endStr === todayStr;
    const titleOverride = isCurrentWeek
      ? 'Xu hướng Sinh hiệu 7 ngày gần nhất'
      : `Xu hướng Sinh hiệu tuần (${formatDM(start)} - ${formatDMY(anchor)})`;
    return {
      mode: 'WEEK',
      selectedDate: dateStr,
      startDate: startStr,
      endDate: endStr,
      days: 7,
      titleOverride,
    };
  }

  // MONTH
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0); // ngày cuối cùng của tháng
  const startStr = formatYMD(start);
  const endStr = formatYMD(end);
  const titleOverride = `Xu hướng Sinh hiệu Tháng ${m + 1}/${y}`;
  return {
    mode: 'MONTH',
    selectedDate: dateStr,
    startDate: startStr,
    endDate: endStr,
    days: end.getDate(),
    titleOverride,
  };
}

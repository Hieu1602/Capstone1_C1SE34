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

const WEEKDAY_LABELS_FULL = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

const WEEKDAY_LABELS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const formatVietnameseWeekdayDMY = (ymd: string): string => {
  const d = parseYMD(ymd);
  return `${WEEKDAY_LABELS_FULL[d.getDay()]}, ${formatDMY(d)}`;
};

export const formatShortWeekdayDM = (ymd: string): string => {
  const d = parseYMD(ymd);
  return `${WEEKDAY_LABELS_SHORT[d.getDay()]} ${formatDM(d)}`;
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
    // Tuần chuẩn từ Thứ 2 đến Chủ Nhật chứa anchor
    const dayOfWeek = anchor.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = formatYMD(start);
    const endStr = formatYMD(end);
    const titleOverride = `Xu hướng Sinh hiệu tuần (${formatDMY(start)} – ${formatDMY(end)})`;
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

export function stepVitalFilter(
  current: VitalFilterState,
  delta: -1 | 1
): VitalFilterState {
  const anchor = parseYMD(current.selectedDate);
  if (current.mode === 'DAY') {
    anchor.setDate(anchor.getDate() + delta);
  } else if (current.mode === 'WEEK') {
    anchor.setDate(anchor.getDate() + delta * 7);
  } else {
    anchor.setMonth(anchor.getMonth() + delta, 1);
  }
  return computeVitalFilter(current.mode, formatYMD(anchor));
}

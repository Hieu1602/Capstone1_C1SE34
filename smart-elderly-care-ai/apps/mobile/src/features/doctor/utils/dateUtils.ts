/**
 * Local-timezone date helpers for Doctor Home, Appointments, and Notifications.
 * Normalizes all comparisons to local YYYY-MM-DD to prevent UTC off-by-one-day shifts.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const toLocalYMD = (input?: Date | string | null): string => {
  if (!input) return '';
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return '';
    return `${input.getFullYear()}-${pad2(input.getMonth() + 1)}-${pad2(input.getDate())}`;
  }
  const raw = String(input).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return raw.slice(0, 10);
};

export const getLocalToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getLocalTodayYMD = (): string => toLocalYMD(new Date());

export const isTodayLocal = (input?: Date | string | null): boolean => {
  const ymd = toLocalYMD(input);
  return Boolean(ymd) && ymd === getLocalTodayYMD();
};

export const isSameLocalDay = (
  a?: Date | string | null,
  b?: Date | string | null
): boolean => {
  const ymdA = toLocalYMD(a);
  const ymdB = toLocalYMD(b);
  return Boolean(ymdA && ymdB && ymdA === ymdB);
};

export const formatAptTimeLocal = (dateStr?: string | null): string => {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? '--:--'
      : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
};

export const formatAppointmentDateTimeLabel = (dateStr?: string | null): string => {
  if (!dateStr) return '--:--';
  const time = formatAptTimeLocal(dateStr);
  if (isTodayLocal(dateStr)) {
    return `Hôm nay, ${time}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return time;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}, ${time}`;
};

const NOW_WINDOW_MS = 30 * 60 * 1000;

export const isAppointmentHappeningNow = (
  dateStr?: string | null,
  nowMs: number = Date.now()
): boolean => {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return false;
  return Math.abs(nowMs - t) <= NOW_WINDOW_MS;
};

export const isAppointmentOverdue = (
  dateStr?: string | null,
  status?: string | null,
  nowMs: number = Date.now()
): boolean => {
  if ((status !== 'UPCOMING' && status !== 'CONFIRMED') || !dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return false;
  return nowMs - t > NOW_WINDOW_MS;
};

export const isAppointmentFamilyConfirmed = (apt?: {
  status?: string | null;
  clinical_notes?: string | null;
  instructions?: string | null;
} | null): boolean => {
  if (!apt) return false;
  return (
    apt.status === 'CONFIRMED' ||
    (apt.clinical_notes || '').includes('[ĐÃ XÁC NHẬN ĐÓN TIẾP]') ||
    (apt.instructions || '').includes('[ĐÃ XÁC NHẬN ĐÓN TIẾP]')
  );
};

export const stripDoctorAppointmentTags = (text?: string | null): string =>
  (text || '')
    .replace(/\[ĐÃ XÁC NHẬN ĐÓN TIẾP\]\s*/g, '')
    .replace(/\[Yêu cầu lịch khám\]\s*/gi, '')
    .replace(/\[BS dời lịch\]\s*/g, '')
    .trim();

export const getCleanAppointmentTitle = (apt?: {
  exam_type?: string | null;
  visit_type?: string | null;
  clinical_notes?: string | null;
  doctor_id?: string | null;
  created_by?: string | null;
} | null): string => {
  if (!apt) return 'Khám sức khỏe';
  if (apt.exam_type && apt.exam_type !== 'HOME_VISIT' && apt.exam_type !== 'CLINIC' && apt.exam_type !== 'TELEHEALTH') {
    return apt.exam_type;
  }
  const isFamilyReq = Boolean(apt.created_by && apt.doctor_id && String(apt.created_by) !== String(apt.doctor_id));
  if (!isFamilyReq) {
    const cleanNotes = stripDoctorAppointmentTags(apt.clinical_notes);
    if (cleanNotes) return cleanNotes;
  }
  if (apt.visit_type === 'CLINIC' || apt.exam_type === 'CLINIC') {
    return 'Khám tại phòng khám SECA';
  }
  if (apt.visit_type === 'TELEHEALTH' || apt.exam_type === 'TELEHEALTH') {
    return 'Tư vấn từ xa (Telehealth)';
  }
  return 'Khám bệnh tại nhà';
};

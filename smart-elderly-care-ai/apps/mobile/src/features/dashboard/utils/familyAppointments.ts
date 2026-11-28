export interface BusySlotLike {
  id: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  visit_type?: string | null;
  /** BUSY = bác sĩ đã nhận lịch; PENDING = gia đình yêu cầu, chờ bác sĩ xác nhận (vẫn giữ chỗ) */
  kind?: 'BUSY' | 'PENDING' | string;
  /** Lịch của chính bệnh nhân đang đặt */
  is_own?: boolean;
}

/** Lý do ô giờ không chọn được: bác sĩ bận / yêu cầu của chính nhà mình đang chờ / nhà khác đã đặt trước */
export type SlotConflictKind = 'BUSY' | 'OWN_PENDING' | 'OTHER_PENDING';

export const SLOT_CONFLICT_LABEL: Record<SlotConflictKind, string> = {
  BUSY: 'Bác sĩ bận',
  OWN_PENDING: 'Lịch của bạn · chờ BS duyệt',
  OTHER_PENDING: 'Đã có người đặt · chờ BS duyệt',
};

export const SLOT_CONFLICT_ALERT: Record<SlotConflictKind, { title: string; message: string }> = {
  BUSY: {
    title: 'Khung giờ bác sĩ bận',
    message: 'Bác sĩ đã có lịch khám khác trong khung giờ này. Vui lòng chọn khung giờ trống khác.',
  },
  OWN_PENDING: {
    title: 'Bạn đã gửi yêu cầu ở khung giờ này',
    message: 'Yêu cầu khám của bạn trong khung giờ này đang chờ bác sĩ xác nhận. Vui lòng chọn khung giờ khác nếu muốn đặt thêm.',
  },
  OTHER_PENDING: {
    title: 'Khung giờ đã có người đặt trước',
    message: 'Một gia đình khác đã đặt khung giờ này trước và đang chờ bác sĩ xác nhận. Vui lòng chọn khung giờ khác.',
  },
};

export interface FamilyAppointmentLike {
  id: string;
  doctor_id?: string | null;
  created_by?: string | null;
  status: string;
  clinical_notes?: string | null;
  instructions?: string | null;
}

export interface DateOption {
  key: string;
  date: Date;
  dayLabel: string;
  dateLabel: string;
}

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const FAMILY_TIME_SLOTS: string[] = Array.from({ length: 25 }, (_, idx) => {
  const totalMins = 8 * 60 + idx * 30;
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getUpcomingDateOptions(days = 15, baseDate = new Date()): DateOption[] {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dayLabel = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : WEEKDAY_SHORT[d.getDay()];
    const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      key: toLocalDateKey(d),
      date: d,
      dayLabel,
      dateLabel,
    };
  });
}

export function buildLocalDateTime(date: Date, timeSlot: string): Date | null {
  const match = timeSlot.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
}

export function isSlotInPast(date: Date, timeSlot: string, nowMs = Date.now()): boolean {
  const dt = buildLocalDateTime(date, timeSlot);
  if (!dt) return true;
  return dt.getTime() <= nowMs;
}

// Mirrors backend crud_appointment.check_conflict (±60m buffer for HOME_VISIT, interval overlap otherwise).
export function isDoctorBusyForSlot(
  date: Date,
  timeSlot: string,
  visitType: string,
  busySlots: BusySlotLike[],
  excludeAppointmentId?: string | null,
  durationMinutes = 30
): boolean {
  return getSlotConflict(date, timeSlot, visitType, busySlots, excludeAppointmentId, durationMinutes) !== null;
}

/** Giống isDoctorBusyForSlot nhưng cho biết lý do (ưu tiên: bác sĩ bận > lịch của mình > nhà khác giữ chỗ) */
export function getSlotConflict(
  date: Date,
  timeSlot: string,
  visitType: string,
  busySlots: BusySlotLike[],
  excludeAppointmentId?: string | null,
  durationMinutes = 30
): SlotConflictKind | null {
  const slotStart = buildLocalDateTime(date, timeSlot);
  if (!slotStart) return null;
  const slotStartMs = slotStart.getTime();
  const slotEndMs = slotStartMs + durationMinutes * 60_000;
  const isNewHome = (visitType || '').toUpperCase() === 'HOME_VISIT';

  const overlapping = busySlots.filter((slot) => {
    if (excludeAppointmentId && String(slot.id) === String(excludeAppointmentId)) return false;
    const exStartMs = new Date(slot.scheduled_at).getTime();
    if (isNaN(exStartMs)) return false;
    const exDurMins = slot.duration_minutes && slot.duration_minutes > 0 ? slot.duration_minutes : 30;
    const exEndMs = exStartMs + exDurMins * 60_000;
    const isHomePair = isNewHome || (slot.visit_type || '').toUpperCase() === 'HOME_VISIT';
    if (isHomePair && Math.abs(exStartMs - slotStartMs) < 60 * 60_000) {
      return true;
    }
    return exStartMs < slotEndMs && exEndMs > slotStartMs;
  });
  if (overlapping.length === 0) return null;
  if (overlapping.some((s) => (s.kind || 'BUSY') !== 'PENDING')) return 'BUSY';
  if (overlapping.some((s) => s.is_own)) return 'OWN_PENDING';
  return 'OTHER_PENDING';
}

export function findFirstAvailableSlot(
  dateOptions: DateOption[],
  visitType: string,
  busySlots: BusySlotLike[],
  excludeAppointmentId?: string | null,
  nowMs = Date.now()
): { dateKey: string; timeSlot: string } {
  for (const opt of dateOptions) {
    for (const slot of FAMILY_TIME_SLOTS) {
      if (!isSlotInPast(opt.date, slot, nowMs) && !isDoctorBusyForSlot(opt.date, slot, visitType, busySlots, excludeAppointmentId)) {
        return { dateKey: opt.key, timeSlot: slot };
      }
    }
  }
  const fallback = dateOptions[1] || dateOptions[0];
  return {
    dateKey: fallback ? fallback.key : toLocalDateKey(new Date()),
    timeSlot: '09:00',
  };
}

export function isFamilyRequestedAppointment(apt: FamilyAppointmentLike): boolean {
  if (apt.created_by) {
    return !apt.doctor_id || String(apt.created_by) !== String(apt.doctor_id);
  }
  const notes = apt.clinical_notes || '';
  return notes.includes('[Yêu cầu lịch khám]') || notes.includes('Gia đình yêu cầu khám sức khỏe');
}

export function canFamilyManageAppointment(apt: FamilyAppointmentLike): boolean {
  if (apt.status !== 'UPCOMING' && apt.status !== 'CONFIRMED') return false;
  const notes = apt.clinical_notes || '';
  if (
    apt.status === 'CONFIRMED' ||
    notes.includes('[ĐÃ XÁC NHẬN ĐÓN TIẾP]') ||
    notes.includes('[BS dời lịch]')
  ) {
    return true;
  }
  if (apt.created_by) {
    return !apt.doctor_id || String(apt.created_by) !== String(apt.doctor_id);
  }
  return isFamilyRequestedAppointment(apt);
}

export function getFamilyAppointmentStatusInfo(apt: FamilyAppointmentLike): {
  label: string;
  isUpcoming: boolean;
  isConfirmed: boolean;
  isFamilyRequested: boolean;
  showFamilyConfirmPrompt: boolean;
} {
  const isUpcoming = apt.status === 'UPCOMING' || apt.status === 'CONFIRMED';
  const isFamilyRequested = isFamilyRequestedAppointment(apt);
  const hasConfirmTag = (apt.clinical_notes || '').includes('[ĐÃ XÁC NHẬN ĐÓN TIẾP]');
  const isConfirmed = apt.status === 'CONFIRMED' || hasConfirmTag;

  if (isUpcoming) {
    if (isFamilyRequested) {
      return {
        label: apt.status === 'CONFIRMED' ? 'ĐÃ XÁC NHẬN' : 'CHỜ BÁC SĨ XÁC NHẬN',
        isUpcoming: true,
        isConfirmed: apt.status === 'CONFIRMED',
        isFamilyRequested: true,
        showFamilyConfirmPrompt: false,
      };
    }
    return {
      label: isConfirmed ? 'ĐÃ XÁC NHẬN' : 'CHỜ GIA ĐÌNH XÁC NHẬN',
      isUpcoming: true,
      isConfirmed,
      isFamilyRequested: false,
      showFamilyConfirmPrompt: !isConfirmed,
    };
  }

  return {
    label: apt.status === 'COMPLETED' ? 'ĐÃ KHÁM XONG' : 'ĐÃ HỦY',
    isUpcoming: false,
    isConfirmed: false,
    isFamilyRequested,
    showFamilyConfirmPrompt: false,
  };
}

export function stripAppointmentSystemTags(text?: string | null): string {
  return (text || '')
    .replace(/\[ĐÃ XÁC NHẬN ĐÓN TIẾP\]/g, '')
    .replace(/\[Yêu cầu lịch khám\]/g, '')
    .replace(/\[BS dời lịch\]/g, '')
    .trim();
}

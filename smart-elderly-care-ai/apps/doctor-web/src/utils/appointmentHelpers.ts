// src/utils/appointmentHelpers.ts
// Pure helpers for appointment notes, status counts, WS notifications, and slot-conflict avoidance

export const CONFIRM_RECEPTION_TAG = '[ĐÃ XÁC NHẬN ĐÓN TIẾP]';

const HOME_VISIT_BUFFER_MS = 60 * 60_000;
const SLOT_STEP_MS = 30 * 60_000;

export interface AppointmentSlotLike {
  id?: string;
  scheduled_at: string;
  duration_minutes?: number;
  visit_type?: string | null;
  status?: string | null;
}

export function isUpcomingAppointmentStatus(status?: string | null): boolean {
  return status === 'UPCOMING' || status === 'CONFIRMED';
}

export function getAppointmentTabCounts(appointments: ReadonlyArray<{ status?: string | null }>) {
  return {
    UPCOMING: appointments.filter((a) => isUpcomingAppointmentStatus(a.status)).length,
    COMPLETED: appointments.filter((a) => a.status === 'COMPLETED').length,
    CANCELLED: appointments.filter((a) => a.status === 'CANCELLED').length,
    ALL: appointments.length,
  };
}

export function parseAppointmentNotes(clinicalNotes?: string | null): {
  isFamilyConfirmedByNote: boolean;
  cleanNotes: string;
} {
  const raw = clinicalNotes || '';
  const isFamilyConfirmedByNote = raw.includes(CONFIRM_RECEPTION_TAG);
  const cleanNotes = isFamilyConfirmedByNote
    ? raw.replace(/\[ĐÃ XÁC NHẬN ĐÓN TIẾP\]\s*/g, '').trim()
    : raw.trim();
  return { isFamilyConfirmedByNote, cleanNotes };
}

export function isHomeVisitType(visitType?: string | null): boolean {
  return visitType === 'HOME_VISIT' || visitType === 'HOME';
}

export function formatLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function hasAppointmentSlotConflict(params: {
  candidateStartMs: number;
  durationMinutes?: number;
  candidateVisitType?: string | null;
  appointments: ReadonlyArray<AppointmentSlotLike>;
  excludeAppointmentId?: string | null;
}): boolean {
  const {
    candidateStartMs,
    durationMinutes = 30,
    candidateVisitType,
    appointments,
    excludeAppointmentId,
  } = params;
  const candidateEndMs = candidateStartMs + durationMinutes * 60_000;
  const candidateIsHome = isHomeVisitType(candidateVisitType);

  return appointments.some((apt) => {
    if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;
    if (!isUpcomingAppointmentStatus(apt.status)) return false;

    const exStartMs = new Date(apt.scheduled_at).getTime();
    if (isNaN(exStartMs)) return false;

    const exEndMs = exStartMs + (apt.duration_minutes || 30) * 60_000;
    if (exStartMs < candidateEndMs && exEndMs > candidateStartMs) {
      return true;
    }

    if (candidateIsHome || isHomeVisitType(apt.visit_type)) {
      return Math.abs(candidateStartMs - exStartMs) < HOME_VISIT_BUFFER_MS;
    }

    return false;
  });
}

export function getInitialAppointmentDatetimeInput(params: {
  iso?: string | null;
  isReschedule: boolean;
  visitType: string;
  durationMinutes?: number;
  appointments: ReadonlyArray<AppointmentSlotLike>;
  excludeAppointmentId?: string | null;
  nowMs?: number;
}): string {
  const {
    iso,
    isReschedule,
    visitType,
    durationMinutes = 30,
    appointments,
    excludeAppointmentId,
    nowMs = Date.now(),
  } = params;

  const parsed = iso ? new Date(iso) : null;
  const hasValidIso = Boolean(parsed && !isNaN(parsed.getTime()));

  if (isReschedule && hasValidIso && parsed) {
    return formatLocalDatetimeInput(parsed);
  }

  let candidate: Date;
  if (hasValidIso && parsed) {
    candidate = new Date(parsed.getTime());
  } else {
    candidate = new Date(nowMs);
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(9, 0, 0, 0);
  }

  if (candidate.getTime() <= nowMs) {
    const nextSlotMs = Math.floor(nowMs / SLOT_STEP_MS) * SLOT_STEP_MS + SLOT_STEP_MS;
    candidate = new Date(nextSlotMs);
  }

  for (let step = 0; step < 48; step++) {
    const cStart = candidate.getTime();
    const conflict = hasAppointmentSlotConflict({
      candidateStartMs: cStart,
      durationMinutes,
      candidateVisitType: visitType,
      appointments,
      excludeAppointmentId,
    });
    if (!conflict) break;
    candidate.setMinutes(candidate.getMinutes() + 30);
  }

  return formatLocalDatetimeInput(candidate);
}

export function formatAppointmentWsNotification(event: {
  alert_type?: string;
  type?: string;
  message?: string;
  data?: { message?: string };
}): { title: string; body: string } {
  const alertType = event.alert_type || event.type || '';
  const body =
    event.message ||
    event.data?.message ||
    'Thông tin lịch khám của bệnh nhân vừa được cập nhật.';

  switch (alertType) {
    case 'APPOINTMENT_SCHEDULED':
      return { title: '📅 Lịch khám mới từ gia đình', body };
    case 'APPOINTMENT_CONFIRMED':
      return { title: '✅ Gia đình đã xác nhận đón tiếp', body };
    case 'APPOINTMENT_CANCELLED':
      return { title: '❌ Gia đình đã hủy lịch khám', body };
    case 'APPOINTMENT_RESCHEDULED':
      return { title: '🔄 Gia đình đã dời lịch khám', body };
    default:
      return { title: '📅 Cập nhật lịch khám', body };
  }
}

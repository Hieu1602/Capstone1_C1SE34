// Hiển thị lịch sử thao tác lịch khám: "Đã dời lịch · 14:32 28/11 · BS. Nghĩa"
import type { AppointmentEvent } from '../types';

export const APPOINTMENT_ACTION_LABEL: Record<string, string> = {
  CREATED: 'Đặt lịch',
  REQUESTED: 'Gia đình yêu cầu lịch',
  RESCHEDULED: 'Dời lịch',
  UPDATED: 'Cập nhật thông tin',
  CONFIRMED: 'Xác nhận lịch',
  COMPLETED: 'Hoàn tất khám',
  CANCELLED: 'Hủy lịch',
  DELETED: 'Xóa lịch',
};

const ROLE_LABEL: Record<string, string> = {
  doctor: 'Bác sĩ',
  admin: 'Quản trị viên',
  owner: 'Người nhà',
  member: 'Người nhà',
  caregiver: 'Người chăm sóc',
};

const FIELD_LABEL: Record<string, string> = {
  scheduled_at: 'Giờ khám',
  duration_minutes: 'Thời lượng',
  visit_type: 'Hình thức',
  location: 'Địa điểm',
  exam_type: 'Loại khám',
  instructions: 'Dặn dò',
  status: 'Trạng thái',
};

const VALUE_LABEL: Record<string, string> = {
  CLINIC: 'Tại phòng khám',
  HOME: 'Tại nhà',
  HOME_VISIT: 'Tại nhà',
  TELEHEALTH: 'Khám từ xa',
  UPCOMING: 'Sắp tới',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Đã khám',
  CANCELLED: 'Đã hủy',
};

export function formatEventTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dm = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${hm} ${dm}`;
}

export function formatActor(ev: Pick<AppointmentEvent, 'actor_name' | 'actor_role'>): string {
  if (ev.actor_name) return ev.actor_name;
  return (ev.actor_role && ROLE_LABEL[ev.actor_role]) || 'Hệ thống';
}

/** Dòng tóm tắt 1 thao tác: "Dời lịch · 14:32 28/11/2026 · BS. Nghĩa" */
export function formatEventSummary(ev: AppointmentEvent): string {
  const label = APPOINTMENT_ACTION_LABEL[ev.action] || ev.action;
  return [label, formatEventTime(ev.created_at), formatActor(ev)].filter(Boolean).join(' · ');
}

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (field === 'scheduled_at') return formatEventTime(String(v)) || String(v);
  if (field === 'duration_minutes') return `${v} phút`;
  return VALUE_LABEL[String(v)] || String(v);
}

/** Danh sách thay đổi: ["Giờ khám: 09:00 01/12/2026 → 10:00 02/12/2026"] (bỏ qua trường status đã thể hiện qua action) */
export function describeChanges(ev: AppointmentEvent): string[] {
  if (!ev.changes) return [];
  return Object.entries(ev.changes)
    .filter(([field]) => field !== 'status')
    .map(([field, pair]) => {
      const [oldV, newV] = Array.isArray(pair) ? pair : [undefined, pair];
      return `${FIELD_LABEL[field] || field}: ${formatValue(field, oldV)} → ${formatValue(field, newV)}`;
    });
}

// Lịch sử thao tác lịch khám (dùng chung app Bác sĩ & app Người nhà):
// 1 dòng "Dời lịch · 14:32 28/11/2026 · BS. Nghĩa", bấm để mở dòng thời gian đầy đủ.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';

export interface AppointmentEventItem {
  id: string;
  action: string;
  actor_name?: string | null;
  actor_role?: string | null;
  changes?: Record<string, [unknown, unknown]> | null;
  note?: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
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
};

const VALUE_LABEL: Record<string, string> = {
  CLINIC: 'Tại phòng khám',
  HOME: 'Tại nhà',
  HOME_VISIT: 'Tại nhà',
  TELEHEALTH: 'Khám từ xa',
};

const pad = (n: number) => String(n).padStart(2, '0');

export function formatEventTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatEventSummary(ev: AppointmentEventItem): string {
  const actor = ev.actor_name || (ev.actor_role && ROLE_LABEL[ev.actor_role]) || 'Hệ thống';
  return [ACTION_LABEL[ev.action] || ev.action, formatEventTime(ev.created_at), actor].filter(Boolean).join(' · ');
}

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (field === 'scheduled_at') return formatEventTime(String(v)) || String(v);
  if (field === 'duration_minutes') return `${v} phút`;
  return VALUE_LABEL[String(v)] || String(v);
}

function describeChanges(ev: AppointmentEventItem): string[] {
  if (!ev.changes) return [];
  return Object.entries(ev.changes)
    .filter(([field]) => field !== 'status')
    .map(([field, pair]) => {
      const [oldV, newV] = Array.isArray(pair) ? pair : [undefined, pair];
      return `${FIELD_LABEL[field] || field}: ${formatValue(field, oldV)} → ${formatValue(field, newV)}`;
    });
}

interface Props {
  appointmentId: string;
  lastEvent?: AppointmentEventItem | null;
  createdAt?: string;
  /** Có patientId -> dùng API của người nhà; không có -> API bác sĩ */
  patientId?: string;
  isDarkMode?: boolean;
}

export const AppointmentHistoryLine: React.FC<Props> = ({ appointmentId, lastEvent, createdAt, patientId, isDarkMode }) => {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AppointmentEventItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sub = isDarkMode ? '#94A3B8' : '#64748B';
  const main = isDarkMode ? '#E2E8F0' : '#334155';

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setError(false);
    try {
      const url = patientId
        ? `/patients/${patientId}/appointments/${appointmentId}/history`
        : `/doctor/appointments/${appointmentId}/history`;
      const res = await api.get(url);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const summary = lastEvent
    ? formatEventSummary(lastEvent)
    : createdAt
      ? `Tạo lúc ${formatEventTime(createdAt)}`
      : 'Lịch sử thao tác';

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={toggle} style={styles.row} activeOpacity={0.7}>
        <Ionicons name="time-outline" size={13} color={sub} />
        <Text style={[styles.summary, { color: sub }]} numberOfLines={1}>
          {summary}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={sub} />
      </TouchableOpacity>

      {open && (
        <View style={[styles.box, { backgroundColor: isDarkMode ? '#0F172A88' : '#F8FAFC' }]}>
          {loading ? (
            <ActivityIndicator size="small" />
          ) : error ? (
            <Text style={[styles.small, { color: '#DC2626' }]}>Không tải được lịch sử. Vui lòng thử lại.</Text>
          ) : !events || events.length === 0 ? (
            <Text style={[styles.small, { color: sub }]}>
              Chưa có lịch sử chi tiết (lịch được tạo trước khi bật tính năng ghi lịch sử).
            </Text>
          ) : (
            events.map((ev) => (
              <View key={ev.id} style={styles.event}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventTitle, { color: main }]}>{formatEventSummary(ev)}</Text>
                  {describeChanges(ev).map((c) => (
                    <Text key={c} style={[styles.small, { color: sub }]}>
                      {c}
                    </Text>
                  ))}
                  {ev.note ? <Text style={[styles.small, { color: sub, fontStyle: 'italic' }]}>“{ev.note}”</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summary: { fontSize: 11.5, flexShrink: 1 },
  box: { marginTop: 6, borderRadius: 10, padding: 10, gap: 8 },
  event: { flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3B82F6', marginTop: 5 },
  eventTitle: { fontSize: 12, fontWeight: '600' },
  small: { fontSize: 11.5, lineHeight: 16 },
});

// src/utils/notificationBuilder.ts
// Helpers chuẩn hóa, phân nhóm và chuyển đổi thông báo lâm sàng cho Bác sĩ

import { UnifiedNotification } from '../components/clinical/NotificationDetailModal';
import { cleanNotificationText } from './notificationSync';
import { isAppointmentOverdue } from './appointmentHelpers';
import type { Incident, AppointmentItem, DoctorPatientCard, SystemNotification } from '../types';

export type TabType = 'ALL' | 'UNREAD' | 'ADMIN' | 'ALERTS' | 'APPOINTMENTS' | 'OTHERS';
export type SeverityType = 'ALL' | 'CRITICAL' | 'WARNING';

export interface NotificationInboxItem extends UnifiedNotification {
  cleanTitle: string;
  cleanDesc: string;
  timeOnly: string;
  dateKey: string;
  dateLabel: string;
  sortTimestamp: number;
}

export const ADMIN_BADGE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  system_maintenance: {
    label: 'Bảo trì hệ thống',
    color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300',
    bg: 'bg-amber-50',
  },
  emergency: {
    label: 'Khẩn cấp Admin',
    color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300',
    bg: 'bg-rose-50',
  },
  feature_update: {
    label: 'Cập nhật tính năng',
    color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300',
    bg: 'bg-blue-50',
  },
  health_tip: {
    label: 'Chỉ dẫn y tế',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300',
    bg: 'bg-emerald-50',
  },
};

export const DEFAULT_ADMIN_BADGE = {
  label: 'Thông báo Admin',
  color: 'text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300',
  bg: 'bg-sky-50',
};

export const DEVICE_OP_KEYWORDS = [
  'pin',
  'sạc',
  'mất kết nối',
  'ngắt kết nối',
  'ngoại tuyến',
  'offline',
  'mất tín hiệu',
];

export function parseTitleAndBody(
  raw: string,
  type: UnifiedNotification['type'],
  alertType?: string,
  alertLevel?: string,
  patientName?: string
) {
  const text = cleanNotificationText(raw);
  const lower = text.toLowerCase();

  if (type === 'INVITE' || lower.includes('lời mời')) {
    return {
      title: 'Lời mời phụ trách Bác sĩ gia đình',
      desc: text || 'Chủ hộ đã gửi lời mời bạn tham gia với vai trò Bác sĩ gia đình.',
    };
  }
  if (
    type === 'APPOINTMENT' ||
    alertType?.startsWith('APPOINTMENT_') ||
    lower.includes('lịch khám') ||
    lower.includes('lịch hẹn')
  ) {
    const isCancelled = lower.includes('hủy') || alertType === 'APPOINTMENT_CANCELLED';
    const isConfirmed =
      lower.includes('xác nhận') || alertType === 'APPOINTMENT_CONFIRMED' || lower.includes('đón tiếp');
    const title = isCancelled
      ? 'Lịch khám y tế đã hủy'
      : isConfirmed
        ? lower.includes('tại nhà')
          ? 'Xác nhận lịch khám tại nhà'
          : 'Xác nhận lịch khám tại phòng khám'
        : patientName
          ? `Lịch khám bệnh nhân ${patientName}`
          : 'Lịch khám định kỳ';
    return { title, desc: text };
  }
  if (
    alertLevel === 'CRITICAL' ||
    alertType === 'FALL_DETECTED' ||
    lower.includes('báo động đỏ') ||
    lower.includes('té ngã')
  ) {
    if (lower.includes('tam chứng')) {
      return {
        title: 'BÁO ĐỘNG ĐỎ: Tam chứng nguy kịch',
        desc: text.replace(/^BÁO ĐỘNG ĐỎ:?\s*(?:Tam chứng nguy kịch:?)?\s*/i, '').trim(),
      };
    }
    if (lower.includes('té ngã') || alertType === 'FALL_DETECTED') {
      return {
        title: 'BÁO ĐỘNG ĐỎ: Phát hiện sự cố té ngã',
        desc: text.replace(/^BÁO ĐỘNG ĐỎ:?\s*/i, '').trim(),
      };
    }
    return {
      title: 'BÁO ĐỘNG ĐỎ: Cảnh báo khẩn cấp',
      desc: text.replace(/^BÁO ĐỘNG ĐỎ:?\s*/i, '').trim(),
    };
  }
  const hrMatch = text.match(/Cảnh báo nhịp tim (?:cao|chậm|bất thường)\s*\(\d+\s*bpm\)/i);
  if (hrMatch) return { title: hrMatch[0], desc: text };
  const spo2Match = text.match(/Cảnh báo SpO2 (?:thấp|nguy hiểm)\s*\(\d+%\)/i);
  if (spo2Match) return { title: spo2Match[0], desc: text };
  if (alertType === 'MEDICAL_RECORD_UPDATED' || lower.includes('bệnh án')) {
    return { title: 'Cập nhật hồ sơ bệnh án', desc: text };
  }

  const parts = text.split(/[:\.\n]/);
  if (parts.length > 1 && parts[0].trim().length >= 5 && parts[0].trim().length < 50) {
    return { title: parts[0].trim(), desc: text.slice(parts[0].length + 1).trim() || parts[0].trim() };
  }
  return { title: text.slice(0, 50), desc: text };
}

export function formatNotificationTime(str?: string): string {
  if (!str) return '--:--';
  const d = new Date(str);
  return isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function getDateGroup(str?: string) {
  const d = str ? new Date(str) : new Date();
  const time = isNaN(d.getTime()) ? Date.now() : d.getTime();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const dKey = toKey(d);
  const todayKey = toKey(now);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestKey = toKey(yest);

  if (dKey === todayKey) return { key: dKey, label: 'Hôm nay', timestamp: time };
  if (dKey === yestKey) return { key: dKey, label: 'Hôm qua', timestamp: time };
  return { key: dKey, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timestamp: time };
}

export function isNotificationReadInSet(n: Pick<UnifiedNotification, 'id' | 'rawIncidentId'>, readSet: Set<string>): boolean {
  return Boolean(
    readSet.has(n.id) ||
      (n.rawIncidentId && (readSet.has(n.rawIncidentId) || readSet.has(`inc_${n.rawIncidentId}`)))
  );
}

export function applyAcknowledgeToItem<T extends UnifiedNotification>(item: T, doctorName: string): T {
  return {
    ...item,
    isRead: true,
    badgeLabel: 'Đã xử lý',
    rawIncident: item.rawIncident
      ? {
          ...item.rawIncident,
          is_acknowledged: true,
          acknowledged_by_name: doctorName,
          acknowledged_at: new Date().toISOString(),
        }
      : undefined,
  };
}

/**
 * Chuyển đổi dữ liệu thống nhất (Incidents, Sinh hiệu cảnh báo, Lịch khám, Thông báo Admin)
 */
export function buildNotificationItems(
  incs: Incident[],
  pats: DoctorPatientCard[],
  apts: AppointmentItem[],
  sysList: SystemNotification[] = [],
  readSet: Set<string> = new Set(),
  doctorUserId?: string
): NotificationInboxItem[] {
  const list: NotificationInboxItem[] = [];

  // A. Incidents (Lọc chống Alert Fatigue cho Bác sĩ)
  incs?.forEach((inc) => {
    const msg = inc.message || '';
    const lower = msg.toLowerCase();

    // Lọc tầng UI: Tuyệt đối ẩn cảnh báo vận hành thiết bị (pin, sạc, mất kết nối)
    const isDeviceOp =
      DEVICE_OP_KEYWORDS.some((k) => lower.includes(k)) ||
      Boolean(inc.alert_type?.startsWith('BATTERY_') || inc.alert_type?.startsWith('DEVICE_'));
    if (isDeviceOp) return;

    const isCrit = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED' || inc.alert_type === 'LOW_SPO2';
    const isHouseInvite =
      inc.alert_type === 'HOUSE_INVITE_PENDING' ||
      Boolean(inc.notes?.includes('HOUSE_INVITE_PENDING')) ||
      lower.includes('lời mời bạn tham gia') ||
      lower.includes('xác nhận vào nhà');
    const isAppointment =
      ['APPOINTMENT_CONFIRMED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CANCELLED'].includes(inc.alert_type || '') ||
      lower.includes('lịch khám') ||
      lower.includes('lịch hẹn');
    const isAssignment = lower.includes('bệnh nhân mới') || lower.includes('phụ trách');
    const isMedicalRecord = inc.alert_type === 'MEDICAL_RECORD_UPDATED' || lower.includes('bệnh án');

    // Chống tự làm phiền (No Self-Notification khi bác sĩ tự cập nhật)
    if (isMedicalRecord && (inc.acknowledged_by === doctorUserId || (doctorUserId && inc.notes?.includes(doctorUserId)))) {
      return;
    }

    // Tuyệt đối ẩn dao động nhẹ; Bác sĩ chỉ nhận Cảnh báo Nguy cấp HOẶC Lịch khám / Lời mời
    if (!isCrit && !isHouseInvite && !isAppointment && !isAssignment) {
      return;
    }

    const isRead = Boolean(inc.is_acknowledged || readSet.has(inc.id) || readSet.has(`inc_${inc.id}`));
    let type: UnifiedNotification['type'] = 'ALERT';
    let label = isCrit ? 'Khẩn cấp' : 'Cảnh báo';
    let color = isCrit
      ? 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
      : 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
    let target = '/patients';
    let finalRead = isRead;

    if (isHouseInvite) {
      type = 'INVITE';
      const handled = Boolean(inc.is_acknowledged);
      label = handled ? (inc.notes?.includes('từ chối') ? 'Đã từ chối' : 'Đã tham gia') : 'Lời mời';
      color = handled ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200';
      target = '/';
      finalRead = handled;
    } else if (isAppointment) {
      type = 'APPOINTMENT';
      const isCancel = lower.includes('hủy');
      const isConfirm = lower.includes('xác nhận');
      label = isCancel ? 'Đã hủy' : isConfirm ? 'Đã xác nhận' : 'Lịch khám';
      color = isCancel
        ? 'text-rose-700 bg-rose-50 border-rose-200'
        : isConfirm
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : 'text-sky-700 bg-sky-50 border-sky-200';
      target = '/appointments';
    } else if (isAssignment) {
      label = 'Bệnh nhân';
      color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (isMedicalRecord) {
      label = 'Hồ sơ y tế';
      color = 'text-indigo-700 bg-indigo-50 border-indigo-200';
    }

    const patIdx = pats?.findIndex((p) => p.id === (inc as any).elderly_id || (inc.notes && inc.notes.includes(p.id)));
    const pat = patIdx !== undefined && patIdx >= 0 ? pats[patIdx] : undefined;
    const mrCode = patIdx !== undefined && patIdx >= 0 ? `MR-${String(patIdx + 1).padStart(3, '0')}` : undefined;
    const pName = pat?.name || (type === 'INVITE' ? 'Hộ gia đình mới' : undefined);
    const parsed = parseTitleAndBody(msg, type, inc.alert_type, inc.alert_level, pName);
    const dg = getDateGroup(inc.created_at);
    const timeOnly = formatNotificationTime(inc.created_at);
    const repeatCount = inc.repeat_count || 1;
    const repeatBadge = inc.repeat_badge || (repeatCount > 1 ? `Lặp lại ${repeatCount} lần trong 15 phút qua` : undefined);

    list.push({
      id: `inc_${inc.id}`,
      rawIncidentId: inc.id,
      type,
      title: parsed.title,
      subtitle: parsed.desc,
      cleanTitle: parsed.title,
      cleanDesc: parsed.desc,
      timeStr: dg.label === 'Hôm nay' ? timeOnly : `${dg.label} ${timeOnly}`,
      timeOnly,
      dateKey: dg.key,
      dateLabel: dg.label,
      sortTimestamp: dg.timestamp,
      badgeLabel: label,
      badgeColor: color,
      badgeBg: isCrit ? 'bg-rose-50' : 'bg-amber-50',
      isRead: finalRead,
      targetUrl: target,
      rawIncident: inc,
      patientId: pat?.id,
      patientName: pName,
      patientMrCode: mrCode,
      repeatCount,
      repeatBadge,
      patientAddress: pat?.house_address || pat?.house_name,
      heartRate: pat?.heart_rate && pat.heart_rate > 0 ? pat.heart_rate : undefined,
      spo2: pat?.spo2 && pat.spo2 > 0 ? pat.spo2 : undefined,
      alertLevel: inc.alert_level,
      alertType: inc.alert_type,
    });
  });

  // B. Sinh hiệu cảnh báo từ Bệnh nhân (CHỈ NGUY CẤP DANGER)
  pats?.forEach((p, idx) => {
    if (p.health_status === 'DANGER' && !list.some((i) => i.id === `pat_${p.id}`)) {
      const dg = getDateGroup(new Date().toISOString());
      const title = `BÁO ĐỘNG ĐỎ: ${p.name} - Sinh hiệu nguy cấp`;
      const desc = `Nhịp tim: ${p.heart_rate || '--'} bpm • SpO2: ${p.spo2 || '--'}% • Địa chỉ: ${p.house_address || p.house_name || 'Nhà riêng'}`;
      list.push({
        id: `pat_${p.id}`,
        type: 'ALERT',
        title,
        subtitle: desc,
        cleanTitle: title,
        cleanDesc: desc,
        timeStr: 'Hôm nay',
        timeOnly: 'Vừa xong',
        dateKey: dg.key,
        dateLabel: dg.label,
        sortTimestamp: dg.timestamp,
        badgeLabel: 'Nguy cấp',
        badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
        badgeBg: 'bg-rose-50',
        isRead: readSet.has(`pat_${p.id}`),
        targetUrl: `/patients?search=${encodeURIComponent(p.name)}`,
        patientId: p.id,
        patientName: p.name,
        patientMrCode: `MR-${String(idx + 1).padStart(3, '0')}`,
        patientAddress: p.house_address || p.house_name,
        heartRate: p.heart_rate,
        spo2: p.spo2,
        alertLevel: 'CRITICAL',
      });
    }
  });

  // C. Lịch khám
  apts?.forEach((apt) => {
    if (!list.some((i) => i.id === `apt_${apt.id}`)) {
      const dg = getDateGroup(apt.scheduled_at);
      const timeOnly = formatNotificationTime(apt.scheduled_at);
      const isDone = apt.status === 'COMPLETED';
      const isCancel = apt.status === 'CANCELLED';
      const isConfirmed = apt.status === 'CONFIRMED';
      const isOverdue = isAppointmentOverdue(apt.scheduled_at, apt.status);
      const title = `Lịch khám: ${apt.patient_name || 'Bệnh nhân'}`;
      const desc = `${apt.visit_type === 'HOME_VISIT' ? 'Khám tại nhà' : 'Tại phòng khám'} • Địa chỉ: ${apt.location || 'Chưa cập nhật'}`;
      list.push({
        id: `apt_${apt.id}`,
        type: 'APPOINTMENT',
        title,
        subtitle: desc,
        cleanTitle: title,
        cleanDesc: desc,
        timeStr: dg.label === 'Hôm nay' ? timeOnly : `${dg.label} ${timeOnly}`,
        timeOnly,
        dateKey: dg.key,
        dateLabel: dg.label,
        sortTimestamp: dg.timestamp,
        badgeLabel: isDone ? 'Đã khám' : isCancel ? 'Đã hủy' : isOverdue ? 'Quá giờ' : isConfirmed ? 'Đã xác nhận' : 'Sắp tới',
        badgeColor: isDone
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : isCancel
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : isOverdue
              ? 'text-orange-700 bg-orange-50 border-orange-200'
              : isConfirmed
                ? 'text-teal-700 bg-teal-50 border-teal-200'
                : 'text-sky-700 bg-sky-50 border-sky-200',
        badgeBg: isDone ? 'bg-emerald-50' : isCancel ? 'bg-rose-50' : isOverdue ? 'bg-orange-50' : isConfirmed ? 'bg-teal-50' : 'bg-sky-50',
        isRead: readSet.has(`apt_${apt.id}`),
        targetUrl: '/appointments',
        patientName: apt.patient_name,
        patientAddress: apt.location,
      });
    }
  });

  // D. Thông báo phát sóng toàn hệ thống từ Web Admin
  sysList?.forEach((sys) => {
    const dg = getDateGroup(sys.published_at || sys.created_at);
    const timeOnly = formatNotificationTime(sys.published_at || sys.created_at);
    const sysId = `sys_${sys.id}`;
    const badge = ADMIN_BADGE_MAP[sys.type] || DEFAULT_ADMIN_BADGE;

    list.push({
      id: sysId,
      type: 'ADMIN',
      title: sys.title,
      subtitle: sys.body,
      cleanTitle: sys.title,
      cleanDesc: sys.body,
      timeStr: dg.label === 'Hôm nay' ? timeOnly : `${dg.label} ${timeOnly}`,
      timeOnly,
      dateKey: dg.key,
      dateLabel: dg.label,
      sortTimestamp: dg.timestamp,
      badgeLabel: badge.label,
      badgeColor: badge.color,
      badgeBg: 'bg-sky-50',
      isRead: Boolean(readSet.has(sysId) || readSet.has(sys.id)),
      targetUrl: '/notifications',
      patientName: 'Ban Quản Trị Hệ Thống (Admin)',
      adminNotification: sys,
    });
  });

  return list.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
}

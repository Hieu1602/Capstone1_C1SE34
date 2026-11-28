import { Ionicons } from '@expo/vector-icons';
import type { Incident } from '../../../../store/useAlertStore';
import type { SystemAnnouncement } from '../../../../services/api';
import type { AppointmentItem, PatientCardData } from '../types';
import { toLocalYMD, getLocalTodayYMD, isAppointmentOverdue } from '../../utils/dateUtils';

export type TabType = 'ALL' | 'UNREAD' | 'ADMIN' | 'ALERTS' | 'APPOINTMENTS';

const DEVICE_OP_KEYWORDS = [
  'pin',
  'sạc',
  'mất kết nối',
  'ngắt kết nối',
  'ngoại tuyến',
  'offline',
  'mất tín hiệu',
];

export interface UnifiedNotification {
  id: string;
  rawIncidentId?: string;
  type: 'INCIDENT' | 'PATIENT_WARNING' | 'APPOINTMENT' | 'PATIENT_ASSIGNMENT' | 'HOUSE_INVITE' | 'ADMIN';
  title: string;
  subtitle: string;
  timeStr: string;
  sortTimestamp?: number;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  isRead: boolean;
  patientId?: string;
  patientName?: string;
  heartRate?: number;
  spo2?: number;
  rawAppointment?: AppointmentItem;
  targetScreen: 'DoctorAppointments' | 'DoctorPatients' | 'DoctorPatientDetail' | 'DoctorHome';
  targetParams?: any;
  rawIncident?: Incident;
  adminAnnouncement?: SystemAnnouncement;
  memberId?: string;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return toLocalYMD(d) === getLocalTodayYMD()
      ? `Hôm nay, ${formatTime(dateStr)}`
      : `${d.getDate()}/${d.getMonth() + 1} lúc ${formatTime(dateStr)}`;
  } catch {
    return '';
  }
}

export const EMPTY_TAB_CONFIG: Record<TabType, { title: string; sub: string }> = {
  UNREAD: { title: 'Tuyệt vời! Không còn thông báo chưa đọc', sub: 'Bác sĩ đã xem và xử lý toàn bộ các thông báo y tế.' },
  ADMIN: { title: 'Chưa có thông báo từ Admin', sub: 'Các thông báo bảo trì và cập nhật hệ thống sẽ hiển thị tại đây.' },
  ALERTS: { title: 'Không có cảnh báo bất thường', sub: 'Tất cả các bệnh nhân đều đang có sinh hiệu bình thường.' },
  APPOINTMENTS: { title: 'Không có lịch khám mới', sub: 'Bác sĩ có thể chủ động đặt lịch thăm khám định kỳ cho các cụ.' },
  ALL: { title: 'Mọi thứ đều ổn định', sub: 'Hiện không có cảnh báo sức khỏe khẩn cấp hay lịch hẹn nào cần xử lý.' },
};

export function getMedicalRecommendation(type: UnifiedNotification['type']): string {
  switch (type) {
    case 'ADMIN':
      return 'Thông báo chính thức từ Ban Quản Trị Hệ Thống SECA dành cho đội ngũ Bác sĩ.';
    case 'INCIDENT':
      return 'Khẩn cấp: Kiểm tra ngay dấu hiệu chấn thương hoặc liên hệ cấp cứu 115 nếu người cao tuổi có dấu hiệu mất ý thức.';
    case 'HOUSE_INVITE':
      return 'Lời mời Bác sĩ gia đình: Sau khi tham gia, bác sĩ có thể trực tiếp giám sát sinh hiệu liên tục và lên lịch tái khám định kỳ cho các cụ.';
    case 'APPOINTMENT':
      return 'Lịch hẹn thăm khám: Xem lại bệnh sử và chuẩn bị dụng cụ y tế kiểm tra tim mạch, huyết áp cho người cao tuổi.';
    default:
      return 'Dữ liệu cảnh báo được phát hiện tự động bởi hệ thống AI SECA và đồng bộ thời gian thực.';
  }
}

export function normalizeMatchText(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function extractIncidentVitals(inc: Incident): { heartRate?: number; spo2?: number } {
  const hrFromField = typeof inc.heart_rate === 'number' && inc.heart_rate > 0 ? Math.round(inc.heart_rate) : undefined;
  const spo2FromField = typeof inc.spo2 === 'number' && inc.spo2 > 0 ? Math.round(inc.spo2) : undefined;
  const rawText = `${inc.message || ''} ${inc.notes || ''}`;
  const hrMatch = rawText.match(/(\d{2,3})\s*(?:bpm|nhịp\/phút)/i);
  const spo2Match = rawText.match(/(?:spo2|oxy)[:\s]*(\d{2,3})\s*%|(\d{2,3})\s*%\s*(?:spo2|oxy)/i);
  const heartRate = hrFromField ?? (hrMatch ? parseInt(hrMatch[1], 10) : undefined);
  const spo2Raw = spo2Match ? spo2Match[1] || spo2Match[2] : undefined;
  const spo2 = spo2FromField ?? (spo2Raw ? parseInt(spo2Raw, 10) : undefined);
  return { heartRate, spo2 };
}

export function matchPatientForIncident(
  inc: Partial<Incident> | undefined,
  candidates: PatientCardData[] = [],
  fallbackTitle?: string
): PatientCardData | undefined {
  if (!candidates || candidates.length === 0) return undefined;
  const explicitId = inc?.elderly_id || (inc?.notes?.includes('PATIENT:') ? inc.notes.split('PATIENT:')[1].split('|')[0].trim() : undefined);
  if (explicitId) {
    const byId = candidates.find((p) => String(p.id) === String(explicitId));
    if (byId) return byId;
  }
  if (inc?.device_id) {
    const byDev = candidates.find((p) => p.device_id && String(p.device_id) === String(inc.device_id));
    if (byDev) return byDev;
  }
  const haystack = normalizeMatchText(`${inc?.patient_name || ''} ${inc?.message || ''} ${fallbackTitle || ''}`);
  if (!haystack) return undefined;
  const sorted = [...candidates].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
  return sorted.find((p) => {
    const pName = normalizeMatchText(p.name);
    return pName.length >= 3 && haystack.includes(pName);
  });
}

function extractNameFromAlertMessage(rawMsg?: string): string | undefined {
  if (!rawMsg) return undefined;
  const match = rawMsg.match(/Phát hiện\s+(?:Cụ\s+|Bác\s+|Ông\s+|Bà\s+)?([^()!\n]+?)\s+té ngã/i);
  return match?.[1]?.trim() || undefined;
}

export function buildUnifiedNotifications(params: {
  incidents: Incident[];
  warningPatients: PatientCardData[];
  patients?: PatientCardData[];
  appointments: AppointmentItem[];
  upcomingAppointments: AppointmentItem[];
  readIds: Set<string>;
  adminBroadcasts?: SystemAnnouncement[];
  doctorUserId?: string;
}): UnifiedNotification[] {
  const {
    incidents,
    warningPatients,
    patients = [],
    appointments,
    upcomingAppointments,
    readIds,
    adminBroadcasts = [],
    doctorUserId,
  } = params;
  const allPatients = patients.length > 0 ? patients : warningPatients;
  const unifiedList: UnifiedNotification[] = [];
  const toTs = (s?: string | null) => {
    if (!s) return 0;
    const t = new Date(s).getTime();
    return isNaN(t) ? 0 : t;
  };

  // 0. Thông báo Admin Broadcasts (đồng bộ với Doctor Web)
  adminBroadcasts.forEach((sys) => {
    const sysId = `sys_${sys.id}`;
    unifiedList.push({
      id: sysId,
      type: 'ADMIN',
      title: sys.title,
      subtitle: sys.body,
      timeStr: sys.published_at || sys.created_at || '',
      sortTimestamp: toTs(sys.published_at || sys.created_at),
      badgeLabel: 'Thông báo Admin',
      badgeColor: '#0284C7',
      badgeBg: '#E0F2FE',
      iconName: 'megaphone',
      iconColor: '#0284C7',
      isRead: Boolean(readIds.has(sysId) || readIds.has(sys.id)),
      targetScreen: 'DoctorHome',
      adminAnnouncement: sys,
    });
  });

  // 1. Cảnh báo khẩn cấp & Thông báo hệ thống từ incidents (đồng bộ bộ lọc với Web)
  incidents.forEach((inc) => {
    const isCritical = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED' || inc.alert_type === 'LOW_SPO2';
    const rawMsg = inc.message || '';
    const msgLower = rawMsg.toLowerCase();

    const isDeviceOp =
      DEVICE_OP_KEYWORDS.some((k) => msgLower.includes(k)) ||
      Boolean(inc.alert_type?.startsWith('BATTERY_') || inc.alert_type?.startsWith('DEVICE_'));
    if (isDeviceOp) return;

    const isRead = Boolean(inc.is_acknowledged || readIds.has(inc.id) || readIds.has(`inc_${inc.id}`));

    const isAppointmentMsg =
      Boolean(inc.alert_type?.startsWith('APPOINTMENT_')) ||
      ['lịch khám', 'lịch hẹn', 'đã hủy', '[đã hủy]', 'tái khám', 'xác nhận lịch'].some((k) => msgLower.includes(k));

    const isAssignmentMsg = ['chủ hộ', 'phụ trách', 'chỉ định', 'bệnh nhân mới'].some((k) => msgLower.includes(k));

    const isMedicalRecordMsg =
      inc.alert_type === 'MEDICAL_RECORD_UPDATED' ||
      ['bệnh án', 'dị ứng', 'dinh dưỡng'].some((k) => msgLower.includes(k));

    const isHouseInvite =
      inc.alert_type === 'HOUSE_INVITE_PENDING' ||
      Boolean(inc.notes?.includes('HOUSE_INVITE_PENDING')) ||
      ['lời mời bạn tham gia căn nhà', 'lời mời tham gia căn nhà', 'xác nhận vào nhà'].some((k) => msgLower.includes(k));
    const isConfigUpdate = inc.alert_type === 'DEVICE_CONFIG_UPDATED';

    if (
      isMedicalRecordMsg &&
      doctorUserId &&
      (inc.acknowledged_by === doctorUserId || Boolean(inc.notes?.includes(doctorUserId)))
    ) {
      return;
    }

    if (!isCritical && !isHouseInvite && !isAppointmentMsg && !isAssignmentMsg && !isConfigUpdate && !isMedicalRecordMsg) {
      return;
    }

    const sortTs = toTs(inc.created_at);

    if (isHouseInvite) {
      const memberIdMatch = (inc.notes || inc.note || '')?.match(/MEMBER_ID:([a-fA-F0-9-]+)/);
      const isHandled = Boolean(inc.is_acknowledged);
      const isRejected = Boolean(inc.notes?.includes('từ chối') || inc.note?.includes('từ chối'));

      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'HOUSE_INVITE',
        title: 'Lời mời phụ trách Bác sĩ gia đình',
        subtitle: rawMsg || 'Chủ hộ đã gửi lời mời bạn tham gia căn nhà với vai trò Bác sĩ gia đình.',
        timeStr: inc.created_at || '',
        sortTimestamp: sortTs,
        badgeLabel: isHandled ? (isRejected ? 'Đã từ chối' : 'Đã tham gia') : 'Chờ xác nhận',
        badgeColor: isHandled ? (isRejected ? '#DC2626' : '#059669') : '#D97706',
        badgeBg: isHandled ? (isRejected ? '#FEE2E2' : '#ECFDF5') : '#FEF3C7',
        iconName: 'mail-unread',
        iconColor: '#D97706',
        isRead: isHandled,
        targetScreen: 'DoctorHome',
        memberId: memberIdMatch?.[1],
        rawIncident: inc,
      });
    } else if (isAppointmentMsg) {
      const isCancelled = msgLower.includes('hủy') || inc.alert_type === 'APPOINTMENT_CANCELLED';
      const isConfirmed = inc.alert_type === 'APPOINTMENT_CONFIRMED' || msgLower.includes('đã xác nhận') || msgLower.includes('sẵn sàng đón tiếp');
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'APPOINTMENT',
        title: rawMsg || (isConfirmed ? 'Gia đình đã xác nhận đón tiếp' : 'Lịch khám bệnh nhân'),
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Thông báo lịch khám',
        timeStr: inc.created_at || '',
        sortTimestamp: sortTs,
        badgeLabel: isCancelled ? 'Đã hủy' : isConfirmed ? 'Đã xác nhận' : 'Lịch khám',
        badgeColor: isCancelled ? '#DC2626' : isConfirmed ? '#059669' : '#0284C7',
        badgeBg: isCancelled ? '#FEE2E2' : isConfirmed ? '#ECFDF5' : '#EFF6FF',
        iconName: isConfirmed ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'calendar',
        iconColor: isCancelled ? '#DC2626' : isConfirmed ? '#059669' : '#0284C7',
        isRead,
        targetScreen: 'DoctorAppointments',
        rawIncident: inc,
      });
    } else if (isAssignmentMsg) {
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'PATIENT_ASSIGNMENT',
        title: rawMsg || 'Phụ trách bệnh nhân mới',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Gia đình chỉ định phụ trách',
        timeStr: inc.created_at || '',
        sortTimestamp: sortTs,
        badgeLabel: 'Bệnh nhân',
        badgeColor: '#059669',
        badgeBg: '#ECFDF5',
        iconName: 'people',
        iconColor: '#059669',
        isRead,
        targetScreen: 'DoctorPatients',
        rawIncident: inc,
      });
    } else if (isMedicalRecordMsg) {
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'INCIDENT',
        title: rawMsg || 'Cập nhật hồ sơ bệnh án',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Vừa xong',
        timeStr: inc.created_at || '',
        sortTimestamp: sortTs,
        badgeLabel: 'Hồ sơ y tế',
        badgeColor: '#4F46E5',
        badgeBg: '#EEF2FF',
        iconName: 'document-text',
        iconColor: '#4F46E5',
        isRead,
        targetScreen: 'DoctorPatients',
        rawIncident: inc,
      });
    } else {
      const matchedPatient = matchPatientForIncident(inc, allPatients, rawMsg);
      const targetPatientId =
        matchedPatient?.id ||
        inc.elderly_id ||
        (inc.notes?.includes('PATIENT:') ? inc.notes.split('PATIENT:')[1].split('|')[0].trim() : undefined);
      const snap = extractIncidentVitals(inc);
      const liveHr = matchedPatient?.is_online && matchedPatient.heart_rate ? matchedPatient.heart_rate : undefined;
      const liveSpo2 = matchedPatient?.is_online && matchedPatient.spo2 ? matchedPatient.spo2 : undefined;
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'INCIDENT',
        title: rawMsg || (isConfigUpdate ? 'Cập nhật ngưỡng y tế' : isCritical ? 'Cảnh báo sự cố té ngã khẩn cấp' : 'Cảnh báo y tế'),
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Vừa xong',
        timeStr: inc.created_at || '',
        sortTimestamp: sortTs,
        badgeLabel: isConfigUpdate ? 'Cấu hình' : isCritical ? 'Khẩn cấp' : 'Cảnh báo',
        badgeColor: isConfigUpdate ? '#2563EB' : isCritical ? '#DC2626' : '#D97706',
        badgeBg: isConfigUpdate ? '#EFF6FF' : isCritical ? '#FEE2E2' : '#FEF3C7',
        iconName: isConfigUpdate ? 'options-outline' : isCritical ? 'alert-circle' : 'warning',
        iconColor: isConfigUpdate ? '#2563EB' : isCritical ? '#DC2626' : '#D97706',
        isRead,
        patientId: targetPatientId,
        patientName: matchedPatient?.name || inc.patient_name || extractNameFromAlertMessage(rawMsg),
        heartRate: snap.heartRate ?? liveHr,
        spo2: snap.spo2 ?? liveSpo2,
        targetScreen: targetPatientId ? 'DoctorPatientDetail' : 'DoctorPatients',
        targetParams: targetPatientId ? { patientId: targetPatientId } : undefined,
        rawIncident: inc,
      });
    }
  });

  // 2. Bệnh nhân có trạng thái sinh hiệu NGUY CẤP (chỉ khi đang trực tuyến và có dữ liệu sinh hiệu)
  warningPatients
    .filter((pat) => Boolean(pat.is_online) && pat.health_status === 'DANGER')
    .forEach((pat) => {
      unifiedList.push({
        id: `pat_${pat.id}`,
        type: 'PATIENT_WARNING',
        title: `${pat.name} - Sinh hiệu nguy cấp`,
        subtitle: `Nhịp tim: ${pat.heart_rate ?? '--'} bpm • SpO2: ${pat.spo2 ?? '--'}% • ${pat.house_address || (pat.house_name && pat.house_name !== 'Nhà của tôi' ? pat.house_name : 'Nhà riêng')}`,
        timeStr: '',
        sortTimestamp: Date.now(),
        badgeLabel: 'Nguy cấp',
        badgeColor: '#DC2626',
        badgeBg: '#FEE2E2',
        iconName: 'heart-dislike',
        iconColor: '#DC2626',
        isRead: readIds.has(`pat_${pat.id}`),
        patientId: pat.id,
        targetScreen: 'DoctorPatientDetail',
        targetParams: { patientId: pat.id },
      });
    });

  // 3. Lịch khám hôm nay và sắp tới
  const allApts = [...appointments];
  upcomingAppointments.forEach((apt) => {
    if (!allApts.some((a) => a.id === apt.id)) allApts.push(apt);
  });

  const todayStr = getLocalTodayYMD();
  allApts.forEach((apt) => {
    const isToday = toLocalYMD(apt.scheduled_at) === todayStr;
    const isCompleted = apt.status === 'COMPLETED';
    const isCancelled = apt.status === 'CANCELLED';
    const isConfirmed = apt.status === 'CONFIRMED';
    const isOverdue = isAppointmentOverdue(apt.scheduled_at, apt.status);
    const color = isCompleted
      ? '#16A34A'
      : isCancelled
        ? '#DC2626'
        : isOverdue
          ? '#EA580C'
          : isConfirmed
            ? '#0D9488'
            : '#0284C7';
    const bgCol = isCompleted
      ? '#DCFCE7'
      : isCancelled
        ? '#FEE2E2'
        : isOverdue
          ? '#FFEDD5'
          : isConfirmed
            ? '#CCFBF1'
            : '#EFF6FF';
    const label = isCompleted
      ? 'Đã khám'
      : isCancelled
        ? 'Đã hủy'
        : isOverdue
          ? 'Quá giờ'
          : isConfirmed
            ? 'Đã xác nhận'
            : isToday
              ? 'Khám hôm nay'
              : 'Sắp tới';

    unifiedList.push({
      id: `apt_${apt.id}`,
      type: 'APPOINTMENT',
      title: `Lịch khám: ${apt.patient_name || 'Bệnh nhân'}`,
      subtitle: `${formatDate(apt.scheduled_at)} · ${apt.visit_type === 'HOME_VISIT' ? 'Khám tại nhà' : 'Tại phòng khám'}`,
      timeStr: apt.scheduled_at || '',
      sortTimestamp: toTs(apt.scheduled_at),
      badgeLabel: label,
      badgeColor: color,
      badgeBg: bgCol,
      iconName: isOverdue ? 'alert-circle' : isToday ? 'time' : 'calendar',
      iconColor: color,
      isRead: readIds.has(`apt_${apt.id}`),
      patientId: apt.patient_id,
      rawAppointment: apt,
      targetScreen: 'DoctorAppointments',
    });
  });

  return unifiedList.sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0));
}

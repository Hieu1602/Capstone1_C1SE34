import { Ionicons } from '@expo/vector-icons';
import type { Incident } from '../../../../store/useAlertStore';
import type { AppointmentItem, PatientCardData } from '../types';

export type TabType = 'ALL' | 'UNREAD' | 'ALERTS' | 'APPOINTMENTS';

export interface UnifiedNotification {
  id: string;
  rawIncidentId?: string;
  type: 'INCIDENT' | 'PATIENT_WARNING' | 'APPOINTMENT' | 'PATIENT_ASSIGNMENT' | 'HOUSE_INVITE';
  title: string;
  subtitle: string;
  timeStr: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  isRead: boolean;
  patientId?: string;
  rawAppointment?: AppointmentItem;
  targetScreen: 'DoctorAppointments' | 'DoctorPatients' | 'DoctorPatientDetail' | 'DoctorHome';
  targetParams?: any;
  rawIncident?: Incident;
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
    return dateStr.slice(0, 10) === new Date().toISOString().slice(0, 10)
      ? `Hôm nay, ${formatTime(dateStr)}`
      : `${d.getDate()}/${d.getMonth() + 1} lúc ${formatTime(dateStr)}`;
  } catch {
    return '';
  }
}

export const EMPTY_TAB_CONFIG: Record<TabType, { title: string; sub: string }> = {
  UNREAD: { title: 'Tuyệt vời! Không còn thông báo chưa đọc', sub: 'Bác sĩ đã xem và xử lý toàn bộ các thông báo y tế.' },
  ALERTS: { title: 'Không có cảnh báo bất thường', sub: 'Tất cả các bệnh nhân đều đang có sinh hiệu bình thường.' },
  APPOINTMENTS: { title: 'Không có lịch khám mới', sub: 'Bác sĩ có thể chủ động đặt lịch thăm khám định kỳ cho các cụ.' },
  ALL: { title: 'Mọi thứ đều ổn định', sub: 'Hiện không có cảnh báo sức khỏe khẩn cấp hay lịch hẹn nào cần xử lý.' },
};

export function getMedicalRecommendation(type: UnifiedNotification['type']): string {
  switch (type) {
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

export function buildUnifiedNotifications(params: {
  incidents: Incident[];
  warningPatients: PatientCardData[];
  appointments: AppointmentItem[];
  upcomingAppointments: AppointmentItem[];
  readIds: Set<string>;
}): UnifiedNotification[] {
  const { incidents, warningPatients, appointments, upcomingAppointments, readIds } = params;
  const unifiedList: UnifiedNotification[] = [];

  // 1. Cảnh báo khẩn cấp & Thông báo hệ thống từ incidents
  incidents.forEach((inc) => {
    const isCritical = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED';
    const rawMsg = inc.message || '';
    const msgLower = rawMsg.toLowerCase();
    const isRead = Boolean(inc.is_acknowledged || readIds.has(inc.id) || readIds.has(`inc_${inc.id}`));

    const isAppointmentMsg =
      ['APPOINTMENT_CONFIRMED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CANCELLED'].includes(inc.alert_type || '') ||
      ['lịch khám', 'lịch hẹn', 'đã hủy', '[đã hủy]', 'tái khám', 'xác nhận lịch'].some((k) => msgLower.includes(k));

    const isAssignmentMsg = ['chủ hộ', 'phụ trách', 'chỉ định', 'bệnh nhân mới'].some((k) => msgLower.includes(k));

    const isMedicalRecordMsg =
      inc.alert_type === 'MEDICAL_RECORD_UPDATED' ||
      ['bệnh án', 'dị ứng', 'dinh dưỡng'].some((k) => msgLower.includes(k));

    const isHouseInvite =
      inc.alert_type === 'HOUSE_INVITE_PENDING' ||
      Boolean(inc.notes?.includes('HOUSE_INVITE_PENDING')) ||
      ['lời mời bạn tham gia căn nhà', 'lời mời tham gia căn nhà', 'xác nhận vào nhà'].some((k) => msgLower.includes(k));

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
        badgeLabel: isCancelled ? 'Đã hủy' : isConfirmed ? 'Đã xác nhận' : 'Lịch khám',
        badgeColor: isCancelled ? '#DC2626' : isConfirmed ? '#059669' : '#0284C7',
        badgeBg: isCancelled ? '#FEE2E2' : isConfirmed ? '#ECFDF5' : '#EFF6FF',
        iconName: isConfirmed ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'calendar',
        iconColor: isCancelled ? '#DC2626' : isConfirmed ? '#059669' : '#0284C7',
        isRead,
        targetScreen: 'DoctorAppointments',
      });
    } else if (isAssignmentMsg) {
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'PATIENT_ASSIGNMENT',
        title: rawMsg || 'Phụ trách bệnh nhân mới',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Gia đình chỉ định phụ trách',
        timeStr: inc.created_at || '',
        badgeLabel: 'Bệnh nhân',
        badgeColor: '#059669',
        badgeBg: '#ECFDF5',
        iconName: 'people',
        iconColor: '#059669',
        isRead,
        targetScreen: 'DoctorPatients',
      });
    } else if (isMedicalRecordMsg) {
      const targetPatientId = inc.notes?.includes('PATIENT:') ? inc.notes.split('PATIENT:')[1].split('|')[0].trim() : undefined;
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'PATIENT_WARNING',
        title: rawMsg || 'Hồ sơ bệnh án được cập nhật',
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Chủ nhà đã cập nhật hồ sơ',
        timeStr: inc.created_at || '',
        badgeLabel: 'Hồ sơ y tế',
        badgeColor: '#0284C7',
        badgeBg: '#EFF6FF',
        iconName: 'document-text',
        iconColor: '#0284C7',
        isRead,
        patientId: targetPatientId,
        targetScreen: targetPatientId ? 'DoctorPatientDetail' : 'DoctorPatients',
        targetParams: targetPatientId ? { patientId: targetPatientId } : undefined,
      });
    } else {
      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type: 'INCIDENT',
        title: rawMsg || (isCritical ? 'Cảnh báo sự cố té ngã khẩn cấp' : 'Cảnh báo y tế'),
        subtitle: inc.created_at ? formatDate(inc.created_at) : 'Vừa xong',
        timeStr: inc.created_at || '',
        badgeLabel: isCritical ? 'Khẩn cấp' : 'Cảnh báo',
        badgeColor: isCritical ? '#DC2626' : '#D97706',
        badgeBg: isCritical ? '#FEE2E2' : '#FEF3C7',
        iconName: isCritical ? 'alert-circle' : 'warning',
        iconColor: isCritical ? '#DC2626' : '#D97706',
        isRead,
        targetScreen: 'DoctorPatients',
      });
    }
  });

  // 2. Bệnh nhân có trạng thái sức khỏe cảnh báo (WARNING / DANGER)
  warningPatients.forEach((pat) => {
    const isDanger = pat.health_status === 'DANGER';
    unifiedList.push({
      id: `pat_${pat.id}`,
      type: 'PATIENT_WARNING',
      title: `${pat.name} - Cần chú ý theo dõi`,
      subtitle: `Nhịp tim: ${pat.heart_rate ?? '--'} bpm • SpO2: ${pat.spo2 ?? '--'}% • ${pat.house_address || (pat.house_name && pat.house_name !== 'Nhà của tôi' ? pat.house_name : 'Nhà riêng')}`,
      timeStr: '',
      badgeLabel: isDanger ? 'Nguy cấp' : 'Cần chú ý',
      badgeColor: isDanger ? '#DC2626' : '#D97706',
      badgeBg: isDanger ? '#FEE2E2' : '#FEF3C7',
      iconName: 'heart-dislike',
      iconColor: isDanger ? '#DC2626' : '#D97706',
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

  const todayStr = new Date().toISOString().slice(0, 10);
  allApts.forEach((apt) => {
    const isToday = apt.scheduled_at?.slice(0, 10) === todayStr;
    const isCompleted = apt.status === 'COMPLETED';
    const isCancelled = apt.status === 'CANCELLED';
    const color = isCompleted ? '#16A34A' : isCancelled ? '#DC2626' : '#0284C7';
    const bgCol = isCompleted ? '#DCFCE7' : isCancelled ? '#FEE2E2' : '#EFF6FF';
    const label = isCompleted ? 'Đã khám' : isCancelled ? 'Đã hủy' : isToday ? 'Khám hôm nay' : 'Sắp tới';

    unifiedList.push({
      id: `apt_${apt.id}`,
      type: 'APPOINTMENT',
      title: `Lịch khám: ${apt.patient_name || 'Bệnh nhân'}`,
      subtitle: `${formatDate(apt.scheduled_at)} · ${apt.visit_type === 'HOME_VISIT' ? 'Khám tại nhà' : 'Tại phòng khám'}`,
      timeStr: apt.scheduled_at || '',
      badgeLabel: label,
      badgeColor: color,
      badgeBg: bgCol,
      iconName: isToday ? 'time' : 'calendar',
      iconColor: color,
      isRead: readIds.has(`apt_${apt.id}`),
      patientId: apt.patient_id,
      rawAppointment: apt,
      targetScreen: 'DoctorAppointments',
    });
  });

  return unifiedList;
}

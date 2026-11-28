// src/components/layout/navbarNotifications.ts
// Helpers tải và chuẩn hóa danh sách thông báo cho DoctorNavbar (tái sử dụng hằng số từ notificationBuilder)

import { doctorApi, householdApi, incidentsApi, systemNotificationsApi } from '../../services/api';
import type { Incident, AppointmentItem, DoctorPatientCard, SystemNotification } from '../../types';
import type { UnifiedNotification } from '../clinical/NotificationDetailModal';
import { cleanNotificationText, getStoredReadIds } from '../../utils/notificationSync';
import {
  ADMIN_BADGE_MAP,
  DEFAULT_ADMIN_BADGE,
  DEVICE_OP_KEYWORDS,
  formatNotificationTime,
  parseTitleAndBody,
} from '../../utils/notificationBuilder';
import { isAppointmentOverdue } from '../../utils/appointmentHelpers';

function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatNavbarDate(dateStr?: string): string {
  if (!dateStr) return 'Vừa xong';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Vừa xong';
    const todayStr = toLocalYMD(new Date());
    const time = formatNotificationTime(dateStr);
    return toLocalYMD(d) === todayStr
      ? `Hôm nay, ${time}`
      : `${d.getDate()}/${d.getMonth() + 1} lúc ${time}`;
  } catch {
    return 'Vừa xong';
  }
}

export async function fetchDoctorNavbarNotifications(doctorUserId?: string): Promise<UnifiedNotification[]> {
  const [incRes, patRes, aptRes, , sysRes] = await Promise.allSettled([
    incidentsApi.list(undefined, 50),
    doctorApi.getPatients(),
    doctorApi.getAppointments(),
    householdApi.getInvites(),
    systemNotificationsApi.getActiveBroadcasts('doctors'),
  ]);

  const savedReadIds = getStoredReadIds();
  const unifiedList: UnifiedNotification[] = [];

  // 0. Thông báo toàn hệ thống từ Web Admin (System Notifications & Broadcasts)
  if (sysRes.status === 'fulfilled' && Array.isArray(sysRes.value)) {
    sysRes.value.forEach((sys: SystemNotification) => {
      const sysId = `sys_${sys.id}`;
      const badge = ADMIN_BADGE_MAP[sys.type] || DEFAULT_ADMIN_BADGE;

      unifiedList.push({
        id: sysId,
        type: 'ADMIN',
        title: sys.title,
        subtitle: sys.body,
        timeStr: formatNavbarDate(sys.published_at || sys.created_at),
        badgeLabel: badge.label,
        badgeColor: badge.color,
        badgeBg: badge.bg,
        isRead: Boolean(savedReadIds.has(sysId) || savedReadIds.has(sys.id)),
        targetUrl: '/notifications',
        patientName: 'Ban Quản Trị Hệ Thống (Admin)',
        adminNotification: sys,
      });
    });
  }

  // 1. Cảnh báo và sự cố từ Backend API /notifications (Đồng bộ thời gian thực có lọc chống Alert Fatigue)
  const patList: DoctorPatientCard[] =
    patRes.status === 'fulfilled' && Array.isArray(patRes.value) ? patRes.value : [];

  if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) {
    incRes.value.forEach((inc: Incident) => {
      const rawMsg = cleanNotificationText(inc.message || '');
      const msgLower = rawMsg.toLowerCase();

      // Lọc tầng UI: Tuyệt đối ẩn cảnh báo vận hành thiết bị (pin, sạc, mất kết nối)
      const isDeviceOp =
        DEVICE_OP_KEYWORDS.some((k) => msgLower.includes(k)) ||
        Boolean(inc.alert_type?.startsWith('BATTERY_') || inc.alert_type?.startsWith('DEVICE_'));
      if (isDeviceOp) return;

      const isCritical =
        inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED' || inc.alert_type === 'LOW_SPO2';
      const isHouseInvite =
        inc.alert_type === 'HOUSE_INVITE_PENDING' ||
        Boolean(inc.notes?.includes('HOUSE_INVITE_PENDING')) ||
        ['lời mời bạn tham gia căn nhà', 'lời mời tham gia căn nhà', 'xác nhận vào nhà'].some((k) =>
          msgLower.includes(k)
        );
      const isAppointmentMsg =
        Boolean(inc.alert_type?.startsWith('APPOINTMENT_')) ||
        ['lịch khám', 'lịch hẹn', 'đã hủy', '[đã hủy]', 'tái khám', 'xác nhận lịch'].some((k) =>
          msgLower.includes(k)
        );
      const isAssignmentMsg = ['chủ hộ', 'phụ trách', 'chỉ định', 'bệnh nhân mới'].some((k) =>
        msgLower.includes(k)
      );
      const isMedicalRecordMsg =
        inc.alert_type === 'MEDICAL_RECORD_UPDATED' ||
        ['bệnh án', 'dị ứng', 'dinh dưỡng'].some((k) => msgLower.includes(k));

      // Chống tự làm phiền (No Self-Notification khi bác sĩ tự cập nhật hồ sơ)
      if (
        isMedicalRecordMsg &&
        (inc.acknowledged_by === doctorUserId || (doctorUserId && inc.notes?.includes(doctorUserId)))
      ) {
        return;
      }

      // Tuyệt đối ẩn dao động nhẹ; Bác sĩ chỉ nhận Cảnh báo Nguy cấp HOẶC Lịch khám / Lời mời
      if (!isCritical && !isHouseInvite && !isAppointmentMsg && !isAssignmentMsg) {
        return;
      }

      const isRead = Boolean(inc.is_acknowledged || savedReadIds.has(inc.id) || savedReadIds.has(`inc_${inc.id}`));
      const timeStr = formatNavbarDate(inc.created_at);

      let type: UnifiedNotification['type'] = 'ALERT';
      let title = rawMsg;
      const subtitle = isHouseInvite
        ? rawMsg || 'Chủ hộ đã gửi lời mời bạn tham gia căn nhà với vai trò Bác sĩ gia đình.'
        : timeStr;
      let badgeLabel = isCritical ? 'Khẩn cấp' : 'Cảnh báo';
      let badgeColor = isCritical
        ? 'text-rose-700 bg-rose-50 border-rose-200'
        : 'text-amber-700 bg-amber-50 border-amber-200';
      let badgeBg = isCritical ? 'bg-rose-50' : 'bg-amber-50';
      let targetUrl = '/patients';
      let finalRead = isRead;

      if (isHouseInvite) {
        type = 'INVITE';
        title = 'Lời mời phụ trách Bác sĩ gia đình';
        const isHandled = Boolean(inc.is_acknowledged);
        const isRejected = Boolean(inc.notes?.includes('từ chối') || inc.note?.includes('từ chối'));
        badgeLabel = isHandled ? (isRejected ? 'Đã từ chối' : 'Đã tham gia') : 'Lời mời';
        badgeColor = isHandled
          ? isRejected
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : 'text-amber-700 bg-amber-50 border-amber-200';
        badgeBg = isHandled ? (isRejected ? 'bg-rose-50' : 'bg-emerald-50') : 'bg-amber-50';
        targetUrl = '/';
        finalRead = isHandled;
      } else if (isAppointmentMsg) {
        type = 'APPOINTMENT';
        const isCancelled = msgLower.includes('hủy') || inc.alert_type === 'APPOINTMENT_CANCELLED';
        const isConfirmed =
          inc.alert_type === 'APPOINTMENT_CONFIRMED' ||
          msgLower.includes('đã xác nhận') ||
          msgLower.includes('sẵn sàng đón tiếp');
        title = rawMsg || (isConfirmed ? 'Gia đình đã xác nhận đón tiếp' : 'Lịch khám bệnh nhân');
        badgeLabel = isCancelled ? 'Đã hủy' : isConfirmed ? 'Đã xác nhận' : 'Lịch khám';
        badgeColor = isCancelled
          ? 'text-rose-700 bg-rose-50 border-rose-200'
          : isConfirmed
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : 'text-sky-700 bg-sky-50 border-sky-200';
        badgeBg = isCancelled ? 'bg-rose-50' : isConfirmed ? 'bg-emerald-50' : 'bg-sky-50';
        targetUrl = '/appointments';
      } else if (isAssignmentMsg) {
        title = rawMsg || 'Phụ trách bệnh nhân mới';
        badgeLabel = 'Bệnh nhân';
        badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        badgeBg = 'bg-emerald-50';
      } else if (isMedicalRecordMsg) {
        title = rawMsg || 'Hồ sơ bệnh án được cập nhật';
        badgeLabel = 'Hồ sơ y tế';
        badgeColor = 'text-indigo-700 bg-indigo-50 border-indigo-200';
        badgeBg = 'bg-indigo-50';
      } else if (!rawMsg) {
        title = isCritical ? 'Cảnh báo sự cố té ngã khẩn cấp' : 'Cảnh báo y tế';
      }

      const patIdx = patList.findIndex(
        (p) => p.id === (inc as unknown as { elderly_id?: string }).elderly_id || (inc.notes && inc.notes.includes(p.id))
      );
      const matchedPat = patIdx >= 0 ? patList[patIdx] : undefined;
      const mrCode = patIdx >= 0 ? `MR-${String(patIdx + 1).padStart(3, '0')}` : undefined;
      const pName = matchedPat?.name || (isHouseInvite ? 'Hộ gia đình mới' : undefined);
      const parsed = parseTitleAndBody(inc.message || '', type, inc.alert_type, inc.alert_level, pName);
      if (parsed.title) title = parsed.title;
      const repeatCount = inc.repeat_count || 1;
      const repeatBadge = inc.repeat_badge || (repeatCount > 1 ? `Lặp lại ${repeatCount} lần trong 15 phút qua` : undefined);

      unifiedList.push({
        id: `inc_${inc.id}`,
        rawIncidentId: inc.id,
        type,
        title,
        subtitle,
        timeStr,
        badgeLabel,
        badgeColor,
        badgeBg,
        isRead: finalRead,
        targetUrl,
        rawIncident: inc,
        patientId: matchedPat?.id,
        patientName: pName,
        patientMrCode: mrCode,
        repeatCount,
        repeatBadge,
        patientAddress: matchedPat?.house_address || matchedPat?.house_name,
        heartRate: matchedPat?.heart_rate && matchedPat.heart_rate > 0 ? matchedPat.heart_rate : undefined,
        spo2: matchedPat?.spo2 && matchedPat.spo2 > 0 ? matchedPat.spo2 : undefined,
        alertLevel: inc.alert_level,
        alertType: inc.alert_type,
      });
    });
  }

  // 2. Bệnh nhân có trạng thái sinh hiệu NGUY CẤP (DANGER)
  patList.forEach((p, idx) => {
    const pId = `pat_${p.id}`;
    if (p.health_status === 'DANGER' && !unifiedList.some((item) => item.id === pId)) {
      unifiedList.push({
        id: pId,
        type: 'ALERT',
        title: `${p.name} - Nguy cơ suy giảm sinh hiệu nghiêm trọng`,
        subtitle: `Nhịp tim: ${p.heart_rate || '--'} bpm • SpO2: ${p.spo2 || '--'}% • ${p.house_address || p.house_name || 'Nhà riêng'}`,
        timeStr: 'Hôm nay',
        badgeLabel: 'Nguy cấp',
        badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
        badgeBg: 'bg-rose-50',
        isRead: savedReadIds.has(pId),
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

  // 3. Lịch khám từ Doctor API (UPCOMING & TODAY)
  if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) {
    const todayStr = toLocalYMD(new Date());
    aptRes.value.forEach((apt: AppointmentItem) => {
      const aptId = `apt_${apt.id}`;
      if (unifiedList.some((item) => item.id === aptId)) return;

      const aptDt = apt.scheduled_at ? new Date(apt.scheduled_at) : null;
      const isToday = Boolean(aptDt && !isNaN(aptDt.getTime()) && toLocalYMD(aptDt) === todayStr);
      const isCompleted = apt.status === 'COMPLETED';
      const isCancelled = apt.status === 'CANCELLED';
      const isConfirmed = apt.status === 'CONFIRMED';
      const isOverdue = isAppointmentOverdue(apt.scheduled_at, apt.status);
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
      const formattedDate = formatNavbarDate(apt.scheduled_at);

      unifiedList.push({
        id: aptId,
        type: 'APPOINTMENT',
        title: `Lịch khám: ${apt.patient_name || 'Bệnh nhân'}`,
        subtitle: `${formattedDate} · ${apt.visit_type === 'HOME_VISIT' ? 'Khám tại nhà' : 'Tại phòng khám'}`,
        timeStr: formattedDate,
        badgeLabel: label,
        badgeColor: isCompleted
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : isCancelled
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : isOverdue
              ? 'text-orange-700 bg-orange-50 border-orange-200'
              : isConfirmed
                ? 'text-teal-700 bg-teal-50 border-teal-200'
                : 'text-sky-700 bg-sky-50 border-sky-200',
        badgeBg: isCompleted ? 'bg-emerald-50' : isCancelled ? 'bg-rose-50' : isOverdue ? 'bg-orange-50' : isConfirmed ? 'bg-teal-50' : 'bg-sky-50',
        isRead: savedReadIds.has(aptId),
        targetUrl: '/appointments',
        patientName: apt.patient_name,
        patientAddress: apt.location,
      });
    });
  }

  const tsOf = (s?: string) => {
    if (!s) return 0;
    const t = new Date(s).getTime();
    return isNaN(t) ? 0 : t;
  };
  const timeById = new Map<string, number>();
  if (sysRes.status === 'fulfilled' && Array.isArray(sysRes.value)) {
    sysRes.value.forEach((s: SystemNotification) => timeById.set(`sys_${s.id}`, tsOf(s.published_at || s.created_at)));
  }
  if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) {
    incRes.value.forEach((i: Incident) => timeById.set(`inc_${i.id}`, tsOf(i.created_at)));
  }
  if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) {
    aptRes.value.forEach((a: AppointmentItem) => timeById.set(`apt_${a.id}`, tsOf(a.scheduled_at)));
  }
  return unifiedList.sort((a, b) => (timeById.get(b.id) || 0) - (timeById.get(a.id) || 0));
}

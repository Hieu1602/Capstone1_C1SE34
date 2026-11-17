// src/components/layout/DoctorNavbar.tsx
// Thanh điều hướng trên cùng mang phong cách Y Tế Clinical Care (kèm thanh tìm kiếm nhanh ⌘K & Trung tâm thông báo lâm sàng đồng bộ 100% với Mobile App & Backend)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../../store/useDoctorAuthStore';
import { doctorApi, householdApi, incidentsApi, authApi, systemNotificationsApi } from '../../services/api';
import { doctorWebSocket } from '../../services/websocket';
import type { Incident, AppointmentItem, DoctorPatientCard, SystemNotification } from '../../types';
import {
  Bell,
  LogOut,
  ShieldCheck,
  UserCheck,
  Search,
  Settings,
  AlertTriangle,
  AlertCircle,
  Calendar,
  CheckCheck,
  Check,
  ChevronRight,
  Sparkles,
  Moon,
  Sun,
  RotateCcw,
  Megaphone,
  X,
} from 'lucide-react';
import { NotificationDetailModal, UnifiedNotification } from '../clinical/NotificationDetailModal';
import {
  getStoredReadIds,
  markAllAsReadWithUndo,
  restorePreviousReadState,
  markAsRead,
  toggleReadStatus,
  hasUndoSnapshot,
  NOTIFS_SYNC_EVENT,
  cleanNotificationText,
  SyncPayload,
} from '../../utils/notificationSync';

type TabType = 'ALL' | 'CRITICAL' | 'APPOINTMENTS';

const READ_STORAGE_KEY = '@doctor_web_read_notifs';

function formatTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Vừa xong';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Vừa xong';
    const todayStr = new Date().toISOString().slice(0, 10);
    return dateStr.slice(0, 10) === todayStr
      ? `Hôm nay, ${formatTime(dateStr)}`
      : `${d.getDate()}/${d.getMonth() + 1} lúc ${formatTime(dateStr)}`;
  } catch {
    return 'Vừa xong';
  }
}

export const DoctorNavbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useDoctorAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifTab, setNotifTab] = useState<TabType>('ALL');
  const [quickSearch, setQuickSearch] = useState('');
  const [isDark, setIsDark] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('@doctor_theme') === 'dark';
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('@doctor_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('@doctor_theme', 'light');
    }
  };

  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<UnifiedNotification | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());
  const [canUndo, setCanUndo] = useState<boolean>(() => hasUndoSnapshot());

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notifDropdownRef = useRef<HTMLDivElement | null>(null);
  const doctorName = user?.full_name || 'BS. Trần Văn Minh';

  // Chữ cái viết tắt chuẩn xác: "M" (trong "Minh") thay vì "B" (trong "BS.")
  const getDoctorInitial = (name?: string) => {
    if (!name) return 'M';
    const clean = name.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
  };

  const doctorInitial = getDoctorInitial(doctorName);

  // Avatar Bác sĩ lấy từ tài khoản hoặc localStorage đồng bộ với Mobile App
  const [doctorAvatar, setDoctorAvatar] = useState<string | null>(() => {
    return getDoctorAvatarUri(user?.avatar_url);
  });

  useEffect(() => {
    // Tự động đồng bộ thông tin hồ sơ và avatar mới nhất từ CSDL Backend
    authApi.getMe().then((me) => {
      if (me) {
        useDoctorAuthStore.getState().updateUser(me);
        setDoctorAvatar(getDoctorAvatarUri(me.avatar_url));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setDoctorAvatar(getDoctorAvatarUri(user?.avatar_url));
    };

    window.addEventListener('doctor-profile-updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('doctor-profile-updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [user]);

  // Lắng nghe sự kiện đồng bộ trạng thái đọc/chưa đọc toàn cục từ bất kỳ component nào (0ms)
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<SyncPayload>;
      const nextSet = customEvent.detail?.readIds
        ? new Set(customEvent.detail.readIds)
        : getStoredReadIds();
      setReadIds(nextSet);
      setCanUndo(customEvent.detail?.canUndo ?? hasUndoSnapshot());
      setNotifications((prev) =>
        prev.map((n) => {
          const isRead = Boolean(
            nextSet.has(n.id) ||
            (n.rawIncidentId && (nextSet.has(n.rawIncidentId) || nextSet.has(`inc_${n.rawIncidentId}`)))
          );
          return { ...n, isRead };
        })
      );
    };

    window.addEventListener(NOTIFS_SYNC_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(NOTIFS_SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const fetchNotifData = useCallback(async () => {
    try {
      const [incRes, patRes, aptRes, invRes, sysRes] = await Promise.allSettled([
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
          const isRead = Boolean(savedReadIds.has(sysId) || savedReadIds.has(sys.id));
          const timeStr = formatDate(sys.published_at || sys.created_at);

          let badgeLabel = 'Thông báo Admin';
          let badgeColor = 'text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300';
          let badgeBg = 'bg-sky-50';

          if (sys.type === 'system_maintenance') {
            badgeLabel = 'Bảo trì hệ thống';
            badgeColor = 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
            badgeBg = 'bg-amber-50';
          } else if (sys.type === 'emergency') {
            badgeLabel = 'Khẩn cấp Admin';
            badgeColor = 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300';
            badgeBg = 'bg-rose-50';
          } else if (sys.type === 'feature_update') {
            badgeLabel = 'Cập nhật tính năng';
            badgeColor = 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
            badgeBg = 'bg-blue-50';
          } else if (sys.type === 'health_tip') {
            badgeLabel = 'Chỉ dẫn y tế';
            badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300';
            badgeBg = 'bg-emerald-50';
          }

          unifiedList.push({
            id: sysId,
            type: 'ADMIN',
            title: sys.title,
            subtitle: sys.body,
            timeStr,
            badgeLabel,
            badgeColor,
            badgeBg,
            isRead,
            targetUrl: '/notifications',
            patientName: 'Ban Quản Trị Hệ Thống (Admin)',
            adminNotification: sys,
          });
        });
      }

      // 1. Cảnh báo và sự cố từ Backend API /notifications (Đồng bộ thời gian thực với Mobile App và CSDL)
      // 1. Cảnh báo và sự cố từ Backend API /notifications (Đồng bộ thời gian thực có lọc chống Alert Fatigue)
      if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) {
        const patList = (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) ? patRes.value : [];

        incRes.value.forEach((inc: Incident) => {
          const rawMsg = cleanNotificationText(inc.message || '');
          const msgLower = rawMsg.toLowerCase();

          // Lọc tầng UI: Tuyệt đối ẩn cảnh báo vận hành thiết bị (pin, sạc, mất kết nối)
          const isDeviceOp =
            ['pin', 'sạc', 'mất kết nối', 'ngắt kết nối', 'ngoại tuyến', 'offline', 'mất tín hiệu'].some((k) => msgLower.includes(k)) ||
            Boolean(inc.alert_type?.startsWith('BATTERY_') || inc.alert_type?.startsWith('DEVICE_'));
          if (isDeviceOp) return;

          const isCritical = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED' || inc.alert_type === 'LOW_SPO2';
          const isHouseInvite =
            inc.alert_type === 'HOUSE_INVITE_PENDING' ||
            Boolean(inc.notes?.includes('HOUSE_INVITE_PENDING')) ||
            ['lời mời bạn tham gia căn nhà', 'lời mời tham gia căn nhà', 'xác nhận vào nhà'].some((k) => msgLower.includes(k));
          const isAppointmentMsg =
            ['APPOINTMENT_CONFIRMED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CANCELLED'].includes(inc.alert_type || '') ||
            ['lịch khám', 'lịch hẹn', 'đã hủy', '[đã hủy]', 'tái khám', 'xác nhận lịch'].some((k) => msgLower.includes(k));
          const isAssignmentMsg = ['chủ hộ', 'phụ trách', 'chỉ định', 'bệnh nhân mới'].some((k) => msgLower.includes(k));
          const isMedicalRecordMsg =
            inc.alert_type === 'MEDICAL_RECORD_UPDATED' ||
            ['bệnh án', 'dị ứng', 'dinh dưỡng'].some((k) => msgLower.includes(k));

          // Chống tự làm phiền (No Self-Notification khi bác sĩ tự cập nhật hồ sơ)
          if (isMedicalRecordMsg && (inc.acknowledged_by === user?.id || (user?.id && inc.notes?.includes(user.id)))) {
            return;
          }

          // Tuyệt đối ẩn dao động nhẹ; Bác sĩ chỉ nhận Cảnh báo Nguy cấp HOẶC Lịch khám / Lời mời
          if (!isCritical && !isHouseInvite && !isAppointmentMsg && !isAssignmentMsg) {
            return;
          }

          const isRead = Boolean(inc.is_acknowledged || savedReadIds.has(inc.id) || savedReadIds.has(`inc_${inc.id}`));
          const timeStr = formatDate(inc.created_at);

          let type: UnifiedNotification['type'] = 'ALERT';
          let title = rawMsg;
          let subtitle = timeStr;
          let badgeLabel = isCritical ? 'Khẩn cấp' : 'Cảnh báo';
          let badgeColor = isCritical ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200';
          let badgeBg = isCritical ? 'bg-rose-50' : 'bg-amber-50';
          let targetUrl = '/patients';
          let finalRead = isRead;

          if (isHouseInvite) {
            type = 'INVITE';
            title = 'Lời mời phụ trách Bác sĩ gia đình';
            subtitle = rawMsg || 'Chủ hộ đã gửi lời mời bạn tham gia căn nhà với vai trò Bác sĩ gia đình.';
            const isHandled = Boolean(inc.is_acknowledged);
            const isRejected = Boolean(inc.notes?.includes('từ chối') || inc.note?.includes('từ chối'));
            badgeLabel = isHandled ? (isRejected ? 'Đã từ chối' : 'Đã tham gia') : 'Lời mời';
            badgeColor = isHandled
              ? isRejected ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-amber-700 bg-amber-50 border-amber-200';
            badgeBg = isHandled ? (isRejected ? 'bg-rose-50' : 'bg-emerald-50') : 'bg-amber-50';
            targetUrl = '/';
            finalRead = isHandled || isRead;
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

          const patIdx = patList.findIndex((p: DoctorPatientCard) => p.id === (inc as any).elderly_id || (inc.notes && inc.notes.includes(p.id)));
          const matchedPat = patIdx >= 0 ? patList[patIdx] : patList[0];
          const mrCode = patIdx >= 0 ? `MR-${String(patIdx + 1).padStart(3, '0')}` : 'MR-001';
          const pName = matchedPat?.name || (isHouseInvite ? 'Hộ gia đình mới' : 'Người cao tuổi');
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
            heartRate: (matchedPat?.heart_rate && matchedPat.heart_rate > 0) ? matchedPat.heart_rate : undefined,
            spo2: (matchedPat?.spo2 && matchedPat.spo2 > 0) ? matchedPat.spo2 : undefined,
            alertLevel: inc.alert_level,
            alertType: inc.alert_type,
          });
        });
      }

      // 2. Bệnh nhân có trạng thái sinh hiệu NGUY CẤP (DANGER)
      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) {
        patRes.value.forEach((p: DoctorPatientCard, idx: number) => {
          const isDanger = p.health_status === 'DANGER';
          if (isDanger) {
            const pId = `pat_${p.id}`;
            if (!unifiedList.some((item) => item.id === pId)) {
              const mrCode = `MR-${String(idx + 1).padStart(3, '0')}`;
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
                patientMrCode: mrCode,
                patientAddress: p.house_address || p.house_name,
                heartRate: p.heart_rate,
                spo2: p.spo2,
                alertLevel: 'CRITICAL',
              });
            }
          }
        });
      }

      // 3. Lịch khám từ Doctor API (UPCOMING & TODAY)
      if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) {
        const todayStr = new Date().toISOString().slice(0, 10);
        aptRes.value.forEach((apt: AppointmentItem) => {
          const isToday = apt.scheduled_at?.slice(0, 10) === todayStr;
          const isCompleted = apt.status === 'COMPLETED';
          const isCancelled = apt.status === 'CANCELLED';
          const label = isCompleted ? 'Đã khám' : isCancelled ? 'Đã hủy' : isToday ? 'Khám hôm nay' : 'Sắp tới';
          const aptId = `apt_${apt.id}`;
          if (!unifiedList.some((item) => item.id === aptId)) {
            unifiedList.push({
              id: aptId,
              type: 'APPOINTMENT',
              title: `Lịch khám: ${apt.patient_name || 'Bệnh nhân'}`,
              subtitle: `${formatDate(apt.scheduled_at)} · ${apt.visit_type === 'HOME_VISIT' ? 'Khám tại nhà' : 'Tại phòng khám'}`,
              timeStr: formatDate(apt.scheduled_at),
              badgeLabel: label,
              badgeColor: isCompleted
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : isCancelled
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : 'text-sky-700 bg-sky-50 border-sky-200',
              badgeBg: isCompleted ? 'bg-emerald-50' : isCancelled ? 'bg-rose-50' : 'bg-sky-50',
              isRead: savedReadIds.has(aptId),
              targetUrl: '/appointments',
              patientName: apt.patient_name,
              patientAddress: apt.location,
            });
          }
        });
      }

      setNotifications(unifiedList);
    } catch {
      // Fallback
    }
  }, []);

  // Lắng nghe dữ liệu ban đầu và WebSocket Real-time
  useEffect(() => {
    fetchNotifData();
    const interval = setInterval(fetchNotifData, 30000);

    const unsubscribe = doctorWebSocket.subscribe(() => {
      fetchNotifData();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [fetchNotifData]);

  // Phím tắt ⌘K để focus tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    if (showNotifMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifMenu]);

  // Đánh dấu đã đọc tất cả (có hỗ trợ Hoàn tác / Khôi phục)
  const handleMarkAllRead = async () => {
    try {
      incidentsApi.acknowledgeAll().catch(console.warn);
    } catch (err) {
      console.warn('Acknowledge all backend fallback:', err);
    }
    const allIds = notifications.map((n) => n.id);
    const rawIds = notifications.map((n) => n.rawIncidentId || '').filter(Boolean);
    const next = markAllAsReadWithUndo(allIds, rawIds);
    setReadIds(next);
    setCanUndo(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Khôi phục trạng thái chưa đọc (Hoàn tác khi lỡ bấm nhầm Đã đọc tất cả)
  const handleUndoMarkAll = () => {
    const restored = restorePreviousReadState();
    if (restored) {
      setReadIds(restored);
      setCanUndo(false);
      setNotifications((prev) =>
        prev.map((n) => {
          const isRead = Boolean(
            restored.has(n.id) ||
            (n.rawIncidentId && (restored.has(n.rawIncidentId) || restored.has(`inc_${n.rawIncidentId}`)))
          );
          return { ...n, isRead };
        })
      );
    }
  };

  // Đảo trạng thái Đã đọc <-> Chưa đọc cho một thông báo cụ thể
  const handleToggleSingleRead = (e: React.MouseEvent, item: UnifiedNotification) => {
    e.stopPropagation();
    const { nextIds, isRead } = toggleReadStatus(item.id, item.rawIncidentId);
    setReadIds(nextIds);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id || (n.rawIncidentId && n.rawIncidentId === item.rawIncidentId)
          ? { ...n, isRead }
          : n
      )
    );
  };

  // Click vào một thông báo: Đánh dấu đã đọc & mở ngay Modal chi tiết
  const handleNotificationClick = async (item: UnifiedNotification) => {
    const next = markAsRead(item.id, item.rawIncidentId);
    setReadIds(next);
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    setShowNotifMenu(false);
    setSelectedNotif(item);
    setShowDetailModal(true);
  };

  const handleAcknowledgeNotification = async (item: UnifiedNotification) => {
    if (item.rawIncidentId) {
      try {
        await incidentsApi.acknowledge(item.rawIncidentId);
      } catch (err) {
        console.warn('Acknowledge incident error:', err);
      }
    }
    const next = markAsRead(item.id, item.rawIncidentId);
    setReadIds(next);
    const doctorName = user?.full_name ? `BS. ${user.full_name}` : 'Bác sĩ phụ trách';
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id || (n.rawIncidentId && n.rawIncidentId === item.rawIncidentId)
          ? {
              ...n,
              isRead: true,
              badgeLabel: 'Đã xử lý',
              rawIncident: n.rawIncident
                ? {
                    ...n.rawIncident,
                    is_acknowledged: true,
                    acknowledged_by_name: doctorName,
                    acknowledged_at: new Date().toISOString(),
                  }
                : undefined,
            }
          : n
      )
    );
    setSelectedNotif((curr) =>
      curr && (curr.id === item.id || (curr.rawIncidentId && curr.rawIncidentId === item.rawIncidentId))
        ? {
            ...curr,
            isRead: true,
            badgeLabel: 'Đã xử lý',
            rawIncident: curr.rawIncident
              ? {
                  ...curr.rawIncident,
                  is_acknowledged: true,
                  acknowledged_by_name: doctorName,
                  acknowledged_at: new Date().toISOString(),
                }
              : undefined,
          }
        : curr
    );
  };

  const handleRespondInvite = async (incident: Incident, action: 'accept' | 'reject') => {
    const memberIdMatch = (incident.notes || incident.note || '')?.match(/MEMBER_ID:([a-fA-F0-9-]+)/);
    const memberId = memberIdMatch?.[1] || incident.device_id || incident.id;
    try {
      await householdApi.respondInvite(memberId, action);
      await incidentsApi.acknowledge(incident.id, action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà');
      fetchNotifData();
    } catch (e) {
      console.warn('Respond invite error:', e);
    }
  };

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = quickSearch.trim();
    if (!raw) return;
    const q = raw.toLowerCase();
    if (q.includes('lịch') || q.includes('hẹn') || q.includes('khám')) {
      navigate('/appointments');
    } else if (q.includes('cài đặt') || q.includes('mật khẩu') || q.includes('hồ sơ bác sĩ')) {
      navigate('/settings');
    } else {
      navigate(`/patients?search=${encodeURIComponent(raw)}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const criticalCount = notifications.filter((n) => n.type === 'ALERT' && (n.badgeLabel === 'Khẩn cấp' || n.badgeLabel === 'Nguy cấp' || n.alertLevel === 'CRITICAL')).length;
  const aptsCount = notifications.filter((n) => n.type === 'APPOINTMENT' || n.type === 'INVITE').length;

  const filteredNotifs = notifications.filter((item) => {
    if (notifTab === 'CRITICAL') {
      return item.type === 'ALERT' && (item.badgeLabel === 'Khẩn cấp' || item.badgeLabel === 'Nguy cấp' || item.alertLevel === 'CRITICAL');
    }
    if (notifTab === 'APPOINTMENTS') {
      return item.type === 'APPOINTMENT' || item.type === 'INVITE';
    }
    return true;
  });

  const emptyConfig: Record<TabType, { title: string; sub: string }> = {
    ALL: {
      title: 'Mọi thứ đều ổn định',
      sub: 'Hiện không có cảnh báo sức khỏe khẩn cấp hay lịch hẹn nào cần xử lý.',
    },
    CRITICAL: {
      title: 'Không có cảnh báo khẩn cấp',
      sub: 'Tất cả các bệnh nhân đang có sinh hiệu ổn định, an toàn.',
    },
    APPOINTMENTS: {
      title: 'Không có lịch khám mới',
      sub: 'Chưa có lịch khám lâm sàng hoặc lời mời phụ trách mới cần phản hồi.',
    },
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#131C31]/95 shrink-0">
      {/* Bên trái: Brand & Định danh Bác sĩ gia đình */}
      <div
        onClick={() => navigate('/')}
        className="flex cursor-pointer items-center space-x-3 shrink-0"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 border border-slate-200/80 shadow-xs dark:bg-slate-800 dark:border-slate-700 overflow-hidden shrink-0">
          <img
            src="/assets/logo.png"
            alt="SECA Logo"
            className="h-full w-full object-contain"
          />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-heading text-base font-bold tracking-tight text-slate-900 dark:text-white">
              SmartCare AI
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            Phân hệ Chăm sóc & Theo dõi Sức khỏe Người cao tuổi
          </p>
        </div>
      </div>

      {/* Chính giữa: Thanh tìm kiếm nhanh toàn hệ thống */}
      <form
        onSubmit={handleQuickSearchSubmit}
        className="hidden lg:flex flex-1 max-w-md items-center relative"
      >
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          placeholder="Tìm nhanh bệnh nhân, lịch khám, hồ sơ y tế..."
          className="w-full rounded-xl border border-slate-200/90 bg-[#F4F7FE]/80 py-2 pl-10 pr-10 text-xs font-medium text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
        />
        {quickSearch && (
          <button
            type="button"
            onClick={() => {
              setQuickSearch('');
              searchInputRef.current?.focus();
            }}
            title="Xóa từ khóa"
            className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {/* Bên phải: Nền tối, Chuông thông báo & Hồ sơ Bác sĩ */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {/* Nút Chuyển đổi Chế độ Nền tối / Nền sáng */}
        <button
          onClick={toggleTheme}
          className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
          title={isDark ? 'Chuyển sang Chế độ sáng' : 'Chuyển sang Chế độ nền tối (Trực ca đêm)'}
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Nút Chuông thông báo & Popover Thông báo như trên App */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
              setShowProfileMenu(false);
              if (!showNotifMenu) fetchNotifData();
            }}
            className={`relative rounded-xl p-2 transition-colors ${
              showNotifMenu
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            title="Trung tâm thông báo & cảnh báo y tế"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Popover Bảng thông báo Bác sĩ (Đồng bộ 100% với Mobile App) */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-[460px] max-w-[95vw] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-50 dark:border-slate-800/80 dark:bg-[#131C31] dark:shadow-slate-950/80">
              {/* Header Popover */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/90">
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-blue-600" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    Trung tâm thông báo
                  </h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      unreadCount > 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    }`}
                  >
                    {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc hết'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {canUndo && (
                    <button
                      type="button"
                      onClick={handleUndoMarkAll}
                      className="flex items-center space-x-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                      title="Khôi phục trạng thái chưa đọc trước khi bấm Đã đọc tất cả"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Khôi phục</span>
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="flex items-center space-x-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer dark:text-blue-400"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Đã đọc tất cả</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs lọc thông báo: 3 tab vừa khít chiều ngang */}
              <div className="grid grid-cols-3 border-b border-slate-100 bg-white text-xs font-bold dark:border-slate-800/80 dark:bg-[#131C31]">
                {[
                  { key: 'ALL' as const, label: `Tất cả (${notifications.length})` },
                  { key: 'CRITICAL' as const, label: `Khẩn cấp (${criticalCount})` },
                  { key: 'APPOINTMENTS' as const, label: `Lịch khám (${aptsCount})` },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setNotifTab(t.key)}
                    className={`py-2.5 text-center border-b-2 transition-colors cursor-pointer ${
                      notifTab === t.key
                        ? t.key === 'CRITICAL'
                          ? 'border-rose-600 text-rose-600 dark:border-rose-500 dark:text-rose-400'
                          : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Danh sách thông báo */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredNotifs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Check className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {emptyConfig[notifTab].title}
                    </p>
                    <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                      {emptyConfig[notifTab].sub}
                    </p>
                  </div>
                ) : (
                  filteredNotifs.map((item) => {
                    const isAdmin = item.type === 'ADMIN';
                    const isAlert = item.type === 'ALERT';
                    const isInvite = item.type === 'INVITE';
                    const isApt = item.type === 'APPOINTMENT';

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                          !item.isRead
                            ? 'bg-blue-50/40 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/40'
                            : 'bg-white hover:bg-slate-50 dark:bg-[#131C31] dark:hover:bg-slate-800/60'
                        }`}
                      >
                        {/* Icon Box */}
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl relative ${
                            isAdmin
                              ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400'
                              : isApt
                                ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400'
                                : isInvite
                                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                                  : item.badgeLabel === 'Khẩn cấp' || item.badgeLabel === 'Nguy cấp'
                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {isAdmin ? (
                            <Megaphone className="h-5 w-5" />
                          ) : isApt ? (
                            <Calendar className="h-5 w-5" />
                          ) : isInvite ? (
                            <Sparkles className="h-5 w-5" />
                          ) : item.badgeLabel === 'Khẩn cấp' || item.badgeLabel === 'Nguy cấp' ? (
                            <AlertCircle className="h-5 w-5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5" />
                          )}
                        </div>

                        {/* Nội dung thông báo */}
                        <div className="flex-1 min-w-0 pr-1">
                          {/* Thẻ định danh bệnh nhân & Nhãn lặp lại */}
                          {item.type !== 'ADMIN' && item.patientName && (
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                {item.patientName} • {item.patientMrCode || 'MR-001'}
                              </span>
                              {item.repeatBadge && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300">
                                  {item.repeatBadge}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-start gap-1.5">
                            {!item.isRead && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600 ring-2 ring-blue-100 dark:ring-blue-900" />
                            )}
                            <p
                              className={`text-xs leading-snug line-clamp-2 ${
                                !item.isRead
                                  ? 'font-bold text-slate-900 dark:text-slate-100'
                                  : 'font-medium text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.title}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-3.5">
                            {item.subtitle}
                          </p>
                        </div>

                        {/* Cột phải: 2 Nhãn (Loại thông báo & Đã đọc / Chưa đọc) chuẩn như App */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0 self-center">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${item.badgeColor}`}
                          >
                            {item.badgeLabel}
                          </span>
                          {item.isRead ? (
                            <button
                              type="button"
                              onClick={(e) => handleToggleSingleRead(e, item)}
                              title="Bấm để đánh dấu Chưa đọc"
                              className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700 border border-emerald-200 transition-colors cursor-pointer dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800"
                            >
                              <Check className="h-2.5 w-2.5" />
                              <span>Đã đọc</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleToggleSingleRead(e, item)}
                              title="Bấm để đánh dấu Đã đọc"
                              className="rounded-md bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 text-[9.5px] font-bold text-blue-700 border border-blue-200 transition-colors cursor-pointer dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800"
                            >
                              Chưa đọc
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Dòng chú thích tự động lọc chống Alert Fatigue */}
              <div className="border-t border-slate-100 bg-slate-50/90 px-3.5 py-2 text-center text-[10.5px] text-slate-500 dark:border-slate-800/80 dark:bg-[#0F172A] dark:text-slate-400">
                Hệ thống tự động lọc bỏ các cảnh báo thiết bị (pin yếu, mất tín hiệu) và dao động nhẹ; các mục này được chuyển trực tiếp tới Gia đình.
              </div>

              {/* Footer điều hướng sang trang Tất cả thông báo */}
              <div className="border-t border-slate-100 bg-white p-2.5 text-center dark:border-slate-800/80 dark:bg-[#131C31]">
                <button
                  onClick={() => {
                    setShowNotifMenu(false);
                    navigate('/notifications');
                  }}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <span>Xem toàn bộ thông báo</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Thông tin Bác sĩ & Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifMenu(false);
            }}
            className="flex items-center space-x-3 rounded-xl p-1.5 transition-colors hover:bg-slate-50 border border-transparent hover:border-slate-200 dark:hover:bg-slate-800/60 dark:hover:border-slate-700"
          >
            {/* Avatar Bác sĩ có chấm xanh Online (Chữ "M" nền xanh chuẩn như bên App) */}
            <div className="relative inline-block shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-extrabold text-white shadow-sm overflow-hidden">
                {doctorAvatar ? (
                  <img src={doctorAvatar} alt={doctorName} className="h-full w-full object-cover" />
                ) : (
                  doctorInitial
                )}
              </div>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white shadow-sm dark:ring-slate-900 z-10" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{doctorName}</p>
              <p className="text-[11px] text-blue-600 font-medium dark:text-blue-400">Bác sĩ phụ trách</p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-150 dark:border-slate-800/80 dark:bg-[#131C31] dark:shadow-slate-950/80">
              <div className="flex items-center space-x-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="relative inline-block shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-base font-extrabold text-white shadow-sm overflow-hidden">
                    {doctorAvatar ? (
                      <img src={doctorAvatar} alt={doctorName} className="h-full w-full object-cover" />
                    ) : (
                      doctorInitial
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-sm dark:ring-slate-900 z-10" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{doctorName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.phone || 'Bác sĩ gia đình'}</p>
                  <div className="mt-0.5 flex items-center space-x-1 text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Chứng chỉ hành nghề đã xác thực</span>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <div className="flex items-center space-x-2 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Vai trò: Bác sĩ điều trị</span>
                </div>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/settings');
                  }}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                >
                  <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Cài đặt & Hồ sơ Bác sĩ</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={logout}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal / Tab Chi tiết Thông báo Bác sĩ */}
      <NotificationDetailModal
        isOpen={showDetailModal}
        notif={selectedNotif}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedNotif(null);
        }}
        onAcknowledge={handleAcknowledgeNotification}
        onNavigate={(url) => {
          setShowDetailModal(false);
          setSelectedNotif(null);
          navigate(url);
        }}
        onRespondInvite={handleRespondInvite}
      />
    </header>
  );
};

// src/pages/NotificationsPage.tsx
// Trung tâm Thông báo & Cảnh báo Lâm sàng (Linear Inbox SaaS Y tế)
// Tối ưu gọn gàng, chia nhóm theo ngày, phân biệt viền mức độ, phân trang và dọn dẹp văn bản

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi, householdApi, incidentsApi, systemNotificationsApi } from '../services/api';
import { doctorWebSocket } from '../services/websocket';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { removeVietnameseTones } from '../utils/text';
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
} from '../utils/notificationSync';
import { NotificationDetailModal, UnifiedNotification } from '../components/clinical/NotificationDetailModal';
import type { Incident, AppointmentItem, DoctorPatientCard, SystemNotification } from '../types';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Search,
  AlertTriangle,
  Calendar,
  Sparkles,
  User,
  Check,
  ChevronRight,
  ShieldAlert,
  Inbox,
  X,
  RotateCcw,
  Megaphone,
} from 'lucide-react';

type TabType = 'ALL' | 'UNREAD' | 'ADMIN' | 'ALERTS' | 'APPOINTMENTS' | 'OTHERS';
type SeverityType = 'ALL' | 'CRITICAL' | 'WARNING';

const PAGE_SIZE = 10;

// 1. Helpers làm sạch văn bản và trích xuất tiêu đề ngắn gọn
const cleanText = cleanNotificationText;

function parseTitleAndBody(raw: string, type: UnifiedNotification['type'], alertType?: string, alertLevel?: string, patientName?: string) {
  const text = cleanText(raw);
  const lower = text.toLowerCase();

  if (type === 'INVITE' || lower.includes('lời mời')) {
    return { title: 'Lời mời phụ trách Bác sĩ gia đình', desc: text || 'Chủ hộ đã gửi lời mời bạn tham gia với vai trò Bác sĩ gia đình.' };
  }
  if (type === 'APPOINTMENT' || alertType?.startsWith('APPOINTMENT_') || lower.includes('lịch khám') || lower.includes('lịch hẹn')) {
    const isCancelled = lower.includes('hủy') || alertType === 'APPOINTMENT_CANCELLED';
    const isConfirmed = lower.includes('xác nhận') || alertType === 'APPOINTMENT_CONFIRMED' || lower.includes('đón tiếp');
    const title = isCancelled
      ? 'Lịch khám y tế đã hủy'
      : isConfirmed
        ? lower.includes('tại nhà') ? 'Xác nhận lịch khám tại nhà' : 'Xác nhận lịch khám tại phòng khám'
        : patientName ? `Lịch khám bệnh nhân ${patientName}` : 'Lịch khám định kỳ';
    return { title, desc: text };
  }
  if (alertLevel === 'CRITICAL' || alertType === 'FALL_DETECTED' || lower.includes('báo động đỏ') || lower.includes('té ngã')) {
    if (lower.includes('tam chứng')) return { title: 'BÁO ĐỘNG ĐỎ: Tam chứng nguy kịch', desc: text.replace(/^BÁO ĐỘNG ĐỎ:?\s*(?:Tam chứng nguy kịch:?)?\s*/i, '').trim() };
    if (lower.includes('té ngã') || alertType === 'FALL_DETECTED') return { title: 'BÁO ĐỘNG ĐỎ: Phát hiện sự cố té ngã', desc: text.replace(/^BÁO ĐỘNG ĐỎ:?\s*/i, '').trim() };
    return { title: 'BÁO ĐỘNG ĐỎ: Cảnh báo khẩn cấp', desc: text.replace(/^BÁO ĐỘNG ĐỎ:?\s*/i, '').trim() };
  }
  const hrMatch = text.match(/Cảnh báo nhịp tim (?:cao|chậm|bất thường)\s*\(\d+\s*bpm\)/i);
  if (hrMatch) return { title: hrMatch[0], desc: text };
  const spo2Match = text.match(/Cảnh báo SpO2 (?:thấp|nguy hiểm)\s*\(\d+%\)/i);
  if (spo2Match) return { title: spo2Match[0], desc: text };
  if (alertType === 'MEDICAL_RECORD_UPDATED' || lower.includes('bệnh án')) return { title: 'Cập nhật hồ sơ bệnh án', desc: text };

  const parts = text.split(/[:\.\n]/);
  if (parts.length > 1 && parts[0].trim().length >= 5 && parts[0].trim().length < 50) {
    return { title: parts[0].trim(), desc: text.slice(parts[0].length + 1).trim() || parts[0].trim() };
  }
  return { title: text.slice(0, 50), desc: text };
}

function formatTime(str?: string): string {
  if (!str) return '--:--';
  const d = new Date(str);
  return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getDateGroup(str?: string) {
  const d = str ? new Date(str) : new Date();
  const time = isNaN(d.getTime()) ? Date.now() : d.getTime();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestKey = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;

  if (dKey === todayKey) return { key: dKey, label: 'Hôm nay', timestamp: time };
  if (dKey === yestKey) return { key: dKey, label: 'Hôm qua', timestamp: time };
  return { key: dKey, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timestamp: time };
}

interface Item extends UnifiedNotification {
  cleanTitle: string;
  cleanDesc: string;
  timeOnly: string;
  dateKey: string;
  dateLabel: string;
  sortTimestamp: number;
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { patients: cachedPatients, appointments: cachedAppointments, incidents: cachedIncidents } = useDoctorDataStore();

  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [severity, setSeverity] = useState<SeverityType>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<Item[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<UnifiedNotification | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());
  const [canUndo, setCanUndo] = useState<boolean>(() => hasUndoSnapshot());

  // Lắng nghe sự kiện đồng bộ từ thanh Navbar hoặc các tab/component khác (0ms)
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

  // 2. Chuyển đổi dữ liệu thống nhất (Incidents, Sinh hiệu cảnh báo, Lịch khám, Thông báo Admin)
  const buildItems = useCallback((incs: Incident[], pats: DoctorPatientCard[], apts: AppointmentItem[], sysList: SystemNotification[] = [], readSet: Set<string> = new Set()) => {
    const list: Item[] = [];

    // A. Incidents
    incs?.forEach((inc) => {
      const isCrit = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED';
      const msg = inc.message || '';
      const lower = msg.toLowerCase();
      const isRead = Boolean(inc.is_acknowledged || readSet.has(inc.id) || readSet.has(`inc_${inc.id}`));
      let type: UnifiedNotification['type'] = 'ALERT';
      let label = isCrit ? 'Khẩn cấp' : 'Cảnh báo';
      let color = isCrit ? 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300' : 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
      let target = '/patients';
      let finalRead = isRead;

      if (inc.alert_type === 'HOUSE_INVITE_PENDING' || lower.includes('lời mời bạn tham gia') || lower.includes('xác nhận vào nhà')) {
        type = 'INVITE';
        const handled = Boolean(inc.is_acknowledged);
        label = handled ? (inc.notes?.includes('từ chối') ? 'Đã từ chối' : 'Đã tham gia') : 'Lời mời';
        color = handled ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200';
        target = '/';
        finalRead = handled || isRead;
      } else if (['APPOINTMENT_CONFIRMED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CANCELLED'].includes(inc.alert_type || '') || lower.includes('lịch khám') || lower.includes('lịch hẹn')) {
        type = 'APPOINTMENT';
        const isCancel = lower.includes('hủy');
        const isConfirm = lower.includes('xác nhận');
        label = isCancel ? 'Đã hủy' : isConfirm ? 'Đã xác nhận' : 'Lịch khám';
        color = isCancel ? 'text-rose-700 bg-rose-50 border-rose-200' : isConfirm ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-sky-700 bg-sky-50 border-sky-200';
        target = '/appointments';
      } else if (lower.includes('bệnh nhân mới') || lower.includes('phụ trách')) {
        label = 'Bệnh nhân';
        color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (inc.alert_type === 'MEDICAL_RECORD_UPDATED' || lower.includes('bệnh án')) {
        label = 'Hồ sơ y tế';
        color = 'text-indigo-700 bg-indigo-50 border-indigo-200';
      }

      const pat = pats?.find((p) => p.id === (inc as any).elderly_id || (inc.notes && inc.notes.includes(p.id))) || pats?.[0];
      const pName = pat?.name || (type === 'INVITE' ? 'Hộ gia đình mới' : undefined);
      const parsed = parseTitleAndBody(msg, type, inc.alert_type, inc.alert_level, pName);
      const dg = getDateGroup(inc.created_at);
      const timeOnly = formatTime(inc.created_at);

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
        patientAddress: pat?.house_address || pat?.house_name,
        heartRate: pat?.heart_rate && pat.heart_rate > 0 ? pat.heart_rate : undefined,
        spo2: pat?.spo2 && pat.spo2 > 0 ? pat.spo2 : undefined,
        alertLevel: inc.alert_level,
        alertType: inc.alert_type,
      });
    });

    // B. Sinh hiệu cảnh báo từ Bệnh nhân (DANGER / WARNING)
    pats?.forEach((p) => {
      const isDanger = p.health_status === 'DANGER';
      if ((isDanger || p.health_status === 'WARNING') && !list.some((i) => i.id === `pat_${p.id}`)) {
        const dg = getDateGroup(new Date().toISOString());
        const title = isDanger ? `BÁO ĐỘNG ĐỎ: ${p.name} - Sinh hiệu nguy cấp` : `Cảnh báo: ${p.name} - Cần theo dõi sinh hiệu`;
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
          badgeLabel: isDanger ? 'Khẩn cấp' : 'Cảnh báo',
          badgeColor: isDanger ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200',
          badgeBg: isDanger ? 'bg-rose-50' : 'bg-amber-50',
          isRead: readSet.has(`pat_${p.id}`),
          targetUrl: `/patients?search=${encodeURIComponent(p.name)}`,
          patientId: p.id,
          patientName: p.name,
          patientAddress: p.house_address || p.house_name,
          heartRate: p.heart_rate,
          spo2: p.spo2,
          alertLevel: isDanger ? 'CRITICAL' : 'WARNING',
        });
      }
    });

    // C. Lịch khám
    apts?.forEach((apt) => {
      if (!list.some((i) => i.id === `apt_${apt.id}`)) {
        const dg = getDateGroup(apt.scheduled_at);
        const timeOnly = formatTime(apt.scheduled_at);
        const isDone = apt.status === 'COMPLETED';
        const isCancel = apt.status === 'CANCELLED';
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
          badgeLabel: isDone ? 'Đã khám' : isCancel ? 'Đã hủy' : 'Sắp tới',
          badgeColor: isDone ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : isCancel ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-sky-700 bg-sky-50 border-sky-200',
          badgeBg: isDone ? 'bg-emerald-50' : isCancel ? 'bg-rose-50' : 'bg-sky-50',
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
      const timeOnly = formatTime(sys.published_at || sys.created_at);
      const sysId = `sys_${sys.id}`;
      const isRead = Boolean(readSet.has(sysId) || readSet.has(sys.id));

      let label = 'Thông báo Admin';
      let color = 'text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300';
      if (sys.type === 'system_maintenance') {
        label = 'Bảo trì hệ thống';
        color = 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
      } else if (sys.type === 'emergency') {
        label = 'Khẩn cấp Admin';
        color = 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300';
      } else if (sys.type === 'feature_update') {
        label = 'Cập nhật tính năng';
        color = 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
      } else if (sys.type === 'health_tip') {
        label = 'Chỉ dẫn y tế';
        color = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300';
      }

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
        badgeLabel: label,
        badgeColor: color,
        badgeBg: 'bg-sky-50',
        isRead,
        targetUrl: '/notifications',
        patientName: 'Ban Quản Trị Hệ Thống (Admin)',
        adminNotification: sys,
      });
    });

    return list.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
  }, []);

  // Tải dữ liệu từ cache (0ms) rồi revalidate ngầm
  useEffect(() => {
    if (cachedIncidents.length || cachedPatients.length || cachedAppointments.length) {
      setNotifications(buildItems(cachedIncidents, cachedPatients, cachedAppointments, [], readIds));
    }
  }, [cachedIncidents, cachedPatients, cachedAppointments, buildItems, readIds]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, pRes, aRes, sRes] = await Promise.allSettled([
        incidentsApi.list(undefined, 100),
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        systemNotificationsApi.getActiveBroadcasts('doctors'),
      ]);
      const currentRead = getStoredReadIds();
      const incs = iRes.status === 'fulfilled' && Array.isArray(iRes.value) ? iRes.value : [];
      const pats = pRes.status === 'fulfilled' && Array.isArray(pRes.value) ? pRes.value : [];
      const apts = aRes.status === 'fulfilled' && Array.isArray(aRes.value) ? aRes.value : [];
      const sysList = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : [];
      setNotifications(buildItems(incs, pats, apts, sysList, currentRead));
    } finally {
      setLoading(false);
    }
  }, [buildItems]);

  useEffect(() => {
    loadData();
    const unsub = doctorWebSocket.subscribe((data) => {
      if (data?.type === 'ALERT_NEW' || data?.type === 'INITIAL_ALERTS' || data?.alert_type) loadData();
    });
    return () => unsub();
  }, [loadData]);

  useEffect(() => setPage(1), [activeTab, severity, search]);

  // Đánh dấu đã đọc khi xem chi tiết
  const handleItemClick = (item: UnifiedNotification) => {
    const next = markAsRead(item.id, item.rawIncidentId);
    setReadIds(next);
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
    setSelectedNotif(item);
    setShowModal(true);
  };

  const handleAcknowledge = async (item: UnifiedNotification) => {
    if (item.rawIncidentId) incidentsApi.acknowledge(item.rawIncidentId).catch(console.warn);
    const next = markAsRead(item.id, item.rawIncidentId);
    setReadIds(next);
    setNotifications((prev) => prev.map((n) => (n.id === item.id || n.rawIncidentId === item.rawIncidentId ? { ...n, isRead: true, badgeLabel: 'Đã xử lý' } : n)));
  };

  // Đảo trạng thái Đã đọc <-> Chưa đọc
  const handleToggleRead = (item: UnifiedNotification) => {
    if (!item.isRead && item.rawIncidentId) {
      incidentsApi.acknowledge(item.rawIncidentId).catch(console.warn);
    }
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

  // Đánh dấu tất cả đã đọc (có lưu snapshot Hoàn tác)
  const handleMarkAllRead = async () => {
    incidentsApi.acknowledgeAll().catch(console.warn);
    const allIds = notifications.map((n) => n.id);
    const rawIds = notifications.map((n) => n.rawIncidentId || '').filter(Boolean);
    const next = markAllAsReadWithUndo(allIds, rawIds);
    setReadIds(next);
    setCanUndo(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Khôi phục trạng thái chưa đọc trước đó (Hoàn tác)
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

  const handleRespondInvite = async (incident: Incident, action: 'accept' | 'reject') => {
    const memberId = incident.notes?.match(/MEMBER_ID:([a-fA-F0-9-]+)/)?.[1] || incident.device_id || incident.id;
    try {
      await householdApi.respondInvite(memberId, action);
      await incidentsApi.acknowledge(incident.id, action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà');
      loadData();
    } catch (e) {
      console.warn('Respond invite error:', e);
    }
  };

  // Lọc dữ liệu
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filtered = useMemo(() => {
    const qNorm = removeVietnameseTones(search.trim());
    return notifications.filter((item) => {
      if (activeTab === 'UNREAD' && item.isRead) return false;
      if (activeTab === 'ADMIN' && item.type !== 'ADMIN') return false;
      if (activeTab === 'ALERTS' && item.type !== 'ALERT') return false;
      if (activeTab === 'APPOINTMENTS' && item.type !== 'APPOINTMENT') return false;
      if (activeTab === 'OTHERS' && item.type !== 'INVITE' && item.badgeLabel !== 'Hồ sơ y tế') return false;

      const isCrit = item.alertLevel === 'CRITICAL' || item.alertType === 'FALL_DETECTED' || item.badgeLabel === 'Khẩn cấp';
      if (severity === 'CRITICAL' && !isCrit) return false;
      if (severity === 'WARNING' && (isCrit || item.badgeLabel !== 'Cảnh báo')) return false;

      if (qNorm) {
        const full = removeVietnameseTones(`${item.cleanTitle} ${item.cleanDesc} ${item.patientName || ''} ${item.patientAddress || ''}`);
        if (!full.includes(qNorm)) return false;
      }
      return true;
    });
  }, [notifications, activeTab, severity, search]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const pagedList = useMemo(() => filtered.slice(startIdx, endIdx), [filtered, startIdx, endIdx]);

  // Gom nhóm theo ngày
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: Item[] }>();
    pagedList.forEach((it) => {
      const g = map.get(it.dateKey) || { label: it.dateLabel, items: [] };
      g.items.push(it);
      map.set(it.dateKey, g);
    });
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [pagedList]);

  return (
    <div className="space-y-4">
      {/* Header gọn gàng */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-white p-4.5 shadow-xs border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Trung tâm Thông Báo &amp; Cảnh Báo Lâm Sàng</h1>
              {unreadCount > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white animate-pulse">{unreadCount} chưa đọc</span>}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Hộp thư cảnh báo y tế, biến động sinh hiệu và phân công Bác sĩ gia đình</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canUndo && (
            <button
              type="button"
              onClick={handleUndoMarkAll}
              className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 shadow-2xs transition-colors dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
              title="Khôi phục trạng thái chưa đọc trước khi bấm Đã đọc tất cả"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Khôi phục</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>Đã đọc tất cả</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Toolbar lọc đồng bộ (h-9, text-xs) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {[
            { k: 'ALL', l: 'Tất cả', c: notifications.length },
            { k: 'UNREAD', l: 'Chưa đọc', c: unreadCount, badge: unreadCount > 0 },
            { k: 'ADMIN', l: 'Từ Admin', c: notifications.filter((n) => n.type === 'ADMIN').length },
            { k: 'ALERTS', l: 'Cảnh báo y tế', c: notifications.filter((n) => n.type === 'ALERT').length },
            { k: 'APPOINTMENTS', l: 'Lịch khám', c: notifications.filter((n) => n.type === 'APPOINTMENT').length },
            { k: 'OTHERS', l: 'Lời mời & Hồ sơ', c: notifications.filter((n) => n.type === 'INVITE' || n.badgeLabel === 'Hồ sơ y tế').length },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setActiveTab(t.k as TabType)}
              className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.k ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/90 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
              }`}
            >
              <span>{t.l}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === t.k ? 'bg-white/25 text-white' : t.badge ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{t.c}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SeverityType)}
            className="h-9 rounded-xl border border-slate-200/90 bg-white px-3 pr-8 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-hidden cursor-pointer shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="ALL">Tất cả mức độ</option>
            <option value="CRITICAL">🚨 Khẩn cấp</option>
            <option value="WARNING">⚠️ Cảnh báo</option>
          </select>

          <div className="relative w-56 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo nội dung, bệnh nhân..."
              className="h-9 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>
      </div>

      {/* Danh sách thông báo chia nhóm Linear Inbox */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 text-center shadow-xs border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Inbox className="h-6 w-6" /></div>
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">Không tìm thấy thông báo nào</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">{search ? `Không khớp với từ khóa "${search}".` : 'Hiện không có thông báo y tế nào.'}</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-1.5">
              <div className="flex items-center gap-2 px-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>{g.label}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="font-normal text-slate-400">{g.items.length} thông báo</span>
              </div>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {g.items.map((item) => {
                  const isAdmin = item.type === 'ADMIN';
                  const isCrit = item.alertLevel === 'CRITICAL' || item.alertType === 'FALL_DETECTED' || item.badgeLabel === 'Khẩn cấp';
                  const isWarn = !isCrit && (item.alertLevel === 'WARNING' || item.badgeLabel === 'Cảnh báo');
                  const borderL = isAdmin
                    ? 'border-l-4 border-l-sky-500 bg-sky-50/20 dark:bg-sky-950/20'
                    : isCrit
                      ? 'border-l-4 border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/20'
                      : isWarn
                        ? 'border-l-4 border-l-amber-400 bg-amber-50/15 dark:bg-amber-950/10'
                        : !item.isRead
                          ? 'border-l-4 border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
                          : 'border-l-4 border-l-transparent bg-white dark:bg-slate-900';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${borderL} ${item.isRead ? 'opacity-85' : 'opacity-100'}`}
                    >
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl relative shadow-2xs mt-0.5 ${
                          isAdmin
                            ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300'
                            : item.type === 'APPOINTMENT'
                              ? 'bg-sky-50 text-sky-600'
                              : item.type === 'INVITE'
                                ? 'bg-emerald-50 text-emerald-600'
                                : isCrit
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-amber-50 text-amber-600'
                        }`}>
                          {isAdmin ? (
                            <Megaphone className="h-4 w-4" />
                          ) : item.type === 'APPOINTMENT' ? (
                            <Calendar className="h-4 w-4" />
                          ) : item.type === 'INVITE' ? (
                            <Sparkles className="h-4 w-4" />
                          ) : isCrit ? (
                            <ShieldAlert className="h-4 w-4 text-rose-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )}
                          {!item.isRead && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${item.badgeColor}`}>{item.badgeLabel}</span>
                            {item.patientName && (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 text-[10.5px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <User className="h-2.5 w-2.5 text-slate-400" />
                                {item.patientName}
                              </span>
                            )}
                            {isCrit && <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-600"><span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />Khẩn cấp</span>}
                          </div>

                          <h4 className={`text-sm leading-snug line-clamp-1 ${!item.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                            {item.cleanTitle}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{item.cleanDesc}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 sm:self-center">
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{item.timeOnly}</span>
                        {!item.isRead ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleRead(item); }}
                            title="Đánh dấu đã đọc"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer dark:hover:bg-slate-800 dark:hover:text-blue-400"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleRead(item); }}
                            title="Đánh dấu chưa đọc lại"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors cursor-pointer dark:hover:bg-slate-800 dark:hover:text-amber-400"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 shadow-2xs transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <span>Chi tiết</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-2 border-t border-slate-200/80 dark:border-slate-800">
              <p className="text-xs text-slate-500 font-medium">
                Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{startIdx + 1}–{endIdx}</span> trên <span className="font-bold text-slate-800 dark:text-slate-200">{filtered.length}</span> thông báo
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                >
                  Trước
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  if (pNum === 1 || pNum === totalPages || (pNum >= page - 1 && pNum <= page + 1)) {
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setPage(pNum)}
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          page === pNum ? 'bg-blue-600 text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  }
                  if (pNum === page - 2 || pNum === page + 2) return <span key={pNum} className="px-1 text-xs text-slate-400">...</span>;
                  return null;
                })}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal chi tiết */}
      <NotificationDetailModal
        isOpen={showModal}
        notif={selectedNotif}
        onClose={() => { setShowModal(false); setSelectedNotif(null); }}
        onAcknowledge={handleAcknowledge}
        onNavigate={(url) => { setShowModal(false); setSelectedNotif(null); navigate(url); }}
        onRespondInvite={handleRespondInvite}
      />
    </div>
  );
};

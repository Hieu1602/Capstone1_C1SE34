// src/pages/NotificationsPage.tsx
// Trang Trung tâm Thông báo & Cảnh báo toàn diện dành cho Bác sĩ gia đình

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi, householdApi, incidentsApi } from '../services/api';
import { doctorWebSocket } from '../services/websocket';
import { removeVietnameseTones } from '../utils/text';
import { NotificationDetailModal, UnifiedNotification } from '../components/clinical/NotificationDetailModal';
import type { Incident, AppointmentItem, DoctorPatientCard } from '../types';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Search,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Sparkles,
  Clock,
  User,
  MapPin,
  Check,
  ChevronRight,
  Filter,
  ShieldAlert,
  Inbox,
  FileText,
} from 'lucide-react';

type TabType = 'ALL' | 'UNREAD' | 'ALERTS' | 'APPOINTMENTS' | 'OTHERS';

const READ_STORAGE_KEY = '@doctor_web_read_notifs';

function formatTime(dateStr?: string): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? '--:--'
      : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
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
      : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} lúc ${formatTime(dateStr)}`;
  } catch {
    return 'Vừa xong';
  }
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<UnifiedNotification | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, patRes, aptRes, invRes] = await Promise.allSettled([
        incidentsApi.list(undefined, 50),
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        householdApi.getInvites(),
      ]);

      const savedReadIds = (() => {
        try {
          const saved = localStorage.getItem(READ_STORAGE_KEY);
          return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
          return new Set();
        }
      })();

      const unifiedList: UnifiedNotification[] = [];

      // 1. Cảnh báo và sự cố từ Incidents API
      if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) {
        incRes.value.forEach((inc: Incident) => {
          const isCritical = inc.alert_level === 'CRITICAL' || inc.alert_type === 'FALL_DETECTED';
          const rawMsg = inc.message || '';
          const msgLower = rawMsg.toLowerCase();
          const isRead = Boolean(
            inc.is_acknowledged || savedReadIds.has(inc.id) || savedReadIds.has(`inc_${inc.id}`)
          );
          const timeStr = formatDate(inc.created_at);

          let type: UnifiedNotification['type'] = 'ALERT';
          let title = rawMsg;
          let subtitle = timeStr;
          let badgeLabel = isCritical ? 'Khẩn cấp' : 'Cảnh báo';
          let badgeColor = isCritical
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : 'text-amber-700 bg-amber-50 border-amber-200';
          let badgeBg = isCritical ? 'bg-rose-50' : 'bg-amber-50';
          let targetUrl = '/patients';
          let finalRead = isRead;

          const isHouseInvite =
            inc.alert_type === 'HOUSE_INVITE_PENDING' ||
            Boolean(inc.notes?.includes('HOUSE_INVITE_PENDING')) ||
            ['lời mời bạn tham gia căn nhà', 'lời mời tham gia căn nhà', 'xác nhận vào nhà'].some((k) =>
              msgLower.includes(k)
            );
          const isAppointmentMsg =
            ['APPOINTMENT_CONFIRMED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CANCELLED'].includes(
              inc.alert_type || ''
            ) ||
            ['lịch khám', 'lịch hẹn', 'đã hủy', '[đã hủy]', 'tái khám', 'xác nhận lịch'].some((k) =>
              msgLower.includes(k)
            );
          const isAssignmentMsg = ['chủ hộ', 'phụ trách', 'chỉ định', 'bệnh nhân mới'].some((k) =>
            msgLower.includes(k)
          );
          const isMedicalRecordMsg =
            inc.alert_type === 'MEDICAL_RECORD_UPDATED' ||
            ['bệnh án', 'dị ứng', 'dinh dưỡng'].some((k) => msgLower.includes(k));

          if (isHouseInvite) {
            type = 'INVITE';
            title = 'Lời mời phụ trách Bác sĩ gia đình';
            subtitle = rawMsg || 'Chủ hộ đã gửi lời mời bạn tham gia căn nhà với vai trò Bác sĩ gia đình.';
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

          const matchedPat =
            patRes.status === 'fulfilled' && Array.isArray(patRes.value)
              ? patRes.value.find(
                  (p: DoctorPatientCard) =>
                    p.id === (inc as any).elderly_id || (inc.notes && inc.notes.includes(p.id))
                ) || patRes.value[0]
              : undefined;

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
            patientName: matchedPat?.name || (isHouseInvite ? 'Hộ gia đình mới' : 'Người cao tuổi'),
            patientAddress: matchedPat?.house_address || matchedPat?.house_name,
            heartRate: matchedPat?.heart_rate && matchedPat.heart_rate > 0 ? matchedPat.heart_rate : undefined,
            spo2: matchedPat?.spo2 && matchedPat.spo2 > 0 ? matchedPat.spo2 : undefined,
            alertLevel: inc.alert_level,
            alertType: inc.alert_type,
          });
        });
      }

      // 2. Bệnh nhân có trạng thái sinh hiệu cảnh báo (WARNING / DANGER)
      if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) {
        patRes.value.forEach((p: DoctorPatientCard) => {
          const isDanger = p.health_status === 'DANGER';
          const isWarn = p.health_status === 'WARNING' || isDanger;
          if (isWarn) {
            const pId = `pat_${p.id}`;
            if (!unifiedList.some((item) => item.id === pId)) {
              unifiedList.push({
                id: pId,
                type: 'ALERT',
                title: `${p.name} - Cần chú ý theo dõi`,
                subtitle: `Nhịp tim: ${p.heart_rate || '--'} bpm • SpO2: ${p.spo2 || '--'}% • ${p.house_address || p.house_name || 'Nhà riêng'}`,
                timeStr: 'Hôm nay',
                badgeLabel: isDanger ? 'Nguy cấp' : 'Cần chú ý',
                badgeColor: isDanger
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200',
                badgeBg: isDanger ? 'bg-rose-50' : 'bg-amber-50',
                isRead: savedReadIds.has(pId),
                targetUrl: `/patients?search=${encodeURIComponent(p.name)}`,
                patientId: p.id,
                patientName: p.name,
                patientAddress: p.house_address || p.house_name,
                heartRate: p.heart_rate,
                spo2: p.spo2,
                alertLevel: isDanger ? 'CRITICAL' : 'WARNING',
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
    } catch (err) {
      console.warn('Lỗi tải dữ liệu thông báo:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    doctorWebSocket.connect();
    const unsub = doctorWebSocket.subscribe((data) => {
      if (data?.type === 'ALERT_NEW' || data?.type === 'INITIAL_ALERTS' || data?.alert_type) {
        fetchData();
      }
    });
    return () => unsub();
  }, [fetchData]);

  // Click vào thông báo để mở modal chi tiết
  const handleNotificationClick = async (item: UnifiedNotification) => {
    const next = new Set(readIds);
    next.add(item.id);
    if (item.rawIncidentId) {
      next.add(item.rawIncidentId);
      next.add(`inc_${item.rawIncidentId}`);
    }
    setReadIds(next);
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    setSelectedNotif(item);
    setShowDetailModal(true);
  };

  const handleMarkAllRead = async () => {
    try {
      await incidentsApi.acknowledgeAll();
    } catch (err) {
      console.warn('Acknowledge all backend fallback:', err);
    }
    const allIds = new Set(readIds);
    notifications.forEach((n) => {
      allIds.add(n.id);
      if (n.rawIncidentId) {
        allIds.add(n.rawIncidentId);
        allIds.add(`inc_${n.rawIncidentId}`);
      }
    });
    setReadIds(allIds);
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(allIds)));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleAcknowledgeNotification = async (item: UnifiedNotification) => {
    if (item.rawIncidentId) {
      try {
        await incidentsApi.acknowledge(item.rawIncidentId);
      } catch (err) {
        console.warn('Acknowledge error:', err);
      }
    }
    const next = new Set(readIds);
    next.add(item.id);
    if (item.rawIncidentId) {
      next.add(item.rawIncidentId);
      next.add(`inc_${item.rawIncidentId}`);
    }
    setReadIds(next);
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id || n.rawIncidentId === item.rawIncidentId
          ? { ...n, isRead: true, badgeLabel: 'Đã xử lý' }
          : n
      )
    );
  };

  const handleRespondInvite = async (incident: Incident, action: 'accept' | 'reject') => {
    const memberIdMatch = (incident.notes || incident.note || '')?.match(/MEMBER_ID:([a-fA-F0-9-]+)/);
    const memberId = memberIdMatch?.[1] || incident.device_id || incident.id;
    try {
      await householdApi.respondInvite(memberId, action);
      await incidentsApi.acknowledge(incident.id, action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà');
      fetchData();
    } catch (e) {
      console.warn('Respond invite error:', e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const alertsCount = notifications.filter((n) => n.type === 'ALERT').length;
  const aptsCount = notifications.filter((n) => n.type === 'APPOINTMENT').length;
  const othersCount = notifications.filter((n) => n.type === 'INVITE' || n.badgeLabel === 'Hồ sơ y tế').length;

  const filteredNotifications = useMemo(() => {
    const rawQ = searchQuery.trim();
    const qNorm = removeVietnameseTones(rawQ);

    return notifications.filter((item) => {
      // 1. Lọc theo tab
      if (activeTab === 'UNREAD' && item.isRead) return false;
      if (activeTab === 'ALERTS' && item.type !== 'ALERT') return false;
      if (activeTab === 'APPOINTMENTS' && item.type !== 'APPOINTMENT') return false;
      if (activeTab === 'OTHERS' && item.type !== 'INVITE' && item.badgeLabel !== 'Hồ sơ y tế') return false;

      // 2. Tìm kiếm
      if (rawQ) {
        const titleNorm = removeVietnameseTones(item.title);
        const subNorm = removeVietnameseTones(item.subtitle);
        const patNorm = removeVietnameseTones(item.patientName || '');
        const addrNorm = removeVietnameseTones(item.patientAddress || '');
        const match =
          titleNorm.includes(qNorm) ||
          subNorm.includes(qNorm) ||
          patNorm.includes(qNorm) ||
          addrNorm.includes(qNorm);
        if (!match) return false;
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Trang */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl bg-white p-6 shadow-xs border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Trung tâm Thông Báo &amp; Cảnh Báo Lâm Sàng
              </h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white animate-pulse">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Toàn bộ các sự cố y tế, cảnh báo sinh hiệu bất thường, lịch khám và lời mời phụ trách gia đình
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <CheckCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Đã đọc tất cả</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Bộ lọc Tab & Tìm kiếm */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { key: 'ALL' as const, label: 'Tất cả', count: notifications.length },
            { key: 'UNREAD' as const, label: 'Chưa đọc', count: unreadCount, badge: unreadCount > 0 },
            { key: 'ALERTS' as const, label: 'Cảnh báo y tế', count: alertsCount },
            { key: 'APPOINTMENTS' as const, label: 'Lịch khám', count: aptsCount },
            { key: 'OTHERS' as const, label: 'Lời mời & Hồ sơ', count: othersCount },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-blue-200 shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : tab.badge
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Input Tìm kiếm */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo nội dung, tên bệnh nhân..."
            className="w-full rounded-2xl border border-slate-200/90 bg-white pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Danh sách thông báo */}
      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-12 text-center shadow-xs border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-slate-800">
            <Inbox className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            Không tìm thấy thông báo nào
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {searchQuery
              ? `Không có thông báo nào khớp với từ khóa "${searchQuery}".`
              : 'Hiện không có thông báo y tế nào trong mục này.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const isCritical =
              item.alertLevel === 'CRITICAL' ||
              item.alertType === 'FALL_DETECTED' ||
              item.badgeLabel === 'Khẩn cấp' ||
              item.badgeLabel === 'Nguy cấp';
            const isInvite = item.type === 'INVITE';
            const isApt = item.type === 'APPOINTMENT';

            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4.5 cursor-pointer transition-all duration-150 hover:shadow-md ${
                  !item.isRead
                    ? 'border-blue-200 bg-blue-50/30 hover:border-blue-300 dark:border-blue-900/40 dark:bg-blue-950/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start space-x-3.5 min-w-0">
                  {/* Icon Loại thông báo */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl relative shadow-2xs ${
                      isApt
                        ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400'
                        : isInvite
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : isCritical
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                    }`}
                  >
                    {isApt ? (
                      <Calendar className="h-5 w-5" />
                    ) : isInvite ? (
                      <Sparkles className="h-5 w-5" />
                    ) : isCritical ? (
                      <ShieldAlert className="h-5 w-5 animate-pulse" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                    {!item.isRead && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>

                  {/* Nội dung thông báo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold border ${item.badgeColor}`}
                      >
                        {item.badgeLabel}
                      </span>

                      {item.patientName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <User className="h-3 w-3 text-slate-400" />
                          {item.patientName}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {item.timeStr}
                      </span>
                    </div>

                    <h4
                      className={`text-sm leading-snug ${
                        !item.isRead
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'font-semibold text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.title}
                    </h4>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Cột hành động & trạng thái */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                  <span
                    className={`text-[11px] font-bold ${
                      item.isRead
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {item.isRead ? 'Đã xem' : 'Chưa đọc'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotificationClick(item);
                    }}
                    className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors group-hover:border-blue-300 group-hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span>Xem chi tiết</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Xem chi tiết thông báo */}
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
    </div>
  );
};

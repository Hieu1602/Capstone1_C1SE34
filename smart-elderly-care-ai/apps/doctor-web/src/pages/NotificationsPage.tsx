// src/pages/NotificationsPage.tsx
// Trung tâm Thông báo & Cảnh báo Lâm sàng (Linear Inbox SaaS Y tế)
// Tối ưu gọn gàng, chia nhóm theo ngày, phân biệt viền mức độ, phân trang và dọn dẹp văn bản

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi, householdApi, incidentsApi, systemNotificationsApi } from '../services/api';
import { doctorWebSocket } from '../services/websocket';
import { useDoctorDataStore } from '../store/useDoctorDataStore';
import { useDoctorAuthStore } from '../store/useDoctorAuthStore';
import { removeVietnameseTones } from '../utils/text';
import {
  getStoredReadIds,
  markAllAsRead,
  markAsRead,
  toggleReadStatus,
  NOTIFS_SYNC_EVENT,
  SyncPayload,
} from '../utils/notificationSync';
import {
  TabType,
  SeverityType,
  NotificationInboxItem,
  buildNotificationItems,
  isNotificationReadInSet,
  applyAcknowledgeToItem,
} from '../utils/notificationBuilder';
import { NotificationDetailModal, UnifiedNotification } from '../components/clinical/NotificationDetailModal';
import { NotificationRow } from '../components/clinical/NotificationRow';
import { NotificationPagination } from '../components/clinical/NotificationPagination';
import type { Incident } from '../types';
import { Bell, CheckCheck, RefreshCw, Search, ShieldAlert, Inbox, X } from 'lucide-react';

const PAGE_SIZE = 10;

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { patients: cachedPatients, appointments: cachedAppointments, incidents: cachedIncidents } = useDoctorDataStore();

  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [severity, setSeverity] = useState<SeverityType>('ALL');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<NotificationInboxItem[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<UnifiedNotification | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());

  // Lắng nghe sự kiện đồng bộ từ thanh Navbar hoặc các tab/component khác (0ms)
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<SyncPayload>;
      const nextSet = customEvent.detail?.readIds ? new Set(customEvent.detail.readIds) : getStoredReadIds();
      setReadIds(nextSet);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: isNotificationReadInSet(n, nextSet) }))
      );
    };

    window.addEventListener(NOTIFS_SYNC_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(NOTIFS_SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Tải dữ liệu từ cache (0ms) rồi revalidate ngầm
  useEffect(() => {
    if (cachedIncidents.length || cachedPatients.length || cachedAppointments.length) {
      const doctorUserId = useDoctorAuthStore.getState().user?.id;
      setNotifications(
        buildNotificationItems(cachedIncidents, cachedPatients, cachedAppointments, [], readIds, doctorUserId)
      );
    }
  }, [cachedIncidents, cachedPatients, cachedAppointments, readIds]);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [iRes, pRes, aRes, sRes] = await Promise.allSettled([
        incidentsApi.list(undefined, 100),
        doctorApi.getPatients(),
        doctorApi.getAppointments(),
        systemNotificationsApi.getActiveBroadcasts('doctors'),
      ]);
      const currentRead = getStoredReadIds();
      const doctorUserId = useDoctorAuthStore.getState().user?.id;
      const incs = iRes.status === 'fulfilled' && Array.isArray(iRes.value) ? iRes.value : [];
      const pats = pRes.status === 'fulfilled' && Array.isArray(pRes.value) ? pRes.value : [];
      const apts = aRes.status === 'fulfilled' && Array.isArray(aRes.value) ? aRes.value : [];
      const sysList = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : [];
      setNotifications(buildNotificationItems(incs, pats, apts, sysList, currentRead, doctorUserId));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
    const doctorUser = useDoctorAuthStore.getState().user;
    const doctorName = doctorUser?.full_name ? `BS. ${doctorUser.full_name}` : 'Bác sĩ phụ trách';
    const isMatch = (n: UnifiedNotification) =>
      n.id === item.id || Boolean(n.rawIncidentId && n.rawIncidentId === item.rawIncidentId);

    setNotifications((prev) => prev.map((n) => (isMatch(n) ? applyAcknowledgeToItem(n, doctorName) : n)));
    setSelectedNotif((curr) => (curr && isMatch(curr) ? applyAcknowledgeToItem(curr, doctorName) : curr));
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
        n.id === item.id || (n.rawIncidentId && n.rawIncidentId === item.rawIncidentId) ? { ...n, isRead } : n
      )
    );
  };

  // Đánh dấu tất cả đã đọc
  const handleMarkAllRead = async () => {
    incidentsApi.acknowledgeAll().catch(console.warn);
    const allIds = notifications.map((n) => n.id);
    const rawIds = notifications.map((n) => n.rawIncidentId || '').filter(Boolean);
    const next = markAllAsRead(allIds, rawIds);
    setReadIds(next);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleRespondInvite = async (incident: Incident, action: 'accept' | 'reject') => {
    const memberId = incident.notes?.match(/MEMBER_ID:([a-fA-F0-9-]+)/)?.[1] || incident.device_id || incident.id;
    try {
      await householdApi.respondInvite(memberId, action);
      await incidentsApi.acknowledge(incident.id, action === 'accept' ? 'Đã đồng ý vào nhà' : 'Đã từ chối vào nhà');
      useDoctorDataStore.getState().fetchAllData(true);
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

      const isCrit =
        item.alertLevel === 'CRITICAL' || item.alertType === 'FALL_DETECTED' || item.badgeLabel === 'Khẩn cấp';
      if (severity === 'CRITICAL' && !isCrit) return false;
      if (severity === 'WARNING' && (isCrit || item.badgeLabel !== 'Cảnh báo')) return false;

      if (qNorm) {
        const full = removeVietnameseTones(
          `${item.cleanTitle} ${item.cleanDesc} ${item.patientName || ''} ${item.patientAddress || ''}`
        );
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
    const map = new Map<string, { label: string; items: NotificationInboxItem[] }>();
    pagedList.forEach((it) => {
      const g = map.get(it.dateKey) || { label: it.dateLabel, items: [] };
      g.items.push(it);
      map.set(it.dateKey, g);
    });
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [pagedList]);

  const filterTabs: Array<{ k: TabType; l: string; c: number; badge?: boolean }> = [
    { k: 'ALL', l: 'Tất cả', c: notifications.length },
    { k: 'UNREAD', l: 'Chưa đọc', c: unreadCount, badge: unreadCount > 0 },
    { k: 'ADMIN', l: 'Từ Admin', c: notifications.filter((n) => n.type === 'ADMIN').length },
    { k: 'ALERTS', l: 'Cảnh báo y tế', c: notifications.filter((n) => n.type === 'ALERT').length },
    { k: 'APPOINTMENTS', l: 'Lịch khám', c: notifications.filter((n) => n.type === 'APPOINTMENT').length },
    {
      k: 'OTHERS',
      l: 'Lời mời & Hồ sơ',
      c: notifications.filter((n) => n.type === 'INVITE' || n.badgeLabel === 'Hồ sơ y tế').length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header gọn gàng */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-slate-200/80 dark:bg-[#131C31] dark:border-slate-800/80">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Trung tâm Thông Báo &amp; Cảnh Báo Lâm Sàng
              </h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white animate-pulse">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hệ thống tự động ưu tiên hiển thị cảnh báo y tế nguy cấp và điều phối lịch khám của bệnh nhân phụ trách.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Chú thích tự động lọc chống Alert Fatigue */}
      <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        <ShieldAlert className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span>
          Hệ thống tự động lọc bỏ các cảnh báo thiết bị (pin yếu, mất tín hiệu) và dao động nhẹ; các mục này được chuyển trực tiếp tới Gia đình.
        </span>
      </div>

      {/* Toolbar lọc đồng bộ (h-9, text-xs) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {filterTabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setActiveTab(t.k)}
              className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.k
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/90 dark:bg-[#131C31] dark:border-slate-800/80 dark:text-slate-300'
              }`}
            >
              <span>{t.l}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === t.k
                    ? 'bg-white/25 text-white'
                    : t.badge
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {t.c}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SeverityType)}
            className="h-9 rounded-xl border border-slate-200/90 bg-white px-3 pr-8 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-hidden cursor-pointer shadow-2xs dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-slate-300"
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
              className="h-9 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden shadow-2xs dark:border-slate-700/60 dark:bg-[#0F172A] dark:text-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Danh sách thông báo chia nhóm Linear Inbox */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 text-center shadow-xs border border-slate-200/80 dark:bg-[#131C31] dark:border-slate-800/80">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">Không tìm thấy thông báo nào</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {search ? `Không khớp với từ khóa "${search}".` : 'Hiện không có thông báo y tế nào.'}
          </p>
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

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden dark:divide-slate-800 dark:border-slate-800/80 dark:bg-[#131C31]">
                {g.items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onSelect={handleItemClick}
                    onToggleRead={handleToggleRead}
                  />
                ))}
              </div>
            </div>
          ))}

          <NotificationPagination
            page={page}
            totalPages={totalPages}
            startIdx={startIdx}
            endIdx={endIdx}
            totalCount={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal chi tiết */}
      <NotificationDetailModal
        isOpen={showModal}
        notif={selectedNotif}
        onClose={() => {
          setShowModal(false);
          setSelectedNotif(null);
        }}
        onAcknowledge={handleAcknowledge}
        onNavigate={(url) => {
          setShowModal(false);
          setSelectedNotif(null);
          navigate(url);
        }}
        onRespondInvite={handleRespondInvite}
      />
    </div>
  );
};

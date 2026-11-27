// src/components/layout/DoctorNavbar.tsx
// Thanh điều hướng trên cùng mang phong cách Y Tế Clinical Care (kèm thanh tìm kiếm nhanh ⌘K & Trung tâm thông báo lâm sàng đồng bộ 100% với Mobile App & Backend)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, X } from 'lucide-react';
import { useDoctorAuthStore, getDoctorAvatarUri } from '../../store/useDoctorAuthStore';
import { householdApi, incidentsApi, authApi } from '../../services/api';
import { doctorWebSocket } from '../../services/websocket';
import type { Incident } from '../../types';
import { NotificationDetailModal, UnifiedNotification } from '../clinical/NotificationDetailModal';
import {
  getStoredReadIds,
  markAllAsRead,
  markAsRead,
  toggleReadStatus,
  NOTIFS_SYNC_EVENT,
  SyncPayload,
} from '../../utils/notificationSync';
import { isNotificationReadInSet, applyAcknowledgeToItem } from '../../utils/notificationBuilder';
import { fetchDoctorNavbarNotifications } from './navbarNotifications';
import { NotificationBellPopover } from './NotificationBellPopover';
import { DoctorProfileMenu } from './DoctorProfileMenu';

// Chữ cái viết tắt chuẩn xác: "M" (trong "Minh") thay vì "B" (trong "BS.")
function getDoctorInitial(name?: string): string {
  if (!name) return 'M';
  const clean = name.replace(/^(bs\.|bác sĩ|dr\.)\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1]?.[0]?.toUpperCase() || 'M';
}

export const DoctorNavbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useDoctorAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [isDark, setIsDark] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('@doctor_theme') === 'dark';
  });

  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<UnifiedNotification | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notifDropdownRef = useRef<HTMLDivElement | null>(null);
  const doctorName = user?.full_name || 'BS. Trần Văn Minh';
  const doctorInitial = getDoctorInitial(doctorName);

  // Avatar Bác sĩ lấy từ tài khoản hoặc localStorage đồng bộ với Mobile App
  const [doctorAvatar, setDoctorAvatar] = useState<string | null>(() => {
    return getDoctorAvatarUri(user?.avatar_url);
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

  useEffect(() => {
    // Tự động đồng bộ thông tin hồ sơ và avatar mới nhất từ CSDL Backend
    authApi
      .getMe()
      .then((me) => {
        if (me) {
          useDoctorAuthStore.getState().updateUser(me);
          setDoctorAvatar(getDoctorAvatarUri(me.avatar_url));
        }
      })
      .catch(() => {});
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
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: isNotificationReadInSet(n, nextSet) })));
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
      const list = await fetchDoctorNavbarNotifications(user?.id);
      setNotifications(list);
    } catch {
      // Fallback
    }
  }, [user?.id]);

  // Lắng nghe dữ liệu ban đầu và WebSocket Real-time
  useEffect(() => {
    fetchNotifData();
    const interval = setInterval(fetchNotifData, 30000);
    const unsubscribe = doctorWebSocket.subscribe((data) => {
      if (
        data?.type === 'ALERT_NEW' ||
        data?.type === 'INITIAL_ALERTS' ||
        data?.type === 'INCIDENT_RESOLVED' ||
        data?.type === 'INCIDENT_ESCALATED' ||
        data?.alert_type
      ) {
        fetchNotifData();
      }
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

  // Đánh dấu đã đọc tất cả
  const handleMarkAllRead = async () => {
    try {
      incidentsApi.acknowledgeAll().catch(console.warn);
    } catch (err) {
      console.warn('Acknowledge all backend fallback:', err);
    }
    const allIds = notifications.map((n) => n.id);
    const rawIds = notifications.map((n) => n.rawIncidentId || '').filter(Boolean);
    markAllAsRead(allIds, rawIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Đảo trạng thái Đã đọc <-> Chưa đọc cho một thông báo cụ thể
  const handleToggleSingleRead = (e: React.MouseEvent, item: UnifiedNotification) => {
    e.stopPropagation();
    const { isRead } = toggleReadStatus(item.id, item.rawIncidentId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id || (n.rawIncidentId && n.rawIncidentId === item.rawIncidentId)
          ? { ...n, isRead }
          : n
      )
    );
  };

  // Click vào một thông báo: Đánh dấu đã đọc & mở ngay Modal chi tiết
  const handleNotificationClick = (item: UnifiedNotification) => {
    markAsRead(item.id, item.rawIncidentId);
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
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
    markAsRead(item.id, item.rawIncidentId);
    const labelDoctorName = user?.full_name ? `BS. ${user.full_name}` : 'Bác sĩ phụ trách';
    const matchesItem = (n: UnifiedNotification) =>
      n.id === item.id || Boolean(n.rawIncidentId && n.rawIncidentId === item.rawIncidentId);

    setNotifications((prev) => prev.map((n) => (matchesItem(n) ? applyAcknowledgeToItem(n, labelDoctorName) : n)));
    setSelectedNotif((curr) => (curr && matchesItem(curr) ? applyAcknowledgeToItem(curr, labelDoctorName) : curr));
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
        <NotificationBellPopover
          dropdownRef={notifDropdownRef}
          isOpen={showNotifMenu}
          onToggleOpen={() => {
            setShowNotifMenu(!showNotifMenu);
            setShowProfileMenu(false);
            if (!showNotifMenu) fetchNotifData();
          }}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onToggleSingleRead={handleToggleSingleRead}
          onNotificationClick={handleNotificationClick}
          onViewAll={() => {
            setShowNotifMenu(false);
            navigate('/notifications');
          }}
        />

        {/* Thông tin Bác sĩ & Menu Dropdown */}
        <DoctorProfileMenu
          isOpen={showProfileMenu}
          onToggleOpen={() => {
            setShowProfileMenu(!showProfileMenu);
            setShowNotifMenu(false);
          }}
          doctorName={doctorName}
          doctorInitial={doctorInitial}
          doctorAvatar={doctorAvatar}
          doctorPhone={user?.phone}
          onNavigateSettings={() => {
            setShowProfileMenu(false);
            navigate('/settings');
          }}
          onLogout={logout}
        />
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

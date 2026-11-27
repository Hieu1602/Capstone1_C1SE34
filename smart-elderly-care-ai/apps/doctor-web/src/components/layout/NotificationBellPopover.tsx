// src/components/layout/NotificationBellPopover.tsx
// Nút chuông thông báo và Popover trung tâm thông báo lâm sàng trên DoctorNavbar

import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Calendar,
  CheckCheck,
  Check,
  ChevronRight,
  Sparkles,
  Megaphone,
} from 'lucide-react';
import type { UnifiedNotification } from '../clinical/NotificationDetailModal';

type TabType = 'ALL' | 'CRITICAL' | 'APPOINTMENTS';

const EMPTY_CONFIG: Record<TabType, { title: string; sub: string }> = {
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

function isCriticalNotification(item: UnifiedNotification): boolean {
  return (
    item.type === 'ALERT' &&
    (item.badgeLabel === 'Khẩn cấp' || item.badgeLabel === 'Nguy cấp' || item.alertLevel === 'CRITICAL')
  );
}

function getNotificationIconConfig(item: UnifiedNotification) {
  if (item.type === 'ADMIN') {
    return {
      containerClass: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
      icon: <Megaphone className="h-5 w-5" />,
    };
  }
  if (item.type === 'APPOINTMENT') {
    return {
      containerClass: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
      icon: <Calendar className="h-5 w-5" />,
    };
  }
  if (item.type === 'INVITE') {
    return {
      containerClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
      icon: <Sparkles className="h-5 w-5" />,
    };
  }
  if (item.badgeLabel === 'Khẩn cấp' || item.badgeLabel === 'Nguy cấp') {
    return {
      containerClass: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
      icon: <AlertCircle className="h-5 w-5" />,
    };
  }
  return {
    containerClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    icon: <AlertTriangle className="h-5 w-5" />,
  };
}

interface NotificationBellPopoverProps {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  onToggleOpen: () => void;
  notifications: UnifiedNotification[];
  onMarkAllRead: () => void;
  onToggleSingleRead: (e: React.MouseEvent, item: UnifiedNotification) => void;
  onNotificationClick: (item: UnifiedNotification) => void;
  onViewAll: () => void;
}

export const NotificationBellPopover: React.FC<NotificationBellPopoverProps> = ({
  dropdownRef,
  isOpen,
  onToggleOpen,
  notifications,
  onMarkAllRead,
  onToggleSingleRead,
  onNotificationClick,
  onViewAll,
}) => {
  const [notifTab, setNotifTab] = useState<TabType>('ALL');

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const criticalCount = notifications.filter(isCriticalNotification).length;
  const aptsCount = notifications.filter((n) => n.type === 'APPOINTMENT' || n.type === 'INVITE').length;

  const filteredNotifs = notifications.filter((item) => {
    if (notifTab === 'CRITICAL') return isCriticalNotification(item);
    if (notifTab === 'APPOINTMENTS') return item.type === 'APPOINTMENT' || item.type === 'INVITE';
    return true;
  });

  const tabs: { key: TabType; label: string }[] = [
    { key: 'ALL', label: `Tất cả (${notifications.length})` },
    { key: 'CRITICAL', label: `Khẩn cấp (${criticalCount})` },
    { key: 'APPOINTMENTS', label: `Lịch khám (${aptsCount})` },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggleOpen}
        className={`relative rounded-xl p-2 transition-colors ${
          isOpen
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
      {isOpen && (
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
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
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
            {tabs.map((t) => (
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
                  {EMPTY_CONFIG[notifTab].title}
                </p>
                <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                  {EMPTY_CONFIG[notifTab].sub}
                </p>
              </div>
            ) : (
              filteredNotifs.map((item) => {
                const iconConfig = getNotificationIconConfig(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => onNotificationClick(item)}
                    className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                      !item.isRead
                        ? 'bg-blue-50/40 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/40'
                        : 'bg-white hover:bg-slate-50 dark:bg-[#131C31] dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Icon Box */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl relative ${iconConfig.containerClass}`}
                    >
                      {iconConfig.icon}
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
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${item.badgeColor}`}>
                        {item.badgeLabel}
                      </span>
                      {item.isRead ? (
                        <button
                          type="button"
                          onClick={(e) => onToggleSingleRead(e, item)}
                          title="Bấm để đánh dấu Chưa đọc"
                          className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700 border border-emerald-200 transition-colors cursor-pointer dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800"
                        >
                          <Check className="h-2.5 w-2.5" />
                          <span>Đã đọc</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => onToggleSingleRead(e, item)}
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
              onClick={onViewAll}
              className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <span>Xem toàn bộ thông báo</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

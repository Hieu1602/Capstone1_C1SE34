// src/components/layout/AdminMarqueeBanner.tsx
// Thanh thông báo chữ chạy từ trái sang phải (Marquee Ticker) đồng bộ chuẩn như Mobile App
import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, X, ChevronRight } from 'lucide-react';
import { systemNotificationsApi } from '../../services/api';
import { doctorWebSocket } from '../../services/websocket';
import type { SystemNotification } from '../../types';
import { NotificationDetailModal, UnifiedNotification } from '../clinical/NotificationDetailModal';

export const AdminMarqueeBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<SystemNotification[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<UnifiedNotification | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const list = await systemNotificationsApi.getActiveBroadcasts('doctors');
      setAnnouncements(Array.isArray(list) ? list : []);
    } catch {
      setAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();

    const unsub = doctorWebSocket.subscribe((event) => {
      if (event && (event.type === 'SYSTEM_NOTIFICATION' || event.type === 'ADMIN_BROADCAST')) {
        fetchBroadcasts();
      }
    });

    return () => unsub();
  }, [fetchBroadcasts]);

  if (dismissed || announcements.length === 0) {
    return null;
  }

  const primary = announcements[0];

  const getTypeText = (type: string) => {
    switch (type) {
      case 'system_maintenance':
        return 'BẢO TRÌ HỆ THỐNG';
      case 'emergency':
        return 'KHẨN CẤP';
      case 'health_tip':
        return 'CHỈ DẪN Y TẾ';
      case 'feature_update':
        return 'CẬP NHẬT TÍNH NĂNG';
      default:
        return 'THÔNG BÁO ADMIN';
    }
  };

  const tickerText = announcements
    .map((item) => `[${getTypeText(item.type)}] ${item.title}: ${item.body}`)
    .join('      ✦      ');

  const handleClick = (item: SystemNotification) => {
    const typeLabel = getTypeText(item.type);
    setSelectedNotif({
      id: `sys_${item.id}`,
      type: 'ADMIN',
      title: item.title,
      subtitle: item.body,
      timeStr: new Date(item.published_at || item.created_at).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      badgeLabel: typeLabel,
      badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
      badgeBg: 'bg-purple-50',
      isRead: true,
      targetUrl: '/notifications',
      patientName: 'Ban Quản Trị Hệ Thống (Admin)',
      adminNotification: item,
    });
    setShowModal(true);
  };

  return (
    <>
      <style>{`
        @keyframes marqueeLTR {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100vw);
          }
        }
        .animate-marquee-ltr {
          display: inline-block;
          white-space: nowrap;
          animation: marqueeLTR 28s linear infinite;
        }
        .animate-marquee-ltr:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="mb-5 flex items-center h-10 rounded-xl border border-sky-200 bg-sky-50/95 dark:border-slate-800 dark:bg-slate-900/90 px-3 shadow-2xs overflow-hidden backdrop-blur-xs transition-colors">
        {/* Huy hiệu cố định bên trái: Icon loa + nhãn ADMIN như trên Mobile App */}
        <button
          type="button"
          onClick={() => handleClick(primary)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10.5px] font-extrabold tracking-wider shrink-0 shadow-xs transition-all cursor-pointer mr-3"
          title="Bấm để xem chi tiết thông báo từ Admin"
        >
          <Megaphone className="h-3.5 w-3.5 animate-pulse" />
          <span>ADMIN</span>
        </button>

        {/* Vùng chữ chạy (Marquee Viewport) - Chạy mượt mà từ TRÁI sang PHẢI */}
        <div
          onClick={() => handleClick(primary)}
          className="flex-1 overflow-hidden relative h-full flex items-center cursor-pointer group select-none"
          title="Bấm để xem chi tiết thông báo"
        >
          <div className="animate-marquee-ltr text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {tickerText}
          </div>
        </div>

        {/* Nút hành động bên phải */}
        <div className="flex items-center gap-1 shrink-0 ml-2 pl-2 border-l border-sky-200/70 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleClick(primary)}
            className="flex items-center gap-0.5 text-[11px] font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-400 hover:underline cursor-pointer px-1.5 py-0.5"
          >
            <span>Chi tiết</span>
            <ChevronRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-sky-100/60 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title="Đóng thanh thông báo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <NotificationDetailModal
        isOpen={showModal}
        notif={selectedNotif}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

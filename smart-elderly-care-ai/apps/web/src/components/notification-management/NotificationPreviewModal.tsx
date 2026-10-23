import React from 'react';
import { X } from 'lucide-react';
import { SystemNotification } from '../../types';
import { TYPE_CONFIG, AUDIENCE_CONFIG, STATUS_CONFIG } from './constants';

interface NotificationPreviewModalProps {
  notification: SystemNotification | null;
  onClose: () => void;
}

export const NotificationPreviewModal: React.FC<NotificationPreviewModalProps> = ({
  notification,
  onClose,
}) => {
  if (!notification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl glass-card border border-[#C8AD8A] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#C8AD8A]/50 bg-[#FFF8EE] dark:bg-[#1A3830]">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Mô phỏng hiển thị trên Mobile App
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Phone notification mockup banner */}
          <div className="p-4 rounded-2xl bg-[#FFF8EE] dark:bg-[#142823] border border-[#C8AD8A] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#D96C3B] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                  S
                </div>
                <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                  SECA Hệ Thống
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Vừa xong</span>
            </div>

            <div className="font-bold text-xs text-slate-900 dark:text-white">
              {notification.title}
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {notification.body}
            </p>
          </div>

          {/* Metadata details */}
          <div className="space-y-2 text-xs border-t border-[#C8AD8A]/30 pt-3">
            <div className="flex justify-between py-1 border-b border-[#C8AD8A]/20">
              <span className="text-slate-500">Phân loại:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {TYPE_CONFIG[notification.type]?.label}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#C8AD8A]/20">
              <span className="text-slate-500">Đối tượng:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {AUDIENCE_CONFIG[notification.target_audience]?.label}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#C8AD8A]/20">
              <span className="text-slate-500">Trạng thái:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {STATUS_CONFIG[notification.status]?.label}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#C8AD8A]/20">
              <span className="text-slate-500">Thời hạn tồn tại:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {notification.expires_at ? (
                  new Date(notification.expires_at) < new Date() ? (
                    <span className="text-rose-600 dark:text-rose-400">
                      Đã hết hạn lúc {new Date(notification.expires_at).toLocaleString('vi-VN')}
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Hết hạn lúc {new Date(notification.expires_at).toLocaleString('vi-VN')}
                    </span>
                  )
                ) : (
                  'Vĩnh viễn (Không giới hạn)'
                )}
              </span>
            </div>
            {notification.status === 'published' && (
              <div className="flex justify-between py-1 border-b border-[#C8AD8A]/20">
                <span className="text-slate-500">Đã gửi đến:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {notification.delivered_count} người dùng
                </span>
              </div>
            )}
            {notification.revoke_reason && (
              <div className="flex justify-between py-1 text-rose-600 font-medium">
                <span>Lý do thu hồi:</span>
                <span className="font-bold text-right max-w-[200px]">
                  {notification.revoke_reason}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-[#FFF8EE]/60 dark:bg-[#142823]/60 border-t border-[#C8AD8A]/40 flex justify-end">
          <button
            onClick={onClose}
            className="btn-primary"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};


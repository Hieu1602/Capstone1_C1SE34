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
      <div className="w-full max-w-md rounded-2xl glass-card border border-[#E7E9ED] dark:border-[#454A53] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E9ED] dark:border-[#454A53] bg-[#F5F6F8] dark:bg-[#202329]">
          <span className="text-xs font-bold text-[#191B20] dark:text-[#F5F6F8]">
            Mô phỏng hiển thị trên Mobile App
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#737780] hover:text-[#191B20] dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Phone notification mockup banner */}
          <div className="p-4 rounded-2xl bg-[#FFF0E8] dark:bg-[#FF6B35]/15 border border-[#FF6B35]/30 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#FF6B35] text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                  S
                </div>
                <span className="text-[11px] font-bold text-[#191B20] dark:text-[#F5F6F8]">
                  SECA Hệ Thống
                </span>
              </div>
              <span className="text-[10px] text-[#737780] font-mono">Vừa xong</span>
            </div>

            <div className="font-bold text-xs text-[#191B20] dark:text-[#F5F6F8]">
              {notification.title}
            </div>
            <p className="text-xs text-[#737780] dark:text-[#A1A7B1] whitespace-pre-line leading-relaxed">
              {notification.body}
            </p>
          </div>

          {/* Metadata details */}
          <div className="space-y-2 text-xs border-t border-[#E7E9ED] dark:border-[#454A53] pt-3">
            <div className="flex justify-between py-1 border-b border-[#E7E9ED] dark:border-[#454A53]">
              <span className="text-[#737780]">Phân loại:</span>
              <span className="font-bold text-[#191B20] dark:text-[#F5F6F8]">
                {TYPE_CONFIG[notification.type]?.label}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E7E9ED] dark:border-[#454A53]">
              <span className="text-[#737780]">Đối tượng:</span>
              <span className="font-bold text-[#191B20] dark:text-[#F5F6F8]">
                {AUDIENCE_CONFIG[notification.target_audience]?.label}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E7E9ED] dark:border-[#454A53]">
              <span className="text-[#737780]">Trạng thái:</span>
              <span className="font-bold text-[#191B20] dark:text-[#F5F6F8]">
                {STATUS_CONFIG[notification.status]?.label}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E7E9ED] dark:border-[#454A53]">
              <span className="text-[#737780]">Thời hạn tồn tại:</span>
              <span className="font-bold text-[#191B20] dark:text-[#F5F6F8]">
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
              <div className="flex justify-between py-1 border-b border-[#E7E9ED] dark:border-[#454A53]">
                <span className="text-[#737780]">Đã gửi đến:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {notification.delivered_count} người dùng
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-[#737780]">Tạo bởi Admin:</span>
              <span className="font-mono text-[#737780] dark:text-[#A1A7B1]">
                {notification.created_by}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="btn-primary"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
